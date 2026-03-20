import { getCurrentWindow } from "@tauri-apps/api/window";
import { useCallback, useMemo } from "react";
import type { Workspace } from "../shared/types";
import { useStore } from "../store";
import { isMac, modKey } from "../utils/platform";
import { SidebarPaneEntry } from "./SidebarPaneEntry";
import { SidebarWorkspaceHeader } from "./SidebarWorkspaceHeader";

const SIDEBAR_WIDTH = 200;
const SIDEBAR_COLLAPSED_WIDTH = 48;

export function Sidebar() {
	const workspaces = useStore((s) => s.workspaces);
	const appState = useStore((s) => s.appState);
	const setActiveWorkspace = useStore((s) => s.setActiveWorkspace);
	const setFocusedPane = useStore((s) => s.setFocusedPane);
	const focusedPaneId = useStore((s) => s.focusedPaneId);
	const paneBranches = useStore((s) => s.paneBranches);
	const panePrs = useStore((s) => s.panePrs);
	const homeDir = useStore((s) => s.homeDir);
	const toggleSidebar = useStore((s) => s.toggleSidebar);
	const toggleSidebarSection = useStore((s) => s.toggleSidebarSection);
	const collapsedSections = useStore((s) => s.collapsedSidebarSections);

	const collapsed = appState.sidebarCollapsed;

	const openWorkspaces = useMemo(
		() =>
			appState.openWorkspaceIds
				.map((id) => workspaces.find((w) => w.id === id))
				.filter((w): w is Workspace => w !== undefined),
		[appState.openWorkspaceIds, workspaces],
	);

	const handlePaneClick = useCallback(
		(workspaceId: string, paneId: string) => {
			setActiveWorkspace(workspaceId);
			setFocusedPane(paneId);
		},
		[setActiveWorkspace, setFocusedPane],
	);

	const handleBarMouseDown = useCallback((e: React.MouseEvent) => {
		if (e.button !== 0) return;
		if ((e.target as HTMLElement).closest(".no-drag")) return;
		e.preventDefault();
		getCurrentWindow().startDragging();
	}, []);

	return (
		<div
			className="flex flex-col bg-sunken border-r border-edge shrink-0 overflow-hidden select-none"
			style={{ width: collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_WIDTH }}
			onMouseDown={handleBarMouseDown}
		>
			{/* Top spacing for macOS traffic lights */}
			{isMac && <div className="h-[52px] shrink-0" />}

			{/* Workspace tree */}
			<div className="flex-1 overflow-y-auto overflow-x-hidden no-drag">
				{collapsed ? (
					<CollapsedView
						workspaces={openWorkspaces}
						activeWorkspaceId={appState.activeWorkspaceId}
						onActivate={setActiveWorkspace}
					/>
				) : (
					<div className="flex flex-col py-1">
						{openWorkspaces.map((ws) => {
							const isActive = ws.id === appState.activeWorkspaceId;
							const isSectionCollapsed = collapsedSections.has(ws.id);
							const paneEntries = Object.entries(ws.panes);

							return (
								<div key={ws.id}>
									<SidebarWorkspaceHeader
										workspace={ws}
										isActive={isActive}
										isCollapsed={isSectionCollapsed}
										onToggleCollapse={() => toggleSidebarSection(ws.id)}
										onActivate={() => setActiveWorkspace(ws.id)}
									/>
									{!isSectionCollapsed && (
										<div className="flex flex-col pb-1">
											{paneEntries.map(([paneId, config]) => (
												<SidebarPaneEntry
													key={paneId}
													paneId={paneId}
													config={config}
													branch={paneBranches[paneId] ?? null}
													pr={panePrs[paneId] ?? null}
													isFocused={focusedPaneId === paneId && isActive}
													homeDir={homeDir}
													onClick={() => handlePaneClick(ws.id, paneId)}
												/>
											))}
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}
			</div>

			{/* Bottom bar — collapse toggle */}
			<div className="shrink-0 border-t border-edge p-1 no-drag">
				<button
					type="button"
					onClick={toggleSidebar}
					title={`${collapsed ? "Expand" : "Collapse"} sidebar (${modKey}+B)`}
					aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
					className="flex items-center justify-center w-full h-7 bg-transparent border-none text-content-muted cursor-pointer rounded-sm hover:text-content hover:bg-overlay focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none transition-colors duration-200"
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
						className={`transition-transform duration-200 ${collapsed ? "rotate-180" : ""}`}
					>
						{/* Sidebar collapse icon — left-pointing arrows */}
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
							isActive
								? "bg-overlay-active"
								: "bg-transparent hover:bg-overlay"
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
