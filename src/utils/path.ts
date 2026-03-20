/** Shorten a CWD by replacing the home directory prefix with `~`. */
export function shortenPath(cwd: string, homeDir: string): string {
	if (homeDir && cwd.startsWith(homeDir)) {
		return `~${cwd.slice(homeDir.length)}`;
	}
	return cwd;
}
