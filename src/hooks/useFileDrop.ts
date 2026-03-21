import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useCallback, useEffect, useRef, useState } from "react";
import { shellQuotePaths } from "../lib/shell-quote";
import type { ScreenPosition } from "../lib/ui-constants";

/** Payload from Tauri's built-in drag-drop events (physical pixel coords). */
interface DragDropPayload {
	paths?: string[];
	position: ScreenPosition;
}

/** Maximum number of dropped files to accept — prevents flooding the PTY buffer. */
const MAX_DROP_PATHS = 100;

interface UseFileDropOptions {
	/** Ref to the pane's outer DOM element for hit testing. */
	containerRef: React.RefObject<HTMLElement | null>;
	/** Write data to the PTY. */
	onWrite: (data: string) => void;
}

/** Hook that listens for native file drag-and-drop events from Tauri and
 *  writes shell-quoted file paths to the terminal when dropped on this pane.
 *  Returns `isDropTarget` — true while files are hovering over this pane. */
export function useFileDrop({ containerRef, onWrite }: UseFileDropOptions): {
	isDropTarget: boolean;
} {
	const [isDropTarget, setIsDropTarget] = useState(false);
	const rafRef = useRef(0);

	const isOverPane = useCallback((position: ScreenPosition): boolean => {
		const el = containerRef.current;
		if (!el) return false;
		const rect = el.getBoundingClientRect();
		const scale = window.devicePixelRatio ?? 1;
		// Tauri sends physical pixels; getBoundingClientRect returns logical
		const x = position.x / scale;
		const y = position.y / scale;
		return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
	}, []);

	useEffect(() => {
		const unlisteners: UnlistenFn[] = [];
		let disposed = false;

		async function setup() {
			const [enterUn, overUn, dropUn, leaveUn] = await Promise.all([
				listen<DragDropPayload>("tauri://drag-enter", (e) => {
					if (disposed) return;
					setIsDropTarget(isOverPane(e.payload.position));
				}),
				listen<DragDropPayload>("tauri://drag-over", (e) => {
					if (disposed) return;
					if (rafRef.current) return;
					rafRef.current = requestAnimationFrame(() => {
						rafRef.current = 0;
						if (disposed) return;
						setIsDropTarget(isOverPane(e.payload.position));
					});
				}),
				listen<DragDropPayload>("tauri://drag-drop", (e) => {
					if (disposed) return;
					setIsDropTarget(false);
					const { paths, position } = e.payload;
					if (!paths || paths.length === 0) {
						console.warn("[useFileDrop] Drop event with no file paths");
						return;
					}
					if (isOverPane(position)) {
						const capped =
							paths.length > MAX_DROP_PATHS
								? (console.warn(`[useFileDrop] Capping ${paths.length} paths to ${MAX_DROP_PATHS}`),
									paths.slice(0, MAX_DROP_PATHS))
								: paths;
						onWrite(shellQuotePaths(capped));
					}
				}),
				listen<DragDropPayload>("tauri://drag-leave", () => {
					if (disposed) return;
					setIsDropTarget(false);
				}),
			]);

			if (disposed) {
				enterUn();
				overUn();
				dropUn();
				leaveUn();
			} else {
				unlisteners.push(enterUn, overUn, dropUn, leaveUn);
			}
		}

		setup().catch((err) => console.error("[useFileDrop] Failed to set up listeners:", err));

		return () => {
			disposed = true;
			if (rafRef.current) cancelAnimationFrame(rafRef.current);
			for (const un of unlisteners) un();
		};
	}, [isOverPane, onWrite]);

	return { isDropTarget };
}
