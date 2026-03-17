import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import type { CellGrid } from "../types/terminal";

const EVENT_TERMINAL_OUTPUT = "terminal-output";
const EVENT_TERMINAL_EXIT = "terminal-exit";

export interface TerminalState {
	terminalId: string | null;
	grid: CellGrid | null;
	connected: boolean;
	error: string | null;
}

export interface TerminalActions {
	createTerminal: () => Promise<void>;
	destroyTerminal: () => Promise<void>;
	writeToTerminal: (data: string) => Promise<void>;
	resizeTerminal: (cols: number, rows: number) => Promise<void>;
	refreshGrid: () => Promise<void>;
	subscribeToEvents: () => Promise<() => void>;
}

export const useTerminalStore = create<TerminalState & TerminalActions>()((set, get) => {
	let refreshPending = false;

	return {
		terminalId: null,
		grid: null,
		connected: false,
		error: null,

		createTerminal: async () => {
			try {
				const id = await invoke<string>("create_terminal");
				set({ terminalId: id, connected: true, error: null });
			} catch (e) {
				set({ error: `Failed to create terminal: ${e}` });
			}
		},

		destroyTerminal: async () => {
			const { terminalId } = get();
			if (!terminalId) return;
			set({ terminalId: null, grid: null, connected: false });
			try {
				await invoke("destroy_terminal", { id: terminalId });
			} catch (e) {
				console.error("Failed to destroy terminal:", e);
			}
		},

		writeToTerminal: async (data: string) => {
			const { terminalId } = get();
			if (!terminalId) return;
			try {
				await invoke("write_to_terminal", { id: terminalId, data });
			} catch (e) {
				set({ connected: false, error: `Write failed: ${e}` });
			}
		},

		resizeTerminal: async (cols: number, rows: number) => {
			const { terminalId } = get();
			if (!terminalId) return;
			try {
				await invoke("resize_terminal", { id: terminalId, cols, rows });
			} catch (e) {
				console.error("Failed to resize terminal:", e);
			}
		},

		refreshGrid: async () => {
			const { terminalId } = get();
			if (!terminalId) return;
			try {
				const grid = await invoke<CellGrid>("get_terminal_state", { id: terminalId });
				set({ grid });
			} catch (e) {
				console.error("Failed to refresh grid:", e);
			}
		},

		subscribeToEvents: async () => {
			const unlistenOutput = await listen<unknown>(EVENT_TERMINAL_OUTPUT, (event) => {
				if (event.payload !== get().terminalId) return;
				if (refreshPending) return;
				refreshPending = true;
				requestAnimationFrame(() => {
					refreshPending = false;
					get().refreshGrid();
				});
			});

			const unlistenExit = await listen<unknown>(EVENT_TERMINAL_EXIT, (event) => {
				if (event.payload !== get().terminalId) return;
				set({ connected: false });
			});

			return () => {
				unlistenOutput();
				unlistenExit();
			};
		},
	};
});
