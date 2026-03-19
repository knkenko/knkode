import { useCallback, useEffect, useRef } from "react";
import { DEFAULT_FONT_FAMILY } from "../data/theme-presets";
import { keyEventToAnsi } from "../lib/key-to-ansi";
import type { CellSnapshot, GridSnapshot } from "../shared/types";
import {
	DEFAULT_BACKGROUND,
	DEFAULT_CURSOR_COLOR,
	DEFAULT_FONT_SIZE,
	DEFAULT_LINE_HEIGHT,
} from "../shared/types";

export interface CanvasTerminalProps {
	readonly grid: GridSnapshot | null;
	readonly onWrite: (data: string) => void;
	readonly onResize: (cols: number, rows: number) => void;
	/** Scroll delta in lines: positive = scroll up (into scrollback), negative = toward bottom. */
	readonly onScroll: (deltaLines: number) => void;
	readonly fontSize?: number | undefined;
	readonly fontFamily?: string | undefined;
	readonly lineHeight?: number | undefined;
	readonly cursorColor?: string | undefined;
	readonly background?: string | undefined;
	readonly isFocused?: boolean | undefined;
}

/** Smooth cursor blink — full cycle duration (fade out → fade in). */
const CURSOR_BLINK_PERIOD_MS = 1200;
/** Hold cursor at full opacity after keystroke before fading starts. */
const CURSOR_HOLD_MS = 500;
const CURSOR_MAX_OPACITY = 0.7;
const CURSOR_MIN_OPACITY = 0.0;
const CURSOR_STATIC_OPACITY = 0.5;
const RESIZE_DEBOUNCE_MS = 100;

interface CellMetrics {
	width: number;
	height: number;
	/** Distance from cell top to text baseline (for textBaseline = "alphabetic"). */
	baselineOffset: number;
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

export function CanvasTerminal({
	grid,
	onWrite,
	onResize,
	onScroll,
	fontSize = DEFAULT_FONT_SIZE,
	fontFamily = DEFAULT_FONT_FAMILY,
	lineHeight = DEFAULT_LINE_HEIGHT,
	cursorColor = DEFAULT_CURSOR_COLOR,
	background = DEFAULT_BACKGROUND,
	isFocused = true,
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
	const resizeTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
	const isFocusedRef = useRef(isFocused);

	// Keep refs in sync
	gridRef.current = grid;
	onResizeRef.current = onResize;
	onScrollRef.current = onScroll;
	isFocusedRef.current = isFocused;

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
			ctx.fillStyle = cursorColor;
			ctx.globalAlpha = cursorOpacity.current;
			ctx.fillRect(cx, cy, cellW, cellH);
			ctx.globalAlpha = 1.0;

			if (cursorCell?.text.trim()) {
				ctx.font = buildFont(cursorCell, scaledSize, fontFamily);
				ctx.fillStyle = background;
				ctx.globalAlpha = cursorOpacity.current / CURSOR_MAX_OPACITY;
				ctx.fillText(cursorCell.text, cx, cy + baselineOffset);
				ctx.globalAlpha = 1.0;
			}
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

		// Draw cursor
		if (snap.cursorVisible) {
			const cx = snap.cursorCol * cellW;
			const cy = snap.cursorRow * cellH;

			ctx.fillStyle = cursorColor;
			ctx.globalAlpha = cursorOpacity.current;
			ctx.fillRect(cx, cy, cellW, cellH);
			ctx.globalAlpha = 1.0;

			// Redraw cursor cell text on top so it's visible against cursor color
			const cursorRow = snap.rows[snap.cursorRow];
			const cursorCell = cursorRow?.[snap.cursorCol];
			if (cursorCell?.text.trim()) {
				ctx.font = buildFont(cursorCell, scaledSize, fontFamily);
				ctx.fillStyle = background;
				ctx.globalAlpha = cursorOpacity.current / CURSOR_MAX_OPACITY;
				ctx.fillText(cursorCell.text, cx, cy + baselineOffset);
				ctx.globalAlpha = 1.0;
			}
		}
	}, [background, cursorColor, fontSize, fontFamily, lineHeight]);

	// Keep draw ref in sync so the resize observer can trigger redraws
	// without being recreated when draw's dependencies change.
	const drawRef = useRef(draw);
	drawRef.current = draw;

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

	// Smooth cursor blink animation — only runs when focused
	// biome-ignore lint/correctness/useExhaustiveDependencies: repaintCursor reads from refs
	useEffect(() => {
		if (!isFocused) {
			// Static cursor when unfocused
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
				// Hold at full opacity after keystroke
				cursorOpacity.current = CURSOR_MAX_OPACITY;
			} else {
				// Smooth cosine wave: max → min → max over BLINK_PERIOD
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

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			const ansi = keyEventToAnsi(e.nativeEvent);
			if (ansi !== null) {
				e.preventDefault();
				onWrite(ansi);
			}
		},
		[onWrite],
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
		>
			<canvas ref={canvasRef} className="block" />
		</div>
	);
}
