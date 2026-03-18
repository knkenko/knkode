use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex, MutexGuard};
use tattoy_termwiz::surface::CursorVisibility;
use tattoy_wezterm_term::color::ColorPalette;
use tattoy_wezterm_term::config::TerminalConfiguration;
use tattoy_wezterm_term::{Intensity, Terminal, TerminalSize, Underline};

const DEFAULT_DPI: u32 = 96;
pub const DEFAULT_COLS: usize = 80;
pub const DEFAULT_ROWS: usize = 24;

/// Minimal config for wezterm-term. The `TerminalConfiguration` trait has 15+
/// methods with sensible defaults (scrollback sizing, unicode version, etc.) —
/// we only override `color_palette()`. The palette returned here must match
/// `TerminalState::palette` used in `snapshot()`.
#[derive(Debug)]
struct TermConfig;

impl tattoy_wezterm_term::config::TerminalConfiguration for TermConfig {
    fn color_palette(&self) -> ColorPalette {
        ColorPalette::default()
    }
}

fn term_size(cols: usize, rows: usize) -> TerminalSize {
    TerminalSize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
        dpi: DEFAULT_DPI,
    }
}

#[derive(Serialize, Clone)]
pub struct CellSnapshot {
    pub text: String,
    pub fg: String,
    pub bg: String,
    pub bold: bool,
    pub italic: bool,
    pub underline: bool,
    pub strikethrough: bool,
}

#[derive(Serialize, Clone)]
pub struct GridSnapshot {
    pub rows: Vec<Vec<CellSnapshot>>,
    pub cursor_row: usize,
    pub cursor_col: usize,
    pub cursor_visible: bool,
    pub cols: usize,
    pub total_rows: usize,
    // TODO: populate from screen scrollback when scrollback support is added
    pub scrollback_rows: usize,
}

/// Manages one `wezterm-term::Terminal` per PTY session. Each terminal
/// processes raw PTY bytes through `advance_bytes()` and produces
/// `GridSnapshot`s for the frontend canvas renderer.
pub struct TerminalState {
    terminals: Mutex<HashMap<String, Terminal>>,
    palette: ColorPalette,
    config: Arc<dyn TerminalConfiguration + Send + Sync>,
}

impl TerminalState {
    pub fn new() -> Self {
        Self {
            terminals: Mutex::new(HashMap::new()),
            palette: ColorPalette::default(),
            config: Arc::new(TermConfig),
        }
    }

    pub fn create(&self, id: &str, cols: usize, rows: usize) {
        // NOTE: Terminal writer is sink() — shell DSR responses (e.g. cursor position
        // reports via \e[6n) are discarded. Known limitation for Phase 5a.
        let terminal = Terminal::new(
            term_size(cols, rows),
            Arc::clone(&self.config),
            "knkode",
            env!("CARGO_PKG_VERSION"),
            Box::new(std::io::sink()),
        );
        match self.lock_terminals() {
            Ok(mut terminals) => {
                terminals.insert(id.to_string(), terminal);
            }
            Err(e) => eprintln!("[terminal] create failed for {id}: {e}"),
        }
    }

    /// Feed raw PTY output through the terminal state machine and return
    /// a snapshot of the visible grid for the frontend to render.
    pub fn advance_bytes(&self, id: &str, data: &[u8]) -> Option<GridSnapshot> {
        let mut terminals = match self.lock_terminals() {
            Ok(t) => t,
            Err(e) => {
                eprintln!("[terminal] advance_bytes lock failed for {id}: {e}");
                return None;
            }
        };
        let terminal = match terminals.get_mut(id) {
            Some(t) => t,
            None => {
                eprintln!("[terminal] advance_bytes called for unknown session {id}");
                return None;
            }
        };
        terminal.advance_bytes(data);
        Some(self.snapshot(terminal))
    }

    pub fn resize(&self, id: &str, cols: usize, rows: usize) {
        match self.lock_terminals() {
            Ok(mut terminals) => {
                if let Some(terminal) = terminals.get_mut(id) {
                    terminal.resize(term_size(cols, rows));
                } else {
                    eprintln!("[terminal] resize called for unknown session {id}");
                }
            }
            Err(e) => eprintln!("[terminal] resize lock failed for {id}: {e}"),
        }
    }

    pub fn remove(&self, id: &str) {
        match self.lock_terminals() {
            Ok(mut terminals) => {
                terminals.remove(id);
            }
            Err(e) => eprintln!("[terminal] remove lock failed for {id}: {e}"),
        }
    }

    pub fn remove_all(&self) {
        match self.lock_terminals() {
            Ok(mut terminals) => {
                terminals.clear();
            }
            Err(e) => eprintln!("[terminal] remove_all lock failed: {e}"),
        }
    }

    fn snapshot(&self, terminal: &Terminal) -> GridSnapshot {
        let screen = terminal.screen();
        let phys_rows = screen.physical_rows;
        let phys_cols = screen.physical_cols;

        let visible_range = 0..(phys_rows as i64);
        let phys_range = screen.phys_range(&visible_range);
        let lines = screen.lines_in_phys_range(phys_range);

        let mut rows = Vec::with_capacity(phys_rows);
        for line in &lines {
            let mut cells = Vec::with_capacity(phys_cols);
            for cell_ref in line.visible_cells() {
                let attrs = cell_ref.attrs();
                let reverse = attrs.reverse();

                let fg_attr = attrs.foreground();
                let bg_attr = attrs.background();
                let (fg, bg) = if reverse {
                    (
                        self.palette.resolve_bg(bg_attr).to_rgb_string(),
                        self.palette.resolve_fg(fg_attr).to_rgb_string(),
                    )
                } else {
                    (
                        self.palette.resolve_fg(fg_attr).to_rgb_string(),
                        self.palette.resolve_bg(bg_attr).to_rgb_string(),
                    )
                };

                cells.push(CellSnapshot {
                    text: cell_ref.str().to_string(),
                    fg,
                    bg,
                    bold: matches!(attrs.intensity(), Intensity::Bold),
                    italic: attrs.italic(),
                    underline: !matches!(attrs.underline(), Underline::None),
                    strikethrough: attrs.strikethrough(),
                });
            }
            rows.push(cells);
        }

        let cursor = terminal.cursor_pos();
        GridSnapshot {
            rows,
            cursor_row: cursor.y.try_into().unwrap_or(0),
            cursor_col: cursor.x,
            cursor_visible: cursor.visibility == CursorVisibility::Visible,
            cols: phys_cols,
            total_rows: phys_rows,
            scrollback_rows: 0,
        }
    }

    fn lock_terminals(&self) -> Result<MutexGuard<'_, HashMap<String, Terminal>>, String> {
        self.terminals
            .lock()
            .map_err(|e| format!("Terminal lock poisoned: {e}"))
    }
}
