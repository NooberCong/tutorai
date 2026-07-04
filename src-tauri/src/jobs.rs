//! Registry of in-flight Claude jobs, keyed by id for cancellation.

use crate::claude::{self, JobEvent, JobSpec};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tauri::ipc::Channel;
use tokio::sync::oneshot;

#[derive(Default)]
pub struct Jobs {
    inner: Arc<Inner>,
}

#[derive(Default)]
struct Inner {
    next_id: AtomicU64,
    cancels: Mutex<HashMap<u64, oneshot::Sender<()>>>,
}

impl Jobs {
    /// Spawn a job. Returns immediately with its id; events (including exactly
    /// one terminal Done/Failed) flow through the channel.
    pub fn spawn(&self, spec: JobSpec, channel: Channel<JobEvent>) -> u64 {
        let inner = self.inner.clone();
        let id = inner.next_id.fetch_add(1, Ordering::Relaxed) + 1;
        let (cancel_tx, cancel_rx) = oneshot::channel();
        inner.cancels.lock().unwrap().insert(id, cancel_tx);

        tauri::async_runtime::spawn(async move {
            claude::run(spec, cancel_rx, move |event| {
                let _ = channel.send(event);
            })
            .await;
            inner.cancels.lock().unwrap().remove(&id);
        });
        id
    }

    pub fn cancel(&self, id: u64) {
        if let Some(tx) = self.inner.cancels.lock().unwrap().remove(&id) {
            let _ = tx.send(());
        }
    }
}
