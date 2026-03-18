import { useCallback, useEffect, useMemo, useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PaneArea } from './components/PaneArea'
import { SettingsPanel } from './components/SettingsPanel'
import { TabBar } from './components/TabBar'
import { findPreset } from './data/theme-presets'
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts'
import { useStore } from './store'
import { generateThemeVariables } from './utils/colors'
import { isMac } from './utils/platform'

export function App() {
	const initialized = useStore((s) => s.initialized)
	const initError = useStore((s) => s.initError)
	const init = useStore((s) => s.init)
	const workspaces = useStore((s) => s.workspaces)
	const appState = useStore((s) => s.appState)
	const updatePaneCwd = useStore((s) => s.updatePaneCwd)
	const updatePaneBranch = useStore((s) => s.updatePaneBranch)
	const updatePanePr = useStore((s) => s.updatePanePr)
	const visitedWorkspaceIds = useStore((s) => s.visitedWorkspaceIds)

	const [showSettings, setShowSettings] = useState(false)
	const closeSettings = useCallback(() => {
		setShowSettings(false)
		// Re-focus the terminal pane when the settings panel closes
		const { focusedPaneId, setFocusedPane } = useStore.getState()
		if (focusedPaneId) setFocusedPane(focusedPaneId)
	}, [])
	const toggleSettings = useCallback(() => setShowSettings((v) => !v), [])

	useKeyboardShortcuts({ toggleSettings })

	useEffect(() => {
		init()
	}, [init])

	// Window title — visible in task switcher and system UI
	const activeWorkspace = workspaces.find((w) => w.id === appState.activeWorkspaceId)
	const activeWorkspaceName = activeWorkspace?.name
	useEffect(() => {
		document.title = activeWorkspaceName ? `${activeWorkspaceName} — knkode` : 'knkode'
	}, [activeWorkspaceName])

	// Listen for CWD changes from the backend
	useEffect(() => {
		const unsubscribe = window.api.onPtyCwdChanged((paneId, cwd) => {
			const ws = useStore.getState().workspaces.find((w) => paneId in w.panes)
			if (ws) updatePaneCwd(ws.id, paneId, cwd)
		})
		return unsubscribe
	}, [updatePaneCwd])

	// Listen for git branch changes from the backend
	useEffect(() => {
		const unsubscribe = window.api.onPtyBranchChanged((paneId, branch) => {
			const ws = useStore.getState().workspaces.find((w) => paneId in w.panes)
			if (ws) updatePaneBranch(paneId, branch)
		})
		return unsubscribe
	}, [updatePaneBranch])

	// Listen for PR status changes from the backend
	useEffect(() => {
		const unsubscribe = window.api.onPtyPrChanged((paneId, pr) => {
			const ws = useStore.getState().workspaces.find((w) => paneId in w.panes)
			if (ws) updatePanePr(paneId, pr)
		})
		return unsubscribe
	}, [updatePanePr])

	// Must be above early returns to satisfy React's rules of hooks
	const themeStyles = useMemo(() => {
		if (!activeWorkspace?.theme) return undefined
		try {
			const t = activeWorkspace.theme
			const preset = t.preset ? findPreset(t.preset) : undefined
			if (t.preset && !preset) console.warn('[App] unknown theme preset:', t.preset)
			return generateThemeVariables({
				bg: t.background,
				fg: t.foreground,
				fontFamily: t.fontFamily,
				fontSize: t.fontSize,
				accent: t.accent ?? preset?.accent,
				glow: t.glow ?? preset?.glow,
			})
		} catch (err) {
			console.error('[App] theme generation failed:', err)
			return undefined
		}
	}, [activeWorkspace?.theme])

	if (!initialized) {
		return (
			<div className="flex items-center justify-center h-full bg-canvas">
				<span className="text-content-muted">Loading...</span>
			</div>
		)
	}

	if (initError) {
		return (
			<div className="flex items-center justify-center h-full bg-canvas">
				<span className="text-danger">Failed to load: {initError}</span>
			</div>
		)
	}

	const visitedWorkspaces = workspaces.filter((w) => visitedWorkspaceIds.includes(w.id))

	return (
		<ErrorBoundary>
			<div
				className="flex flex-col h-full w-full relative"
				style={{
					...themeStyles,
					...(isMac && { '--spacing-traffic': '78px' }),
					color: 'var(--color-content)',
					fontFamily: 'var(--font-family-ui)',
					fontSize: 'var(--font-size-ui)',
				}}
			>
				<TabBar onOpenSettings={() => setShowSettings(true)} />
				{visitedWorkspaces.length > 0 ? (
					<>
						<div className="relative flex flex-1 overflow-hidden">
							{visitedWorkspaces.map((ws) => (
								<div
									key={ws.id}
									className={
										ws.id === appState.activeWorkspaceId
											? 'absolute inset-0 flex flex-col'
											: 'absolute inset-0 invisible pointer-events-none'
									}
								>
									<ErrorBoundary>
										<PaneArea workspace={ws} />
									</ErrorBoundary>
								</div>
							))}
						</div>
						{showSettings && activeWorkspace && (
							<SettingsPanel workspace={activeWorkspace} onClose={closeSettings} />
						)}
					</>
				) : (
					<div className="flex items-center justify-center flex-1 bg-canvas">
						<p className="text-content-muted text-sm">
							No workspace open. Click + to create one.{' '}
							{!activeWorkspace && `(Debug: activeId=${appState.activeWorkspaceId})`}
						</p>
					</div>
				)}
				{/* Portal root for menus that need to escape pane stacking/overflow
				    but still inherit theme CSS variables */}
				<div id="portal-root" />
			</div>
		</ErrorBoundary>
	)
}
