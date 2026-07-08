---
name: verify
description: Build, launch, and observe the TutorAI Tauri app on Windows to verify changes at the GUI surface.
---

# Verifying TutorAI (Tauri 2, Windows)

## Build & launch

- Full dev run: `npm run tauri dev` (starts vite on :1420, then cargo-builds and launches). Note: killing the npm task kills vite but may orphan `tutorai.exe` — stop it with `Get-Process tutorai | Stop-Process -Force`.
- Faster iteration once `src-tauri\target\debug\tutorai.exe` exists: run `npm run dev` in the background, wait for port 1420 (`Test-NetConnection localhost -Port 1420`), then launch the exe directly with `Start-Process ... -PassThru`. The dev exe loads `http://localhost:1420`.
- Rust-only sanity: `cargo check --manifest-path src-tauri/Cargo.toml`.

## Observing the window

- Poll `$proc.MainWindowHandle` + `user32 IsWindowVisible` to detect when the window appears (the window is created hidden and shown from `on_page_load` in `src-tauri/src/lib.rs`, so appearance == page loaded).
- Screenshot: capture the FULL SCREEN via `System.Drawing` `CopyFromScreen` with `[System.Windows.Forms.Screen]::PrimaryScreen.Bounds` after `SetProcessDPIAware()`. Per-window `GetWindowRect` P/Invoke returned garbage (4x4) from pwsh — don't use it.
- Full-screen captures include the user's other windows — delete them after reading; keep only frames where the app is maximized/foreground.
- `SetForegroundWindow` the app handle before snapping; window-state plugin restores maximized, so the app usually fills the screen by the second frame.
- `EnumWindows` with a PowerShell scriptblock delegate fails to marshal in pwsh — use `Get-Process` `MainWindowHandle` instead.

## Driving the app without stealing focus (preferred)

When the user is actively using the machine, do NOT use SetForegroundWindow /
SendKeys / screen-coordinate clicks — they land in the user's apps. Instead:

- Relaunch the debug exe with a CDP port: `$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222"` then `Start-Process ...tutorai.exe`. `http://localhost:9222/json` lists targets; connect a WebSocket to the `page` target's `webSocketDebuggerUrl` from a small Node script (global `WebSocket` exists in Node ≥22).
- `Runtime.evaluate` reads/drives DOM state; `Input.dispatchMouseEvent`/`dispatchKeyEvent` deliver **trusted** input (text selection, pointer capture, drag-draw all work); `Page.captureScreenshot` captures only the app, no focus needed.
- Foreground-free window captures also work via `PrintWindow(hwnd, dc, 2)` P/Invoke (unlike `GetWindowRect`-based `CopyFromScreen`, this is DPI-safe in practice).
- Beware: the user may be interacting with the app at the same time — check `.reader` className / armed tool state via `Runtime.evaluate` before dispatching gestures, or your drag may execute a different tool.

## Gotchas that cost real time

- Check WHICH build is running before testing: `Get-Process tutorai | Select Path`. A `target\release` exe serves **bundled** assets — frontend edits never reach it; only the `target\debug` exe loads vite. Single-instance means the debug exe won't launch while release runs — stop the release process first.
- Vite HMR does not reliably apply in the WebView2 dev build. After every frontend edit, send Ctrl+R to the app window (SendKeys `^r`) for a full reload — and note reload lands on the Library, so re-open the doc.
- `document.title` does NOT reach the native window title (`MainWindowTitle`) in Tauri — don't use it as a debug channel. A fixed-position DOM overlay read via screenshots works.
- The user's other windows steal focus between steps: call `SetForegroundWindow` immediately before EVERY synthetic click/drag/screenshot, not once per batch, or clicks land in their apps.

## Flows worth driving

- Boot: window appears with inline splash from `index.html`, then Library view. App fully settles in ~1s on a warm dev start.
- Boot resilience: launch the exe with vite down — the window must still appear (error page) rather than the app running invisibly; there's also a 10s fallback `show()` in `lib.rs` setup.
- "Open with" flow: pass a `.pdf` path as CLI arg to the exe; second launch should focus the existing instance (single-instance plugin) and emit `open-file`.
