use serde::Serialize;
use std::collections::HashMap;
use std::sync::{Arc, Mutex, MutexGuard};
use tattoy_wezterm_term::color::ColorPalette;
use tattoy_wezterm_term::{Terminal, TerminalSize};

const DEFAULT_DPI: u32 = 96;

/// Minimal config — color palette is authoritative from the frontend theme,
/// so we use defaults here. wezterm-term only needs this for palette index
/// resolution and scrollback sizing.
#[derive(Debug)]
struct TermConfig;

impl tattoy_wezterm_term::config::TerminalConfiguration for TermConfig {
    fn color_palette(&self) -> ColorPalette {
        ColorPalette::default()
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
    pub scrollback_rows: usize,
}

/// Manages one `wezterm-term::Terminal` per PTY session. Each terminal
/// processes raw PTY bytes through `advance_bytes()` and produces
/// `GridSnapshot`s for the frontend canvas renderer.
pub struct TerminalState {
    terminals: Mutex<HashMap<String, Terminal>>,
    palette: ColorPalette,
}

impl TerminalState {
    pub fn new() -> Self {
        Self {
            terminals: Mutex::new(HashMap::new()),
            palette: ColorPalette::default(),
        }
    }

    pub fn create(&self, id: &str, cols: usize, rows: usize) {
        let size = TerminalSize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
            dpi: DEFAULT_DPI,
        };
        let config = Arc::new(TermConfig);
        let terminal = Terminal::new(size, config, "knkode", "0.1.0", Box::new(std::io::sink()));
        self.terminals
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .insert(id.to_string(), terminal);
    }

    /// Feed raw PTY output through the terminal state machine and return
    /// a snapshot of the visible grid for the frontend to render.
    pub fn advance_bytes(&self, id: &str, data: &[u8]) -> Option<GridSnapshot> {
        let mut terminals = self.lock_terminals().ok()?;
        let terminal = terminals.get_mut(id)?;
        terminal.advance_bytes(data);
        Some(self.snapshot(terminal))
    }

    pub fn resize(&self, id: &str, cols: usize, rows: usize) {
        if let Ok(mut terminals) = self.lock_terminals() {
            if let Some(terminal) = terminals.get_mut(id) {
                terminal.resize(TerminalSize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                    dpi: DEFAULT_DPI,
                });
            }
        }
    }

    pub fn remove(&self, id: &str) {
        if let Ok(mut terminals) = self.lock_terminals() {
            terminals.remove(id);
        }
    }

    pub fn remove_all(&self) {
        if let Ok(mut terminals) = self.lock_terminals() {
            terminals.clear();
        }
    }

    fn snapshot(&self, terminal: &Terminal) -> GridSnapshot {
        let screen = terminal.screen();
        let phys_rows = screen.physical_rows;
        let phys_cols = screen.physical_cols;

        // Get visible lines only (not scrollback)
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
                    bold: matches!(attrs.intensity(), tattoy_wezterm_term::Intensity::Bold),
                    italic: attrs.italic(),
                    underline: !matches!(attrs.underline(), tattoy_wezterm_term::Underline::None),
                    strikethrough: attrs.strikethrough(),
                });
            }
            rows.push(cells);
        }

        let cursor = terminal.cursor_pos();
        GridSnapshot {
            rows,
            cursor_row: cursor.y as usize,
            cursor_col: cursor.x,
            cursor_visible: cursor.visibility == tattoy_termwiz::surface::CursorVisibility::Visible,
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
