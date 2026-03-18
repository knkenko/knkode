import { useCallback, useEffect, useRef } from "react";
import { keyEventToAnsi } from "../lib/key-to-ansi";
import type { CellSnapshot, GridSnapshot } from "../shared/types";
import { DEFAULT_FONT_SIZE, DEFAULT_LINE_HEIGHT } from "../shared/types";

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

const DEFAULT_FONT_FAMILY = "Menlo, Monaco, 'Courier New', monospace";
const CURSOR_BLINK_MS = 530;

export function CanvasTerminal({
	grid,
	onWrite,
	onResize,
	fontSize = DEFAULT_FONT_SIZE,
	fontFamily = DEFAULT_FONT_FAMILY,
	lineHeight = DEFAULT_LINE_HEIGHT,
	cursorColor,
	background = "#1e1e1e",
}: CanvasTerminalProps) {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const cellMetrics = useRef({ width: 0, height: 0 });
	const cursorVisible = useRef(true);
	const blinkTimer = useRef<ReturnType<typeof setInterval>>(null);
	const gridRef = useRef<GridSnapshot | null>(null);

	// Keep grid ref in sync for blink redraws
	gridRef.current = grid;

	// Measure cell dimensions from a monospace character
	const measureCell = useCallback(() => {
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		ctx.font = `${fontSize * dpr}px ${fontFamily}`;
		const metrics = ctx.measureText("M");
		cellMetrics.current = {
			width: metrics.width,
			height: fontSize * lineHeight * dpr,
		};
	}, [fontSize, fontFamily, lineHeight]);

	// Draw the full grid
	const draw = useCallback(() => {
		const canvas = canvasRef.current;
		const g = gridRef.current;
		if (!canvas || !g) return;

		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		const dpr = window.devicePixelRatio || 1;
		const { width: cellW, height: cellH } = cellMetrics.current;
		if (cellW === 0 || cellH === 0) return;

		// Clear
		ctx.fillStyle = background;
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Draw cells
		for (let row = 0; row < g.rows.length; row++) {
			const rowCells = g.rows[row];
			if (!rowCells) continue;
			for (let col = 0; col < rowCells.length; col++) {
				const cell = rowCells[col];
				if (!cell) continue;
				const x = col * cellW;
				const y = row * cellH;

				drawCell(ctx, cell, x, y, cellW, cellH, dpr);
			}
		}

		// Draw cursor
		if (g.cursorVisible && cursorVisible.current) {
			const cx = g.cursorCol * cellW;
			const cy = g.cursorRow * cellH;
			const color = cursorColor ?? "#c0c0c0";

			ctx.fillStyle = color;
			ctx.globalAlpha = 0.7;
			ctx.fillRect(cx, cy, cellW, cellH);
			ctx.globalAlpha = 1.0;

			// Redraw cursor cell text on top so it's visible
			const cursorRow = g.rows[g.cursorRow];
			const cursorCell = cursorRow?.[g.cursorCol];
			if (cursorCell?.text.trim()) {
				ctx.font = buildFont(cursorCell, dpr);
				ctx.fillStyle = background;
				ctx.textBaseline = "top";
				const textY = cy + (cellH - fontSize * dpr) / 2;
				ctx.fillText(cursorCell.text, cx, textY);
			}
		}
	}, [background, cursorColor, fontSize, fontFamily]);

	function drawCell(
		ctx: CanvasRenderingContext2D,
		cell: CellSnapshot,
		x: number,
		y: number,
		cellW: number,
		cellH: number,
		dpr: number,
	) {
		// Background
		if (cell.bg !== background) {
			ctx.fillStyle = cell.bg;
			ctx.fillRect(x, y, cellW, cellH);
		}

		// Text
		if (cell.text.trim()) {
			ctx.font = buildFont(cell, dpr);
			ctx.fillStyle = cell.fg;
			ctx.textBaseline = "top";
			const textY = y + (cellH - fontSize * dpr) / 2;
			ctx.fillText(cell.text, x, textY);
		}

		// Underline
		if (cell.underline) {
			ctx.strokeStyle = cell.fg;
			ctx.lineWidth = dpr;
			const underlineY = y + cellH - dpr;
			ctx.beginPath();
			ctx.moveTo(x, underlineY);
			ctx.lineTo(x + cellW, underlineY);
			ctx.stroke();
		}

		// Strikethrough
		if (cell.strikethrough) {
			ctx.strokeStyle = cell.fg;
			ctx.lineWidth = dpr;
			const strikeY = y + cellH / 2;
			ctx.beginPath();
			ctx.moveTo(x, strikeY);
			ctx.lineTo(x + cellW, strikeY);
			ctx.stroke();
		}
	}

	function buildFont(cell: CellSnapshot, dpr: number): string {
		const style = cell.italic ? "italic " : "";
		const weight = cell.bold ? "bold " : "";
		return `${style}${weight}${fontSize * dpr}px ${fontFamily}`;
	}

	// Handle resize: compute cols/rows from container dimensions
	useEffect(() => {
		const container = containerRef.current;
		const canvas = canvasRef.current;
		if (!container || !canvas) return;

		const observer = new ResizeObserver(() => {
			const dpr = window.devicePixelRatio || 1;
			const rect = container.getBoundingClientRect();
			const w = Math.floor(rect.width * dpr);
			const h = Math.floor(rect.height * dpr);

			canvas.width = w;
			canvas.height = h;
			canvas.style.width = `${rect.width}px`;
			canvas.style.height = `${rect.height}px`;

			measureCell();

			const { width: cellW, height: cellH } = cellMetrics.current;
			if (cellW > 0 && cellH > 0) {
				const cols = Math.floor(w / cellW);
				const rows = Math.floor(h / cellH);
				if (cols > 0 && rows > 0) {
					onResize(cols, rows);
				}
			}
		});

		observer.observe(container);
		return () => observer.disconnect();
	}, [measureCell, onResize]);

	// Redraw when grid changes
	useEffect(() => {
		draw();
	}, [grid, draw]);

	// Cursor blink
	useEffect(() => {
		blinkTimer.current = setInterval(() => {
			cursorVisible.current = !cursorVisible.current;
			draw();
		}, CURSOR_BLINK_MS);
		return () => {
			if (blinkTimer.current) clearInterval(blinkTimer.current);
		};
	}, [draw]);

	// Reset cursor blink on new grid (keystroke resets blink to visible)
	useEffect(() => {
		cursorVisible.current = true;
	}, [grid]);

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
			onKeyDown={handleKeyDown}
			style={{ background }}
		>
			<canvas ref={canvasRef} className="block" />
		</div>
	);
}
