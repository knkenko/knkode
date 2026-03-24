import { useCallback, useMemo, useRef, useState } from "react";
import { type ThemePresetName, toPresetName } from "../data/theme-presets";
import { useClickOutside } from "../hooks/useClickOutside";
import { useDragReorder } from "../hooks/useDragReorder";
import type { UpdateActions, UpdateState } from "../hooks/useUpdateChecker";
import { useWindowDrag } from "../hooks/useWindowDrag";
import type { Workspace } from "../shared/types";
import { findSubgroupForPane, getAllPaneIds, useStore } from "../store";
import { isMac, MACOS_SIDEBAR_TOP_INSET, modKey } from "../utils/platform";
import { SidebarPaneEntry } from "./SidebarPaneEntry";
import { SidebarWorkspaceGitInfo } from "./SidebarWorkspaceGitInfo";
import { SidebarWorkspaceHeader } from "./SidebarWorkspaceHeader";
import { AttentionDot } from "./sidebar-variants/AgentStatusIndicator";
import {
	CollapsedWorkspaceVariant,
	WorkspaceSectionWrapper,
} from "./sidebar-variants/ThemeRegistry";
import { UpdateBanner } from "./UpdateBanner";

/** px */ const SIDEBAR_WIDTH = 260;
/** px — wide enough to contain macOS traffic lights (90px) and show truncated workspace names */ const SIDEBAR_COLLAPSED_WIDTH = 96;

interface DragReorderProps {
	dragFromIndex: number | null;
	dragOverIndex: number | null;
	onDragPointerDown: (e: React.PointerEvent, index: number) => void;
}

/** Compute className for a draggable workspace item based on drag state. */
function dragItemClassName(
	dragFromIndex: number | null,
	dragOverIndex: number | null,
	index: number,
): string {
	const isDragSource = dragFromIndex === index;
	const isDropTarget = dragOverIndex === index && dragFromIndex !== null && dragFromIndex !== index;
	return [
		"transition-all duration-150",
		dragFromIndex === null ? "cursor-grab" : "cursor-grabbing",
		isDragSource && "opacity-40",
		isDropTarget && "bg-accent/10",
	]
		.filter(Boolean)
		.join(" ");
}

interface SidebarProps {
	updateState: UpdateState;
	updateActions: UpdateActions;
	onOpenSettings: () => void;
	onOpenHotkeys: () => void;
}

export function Sidebar({
	updateState,
	updateActions,
	onOpenSettings,
	onOpenHotkeys,
}: SidebarProps) {
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
	const setActiveSubgroup = useStore((s) => s.setActiveSubgroup);
	const reorderWorkspaceTabs = useStore((s) => s.reorderWorkspaceTabs);

	const handleBarMouseDown = useWindowDrag();

	const {
		dragFromIndex,
		dragOverIndex,
		handlePointerDown: handleWorkspaceDragPointerDown,
	} = useDragReorder({
		onReorder: reorderWorkspaceTabs,
		containerSelector: "[data-workspace-list]",
		itemSelector: "[data-workspace-item]",
	});

	const [liveMessage, setLiveMessage] = useState("");

	const paneAgentStatuses = useStore((s) => s.paneAgentStatuses);

	const activePreset = useMemo(() => {
		const active = workspaces.find((w) => w.id === activeWorkspaceId);
		return toPresetName(active?.theme.preset);
	}, [workspaces, activeWorkspaceId]);

	/** Per-workspace attention pane counts and the set of workspace IDs with any attention. */
	const { attentionWorkspaceIds, attentionCounts } = useMemo(() => {
		const ids = new Set<string>();
		const counts = new Map<string, number>();
		for (const ws of workspaces) {
			let count = 0;
			for (const paneId of Object.keys(ws.panes)) {
				if (paneAgentStatuses[paneId] === "attention") count++;
			}
			counts.set(ws.id, count);
			if (count > 0) ids.add(ws.id);
		}
		return { attentionWorkspaceIds: ids, attentionCounts: counts };
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

	const handleKeyboardReorder = useCallback(
		(e: React.KeyboardEvent, index: number) => {
			if (!e.altKey) return;
			if (e.key === "ArrowUp" && index > 0) {
				e.preventDefault();
				reorderWorkspaceTabs(index, index - 1);
				const name = openWorkspaces[index]?.name ?? "Workspace";
				setLiveMessage(`Moved ${name} to position ${index}`);
			} else if (e.key === "ArrowDown" && index < openWorkspaces.length - 1) {
				e.preventDefault();
				reorderWorkspaceTabs(index, index + 1);
				const name = openWorkspaces[index]?.name ?? "Workspace";
				setLiveMessage(`Moved ${name} to position ${index + 2}`);
			}
		},
		[reorderWorkspaceTabs, openWorkspaces],
	);

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
			// Switch to the subgroup containing the clicked pane (read imperatively to avoid deps)
			const ws = useStore.getState().workspaces.find((w) => w.id === workspaceId);
			if (ws) {
				const sg = findSubgroupForPane(ws, paneId);
				if (sg && sg.id !== ws.activeSubgroupId) {
					setActiveSubgroup(workspaceId, sg.id);
				}
			}
			setFocusedPane(paneId);
		},
		[setActiveWorkspace, setActiveSubgroup, setFocusedPane],
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
						activePreset={activePreset}
						attentionWorkspaceIds={attentionWorkspaceIds}
						onActivate={setActiveWorkspace}
						onKeyboardReorder={handleKeyboardReorder}
						dragFromIndex={dragFromIndex}
						dragOverIndex={dragOverIndex}
						onDragPointerDown={handleWorkspaceDragPointerDown}
					/>
				) : (
					<ul data-workspace-list className="flex flex-col gap-4 py-1 list-none m-0 p-0">
						{openWorkspaces.map((ws, index) => {
							const isActive = ws.id === activeWorkspaceId;
							const isSectionCollapsed = collapsedSections.has(ws.id);
							const paneIds = getAllPaneIds(ws);
							const canClose = paneIds.length > 1;

							return (
								<li
									key={ws.id}
									data-workspace-item
									aria-roledescription="reorderable workspace"
									aria-label={`${ws.name}, item ${index + 1} of ${openWorkspaces.length}. Use Alt+Arrow keys to reorder`}
									// biome-ignore lint/a11y/noNoninteractiveTabindex: focusable for keyboard reorder (Alt+Arrow)
									tabIndex={0}
									className={dragItemClassName(dragFromIndex, dragOverIndex, index)}
									onKeyDown={(e) => handleKeyboardReorder(e, index)}
								>
									<WorkspaceSectionWrapper preset={activePreset} isActive={isActive}>
										<div
											className="relative"
											onPointerDown={(e) => handleWorkspaceDragPointerDown(e, index)}
										>
											<SidebarWorkspaceHeader
												workspace={ws}
												preset={activePreset}
												isActive={isActive}
												isCollapsed={isSectionCollapsed}
												attentionCount={attentionCounts.get(ws.id) ?? 0}
												onToggleCollapse={() => toggleSidebarSection(ws.id)}
												onActivate={() => setActiveWorkspace(ws.id)}
												onRename={(name) => updateWorkspaceField(ws.id, { name })}
												onDuplicate={() => handleDuplicate(ws.id)}
												onClose={() => closeWorkspaceTab(ws.id)}
											/>
											{isSectionCollapsed && attentionWorkspaceIds.has(ws.id) && (
												<AttentionDot
													size="h-2 w-2"
													className="absolute top-1/2 -translate-y-1/2 right-2 pointer-events-none"
												/>
											)}
										</div>
										{!isSectionCollapsed && (
											<>
												<SidebarWorkspaceGitInfo workspaceId={ws.id} preset={activePreset} />
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
											</>
										)}
									</WorkspaceSectionWrapper>
								</li>
							);
						})}
					</ul>
				)}
			</div>

			{/* Update banner — above bottom bar */}
			<UpdateBanner state={updateState} actions={updateActions} />

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

			{/* Screen reader live region for drag reorder announcements */}
			<span className="sr-only" aria-live="polite">
				{liveMessage}
			</span>
		</div>
	);
}

function CollapsedView({
	workspaces,
	activeWorkspaceId,
	activePreset,
	attentionWorkspaceIds,
	onActivate,
	onKeyboardReorder,
	dragFromIndex,
	dragOverIndex,
	onDragPointerDown,
}: {
	workspaces: Workspace[];
	activeWorkspaceId: string | null;
	activePreset: ThemePresetName;
	attentionWorkspaceIds: ReadonlySet<string>;
	onActivate: (id: string) => void;
	onKeyboardReorder: (e: React.KeyboardEvent, index: number) => void;
} & DragReorderProps) {
	return (
		<ul data-workspace-list className="flex flex-col gap-1 py-1 list-none m-0 p-0">
			{workspaces.map((ws, index) => {
				const isActive = ws.id === activeWorkspaceId;
				return (
					<li
						key={ws.id}
						data-workspace-item
						aria-roledescription="reorderable workspace"
						aria-label={`${ws.name}, item ${index + 1} of ${workspaces.length}. Use Alt+Arrow keys to reorder`}
						// biome-ignore lint/a11y/noNoninteractiveTabindex: focusable for keyboard reorder (Alt+Arrow)
						tabIndex={0}
						className={dragItemClassName(dragFromIndex, dragOverIndex, index)}
						onPointerDown={(e) => onDragPointerDown(e, index)}
						onKeyDown={(e) => onKeyboardReorder(e, index)}
					>
						<WorkspaceSectionWrapper preset={activePreset} isActive={isActive}>
							<div className="relative">
								<CollapsedWorkspaceVariant
									preset={activePreset}
									name={ws.name}
									isActive={isActive}
									onClick={() => onActivate(ws.id)}
								/>
								{attentionWorkspaceIds.has(ws.id) && !isActive && (
									<AttentionDot
										size="h-2 w-2"
										className="absolute top-1/2 -translate-y-1/2 right-1 pointer-events-none"
									/>
								)}
							</div>
						</WorkspaceSectionWrapper>
					</li>
				);
			})}
		</ul>
	);
}
