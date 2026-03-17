import { useCallback, useEffect, useRef } from "react";
import { useTerminalStore } from "../store/terminal";
import type { CellGrid, TermColor } from "../types/terminal";

const FONT_FAMILY = '"JetBrains Mono", "Fira Code", "Cascadia Code", "SF Mono", "Menlo", monospace';
const FONT_SIZE = 14;
const LINE_HEIGHT = 1.2;
const FONT = `${FONT_SIZE}px ${FONT_FAMILY}`;
const CURSOR_COLOR = "rgba(197, 200, 198, 0.6)";
const DEFAULT_CELL_DIMS = { width: 8, height: 17 };
const RESIZE_DEBOUNCE_MS = 100;

const SPECIAL_KEY_MAP: Record<string, string> = {
	Enter: "\r",
	Backspace: "\x7f",
	Tab: "\t",
	Escape: "\x1b",
	ArrowUp: "\x1b[A",
	ArrowDown: "\x1b[B",
	ArrowRight: "\x1b[C",
	ArrowLeft: "\x1b[D",
	Home: "\x1b[H",
	End: "\x1b[F",
	Delete: "\x1b[3~",
	PageUp: "\x1b[5~",
	PageDown: "\x1b[6~",
};

function colorToCSS(c: TermColor): string {
	return `rgb(${c.r},${c.g},${c.b})`;
}

function measureCell(ctx: CanvasRenderingContext2D): { width: number; height: number } {
	ctx.font = FONT;
	return { width: ctx.measureText("M").width, height: FONT_SIZE * LINE_HEIGHT };
}

function renderGrid(
	ctx: CanvasRenderingContext2D,
	grid: CellGrid,
	cellWidth: number,
	cellHeight: number,
	dpr: number,
) {
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	ctx.font = FONT;
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

			ctx.fillStyle = colorToCSS(cell.bg);
			ctx.fillRect(x, y, cellWidth, cellHeight);

			if (cell.c !== " " && cell.c !== "") {
				ctx.fillStyle = colorToCSS(cell.fg);
				ctx.fillText(cell.c, x, y + textOffsetY);
			}
		}
	}

	if (grid.cursor.visible) {
		const cx = grid.cursor.col * cellWidth;
		const cy = grid.cursor.line * cellHeight;
		ctx.fillStyle = CURSOR_COLOR;
		ctx.fillRect(cx, cy, cellWidth, cellHeight);
	}
}

export default function Terminal() {
	const canvasRef = useRef<HTMLCanvasElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const cellDimsRef = useRef<{ width: number; height: number } | null>(null);
	const rafRef = useRef<number | null>(null);
	const prevDimsRef = useRef<{ cols: number; rows: number } | null>(null);

	const grid = useTerminalStore((s) => s.grid);
	const writeToTerminal = useTerminalStore((s) => s.writeToTerminal);
	const resizeTerminal = useTerminalStore((s) => s.resizeTerminal);

	// Lazily measure and cache cell dimensions for this mount
	const getCellDims = useCallback(() => {
		if (cellDimsRef.current) return cellDimsRef.current;
		const canvas = canvasRef.current;
		if (!canvas) return DEFAULT_CELL_DIMS;
		const ctx = canvas.getContext("2d");
		if (!ctx) return DEFAULT_CELL_DIMS;
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

		if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
		rafRef.current = requestAnimationFrame(() => {
			rafRef.current = null;
			const { width: cellWidth, height: cellHeight } = getCellDims();
			const dpr = window.devicePixelRatio ?? 1;

			const canvasWidth = grid.cols * cellWidth;
			const canvasHeight = grid.rows * cellHeight;

			if (prevDimsRef.current?.cols !== grid.cols || prevDimsRef.current?.rows !== grid.rows) {
				canvas.width = canvasWidth * dpr;
				canvas.height = canvasHeight * dpr;
				canvas.style.width = `${canvasWidth}px`;
				canvas.style.height = `${canvasHeight}px`;
				prevDimsRef.current = { cols: grid.cols, rows: grid.rows };
			}

			renderGrid(ctx, grid, cellWidth, cellHeight, dpr);
		});

		return () => {
			if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
		};
	}, [grid, getCellDims]);

	// Handle resize with debounce
	useEffect(() => {
		const container = containerRef.current;
		if (!container) return;

		let resizeTimeout: ReturnType<typeof setTimeout>;
		const observer = new ResizeObserver((entries) => {
			clearTimeout(resizeTimeout);
			resizeTimeout = setTimeout(() => {
				const entry = entries[0];
				if (!entry) return;

				const { width: cellWidth, height: cellHeight } = getCellDims();
				const cols = Math.floor(entry.contentRect.width / cellWidth);
				const rows = Math.floor(entry.contentRect.height / cellHeight);

				if (cols > 0 && rows > 0) {
					resizeTerminal(cols, rows);
				}
			}, RESIZE_DEBOUNCE_MS);
		});

		observer.observe(container);
		return () => {
			clearTimeout(resizeTimeout);
			observer.disconnect();
		};
	}, [getCellDims, resizeTerminal]);

	// Handle keyboard input
	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLDivElement>) => {
			let data = "";

			if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
				data = e.key;
			} else if (e.ctrlKey && e.key.length === 1) {
				// ASCII 'a' is 97; subtracting 96 maps a-z to control codes 1-26 (Ctrl-A through Ctrl-Z)
				const code = e.key.toLowerCase().charCodeAt(0) - 96;
				if (code > 0 && code < 27) {
					data = String.fromCharCode(code);
				}
			} else {
				data = SPECIAL_KEY_MAP[e.key] ?? "";
			}

			if (data) {
				e.preventDefault();
				writeToTerminal(data);
			}
		},
		[writeToTerminal],
	);

	const handlePaste = useCallback(
		(e: React.ClipboardEvent<HTMLDivElement>) => {
			const text = e.clipboardData.getData("text/plain");
			if (text) {
				e.preventDefault();
				writeToTerminal(text);
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
			onPaste={handlePaste}
			tabIndex={0}
		>
			<canvas ref={canvasRef} />
		</div>
	);
}
