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

## Flows worth driving

- Boot: window appears with inline splash from `index.html`, then Library view. App fully settles in ~1s on a warm dev start.
- Boot resilience: launch the exe with vite down — the window must still appear (error page) rather than the app running invisibly; there's also a 10s fallback `show()` in `lib.rs` setup.
- "Open with" flow: pass a `.pdf` path as CLI arg to the exe; second launch should focus the existing instance (single-instance plugin) and emit `open-file`.
