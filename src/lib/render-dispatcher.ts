import type { GridSnapshot } from "../shared/types";

type RenderCallback = (snapshot: GridSnapshot) => void;

/** Per-pane render callbacks — O(1) lookup replaces O(N) fan-out broadcast. */
const listeners = new Map<string, RenderCallback>();

/** Register a pane's render callback. Returns an unregister function. */
export function registerRenderListener(paneId: string, cb: RenderCallback): () => void {
	listeners.set(paneId, cb);
	return (): void => {
		// Check identity before deleting — React StrictMode double-mounts
		// cause mount1-unmount1-mount2, and unmount1 must not remove mount2's callback.
		if (listeners.get(paneId) === cb) {
			listeners.delete(paneId);
		}
	};
}

/** Dispatch a render event to the matching pane. Called from a single global listener. */
export function dispatchRender(id: string, snapshot: GridSnapshot): void {
	listeners.get(id)?.(snapshot);
}
