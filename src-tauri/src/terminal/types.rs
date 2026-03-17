use alacritty_terminal::grid::Dimensions;
use alacritty_terminal::index::{Column, Line};
use alacritty_terminal::term::cell::Cell;
use alacritty_terminal::term::Term;
use alacritty_terminal::vte::ansi::{Color, NamedColor};
use serde::Serialize;

use crate::terminal::event_proxy::EventProxy;

/// RGB color resolved from terminal palette.
#[derive(Debug, Clone, Copy, Serialize)]
pub struct TermColor {
    pub r: u8,
    pub g: u8,
    pub b: u8,
}

impl TermColor {
    pub const fn new(r: u8, g: u8, b: u8) -> Self {
        Self { r, g, b }
    }
}

/// Single cell in the terminal grid, serialized for the frontend.
#[derive(Debug, Clone, Serialize)]
pub struct CellData {
    pub c: String,
    pub fg: TermColor,
    pub bg: TermColor,
    pub flags: u32,
}

/// Cursor position and visibility.
#[derive(Debug, Clone, Serialize)]
pub struct CursorState {
    pub col: u16,
    pub line: u16,
    pub visible: bool,
}

/// Full terminal grid snapshot for the frontend renderer.
#[derive(Debug, Clone, Serialize)]
pub struct CellGrid {
    pub cells: Vec<Vec<CellData>>,
    pub cols: u16,
    pub rows: u16,
    pub cursor: CursorState,
}

/// Default dark palette for named ANSI colors.
fn named_color_to_rgb(color: NamedColor) -> TermColor {
    match color {
        NamedColor::Black => TermColor::new(0x1d, 0x1f, 0x21),
        NamedColor::Red => TermColor::new(0xcc, 0x66, 0x66),
        NamedColor::Green => TermColor::new(0xb5, 0xbd, 0x68),
        NamedColor::Yellow => TermColor::new(0xf0, 0xc6, 0x74),
        NamedColor::Blue => TermColor::new(0x81, 0xa2, 0xbe),
        NamedColor::Magenta => TermColor::new(0xb2, 0x94, 0xbb),
        NamedColor::Cyan => TermColor::new(0x8a, 0xbe, 0xb7),
        NamedColor::White => TermColor::new(0xc5, 0xc8, 0xc6),
        NamedColor::BrightBlack => TermColor::new(0x96, 0x98, 0x96),
        NamedColor::BrightRed => TermColor::new(0xde, 0x93, 0x5f),
        NamedColor::BrightGreen => TermColor::new(0xb5, 0xbd, 0x68),
        NamedColor::BrightYellow => TermColor::new(0xf0, 0xc6, 0x74),
        NamedColor::BrightBlue => TermColor::new(0x81, 0xa2, 0xbe),
        NamedColor::BrightMagenta => TermColor::new(0xb2, 0x94, 0xbb),
        NamedColor::BrightCyan => TermColor::new(0x8a, 0xbe, 0xb7),
        NamedColor::BrightWhite => TermColor::new(0xff, 0xff, 0xff),
        NamedColor::Foreground => TermColor::new(0xc5, 0xc8, 0xc6),
        NamedColor::Background => TermColor::new(0x1d, 0x1f, 0x21),
        other => {
            log::debug!("Unknown named color {other:?}, falling back to foreground");
            TermColor::new(0xc5, 0xc8, 0xc6)
        }
    }
}

/// Convert xterm-256 indexed color to RGB.
fn indexed_color_to_rgb(index: u8) -> TermColor {
    match index {
        // Standard 16 colors — delegate to named.
        0 => named_color_to_rgb(NamedColor::Black),
        1 => named_color_to_rgb(NamedColor::Red),
        2 => named_color_to_rgb(NamedColor::Green),
        3 => named_color_to_rgb(NamedColor::Yellow),
        4 => named_color_to_rgb(NamedColor::Blue),
        5 => named_color_to_rgb(NamedColor::Magenta),
        6 => named_color_to_rgb(NamedColor::Cyan),
        7 => named_color_to_rgb(NamedColor::White),
        8 => named_color_to_rgb(NamedColor::BrightBlack),
        9 => named_color_to_rgb(NamedColor::BrightRed),
        10 => named_color_to_rgb(NamedColor::BrightGreen),
        11 => named_color_to_rgb(NamedColor::BrightYellow),
        12 => named_color_to_rgb(NamedColor::BrightBlue),
        13 => named_color_to_rgb(NamedColor::BrightMagenta),
        14 => named_color_to_rgb(NamedColor::BrightCyan),
        15 => named_color_to_rgb(NamedColor::BrightWhite),
        // 216-color cube (indices 16–231).
        16..=231 => {
            let idx = index - 16;
            let r_idx = idx / 36;
            let g_idx = (idx / 6) % 6;
            let b_idx = idx % 6;
            let to_val = |i: u8| if i == 0 { 0 } else { 55 + 40 * i };
            TermColor::new(to_val(r_idx), to_val(g_idx), to_val(b_idx))
        }
        // Grayscale ramp (indices 232–255).
        232..=255 => {
            let v = 8 + 10 * (index - 232);
            TermColor::new(v, v, v)
        }
    }
}

/// Resolve any alacritty Color variant to concrete RGB.
fn resolve_color(color: Color) -> TermColor {
    match color {
        Color::Named(named) => named_color_to_rgb(named),
        Color::Indexed(idx) => indexed_color_to_rgb(idx),
        Color::Spec(rgb) => TermColor::new(rgb.r, rgb.g, rgb.b),
    }
}

fn cell_to_data(cell: &Cell) -> CellData {
    CellData {
        c: cell.c.to_string(),
        fg: resolve_color(cell.fg),
        bg: resolve_color(cell.bg),
        flags: cell.flags.bits() as u32,
    }
}

/// Extract the visible grid from a Term reference into a serializable CellGrid.
pub fn extract_grid(term: &Term<EventProxy>) -> CellGrid {
    let grid = term.grid();
    let cols = grid.columns();
    let rows = grid.screen_lines();

    let mut cells = Vec::with_capacity(rows);
    for line_idx in 0..rows {
        let line = Line(line_idx as i32);
        let row = &grid[line];
        let mut row_cells = Vec::with_capacity(cols);
        for col_idx in 0..cols {
            let cell = &row[Column(col_idx)];
            row_cells.push(cell_to_data(cell));
        }
        cells.push(row_cells);
    }

    let cursor = &grid.cursor.point;
    let cursor_state = CursorState {
        col: u16::try_from(cursor.column.0).unwrap_or(0),
        line: u16::try_from(cursor.line.0).unwrap_or(0),
        visible: term
            .mode()
            .contains(alacritty_terminal::term::TermMode::SHOW_CURSOR),
    };

    CellGrid {
        cells,
        cols: cols as u16,
        rows: rows as u16,
        cursor: cursor_state,
    }
}
