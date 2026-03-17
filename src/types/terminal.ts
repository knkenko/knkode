/** RGB color resolved from terminal palette. Mirrors Rust TermColor. Each channel is 0-255 (u8). */
export interface TermColor {
	readonly r: number;
	readonly g: number;
	readonly b: number;
}

/** Single cell in the terminal grid. Mirrors Rust CellData. */
export interface CellData {
	readonly c: string;
	readonly fg: TermColor;
	readonly bg: TermColor;
	/** Alacritty cell attribute flags (bold, italic, underline, etc.) — not yet rendered. */
	readonly flags: number;
}

/** Cursor position and visibility. Mirrors Rust CursorState. */
export interface CursorState {
	readonly col: number;
	/** Row index from top of visible area (zero-indexed). */
	readonly line: number;
	readonly visible: boolean;
}

/** Full terminal grid snapshot from the backend. Mirrors Rust CellGrid. */
export interface CellGrid {
	readonly cells: readonly CellData[][];
	readonly cols: number;
	readonly rows: number;
	readonly cursor: CursorState;
}
