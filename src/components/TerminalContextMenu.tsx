import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useClickOutside } from "../hooks/useClickOutside";
import { getPortalRoot, type ScreenPosition, VIEWPORT_MARGIN } from "../lib/ui-constants";
import type { CanvasTerminalHandle } from "./CanvasTerminal";

/** Form-feed control character — clears the terminal screen when written to PTY. */
const CLEAR_SCREEN = "\x0c";

interface TerminalContextMenuProps {
	anchorPos: ScreenPosition;
	hasSelection: boolean;
	terminalHandle: CanvasTerminalHandle;
	/** Write raw data to the PTY (used for Clear Terminal). */
	onWrite: (data: string) => void;
	onDismiss: () => void;
}

export function TerminalContextMenu({
	anchorPos,
	hasSelection,
	terminalHandle,
	onWrite,
	onDismiss,
}: TerminalContextMenuProps) {
	const [clampedPos, setClampedPos] = useState<ScreenPosition | null>(null);
	const ref = useRef<HTMLDivElement>(null);

	useClickOutside(ref, onDismiss, true);

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") onDismiss();
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [onDismiss]);

	useLayoutEffect(() => {
		const el = ref.current;
		if (!el) return;
		const clamp = () => {
			const { width, height } = el.getBoundingClientRect();
			setClampedPos({
				x: Math.max(
					VIEWPORT_MARGIN,
					Math.min(anchorPos.x, window.innerWidth - width - VIEWPORT_MARGIN),
				),
				y: Math.max(
					VIEWPORT_MARGIN,
					Math.min(anchorPos.y, window.innerHeight - height - VIEWPORT_MARGIN),
				),
			});
		};
		clamp();
		window.addEventListener("resize", clamp);
		return () => window.removeEventListener("resize", clamp);
	}, [anchorPos.x, anchorPos.y]);

	return createPortal(
		<div
			ref={ref}
			role="menu"
			className="ctx-menu"
			style={{
				position: "fixed",
				left: clampedPos?.x ?? 0,
				top: clampedPos?.y ?? 0,
				visibility: clampedPos ? "visible" : "hidden",
			}}
			onMouseDown={(e) => e.stopPropagation()}
		>
			<button
				type="button"
				className="ctx-item disabled:opacity-40 disabled:pointer-events-none"
				disabled={!hasSelection}
				onClick={() => {
					terminalHandle.copySelection();
					onDismiss();
				}}
			>
				Copy
			</button>
			<button
				type="button"
				className="ctx-item"
				onClick={() => {
					terminalHandle.pasteFromClipboard();
					onDismiss();
				}}
			>
				Paste
			</button>
			<div className="ctx-separator" />
			<button
				type="button"
				className="ctx-item"
				onClick={() => {
					terminalHandle.selectAll();
					onDismiss();
				}}
			>
				Select All
			</button>
			<button
				type="button"
				className="ctx-item"
				onClick={() => {
					onWrite(CLEAR_SCREEN);
					onDismiss();
				}}
			>
				Clear Terminal
			</button>
		</div>,
		getPortalRoot(),
	);
}
