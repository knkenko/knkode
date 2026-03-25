import { useCallback, useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { HotkeyPanel } from "./components/HotkeyPanel";
import { PaneArea } from "./components/PaneArea";
import { SettingsPanel } from "./components/SettingsPanel";
import { SessionHistoryModal } from "./components/SessionHistoryModal";
import { Sidebar } from "./components/Sidebar";
import { findPreset } from "./data/theme-presets";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useUpdateChecker } from "./hooks/useUpdateChecker";
import { dispatchRender } from "./lib/render-dispatcher";
import { useStore } from "./store";
import { generateThemeVariables } from "./utils/colors";
import { isWindows, WINDOWS_CAPTION_BUTTON_WIDTH } from "./utils/platform";

export function App() {
	const initialized = useStore((s) => s.initialized);
	const initError = useStore((s) => s.initError);
	const init = useStore((s) => s.init);
	const workspaces = useStore((s) => s.workspaces);
	const appState = useStore((s) => s.appState);
	const updatePaneCwd = useStore((s) => s.updatePaneCwd);
	const updatePaneBranch = useStore((s) => s.updatePaneBranch);
	const updatePanePr = useStore((s) => s.updatePanePr);
	const updatePaneAgentStatus = useStore((s) => s.updatePaneAgentStatus);
	const updatePaneTitle = useStore((s) => s.updatePaneTitle);
	const handlePtyExit = useStore((s) => s.handlePtyExit);
	const visitedWorkspaceIds = useStore((s) => s.visitedWorkspaceIds);

	const [updateState, updateActions] = useUpdateChecker();

	const [showSettings, setShowSettings] = useState(false);
	const [showHotkeys, setShowHotkeys] = useState(false);
	const closeSettings = useCallback(() => {
		setShowSettings(false);
		// Imperatively read store to avoid stale closure over focusedPaneId
		const { focusedPaneId, setFocusedPane } = useStore.getState();
		if (focusedPaneId) setFocusedPane(focusedPaneId);
	}, []);
	const toggleSettings = useCallback(() => setShowSettings((v) => !v), []);
	const toggleHotkeys = useCallback(() => setShowHotkeys((v) => !v), []);

	useKeyboardShortcuts({ toggleSettings, toggleHotkeys });

	useEffect(() => {
		init();
	}, [init]);

	// Window title — visible in task switcher and system UI
	const activeWorkspace = workspaces.find((w) => w.id === appState.activeWorkspaceId);
	const activeWorkspaceName = activeWorkspace?.name;
	useEffect(() => {
		document.title = activeWorkspaceName ? `${activeWorkspaceName} — knkode` : "knkode";
	}, [activeWorkspaceName]);

	// Pre-track all open workspace panes for git info — even those without PTYs.
	// Without this, panes in unvisited workspaces show no branch/PR in the sidebar.
	const openWorkspaceIds = appState.openWorkspaceIds;
	useEffect(() => {
		if (!initialized) return;
		const { workspaces: allWs, activePtyIds } = useStore.getState();
		for (const ws of allWs) {
			if (!openWorkspaceIds.includes(ws.id)) continue;
			for (const [paneId, config] of Object.entries(ws.panes)) {
				if (!activePtyIds.has(paneId)) {
					window.api.trackPaneGit(paneId, config.cwd).catch((err) => {
						console.warn("[app] trackPaneGit failed:", err);
					});
				}
			}
		}
	}, [initialized, openWorkspaceIds]);

	// Single global terminal:render listener — dispatches to per-pane callbacks via Map lookup.
	// Replaces N per-pane listeners that each received all events (N² deserialization).
	useEffect(() => {
		return window.api.onTerminalRender(dispatchRender);
	}, []);

	// Listen for backend PTY events (exit, CWD, git branch, PR status, activity state, terminal title).
	// Unified into a single effect to avoid identical subscribe/lookup patterns.
	useEffect(() => {
		const findWs = (paneId: string) =>
			useStore.getState().workspaces.find((w) => paneId in w.panes);

		const unsubs = [
			window.api.onPtyExit((paneId, exitCode) => {
				if (exitCode === 0) {
					console.debug(`[app] PTY exited: pane=${paneId} code=0`);
				} else {
					console.warn(`[app] PTY exited: pane=${paneId} code=${exitCode}`);
				}
				handlePtyExit(paneId);
			}),
			window.api.onPtyCwdChanged((paneId, cwd) => {
				const ws = findWs(paneId);
				if (ws) updatePaneCwd(ws.id, paneId, cwd);
			}),
			window.api.onPtyBranchChanged((paneId, branch) => {
				const ws = findWs(paneId);
				if (ws) updatePaneBranch(paneId, branch);
			}),
			window.api.onPtyPrChanged((paneId, pr) => {
				const ws = findWs(paneId);
				if (ws) updatePanePr(paneId, pr);
			}),
			window.api.onPtyActivityChanged((paneId, active) => {
				const ws = findWs(paneId);
				if (!ws) return;
				if (active) {
					updatePaneAgentStatus(paneId, "active");
				} else {
					// Went idle — if pane is focused, stay idle; otherwise → attention
					const { focusedPaneId } = useStore.getState();
					updatePaneAgentStatus(paneId, focusedPaneId === paneId ? "idle" : "attention");
				}
			}),
			window.api.onPtyTitleChanged((paneId, title) => {
				const ws = findWs(paneId);
				if (ws) updatePaneTitle(paneId, title);
			}),
		];
		return () => unsubs.forEach((fn) => fn());
	}, [updatePaneCwd, updatePaneBranch, updatePanePr, updatePaneAgentStatus, updatePaneTitle, handlePtyExit]);

	// Must be above early returns to satisfy React's rules of hooks.
	// Returns { vars, failed } so we can show a fallback indicator on failure.
	const { themeStyles, themeFailed } = useMemo(() => {
		if (!activeWorkspace?.theme) return { themeStyles: undefined, themeFailed: false };
		try {
			const t = activeWorkspace.theme;
			const preset = t.preset ? findPreset(t.preset) : undefined;
			if (t.preset && !preset) console.warn("[App] unknown theme preset:", t.preset);
			return {
				themeStyles: generateThemeVariables({
					bg: t.background,
					fg: t.foreground,
					fontFamily: t.fontFamily,
					fontSize: t.fontSize,
					accent: t.accent ?? preset?.accent,
					glow: t.glow ?? preset?.glow,
					sidebar: preset?.sidebar,
				}),
				themeFailed: false,
			};
		} catch (err) {
			console.error("[App] theme generation failed:", err);
			return { themeStyles: undefined, themeFailed: true };
		}
	}, [activeWorkspace?.theme]);

	// Must be above early returns — hooks must run in the same order every render
	const visitedWorkspaces = useMemo(
		() => workspaces.filter((w) => visitedWorkspaceIds.includes(w.id)),
		[workspaces, visitedWorkspaceIds],
	);

	if (!initialized) {
		return (
			<div className="flex items-center justify-center h-full bg-canvas">
				<span className="text-content-muted">Loading...</span>
			</div>
		);
	}

	if (initError) {
		return (
			<div className="flex items-center justify-center h-full bg-canvas">
				<span className="text-danger">Failed to load: {initError}</span>
			</div>
		);
	}

	return (
		<ErrorBoundary>
			<div
				className="flex flex-row h-full w-full relative"
				style={{
					...themeStyles,
					...(isWindows && { "--spacing-caption": WINDOWS_CAPTION_BUTTON_WIDTH }),
					color: "var(--color-content)",
					fontFamily: "var(--font-family-ui)",
					fontSize: "var(--font-size-ui)",
				}}
			>
				<Sidebar
					updateState={updateState}
					updateActions={updateActions}
					onOpenSettings={toggleSettings}
					onOpenHotkeys={() => setShowHotkeys(true)}
				/>
				<div className="flex flex-col flex-1 min-w-0">
					{themeFailed && (
						<div className="px-3 py-1 text-xs text-danger bg-danger/10 border-b border-danger/20">
							Theme failed to load — using defaults.
						</div>
					)}
					{visitedWorkspaces.length > 0 ? (
						<>
							<div className="relative flex flex-1 overflow-hidden">
								{visitedWorkspaces.map((ws) => (
									<div
										key={ws.id}
										className={
											ws.id === appState.activeWorkspaceId
												? "absolute inset-0 flex flex-col"
												: "absolute inset-0 invisible pointer-events-none"
										}
									>
										<ErrorBoundary>
											<PaneArea workspace={ws} />
										</ErrorBoundary>
									</div>
								))}
							</div>
							{showSettings && activeWorkspace && (
								<SettingsPanel
									workspace={activeWorkspace}
									updateState={updateState}
									updateActions={updateActions}
									onClose={closeSettings}
								/>
							)}
						</>
					) : (
						<div className="flex items-center justify-center flex-1 bg-canvas">
							<p className="text-content-muted text-sm">
								No workspace open. Click + to create one.
							</p>
						</div>
					)}
					{showHotkeys && <HotkeyPanel onClose={() => setShowHotkeys(false)} />}
				</div>
				<SessionHistoryModal />
				{/* Portal root for menus that need to escape pane stacking/overflow
				    but still inherit theme CSS variables */}
				<div id="portal-root" />
			</div>
		</ErrorBoundary>
	);
}
