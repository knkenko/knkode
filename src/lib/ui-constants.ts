/** Screen-space coordinate pair used for menu anchoring and clamping. */
export interface ScreenPosition {
	x: number;
	y: number;
}

/** Minimum gap between portalled menus and the viewport edge. */
export const VIEWPORT_MARGIN = 8;

/** Resolve the portal mount point, falling back to document.body. */
export function getPortalRoot(): HTMLElement {
	return document.getElementById("portal-root") ?? document.body;
}
