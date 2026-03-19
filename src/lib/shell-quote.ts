/** Shell-quote a file path for safe insertion into a POSIX terminal (bash/zsh/sh).
 *  Strips control characters (which could act as keypresses in a PTY),
 *  then wraps in single quotes with the `'` → `'\''` escape idiom.
 *
 *  NOTE: This quoting is POSIX-specific. It does not work for cmd.exe or PowerShell. */
export function shellQuote(path: string): string {
	// Strip control chars (except tab) — newlines would execute as Enter in a PTY
	const sanitized = path.replace(/[\x00-\x08\x0a-\x1f\x7f]/g, "");
	return `'${sanitized.replace(/'/g, "'\\''")}'`;
}

/** Shell-quote multiple paths and join with spaces. */
export function shellQuotePaths(paths: readonly string[]): string {
	return paths.map(shellQuote).join(" ");
}
