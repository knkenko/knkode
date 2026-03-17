import { useCallback, useEffect, useRef } from "react";

/**
 * Returns a debounced version of the callback that delays invocation
 * until `delay` ms after the last call. Cleans up pending timers on unmount.
 */
export function useDebouncedCallback<T extends unknown[]>(
	fn: (...args: T) => void,
	delay: number,
): (...args: T) => void {
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	useEffect(() => {
		return () => clearTimeout(timeoutRef.current);
	}, []);

	return useCallback(
		(...args: T) => {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = setTimeout(() => fn(...args), delay);
		},
		[fn, delay],
	);
}
