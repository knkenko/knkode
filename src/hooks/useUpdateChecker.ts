import { listen } from "@tauri-apps/api/event";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { useCallback, useEffect, useRef, useState } from "react";

export type UpdateStatus = "idle" | "checking" | "available" | "downloading" | "ready" | "error";

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
	dismiss: () => void;
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

	const doCheck = useCallback(async () => {
		setState((s) => ({ ...s, status: "checking", error: null, dismissed: false }));
		try {
			const update = await check();
			if (update) {
				updateRef.current = update;
				setState((s) => ({
					...s,
					status: "available",
					version: update.version,
				}));
			} else {
				setState((s) => ({ ...s, status: "idle" }));
			}
		} catch (err) {
			console.error("[updater] Check failed:", err);
			setState((s) => ({
				...s,
				status: "error",
				error: err instanceof Error ? err.message : String(err),
			}));
		}
	}, []);

	const installUpdate = useCallback(async () => {
		const update = updateRef.current;
		if (!update) return;

		setState((s) => ({ ...s, status: "downloading", progress: 0 }));

		let downloaded = 0;
		let contentLength = 0;

		try {
			await update.downloadAndInstall((event) => {
				switch (event.event) {
					case "Started":
						contentLength = event.data.contentLength ?? 0;
						break;
					case "Progress":
						downloaded += event.data.chunkLength;
						setState((s) => ({
							...s,
							progress: contentLength > 0 ? downloaded / contentLength : 0,
						}));
						break;
					case "Finished":
						setState((s) => ({ ...s, progress: 1, status: "ready" }));
						break;
				}
			});
			await relaunch();
		} catch (err) {
			console.error("[updater] Install failed:", err);
			setState((s) => ({
				...s,
				status: "error",
				error: err instanceof Error ? err.message : String(err),
			}));
		}
	}, []);

	const dismiss = useCallback(() => {
		setState((s) => ({ ...s, dismissed: true }));
	}, []);

	// Check on launch (3s delay to not block startup)
	useEffect(() => {
		const timer = setTimeout(doCheck, 3000);
		return () => clearTimeout(timer);
	}, [doCheck]);

	// Listen for menu "Check for Updates" event
	useEffect(() => {
		const unlisten = listen("app:check-update", () => {
			doCheck();
		});
		return () => {
			unlisten.then((fn) => fn());
		};
	}, [doCheck]);

	return [state, { checkForUpdate: doCheck, installUpdate, dismiss }];
}
