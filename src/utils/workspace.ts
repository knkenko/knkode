/**
 * Pick the majority value from a map of pane IDs → values.
 * If tied, the focused pane's value wins. If the focused pane isn't in the
 * set, falls back to the first pane's value (by insertion order).
 *
 * Returns null when the map is empty.
 */
export function majorityOrFocused(
	values: Record<string, string | null>,
	paneIds: string[],
	focusedPaneId: string | null,
): string | null {
	if (paneIds.length === 0) return null;

	// Count occurrences of each non-null value
	const counts = new Map<string, number>();
	for (const pid of paneIds) {
		const v = values[pid];
		if (v != null) counts.set(v, (counts.get(v) ?? 0) + 1);
	}

	if (counts.size === 0) return null;

	// Find the max count
	let maxCount = 0;
	for (const c of counts.values()) {
		if (c > maxCount) maxCount = c;
	}

	// Collect all values tied at max count
	const winners: string[] = [];
	for (const [val, c] of counts) {
		if (c === maxCount) winners.push(val);
	}

	// Single winner — done
	if (winners.length === 1) return winners[0] ?? null;

	// Tie — focused pane breaks it
	if (focusedPaneId) {
		const focusedValue = values[focusedPaneId];
		if (focusedValue != null && winners.includes(focusedValue)) return focusedValue;
	}

	// Focused pane not in workspace or not a winner — return first pane's value
	for (const pid of paneIds) {
		const v = values[pid];
		if (v != null && winners.includes(v)) return v;
	}

	return winners[0] ?? null;
}
