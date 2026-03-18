/** Accept empty (inherits default cwd), absolute Unix paths, or Windows drive-letter paths.
 *  UNC paths (\\server\share) are intentionally unsupported — the main process validates
 *  with path.isAbsolute() which covers UNC; this is a renderer-side format check only.
 *  Tilde paths are not accepted — callers should resolve ~ to homeDir before validating
 *  (relevant on macOS/Linux; tilde is not a standard Windows path prefix). */
export function isValidCwd(value: string): boolean {
	if (value === '') return true
	if (value.startsWith('/')) return true
	if (/^[A-Za-z]:[/\\]/.test(value)) return true
	return false
}
