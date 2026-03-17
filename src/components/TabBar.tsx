import { useCallback, useState } from "react";
import { useWorkspaceStore } from "../store/workspace";
import TabContextMenu from "./TabContextMenu";
import WorkspaceTab from "./WorkspaceTab";

interface ContextMenuState {
	workspaceId: string;
	x: number;
	y: number;
}

export default function TabBar() {
	const openWorkspaceIds = useWorkspaceStore((s) => s.openWorkspaceIds);
	const createWorkspace = useWorkspaceStore((s) => s.createWorkspace);
	const canClose = openWorkspaceIds.length > 1;

	const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
	const [renamingId, setRenamingId] = useState<string | null>(null);

	const handleContextMenu = useCallback((e: React.MouseEvent, workspaceId: string) => {
		setContextMenu({ workspaceId, x: e.clientX, y: e.clientY });
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

	const initWorkspace = useWorkspaceStore((s) => s.initWorkspace);

	const handleCreate = useCallback(() => {
		const id = createWorkspace();
		initWorkspace(id).catch(console.error);
	}, [createWorkspace, initWorkspace]);

	return (
		<div
			className="flex h-9 shrink-0 items-stretch border-b border-neutral-700 bg-neutral-900"
			role="tablist"
		>
			{openWorkspaceIds.map((id) => (
				<WorkspaceTab
					key={id}
					workspaceId={id}
					canClose={canClose}
					isRenaming={renamingId === id}
					onContextMenu={handleContextMenu}
					onRenameComplete={handleRenameComplete}
				/>
			))}

			{/* New workspace button */}
			<button
				type="button"
				className="flex items-center px-3 text-neutral-500 hover:text-neutral-300"
				onClick={handleCreate}
				title="New workspace"
			>
				<span className="text-sm">+</span>
			</button>

			{contextMenu && (
				<TabContextMenu
					workspaceId={contextMenu.workspaceId}
					x={contextMenu.x}
					y={contextMenu.y}
					onClose={handleCloseMenu}
					onStartRename={handleStartRename}
				/>
			)}
		</div>
	);
}
