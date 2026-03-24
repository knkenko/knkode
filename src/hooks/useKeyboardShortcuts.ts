import { useEffect } from "react";
import {
	clampFontSize,
	DEFAULT_FONT_SIZE,
	PANE_SCROLL_EVENT,
	type PaneScrollDetail,
} from "../shared/types";
import { getPaneIdsInOrder, useStore } from "../store";
import { isModKeyHeld } from "../utils/platform";

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
 * - Mod+B: toggle sidebar collapse
 * - Mod+/: toggle keyboard shortcuts panel
 * - Mod+1-9: focus pane by index
 * - Mod+Down: scroll focused terminal to bottom
 * - Mod+Up: scroll focused terminal to top
 * - Mod+= / Mod++: zoom in (increase font size)
 * - Mod+-: zoom out (decrease font size)
 * - Mod+0: reset font size to workspace default
 */

interface ShortcutOptions {
	toggleSettings?: () => void;
	toggleHotkeys?: () => void;
}

export function useKeyboardShortcuts({ toggleSettings, toggleHotkeys }: ShortcutOptions = {}) {
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			// Skip events already handled by another listener (e.g. key-to-ansi sends
			// Ctrl+Arrow ANSI to the PTY — don't also trigger scroll on Win/Linux)
			if (e.defaultPrevented) return;

			// Check modifier key first to avoid unnecessary state reads on every keypress.
			const isMod = isModKeyHeld(e);
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

			// Mod+B — toggle sidebar collapse
			if (e.key === "b" && !e.shiftKey && !e.altKey) {
				e.preventDefault();
				state.toggleSidebar();
				return;
			}

			// Mod+/ — toggle keyboard shortcuts panel
			if (e.key === "/" && toggleHotkeys) {
				e.preventDefault();
				toggleHotkeys();
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

			// Mod+= / Mod++ — zoom in, Mod+- — zoom out, Mod+0 — reset font size
			// Note: Tauri 2 does not enable native webview zoom hotkeys by default,
			// so these keys are exclusively handled here (no double-fire risk).
			if (e.key === "=" || e.key === "+" || e.key === "-" || e.key === "0") {
				if (!resolvedFocusId || !activeWs) return;
				e.preventDefault();
				const paneConfig = activeWs.panes[resolvedFocusId];
				if (!paneConfig) return;

				if (e.key === "0") {
					// Reset to workspace default — remove per-pane fontSize override
					const { fontSize: _, ...rest } = paneConfig.themeOverride ?? {};
					state.updatePaneConfig(activeWs.id, resolvedFocusId, {
						themeOverride: Object.keys(rest).length > 0 ? rest : null,
					});
				} else {
					const currentSize =
						paneConfig.themeOverride?.fontSize ?? activeWs.theme.fontSize ?? DEFAULT_FONT_SIZE;
					const step = e.key === "-" ? -1 : 1;
					const next = clampFontSize(currentSize + step);
					if (next !== currentSize) {
						state.updatePaneConfig(activeWs.id, resolvedFocusId, {
							themeOverride: { ...(paneConfig.themeOverride ?? {}), fontSize: next },
						});
					}
				}
				return;
			}

			// Mod+Down — scroll focused terminal to bottom
			// Mod+Up — scroll focused terminal to top
			// Exclude altKey so Mod+Alt+Arrow (pane nav) doesn't also trigger scroll
			if ((e.key === "ArrowDown" || e.key === "ArrowUp") && !e.altKey) {
				if (!resolvedFocusId) return;
				e.preventDefault();
				window.dispatchEvent(
					new CustomEvent<PaneScrollDetail>(PANE_SCROLL_EVENT, {
						detail: {
							paneId: resolvedFocusId,
							to: e.key === "ArrowDown" ? "bottom" : "top",
						},
					}),
				);
				return;
			}
		};

		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [toggleSettings, toggleHotkeys]);
}
