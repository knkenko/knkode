import { useCallback, useMemo, useRef, useState } from "react";
import { useClickOutside } from "../hooks/useClickOutside";
import { useWindowDrag } from "../hooks/useWindowDrag";
import type { Workspace } from "../shared/types";
import { getPaneIdsInOrder, useStore } from "../store";
import { isMac, MACOS_SIDEBAR_TOP_INSET, modKey } from "../utils/platform";
import { SidebarPaneEntry } from "./SidebarPaneEntry";
import { SidebarWorkspaceHeader } from "./SidebarWorkspaceHeader";

/** px */ const SIDEBAR_WIDTH = 200;
/** px */ const SIDEBAR_COLLAPSED_WIDTH = 48;

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

	const handleBarMouseDown = useWindowDrag();

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

	return (
		<div
			className="flex flex-col bg-sunken border-r border-edge shrink-0 overflow-hidden select-none"
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
						onActivate={setActiveWorkspace}
					/>
				) : (
					<div className="flex flex-col py-1">
						{openWorkspaces.map((ws) => {
							const isActive = ws.id === activeWorkspaceId;
							const isSectionCollapsed = collapsedSections.has(ws.id);
							const paneIds = getPaneIdsInOrder(ws.layout.tree);

							return (
								<div key={ws.id}>
									<SidebarWorkspaceHeader
										workspace={ws}
										isActive={isActive}
										isCollapsed={isSectionCollapsed}
										paneCount={paneIds.length}
										onToggleCollapse={() => toggleSidebarSection(ws.id)}
										onActivate={() => setActiveWorkspace(ws.id)}
									/>
									{!isSectionCollapsed && (
										<div className="flex flex-col pb-1">
											{paneIds.map((paneId) => {
												const config = ws.panes[paneId];
												if (!config) return null;
												return (
													<SidebarPaneEntry
														key={paneId}
														paneId={paneId}
														config={config}
														isFocused={focusedPaneId === paneId && isActive}
														onClick={() => handlePaneClick(ws.id, paneId)}
													/>
												);
											})}
										</div>
									)}
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
											className="w-2.5 h-2.5 rounded-full shrink-0"
											style={{ background: ws.color }}
										/>
										{ws.name}
									</button>
								))}
							</div>
						)}
					</div>
				)}

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
						{/* Sidebar collapse icon — left-pointing chevron */}
						<path d="M9 3L5 7L9 11" />
					</svg>
				</button>
			</div>
		</div>
	);
}

function CollapsedView({
	workspaces,
	activeWorkspaceId,
	onActivate,
}: {
	workspaces: Workspace[];
	activeWorkspaceId: string | null;
	onActivate: (id: string) => void;
}) {
	return (
		<div className="flex flex-col items-center gap-1.5 py-2">
			{workspaces.map((ws) => {
				const isActive = ws.id === activeWorkspaceId;
				return (
					<button
						key={ws.id}
						type="button"
						onClick={() => onActivate(ws.id)}
						title={ws.name}
						aria-label={`Switch to ${ws.name}`}
						className={`flex items-center justify-center w-8 h-8 rounded-md border-none cursor-pointer transition-colors duration-200 ${
							isActive ? "bg-overlay-active" : "bg-transparent hover:bg-overlay"
						}`}
					>
						<span
							className={`rounded-full ${isActive ? "w-3 h-3" : "w-2.5 h-2.5"}`}
							style={{ background: ws.color }}
						/>
					</button>
				);
			})}
		</div>
	);
}
