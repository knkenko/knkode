/** RGB color resolved from terminal palette. Mirrors Rust TermColor. */
export interface TermColor {
	r: number;
	g: number;
	b: number;
}

/** Single cell in the terminal grid. Mirrors Rust CellData. */
export interface CellData {
	c: string;
	fg: TermColor;
	bg: TermColor;
	flags: number;
}

/** Cursor position and visibility. Mirrors Rust CursorState. */
export interface CursorState {
	col: number;
	line: number;
	visible: boolean;
}

/** Full terminal grid snapshot from the backend. Mirrors Rust CellGrid. */
export interface CellGrid {
	cells: CellData[][];
	cols: number;
	rows: number;
	cursor: CursorState;
}
