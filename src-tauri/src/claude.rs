//! Headless invocation of the `claude` CLI.
//!
//! One spawn per job: `claude -p --output-format=stream-json` with the prompt
//! written to stdin, NDJSON frames translated into typed [`JobEvent`]s and
//! streamed back to the webview over a Tauri channel. Multi-turn chat rides on
//! the CLI's own session persistence via `--resume <session_id>`.
//!
//! Two permission postures:
//! - read-only (default): Read/Glob/Grep work out of the box in `-p` mode,
//!   and WebSearch/WebFetch are explicitly allowed (they need approval, which
//!   headless mode can never prompt for, but they don't touch the machine).
//!   Everything else that needs approval (Bash/Write/Edit) stays denied.
//! - agentic (coding projects): `--permission-mode=bypassPermissions`, cwd
//!   pinned to the project workspace.

use serde::{Deserialize, Serialize};
use std::process::Stdio;
use std::sync::{Arc, Mutex};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::oneshot;

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

/// Spawn `claude` for one job and pump events into `emit` until a terminal
/// event has been sent. Dropping the `cancel` sender lets the job run to
/// completion; sending on it kills the subprocess.
pub async fn run(spec: JobSpec, cancel: oneshot::Receiver<()>, emit: impl Fn(JobEvent)) {
    let mut cmd = tokio::process::Command::new("claude");
    cmd.args([
        "-p",
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
        // Headless mode can't prompt for approval, so unlisted gated tools are
        // simply denied. Grant the web: it can't modify anything locally.
        cmd.args(["--allowedTools=WebSearch,WebFetch"]);
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

    // Prompt goes through stdin — no shell-quoting concerns, no length limits.
    if let Some(mut stdin) = child.stdin.take() {
        let prompt = spec.prompt.clone();
        tokio::spawn(async move {
            let _ = stdin.write_all(prompt.as_bytes()).await;
            let _ = stdin.shutdown().await;
        });
    }

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

    tokio::pin!(cancel);
    loop {
        let line = tokio::select! {
            _ = &mut cancel => {
                let _ = child.kill().await;
                emit(JobEvent::Failed { message: "cancelled".into() });
                return;
            }
            line = lines.next_line() => line,
        };
        match line {
            Ok(Some(line)) => {
                if let Some(done) = translate_line(&line, &mut session_id, &emit) {
                    emit(done);
                    let _ = child.wait().await;
                    return;
                }
            }
            Ok(None) | Err(_) => break,
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

/// Translate one NDJSON line. Non-terminal events are emitted inline; a
/// terminal `Done` is returned to the caller.
fn translate_line(
    line: &str,
    session_id: &mut Option<String>,
    emit: &impl Fn(JobEvent),
) -> Option<JobEvent> {
    let v: serde_json::Value = serde_json::from_str(line.trim()).ok()?;
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
            Some(JobEvent::Done {
                ok: status == "success",
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
