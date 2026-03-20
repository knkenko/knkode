// navigator.platform is deprecated in browsers but reliable in Tauri's WebView context.
export const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
export const isWindows = typeof navigator !== "undefined" && /Win/.test(navigator.platform);

/** Returns "Cmd" on macOS, "Ctrl" on other platforms. Used for tooltip/shortcut display. */
export const modKey = isMac ? "Cmd" : "Ctrl";
