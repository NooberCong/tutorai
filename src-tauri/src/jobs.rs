//! Registry of in-flight Claude jobs, keyed by id for cancellation and
//! permission answers.

use crate::claude::{self, Control, JobEvent, JobSpec};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::ipc::Channel;
use tokio::sync::mpsc;

#[derive(Default)]
pub struct Jobs {
    inner: Arc<Inner>,
}

#[derive(Default)]
struct Inner {
    next_id: AtomicU64,
    controls: Mutex<HashMap<u64, mpsc::UnboundedSender<Control>>>,
}

impl Jobs {
    /// Spawn a job. Returns immediately with its id; events (including exactly
    /// one terminal Done/Failed) flow through the channel.
    pub fn spawn(&self, spec: JobSpec, channel: Channel<JobEvent>) -> u64 {
        let inner = self.inner.clone();
        let id = inner.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        let (control_tx, control_rx) = mpsc::unbounded_channel();
        inner.controls.lock().unwrap().insert(id, control_tx);

        tauri::async_runtime::spawn(async move {
            claude::run(spec, control_rx, move |event| {
                let _ = channel.send(event);
            })
            .await;
            inner.controls.lock().unwrap().remove(&id);
        });
        id
    }

    pub fn cancel(&self, id: u64) {
        self.send(id, Control::Cancel);
    }

    pub fn answer(&self, id: u64, request_id: String, allow: bool) {
        self.send(id, Control::Answer { request_id, allow });
    }

    /// A job that already finished has nothing left to tell.
    fn send(&self, id: u64, control: Control) {
        if let Some(tx) = self.inner.controls.lock().unwrap().get(&id) {
            let _ = tx.send(control);
        }
    }
}
