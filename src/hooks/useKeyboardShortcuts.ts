import { useEffect } from "react";
import { getPaneIdsInOrder, useStore } from "../store";
import { isMac } from "../utils/platform";

/** Delta lookup for pane navigation arrows (Left = prev, Right = next). */
const PANE_NAV_DELTAS: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };

/**
 * Global keyboard shortcuts. Uses Cmd (macOS) or Ctrl (other platforms).
 * - Mod+D: split pane side-by-side (vertical divider)
 * - Mod+Shift+D: split pane stacked (horizontal divider)
 * - Mod+W: close focused pane
 * - Mod+Shift+W: close workspace tab
 * - Mod+T: new workspace
 * - Mod+Shift+[: previous workspace tab
 * - Mod+Shift+]: next workspace tab
 * - Mod+Alt/Option+Left/Right: cycle focus to prev/next pane in layout order
 * - Mod+,: toggle settings panel
 * - Mod+1-9: focus pane by index
 */

interface ShortcutOptions {
	toggleSettings?: () => void;
}

export function useKeyboardShortcuts({ toggleSettings }: ShortcutOptions = {}) {
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			// Check modifier key first to avoid unnecessary state reads on every keypress.
			// isMac is a module-level constant (never changes) — safe to omit from deps.
			const isMod = isMac ? e.metaKey : e.ctrlKey;
			if (!isMod) return;

			// Read latest store state imperatively (avoids stale closure)
			const state = useStore.getState();
			const activeWs = state.workspaces.find((w) => w.id === state.appState.activeWorkspaceId);

			// Compute pane list once for all shortcuts that need it
			const paneIds = activeWs ? getPaneIdsInOrder(activeWs.layout.tree) : [];

			// Resolve focused pane — auto-focus first pane if none focused
			const focusedId = state.focusedPaneId;
			const resolvedFocusId =
				focusedId && activeWs?.panes[focusedId] ? focusedId : (paneIds[0] ?? null);

			// Mod+D / Mod+Shift+D — split pane
			if (e.key === "d" || (e.shiftKey && e.key === "D")) {
				if (!resolvedFocusId || !activeWs) return;
				e.preventDefault();
				const direction = e.shiftKey ? "vertical" : "horizontal";
				state.splitPane(activeWs.id, resolvedFocusId, direction);
				return;
			}

			// Mod+W — close pane (only when more than 1 pane)
			if (e.key === "w" && !e.shiftKey) {
				if (!resolvedFocusId || !activeWs) return;
				if (Object.keys(activeWs.panes).length <= 1) return;
				e.preventDefault();
				state.closePane(activeWs.id, resolvedFocusId);
				return;
			}

			// Mod+Shift+W — close workspace tab (keep at least one open)
			if (e.key === "W" && e.shiftKey) {
				if (!activeWs) return;
				if (state.appState.openWorkspaceIds.length <= 1) return;
				e.preventDefault();
				state.closeWorkspaceTab(activeWs.id);
				return;
			}

			// Mod+T — new workspace
			if (e.key === "t" && !e.shiftKey) {
				e.preventDefault();
				state.createDefaultWorkspace().catch((err) => {
					console.error("[shortcuts] Failed to create workspace:", err);
				});
				return;
			}

			// Mod+Shift+[ / Mod+Shift+] — cycle workspace tabs
			// On US keyboard, Shift+[ emits '{' and Shift+] emits '}'
			// Other layouts may emit '['/']' with shiftKey flag
			const isPrevTab = e.key === "{" || (e.key === "[" && e.shiftKey);
			const isNextTab = e.key === "}" || (e.key === "]" && e.shiftKey);
			if (isPrevTab || isNextTab) {
				const { openWorkspaceIds, activeWorkspaceId } = state.appState;
				if (openWorkspaceIds.length < 2 || !activeWorkspaceId) return;
				e.preventDefault();
				const idx = openWorkspaceIds.indexOf(activeWorkspaceId);
				const delta = isPrevTab ? -1 : 1;
				const next = (idx + delta + openWorkspaceIds.length) % openWorkspaceIds.length;
				const targetId = openWorkspaceIds[next];
				if (targetId) state.setActiveWorkspace(targetId);
				return;
			}

			// Mod+Alt/Option+Left/Right — cycle focus to prev/next pane in layout order
			const paneDelta = PANE_NAV_DELTAS[e.key];
			if (e.altKey && paneDelta !== undefined) {
				if (!activeWs || paneIds.length < 2) return;
				e.preventDefault();
				if (!resolvedFocusId) {
					const firstPane = paneIds[0];
					if (firstPane) state.setFocusedPane(firstPane);
					return;
				}
				const currentIdx = paneIds.indexOf(resolvedFocusId);
				const nextIdx = (currentIdx + paneDelta + paneIds.length) % paneIds.length;
				const targetPane = paneIds[nextIdx];
				if (targetPane) state.setFocusedPane(targetPane);
				return;
			}

			// Mod+, — toggle settings panel
			if (e.key === "," && toggleSettings) {
				e.preventDefault();
				toggleSettings();
				return;
			}

			// Mod+1-9 — focus pane by index
			if (e.key >= "1" && e.key <= "9" && !e.shiftKey) {
				if (!activeWs) return;
				const targetId = paneIds[Number(e.key) - 1];
				if (!targetId) return;
				e.preventDefault();
				state.setFocusedPane(targetId);
				return;
			}
		};

		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [toggleSettings]);
}
