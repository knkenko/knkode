import { useCallback, useEffect, useRef } from "react";
import { keyEventToAnsi } from "../lib/key-to-ansi";
import type { CellSnapshot, GridSnapshot } from "../shared/types";
import {
	DEFAULT_BACKGROUND,
	DEFAULT_CURSOR_COLOR,
	DEFAULT_FONT_FAMILY,
	DEFAULT_FONT_SIZE,
	DEFAULT_LINE_HEIGHT,
} from "../shared/types";

export interface CanvasTerminalProps {
	readonly grid: GridSnapshot | null;
	readonly onWrite: (data: string) => void;
	readonly onResize: (cols: number, rows: number) => void;
	readonly fontSize?: number;
	readonly fontFamily?: string;
	readonly lineHeight?: number;
	readonly cursorColor?: string;
	readonly background?: string;
}

const CURSOR_BLINK_MS = 530;
const CURSOR_OPACITY = 0.7;
const RESIZE_DEBOUNCE_MS = 100;

/** Build a CSS font string for a cell's style attributes. */
function buildFont(
	cell: CellSnapshot,
	scaledSize: number,
	fontFamily: string,
): string {
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

/** Draw a single terminal cell (background, text, decorations). */
function drawCell(
	ctx: CanvasRenderingContext2D,
	cell: CellSnapshot,
	x: number,
	y: number,
	cellW: number,
	cellH: number,
	scaledSize: number,
	fontFamily: string,
	background: string,
) {
	// Background
	if (cell.bg !== background) {
		ctx.fillStyle = cell.bg;
		ctx.fillRect(x, y, cellW, cellH);
	}

	// Text
	if (cell.text.trim()) {
		ctx.font = buildFont(cell, scaledSize, fontFamily);
		ctx.fillStyle = cell.fg;
		const textY = y + (cellH - scaledSize) / 2;
		ctx.fillText(cell.text, x, textY);
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
	fontSize = DEFAULT_FONT_SIZE,
	fontFamily = DEFAULT_FONT_FAMILY,
	lineHeight = DEFAULT_LINE_HEIGHT,
	cursorColor = DEFAULT_CURSOR_COLOR,
	background = DEFAULT_BACKGROUND,
}: CanvasTerminalProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const cellMetrics = useRef({ width: 0, height: 0 });
	const cursorVisible = useRef(true);
	const blinkTimer = useRef<ReturnType<typeof setInterval>>(null);
	const gridRef = useRef<GridSnapshot | null>(null);
	const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
	const dprRef = useRef(window.devicePixelRatio || 1);
	const onResizeRef = useRef(onResize);
	const resizeTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

	// Keep refs in sync
	gridRef.current = grid;
	onResizeRef.current = onResize;

	// Measure cell width from monospace glyph; height is fontSize * lineHeight
	const measureCell = useCallback(() => {
		const ctx = ctxRef.current;
		if (!ctx) return;

		const dpr = dprRef.current;
		const scaledSize = fontSize * dpr;
		ctx.font = `${scaledSize}px ${fontFamily}`;
		const metrics = ctx.measureText("M");
		cellMetrics.current = {
			width: metrics.width,
			height: fontSize * lineHeight * dpr,
		};
	}, [fontSize, fontFamily, lineHeight]);

	// Draw the full grid
	const draw = useCallback(() => {
		const canvas = canvasRef.current;
		const snap = gridRef.current;
		const ctx = ctxRef.current;
		if (!canvas || !snap || !ctx) return;

		const dpr = dprRef.current;
		const scaledSize = fontSize * dpr;
		const { width: cellW, height: cellH } = cellMetrics.current;
		if (cellW === 0 || cellH === 0) return;

		// Clear
		ctx.fillStyle = background;
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Set shared state once before the cell loop
		ctx.textBaseline = "top";
		ctx.lineWidth = dpr;

		// Draw cells
		for (let row = 0; row < snap.rows.length; row++) {
			const rowCells = snap.rows[row];
			if (!rowCells) continue;
			for (let col = 0; col < rowCells.length; col++) {
				const cell = rowCells[col];
				if (!cell) continue;
				const x = col * cellW;
				const y = row * cellH;

				drawCell(ctx, cell, x, y, cellW, cellH, scaledSize, fontFamily, background);
			}
		}

		// Draw cursor
		if (snap.cursorVisible && cursorVisible.current) {
			const cx = snap.cursorCol * cellW;
			const cy = snap.cursorRow * cellH;

			ctx.fillStyle = cursorColor;
			ctx.globalAlpha = CURSOR_OPACITY;
			ctx.fillRect(cx, cy, cellW, cellH);
			ctx.globalAlpha = 1.0;

			// Redraw cursor cell text on top so it's visible
			const cursorRow = snap.rows[snap.cursorRow];
			const cursorCell = cursorRow?.[snap.cursorCol];
			if (cursorCell?.text.trim()) {
				ctx.font = buildFont(cursorCell, scaledSize, fontFamily);
				ctx.fillStyle = background;
				const textY = cy + (cellH - scaledSize) / 2;
				ctx.fillText(cursorCell.text, cx, textY);
			}
		}
	}, [background, cursorColor, fontSize, fontFamily, lineHeight]);

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
			}, RESIZE_DEBOUNCE_MS);
		});

		observer.observe(container);
		return () => {
			observer.disconnect();
			if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
		};
	}, [measureCell]);

	// Redraw when grid changes
	useEffect(() => {
		draw();
	}, [grid, draw]);

	// Cursor blink — restart timer on grid change so cursor stays visible after keystroke
	useEffect(() => {
		cursorVisible.current = true;
		if (blinkTimer.current) clearInterval(blinkTimer.current);
		blinkTimer.current = setInterval(() => {
			cursorVisible.current = !cursorVisible.current;
			// Only repaint the cursor cell instead of the full grid
			const canvas = canvasRef.current;
			const snap = gridRef.current;
			const ctx = ctxRef.current;
			if (!canvas || !snap || !ctx) return;
			const { width: cellW, height: cellH } = cellMetrics.current;
			if (cellW === 0 || cellH === 0) return;

			const dpr = dprRef.current;
			const scaledSize = fontSize * dpr;
			const cx = snap.cursorCol * cellW;
			const cy = snap.cursorRow * cellH;

			// Redraw cursor cell background
			const cursorRow = snap.rows[snap.cursorRow];
			const cursorCell = cursorRow?.[snap.cursorCol];

			ctx.textBaseline = "top";
			ctx.lineWidth = dpr;

			// Clear cursor rect with cell or terminal background
			ctx.fillStyle = cursorCell && cursorCell.bg !== background ? cursorCell.bg : background;
			ctx.fillRect(cx, cy, cellW, cellH);

			// Redraw cell content
			if (cursorCell) {
				if (cursorCell.text.trim()) {
					ctx.font = buildFont(cursorCell, scaledSize, fontFamily);
					ctx.fillStyle = cursorCell.fg;
					const textY = cy + (cellH - scaledSize) / 2;
					ctx.fillText(cursorCell.text, cx, textY);
				}
				if (cursorCell.underline) {
					drawHLine(ctx, cursorCell.fg, dpr, cx, cy + cellH - dpr, cellW);
				}
				if (cursorCell.strikethrough) {
					drawHLine(ctx, cursorCell.fg, dpr, cx, cy + cellH / 2, cellW);
				}
			}

			// Draw cursor overlay if visible
			if (snap.cursorVisible && cursorVisible.current) {
				ctx.fillStyle = cursorColor;
				ctx.globalAlpha = CURSOR_OPACITY;
				ctx.fillRect(cx, cy, cellW, cellH);
				ctx.globalAlpha = 1.0;

				if (cursorCell?.text.trim()) {
					ctx.font = buildFont(cursorCell, scaledSize, fontFamily);
					ctx.fillStyle = background;
					const textY = cy + (cellH - scaledSize) / 2;
					ctx.fillText(cursorCell.text, cx, textY);
				}
			}
		}, CURSOR_BLINK_MS);
		return () => {
			if (blinkTimer.current) clearInterval(blinkTimer.current);
		};
	}, [grid, fontSize, fontFamily, background, cursorColor]);

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
		<div
			ref={containerRef}
			className="relative h-full w-full overflow-hidden outline-none"
			tabIndex={0}
			role="textbox"
			aria-label="Terminal"
			onKeyDown={handleKeyDown}
			/* Dynamic theme color — cannot use Tailwind class */
			style={{ background }}
		>
			<canvas ref={canvasRef} className="block" />
		</div>
	);
}
