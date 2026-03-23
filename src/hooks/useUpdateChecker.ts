import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useRef, useState } from "react";
import { createListener, IPC_EVENTS } from "../lib/tauri-api";

export type UpdateStatus =
	| "idle"
	| "checking"
	| "available"
	| "downloading"
	| "ready"
	| "up_to_date"
	| "error";

export interface UpdateState {
	status: UpdateStatus;
	version: string | null;
	progress: number;
	error: string | null;
	dismissed: boolean;
}

export interface UpdateActions {
	checkForUpdate: () => void;
	installUpdate: () => void;
	restartApp: () => void;
	dismiss: () => void;
}

function formatError(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

export function useUpdateChecker(): [UpdateState, UpdateActions] {
	const [state, setState] = useState<UpdateState>({
		status: "idle",
		version: null,
		progress: 0,
		error: null,
		dismissed: false,
	});

	const updateRef = useRef<Update | null>(null);
	const lastProgressUpdate = useRef(0);
	const checkingRef = useRef(false);
	const statusRef = useRef<UpdateStatus>("idle");
	const upToDateTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	const doCheck = useCallback(async () => {
		// Guard against concurrent invocations using a ref — avoids depending on
		// state (which would re-create this callback and trigger the effect loop
		// that caused popup spam). Also blocks checks during downloads.
		if (checkingRef.current) return;
		checkingRef.current = true;

		statusRef.current = "checking";
		setState((s) => ({ ...s, status: "checking", error: null, dismissed: false }));
		try {
			const update = await check();
			if (update) {
				updateRef.current = update;
				statusRef.current = "available";
				setState((s) => ({
					...s,
					status: "available",
					version: update.version,
				}));
			} else {
				// Brief "up to date" feedback, then reset back to idle
				statusRef.current = "up_to_date";
				setState((s) => ({ ...s, status: "up_to_date" }));
				clearTimeout(upToDateTimerRef.current);
				upToDateTimerRef.current = setTimeout(() => {
					statusRef.current = "idle";
					setState((s) => (s.status === "up_to_date" ? { ...s, status: "idle" } : s));
				}, 3000);
			}
		} catch (err) {
			console.error("[updater] Check failed:", err);
			statusRef.current = "error";
			setState((s) => ({
				...s,
				status: "error",
				error: formatError(err),
			}));
		} finally {
			checkingRef.current = false;
		}
	}, []);

	const installUpdate = useCallback(async () => {
		const update = updateRef.current;
		if (!update) {
			console.warn("[updater] Install called but no update available");
			setState((s) => ({ ...s, status: "error", error: "No update available" }));
			return;
		}

		// Prevent checks while download is in progress
		checkingRef.current = true;
		statusRef.current = "downloading";
		setState((s) => ({ ...s, status: "downloading", progress: 0 }));

		let downloaded = 0;
		let contentLength = 0;

		try {
			await update.downloadAndInstall((event) => {
				switch (event.event) {
					case "Started":
						contentLength = event.data.contentLength ?? 0;
						break;
					case "Progress": {
						downloaded += event.data.chunkLength;
						// Throttle progress updates to ~4/sec to reduce unnecessary re-renders
						const now = Date.now();
						if (now - lastProgressUpdate.current < 250) break;
						lastProgressUpdate.current = now;
						setState((s) => ({
							...s,
							progress: contentLength > 0 ? downloaded / contentLength : 0,
						}));
						break;
					}
					case "Finished":
						statusRef.current = "ready";
						setState((s) => ({ ...s, progress: 1, status: "ready" }));
						break;
				}
			});
			// Don't auto-relaunch — let user click "Restart now" so they can save work
		} catch (err) {
			console.error("[updater] Download/install failed:", err);
			statusRef.current = "error";
			setState((s) => ({
				...s,
				status: "error",
				error: formatError(err),
			}));
		} finally {
			checkingRef.current = false;
		}
	}, []);

	const restartApp = useCallback(async () => {
		// Only allow relaunch when update is installed and ready
		if (statusRef.current !== "ready") {
			console.warn("[updater] restartApp called but status is not ready");
			return;
		}

		try {
			await relaunch();
		} catch (err) {
			console.error("[updater] Relaunch failed:", err);
			setState((s) => ({
				...s,
				status: "error",
				error: "Update installed but restart failed. Please restart the app manually.",
			}));
		}
	}, []);

	const dismiss = useCallback(() => {
		setState((s) => ({ ...s, dismissed: true }));
	}, []);

	// Check once on mount after UI settles
	useEffect(() => {
		const timer = setTimeout(doCheck, 3000);
		return () => {
			clearTimeout(timer);
			clearTimeout(upToDateTimerRef.current);
		};
	}, [doCheck]);

	// Listen for menu "Check for Updates" event (emitted from Rust on macOS)
	useEffect(() => {
		const unsub = createListener(IPC_EVENTS.appCheckUpdate, () => {
			doCheck();
		});
		return unsub;
	}, [doCheck]);

	return [state, { checkForUpdate: doCheck, installUpdate, restartApp, dismiss }];
}
