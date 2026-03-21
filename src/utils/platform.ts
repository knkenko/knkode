// navigator.platform is deprecated in browsers but reliable in Tauri's WebView context.
const platform = typeof navigator !== "undefined" ? navigator.platform : "";

export const isMac = /^Mac/.test(platform);
export const isWindows = /^Win/.test(platform);

/** Returns "Cmd" on macOS, "Ctrl" on other platforms. Used for tooltip/shortcut display. */
export const modKey = isMac ? "Cmd" : "Ctrl";

/** Whether the platform modifier key (Cmd on macOS, Ctrl elsewhere) is held in an event. */
export function isModKeyHeld(e: { metaKey: boolean; ctrlKey: boolean }): boolean {
	return isMac ? e.metaKey : e.ctrlKey;
}

/** macOS traffic-light (close/minimize/maximize) width in px. */
export const MACOS_TRAFFIC_LIGHT_WIDTH = "90px";
/** Windows caption-button (minimize/maximize/close) width in px. */
export const WINDOWS_CAPTION_BUTTON_WIDTH = "138px";
/** macOS sidebar top inset in px — accounts for traffic-light position (y:24) + button height (~14) + padding. */
export const MACOS_SIDEBAR_TOP_INSET = 52;
