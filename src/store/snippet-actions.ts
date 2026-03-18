import type { Snippet } from '../shared/types'

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
			const snippets = [...get().snippets]
			if (
				fromIndex < 0 ||
				fromIndex >= snippets.length ||
				toIndex < 0 ||
				toIndex >= snippets.length
			) {
				console.warn('[store] reorderSnippets: index out of range', {
					fromIndex,
					toIndex,
					length: snippets.length,
				})
				return
			}
			if (fromIndex === toIndex) return
			const moved = snippets.splice(fromIndex, 1)[0]
			if (!moved) return
			snippets.splice(toIndex, 0, moved)
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
