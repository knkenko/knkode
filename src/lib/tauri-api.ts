import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-shell";
import type {
	AppState,
	GridSnapshot,
	KnkodeApi,
	PrInfo,
	SelectionRange,
	Snippet,
	Unsubscribe,
	Workspace,
} from "../shared/types";

const IPC_EVENTS = {
	terminalRender: "terminal:render",
	ptyExit: "pty:exit",
	ptyCwdChanged: "pty:cwd-changed",
	ptyBranchChanged: "pty:branch-changed",
	ptyPrChanged: "pty:pr-changed",
	ptyActivityChanged: "pty:activity-changed",
} as const;

/**
 * Create a synchronous unsubscribe handle over Tauri's async `listen()`.
 * Tracks a `disposed` flag so that if unsubscribe is called before
 * the listener is registered, cleanup happens as soon as `listen()` resolves.
 */
function createListener<T>(event: string, handler: (payload: T) => void): Unsubscribe {
	let unlisten: UnlistenFn | null = null;
	let disposed = false;
	listen<T>(event, (e) => handler(e.payload))
		.then((fn) => {
			if (disposed) fn();
			else unlisten = fn;
		})
		.catch((err) => console.error(`[tauri-api] Failed to listen ${event}`, err));
	return () => {
		disposed = true;
		unlisten?.();
	};
}

function isAllowedUrl(url: string): boolean {
	return url.startsWith("https://") || url.startsWith("http://");
}

const _api: KnkodeApi = {
	// App
	getHomeDir: () => invoke<string>("get_home_dir"),
	openExternal: (url) => {
		if (!isAllowedUrl(url)) {
			return Promise.reject(new Error(`Blocked URL scheme: ${url}`));
		}
		return open(url);
	},
	logScrollDebug: (event) => {
		invoke("log_scroll_debug", { event }).catch((err) => {
			if (import.meta.env.DEV) console.warn("[tauri-api] logScrollDebug failed", err);
		});
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
	trackPaneGit: (id, cwd) => invoke("track_pane_git", { id, cwd }),
	createPty: (id, cwd, startupCommand) => invoke("create_pty", { id, cwd, startupCommand }),
	writePty: (id, data) => invoke("write_pty", { id, data }),
	resizePty: (id, cols, rows, pixelWidth, pixelHeight) =>
		invoke("resize_pty", { id, cols, rows, pixelWidth, pixelHeight }),
	killPty: (id) => invoke("kill_pty", { id }),

	// Terminal scroll
	scrollTerminal: (id, offset) => invoke<GridSnapshot>("scroll_terminal", { id, offset }),

	// Terminal colors
	setTerminalColors: (id, ansiColors, foreground, background) =>
		invoke("set_terminal_colors", { id, ansiColors, foreground, background }),

	// Terminal selection — Rust deserializes range as a nested SelectionRange struct
	getSelectionText: (id, range) => {
		// Sanitize to non-negative integers before IPC (Rust expects usize)
		const u = (n: number): number => (Number.isFinite(n) ? Math.max(0, Math.floor(n)) : 0);
		const r: SelectionRange = {
			startRow: u(range.startRow),
			startCol: u(range.startCol),
			endRow: u(range.endRow),
			endCol: u(range.endCol),
		};
		return invoke<string>("get_selection_text", { id, range: r });
	},

	// Terminal grid events — Rust processes PTY data via wezterm-term, sends rendered grid snapshots.
	onTerminalRender: (cb) =>
		createListener<{ id: string; grid: GridSnapshot }>(IPC_EVENTS.terminalRender, ({ id, grid }) =>
			cb(id, grid),
		),

	// PTY lifecycle events
	onPtyExit: (cb) =>
		createListener<{ id: string; exitCode: number }>(IPC_EVENTS.ptyExit, ({ id, exitCode }) =>
			cb(id, exitCode),
		),

	onPtyCwdChanged: (cb) =>
		createListener<{ paneId: string; cwd: string }>(IPC_EVENTS.ptyCwdChanged, ({ paneId, cwd }) =>
			cb(paneId, cwd),
		),

	onPtyBranchChanged: (cb) =>
		createListener<{ paneId: string; branch: string | null }>(
			IPC_EVENTS.ptyBranchChanged,
			({ paneId, branch }) => cb(paneId, branch),
		),

	onPtyPrChanged: (cb) =>
		createListener<{ paneId: string; pr: PrInfo | null }>(
			IPC_EVENTS.ptyPrChanged,
			({ paneId, pr }) => cb(paneId, pr),
		),

	onPtyActivityChanged: (cb) =>
		createListener<{ paneId: string; active: boolean }>(
			IPC_EVENTS.ptyActivityChanged,
			({ paneId, active }) => cb(paneId, active),
		),
};

export const api: KnkodeApi = Object.freeze(_api);
