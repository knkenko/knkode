/** Maps DOM KeyboardEvent to ANSI escape sequences for terminal input.
 *  Simplified version — no application cursor mode (DECCKM) support.
 *  Modifier parameters applied to both CSI and SS3 (F1-F4) sequences.
 *
 *  Returns:
 *    string  → send this ANSI sequence to the PTY
 *    null    → ignore, let browser/Tauri handle (e.g. Cmd+C, Cmd+V)
 *    "paste" → caller should trigger clipboard paste into the PTY */

import { isMac } from "../utils/platform";

/** Sentinel return value indicating the caller should paste from clipboard.
 *  Exported so consumers (e.g. CanvasTerminal) can compare without magic strings. */
export const PASTE_SENTINEL = "paste" as const;

const MODIFIER_KEYS = new Set(["Shift", "Control", "Alt", "Meta"]);

const SPECIAL_KEYS = {
	Enter: "\r",
	Backspace: "\x7f",
	Tab: "\t",
	Escape: "\x1b",
	ArrowUp: "\x1b[A",
	ArrowDown: "\x1b[B",
	ArrowRight: "\x1b[C",
	ArrowLeft: "\x1b[D",
	Home: "\x1b[H",
	End: "\x1b[F",
	Insert: "\x1b[2~",
	Delete: "\x1b[3~",
	PageUp: "\x1b[5~",
	PageDown: "\x1b[6~",
	F1: "\x1bOP",
	F2: "\x1bOQ",
	F3: "\x1bOR",
	F4: "\x1bOS",
	F5: "\x1b[15~",
	F6: "\x1b[17~",
	F7: "\x1b[18~",
	F8: "\x1b[19~",
	F9: "\x1b[20~",
	F10: "\x1b[21~",
	F11: "\x1b[23~",
	F12: "\x1b[24~",
} as const satisfies Record<string, string>;

/** Convert a DOM KeyboardEvent to an ANSI string for the terminal.
 *  Returns null if the event should not be sent (modifier-only keys, Cmd combos
 *  handled by the native menu, etc.).
 *  Returns {@link PASTE_SENTINEL} when the caller should perform a clipboard paste into PTY. */
export function keyEventToAnsi(e: KeyboardEvent): string | null {
	if (MODIFIER_KEYS.has(e.key)) return null;

	// --- Platform clipboard / menu keys: return null so the browser/Tauri handles them ---

	// macOS: Cmd+<key> is always handled by the native menu or global shortcuts.
	// Never send Cmd combos to the PTY.
	if (isMac && e.metaKey) return null;

	// Windows/Linux copy: Ctrl+C with no other modifiers.
	// Ctrl+C without Shift is ambiguous: if text is selected it should copy,
	// otherwise it should send SIGINT (\x03). We return null so the caller
	// (handleKeyDown) can decide based on selection state.
	// Use e.code (physical key) for clipboard shortcuts so they work
	// regardless of keyboard layout / system language (e.key is locale-dependent).
	if (!isMac && e.ctrlKey && !e.altKey) {
		// Ctrl+Shift+C → always copy
		if (e.code === "KeyC" && e.shiftKey) return null;
		// Ctrl+C → caller handles (copy if selection, SIGINT if not)
		if (e.code === "KeyC") return null;
		// Ctrl+V / Ctrl+Shift+V → paste from clipboard
		if (e.code === "KeyV") return PASTE_SENTINEL;
	}

	// --- Shift+Enter → literal newline (LF) instead of CR ---
	if (e.key === "Enter" && e.shiftKey) return "\n";

	// Shift+Arrow / Alt+Shift+Arrow → null so caller handles terminal-level selection
	if (e.shiftKey && !e.ctrlKey && !e.metaKey && (e.key === "ArrowLeft" || e.key === "ArrowRight"))
		return null;

	// Ctrl+key: a-z maps to 0x01-0x1A; also handles Ctrl+[ ] \ and Space.
	// Use e.code (physical key) for a-z so Ctrl+C sends \x03 regardless of
	// keyboard layout. Bracket/backslash use e.key since they are layout-dependent.
	if (e.ctrlKey && !e.altKey && !e.metaKey) {
		if (e.code.startsWith("Key") && e.code.length === 4) {
			const letter = e.code.charCodeAt(3); // A=65 … Z=90
			if (letter >= 65 && letter <= 90) {
				return String.fromCharCode(letter - 64);
			}
		}
		if (e.key === "[") return "\x1b";
		if (e.key === "\\") return "\x1c";
		if (e.key === "]") return "\x1d";
		if (e.key === " ") return "\x00";
	}

	// Alt+key → ESC prefix
	if (e.altKey && !e.ctrlKey && !e.metaKey) {
		// Alt+Arrow → readline word navigation (ESC b / ESC f)
		if (e.key === "ArrowLeft") return "\x1bb";
		if (e.key === "ArrowRight") return "\x1bf";

		// Alt+Backspace → backward-kill-word
		if (e.key === "Backspace") return "\x1b\x7f";

		if (e.key.length === 1) {
			return `\x1b${e.key}`;
		}
	}

	// Shift+Tab → reverse-tab (backtab)
	if (e.key === "Tab" && e.shiftKey) return "\x1b[Z";

	// Special keys (arrows, function keys, etc.)
	const special = (SPECIAL_KEYS as Record<string, string>)[e.key];
	if (special !== undefined) {
		const mod = modifierParam(e);
		if (mod > 1) {
			// CSI sequences: \x1b[N~ → \x1b[N;mod~ or \x1b[X → \x1b[1;modX
			if (special.startsWith("\x1b[")) {
				const inner = special.slice(2);
				if (inner.endsWith("~")) {
					return `\x1b[${inner.slice(0, -1)};${mod}~`;
				}
				return `\x1b[1;${mod}${inner}`;
			}
			// SS3 sequences (F1-F4): \x1bOX → \x1b[1;modX
			if (special.startsWith("\x1bO")) {
				return `\x1b[1;${mod}${special[2]}`;
			}
		}
		return special;
	}

	// Printable characters
	if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
		return e.key;
	}

	return null;
}

/** Compute xterm modifier parameter: 1 + (shift?1:0) + (alt?2:0) + (ctrl?4:0) */
function modifierParam(e: KeyboardEvent): number {
	let mod = 1;
	if (e.shiftKey) mod += 1;
	if (e.altKey) mod += 2;
	if (e.ctrlKey) mod += 4;
	return mod;
}
