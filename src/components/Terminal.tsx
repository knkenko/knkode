import { useCallback, useEffect, useRef } from "react";
import { useTerminalStore } from "../store/terminal";
import type { CellGrid, TermColor } from "../types/terminal";

const FONT_FAMILY = '"JetBrains Mono", "Fira Code", "Cascadia Code", "SF Mono", "Menlo", monospace';
const FONT_SIZE = 14;
const LINE_HEIGHT = 1.2;

function colorToCSS(c: TermColor): string {
	return `rgb(${c.r},${c.g},${c.b})`;
}

function measureCell(ctx: CanvasRenderingContext2D): { width: number; height: number } {
	ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
	const metrics = ctx.measureText("M");
	const width = metrics.width;
	const height = FONT_SIZE * LINE_HEIGHT;
	return { width, height };
}

function renderGrid(
	ctx: CanvasRenderingContext2D,
	grid: CellGrid,
	cellWidth: number,
	cellHeight: number,
	dpr: number,
) {
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.font = `${FONT_SIZE}px ${FONT_FAMILY}`;
	ctx.textBaseline = "top";

	const textOffsetY = (cellHeight - FONT_SIZE) / 2;

	for (let row = 0; row < grid.rows; row++) {
		const rowData = grid.cells[row];
		if (!rowData) continue;

		for (let col = 0; col < grid.cols; col++) {
			const cell = rowData[col];
			if (!cell) continue;

			const x = col * cellWidth;
			const y = row * cellHeight;

			// Background
			ctx.fillStyle = colorToCSS(cell.bg);
			ctx.fillRect(x, y, cellWidth, cellHeight);

			// Foreground text
			if (cell.c !== " " && cell.c !== "") {
				ctx.fillStyle = colorToCSS(cell.fg);
				ctx.fillText(cell.c, x, y + textOffsetY);
			}
		}
	}

	// Cursor
	if (grid.cursor.visible) {
		const cx = grid.cursor.col * cellWidth;
		const cy = grid.cursor.line * cellHeight;
		ctx.fillStyle = "rgba(197, 200, 198, 0.6)";
		ctx.fillRect(cx, cy, cellWidth, cellHeight);
	}
}

export default function Terminal() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const cellDimsRef = useRef<{ width: number; height: number } | null>(null);
	const rafRef = useRef<number>(0);

	const grid = useTerminalStore((s) => s.grid);
	const writeToTerminal = useTerminalStore((s) => s.writeToTerminal);
	const resizeTerminal = useTerminalStore((s) => s.resizeTerminal);

	// Measure cell dimensions once
	const getCellDims = useCallback(() => {
		if (cellDimsRef.current) return cellDimsRef.current;
		const canvas = canvasRef.current;
		if (!canvas) return { width: 8, height: 17 };
		const ctx = canvas.getContext("2d");
		if (!ctx) return { width: 8, height: 17 };
		cellDimsRef.current = measureCell(ctx);
		return cellDimsRef.current;
	}, []);

	// Render canvas when grid changes
	useEffect(() => {
		if (!grid) return;
		const canvas = canvasRef.current;
		if (!canvas) return;
		const ctx = canvas.getContext("2d");
		if (!ctx) return;

		cancelAnimationFrame(rafRef.current);
		rafRef.current = requestAnimationFrame(() => {
			const { width: cellWidth, height: cellHeight } = getCellDims();
			const dpr = window.devicePixelRatio || 1;

			const canvasWidth = grid.cols * cellWidth;
			const canvasHeight = grid.rows * cellHeight;

			canvas.width = canvasWidth * dpr;
			canvas.height = canvasHeight * dpr;
			canvas.style.width = `${canvasWidth}px`;
			canvas.style.height = `${canvasHeight}px`;

			renderGrid(ctx, grid, cellWidth, cellHeight, dpr);
		});
	}, [grid, getCellDims]);

	// Handle resize
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		const observer = new ResizeObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;

			const { width: cellWidth, height: cellHeight } = getCellDims();
			const cols = Math.floor(entry.contentRect.width / cellWidth);
			const rows = Math.floor(entry.contentRect.height / cellHeight);

			if (cols > 0 && rows > 0) {
				resizeTerminal(cols, rows);
			}
		});

		observer.observe(container);
		return () => observer.disconnect();
	}, [getCellDims, resizeTerminal]);

	// Handle keyboard input
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLDivElement>) => {
			e.preventDefault();

			let data = "";

			if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
				data = e.key;
			} else if (e.ctrlKey && e.key.length === 1) {
				// Ctrl+letter → control character
				const code = e.key.toLowerCase().charCodeAt(0) - 96;
				if (code > 0 && code < 27) {
					data = String.fromCharCode(code);
				}
			} else {
				switch (e.key) {
					case "Enter":
						data = "\r";
						break;
					case "Backspace":
						data = "\x7f";
						break;
					case "Tab":
						data = "\t";
						break;
					case "Escape":
						data = "\x1b";
						break;
					case "ArrowUp":
						data = "\x1b[A";
						break;
					case "ArrowDown":
						data = "\x1b[B";
						break;
					case "ArrowRight":
						data = "\x1b[C";
						break;
					case "ArrowLeft":
						data = "\x1b[D";
						break;
					case "Home":
						data = "\x1b[H";
						break;
					case "End":
						data = "\x1b[F";
						break;
					case "Delete":
						data = "\x1b[3~";
						break;
					case "PageUp":
						data = "\x1b[5~";
						break;
					case "PageDown":
						data = "\x1b[6~";
						break;
				}
			}

			if (data) {
				writeToTerminal(data);
			}
		},
		[writeToTerminal],
	);

	return (
		<div
			ref={containerRef}
			role="application"
			aria-label="Terminal"
			className="h-full w-full overflow-hidden bg-[#1d1f21] focus:outline-none"
			onKeyDown={handleKeyDown}
			tabIndex={0}
		>
			<canvas ref={canvasRef} />
		</div>
	);
}
