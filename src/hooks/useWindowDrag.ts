import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback } from "react";

/**
 * Returns a `mousedown` handler that initiates window dragging via Tauri.
 * Elements with the `.no-drag` class (or inside one) are excluded.
 */
export function useWindowDrag() {
	return useCallback((e: React.MouseEvent) => {
		if (e.button !== 0) return;
		if (e.target instanceof HTMLElement && e.target.closest(".no-drag")) return;
		e.preventDefault();
		getCurrentWindow()
			.startDragging()
			.catch((err) => {
				console.warn("[window-drag] startDragging failed:", err);
			});
	}, []);
}
