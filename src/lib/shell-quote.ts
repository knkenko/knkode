import { isWindows } from "../utils/platform";

/** Strip control characters (except tab) — newlines would execute as Enter in a PTY. */
function sanitize(path: string): string {
	return path.replace(/[\x00-\x08\x0a-\x1f\x7f]/g, "");
}

/** Shell-quote a file path for safe insertion into a POSIX terminal (bash/zsh/sh).
 *  Wraps in single quotes with the `'` → `'\''` escape idiom. */
function posixQuote(path: string): string {
	return `'${sanitize(path).replace(/'/g, "'\\''")}'`;
}

/** Shell-quote a file path for PowerShell / cmd.exe.
 *  Uses double quotes with backtick-escaped special characters. */
function powershellQuote(path: string): string {
	const escaped = sanitize(path).replace(/[`"$]/g, "`$&");
	return `"${escaped}"`;
}

/** Shell-quote a file path for the current platform's default shell. */
export function shellQuote(path: string): string {
	return isWindows ? powershellQuote(path) : posixQuote(path);
}

/** Shell-quote multiple paths and join with spaces. */
export function shellQuotePaths(paths: readonly string[]): string {
	return paths.map(shellQuote).join(" ");
}
