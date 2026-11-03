//! Keeps the app from drawing for nobody while its main window can't be
//! seen. WebView2 doesn't notice on its own (neither does wry), so the page
//! kept `document.visibilityState === "visible"` and rendered every frame
//! of the reader's backdrop in the background — the bulk of the app's CPU
//! and battery use.
//!
//! - Minimized, or on another virtual desktop: the controller's
//!   `IsVisible` goes false, as the WebView2 docs ask hosts to do. Chromium
//!   stops drawing and throttles timers, and the page sees
//!   `visibilitychange`. Windows keeps the snapshot it took before
//!   minimizing for the taskbar and Alt-Tab.
//! - Entirely covered by other windows: the webview stays visible, since a
//!   hidden one draws nothing, not even its last frame, and Alt-Tab, Task
//!   View and taskbar previews would show it blank. The page is told
//!   instead (`window-covered`, `window_covered`) and pauses the backdrop.
//!
//! Coverage follows Chromium's own native-window occlusion tracker: walk
//! the windows above ours in z-order and subtract their (opaque) frames
//! from ours. It's recomputed on window events (out-of-context WinEvent
//! hook on its own thread), not polled. Becoming more visible applies at
//! once; less visible waits a second, so a window dragged across ours
//! doesn't flicker it. Every doubt (layered or click-through windows,
//! failed calls) counts as "seen": a mistake costs CPU, never a blank
//! window.

use std::cell::RefCell;
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{Emitter, WebviewWindow};
use windows::Win32::Foundation::{HWND, RECT};
use windows::Win32::Graphics::Dwm::{
    DwmGetWindowAttribute, DWMWA_CLOAKED, DWMWA_EXTENDED_FRAME_BOUNDS,
};
use windows::Win32::Graphics::Gdi::{
    CombineRgn, CreateRectRgnIndirect, DeleteObject, NULLREGION, RGN_DIFF,
};
use windows::Win32::UI::Accessibility::{SetWinEventHook, HWINEVENTHOOK};
use windows::Win32::UI::WindowsAndMessaging::{
    GetAncestor, GetLayeredWindowAttributes, GetMessageW, GetSystemMetrics, GetWindow,
    GetWindowLongPtrW, GetWindowRect, IsIconic, IsWindowVisible, KillTimer, SetTimer, CHILDID_SELF,
    EVENT_OBJECT_CLOAKED, EVENT_OBJECT_DESTROY, EVENT_OBJECT_LOCATIONCHANGE, EVENT_OBJECT_REORDER,
    EVENT_OBJECT_UNCLOAKED, EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_MINIMIZEEND,
    EVENT_SYSTEM_MINIMIZESTART, GA_ROOT, GWL_EXSTYLE, GW_HWNDPREV, LAYERED_WINDOW_ATTRIBUTES_FLAGS,
    LWA_ALPHA, LWA_COLORKEY, MSG, OBJID_WINDOW, SM_CXVIRTUALSCREEN, SM_CYVIRTUALSCREEN,
    SM_XVIRTUALSCREEN, SM_YVIRTUALSCREEN, WINEVENT_OUTOFCONTEXT, WM_TIMER, WS_EX_LAYERED,
    WS_EX_TRANSPARENT,
};

/// How long the window must stay less visible before that applies.
const HIDE_AFTER_MS: u32 = 1000;
/// While not fully seen, a recheck this often, in case a reveal raised no
/// event.
const RECHECK_MS: u32 = 2000;

#[derive(Clone, Copy, PartialEq, PartialOrd)]
enum Seen {
    /// Minimized or on another desktop.
    Gone,
    /// Behind other windows.
    Covered,
    /// At least partly on screen.
    Yes,
}

struct Tracker {
    hwnd: HWND,
    seen: Seen,
    /// The confirm timer while seen; the recheck otherwise.
    timer: usize,
    apply: Box<dyn Fn(Seen)>,
}

static COVERED: AtomicBool = AtomicBool::new(false);

/// Whether the main window is entirely behind other windows (the page asks
/// on load; changes arrive as `window-covered`).
#[tauri::command]
pub fn window_covered() -> bool {
    COVERED.load(Ordering::Relaxed)
}

thread_local! {
    static TRACKER: RefCell<Option<Tracker>> = const { RefCell::new(None) };
}

pub fn track(window: &WebviewWindow) {
    let Ok(hwnd) = window.hwnd() else { return };
    let hwnd = hwnd.0 as isize;
    let window = window.clone();
    std::thread::spawn(move || {
        let apply = Box::new(move |seen: Seen| {
            let visible = seen != Seen::Gone;
            let _ = window.with_webview(move |webview| unsafe {
                let _ = webview.controller().SetIsVisible(visible);
            });
            let covered = seen == Seen::Covered;
            if COVERED.swap(covered, Ordering::Relaxed) != covered {
                let _ = window.emit("window-covered", covered);
            }
        });
        TRACKER.with(|t| {
            *t.borrow_mut() = Some(Tracker {
                hwnd: HWND(hwnd as _),
                seen: Seen::Yes,
                timer: 0,
                apply,
            })
        });
        unsafe {
            // Any top-level window's change can cover or uncover ours,
            // our own window's included (moved, restored).
            let flags = WINEVENT_OUTOFCONTEXT;
            let ranges = [
                (EVENT_SYSTEM_FOREGROUND, EVENT_SYSTEM_FOREGROUND),
                (EVENT_SYSTEM_MINIMIZESTART, EVENT_SYSTEM_MINIMIZEEND),
                // destroy, show, hide, and z-order changes
                (EVENT_OBJECT_DESTROY, EVENT_OBJECT_REORDER),
                (EVENT_OBJECT_LOCATIONCHANGE, EVENT_OBJECT_LOCATIONCHANGE),
                (EVENT_OBJECT_CLOAKED, EVENT_OBJECT_UNCLOAKED),
            ];
            for (lo, hi) in ranges {
                let _: HWINEVENTHOOK = SetWinEventHook(lo, hi, None, Some(on_event), 0, 0, flags);
            }
            let mut msg = MSG::default();
            while GetMessageW(&mut msg, None, 0, 0).as_bool() {
                if msg.message == WM_TIMER {
                    on_timer();
                }
            }
        }
    });
}

unsafe extern "system" fn on_event(
    _hook: HWINEVENTHOOK,
    event: u32,
    hwnd: HWND,
    id_object: i32,
    id_child: i32,
    _thread: u32,
    _time: u32,
) {
    // A z-order change is reported on the parent (the desktop, for
    // top-level windows), so it can't be filtered like the rest.
    if event == EVENT_OBJECT_REORDER {
        return update();
    }
    // Only whole top-level windows matter; the cursor, carets and controls
    // inside windows raise most of these events and are ignored here.
    if id_object != OBJID_WINDOW.0 || id_child != CHILDID_SELF as i32 || hwnd.0.is_null() {
        return;
    }
    if GetAncestor(hwnd, GA_ROOT) != hwnd {
        return;
    }
    update();
}

/// After an event: more visible applies at once; less visible waits for
/// the timer to confirm it.
fn update() {
    TRACKER.with(|t| {
        let mut t = t.borrow_mut();
        let Some(t) = t.as_mut() else { return };
        let seen = unsafe { seen(t.hwnd) };
        if seen > t.seen || (seen < t.seen && t.seen == Seen::Covered) {
            // (covered → minimized changes nothing on screen: no need to wait)
            set_seen(t, seen);
        } else if seen < t.seen && t.timer == 0 {
            t.timer = unsafe { SetTimer(None, 0, HIDE_AFTER_MS, None) };
        }
    });
}

/// The confirm timer, or the recheck: apply what's true now.
fn on_timer() {
    TRACKER.with(|t| {
        let mut t = t.borrow_mut();
        let Some(t) = t.as_mut() else { return };
        let seen = unsafe { seen(t.hwnd) };
        if seen != t.seen {
            set_seen(t, seen);
        } else if seen == Seen::Yes {
            // seen again before the change was confirmed
            stop_timer(t);
        }
    });
}

fn stop_timer(t: &mut Tracker) {
    if t.timer != 0 {
        unsafe {
            let _ = KillTimer(None, t.timer);
        }
        t.timer = 0;
    }
}

fn set_seen(t: &mut Tracker, seen: Seen) {
    stop_timer(t);
    if seen != Seen::Yes {
        t.timer = unsafe { SetTimer(None, 0, RECHECK_MS, None) };
    }
    t.seen = seen;
    (t.apply)(seen);
}

unsafe fn frame(hwnd: HWND) -> Option<RECT> {
    // The visible frame, without the invisible resize borders around it
    // (GetWindowRect's), or side-by-side windows would seem to overlap.
    let mut r = RECT::default();
    let size = std::mem::size_of::<RECT>() as u32;
    if DwmGetWindowAttribute(
        hwnd,
        DWMWA_EXTENDED_FRAME_BOUNDS,
        &mut r as *mut _ as *mut _,
        size,
    )
    .is_err()
        && GetWindowRect(hwnd, &mut r).is_err()
    {
        return None;
    }
    (r.right > r.left && r.bottom > r.top).then_some(r)
}

unsafe fn cloaked(hwnd: HWND) -> bool {
    let mut c: u32 = 0;
    DwmGetWindowAttribute(hwnd, DWMWA_CLOAKED, &mut c as *mut _ as *mut _, 4).is_ok() && c != 0
}

/// Whether a window above ours hides what's under its frame.
unsafe fn opaque(hwnd: HWND) -> bool {
    if !IsWindowVisible(hwnd).as_bool() || IsIconic(hwnd).as_bool() || cloaked(hwnd) {
        return false;
    }
    let ex = GetWindowLongPtrW(hwnd, GWL_EXSTYLE) as u32;
    if ex & WS_EX_TRANSPARENT.0 != 0 {
        return false;
    }
    if ex & WS_EX_LAYERED.0 != 0 {
        // Layered windows are often see-through overlays; only a plain
        // fully opaque one counts (per-pixel alpha ones fail this call).
        let mut alpha = 0u8;
        let mut flags = LAYERED_WINDOW_ATTRIBUTES_FLAGS(0);
        if GetLayeredWindowAttributes(hwnd, None, Some(&mut alpha), Some(&mut flags)).is_err()
            || flags.0 & LWA_COLORKEY.0 != 0
            || (flags.0 & LWA_ALPHA.0 != 0 && alpha != 255)
        {
            return false;
        }
    }
    true
}

unsafe fn seen(hwnd: HWND) -> Seen {
    // Not shown yet (startup) is the app's business, not ours.
    if !IsWindowVisible(hwnd).as_bool() {
        return Seen::Yes;
    }
    if IsIconic(hwnd).as_bool() || cloaked(hwnd) {
        return Seen::Gone;
    }
    let Some(mut r) = frame(hwnd) else {
        return Seen::Yes;
    };
    // Only the part on the desktop can be seen.
    let (vx, vy) = (
        GetSystemMetrics(SM_XVIRTUALSCREEN),
        GetSystemMetrics(SM_YVIRTUALSCREEN),
    );
    let (vw, vh) = (
        GetSystemMetrics(SM_CXVIRTUALSCREEN),
        GetSystemMetrics(SM_CYVIRTUALSCREEN),
    );
    r.left = r.left.max(vx);
    r.top = r.top.max(vy);
    r.right = r.right.min(vx + vw);
    r.bottom = r.bottom.min(vy + vh);
    if r.right <= r.left || r.bottom <= r.top {
        return Seen::Covered;
    }
    let left = CreateRectRgnIndirect(&r);
    let mut empty = false;
    let mut above = GetWindow(hwnd, GW_HWNDPREV);
    while let Ok(w) = above {
        if w.0.is_null() {
            break;
        }
        if opaque(w) {
            if let Some(f) = frame(w) {
                let cut = CreateRectRgnIndirect(&f);
                let kind = CombineRgn(Some(left), Some(left), Some(cut), RGN_DIFF);
                let _ = DeleteObject(cut.into());
                if kind == NULLREGION {
                    empty = true;
                    break;
                }
            }
        }
        above = GetWindow(w, GW_HWNDPREV);
    }
    let _ = DeleteObject(left.into());
    if empty {
        Seen::Covered
    } else {
        Seen::Yes
    }
}
