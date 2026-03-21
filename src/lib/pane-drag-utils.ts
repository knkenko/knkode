import type { DropPosition } from "../shared/types";

export type DropZone = DropPosition | "center";

export interface PaneDragPayload {
	paneId: string;
	workspaceId: string;
}

export const PANE_DRAG_MIME = "application/x-knkode-pane";

/** Module-level state for the active pane drag operation.
 *  WKWebView (Safari) doesn't expose custom MIME types in `dataTransfer.types`
 *  during `dragover`, so we can't gate `preventDefault()` on the MIME check.
 *  Instead, track drag state in JS and read it during `dragover` / `drop`. */
let activePaneDrag: PaneDragPayload | null = null;

export function setActivePaneDrag(payload: PaneDragPayload | null): void {
	activePaneDrag = payload;
}

export function getActivePaneDrag(): PaneDragPayload | null {
	return activePaneDrag;
}

/** Module-level state for the current drop target during a pane drag.
 *  Updated by the target pane's dragover handler, read by the source pane's
 *  dragend handler as a fallback when WKWebView doesn't fire the drop event. */
export interface PaneDropTarget {
	paneId: string;
	workspaceId: string;
	zone: DropZone;
}

let activeDropTarget: PaneDropTarget | null = null;

export function setActiveDropTarget(target: PaneDropTarget | null): void {
	activeDropTarget = target;
}

export function getActiveDropTarget(): PaneDropTarget | null {
	return activeDropTarget;
}

/** Parse and validate a drag payload from untrusted JSON. Returns null on invalid input. */
export function parsePaneDragPayload(raw: string): PaneDragPayload | null {
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch {
		console.warn("[pane] Failed to parse drag payload:", raw);
		return null;
	}
	if (
		typeof parsed !== "object" ||
		parsed === null ||
		typeof (parsed as Record<string, unknown>).paneId !== "string" ||
		typeof (parsed as Record<string, unknown>).workspaceId !== "string"
	) {
		return null;
	}
	return parsed as PaneDragPayload;
}

// Inline styles (not Tailwind) — dynamic drag overlay highlights require computed CSS properties.
export const ZONE_STYLES: Record<DropZone, React.CSSProperties> = {
	center: { inset: 0, backgroundColor: "var(--color-accent)", opacity: 0.12 },
	left: { inset: 0, right: "50%", backgroundColor: "var(--color-accent)", opacity: 0.18 },
	right: { inset: 0, left: "50%", backgroundColor: "var(--color-accent)", opacity: 0.18 },
	top: { inset: 0, bottom: "50%", backgroundColor: "var(--color-accent)", opacity: 0.18 },
	bottom: { inset: 0, top: "50%", backgroundColor: "var(--color-accent)", opacity: 0.18 },
};

/** Determine which drop zone the cursor is in based on position within the element.
 *  Center is inner 50% on each axis. Edges are outer 25%; left/right checked
 *  first so they claim corners over top/bottom. */
export function getDropZone(clientX: number, clientY: number, el: HTMLElement): DropZone {
	const rect = el.getBoundingClientRect();
	const x = (clientX - rect.left) / rect.width;
	const y = (clientY - rect.top) / rect.height;
	if (x < 0.25) return "left";
	if (x > 0.75) return "right";
	if (y < 0.25) return "top";
	if (y > 0.75) return "bottom";
	return "center";
}
