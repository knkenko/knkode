import { useCallback, useMemo, useRef, useState } from "react";
import { toPresetName } from "../data/theme-presets";
import { useClickOutside } from "../hooks/useClickOutside";
import { useWindowDrag } from "../hooks/useWindowDrag";
import type { Workspace } from "../shared/types";
import { getPaneIdsInOrder, useStore } from "../store";
import { isMac, MACOS_SIDEBAR_TOP_INSET, modKey } from "../utils/platform";
import { SidebarPaneEntry } from "./SidebarPaneEntry";
import { SidebarWorkspaceHeader } from "./SidebarWorkspaceHeader";

import { AttentionDot } from "./sidebar-variants/AgentStatusIndicator";
import {
	CollapsedWorkspaceVariant,
	WorkspaceSectionWrapper,
} from "./sidebar-variants/ThemeRegistry";

/** px */ const SIDEBAR_WIDTH = 200;
/** px — wide enough to contain macOS traffic lights (90px) and show truncated workspace names */ const SIDEBAR_COLLAPSED_WIDTH = 96;

interface SidebarProps {
	onOpenSettings: () => void;
	onOpenHotkeys: () => void;
}

export function Sidebar({ onOpenSettings, onOpenHotkeys }: SidebarProps) {
	const workspaces = useStore((s) => s.workspaces);
	const openWorkspaceIds = useStore((s) => s.appState.openWorkspaceIds);
	const activeWorkspaceId = useStore((s) => s.appState.activeWorkspaceId);
	const sidebarCollapsed = useStore((s) => s.appState.sidebarCollapsed);
	const setActiveWorkspace = useStore((s) => s.setActiveWorkspace);
	const setFocusedPane = useStore((s) => s.setFocusedPane);
	const focusedPaneId = useStore((s) => s.focusedPaneId);
	const toggleSidebar = useStore((s) => s.toggleSidebar);
	const toggleSidebarSection = useStore((s) => s.toggleSidebarSection);
	const collapsedSections = useStore((s) => s.collapsedSidebarSections);
	const openWorkspace = useStore((s) => s.openWorkspace);
	const closeWorkspaceTab = useStore((s) => s.closeWorkspaceTab);
	const createDefaultWorkspace = useStore((s) => s.createDefaultWorkspace);
	const updateWorkspace = useStore((s) => s.updateWorkspace);
	const duplicateWorkspace = useStore((s) => s.duplicateWorkspace);
	const closePane = useStore((s) => s.closePane);

	const handleBarMouseDown = useWindowDrag();

	const paneAgentStatuses = useStore((s) => s.paneAgentStatuses);

	const activePreset = useMemo(() => {
		const active = workspaces.find((w) => w.id === activeWorkspaceId);
		return toPresetName(active?.theme.preset);
	}, [workspaces, activeWorkspaceId]);

	/** Workspace IDs where at least one pane has attention status. */
	const attentionWorkspaceIds = useMemo(() => {
		const ids = new Set<string>();
		for (const ws of workspaces) {
			for (const paneId of Object.keys(ws.panes)) {
				if (paneAgentStatuses[paneId] === "attention") {
					ids.add(ws.id);
					break;
				}
			}
		}
		return ids;
	}, [workspaces, paneAgentStatuses]);

	const [actionError, setActionError] = useState<string | null>(null);
	const errorTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

	const openWorkspaces = useMemo(() => {
		return openWorkspaceIds
			.map((id) => {
				const ws = workspaces.find((w) => w.id === id);
				if (!ws) console.warn("[Sidebar] workspace ID in openWorkspaceIds not found:", id);
				return ws;
			})
			.filter((w): w is Workspace => w !== undefined);
	}, [openWorkspaceIds, workspaces]);

	const closedWorkspaces = useMemo(
		() => workspaces.filter((w) => !openWorkspaceIds.includes(w.id)),
		[openWorkspaceIds, workspaces],
	);

	const [showClosedMenu, setShowClosedMenu] = useState(false);
	const closedMenuRef = useRef<HTMLDivElement>(null);
	useClickOutside(closedMenuRef, () => setShowClosedMenu(false), showClosedMenu);

	const handlePaneClick = useCallback(
		(workspaceId: string, paneId: string) => {
			setActiveWorkspace(workspaceId);
			setFocusedPane(paneId);
		},
		[setActiveWorkspace, setFocusedPane],
	);

	const showTransientError = useCallback((msg: string) => {
		clearTimeout(errorTimerRef.current);
		setActionError(msg);
		errorTimerRef.current = setTimeout(() => setActionError(null), 3000);
	}, []);

	const updateWorkspaceField = useCallback(
		(wsId: string, updates: Partial<Workspace>) => {
			const ws = workspaces.find((w) => w.id === wsId);
			if (!ws) return;
			updateWorkspace({ ...ws, ...updates }).catch((err) => {
				console.error("[sidebar] Failed to update workspace:", err);
				showTransientError("Failed to update workspace");
			});
		},
		[workspaces, updateWorkspace, showTransientError],
	);

	const handleDuplicate = useCallback(
		(wsId: string) => {
			duplicateWorkspace(wsId).catch((err) => {
				console.error("[sidebar] Failed to duplicate workspace:", err);
				showTransientError("Failed to duplicate workspace");
			});
		},
		[duplicateWorkspace, showTransientError],
	);

	const handleNewWorkspace = useCallback(() => {
		createDefaultWorkspace().catch((err) => {
			console.error("[sidebar] Failed to create workspace:", err);
			showTransientError("Failed to create workspace");
		});
	}, [createDefaultWorkspace, showTransientError]);

	return (
		<div
			className="flex flex-col shrink-0 overflow-hidden select-none sidebar-themed"
			style={{ width: sidebarCollapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
			onMouseDown={handleBarMouseDown}
		>
			{/* Top spacing for macOS traffic lights */}
			{isMac && <div className="shrink-0" style={{ height: MACOS_SIDEBAR_TOP_INSET }} />}

			{/* Workspace tree */}
			<div className="flex-1 overflow-y-auto overflow-x-hidden no-drag">
				{sidebarCollapsed ? (
					<CollapsedView
						workspaces={openWorkspaces}
						activeWorkspaceId={activeWorkspaceId}
						attentionWorkspaceIds={attentionWorkspaceIds}
						onActivate={setActiveWorkspace}
					/>
				) : (
					<div className="flex flex-col py-1">
						{openWorkspaces.map((ws) => {
							const isActive = ws.id === activeWorkspaceId;
							const isSectionCollapsed = collapsedSections.has(ws.id);
							const paneIds = getPaneIdsInOrder(ws.layout.tree);
							const canClose = paneIds.length > 1;

							return (
								<div key={ws.id}>
									<WorkspaceSectionWrapper preset={activePreset} isActive={isActive}>
										<div className="relative">
											<SidebarWorkspaceHeader
												workspace={ws}
												preset={activePreset}
												isActive={isActive}
												isCollapsed={isSectionCollapsed}
												paneCount={paneIds.length}
												onToggleCollapse={() => toggleSidebarSection(ws.id)}
												onActivate={() => setActiveWorkspace(ws.id)}
												onRename={(name) => updateWorkspaceField(ws.id, { name })}
												onDuplicate={() => handleDuplicate(ws.id)}
												onClose={() => closeWorkspaceTab(ws.id)}
											/>
											{isSectionCollapsed && attentionWorkspaceIds.has(ws.id) && (
												<AttentionDot size="h-2 w-2" className="absolute top-1/2 -translate-y-1/2 right-2 pointer-events-none" />
											)}
										</div>
										{!isSectionCollapsed && (
											<div className="flex flex-col pb-1">
												{paneIds.map((paneId) => {
													const config = ws.panes[paneId];
													if (!config) return null;
													return (
														<SidebarPaneEntry
															key={paneId}
															paneId={paneId}
															workspaceId={ws.id}
															workspacePreset={activePreset}
															config={config}
															isFocused={focusedPaneId === paneId && isActive}
															canClose={canClose}
															onClick={() => handlePaneClick(ws.id, paneId)}
															{...(canClose ? { onClose: () => closePane(ws.id, paneId) } : {})}
														/>
													);
												})}
											</div>
										)}
									</WorkspaceSectionWrapper>
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Bottom bar — action buttons */}
			<div className="shrink-0 border-t border-edge p-1 no-drag flex items-center gap-0.5">
				{/* Closed workspaces menu */}
				{!sidebarCollapsed && closedWorkspaces.length > 0 && (
					<div ref={closedMenuRef} className="relative">
						<button
							type="button"
							onClick={() => setShowClosedMenu((v) => !v)}
							title={`Reopen closed workspace (${closedWorkspaces.length} available)`}
							aria-label={`Reopen closed workspace (${closedWorkspaces.length} available)`}
							className="flex items-center justify-center h-7 px-1.5 bg-transparent border-none text-content-muted cursor-pointer rounded-sm text-[10px] hover:text-content hover:bg-overlay focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none transition-colors duration-200"
						>
							{closedWorkspaces.length}
							<svg
								width="10"
								height="10"
								viewBox="0 0 10 10"
								fill="none"
								stroke="currentColor"
								strokeWidth="1.5"
								strokeLinecap="round"
								aria-hidden="true"
								className="ml-0.5"
							>
								<path d="M3 4.5L5 6.5L7 4.5" />
							</svg>
						</button>
						{showClosedMenu && (
							<div className="ctx-menu bottom-full left-0 mb-1">
								{closedWorkspaces.map((ws) => (
									<button
										type="button"
										key={ws.id}
										className="ctx-item flex items-center gap-2"
										onClick={() => {
											openWorkspace(ws.id);
											setShowClosedMenu(false);
										}}
									>
										<span
											aria-hidden="true"
											className="w-2.5 h-2.5 rounded-full shrink-0 bg-content-muted"
										/>
										{ws.name}
									</button>
								))}
							</div>
						)}
					</div>
				)}

				{/* New workspace button */}
				<button
					type="button"
					onClick={handleNewWorkspace}
					title={`New workspace (${modKey}+T)`}
					aria-label="Create new workspace"
					className="flex items-center justify-center w-7 h-7 bg-transparent border-none text-content-muted cursor-pointer rounded-sm hover:text-content hover:bg-overlay focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none transition-colors duration-200"
				>
					<svg
						width="12"
						height="12"
						viewBox="0 0 12 12"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						aria-hidden="true"
					>
						<path d="M6 1v10M1 6h10" />
					</svg>
				</button>

				<div className="flex-1" />

				{/* Hotkeys button */}
				<button
					type="button"
					onClick={onOpenHotkeys}
					title="Keyboard shortcuts"
					aria-label="Keyboard shortcuts"
					className="flex items-center justify-center w-7 h-7 bg-transparent border-none text-content-muted cursor-pointer rounded-sm hover:text-content hover:bg-overlay focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none transition-colors duration-200"
				>
					<svg
						width="12"
						height="12"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<circle cx="12" cy="12" r="10" />
						<path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
						<line x1="12" y1="17" x2="12.01" y2="17" />
					</svg>
				</button>

				{/* Settings cog — only when a workspace is active */}
				{activeWorkspaceId && (
					<button
						type="button"
						onClick={onOpenSettings}
						title={`Workspace settings (${modKey}+,)`}
						aria-label="Open workspace settings"
						className="flex items-center justify-center w-7 h-7 bg-transparent border-none text-content-muted cursor-pointer rounded-sm hover:text-content hover:bg-overlay focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none transition-colors duration-200"
					>
						<svg
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
						>
							<circle cx="12" cy="12" r="3" />
							<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
						</svg>
					</button>
				)}

				{/* Collapse toggle */}
				<button
					type="button"
					onClick={toggleSidebar}
					title={`${sidebarCollapsed ? "Expand" : "Collapse"} sidebar (${modKey}+B)`}
					aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
					className="flex items-center justify-center w-7 h-7 bg-transparent border-none text-content-muted cursor-pointer rounded-sm hover:text-content hover:bg-overlay focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none transition-colors duration-200"
				>
					<svg
						width="14"
						height="14"
						viewBox="0 0 14 14"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						aria-hidden="true"
						className={`transition-transform duration-200 ${sidebarCollapsed ? "rotate-180" : ""}`}
					>
						{/* Sidebar collapse icon — chevron rotates 180° when collapsed */}
						<path d="M9 3L5 7L9 11" />
					</svg>
				</button>
			</div>

			{/* Transient error indicator */}
			{actionError && (
				<span className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[10px] text-danger bg-danger/10 rounded px-2 py-0.5 pointer-events-none z-10">
					{actionError}
				</span>
			)}
		</div>
	);
}

function CollapsedView({
	workspaces,
	activeWorkspaceId,
	attentionWorkspaceIds,
	onActivate,
}: {
	workspaces: Workspace[];
	activeWorkspaceId: string | null;
	attentionWorkspaceIds: ReadonlySet<string>;
	onActivate: (id: string) => void;
}) {
	const activePreset = toPresetName(
		workspaces.find((w) => w.id === activeWorkspaceId)?.theme.preset,
	);

	return (
		<div className="flex flex-col py-1">
			{workspaces.map((ws) => {
				const isActive = ws.id === activeWorkspaceId;
				return (
					<div key={ws.id} className="relative">
						<WorkspaceSectionWrapper preset={activePreset} isActive={isActive}>
							<CollapsedWorkspaceVariant
								preset={activePreset}
								name={ws.name}
								isActive={isActive}
								onClick={() => onActivate(ws.id)}
							/>
						</WorkspaceSectionWrapper>
						{attentionWorkspaceIds.has(ws.id) && !isActive && (
							<AttentionDot size="h-2 w-2" className="absolute top-1 right-1" />
						)}
					</div>
				);
			})}
		</div>
	);
}
