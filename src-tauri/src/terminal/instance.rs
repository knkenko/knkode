use alacritty_terminal::event::{Event, Notify, OnResize, WindowSize};
use alacritty_terminal::event_loop::{EventLoop, Msg, Notifier};
use alacritty_terminal::sync::FairMutex;
use alacritty_terminal::term::test::TermSize;
use alacritty_terminal::term::{Config as TermConfig, Term};
use alacritty_terminal::tty;
use std::sync::mpsc;
use std::sync::Arc;
use std::thread::JoinHandle;
use tauri::{AppHandle, Emitter};

use crate::terminal::event_proxy::EventProxy;
use crate::terminal::types::{extract_grid, CellGrid};

const DEFAULT_COLS: u16 = 80;
const DEFAULT_ROWS: u16 = 24;
const CELL_WIDTH: u16 = 8;
const CELL_HEIGHT: u16 = 16;

/// A single terminal instance: PTY + alacritty Term + event loop.
pub struct TerminalInstance {
    id: String,
    term: Arc<FairMutex<Term<EventProxy>>>,
    notifier: Notifier,
    pty_thread: Option<
        JoinHandle<(
            EventLoop<tty::Pty, EventProxy>,
            alacritty_terminal::event_loop::State,
        )>,
    >,
    event_thread: Option<JoinHandle<()>>,
}

impl TerminalInstance {
    /// Spawn a new terminal with the user's default shell.
    pub fn spawn(id: String, app_handle: AppHandle) -> Result<Self, Box<dyn std::error::Error>> {
        let pty_config = tty::Options::default();
        let terminal_size = TermSize::new(DEFAULT_COLS as usize, DEFAULT_ROWS as usize);
        let window_size = WindowSize {
            num_lines: DEFAULT_ROWS,
            num_cols: DEFAULT_COLS,
            cell_width: CELL_WIDTH,
            cell_height: CELL_HEIGHT,
        };

        let pty = tty::new(&pty_config, window_size, 0)?;

        let (event_tx, event_rx) = mpsc::channel();
        let event_proxy = EventProxy::new(event_tx);

        let config = TermConfig::default();
        let term = Term::new(config, &terminal_size, event_proxy.clone());
        let term = Arc::new(FairMutex::new(term));

        let event_loop = EventLoop::new(term.clone(), event_proxy, pty, false, false)?;
        let notifier = Notifier(event_loop.channel());
        let pty_notifier = Notifier(event_loop.channel());

        let pty_thread = event_loop.spawn();

        let terminal_id = id.clone();
        let event_thread = std::thread::Builder::new()
            .name(format!("terminal-events-{}", &terminal_id))
            .spawn(move || {
                Self::event_subscription_loop(event_rx, pty_notifier, app_handle, terminal_id);
            })?;

        Ok(Self {
            id,
            term,
            notifier,
            pty_thread: Some(pty_thread),
            event_thread: Some(event_thread),
        })
    }

    fn event_subscription_loop(
        event_rx: mpsc::Receiver<Event>,
        pty_notifier: Notifier,
        app_handle: AppHandle,
        terminal_id: String,
    ) {
        loop {
            let event = match event_rx.recv() {
                Ok(e) => e,
                Err(_) => {
                    log::warn!("Terminal {terminal_id}: event channel disconnected");
                    if let Err(e) = app_handle.emit("terminal-exit", &terminal_id) {
                        log::warn!(
                            "Terminal {terminal_id}: failed to emit exit on disconnect: {e}"
                        );
                    }
                    break;
                }
            };

            match &event {
                Event::Exit | Event::ChildExit(_) => {
                    if let Err(e) = app_handle.emit("terminal-exit", &terminal_id) {
                        log::warn!("Terminal {terminal_id}: failed to emit exit: {e}");
                    }
                    break;
                }
                Event::PtyWrite(text) => {
                    pty_notifier.notify(text.clone().into_bytes());
                }
                Event::Wakeup => {
                    if let Err(e) = app_handle.emit("terminal-output", &terminal_id) {
                        log::warn!("Terminal {terminal_id}: failed to emit output: {e}");
                    }
                }
                other => {
                    log::trace!("Terminal {terminal_id}: unhandled event: {other:?}");
                }
            }
        }
    }

    /// Write input bytes to the PTY (keystrokes from frontend).
    pub fn write(&self, data: &[u8]) {
        self.notifier.notify(data.to_vec());
    }

    /// Resize the terminal grid and PTY.
    pub fn resize(&mut self, cols: u16, rows: u16) {
        if cols == 0 || rows == 0 {
            return;
        }

        let window_size = WindowSize {
            num_lines: rows,
            num_cols: cols,
            cell_width: CELL_WIDTH,
            cell_height: CELL_HEIGHT,
        };
        self.notifier.on_resize(window_size);

        let mut term = self.term.lock();
        term.resize(TermSize::new(cols as usize, rows as usize));
    }

    /// Snapshot the visible grid for the frontend.
    pub fn get_state(&self) -> CellGrid {
        let term = self.term.lock();
        extract_grid(&term)
    }
}

impl Drop for TerminalInstance {
    fn drop(&mut self) {
        if let Err(e) = self.notifier.0.send(Msg::Shutdown) {
            log::warn!("Terminal {}: failed to send shutdown: {e}", self.id);
        }
        if let Some(handle) = self.pty_thread.take() {
            let _ = handle.join();
        }
        if let Some(handle) = self.event_thread.take() {
            let _ = handle.join();
        }
    }
}
