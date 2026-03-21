import { useCallback, useEffect, useRef, useState } from "react";
import { type DropZone, getDropZone } from "../lib/pane-drag-utils";
import { DRAG_THRESHOLD, suppressNextClick } from "../lib/ui-constants";
import { useStore } from "../store";

const MOUSE_BUTTON_RIGHT = 2;

/** Custom event name for pane drag hover coordination between source and targets. */
const PANE_DRAG_HOVER = "knkode:pane-drag-hover";
const PANE_DRAG_END = "knkode:pane-drag-end";

interface PaneDragHoverDetail {
	targetPaneId: string;
	zone: DropZone;
}

interface UsePaneDragDropOptions {
	paneId: string;
	workspaceId: string;
	onFocus: (paneId: string) => void;
}

export function usePaneDragDrop({ paneId, workspaceId, onFocus }: UsePaneDragDropOptions) {
	const [isDragging, setIsDragging] = useState(false);
	const [dropZone, setDropZone] = useState<DropZone | null>(null);
	const outerRef = useRef<HTMLDivElement>(null);
	const cleanupRef = useRef<(() => void) | null>(null);

	const swapPanes = useStore((s) => s.swapPanes);
	const movePaneToPosition = useStore((s) => s.movePaneToPosition);

	// Stable refs for store actions so document listeners don't go stale
	const swapRef = useRef(swapPanes);
	swapRef.current = swapPanes;
	const moveRef = useRef(movePaneToPosition);
	moveRef.current = movePaneToPosition;

	// Listen for hover events from OTHER panes' drag sources to show drop zone overlay
	useEffect(() => {
		const handleHover = (e: Event) => {
			const detail = (e as CustomEvent<PaneDragHoverDetail>).detail;
			if (detail.targetPaneId === paneId) {
				setDropZone(detail.zone);
			} else {
				setDropZone(null);
			}
		};
		const handleEnd = () => {
			setDropZone(null);
		};
		document.addEventListener(PANE_DRAG_HOVER, handleHover);
		document.addEventListener(PANE_DRAG_END, handleEnd);
		return () => {
			document.removeEventListener(PANE_DRAG_HOVER, handleHover);
			document.removeEventListener(PANE_DRAG_END, handleEnd);
		};
	}, [paneId]);

	const handleHeaderPointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			// Right-click is for context menu
			if (e.button === MOUSE_BUTTON_RIGHT) return;
			if (e.button !== 0) return;
			onFocus(paneId);

			const startX = e.clientX;
			const startY = e.clientY;
			let dragging = false;
			let targetPaneId: string | null = null;
			let targetZone: DropZone | null = null;

			const handleMove = (me: PointerEvent) => {
				if (!dragging) {
					if (Math.abs(me.clientX - startX) + Math.abs(me.clientY - startY) < DRAG_THRESHOLD)
						return;
					dragging = true;
					setIsDragging(true);
				}

				// Hit-test: find which pane element is under cursor
				const els = document.elementsFromPoint(me.clientX, me.clientY);
				const paneEl = els.find((el) => el.hasAttribute("data-pane-id")) as HTMLElement | undefined;

				if (paneEl) {
					const tid = paneEl.getAttribute("data-pane-id")!;
					const zone = getDropZone(me.clientX, me.clientY, paneEl);
					targetPaneId = tid;
					targetZone = zone;
					document.dispatchEvent(
						new CustomEvent<PaneDragHoverDetail>(PANE_DRAG_HOVER, {
							detail: { targetPaneId: tid, zone },
						}),
					);
				} else {
					targetPaneId = null;
					targetZone = null;
					// Clear hover state on all panes
					document.dispatchEvent(
						new CustomEvent<PaneDragHoverDetail>(PANE_DRAG_HOVER, {
							detail: { targetPaneId: "", zone: "center" },
						}),
					);
				}
			};

			const handleUp = () => {
				document.removeEventListener("pointermove", handleMove);
				document.removeEventListener("pointerup", handleUp);
				cleanupRef.current = null;

				if (dragging) {
					if (targetPaneId && targetZone && targetPaneId !== paneId) {
						if (targetZone === "center") {
							swapRef.current(workspaceId, paneId, targetPaneId);
						} else {
							moveRef.current(workspaceId, paneId, targetPaneId, targetZone);
						}
					}
					// Suppress click after drag
					suppressNextClick();
				}

				setIsDragging(false);
				document.dispatchEvent(new CustomEvent(PANE_DRAG_END));
			};

			// Clean up any stale listeners
			cleanupRef.current?.();

			document.addEventListener("pointermove", handleMove);
			document.addEventListener("pointerup", handleUp);
			cleanupRef.current = () => {
				document.removeEventListener("pointermove", handleMove);
				document.removeEventListener("pointerup", handleUp);
			};
		},
		[paneId, workspaceId, onFocus],
	);

	// Cleanup on unmount
	useEffect(() => () => cleanupRef.current?.(), []);

	return {
		isDragging,
		dropZone,
		outerRef,
		handleHeaderPointerDown,
	};
}
