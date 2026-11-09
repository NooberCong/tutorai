//! Headless invocation of the `claude` CLI.
//!
//! One spawn per job: `claude -p` speaking stream-json both ways. The prompt
//! goes in as one user message on stdin, NDJSON frames come back translated
//! into typed [`JobEvent`]s and streamed to the webview over a Tauri channel.
//! Stdin stays open until the result frame, because the CLI also asks its
//! host for permission over it. Multi-turn chat rides on the CLI's own session
//! persistence via `--resume <session_id>`.
//!
//! Permission postures:
//! - read-only (default): Read/Glob/Grep work inside the working directory,
//!   WebSearch/WebFetch are allowed outright (they don't touch the machine).
//!   Anything else is denied, unless `ask_permission` is set: then the CLI
//!   hands each such tool call to us as a `can_use_tool` control request,
//!   surfaced as [`JobEvent::Permission`] and answered by the reader through
//!   [`Control::Answer`].
//! - agentic (coding projects): `--permission-mode=bypassPermissions`, cwd
//!   pinned to the project workspace.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::ChildStdin;
use tokio::sync::mpsc;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobSpec {
    pub prompt: String,
    /// Working directory for the spawn — the doc cache dir for document jobs
    /// (so Claude can Read chapter files), the workspace dir for projects.
    pub cwd: String,
    /// Grants write/execute tools and bypasses permission prompts.
    #[serde(default)]
    pub agentic: bool,
    /// Ask the reader (via [`JobEvent::Permission`]) instead of denying tool
    /// calls the read-only posture doesn't cover. Only for jobs someone watches.
    #[serde(default)]
    pub ask_permission: bool,
    #[serde(default)]
    pub model: Option<String>,
    /// Resume an existing CLI session (multi-turn chat).
    #[serde(default)]
    pub resume_session: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum JobEvent {
    Started { session_id: String },
    /// Live text delta from the assistant.
    Delta { text: String },
    /// A tool invocation (agentic jobs surface these as an activity feed).
    Tool { name: String, detail: String },
    ToolDone { is_error: bool },
    /// The run is paused until the reader answers this tool call.
    Permission { request_id: String, tool: String, input: Value },
    /// Terminal: the run produced a result frame.
    Done {
        ok: bool,
        status: String,
        text: String,
        session_id: Option<String>,
        duration_ms: u64,
        total_tokens: u64,
    },
    /// Terminal: the run died without a result frame (spawn failure, kill, …).
    Failed { message: String },
}

/// What the host can tell a running job.
pub enum Control {
    Cancel,
    /// The reader's answer to a [`JobEvent::Permission`].
    Answer { request_id: String, allow: bool },
}

/// Spawn `claude` for one job and pump events into `emit` until a terminal
/// event has been sent.
pub async fn run(
    spec: JobSpec,
    mut control: mpsc::UnboundedReceiver<Control>,
    emit: impl Fn(JobEvent),
) {
    let mut cmd = tokio::process::Command::new("claude");
    cmd.args([
        "-p",
        "--input-format=stream-json",
        "--output-format=stream-json",
        "--verbose",
        "--include-partial-messages",
    ]);
    if spec.agentic {
        cmd.args([
            "--permission-mode=bypassPermissions",
            "--allowedTools=Write,Edit,Read,Bash,Glob,Grep,WebSearch,WebFetch",
        ]);
    } else {
        // The web is granted outright: it can't modify anything locally.
        cmd.arg("--allowedTools=WebSearch,WebFetch");
        // Without a prompt tool nobody answers, so gated calls are denied.
        if spec.ask_permission {
            cmd.args(["--permission-prompt-tool", "stdio"]);
        }
    }
    if let Some(model) = &spec.model {
        cmd.args(["--model", model]);
    }
    if let Some(session) = &spec.resume_session {
        cmd.args(["--resume", session]);
    }
    cmd.current_dir(&spec.cwd)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("NO_COLOR", "1");
    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    let mut child = match cmd.spawn() {
        Ok(child) => child,
        Err(e) => {
            emit(JobEvent::Failed {
                message: format!(
                    "could not start the `claude` CLI ({e}); is Claude Code installed and on PATH?"
                ),
            });
            return;
        }
    };

    // The prompt is one user message: serde does the quoting and stdin has
    // no length limit. The CLI drains stdin as it goes, so this can't stall.
    let mut stdin = child.stdin.take();
    send(
        &mut stdin,
        json!({ "type": "user", "message": { "role": "user", "content": spec.prompt } }),
    )
    .await;

    // Collect a stderr tail for diagnostics if the run dies without a result.
    let stderr_tail: Arc<Mutex<String>> = Arc::default();
    if let Some(stderr) = child.stderr.take() {
        let tail = stderr_tail.clone();
        tokio::spawn(async move {
            let mut lines = BufReader::new(stderr).lines();
            while let Ok(Some(line)) = lines.next_line().await {
                let mut tail = tail.lock().unwrap();
                tail.push_str(&line);
                tail.push('\n');
                if tail.len() > 4000 {
                    let cut = tail.len() - 4000;
                    tail.drain(..cut);
                }
            }
        });
    }

    let stdout = child.stdout.take().expect("stdout was piped");
    let mut lines = BufReader::new(stdout).lines();
    let mut session_id: Option<String> = None;
    // Tool inputs awaiting the reader's answer, by request id.
    let mut pending: HashMap<String, Value> = HashMap::new();
    let mut control_open = true;

    loop {
        tokio::select! {
            ctl = control.recv(), if control_open => match ctl {
                Some(Control::Cancel) => {
                    let _ = child.kill().await;
                    emit(JobEvent::Failed { message: "cancelled".into() });
                    return;
                }
                Some(Control::Answer { request_id, allow }) => {
                    if let Some(input) = pending.remove(&request_id) {
                        send(&mut stdin, permission_response(&request_id, input, allow)).await;
                    }
                }
                None => control_open = false,
            },
            line = lines.next_line() => match line {
                Ok(Some(line)) => {
                    let Ok(v) = serde_json::from_str::<Value>(line.trim()) else { continue };
                    if v["type"] == "control_request" {
                        let id = v["request_id"].as_str().unwrap_or_default().to_string();
                        let request = &v["request"];
                        if request["subtype"] == "can_use_tool" {
                            emit(JobEvent::Permission {
                                request_id: id.clone(),
                                tool: request["tool_name"].as_str().unwrap_or("?").to_string(),
                                input: request["input"].clone(),
                            });
                            pending.insert(id, request["input"].clone());
                        } else {
                            // Nothing else is asked of us with these flags;
                            // refuse rather than leave the CLI waiting.
                            let refusal = json!({ "type": "control_response", "response": {
                                "subtype": "error", "request_id": id, "error": "unsupported request",
                            }});
                            send(&mut stdin, refusal).await;
                        }
                    } else if let Some(done) = translate_line(&v, &mut session_id, &emit) {
                        emit(done);
                        // The CLI keeps reading input until stdin closes.
                        drop(stdin);
                        let _ = child.wait().await;
                        return;
                    }
                }
                Ok(None) | Err(_) => break,
            },
        }
    }

    // Stream ended without a result frame.
    let _ = child.wait().await;
    let tail = stderr_tail.lock().unwrap().trim().to_string();
    emit(JobEvent::Failed {
        message: if tail.is_empty() {
            "claude exited without producing a result".into()
        } else {
            format!("claude exited without producing a result: {tail}")
        },
    });
}

/// Write one NDJSON message to the CLI. A broken pipe means the CLI is gone,
/// which the stdout side reports, so write errors are dropped here.
async fn send(stdin: &mut Option<ChildStdin>, message: Value) {
    if let Some(pipe) = stdin {
        let mut line = message.to_string();
        line.push('\n');
        let _ = pipe.write_all(line.as_bytes()).await;
    }
}

/// Allowing echoes the input back unchanged. Nothing is remembered on the
/// CLI's side: its "don't ask again" rules don't reliably match compound
/// commands, so the host remembers approvals itself.
fn permission_response(request_id: &str, input: Value, allow: bool) -> Value {
    let decision = if allow {
        json!({ "behavior": "allow", "updatedInput": input })
    } else {
        json!({ "behavior": "deny", "message": "The reader declined this." })
    };
    json!({ "type": "control_response", "response": {
        "subtype": "success", "request_id": request_id, "response": decision,
    }})
}

/// Translate one output frame. Non-terminal events are emitted inline; a
/// terminal `Done` is returned to the caller.
fn translate_line(
    v: &Value,
    session_id: &mut Option<String>,
    emit: &impl Fn(JobEvent),
) -> Option<JobEvent> {
    match v.get("type").and_then(|t| t.as_str())? {
        "system" => {
            if v.get("subtype").and_then(|s| s.as_str()) == Some("init") {
                if let Some(sid) = v.get("session_id").and_then(|s| s.as_str()) {
                    *session_id = Some(sid.to_string());
                    emit(JobEvent::Started { session_id: sid.to_string() });
                }
            }
            None
        }
        "stream_event" => {
            let delta = &v["event"]["delta"];
            if delta["type"].as_str() == Some("text_delta") {
                if let Some(text) = delta["text"].as_str() {
                    emit(JobEvent::Delta { text: text.to_string() });
                }
            }
            None
        }
        "assistant" => {
            for block in v["message"]["content"].as_array().into_iter().flatten() {
                if block["type"].as_str() == Some("tool_use") {
                    let detail = serde_json::to_string(&block["input"]).unwrap_or_default();
                    emit(JobEvent::Tool {
                        name: block["name"].as_str().unwrap_or("?").to_string(),
                        detail: truncate(&detail, 300),
                    });
                }
            }
            None
        }
        "user" => {
            for block in v["message"]["content"].as_array().into_iter().flatten() {
                if block["type"].as_str() == Some("tool_result") {
                    emit(JobEvent::ToolDone {
                        is_error: block["is_error"].as_bool().unwrap_or(false),
                    });
                }
            }
            None
        }
        "result" => {
            let status = v["subtype"].as_str().unwrap_or("unknown").to_string();
            let usage = &v["usage"];
            let total_tokens = ["input_tokens", "output_tokens", "cache_creation_input_tokens", "cache_read_input_tokens"]
                .iter()
                .map(|k| usage[k].as_u64().unwrap_or(0))
                .sum();
            // Auth and usage-limit failures arrive as a "success" frame with
            // is_error set and the CLI's message as the result text.
            let is_error = v["is_error"].as_bool().unwrap_or(false);
            Some(JobEvent::Done {
                ok: status == "success" && !is_error,
                text: v["result"].as_str().unwrap_or("").to_string(),
                session_id: session_id.clone(),
                duration_ms: v["duration_ms"].as_u64().unwrap_or(0),
                total_tokens,
                status,
            })
        }
        _ => None,
    }
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        let mut end = max;
        while !s.is_char_boundary(end) {
            end -= 1;
        }
        format!("{}…", &s[..end])
    }
}

/// Quick availability probe for onboarding UX.
pub async fn version() -> Option<String> {
    let mut cmd = tokio::process::Command::new("claude");
    cmd.arg("--version").stdout(Stdio::piped()).stderr(Stdio::null()).stdin(Stdio::null());
    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    let out = tokio::time::timeout(std::time::Duration::from_secs(15), cmd.output())
        .await
        .ok()?
        .ok()?;
    if out.status.success() {
        Some(String::from_utf8_lossy(&out.stdout).trim().to_string())
    } else {
        None
    }
}
