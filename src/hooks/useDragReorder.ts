import { useCallback, useEffect, useRef, useState } from "react";
import { DRAG_THRESHOLD, suppressNextClick } from "../lib/ui-constants";

interface UseDragReorderOptions {
	onReorder: (fromIndex: number, toIndex: number) => void;
	/** Selector to find the container of draggable items. Default: '[role="tablist"]' */
	containerSelector?: string;
	/** Selector to find individual items within the container. Default: '[role="tab"]' */
	itemSelector?: string;
}

/**
 * Pointer-event based drag reorder for tab-like elements.
 * Replaces HTML5 DnD which doesn't fire drop events in WKWebView (Electron/macOS).
 *
 * Hit-testing uses `getBoundingClientRect` on each item to find the target.
 */
export function useDragReorder({
	onReorder,
	containerSelector = '[role="tablist"]',
	itemSelector = '[role="tab"]',
}: UseDragReorderOptions) {
	const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

	// All mutable drag state lives in a single ref to avoid stale closures
	// in the document-level listeners.
	const stateRef = useRef({
		from: null as number | null,
		over: null as number | null,
		dragging: false,
		startX: 0,
		startY: 0,
	});
	// Stable ref for the callback so document listeners always see the latest version
	const onReorderRef = useRef(onReorder);
	onReorderRef.current = onReorder;

	// Refs for the setState functions so document listeners can update React state
	const setFromRef = useRef(setDragFromIndex);
	setFromRef.current = setDragFromIndex;
	const setOverRef = useRef(setDragOverIndex);
	setOverRef.current = setDragOverIndex;

	const cleanupRef = useRef<(() => void) | null>(null);

	const handlePointerDown = useCallback(
		(e: React.PointerEvent, index: number) => {
			if (e.button !== 0) return; // Left button only

			const s = stateRef.current;
			s.from = index;
			s.over = null;
			s.dragging = false;
			s.startX = e.clientX;
			s.startY = e.clientY;

			// Capture container ref at pointerdown time — the target element won't change
			const container = (e.target as HTMLElement).closest(containerSelector);

			const findTargetIndex = (clientX: number, clientY: number): number | null => {
				if (!container) return null;
				const items = container.querySelectorAll<HTMLElement>(itemSelector);
				for (let i = 0; i < items.length; i++) {
					const rect = items[i]!.getBoundingClientRect();
					if (
						clientX >= rect.left &&
						clientX <= rect.right &&
						clientY >= rect.top &&
						clientY <= rect.bottom
					) {
						return i;
					}
				}
				return null;
			};

			const handleMove = (me: PointerEvent) => {
				if (!s.dragging) {
					const dx = me.clientX - s.startX;
					const dy = me.clientY - s.startY;
					if (Math.abs(dx) + Math.abs(dy) < DRAG_THRESHOLD) return;
					s.dragging = true;
					setFromRef.current(s.from);
				}

				const target = findTargetIndex(me.clientX, me.clientY);
				if (target !== null && target !== s.over) {
					s.over = target;
					setOverRef.current(target);
				}
			};

			const handleUp = () => {
				document.removeEventListener("pointermove", handleMove);
				document.removeEventListener("pointerup", handleUp);
				cleanupRef.current = null;

				if (s.dragging) {
					if (s.from !== null && s.over !== null && s.from !== s.over) {
						onReorderRef.current(s.from, s.over);
					}
					// Suppress the click event that follows pointerup after a drag
					suppressNextClick();
				}

				s.from = null;
				s.over = null;
				s.dragging = false;
				setFromRef.current(null);
				setOverRef.current(null);
			};

			// Clean up any stale listeners (shouldn't happen, but safety)
			cleanupRef.current?.();

			document.addEventListener("pointermove", handleMove);
			document.addEventListener("pointerup", handleUp);
			cleanupRef.current = () => {
				document.removeEventListener("pointermove", handleMove);
				document.removeEventListener("pointerup", handleUp);
			};
		},
		[containerSelector, itemSelector],
	);

	// Cleanup on unmount
	useEffect(() => () => cleanupRef.current?.(), []);

	return {
		dragFromIndex,
		dragOverIndex,
		handlePointerDown,
	};
}
