/** Reorder an array by moving the element at `from` to `to`.
 *  Returns the new array, or null if indices are out of range or equal. */
export function reorderArray<T>(arr: readonly T[], from: number, to: number): T[] | null {
	if (from < 0 || from >= arr.length || to < 0 || to >= arr.length) return null
	if (from === to) return null
	const result = [...arr]
	const moved = result.splice(from, 1)[0]
	if (!moved) return null
	result.splice(to, 0, moved)
	return result
}
