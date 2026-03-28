use base64::prelude::*;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::LazyLock;
use std::sync::{Arc, Mutex, MutexGuard};
use tattoy_termwiz::surface::{CursorShape, CursorVisibility};
use tattoy_wezterm_term::color::{ColorAttribute, ColorPalette, RgbColor};
use tattoy_wezterm_term::config::TerminalConfiguration;
use tattoy_wezterm_term::image::ImageDataType;
use tattoy_wezterm_term::{Intensity, Terminal, TerminalSize, Underline};

const DEFAULT_DPI: u32 = 96;
pub const DEFAULT_COLS: usize = 80;
pub const DEFAULT_ROWS: usize = 24;

/// Estimated cell pixel dimensions for initial PTY creation (before the first
/// frontend resize sends real measurements). wezterm-term divides pixel_width by
/// cols to get cell_pixel_width — a zero value causes division-by-zero when
/// placing images. These defaults are overwritten on the first resize event.
pub const DEFAULT_CELL_PIXEL_WIDTH: usize = 8;
pub const DEFAULT_CELL_PIXEL_HEIGHT: usize = 16;

/// Maximum image payload size in bytes (width * height * 4 for RGBA, raw bytes for EncodedFile).
/// Prevents DoS from malicious escape sequences with enormous images.
const MAX_IMAGE_BYTES: u64 = 50 * 1024 * 1024; // 50 MB

/// Maximum number of unique images per snapshot frame. Prevents unbounded
/// IPC payload growth from a malicious program emitting thousands of images.
const MAX_IMAGES_PER_FRAME: usize = 64;

/// Maximum terminal title length in characters. Prevents IPC bloat from
/// malicious OSC sequences setting multi-megabyte titles.
const MAX_TITLE_LEN: usize = 4096;

/// Minimal config for wezterm-term. The `TerminalConfiguration` trait has 15+
/// methods with sensible defaults (scrollback sizing, unicode version, etc.).
/// Per-pane color palettes are applied separately at snapshot time — see `set_colors`.
#[derive(Debug)]
struct TermConfig;

impl tattoy_wezterm_term::config::TerminalConfiguration for TermConfig {
    fn color_palette(&self) -> ColorPalette {
        ColorPalette::default()
    }

    fn enable_kitty_graphics(&self) -> bool {
        true
    }
}

fn term_size(cols: usize, rows: usize, pixel_width: usize, pixel_height: usize) -> TerminalSize {
    TerminalSize {
        rows,
        cols,
        pixel_width,
        pixel_height,
        dpi: DEFAULT_DPI,
    }
}

/// A reference to an image slice within a terminal cell. Each cell that participates
/// in an image has one or more of these, with texture coordinates defining which
/// portion of the full image to render.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageCellSnapshot {
    /// Hex-encoded SHA256 hash of the image data — used as cache key.
    pub hash: String,
    /// Texture UV coordinates defining the slice of the full image for this cell.
    /// Range [0.0, 1.0] where (0,0) = top-left, (1,1) = bottom-right.
    pub top_left_x: f32,
    pub top_left_y: f32,
    pub bottom_right_x: f32,
    pub bottom_right_y: f32,
    /// Negative z_index renders behind text; zero or positive renders on top.
    pub z_index: i32,
}

/// Full image data sent once per unique image. Subsequent frames reference by hash only.
#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ImageSnapshot {
    /// Base64-encoded image data. For raw RGBA sources, re-encoded as PNG.
    /// For pre-encoded sources (iTerm/Kitty), the original format is preserved.
    pub data: String,
    /// Image dimensions in pixels.
    pub width: u32,
    pub height: u32,
}

#[derive(Serialize, Clone)]
pub struct CellSnapshot {
    pub text: String,
    pub fg: String,
    pub bg: String,
    pub bold: bool,
    pub dim: bool,
    pub italic: bool,
    pub underline: bool,
    pub strikethrough: bool,
    pub hidden: bool,
    pub overline: bool,
    /// Image slices attached to this cell (omitted when empty).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub images: Option<Vec<ImageCellSnapshot>>,
    /// URL if this cell is part of a clickable hyperlink (omitted when None).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub link: Option<String>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct GridSnapshot {
    pub rows: Vec<Vec<CellSnapshot>>,
    pub cursor_row: usize,
    pub cursor_col: usize,
    pub cursor_visible: bool,
    /// Cursor shape: "block", "underline", "bar", or "default" (let frontend decide).
    /// Set by TUI apps via DECSCUSR escape sequence.
    pub cursor_shape: &'static str,
    /// Whether the terminal requests cursor blinking (from DECSCUSR).
    pub cursor_blink: bool,
    pub cols: usize,
    pub total_rows: usize,
    /// Number of rows available above the visible viewport (scrollback depth).
    pub scrollback_rows: usize,
    /// Current scroll position: 0 = at bottom (live), >0 = scrolled up N rows.
    pub scroll_offset: usize,
    /// The terminal palette's default background color (hex string, e.g. "#000000").
    /// The frontend uses this to distinguish "no custom background" cells from cells
    /// with an explicit colored background — only the latter get drawn, leaving
    /// default-bg cells transparent so PaneBackgroundEffects show through.
    pub default_bg: String,
    /// Unique images visible in the current viewport, keyed by hex SHA256 hash.
    /// Only includes images not previously sent (tracked per-session).
    /// Frontend caches decoded ImageBitmaps by hash.
    #[serde(skip_serializing_if = "HashMap::is_empty")]
    pub images: HashMap<String, ImageSnapshot>,
    /// Whether the terminal is currently showing the alternate screen buffer
    /// (used by TUI apps like vim, htop, less, tmux).
    pub is_alt_screen: bool,
    /// Whether the running program has enabled mouse reporting (any tracking
    /// mode). When true, the frontend should forward mouse events as escape
    /// sequences instead of handling them for selection/scrollback.
    pub is_mouse_grabbed: bool,
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

/// Cell range for text extraction via IPC. Mirrors `SelectionRange` in
/// `src/shared/types.ts`. All indices are inclusive.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SelectionRange {
    pub start_row: usize,
    pub start_col: usize,
    pub end_row: usize,
    pub end_col: usize,
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
///
/// Lock ordering: `terminals` → `palettes` → `sent_image_hashes` → `last_titles`.
/// Never acquire these locks in a different order to prevent deadlocks.
pub struct TerminalState {
    terminals: Mutex<HashMap<String, Terminal>>,
    /// Per-pane palettes for ANSI color resolution. Stored separately from
    /// terminals so palettes survive PTY restart (remove → create cycle).
    /// Cleaned up in `remove_all()` on app shutdown.
    palettes: Mutex<HashMap<String, Arc<ColorPalette>>>,
    /// Per-session set of image hashes already sent to the frontend.
    /// Prevents re-sending the same image data on every snapshot frame.
    sent_image_hashes: Mutex<HashMap<String, HashSet<[u8; 32]>>>,
    /// Last-seen terminal title per pane (OSC 1/2). Used to detect title
    /// changes between snapshot cycles.
    last_titles: Mutex<HashMap<String, String>>,
    default_palette: Arc<ColorPalette>,
    config: Arc<dyn TerminalConfiguration + Send + Sync>,
}

/// Encode a [u8; 32] hash as a lowercase hex string.
fn hex_encode(bytes: &[u8; 32]) -> String {
    bytes.iter().fold(String::with_capacity(64), |mut s, b| {
        use std::fmt::Write;
        write!(s, "{b:02x}").unwrap();
        s
    })
}

/// Encode raw RGBA8 pixel data as a PNG, returning a base64 string.
/// Uses `PngEncoder` directly to avoid copying the pixel buffer.
fn encode_rgba_as_png(rgba: &[u8], width: u32, height: u32) -> Option<String> {
    use image::ImageEncoder;
    // Size limit: reject images that exceed MAX_IMAGE_BYTES
    let pixel_bytes = (width as u64) * (height as u64) * 4;
    if pixel_bytes > MAX_IMAGE_BYTES {
        eprintln!(
            "[terminal] image too large: {width}x{height} = {pixel_bytes} bytes (max {MAX_IMAGE_BYTES})"
        );
        return None;
    }
    let expected = (width as usize) * (height as usize) * 4;
    if rgba.len() != expected {
        eprintln!(
            "[terminal] RGBA buffer size mismatch: expected {expected}, got {}",
            rgba.len()
        );
        return None;
    }
    let mut buf = Vec::new();
    let encoder = image::codecs::png::PngEncoder::new(&mut buf);
    if let Err(e) = encoder.write_image(rgba, width, height, image::ExtendedColorType::Rgba8) {
        eprintln!("[terminal] PNG encoding failed for {width}x{height} image: {e}");
        return None;
    }
    Some(BASE64_STANDARD.encode(&buf))
}

/// Compiled URL regex — matches http(s) URLs and localhost/127.0.0.1 with ports.
static URL_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r#"(?:https?://[^\s<>"{}|\\^`\[\]]+|(?:localhost|127\.0\.0\.1):\d+[^\s<>"{}|\\^`\[\]]*)"#,
    )
    .expect("URL regex must compile")
});

/// Characters that are valid URL chars but likely sentence punctuation when trailing.
/// Strip them from the end of a match unless they have a matching opener in the URL.
fn clean_url_tail(url: &str) -> &str {
    let mut end = url.len();
    let bytes = url.as_bytes();
    while end > 0 {
        match bytes[end - 1] {
            b')' if !url[..end].contains('(') => end -= 1,
            b']' if !url[..end].contains('[') => end -= 1,
            b'.' | b',' | b';' | b':' | b'!' | b'?' => end -= 1,
            _ => break,
        }
    }
    &url[..end]
}

/// Detect URLs in a row's concatenated text and annotate matching cells.
/// Each cell in a URL range gets `link` set to the full URL string.
/// `cell_byte_starts[i]` is the byte offset in `row_text` where cell `i` starts.
fn annotate_row_links(cells: &mut [CellSnapshot]) {
    // Build the row text and track byte offset → cell index mapping.
    let mut row_text = String::with_capacity(cells.len());
    let mut cell_byte_starts: Vec<usize> = Vec::with_capacity(cells.len());
    for cell in cells.iter() {
        cell_byte_starts.push(row_text.len());
        row_text.push_str(&cell.text);
    }

    for m in URL_REGEX.find_iter(&row_text) {
        let url = clean_url_tail(m.as_str());
        if url.is_empty() {
            continue;
        }
        let match_start = m.start();
        let match_end = match_start + url.len();
        // Prepend http:// to scheme-less matches (localhost:PORT, 127.0.0.1:PORT)
        // so the frontend's isAllowedUrl check doesn't silently reject them.
        let url_string = if url.starts_with("http://") || url.starts_with("https://") {
            url.to_string()
        } else {
            format!("http://{url}")
        };

        // Find which cells fall within this URL byte range
        for (i, &byte_start) in cell_byte_starts.iter().enumerate() {
            let cell_end = byte_start + cells[i].text.len();
            // Cell overlaps the URL range if it starts before match_end and ends after match_start.
            // Skip cells that already have an OSC 8 hyperlink — explicit links take priority.
            if byte_start < match_end && cell_end > match_start && cells[i].link.is_none() {
                cells[i].link = Some(url_string.clone());
            }
        }
    }
}

impl TerminalState {
    pub fn new() -> Self {
        Self {
            terminals: Mutex::new(HashMap::new()),
            palettes: Mutex::new(HashMap::new()),
            sent_image_hashes: Mutex::new(HashMap::new()),
            last_titles: Mutex::new(HashMap::new()),
            default_palette: Arc::new(ColorPalette::default()),
            config: Arc::new(TermConfig),
        }
    }

    pub fn create(
        &self,
        id: &str,
        cols: usize,
        rows: usize,
        pixel_width: usize,
        pixel_height: usize,
    ) {
        // NOTE: Terminal writer is sink() — shell DSR responses (e.g. cursor position
        // reports via \e[6n) are discarded. Apps relying on DSR won't get replies.
        let terminal = Terminal::new(
            term_size(cols, rows, pixel_width, pixel_height),
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

    /// Advance the terminal state machine with raw PTY output, without
    /// taking a snapshot. Used by the throttled PTY reader loop to process
    /// data as fast as possible, deferring the expensive snapshot+emit step.
    pub fn advance_only(&self, id: &str, data: &[u8]) {
        let mut terminals = match self.lock_terminals() {
            Ok(t) => t,
            Err(e) => {
                eprintln!("[terminal] advance_only lock failed for {id}: {e}");
                return;
            }
        };
        let terminal = match terminals.get_mut(id) {
            Some(t) => t,
            None => {
                eprintln!("[terminal] advance_only called for unknown session {id}");
                return;
            }
        };
        terminal.advance_bytes(data);
    }

    /// Take a snapshot and check for terminal title changes in a single lock
    /// acquisition. Returns `(GridSnapshot, Option<title>)` where the title
    /// is `Some` when it differs from the previously observed value (or on
    /// first observation for a new pane).
    ///
    /// Lock ordering: terminals → palettes → sent_image_hashes → last_titles.
    pub fn snapshot_and_title(&self, id: &str) -> Option<(GridSnapshot, Option<String>)> {
        self.snapshot_and_title_at_offset(id, 0)
    }

    /// Take a snapshot at a given scroll offset (rows from bottom).
    /// `scroll_offset = 0` → live viewport; `scroll_offset = N` → N rows into scrollback.
    ///
    /// Lock ordering: terminals → palettes → sent_image_hashes.
    /// All code paths must follow this order to prevent deadlocks.
    pub fn snapshot_at_offset(&self, id: &str, scroll_offset: usize) -> Option<GridSnapshot> {
        let terminals = match self.lock_terminals() {
            Ok(t) => t,
            Err(e) => {
                eprintln!("[terminal] snapshot lock failed for {id}: {e}");
                return None;
            }
        };
        let terminal = match terminals.get(id) {
            Some(t) => t,
            None => return None,
        };
        let palette = self.get_palette(id);
        let mut sent_hashes = match self.lock_sent_hashes() {
            Ok(h) => h,
            Err(e) => {
                eprintln!("[terminal] snapshot sent_hashes lock failed for {id}: {e}");
                return None;
            }
        };
        let session_hashes = sent_hashes.entry(id.to_string()).or_default();
        Some(Self::snapshot_with_palette(
            terminal,
            &palette,
            scroll_offset,
            session_hashes,
        ))
    }

    /// Like `snapshot_at_offset` but also reads the terminal title under the
    /// same `terminals` lock, avoiding a second lock acquisition on the hot path.
    ///
    /// Lock ordering: terminals → palettes → sent_image_hashes → last_titles.
    fn snapshot_and_title_at_offset(
        &self,
        id: &str,
        scroll_offset: usize,
    ) -> Option<(GridSnapshot, Option<String>)> {
        let terminals = match self.lock_terminals() {
            Ok(t) => t,
            Err(e) => {
                eprintln!("[terminal] snapshot lock failed for {id}: {e}");
                return None;
            }
        };
        let terminal = match terminals.get(id) {
            Some(t) => t,
            None => return None,
        };
        // Read title while terminals lock is held — avoids a second lock acquisition.
        // detect_title_change only allocates when the title actually changed.
        let title_changed = self.detect_title_change(id, terminal.get_title());
        let palette = self.get_palette(id);
        let mut sent_hashes = match self.lock_sent_hashes() {
            Ok(h) => h,
            Err(e) => {
                eprintln!("[terminal] snapshot sent_hashes lock failed for {id}: {e}");
                return None;
            }
        };
        let session_hashes = sent_hashes.entry(id.to_string()).or_default();
        let grid = Self::snapshot_with_palette(terminal, &palette, scroll_offset, session_hashes);
        Some((grid, title_changed))
    }

    /// Extract text from a cell range. Row indices are absolute physical rows
    /// in the scrollback buffer (row 0 = oldest line in buffer). All indices
    /// are inclusive: (start_row, start_col) through (end_row, end_col) are
    /// included in the result. Column indices follow `visible_cells()` ordering
    /// (wide-character continuation cells are skipped).
    /// Handles coordinate normalization (start/end swap), row/column clamping,
    /// trailing whitespace trimming, and joining rows with newlines.
    pub fn extract_text(&self, id: &str, range: &SelectionRange) -> Result<String, String> {
        let terminals = self
            .lock_terminals()
            .map_err(|e| format!("extract_text lock failed for {id}: {e}"))?;
        let terminal = terminals
            .get(id)
            .ok_or_else(|| format!("Terminal session not found: {id}"))?;

        let screen = terminal.screen();

        // scrollback_rows() returns total lines in buffer (visible + scrollback)
        let total_lines = screen.scrollback_rows();
        if total_lines == 0 {
            return Ok(String::new());
        }

        // Normalize: ensure start <= end
        let (sr, sc, er, ec) = if range.start_row < range.end_row
            || (range.start_row == range.end_row && range.start_col <= range.end_col)
        {
            (
                range.start_row,
                range.start_col,
                range.end_row,
                range.end_col,
            )
        } else {
            (
                range.end_row,
                range.end_col,
                range.start_row,
                range.start_col,
            )
        };

        // Clamp row indices to buffer bounds (column clamping happens per-line below)
        let er = er.min(total_lines - 1);
        let sr = sr.min(er);

        let lines = screen.lines_in_phys_range(sr..er + 1);
        let num_lines = lines.len();
        if num_lines == 0 {
            return Ok(String::new());
        }

        let num_cols = screen.physical_cols;
        let last = num_lines - 1;
        let mut result = String::with_capacity(num_lines * num_cols);

        for (i, line) in lines.iter().enumerate() {
            let col_start = if i == 0 { sc.min(num_cols) } else { 0 };
            let col_end = if i == last {
                ec.saturating_add(1).min(num_cols)
            } else {
                num_cols
            };

            let take_count = col_end.saturating_sub(col_start);
            let mut line_text = String::with_capacity(take_count);
            for cell in line.visible_cells().skip(col_start).take(take_count) {
                line_text.push_str(cell.str());
            }

            // Trim trailing whitespace per line (empty cells are spaces)
            result.push_str(line_text.trim_end());

            // Add newline between rows (not after last)
            if i < last {
                result.push('\n');
            }
        }

        Ok(result)
    }

    pub fn resize(
        &self,
        id: &str,
        cols: usize,
        rows: usize,
        pixel_width: usize,
        pixel_height: usize,
    ) {
        match self.lock_terminals() {
            Ok(mut terminals) => {
                if let Some(terminal) = terminals.get_mut(id) {
                    terminal.resize(term_size(cols, rows, pixel_width, pixel_height));
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
        // Clean up sent image hashes for this session
        match self.lock_sent_hashes() {
            Ok(mut hashes) => {
                hashes.remove(id);
            }
            Err(e) => eprintln!("[terminal] remove sent_image_hashes lock failed for {id}: {e}"),
        }
        // Clean up last title for this pane
        match self.lock_last_titles() {
            Ok(mut titles) => {
                titles.remove(id);
            }
            Err(e) => eprintln!("[terminal] remove last_titles lock failed for {id}: {e}"),
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
            Ok(mut palettes) => palettes.clear(),
            Err(e) => eprintln!("[terminal] remove_all palettes lock failed: {e}"),
        }
        match self.lock_sent_hashes() {
            Ok(mut hashes) => hashes.clear(),
            Err(e) => eprintln!("[terminal] remove_all sent_image_hashes lock failed: {e}"),
        }
        match self.lock_last_titles() {
            Ok(mut titles) => titles.clear(),
            Err(e) => eprintln!("[terminal] remove_all last_titles lock failed: {e}"),
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

    /// Compare a terminal title against the last-seen value for this pane.
    /// Returns `Some(truncated_title)` if changed, `None` if unchanged.
    /// On first call for a new pane, always returns `Some` (no prior value).
    ///
    /// Truncates titles to `MAX_TITLE_LEN` chars to prevent IPC bloat from
    /// malicious OSC sequences. Only acquires `last_titles` lock — caller
    /// provides the title from an already-held `terminals` lock.
    fn detect_title_change(&self, id: &str, title: &str) -> Option<String> {
        let mut last_titles = match self.lock_last_titles() {
            Ok(t) => t,
            Err(e) => {
                eprintln!("[terminal] last_titles lock failed for {id}: {e}");
                return None;
            }
        };
        if last_titles.get(id).is_some_and(|last| last == title) {
            return None;
        }
        let truncated: String = title.chars().take(MAX_TITLE_LEN).collect();
        last_titles.insert(id.to_string(), truncated.clone());
        Some(truncated)
    }

    fn snapshot_with_palette(
        terminal: &Terminal,
        palette: &ColorPalette,
        scroll_offset: usize,
        sent_hashes: &mut HashSet<[u8; 32]>,
    ) -> GridSnapshot {
        let screen = terminal.screen();
        let phys_rows = screen.physical_rows;
        let phys_cols = screen.physical_cols;

        // scrollback_rows() returns lines.len() (total lines in buffer).
        // The scrollable range is total - visible.
        let total_lines = screen.scrollback_rows();
        let max_offset = total_lines.saturating_sub(phys_rows);
        let clamped_offset = scroll_offset.min(max_offset);

        // Compute the physical row range for the viewport.
        // At offset 0 (bottom): viewport_top..viewport_bottom = last phys_rows lines.
        // At offset N: shift the window N rows toward the start.
        let viewport_bottom = total_lines.saturating_sub(clamped_offset);
        let viewport_top = viewport_bottom.saturating_sub(phys_rows);
        let lines = screen.lines_in_phys_range(viewport_top..viewport_bottom);

        let mut rows = Vec::with_capacity(phys_rows);
        // Collect unique images for this frame — keyed by hash hex string.
        // frame_hex_cache avoids recomputing hex_encode per cell for the same image.
        let mut frame_images: HashMap<String, ImageSnapshot> = HashMap::new();
        let mut frame_hex_cache: HashMap<[u8; 32], String> = HashMap::new();

        // Color interning table — resolves each unique (ColorAttribute, use_fg_resolver) pair
        // once, then clones the cached RGB string for all cells sharing that color.
        // Typical terminals have 5-20 unique colors vs ~1920 cells (80×24).
        let mut color_cache: HashMap<(ColorAttribute, bool), String> = HashMap::new();
        let mut intern_color = |attr: ColorAttribute, use_fg_resolver: bool| -> String {
            color_cache
                .entry((attr, use_fg_resolver))
                .or_insert_with(|| {
                    if use_fg_resolver {
                        palette.resolve_fg(attr).to_rgb_string()
                    } else {
                        palette.resolve_bg(attr).to_rgb_string()
                    }
                })
                .clone()
        };

        for line in &lines {
            let mut cells = Vec::with_capacity(phys_cols);
            for cell_ref in line.visible_cells() {
                let attrs = cell_ref.attrs();
                let reverse = attrs.reverse();

                let mut fg_attr = attrs.foreground();
                let bg_attr = attrs.background();

                // Bold-as-bright: shift ANSI colors 0-7 to their bright variants 8-15
                // when the cell is bold. Standard terminal behavior that many CLI tools
                // depend on for color variety.
                if matches!(attrs.intensity(), Intensity::Bold) {
                    if let ColorAttribute::PaletteIndex(idx) = fg_attr {
                        if idx < 8 {
                            fg_attr = ColorAttribute::PaletteIndex(idx + 8);
                        }
                    }
                }

                let (fg, bg) = if reverse {
                    (intern_color(bg_attr, false), intern_color(fg_attr, true))
                } else {
                    (intern_color(fg_attr, true), intern_color(bg_attr, false))
                };

                // Extract image attachments from cell attributes.
                // filter_map returns None when encoding fails for a new image,
                // preventing dangling hash references in the frontend.
                let cell_images = attrs.images().map(|img_cells| {
                    img_cells
                        .iter()
                        .filter_map(|img| {
                            let image_data = img.image_data();
                            let hash = image_data.hash();
                            let hash_hex = frame_hex_cache
                                .entry(hash)
                                .or_insert_with(|| hex_encode(&hash))
                                .clone();

                            // Only include full image data if not previously sent
                            if !sent_hashes.contains(&hash) {
                                if frame_images.len() >= MAX_IMAGES_PER_FRAME {
                                    // Cap reached — skip this image entirely
                                    return None;
                                }
                                match Self::encode_image_data(image_data) {
                                    Some(snapshot) => {
                                        sent_hashes.insert(hash);
                                        frame_images.insert(hash_hex.clone(), snapshot);
                                    }
                                    None => {
                                        // Encoding failed — mark as sent to avoid retrying
                                        // every frame for unsupported types (AnimRgba8, etc.)
                                        sent_hashes.insert(hash);
                                        return None;
                                    }
                                }
                            }

                            let tl = img.top_left();
                            let br = img.bottom_right();
                            Some(ImageCellSnapshot {
                                hash: hash_hex,
                                top_left_x: *tl.x,
                                top_left_y: *tl.y,
                                bottom_right_x: *br.x,
                                bottom_right_y: *br.y,
                                z_index: img.z_index(),
                            })
                        })
                        .collect::<Vec<_>>()
                });

                // Only include images field if there are actual image attachments.
                // Defensive: images() never returns Some(vec![]) but filter_map may now
                // produce an empty vec if all images failed to encode.
                let images = cell_images.and_then(|v| if v.is_empty() { None } else { Some(v) });

                // OSC 8 explicit hyperlinks — filter to http(s) for defense-in-depth.
                let link = attrs.hyperlink().and_then(|h| {
                    let uri = h.uri();
                    if uri.starts_with("https://") || uri.starts_with("http://") {
                        Some(uri.to_string())
                    } else {
                        None
                    }
                });

                cells.push(CellSnapshot {
                    text: cell_ref.str().to_string(),
                    fg,
                    bg,
                    bold: matches!(attrs.intensity(), Intensity::Bold),
                    dim: matches!(attrs.intensity(), Intensity::Half),
                    italic: attrs.italic(),
                    underline: !matches!(attrs.underline(), Underline::None),
                    strikethrough: attrs.strikethrough(),
                    hidden: attrs.invisible(),
                    overline: attrs.overline(),
                    images,
                    link,
                });
            }
            // Regex-detect bare URLs in cells that don't already have an OSC 8 link.
            annotate_row_links(&mut cells);
            rows.push(cells);
        }

        // Cursor is only meaningful when viewing the live viewport (offset 0).
        let cursor = terminal.cursor_pos();
        let (cursor_shape, cursor_blink): (&'static str, bool) = match cursor.shape {
            CursorShape::Default => ("default", false),
            CursorShape::BlinkingBlock => ("block", true),
            CursorShape::SteadyBlock => ("block", false),
            CursorShape::BlinkingUnderline => ("underline", true),
            CursorShape::SteadyUnderline => ("underline", false),
            CursorShape::BlinkingBar => ("bar", true),
            CursorShape::SteadyBar => ("bar", false),
        };
        GridSnapshot {
            rows,
            cursor_row: cursor.y.try_into().unwrap_or(0),
            cursor_col: cursor.x,
            cursor_visible: clamped_offset == 0 && cursor.visibility == CursorVisibility::Visible,
            cursor_shape,
            cursor_blink,
            cols: phys_cols,
            total_rows: phys_rows,
            scrollback_rows: max_offset,
            scroll_offset: clamped_offset,
            default_bg: palette.background.to_rgb_string(),
            images: frame_images,
            is_alt_screen: terminal.is_alt_screen_active(),
            is_mouse_grabbed: terminal.is_mouse_grabbed(),
        }
    }

    /// Encode image data from wezterm-term into a base64 ImageSnapshot.
    /// Returns None if the image type is unsupported, exceeds size limits, or encoding fails.
    fn encode_image_data(
        image_data: &Arc<tattoy_wezterm_term::image::ImageData>,
    ) -> Option<ImageSnapshot> {
        let data_guard = image_data.data();
        match &*data_guard {
            ImageDataType::EncodedFile(bytes) => {
                if bytes.len() as u64 > MAX_IMAGE_BYTES {
                    eprintln!(
                        "[terminal] EncodedFile too large: {} bytes (max {MAX_IMAGE_BYTES})",
                        bytes.len()
                    );
                    return None;
                }
                let (width, height) = match data_guard.dimensions() {
                    Ok(dims) => dims,
                    Err(e) => {
                        eprintln!("[terminal] failed to read EncodedFile dimensions: {e}");
                        return None;
                    }
                };
                Some(ImageSnapshot {
                    data: BASE64_STANDARD.encode(bytes),
                    width,
                    height,
                })
            }
            ImageDataType::Rgba8 {
                data,
                width,
                height,
                ..
            } => {
                // Encode raw RGBA as PNG for efficient IPC transfer
                Some(ImageSnapshot {
                    data: encode_rgba_as_png(data, *width, *height)?,
                    width: *width,
                    height: *height,
                })
            }
            _ => {
                // AnimRgba8 and EncodedLease — not yet supported
                eprintln!(
                    "[terminal] unsupported image type (AnimRgba8 or EncodedLease) — skipping"
                );
                None
            }
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

    fn lock_sent_hashes(
        &self,
    ) -> Result<MutexGuard<'_, HashMap<String, HashSet<[u8; 32]>>>, String> {
        self.sent_image_hashes
            .lock()
            .map_err(|e| format!("Sent image hashes lock poisoned: {e}"))
    }

    fn lock_last_titles(&self) -> Result<MutexGuard<'_, HashMap<String, String>>, String> {
        self.last_titles
            .lock()
            .map_err(|e| format!("Last titles lock poisoned: {e}"))
    }
}
