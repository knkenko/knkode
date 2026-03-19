/** Shell-quote a file path for safe insertion into a terminal.
 *  Wraps in single quotes and escapes any internal single quotes
 *  using the `'` → `'\''` idiom (end quote, escaped quote, reopen quote). */
export function shellQuote(path: string): string {
	return `'${path.replace(/'/g, "'\\''")}'`;
}

/** Shell-quote multiple paths and join with spaces. */
export function shellQuotePaths(paths: readonly string[]): string {
	return paths.map(shellQuote).join(" ");
}
