/** SGR mouse event encoder — converts DOM mouse/wheel events into SGR 1006
 *  escape sequences for forwarding to the PTY when the running program has
 *  enabled mouse reporting.
 *
 *  SGR format: `\x1b[<button;col;row{M|m}`
 *    - M = press/motion, m = release
 *    - col and row are 1-based (converted internally from 0-based input)
 *    - button encodes the action + modifiers */

/** Modifier keys extracted from a DOM mouse/wheel event. */
type ModifierKeys = Pick<MouseEvent, "shiftKey" | "altKey" | "ctrlKey">;

/** SGR button codes and flags for mouse actions. */
const BTN_LEFT = 0;
const BTN_MIDDLE = 1;
const BTN_RIGHT = 2;
const BTN_WHEEL_UP = 64;
const BTN_WHEEL_DOWN = 65;
const BTN_MOTION = 32;

/** Modifier flag bits ORed into the button code.
 *  Note: SGR "Meta" (bit 8) maps to the Alt/Option key, not Cmd/Super. */
const MOD_SHIFT = 4;
const MOD_META = 8;
const MOD_CTRL = 16;

/** Build the modifier bits from a DOM event.
 *  Maps altKey → SGR Meta (bit 8), matching the xterm SGR 1006 spec. */
function modifierBits(e: ModifierKeys): number {
	let bits = 0;
	if (e.shiftKey) bits |= MOD_SHIFT;
	if (e.altKey) bits |= MOD_META;
	if (e.ctrlKey) bits |= MOD_CTRL;
	return bits;
}

/** Map DOM MouseEvent.button to SGR button code. Returns null for unsupported buttons (3+). */
function domButtonToSgr(button: number): number | null {
	switch (button) {
		case 0:
			return BTN_LEFT;
		case 1:
			return BTN_MIDDLE;
		case 2:
			return BTN_RIGHT;
		default:
			return null;
	}
}

/** Encode a mouse press as an SGR sequence. Col/row are 0-based (converted to 1-based internally). */
export function sgrMousePress(
	button: number,
	col: number,
	row: number,
	e: ModifierKeys,
): string | null {
	const btn = domButtonToSgr(button);
	if (btn === null) return null;
	const code = btn | modifierBits(e);
	return `\x1b[<${code};${col + 1};${row + 1}M`;
}

/** Encode a mouse release as an SGR sequence. Col/row are 0-based. */
export function sgrMouseRelease(
	button: number,
	col: number,
	row: number,
	e: ModifierKeys,
): string | null {
	const btn = domButtonToSgr(button);
	if (btn === null) return null;
	const code = btn | modifierBits(e);
	return `\x1b[<${code};${col + 1};${row + 1}m`;
}

/** Encode a mouse drag motion as an SGR sequence. Col/row are 0-based. */
export function sgrMouseMotion(
	button: number,
	col: number,
	row: number,
	e: ModifierKeys,
): string | null {
	const btn = domButtonToSgr(button);
	if (btn === null) return null;
	const code = btn | BTN_MOTION | modifierBits(e);
	return `\x1b[<${code};${col + 1};${row + 1}M`;
}

/** Encode a wheel scroll as an SGR sequence. Col/row are 0-based.
 *  @param direction - positive = scroll up, negative = scroll down */
export function sgrWheelScroll(
	direction: number,
	col: number,
	row: number,
	e: ModifierKeys,
): string {
	const btn = direction > 0 ? BTN_WHEEL_UP : BTN_WHEEL_DOWN;
	const code = btn | modifierBits(e);
	return `\x1b[<${code};${col + 1};${row + 1}M`;
}
