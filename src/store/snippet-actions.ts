import type { Snippet } from '../shared/types'
import { reorderArray } from '../utils/array'

function persistSnippets(snippets: Snippet[]): void {
	window.api.saveSnippets(snippets).catch((err) => {
		console.error('[store] Failed to save snippets:', err)
	})
}

interface SnippetState {
	snippets: Snippet[]
}

/** Zustand slice creator for snippet CRUD actions. Spread into the main store. */
export function createSnippetSlice(
	set: (partial: Partial<SnippetState>) => void,
	get: () => SnippetState,
) {
	return {
		addSnippet: (name: string, command: string) => {
			const snippet: Snippet = { id: crypto.randomUUID(), name, command }
			const snippets = [...get().snippets, snippet]
			set({ snippets })
			persistSnippets(snippets)
		},

		updateSnippet: (id: string, updates: Pick<Snippet, 'name' | 'command'>) => {
			const snippets = get().snippets.map((s) => (s.id === id ? { ...s, ...updates } : s))
			set({ snippets })
			persistSnippets(snippets)
		},

		removeSnippet: (id: string) => {
			const snippets = get().snippets.filter((s) => s.id !== id)
			set({ snippets })
			persistSnippets(snippets)
		},

		reorderSnippets: (fromIndex: number, toIndex: number) => {
			const snippets = reorderArray(get().snippets, fromIndex, toIndex)
			if (!snippets) return
			set({ snippets })
			persistSnippets(snippets)
		},

		runSnippet: (snippetId: string, paneId: string) => {
			const snippet = get().snippets.find((s) => s.id === snippetId)
			if (!snippet) {
				console.warn('[store] runSnippet: snippet not found', snippetId)
				return
			}
			window.api.writePty(paneId, `${snippet.command}\r`).catch((err) => {
				console.error(`[store] Failed to run snippet in pane ${paneId}:`, err)
			})
		},
	}
}
