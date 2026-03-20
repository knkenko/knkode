import { isWindows } from "../utils/platform";

/** Strip control characters (except tab) and Unicode bidirectional overrides.
 *  Newlines would execute as Enter in a PTY; bidi chars can visually disguise paths. */
function stripControlChars(path: string): string {
	return path.replace(/[\x00-\x08\x0a-\x1f\x7f\u202A-\u202E\u2066-\u2069]/g, "");
}

/** Shell-quote a file path for a POSIX shell (bash/zsh/sh).
 *  Wraps in single quotes with the `'` → `'\''` escape idiom. */
function posixQuote(clean: string): string {
	return `'${clean.replace(/'/g, "'\\''")}'`;
}

/** Shell-quote a file path for PowerShell.
 *  Uses single quotes where only `'` needs escaping (doubled as `''`).
 *  PowerShell single-quoted strings have no interpolation or metacharacters. */
function powershellQuote(clean: string): string {
	return `'${clean.replace(/'/g, "''")}'`;
}

/** Shell-quote a file path for the current platform's default shell.
 *  Sanitizes control/bidi characters, then applies platform-appropriate quoting. */
export function shellQuote(path: string): string {
	const clean = stripControlChars(path);
	return isWindows ? powershellQuote(clean) : posixQuote(clean);
}

/** Shell-quote multiple paths and join with spaces. */
export function shellQuotePaths(paths: readonly string[]): string {
	return paths.map(shellQuote).join(" ");
}
