/** Screen-space coordinate pair used for menu anchoring and clamping. */
export interface ScreenPosition {
	x: number;
	y: number;
}

/** Minimum gap between portalled menus and the viewport edge. */
export const VIEWPORT_MARGIN = 8;

/** Minimum pointer movement (px) before a press becomes a drag. */
export const DRAG_THRESHOLD = 5;

/** Resolve the portal mount point, falling back to document.body. */
export function getPortalRoot(): HTMLElement {
	return document.getElementById("portal-root") ?? document.body;
}

/** Delay (ms) before the scrollbar fades out after scroll activity stops. */
export const SCROLLBAR_HIDE_DELAY_MS = 2000;

/** Suppress the click event that follows pointerup after a drag. */
export function suppressNextClick(): void {
	document.addEventListener("click", (ev) => ev.stopPropagation(), { capture: true, once: true });
}
