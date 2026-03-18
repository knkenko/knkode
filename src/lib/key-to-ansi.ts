/** Maps DOM KeyboardEvent to ANSI escape sequences for terminal input.
 *  Simplified version — no input mode awareness (application cursor mode deferred). */

const SPECIAL_KEYS: Record<string, string> = {
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
};

/** Convert a DOM KeyboardEvent to an ANSI string for the terminal.
 *  Returns null if the event should not be sent (modifier-only keys, unhandled combos). */
export function keyEventToAnsi(e: KeyboardEvent): string | null {
	// Ignore standalone modifier keys
	if (e.key === "Shift" || e.key === "Control" || e.key === "Alt" || e.key === "Meta") {
		return null;
	}

	// Ctrl+key combinations (a-z, plus common special combos)
	if (e.ctrlKey && !e.altKey && !e.metaKey) {
		if (e.key.length === 1) {
			const code = e.key.toLowerCase().charCodeAt(0);
			// Ctrl+a through Ctrl+z → 0x01-0x1A
			if (code >= 0x61 && code <= 0x7a) {
				return String.fromCharCode(code - 0x60);
			}
			// Ctrl+[ → ESC, Ctrl+\ → 0x1C, Ctrl+] → 0x1D
			if (e.key === "[") return "\x1b";
			if (e.key === "\\") return "\x1c";
			if (e.key === "]") return "\x1d";
		}
		// Ctrl+Space → NUL
		if (e.key === " ") return "\x00";
	}

	// Alt+key → ESC prefix
	if (e.altKey && !e.ctrlKey && !e.metaKey) {
		if (e.key.length === 1) {
			return `\x1b${e.key}`;
		}
	}

	// Special keys (arrows, function keys, etc.)
	const special = SPECIAL_KEYS[e.key];
	if (special !== undefined) {
		// Shift/Ctrl/Alt modifiers on special keys → CSI with modifier parameter
		const mod = modifierParam(e);
		if (mod > 1 && special.startsWith("\x1b[") && special.length > 2) {
			// CSI sequences: \x1b[X~ or \x1b[X → \x1b[1;modX or \x1b[N;mod~
			const inner = special.slice(2);
			if (inner.endsWith("~")) {
				// \x1b[N~ → \x1b[N;mod~
				return `\x1b[${inner.slice(0, -1)};${mod}~`;
			}
			// \x1b[X (single letter) → \x1b[1;modX
			return `\x1b[1;${mod}${inner}`;
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
