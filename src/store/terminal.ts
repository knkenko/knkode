import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { create } from "zustand";
import type { CellGrid } from "../types/terminal";

interface TerminalState {
	terminalId: string | null;
	grid: CellGrid | null;
	connected: boolean;
}

interface TerminalActions {
	createTerminal: () => Promise<void>;
	destroyTerminal: () => Promise<void>;
	writeToTerminal: (data: string) => Promise<void>;
	resizeTerminal: (cols: number, rows: number) => Promise<void>;
	refreshGrid: () => Promise<void>;
	subscribeToEvents: () => Promise<() => void>;
}

export const useTerminalStore = create<TerminalState & TerminalActions>()((set, get) => ({
	terminalId: null,
	grid: null,
	connected: false,

	createTerminal: async () => {
		const id = await invoke<string>("create_terminal");
		set({ terminalId: id, connected: true });
	},

	destroyTerminal: async () => {
		const { terminalId } = get();
		if (!terminalId) return;
		await invoke("destroy_terminal", { id: terminalId });
		set({ terminalId: null, grid: null, connected: false });
	},

	writeToTerminal: async (data: string) => {
		const { terminalId } = get();
		if (!terminalId) return;
		await invoke("write_to_terminal", { id: terminalId, data });
	},

	resizeTerminal: async (cols: number, rows: number) => {
		const { terminalId } = get();
		if (!terminalId) return;
		await invoke("resize_terminal", { id: terminalId, cols, rows });
	},

	refreshGrid: async () => {
		const { terminalId } = get();
		if (!terminalId) return;
		const grid = await invoke<CellGrid>("get_terminal_state", { id: terminalId });
		set({ grid });
	},

	subscribeToEvents: async () => {
		const unlistenOutput = await listen<string>("terminal-output", () => {
			get().refreshGrid();
		});

		const unlistenExit = await listen<string>("terminal-exit", () => {
			set({ connected: false });
		});

		return () => {
			unlistenOutput();
			unlistenExit();
		};
	},
}));
