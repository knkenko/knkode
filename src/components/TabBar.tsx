import { useCallback, useState } from "react";
import { useWorkspaceStore } from "../store/workspace";
import TabContextMenu from "./TabContextMenu";
import WorkspaceTab from "./WorkspaceTab";

interface ContextMenuState {
	workspaceId: string;
	clientX: number;
	clientY: number;
}

export default function TabBar() {
	const openWorkspaceIds = useWorkspaceStore((s) => s.openWorkspaceIds);
	const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
	const initWorkspace = useWorkspaceStore((s) => s.initWorkspace);
	const canClose = openWorkspaceIds.length > 1;

	const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
	const [renamingId, setRenamingId] = useState<string | null>(null);

	const handleContextMenu = useCallback((e: React.MouseEvent, workspaceId: string) => {
		setContextMenu({ workspaceId, clientX: e.clientX, clientY: e.clientY });
	}, []);

	const handleCloseMenu = useCallback(() => {
		setContextMenu(null);
	}, []);

	const handleStartRename = useCallback((workspaceId: string) => {
		setRenamingId(workspaceId);
		setContextMenu(null);
	}, []);

	const handleRenameComplete = useCallback(() => {
		setRenamingId(null);
	}, []);

	const handleCreate = useCallback(() => {
		const id = createWorkspace();
		initWorkspace(id).catch(console.error);
	}, [createWorkspace, initWorkspace]);

	return (
		<div
			className="flex shrink-0 items-end border-b border-neutral-700/50 bg-neutral-900/80"
			data-tauri-drag-region=""
		>
			<div
				className="flex items-end gap-0.5 overflow-x-auto overflow-y-hidden px-2 pt-1.5"
				role="tablist"
				aria-label="Workspaces"
			>
				{openWorkspaceIds.map((id) => (
					<WorkspaceTab
						key={id}
						workspaceId={id}
						canClose={canClose}
						isRenaming={renamingId === id}
						onContextMenu={handleContextMenu}
						onStartRename={handleStartRename}
						onRenameComplete={handleRenameComplete}
					/>
				))}

				<button
					type="button"
					className="flex h-8 min-w-[36px] shrink-0 items-center justify-center rounded-sm px-2.5 text-neutral-500 transition-colors hover:bg-white/[0.06] hover:text-neutral-300"
					onClick={handleCreate}
					title="New workspace"
					aria-label="New workspace"
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

			{contextMenu && (
				<TabContextMenu
					workspaceId={contextMenu.workspaceId}
					x={contextMenu.clientX}
					y={contextMenu.clientY}
					canClose={canClose}
					onClose={handleCloseMenu}
					onStartRename={handleStartRename}
				/>
			)}
		</div>
	);
}
