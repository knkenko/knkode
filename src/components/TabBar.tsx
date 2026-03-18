import { useCallback, useMemo, useRef, useState } from "react";
import { useClickOutside } from "../hooks/useClickOutside";
import type { Workspace } from "../shared/types";
import { useStore, WORKSPACE_COLORS } from "../store";
import { isMac, modKey } from "../utils/platform";
import { Tab } from "./Tab";

interface TabBarProps {
	onOpenSettings: () => void;
}

export function TabBar({ onOpenSettings }: TabBarProps) {
	const workspaces = useStore((s) => s.workspaces);
	const appState = useStore((s) => s.appState);
	const setActiveWorkspace = useStore((s) => s.setActiveWorkspace);
	const closeWorkspaceTab = useStore((s) => s.closeWorkspaceTab);
	const createDefaultWorkspace = useStore((s) => s.createDefaultWorkspace);
	const updateWorkspace = useStore((s) => s.updateWorkspace);
	const duplicateWorkspace = useStore((s) => s.duplicateWorkspace);
	const openWorkspace = useStore((s) => s.openWorkspace);
	const reorderWorkspaceTabs = useStore((s) => s.reorderWorkspaceTabs);

	const [showClosedMenu, setShowClosedMenu] = useState(false);
	const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
	const dragFromRef = useRef<number | null>(null);
	const closedMenuRef = useRef<HTMLDivElement>(null);
	useClickOutside(closedMenuRef, () => setShowClosedMenu(false), showClosedMenu);

	const resetDragState = useCallback(() => {
		setDragFromIndex(null);
		setDragOverIndex(null);
		dragFromRef.current = null;
	}, []);

	const handleDragStart = useCallback((index: number) => {
		setDragFromIndex(index);
		dragFromRef.current = index;
	}, []);
	const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		setDragOverIndex((prev) => (prev === index ? prev : index));
	}, []);
	const handleDrop = useCallback(
		(toIndex: number) => {
			const from = dragFromRef.current;
			if (from !== null && from !== toIndex) {
				reorderWorkspaceTabs(from, toIndex);
			}
			resetDragState();
		},
		[reorderWorkspaceTabs, resetDragState],
	);
	const handleDragEnd = useCallback(() => {
		resetDragState();
	}, [resetDragState]);

	const openTabs = useMemo(
		() =>
			appState.openWorkspaceIds
				.map((id) => workspaces.find((w) => w.id === id))
				.filter((w): w is Workspace => w !== undefined),
		[appState.openWorkspaceIds, workspaces],
	);

	const closedWorkspaces = useMemo(
		() => workspaces.filter((w) => !appState.openWorkspaceIds.includes(w.id)),
		[appState.openWorkspaceIds, workspaces],
	);

	const updateWorkspaceField = useCallback(
		(id: string, updates: Partial<Workspace>) => {
			const ws = workspaces.find((w) => w.id === id);
			if (ws) updateWorkspace({ ...ws, ...updates });
		},
		[workspaces, updateWorkspace],
	);

	const handleRename = useCallback(
		(id: string, name: string) => updateWorkspaceField(id, { name }),
		[updateWorkspaceField],
	);

	const handleChangeColor = useCallback(
		(id: string, color: string) => updateWorkspaceField(id, { color }),
		[updateWorkspaceField],
	);

	const handleDuplicate = useCallback(
		(id: string) => {
			duplicateWorkspace(id).catch((err: unknown) => {
				console.error("[tabbar] Failed to duplicate workspace:", err);
			});
		},
		[duplicateWorkspace],
	);

	const handleNewWorkspace = useCallback(() => {
		createDefaultWorkspace().catch((err: unknown) => {
			console.error("[tabbar] Failed to create workspace:", err);
		});
	}, [createDefaultWorkspace]);

	return (
		<div
			className="flex items-end bg-sunken border-b border-edge relative shrink-0"
			style={isMac ? { WebkitAppRegion: "drag" } : undefined}
		>
			{/* Tabs */}
			<div
				role="tablist"
				className="no-drag flex items-end gap-0.5 pl-traffic pt-1.5 overflow-x-auto overflow-y-hidden flex-1"
			>
				{openTabs.map((ws, i) => (
					<Tab
						key={ws.id}
						workspace={ws}
						isActive={ws.id === appState.activeWorkspaceId}
						index={i}
						paneCount={Object.keys(ws.panes ?? {}).length}
						onActivate={setActiveWorkspace}
						onClose={closeWorkspaceTab}
						onRename={handleRename}
						onChangeColor={handleChangeColor}
						onDuplicate={handleDuplicate}
						onDragStart={handleDragStart}
						onDragOver={handleDragOver}
						onDrop={handleDrop}
						onDragEnd={handleDragEnd}
						isDragOver={dragOverIndex === i && dragFromIndex !== i}
						isDragging={dragFromIndex === i}
						colors={WORKSPACE_COLORS}
					/>
				))}

				{/* New workspace button */}
				<button
					type="button"
					onClick={handleNewWorkspace}
					title={`New workspace (${modKey}+T)`}
					aria-label="Create new workspace"
					className="bg-transparent border-none text-content-muted cursor-pointer min-w-[44px] px-2.5 h-tab flex items-center justify-center shrink-0 hover:text-content hover:bg-overlay rounded-sm focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none transition-colors duration-300 ease-[var(--ease-mechanical)]"
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
					>
						<path d="M7 2v10M2 7h10" />
					</svg>
				</button>
			</div>

			{/* Gear (settings) button — only shown when a workspace is active */}
			{appState.activeWorkspaceId && (
				<button
					type="button"
					onClick={onOpenSettings}
					title={`Workspace settings (${modKey}+,)`}
					aria-label="Open workspace settings"
					className="no-drag relative bg-transparent border-none text-content-muted cursor-pointer min-w-[44px] px-2.5 h-tab self-center flex items-center justify-center shrink-0 hover:text-content hover:bg-overlay rounded-sm focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none transition-colors duration-300 ease-[var(--ease-mechanical)]"
				>
					<svg
						width="16"
						height="16"
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

			{/* Closed workspaces menu */}
			{closedWorkspaces.length > 0 && (
				<div ref={closedMenuRef} className="no-drag relative mr-2 self-center">
					<button
						type="button"
						onClick={() => setShowClosedMenu((v) => !v)}
						title="Reopen closed workspace"
						aria-label={`Reopen closed workspace (${closedWorkspaces.length} available)`}
						className="bg-transparent border border-edge text-content-muted cursor-pointer text-[11px] min-h-[28px] py-0.5 px-2 rounded-sm hover:text-content hover:border-content-muted focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none transition-colors duration-300 ease-[var(--ease-mechanical)]"
					>
						{closedWorkspaces.length} closed
					</button>
					{showClosedMenu && (
						<div className="ctx-menu top-full right-0 mt-1">
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
		</div>
	);
}
