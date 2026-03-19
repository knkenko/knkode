use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::{Arc, Mutex, MutexGuard};
use tattoy_termwiz::surface::CursorVisibility;
use tattoy_wezterm_term::color::{ColorPalette, RgbColor};
use tattoy_wezterm_term::config::TerminalConfiguration;
use tattoy_wezterm_term::{Intensity, Terminal, TerminalSize, Underline};

const DEFAULT_DPI: u32 = 96;
pub const DEFAULT_COLS: usize = 80;
pub const DEFAULT_ROWS: usize = 24;

/// Minimal config for wezterm-term. The `TerminalConfiguration` trait has 15+
/// methods with sensible defaults (scrollback sizing, unicode version, etc.).
/// Per-pane color palettes are applied separately at snapshot time — see `set_colors`.
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
#[serde(rename_all = "camelCase")]
pub struct GridSnapshot {
    pub rows: Vec<Vec<CellSnapshot>>,
    pub cursor_row: usize,
    pub cursor_col: usize,
    pub cursor_visible: bool,
    pub cols: usize,
    pub total_rows: usize,
    // TODO: populate from screen scrollback when scrollback support is added
    pub scrollback_rows: usize,
    /// The terminal palette's default background color (hex string, e.g. "#000000").
    /// The frontend uses this to distinguish "no custom background" cells from cells
    /// with an explicit colored background — only the latter get drawn, leaving
    /// default-bg cells transparent so PaneBackgroundEffects show through.
    pub default_bg: String,
}

/// ANSI 16-color palette sent from the frontend theme system.
/// All values are hex strings (`#RRGGBB`).
/// Mirrors `AnsiColors` in `src/shared/types.ts` and
/// `ANSI_KEYS` in `config.rs`. Keep all three in sync.
#[derive(Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct AnsiThemeColors {
    pub black: String,
    pub red: String,
    pub green: String,
    pub yellow: String,
    pub blue: String,
    pub magenta: String,
    pub cyan: String,
    pub white: String,
    pub bright_black: String,
    pub bright_red: String,
    pub bright_green: String,
    pub bright_yellow: String,
    pub bright_blue: String,
    pub bright_magenta: String,
    pub bright_cyan: String,
    pub bright_white: String,
}

/// Parse a hex color string into an RgbColor.
/// Accepts `#RRGGBB`, `RRGGBB`, `#RGB`, or `RGB` formats.
/// The 3-char form is expanded (e.g. `#F0A` → `#FF00AA`).
fn parse_hex_color(hex: &str) -> Option<RgbColor> {
    let hex = hex.strip_prefix('#').unwrap_or(hex);
    // ASCII check makes byte-offset slicing safe on UTF-8 strings.
    if !hex.bytes().all(|b| b.is_ascii_hexdigit()) {
        return None;
    }
    match hex.len() {
        3 => {
            // Expand #RGB → #RRGGBB
            let r = u8::from_str_radix(&hex[0..1].repeat(2), 16).ok()?;
            let g = u8::from_str_radix(&hex[1..2].repeat(2), 16).ok()?;
            let b = u8::from_str_radix(&hex[2..3].repeat(2), 16).ok()?;
            Some(RgbColor::new_8bpc(r, g, b))
        }
        6 => {
            let r = u8::from_str_radix(&hex[0..2], 16).ok()?;
            let g = u8::from_str_radix(&hex[2..4], 16).ok()?;
            let b = u8::from_str_radix(&hex[4..6], 16).ok()?;
            Some(RgbColor::new_8bpc(r, g, b))
        }
        _ => None,
    }
}

/// Build a ColorPalette from theme colors. Starts from the default palette
/// (preserving the 216 color cube and 24-step greyscale ramp at indices 16–255),
/// then overrides indices 0–15 with the theme's ANSI colors and sets
/// the default foreground/background.
fn build_palette(ansi: &AnsiThemeColors, foreground: &str, background: &str) -> ColorPalette {
    let mut palette = ColorPalette::default();

    // Order must match ANSI color indices 0–15.
    let ansi_colors: [&str; 16] = [
        &ansi.black,
        &ansi.red,
        &ansi.green,
        &ansi.yellow,
        &ansi.blue,
        &ansi.magenta,
        &ansi.cyan,
        &ansi.white,
        &ansi.bright_black,
        &ansi.bright_red,
        &ansi.bright_green,
        &ansi.bright_yellow,
        &ansi.bright_blue,
        &ansi.bright_magenta,
        &ansi.bright_cyan,
        &ansi.bright_white,
    ];

    for (i, hex) in ansi_colors.iter().enumerate() {
        if let Some(rgb) = parse_hex_color(hex) {
            palette.colors.0[i] = rgb.into();
        } else {
            eprintln!("[terminal] Invalid hex for ANSI color index {i}: {hex:?}");
        }
    }

    if let Some(rgb) = parse_hex_color(foreground) {
        palette.foreground = rgb.into();
    } else {
        eprintln!("[terminal] Invalid hex for foreground: {foreground:?}");
    }
    if let Some(rgb) = parse_hex_color(background) {
        palette.background = rgb.into();
    } else {
        eprintln!("[terminal] Invalid hex for background: {background:?}");
    }

    palette
}

/// Manages one `wezterm-term::Terminal` per PTY session. Each terminal
/// processes raw PTY bytes through `advance_bytes()` and produces
/// `GridSnapshot`s for the frontend canvas renderer.
///
/// Each terminal has its own `ColorPalette` so themes are applied per-pane.
pub struct TerminalState {
    terminals: Mutex<HashMap<String, Terminal>>,
    /// Per-pane palettes for ANSI color resolution. Stored separately from
    /// terminals so palettes survive PTY restart (remove → create cycle).
    /// Cleaned up in `remove_all()` on app shutdown.
    palettes: Mutex<HashMap<String, Arc<ColorPalette>>>,
    default_palette: Arc<ColorPalette>,
    config: Arc<dyn TerminalConfiguration + Send + Sync>,
}

impl TerminalState {
    pub fn new() -> Self {
        Self {
            terminals: Mutex::new(HashMap::new()),
            palettes: Mutex::new(HashMap::new()),
            default_palette: Arc::new(ColorPalette::default()),
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

    /// Set the color palette for a specific terminal session.
    /// Called from the frontend when a pane's theme includes ANSI colors.
    pub fn set_colors(
        &self,
        id: &str,
        ansi: &AnsiThemeColors,
        foreground: &str,
        background: &str,
    ) -> Result<(), String> {
        let palette = Arc::new(build_palette(ansi, foreground, background));
        let mut palettes = self.lock_palettes()?;
        palettes.insert(id.to_string(), palette);
        Ok(())
    }

    /// Feed raw PTY output through the terminal state machine and return
    /// a snapshot of the visible grid for the frontend to render.
    ///
    /// Lock ordering: acquires `terminals` then `palettes` (via `get_palette`).
    /// All code paths must follow this order to prevent deadlocks.
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

        let palette = self.get_palette(id);
        Some(Self::snapshot_with_palette(terminal, &palette))
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
        // Palette intentionally NOT removed — survives pane restart.
        // Cleaned up in remove_all() on app shutdown.
    }

    pub fn remove_all(&self) {
        match self.lock_terminals() {
            Ok(mut terminals) => {
                terminals.clear();
            }
            Err(e) => eprintln!("[terminal] remove_all lock failed: {e}"),
        }
        match self.lock_palettes() {
            Ok(mut palettes) => {
                palettes.clear();
            }
            Err(e) => eprintln!("[terminal] remove_all palettes lock failed: {e}"),
        }
    }

    /// Get the palette for a terminal, falling back to the default.
    /// Returns a cheap `Arc` clone instead of copying the full ~4 KB palette.
    fn get_palette(&self, id: &str) -> Arc<ColorPalette> {
        match self.palettes.lock() {
            Ok(p) => p
                .get(id)
                .cloned()
                .unwrap_or_else(|| Arc::clone(&self.default_palette)),
            Err(e) => {
                eprintln!("[terminal] palettes lock poisoned for {id}: {e}");
                Arc::clone(&self.default_palette)
            }
        }
    }

    fn snapshot_with_palette(terminal: &Terminal, palette: &ColorPalette) -> GridSnapshot {
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
                        palette.resolve_bg(bg_attr).to_rgb_string(),
                        palette.resolve_fg(fg_attr).to_rgb_string(),
                    )
                } else {
                    (
                        palette.resolve_fg(fg_attr).to_rgb_string(),
                        palette.resolve_bg(bg_attr).to_rgb_string(),
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
            default_bg: palette.background.to_rgb_string(),
        }
    }

    fn lock_terminals(&self) -> Result<MutexGuard<'_, HashMap<String, Terminal>>, String> {
        self.terminals
            .lock()
            .map_err(|e| format!("Terminal lock poisoned: {e}"))
    }

    fn lock_palettes(&self) -> Result<MutexGuard<'_, HashMap<String, Arc<ColorPalette>>>, String> {
        self.palettes
            .lock()
            .map_err(|e| format!("Palettes lock poisoned: {e}"))
    }
}
