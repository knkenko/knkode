import type { Snippet, Workspace } from "../shared/types";
import { reorderArray } from "../utils/array";

function persistSnippets(snippets: Snippet[]): void {
	window.api.saveSnippets(snippets).catch((err) => {
		console.error("[store] Failed to save snippets:", err);
	});
}

function persistWorkspace(workspace: Workspace): void {
	window.api.saveWorkspace(workspace).catch((err) => {
		console.error("[store] Failed to save workspace:", err);
	});
}

/** Execute a snippet command in a terminal pane via PTY write. */
function executeSnippet(snippet: Snippet, paneId: string): void {
	window.api.writePty(paneId, `${snippet.command}\r`).catch((err) => {
		console.error(`[store] Failed to run snippet in pane ${paneId}:`, err);
	});
}

/** State required by the snippet slice — includes workspaces for workspace-scoped snippets. */
interface SnippetState {
	snippets: Snippet[];
	workspaces: Workspace[];
}

/** Update a workspace's snippets in the workspaces array.
 *  Returns the new array and updated workspace, or null if the workspace ID is not found. */
function updateWorkspaceSnippets(
	workspaces: readonly Workspace[],
	wsId: string,
	updater: (snippets: readonly Snippet[]) => readonly Snippet[],
): { workspaces: Workspace[]; updated: Workspace } | null {
	const ws = workspaces.find((w) => w.id === wsId);
	if (!ws) {
		console.warn("[store] workspace not found for snippet operation", wsId);
		return null;
	}
	const updated: Workspace = { ...ws, snippets: updater(ws.snippets) };
	return {
		workspaces: workspaces.map((w) => (w.id === wsId ? updated : w)),
		updated,
	};
}

/** Zustand slice creator for global and workspace-scoped snippet actions. Spread into the main store. */
export function createSnippetSlice(
	set: (partial: Partial<SnippetState>) => void,
	get: () => SnippetState,
) {
	return {
		// ── Global snippets ──────────────────────────────────────────

		addSnippet: (name: string, command: string) => {
			if (!name.trim() || !command.trim()) return;
			const snippet: Snippet = { id: crypto.randomUUID(), name, command };
			const snippets = [...get().snippets, snippet];
			set({ snippets });
			persistSnippets(snippets);
		},

		updateSnippet: (id: string, updates: Pick<Snippet, "name" | "command">) => {
			if (!updates.name.trim() || !updates.command.trim()) return;
			const snippets = get().snippets.map((s) => (s.id === id ? { ...s, ...updates } : s));
			set({ snippets });
			persistSnippets(snippets);
		},

		removeSnippet: (id: string) => {
			const snippets = get().snippets.filter((s) => s.id !== id);
			set({ snippets });
			persistSnippets(snippets);
		},

		reorderSnippets: (fromIndex: number, toIndex: number) => {
			const snippets = reorderArray(get().snippets, fromIndex, toIndex);
			if (!snippets) return;
			set({ snippets });
			persistSnippets(snippets);
		},

		runSnippet: (snippetId: string, paneId: string) => {
			const snippet = get().snippets.find((s) => s.id === snippetId);
			if (!snippet) {
				console.warn("[store] runSnippet: snippet not found", snippetId);
				return;
			}
			executeSnippet(snippet, paneId);
		},

		// ── Workspace-scoped snippets ────────────────────────────────

		addWorkspaceSnippet: (wsId: string, name: string, command: string) => {
			if (!name.trim() || !command.trim()) return;
			const snippet: Snippet = { id: crypto.randomUUID(), name, command };
			const result = updateWorkspaceSnippets(get().workspaces, wsId, (s) => [...s, snippet]);
			if (!result) return;
			set({ workspaces: result.workspaces });
			persistWorkspace(result.updated);
		},

		updateWorkspaceSnippet: (
			wsId: string,
			id: string,
			updates: Pick<Snippet, "name" | "command">,
		) => {
			if (!updates.name.trim() || !updates.command.trim()) return;
			const result = updateWorkspaceSnippets(get().workspaces, wsId, (snippets) =>
				snippets.map((s) => (s.id === id ? { ...s, ...updates } : s)),
			);
			if (!result) return;
			set({ workspaces: result.workspaces });
			persistWorkspace(result.updated);
		},

		removeWorkspaceSnippet: (wsId: string, id: string) => {
			const result = updateWorkspaceSnippets(get().workspaces, wsId, (snippets) =>
				snippets.filter((s) => s.id !== id),
			);
			if (!result) return;
			set({ workspaces: result.workspaces });
			persistWorkspace(result.updated);
		},

		reorderWorkspaceSnippets: (wsId: string, fromIndex: number, toIndex: number) => {
			const ws = get().workspaces.find((w) => w.id === wsId);
			if (!ws) {
				console.warn("[store] workspace not found for snippet reorder", wsId);
				return;
			}
			const reordered = reorderArray(ws.snippets, fromIndex, toIndex);
			if (!reordered) return;
			const updated: Workspace = { ...ws, snippets: reordered };
			set({ workspaces: get().workspaces.map((w) => (w.id === wsId ? updated : w)) });
			persistWorkspace(updated);
		},

		runWorkspaceSnippet: (wsId: string, snippetId: string, paneId: string) => {
			const ws = get().workspaces.find((w) => w.id === wsId);
			if (!ws) {
				console.warn("[store] runWorkspaceSnippet: workspace not found", wsId);
				return;
			}
			const snippet = ws.snippets.find((s) => s.id === snippetId);
			if (!snippet) {
				console.warn("[store] runWorkspaceSnippet: snippet not found", snippetId);
				return;
			}
			executeSnippet(snippet, paneId);
		},
	};
}
