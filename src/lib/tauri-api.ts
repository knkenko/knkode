import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-shell";
import type {
	AppState,
	GridSnapshot,
	KnkodeApi,
	PrInfo,
	Snippet,
	Workspace,
} from "../shared/types";

export const api: KnkodeApi = {
	// App
	getHomeDir: () => invoke<string>("get_home_dir"),
	openExternal: (url) => open(url),
	logScrollDebug: (event) => {
		invoke("log_scroll_debug", { event }).catch(() => {});
	},

	// Config
	getWorkspaces: () => invoke<Workspace[]>("get_workspaces"),
	saveWorkspace: (workspace) => invoke("save_workspace", { workspace }),
	deleteWorkspace: (id) => invoke("delete_workspace", { id }),
	getAppState: () => invoke<AppState>("get_app_state"),
	saveAppState: (state) => invoke("save_app_state", { state }),
	getSnippets: () => invoke<Snippet[]>("get_snippets"),
	saveSnippets: (snippets) => invoke("save_snippets", { snippets }),

	// PTY
	createPty: (id, cwd, startupCommand) => invoke("create_pty", { id, cwd, startupCommand }),
	writePty: (id, data) => invoke("write_pty", { id, data }),
	resizePty: (id, cols, rows) => invoke("resize_pty", { id, cols, rows }),
	killPty: (id) => invoke("kill_pty", { id }),

	// Terminal grid events — wezterm-term processes PTY data in Rust, sends rendered grid.
	// This REPLACES onPtyData — raw PTY bytes no longer reach the frontend.
	onTerminalRender: (cb) => {
		let unlisten: UnlistenFn | null = null;
		listen<{ id: string; grid: GridSnapshot }>("terminal:render", (e) =>
			cb(e.payload.id, e.payload.grid),
		).then((fn) => {
			unlisten = fn;
		});
		return () => {
			unlisten?.();
		};
	},

	// PTY lifecycle events — Tauri listen() returns Promise<UnlistenFn>.
	// We need synchronous unsubscribe, so we store the unlisten fn once resolved.
	onPtyExit: (cb) => {
		let unlisten: UnlistenFn | null = null;
		listen<{ id: string; exitCode: number }>("pty:exit", (e) =>
			cb(e.payload.id, e.payload.exitCode),
		).then((fn) => {
			unlisten = fn;
		});
		return () => {
			unlisten?.();
		};
	},

	onPtyCwdChanged: (cb) => {
		let unlisten: UnlistenFn | null = null;
		listen<{ paneId: string; cwd: string }>("pty:cwd-changed", (e) =>
			cb(e.payload.paneId, e.payload.cwd),
		).then((fn) => {
			unlisten = fn;
		});
		return () => {
			unlisten?.();
		};
	},

	onPtyBranchChanged: (cb) => {
		let unlisten: UnlistenFn | null = null;
		listen<{ paneId: string; branch: string | null }>("pty:branch-changed", (e) =>
			cb(e.payload.paneId, e.payload.branch),
		).then((fn) => {
			unlisten = fn;
		});
		return () => {
			unlisten?.();
		};
	},

	onPtyPrChanged: (cb) => {
		let unlisten: UnlistenFn | null = null;
		listen<{ paneId: string; pr: PrInfo | null }>("pty:pr-changed", (e) =>
			cb(e.payload.paneId, e.payload.pr),
		).then((fn) => {
			unlisten = fn;
		});
		return () => {
			unlisten?.();
		};
	},
};
