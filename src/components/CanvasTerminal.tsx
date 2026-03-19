import { useCallback, useEffect, useRef } from "react";
import { DEFAULT_FONT_FAMILY } from "../data/theme-presets";
import { keyEventToAnsi, PASTE_SENTINEL } from "../lib/key-to-ansi";
import type { CellSnapshot, CursorStyle, GridSnapshot, SelectionRange } from "../shared/types";
import {
	DEFAULT_BACKGROUND,
	DEFAULT_CURSOR_COLOR,
	DEFAULT_FONT_SIZE,
	DEFAULT_LINE_HEIGHT,
} from "../shared/types";
import { isMac } from "../utils/platform";

export interface CanvasTerminalProps {
	readonly grid: GridSnapshot | null;
	readonly onWrite: (data: string) => void;
	readonly onResize: (cols: number, rows: number) => void;
	/** Scroll delta in lines: positive = scroll up (into scrollback), negative = toward bottom. */
	readonly onScroll: (deltaLines: number) => void;
	readonly fontSize?: number | undefined;
	readonly fontFamily?: string | undefined;
	readonly lineHeight?: number | undefined;
	/** User-configured cursor style. Always used — TUI DECSCUSR escape sequences are ignored. */
	readonly cursorStyle?: "block" | "underline" | "bar" | undefined;
	readonly cursorColor?: string | undefined;
	readonly background?: string | undefined;
	readonly isFocused?: boolean | undefined;
	/** Selection highlight color. When omitted, selections are not visually highlighted but tracking and copy still function. */
	readonly selectionColor?: string | undefined;
	/** Pane ID used by getSelectionText IPC. */
	readonly paneId: string;
}

/** Smooth cursor blink — full cycle duration (fade out → fade in). */
const CURSOR_BLINK_PERIOD_MS = 1200;
/** Hold cursor at full opacity after keystroke before fading starts. */
const CURSOR_HOLD_MS = 500;
const CURSOR_MAX_OPACITY = 0.7;
const CURSOR_MIN_OPACITY = 0.0;
const CURSOR_STATIC_OPACITY = 0.5;
const RESIZE_DEBOUNCE_MS = 100;
/** Bar cursor width as fraction of cell width. */
const BAR_WIDTH_RATIO = 0.12;
/** Underline cursor height as fraction of cell height. */
const UNDERLINE_HEIGHT_RATIO = 0.12;
/** Selection highlight overlay opacity — balances visibility against text readability. */
const SELECTION_HIGHLIGHT_OPACITY = 0.33;
/** Maximum elapsed time between clicks for a click streak to continue. */
const CLICK_STREAK_TIMEOUT_MS = 400;
/** Click streak values — also used as drag granularity mode. */
const CLICK_CHAR = 1;
const CLICK_WORD = 2;
const CLICK_LINE = 3;
/** Word character pattern for word-boundary detection in findWordBounds. */
const WORD_CHAR_RE = /\w/;

interface CellMetrics {
	width: number;
	height: number;
	/** Distance from cell top to text baseline (for textBaseline = "alphabetic"). */
	baselineOffset: number;
}

/** A cell position in the terminal grid. Row is an absolute physical index in the scrollback buffer. */
interface CellPosition {
	readonly row: number;
	readonly col: number;
}

/** Convert a viewport-relative row to an absolute physical row in the scrollback buffer. */
function toAbsoluteRow(grid: GridSnapshot, viewportRow: number): number {
	return grid.scrollbackRows - grid.scrollOffset + viewportRow;
}

/** Normalize an anchor/end pair into an ordered SelectionRange (start before end). */
function normalizeSelection(anchor: CellPosition, end: CellPosition): SelectionRange {
	if (anchor.row < end.row || (anchor.row === end.row && anchor.col <= end.col)) {
		return { startRow: anchor.row, startCol: anchor.col, endRow: end.row, endCol: end.col };
	}
	return { startRow: end.row, startCol: end.col, endRow: anchor.row, endCol: anchor.col };
}

/** Find word boundaries at a given column in a viewport row.
 *  A "word" is a contiguous run of word characters (\w). If the target cell is
 *  not a word character, returns a single-cell range. */
function findWordBounds(
	rows: readonly (readonly CellSnapshot[] | undefined)[],
	viewportRow: number,
	col: number,
	totalCols: number,
): { startCol: number; endCol: number } {
	const row = rows[viewportRow];
	if (!row) return { startCol: col, endCol: col };

	const isWordChar = (c: number): boolean => {
		const cell = row[c];
		return cell != null && WORD_CHAR_RE.test(cell.text);
	};

	if (!isWordChar(col)) return { startCol: col, endCol: col };

	let startCol = col;
	while (startCol > 0 && isWordChar(startCol - 1)) startCol--;

	let endCol = col;
	while (endCol < totalCols - 1 && isWordChar(endCol + 1)) endCol++;

	return { startCol, endCol };
}

/** Convert client (mouse) coordinates to a viewport-relative cell position
 *  using a pre-computed rect and DPR. Returns null if metrics are unavailable. */
function cellFromRect(
	rect: DOMRect,
	dpr: number,
	clientX: number,
	clientY: number,
	cellW: number,
	cellH: number,
	maxCol: number,
	maxRow: number,
): { row: number; col: number } {
	const x = (clientX - rect.left) * dpr;
	const y = (clientY - rect.top) * dpr;
	return {
		col: Math.max(0, Math.min(maxCol, Math.floor(x / cellW))),
		row: Math.max(0, Math.min(maxRow, Math.floor(y / cellH))),
	};
}

/** Build a CSS font string for a cell's style attributes. */
function buildFont(cell: CellSnapshot, scaledSize: number, fontFamily: string): string {
	const style = cell.italic ? "italic " : "";
	const weight = cell.bold ? "bold " : "";
	return `${style}${weight}${scaledSize}px ${fontFamily}`;
}

/** Draw a horizontal line (used for underline and strikethrough). */
function drawHLine(
	ctx: CanvasRenderingContext2D,
	color: string,
	lineWidth: number,
	x: number,
	y: number,
	width: number,
) {
	ctx.strokeStyle = color;
	ctx.lineWidth = lineWidth;
	ctx.beginPath();
	ctx.moveTo(x, y);
	ctx.lineTo(x + width, y);
	ctx.stroke();
}

/** Draw a single terminal cell (background, text, decorations).
 *  Cells whose bg matches `defaultBg` (the terminal palette default) are left
 *  transparent so PaneBackgroundEffects show through. */
function drawCell(
	ctx: CanvasRenderingContext2D,
	cell: CellSnapshot,
	x: number,
	y: number,
	cellW: number,
	cellH: number,
	baselineOffset: number,
	scaledSize: number,
	fontFamily: string,
	defaultBg: string,
) {
	// Background — only draw cells with a custom (non-default) background
	if (cell.bg !== defaultBg) {
		ctx.fillStyle = cell.bg;
		ctx.fillRect(x, y, cellW, cellH);
	}

	// Text
	if (cell.text.trim()) {
		ctx.font = buildFont(cell, scaledSize, fontFamily);
		ctx.fillStyle = cell.fg;
		ctx.fillText(cell.text, x, y + baselineOffset);
	}

	// Underline
	if (cell.underline) {
		drawHLine(ctx, cell.fg, ctx.lineWidth, x, y + cellH - ctx.lineWidth, cellW);
	}

	// Strikethrough
	if (cell.strikethrough) {
		drawHLine(ctx, cell.fg, ctx.lineWidth, x, y + cellH / 2, cellW);
	}
}

/** Draw the cursor overlay (bar, underline, or block with inverted text). */
function drawCursorOverlay(
	ctx: CanvasRenderingContext2D,
	shape: CursorStyle,
	cx: number,
	cy: number,
	cellW: number,
	cellH: number,
	dpr: number,
	scaledSize: number,
	fontFamily: string,
	baselineOffset: number,
	color: string,
	bg: string,
	opacity: number,
	cursorCell: CellSnapshot | undefined,
) {
	ctx.fillStyle = color;
	ctx.globalAlpha = opacity;

	if (shape === "bar") {
		ctx.fillRect(cx, cy, Math.max(dpr, cellW * BAR_WIDTH_RATIO), cellH);
	} else if (shape === "underline") {
		const h = Math.max(dpr, cellH * UNDERLINE_HEIGHT_RATIO);
		ctx.fillRect(cx, cy + cellH - h, cellW, h);
	} else {
		// block — fill entire cell, invert text on top
		ctx.fillRect(cx, cy, cellW, cellH);
		ctx.globalAlpha = 1.0;
		if (cursorCell?.text.trim()) {
			ctx.font = buildFont(cursorCell, scaledSize, fontFamily);
			ctx.fillStyle = bg;
			ctx.globalAlpha = opacity / CURSOR_MAX_OPACITY;
			ctx.fillText(cursorCell.text, cx, cy + baselineOffset);
		}
	}
	ctx.globalAlpha = 1.0;
}

/** Draw selection highlight rectangles for the visible portion of the selection range.
 *  Normalizes anchor/end direction via normalizeSelection(), then draws only viewport-visible rows. */
function drawSelectionHighlight(
	ctx: CanvasRenderingContext2D,
	anchor: CellPosition,
	end: CellPosition,
	grid: GridSnapshot,
	cellW: number,
	cellH: number,
	color: string,
) {
	const { startRow: sr, startCol: sc, endRow: er, endCol: ec } = normalizeSelection(anchor, end);

	// Convert absolute rows to viewport-relative; clamp to visible range
	const viewportBase = grid.scrollbackRows - grid.scrollOffset;
	const viewportEnd = viewportBase + grid.totalRows;
	const visStart = Math.max(sr, viewportBase);
	const visEnd = Math.min(er, viewportEnd - 1);
	if (visStart > visEnd) return;

	ctx.fillStyle = color;
	ctx.globalAlpha = SELECTION_HIGHLIGHT_OPACITY;

	for (let absRow = visStart; absRow <= visEnd; absRow++) {
		const vpRow = absRow - viewportBase;
		const y = vpRow * cellH;
		let x0: number;
		let w: number;

		if (absRow === sr && absRow === er) {
			x0 = sc * cellW;
			w = (ec - sc + 1) * cellW;
		} else if (absRow === sr) {
			x0 = sc * cellW;
			w = (grid.cols - sc) * cellW;
		} else if (absRow === er) {
			x0 = 0;
			w = (ec + 1) * cellW;
		} else {
			x0 = 0;
			w = grid.cols * cellW;
		}

		ctx.fillRect(x0, y, w, cellH);
	}

	ctx.globalAlpha = 1.0;
}

export function CanvasTerminal({
	grid,
	onWrite,
	onResize,
	onScroll,
	fontSize = DEFAULT_FONT_SIZE,
	fontFamily = DEFAULT_FONT_FAMILY,
	lineHeight = DEFAULT_LINE_HEIGHT,
	cursorStyle = "bar",
	cursorColor = DEFAULT_CURSOR_COLOR,
	background = DEFAULT_BACKGROUND,
	isFocused = true,
	selectionColor,
	paneId,
}: CanvasTerminalProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const cellMetrics = useRef<CellMetrics>({ width: 0, height: 0, baselineOffset: 0 });
	const cursorOpacity = useRef(CURSOR_MAX_OPACITY);
	const blinkStart = useRef(performance.now());
	const animFrame = useRef<number>(0);
	const gridRef = useRef<GridSnapshot | null>(null);
	const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
	const dprRef = useRef(window.devicePixelRatio || 1);
	const onResizeRef = useRef(onResize);
	const onScrollRef = useRef(onScroll);
	const cursorStyleRef = useRef(cursorStyle);
	const resizeTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
	const isFocusedRef = useRef(isFocused);

	// Selection state — stored as absolute physical row indices so the selection
	// survives viewport scrolling without needing recalculation.
	const selectionAnchorRef = useRef<CellPosition | null>(null);
	const selectionEndRef = useRef<CellPosition | null>(null);
	const selectionColorRef = useRef(selectionColor);
	/** Pending selection RAF frame — coalesces rapid mousemove into one redraw per frame. */
	const selectionRafRef = useRef(0);
	/** Active window listeners attached during selection drag — cleaned up on unmount. */
	const dragListenersRef = useRef<{
		move: (e: MouseEvent) => void;
		up: (e: MouseEvent) => void;
	} | null>(null);
	/** Timestamp of the last mousedown — used for click streak detection. */
	const lastClickTimeRef = useRef(0);
	/** Cell position of the last mousedown — streaks only count when clicking the same cell. */
	const lastClickCellRef = useRef<CellPosition | null>(null);
	/** Current click streak count: 1 = single, 2 = double (word), 3 = triple (line). */
	const clickStreakRef = useRef(1);
	/** Whether a non-degenerate selection is active (set by multi-click or drag). */
	const selectionActiveRef = useRef(false);

	// Keep refs in sync
	gridRef.current = grid;
	onResizeRef.current = onResize;
	onScrollRef.current = onScroll;
	cursorStyleRef.current = cursorStyle;
	isFocusedRef.current = isFocused;
	selectionColorRef.current = selectionColor;

	/** Convert client (mouse) coordinates to a viewport-relative cell position.
	 *  Returns viewport-relative {row, col} — NOT absolute physical rows. */
	const cellAtPixel = useCallback(
		(clientX: number, clientY: number): { row: number; col: number } | null => {
			const canvas = canvasRef.current;
			if (!canvas) return null;
			const { width: cellW, height: cellH } = cellMetrics.current;
			if (cellW === 0 || cellH === 0) return null;
			const snap = gridRef.current;
			return cellFromRect(
				canvas.getBoundingClientRect(),
				dprRef.current,
				clientX,
				clientY,
				cellW,
				cellH,
				snap ? snap.cols - 1 : 0,
				snap ? snap.totalRows - 1 : 0,
			);
		},
		[],
	);

	// Measure cell dimensions using actual font metrics (ascent + descent)
	// instead of just fontSize, so descenders aren't clipped.
	const measureCell = useCallback(() => {
		const ctx = ctxRef.current;
		if (!ctx) return;

		const dpr = dprRef.current;
		const scaledSize = fontSize * dpr;
		ctx.font = `${scaledSize}px ${fontFamily}`;
		const metrics = ctx.measureText("M");

		// Use real font bounding box for proper vertical sizing.
		// Fallback ratios for older engines that lack fontBoundingBox*.
		const ascent = metrics.fontBoundingBoxAscent ?? scaledSize * 0.8;
		const descent = metrics.fontBoundingBoxDescent ?? scaledSize * 0.2;
		const naturalHeight = ascent + descent;
		const cellH = Math.ceil(naturalHeight * lineHeight);

		// Vertically center the text within the (possibly taller) cell
		const padding = (cellH - naturalHeight) / 2;

		cellMetrics.current = {
			width: metrics.width,
			height: cellH,
			baselineOffset: padding + ascent,
		};
	}, [fontSize, fontFamily, lineHeight]);

	/** Repaint only the cursor cell area — used by the blink animation loop. */
	const repaintCursor = useCallback(() => {
		const snap = gridRef.current;
		const ctx = ctxRef.current;
		if (!snap || !ctx) return;
		const { width: cellW, height: cellH, baselineOffset } = cellMetrics.current;
		if (cellW === 0 || cellH === 0) return;

		const dpr = dprRef.current;
		const scaledSize = fontSize * dpr;
		const cx = snap.cursorCol * cellW;
		const cy = snap.cursorRow * cellH;

		const cursorRow = snap.rows[snap.cursorRow];
		const cursorCell = cursorRow?.[snap.cursorCol];

		ctx.textBaseline = "alphabetic";
		ctx.lineWidth = dpr;

		// Clear cursor rect to transparent
		ctx.clearRect(cx, cy, cellW, cellH);

		// Redraw cell background if it has a custom color
		if (cursorCell && cursorCell.bg !== snap.defaultBg) {
			ctx.fillStyle = cursorCell.bg;
			ctx.fillRect(cx, cy, cellW, cellH);
		}

		// Redraw cell content
		if (cursorCell) {
			if (cursorCell.text.trim()) {
				ctx.font = buildFont(cursorCell, scaledSize, fontFamily);
				ctx.fillStyle = cursorCell.fg;
				ctx.fillText(cursorCell.text, cx, cy + baselineOffset);
			}
			if (cursorCell.underline) {
				drawHLine(ctx, cursorCell.fg, dpr, cx, cy + cellH - dpr, cellW);
			}
			if (cursorCell.strikethrough) {
				drawHLine(ctx, cursorCell.fg, dpr, cx, cy + cellH / 2, cellW);
			}
		}

		// Draw cursor overlay with current opacity
		if (snap.cursorVisible) {
			drawCursorOverlay(
				ctx,
				cursorStyleRef.current,
				cx,
				cy,
				cellW,
				cellH,
				dpr,
				scaledSize,
				fontFamily,
				baselineOffset,
				cursorColor,
				background,
				cursorOpacity.current,
				cursorCell,
			);
		}
	}, [fontSize, fontFamily, cursorColor, background]);

	// Draw the full grid
	// biome-ignore lint/correctness/useExhaustiveDependencies: lineHeight affects cellMetrics ref
	const draw = useCallback(() => {
		const canvas = canvasRef.current;
		const snap = gridRef.current;
		const ctx = ctxRef.current;
		if (!canvas || !snap || !ctx) return;

		const dpr = dprRef.current;
		const scaledSize = fontSize * dpr;
		const { width: cellW, height: cellH, baselineOffset } = cellMetrics.current;
		if (cellW === 0 || cellH === 0) return;

		// Clear to transparent — PaneBackgroundEffects provides the visual background
		ctx.clearRect(0, 0, canvas.width, canvas.height);

		// Set shared state once before the cell loop
		ctx.textBaseline = "alphabetic";
		ctx.lineWidth = dpr;

		const defaultBg = snap.defaultBg;

		// Draw cells
		for (let row = 0; row < snap.rows.length; row++) {
			const rowCells = snap.rows[row];
			if (!rowCells) continue;
			for (let col = 0; col < rowCells.length; col++) {
				const cell = rowCells[col];
				if (!cell) continue;
				const x = col * cellW;
				const y = row * cellH;

				drawCell(ctx, cell, x, y, cellW, cellH, baselineOffset, scaledSize, fontFamily, defaultBg);
			}
		}

		// Draw selection highlight (between cells and cursor so cursor stays on top)
		const anchor = selectionAnchorRef.current;
		const end = selectionEndRef.current;
		if (anchor && end && selectionColorRef.current && selectionActiveRef.current) {
			drawSelectionHighlight(ctx, anchor, end, snap, cellW, cellH, selectionColorRef.current);
		}

		// Draw cursor
		if (snap.cursorVisible) {
			const cx = snap.cursorCol * cellW;
			const cy = snap.cursorRow * cellH;
			const cursorRow = snap.rows[snap.cursorRow];
			const cursorCell = cursorRow?.[snap.cursorCol];
			drawCursorOverlay(
				ctx,
				cursorStyleRef.current,
				cx,
				cy,
				cellW,
				cellH,
				dpr,
				scaledSize,
				fontFamily,
				baselineOffset,
				cursorColor,
				background,
				cursorOpacity.current,
				cursorCell,
			);
		}
	}, [background, cursorColor, fontSize, fontFamily, lineHeight]);

	// Keep draw ref in sync so the resize observer can trigger redraws
	// without being recreated when draw's dependencies change.
	const drawRef = useRef(draw);
	drawRef.current = draw;

	/** Clear selection state and trigger a redraw. */
	const clearSelection = useCallback(() => {
		selectionAnchorRef.current = null;
		selectionEndRef.current = null;
		selectionActiveRef.current = false;
		drawRef.current();
	}, []);

	// Handle resize: compute cols/rows from container dimensions
	useEffect(() => {
		const container = containerRef.current;
		const canvas = canvasRef.current;
		if (!container || !canvas) return;

		const observer = new ResizeObserver(() => {
			if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
			resizeTimerRef.current = setTimeout(() => {
				const dpr = window.devicePixelRatio || 1;
				dprRef.current = dpr;
				const rect = container.getBoundingClientRect();
				const w = Math.floor(rect.width * dpr);
				const h = Math.floor(rect.height * dpr);

				// Skip if dimensions haven't changed — avoids clearing the canvas
				// (setting canvas.width/height always clears it, even to the same value)
				if (canvas.width === w && canvas.height === h) {
					drawRef.current();
					return;
				}

				canvas.width = w;
				canvas.height = h;
				canvas.style.width = `${rect.width}px`;
				canvas.style.height = `${rect.height}px`;

				// Cache context after canvas resize (resets it)
				ctxRef.current = canvas.getContext("2d");

				measureCell();

				const { width: cellW, height: cellH } = cellMetrics.current;
				if (cellW > 0 && cellH > 0) {
					const cols = Math.floor(w / cellW);
					const rows = Math.floor(h / cellH);
					if (cols > 0 && rows > 0) {
						onResizeRef.current(cols, rows);
					}
				}

				// Redraw after resize so the canvas isn't blank
				drawRef.current();
			}, RESIZE_DEBOUNCE_MS);
		});

		observer.observe(container);
		return () => {
			observer.disconnect();
			if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
		};
	}, [measureCell]);

	// Wheel scroll → convert pixel/line/page delta to line count and call onScroll.
	// Must use native addEventListener with { passive: false } to allow preventDefault
	// (React's onWheel is passive by default in modern browsers).
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const handler = (e: WheelEvent) => {
			const { height: cellH } = cellMetrics.current;
			if (cellH === 0) return;

			const dpr = dprRef.current;
			let lines: number;
			if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) {
				lines = e.deltaY;
			} else if (e.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
				const snap = gridRef.current;
				lines = e.deltaY * (snap?.totalRows ?? 24);
			} else {
				// DOM_DELTA_PIXEL — convert using CSS-pixel cell height
				lines = e.deltaY / (cellH / dpr);
			}

			if (Math.abs(lines) > 0.01) {
				e.preventDefault();
				// Negate: positive deltaY = scroll down = toward bottom = negative offset delta
				// Pass raw fractional value — Pane accumulates and rounds
				onScrollRef.current(-lines);
			}
		};

		container.addEventListener("wheel", handler, { passive: false });
		return () => container.removeEventListener("wheel", handler);
	}, []);

	// Redraw when grid changes — grid is state that triggers redraw, draw reads from gridRef
	// biome-ignore lint/correctness/useExhaustiveDependencies: grid triggers redraw via state
	useEffect(() => {
		// Reset blink timer on grid change (keystroke makes cursor fully visible)
		blinkStart.current = performance.now();
		cursorOpacity.current = CURSOR_MAX_OPACITY;
		draw();
	}, [grid, draw]);

	// Smooth cursor blink animation — runs whenever the pane is focused.
	// TUI DECSCUSR blink requests are ignored; user's setting always wins.
	// biome-ignore lint/correctness/useExhaustiveDependencies: grid in deps resets blink on new output (keystroke → cursor fully visible)
	useEffect(() => {
		if (!isFocused) {
			cursorOpacity.current = CURSOR_STATIC_OPACITY;
			repaintCursor();
			return;
		}

		// Reset blink start so cursor is fully visible when pane gains focus
		blinkStart.current = performance.now();
		cursorOpacity.current = CURSOR_MAX_OPACITY;

		const tick = (now: number) => {
			const elapsed = now - blinkStart.current;

			if (elapsed < CURSOR_HOLD_MS) {
				cursorOpacity.current = CURSOR_MAX_OPACITY;
			} else {
				const t = elapsed - CURSOR_HOLD_MS;
				const phase = (1 + Math.cos((t * 2 * Math.PI) / CURSOR_BLINK_PERIOD_MS)) / 2;
				cursorOpacity.current =
					CURSOR_MIN_OPACITY + (CURSOR_MAX_OPACITY - CURSOR_MIN_OPACITY) * phase;
			}

			repaintCursor();
			animFrame.current = requestAnimationFrame(tick);
		};

		animFrame.current = requestAnimationFrame(tick);
		return () => cancelAnimationFrame(animFrame.current);
	}, [isFocused, grid, repaintCursor]);

	// Cleanup drag listeners and selection RAF on unmount — prevents leaks if
	// the component unmounts mid-drag (pane close, workspace switch).
	useEffect(() => {
		return () => {
			const listeners = dragListenersRef.current;
			if (listeners) {
				window.removeEventListener("mousemove", listeners.move);
				window.removeEventListener("mouseup", listeners.up);
				dragListenersRef.current = null;
			}
			if (selectionRafRef.current) {
				cancelAnimationFrame(selectionRafRef.current);
				selectionRafRef.current = 0;
			}
		};
	}, []);

	/** Write text to PTY wrapped in bracketed paste escape sequences. */
	const writePaste = useCallback(
		(text: string) => {
			if (!text) return;
			const MAX_PASTE_BYTES = 1_048_576; // 1 MB
			const clamped = text.length > MAX_PASTE_BYTES ? text.slice(0, MAX_PASTE_BYTES) : text;
			onWrite(`\x1b[200~${clamped}\x1b[201~`);
		},
		[onWrite],
	);

	/** Read clipboard and write contents to PTY. Complements the PASTE_SENTINEL
	 *  path in handleKeyDown — both ultimately call writePaste. */
	const pasteFromClipboard = useCallback(() => {
		navigator.clipboard
			.readText()
			.then(writePaste)
			.catch((err: unknown) => {
				console.error("[terminal] clipboard read failed:", err);
			});
	}, [writePaste]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			// Copy shortcut: Cmd+C (macOS) or Ctrl+C (Windows/Linux)
			const isCopy = isMac
				? e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && e.key.toLowerCase() === "c"
				: e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.key.toLowerCase() === "c";

			if (isCopy) {
				const anchor = selectionAnchorRef.current;
				const end = selectionEndRef.current;
				if (anchor && end && selectionActiveRef.current) {
					e.preventDefault();
					const range = normalizeSelection(anchor, end);
					window.api
						.getSelectionText(paneId, range)
						.then((text) => {
							if (text) return navigator.clipboard.writeText(text);
						})
						.then(() => clearSelection())
						.catch((err: unknown) => {
							console.error(`[terminal] copy failed for ${paneId}:`, err);
							clearSelection();
						});
					return;
				}
				// No selection: macOS Cmd+C = no-op; Windows/Linux Ctrl+C = SIGINT
				if (!isMac) {
					e.preventDefault();
					onWrite("\x03");
				}
				return;
			}

			const ansi = keyEventToAnsi(e.nativeEvent);
			if (ansi === PASTE_SENTINEL) {
				e.preventDefault();
				pasteFromClipboard();
				return;
			}
			if (ansi !== null) {
				e.preventDefault();
				clearSelection();
				onWrite(ansi);
			}
		},
		[onWrite, pasteFromClipboard, paneId, clearSelection],
	);

	// Handle native paste events (Cmd+V on macOS via Tauri menu, browser paste)
	const handlePaste = useCallback(
		(e: React.ClipboardEvent) => {
			e.preventDefault();
			const text = e.clipboardData.getData("text/plain");
			writePaste(text);
		},
		[writePaste],
	);

	/** Start selection on left-click; track via window listeners until mouseup.
	 *  Supports single-click (char), double-click (word), triple-click (line),
	 *  and shift+click (extend). Drag granularity matches the click mode.
	 *  Caches the canvas rect for the duration of the drag to avoid layout reflows.
	 *  RAF-throttles redraws so high-frequency trackpad events don't saturate the main thread. */
	const handleMouseDown = useCallback(
		(e: React.MouseEvent) => {
			if (e.button !== 0) return;
			const cell = cellAtPixel(e.clientX, e.clientY);
			if (!cell) return;
			const snap = gridRef.current;
			if (!snap) return;

			const absRow = toAbsoluteRow(snap, cell.row);
			selectionActiveRef.current = false;

			// Shift+click: extend existing selection to the exact clicked cell
			// (always char-granular, no drag). Reset streak so next click starts fresh.
			if (e.shiftKey && selectionAnchorRef.current) {
				clickStreakRef.current = 1;
				lastClickTimeRef.current = performance.now();
				lastClickCellRef.current = { row: absRow, col: cell.col };
				selectionActiveRef.current = true;
				selectionEndRef.current = { row: absRow, col: cell.col };
				drawRef.current();
				return;
			}

			// Click streak detection — increment if same cell within timeout, else reset
			const now = performance.now();
			const lastCell = lastClickCellRef.current;
			const sameCell = lastCell != null && lastCell.row === absRow && lastCell.col === cell.col;
			if (sameCell && now - lastClickTimeRef.current < CLICK_STREAK_TIMEOUT_MS) {
				clickStreakRef.current = Math.min(clickStreakRef.current + 1, CLICK_LINE);
			} else {
				clickStreakRef.current = CLICK_CHAR;
			}
			lastClickTimeRef.current = now;
			lastClickCellRef.current = { row: absRow, col: cell.col };
			// streak also governs drag granularity (char/word/line) in onMove below
			const streak = clickStreakRef.current;

			// Determine initial selection based on click streak
			let anchorCol: number;
			let endCol: number;
			if (streak === CLICK_LINE) {
				// Triple-click: select entire line
				anchorCol = 0;
				endCol = snap.cols - 1;
			} else if (streak === CLICK_WORD) {
				// Double-click: select word at click position
				const bounds = findWordBounds(snap.rows, cell.row, cell.col, snap.cols);
				anchorCol = bounds.startCol;
				endCol = bounds.endCol;
			} else {
				// Single click: point selection
				anchorCol = cell.col;
				endCol = cell.col;
			}
			selectionAnchorRef.current = { row: absRow, col: anchorCol };
			selectionEndRef.current = { row: absRow, col: endCol };
			if (streak > 1) {
				selectionActiveRef.current = true;
				drawRef.current();
			}

			// Cache canvas rect for the drag to avoid getBoundingClientRect per mousemove
			const canvas = canvasRef.current;
			const cachedRect = canvas?.getBoundingClientRect();
			const cachedDpr = dprRef.current;
			// Capture original selection bounds for granular dragging
			const origRow = absRow;
			const origStartCol = anchorCol;
			const origEndCol = endCol;

			const cellAtCachedRect = (
				clientX: number,
				clientY: number,
			): { row: number; col: number } | null => {
				if (!cachedRect) return null;
				const { width: cellW, height: cellH } = cellMetrics.current;
				if (cellW === 0 || cellH === 0) return null;
				const s = gridRef.current;
				return cellFromRect(
					cachedRect,
					cachedDpr,
					clientX,
					clientY,
					cellW,
					cellH,
					s ? s.cols - 1 : 0,
					s ? s.totalRows - 1 : 0,
				);
			};

			const onMove = (ev: MouseEvent) => {
				const cell = cellAtCachedRect(ev.clientX, ev.clientY);
				if (!cell) return;
				const snap = gridRef.current;
				if (!snap) return;
				const moveAbsRow = toAbsoluteRow(snap, cell.row);

				if (streak === CLICK_LINE) {
					// Line-granularity drag
					if (moveAbsRow >= origRow) {
						selectionAnchorRef.current = { row: origRow, col: 0 };
						selectionEndRef.current = { row: moveAbsRow, col: snap.cols - 1 };
					} else {
						selectionAnchorRef.current = { row: origRow, col: snap.cols - 1 };
						selectionEndRef.current = { row: moveAbsRow, col: 0 };
					}
				} else if (streak === CLICK_WORD) {
					// Word-granularity drag
					const bounds = findWordBounds(snap.rows, cell.row, cell.col, snap.cols);
					const isAfter =
						moveAbsRow > origRow || (moveAbsRow === origRow && bounds.endCol >= origEndCol);
					if (isAfter) {
						selectionAnchorRef.current = { row: origRow, col: origStartCol };
						selectionEndRef.current = { row: moveAbsRow, col: bounds.endCol };
					} else {
						selectionAnchorRef.current = { row: origRow, col: origEndCol };
						selectionEndRef.current = { row: moveAbsRow, col: bounds.startCol };
					}
				} else {
					// Char-granularity drag
					selectionEndRef.current = { row: moveAbsRow, col: cell.col };
				}
				selectionActiveRef.current = true;

				// RAF-throttle: coalesce rapid mousemove into one redraw per frame
				if (selectionRafRef.current === 0) {
					selectionRafRef.current = requestAnimationFrame(() => {
						selectionRafRef.current = 0;
						drawRef.current();
					});
				}
			};

			const onUp = () => {
				window.removeEventListener("mousemove", onMove);
				window.removeEventListener("mouseup", onUp);
				dragListenersRef.current = null;
				if (selectionRafRef.current) {
					cancelAnimationFrame(selectionRafRef.current);
					selectionRafRef.current = 0;
				}
				// Final redraw to ensure highlight matches the last mouse position
				drawRef.current();
			};

			// Clean up any previous drag listeners (defensive)
			const prev = dragListenersRef.current;
			if (prev) {
				window.removeEventListener("mousemove", prev.move);
				window.removeEventListener("mouseup", prev.up);
			}

			dragListenersRef.current = { move: onMove, up: onUp };
			window.addEventListener("mousemove", onMove);
			window.addEventListener("mouseup", onUp);
		},
		[cellAtPixel],
	);

	return (
		// biome-ignore lint/a11y/useSemanticElements: canvas terminal cannot be a native textarea
		<div
			ref={containerRef}
			className="relative h-full w-full overflow-hidden outline-none"
			tabIndex={0}
			role="textbox"
			aria-label="Terminal"
			onKeyDown={handleKeyDown}
			onPaste={handlePaste}
			onMouseDown={handleMouseDown}
		>
			<canvas ref={canvasRef} className="block" />
		</div>
	);
}
