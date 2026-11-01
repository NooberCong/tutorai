//! Markdown documents open as PDFs. The app's reader, search, annotations,
//! citations and AI context are all built on pdf.js pages, so instead of a
//! second reader a Markdown file is typeset once into a real PDF — by the
//! app's own `print.html` page in a hidden webview, printed with Chromium's
//! print-to-PDF — and cached in the document's cache dir. Headings become the
//! PDF outline, so chapters come from it like any bookmarked book.
//!
//! Windows only: printing goes through WebView2's DevTools protocol.

use std::path::Path;
use tauri::AppHandle;

/// The rendered PDF's name inside the doc cache dir.
pub const PDF_NAME: &str = "markdown.pdf";

/// The hidden window renders run in (kept out of saved window state).
pub const WINDOW_LABEL: &str = "markdown-print";

pub fn is_markdown(path: &str) -> bool {
    Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .is_some_and(|e| e.eq_ignore_ascii_case("md") || e.eq_ignore_ascii_case("markdown"))
}

/// Typeset the Markdown file at `src` into a PDF at `out`. Renders run one
/// at a time, through a single hidden window.
pub async fn render_pdf(app: &AppHandle, src: &Path, out: &Path) -> Result<(), String> {
    static ONE_AT_A_TIME: tokio::sync::Mutex<()> = tokio::sync::Mutex::const_new(());
    let _turn = ONE_AT_A_TIME.lock().await;
    if out.exists() {
        return Ok(()); // a render queued ahead of us produced it
    }
    let markdown = std::fs::read_to_string(src).map_err(|e| format!("cannot read file: {e}"))?;
    let dir = src.parent().ok_or("file has no folder")?;
    let name = src.file_stem().and_then(|s| s.to_str()).unwrap_or("Untitled");
    let pdf = print::markdown_to_pdf(app, &markdown, dir, name).await?;
    let tmp = out.with_extension("pdf.tmp");
    std::fs::write(&tmp, pdf).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, out).map_err(|e| e.to_string())
}

#[cfg(windows)]
mod print {
    use base64::Engine;
    use serde_json::{json, Value};
    use std::path::Path;
    use std::time::Duration;
    use tauri::webview::PageLoadEvent;
    use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};
    use tokio::sync::oneshot;
    use tokio::time::timeout;
    use webview2_com::CallDevToolsProtocolMethodCompletedHandler;
    use windows::core::HSTRING;

    pub async fn markdown_to_pdf(
        app: &AppHandle,
        markdown: &str,
        dir: &Path,
        name: &str,
    ) -> Result<Vec<u8>, String> {
        // Images beside the file load through the asset protocol.
        app.asset_protocol_scope()
            .allow_directory(dir, true)
            .map_err(|e| e.to_string())?;
        let job = json!({ "markdown": markdown, "dir": dir, "name": name });
        let (loaded_tx, loaded_rx) = oneshot::channel();
        let loaded_tx = std::sync::Mutex::new(Some(loaded_tx));
        let window = WebviewWindowBuilder::new(app, super::WINDOW_LABEL, WebviewUrl::App("print.html".into()))
            .visible(false)
            .skip_taskbar(true)
            .initialization_script(format!("window.__PRINT_JOB__ = {job};"))
            .on_page_load(move |_, payload| {
                if payload.event() == PageLoadEvent::Finished {
                    if let Some(tx) = loaded_tx.lock().unwrap().take() {
                        let _ = tx.send(());
                    }
                }
            })
            .build()
            .map_err(|e| e.to_string())?;
        let result = print(&window, loaded_rx).await;
        let _ = window.destroy();
        result
    }

    async fn print(window: &WebviewWindow, loaded: oneshot::Receiver<()>) -> Result<Vec<u8>, String> {
        timeout(Duration::from_secs(30), loaded)
            .await
            .map_err(|_| "the print page did not load")?
            .map_err(|_| "the print page closed")?;
        // print.html typesets the document, then resolves this promise once
        // fonts and images are in.
        let ready = cdp(
            window,
            "Runtime.evaluate",
            json!({ "expression": "window.__printReady", "awaitPromise": true }),
        )
        .await?;
        if let Some(e) = ready.get("exceptionDetails") {
            return Err(format!("typesetting failed: {}", e["exception"]["description"]));
        }
        // Page size and margins come from print.css (@page).
        let printed = cdp(
            window,
            "Page.printToPDF",
            json!({
                "printBackground": true,
                "preferCSSPageSize": true,
                "generateTaggedPDF": true,
                "generateDocumentOutline": true,
            }),
        )
        .await?;
        let data = printed["data"].as_str().ok_or("print returned no PDF")?;
        base64::engine::general_purpose::STANDARD
            .decode(data)
            .map_err(|e| e.to_string())
    }

    /// One DevTools protocol call on the window's WebView2; resolves with
    /// the call's JSON result.
    async fn cdp(window: &WebviewWindow, method: &str, params: Value) -> Result<Value, String> {
        let (tx, rx) = oneshot::channel::<Result<String, String>>();
        let method = HSTRING::from(method);
        let params = HSTRING::from(params.to_string());
        window
            .with_webview(move |webview| {
                let handler = CallDevToolsProtocolMethodCompletedHandler::create(Box::new(
                    move |status, json| {
                        let _ = tx.send(status.map(|_| json).map_err(|e| e.message()));
                        Ok(())
                    },
                ));
                // The handler owns `tx`; if the call can't even start, the
                // dropped handler closes the channel and the await below fails.
                unsafe {
                    if let Ok(core) = webview.controller().CoreWebView2() {
                        let _ = core.CallDevToolsProtocolMethod(&method, &params, &handler);
                    }
                }
            })
            .map_err(|e| e.to_string())?;
        let json = timeout(Duration::from_secs(60), rx)
            .await
            .map_err(|_| "the print page stopped responding")?
            .map_err(|_| "the print page could not be reached")??;
        serde_json::from_str(&json).map_err(|e| e.to_string())
    }
}

#[cfg(not(windows))]
mod print {
    pub async fn markdown_to_pdf(
        _: &tauri::AppHandle,
        _: &str,
        _: &std::path::Path,
        _: &str,
    ) -> Result<Vec<u8>, String> {
        Err("Markdown files open on Windows only".into())
    }
}
