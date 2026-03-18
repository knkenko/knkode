import { type RefObject, useEffect } from "react";

/**
 * Calls `onClose` when a mousedown occurs outside `ref`.
 * Uses capture-phase listener so it fires before any child element can
 * swallow the event via stopPropagation in the bubble phase.
 *
 * Portal-aware: pass `portalRef` for menus rendered via `createPortal` outside
 * the ref tree — clicks inside the portal will not trigger `onClose`.
 */
export function useClickOutside(
	ref: RefObject<HTMLElement | null>,
	onClose: () => void,
	active: boolean,
	portalRef?: RefObject<HTMLElement | null>,
): void {
	useEffect(() => {
		if (!active) return;
		const el = ref.current;
		const handler = (e: MouseEvent) => {
			if (!e.target || !(e.target instanceof Node)) {
				onClose();
				return;
			}
			if (el && !el.contains(e.target)) {
				if (portalRef?.current?.contains(e.target)) return;
				onClose();
			}
		};
		// Capture phase: fires before any child element can swallow the event
		document.addEventListener("mousedown", handler, true);
		return () => document.removeEventListener("mousedown", handler, true);
	}, [ref, onClose, active, portalRef]);
}
