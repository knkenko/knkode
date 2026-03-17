use alacritty_terminal::event::{Event, EventListener};
use std::sync::mpsc;

/// Forwards terminal events to a channel consumed by the instance's event loop thread.
#[derive(Clone)]
pub struct EventProxy(mpsc::Sender<Event>);

impl EventProxy {
    pub fn new(sender: mpsc::Sender<Event>) -> Self {
        Self(sender)
    }
}

impl EventListener for EventProxy {
    fn send_event(&self, event: Event) {
        if let Err(e) = self.0.send(event) {
            log::warn!("EventProxy: failed to send event: {e}");
        }
    }
}
