/** Maps DOM KeyboardEvent to ANSI escape sequences for terminal input.
 *  Simplified version -- no input mode awareness (application cursor mode deferred).
 *  Modifier parameters applied to both CSI and SS3 (F1-F4) sequences. */

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
 *  Returns null if the event should not be sent (modifier-only keys, unhandled combos). */
export function keyEventToAnsi(e: KeyboardEvent): string | null {
	if (MODIFIER_KEYS.has(e.key)) return null;

	// Ctrl+key: a-z maps to 0x01-0x1A; also handles Ctrl+[ ] \ and Space
	if (e.ctrlKey && !e.altKey && !e.metaKey) {
		if (e.key.length === 1) {
			const code = e.key.toLowerCase().charCodeAt(0);
			if (code >= 0x61 && code <= 0x7a) {
				return String.fromCharCode(code - 0x60);
			}
			if (e.key === "[") return "\x1b";
			if (e.key === "\\") return "\x1c";
			if (e.key === "]") return "\x1d";
		}
		if (e.key === " ") return "\x00";
	}

	// Alt+key → ESC prefix
	if (e.altKey && !e.ctrlKey && !e.metaKey) {
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
