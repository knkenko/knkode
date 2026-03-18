export const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)

/** Returns "Cmd" on macOS, "Ctrl" on other platforms. */
export const modKey = isMac ? 'Cmd' : 'Ctrl'
