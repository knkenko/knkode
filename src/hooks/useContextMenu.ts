import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { type ScreenPosition, VIEWPORT_MARGIN } from "../lib/ui-constants";
import { useClickOutside } from "./useClickOutside";

/** Shared context menu state — handles open/close, positioning, click-outside, and viewport clamping. */
export function useContextMenu() {
	const [isOpen, setIsOpen] = useState(false);
	const [rawPos, setRawPos] = useState<ScreenPosition>({ x: 0, y: 0 });
	const [clampedPos, setClampedPos] = useState<ScreenPosition | null>(null);
	const ref = useRef<HTMLDivElement>(null);

	const open = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setRawPos({ x: e.clientX, y: e.clientY });
		setClampedPos(null);
		setIsOpen(true);
	}, []);

	const close = useCallback(() => {
		setIsOpen(false);
		setClampedPos(null);
	}, []);

	useClickOutside(ref, close, isOpen);

	// Clamp to viewport after the portal renders and we know its size
	useLayoutEffect(() => {
		if (!isOpen) return;
		const el = ref.current;
		if (!el) {
			setClampedPos(rawPos);
			return;
		}
		const clamp = () => {
			const { width, height } = el.getBoundingClientRect();
			setClampedPos({
				x: Math.max(
					VIEWPORT_MARGIN,
					Math.min(rawPos.x, window.innerWidth - width - VIEWPORT_MARGIN),
				),
				y: Math.max(
					VIEWPORT_MARGIN,
					Math.min(rawPos.y, window.innerHeight - height - VIEWPORT_MARGIN),
				),
			});
		};
		clamp();
		window.addEventListener("resize", clamp);
		return () => window.removeEventListener("resize", clamp);
	}, [isOpen, rawPos]);

	return { isOpen, position: clampedPos ?? rawPos, ref, open, close };
}
