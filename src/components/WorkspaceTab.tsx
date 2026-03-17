import { memo, useCallback, useEffect, useRef, useState } from "react";
import { countPanes } from "../lib/layout-tree";
import { useWorkspaceStore } from "../store/workspace";
import { DEFAULT_WORKSPACE_COLOR } from "../types/workspace";

interface WorkspaceTabProps {
	workspaceId: string;
	canClose: boolean;
	isRenaming: boolean;
	onContextMenu: (e: React.MouseEvent, workspaceId: string) => void;
	onStartRename: (workspaceId: string) => void;
	onRenameComplete: () => void;
}

export default memo(function WorkspaceTab({
	workspaceId,
	canClose,
	isRenaming,
	onContextMenu,
	onStartRename,
	onRenameComplete,
}: WorkspaceTabProps) {
	const isActive = useWorkspaceStore((s) => s.activeWorkspaceId === workspaceId);
	const name = useWorkspaceStore((s) => s.workspaces[workspaceId]?.name ?? "");
	const color = useWorkspaceStore(
		(s) => s.workspaces[workspaceId]?.color ?? DEFAULT_WORKSPACE_COLOR,
	);
	const paneCount = useWorkspaceStore((s) => {
		const ws = s.workspaces[workspaceId];
		return ws ? countPanes(ws.layout.tree) : 0;
	});
	const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
	const renameWorkspace = useWorkspaceStore((s) => s.renameWorkspace);
	const removeWorkspace = useWorkspaceStore((s) => s.removeWorkspace);

	const [draft, setDraft] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);

	// Trigger editing from parent via context menu "Rename"
	useEffect(() => {
		if (isRenaming) {
			setDraft(name);
			requestAnimationFrame(() => inputRef.current?.select());
		}
	}, [isRenaming, name]);

	const commitRename = useCallback(() => {
		const trimmed = draft.trim();
		if (trimmed && trimmed !== name) {
			renameWorkspace(workspaceId, trimmed);
		}
		onRenameComplete();
	}, [draft, name, renameWorkspace, workspaceId, onRenameComplete]);

	const handleClick = useCallback(() => {
		if (!isActive) setActiveWorkspace(workspaceId);
	}, [isActive, setActiveWorkspace, workspaceId]);

	const handleDoubleClick = useCallback(() => {
		onStartRename(workspaceId);
	}, [onStartRename, workspaceId]);

	const handleInputKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			e.stopPropagation();
			if (e.key === "Enter") {
				commitRename();
			} else if (e.key === "Escape") {
				onRenameComplete();
			}
		},
		[commitRename, onRenameComplete],
	);

	const handleClose = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			removeWorkspace(workspaceId);
		},
		[removeWorkspace, workspaceId],
	);

	const handleTabKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter" || e.key === " ") {
				e.preventDefault();
				handleClick();
			}
		},
		[handleClick],
	);

	const handleContextMenu = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			onContextMenu(e, workspaceId);
		},
		[onContextMenu, workspaceId],
	);

	const isEditing = isRenaming;

	return (
		<div
			className={`group flex h-8 flex-[0_1_200px] min-w-[100px] max-w-[240px] items-center gap-1.5 rounded-t-md border-l-[3px] px-3 text-xs transition-colors ${
				isActive
					? "bg-white/[0.04] text-neutral-200"
					: "border-transparent text-neutral-500 hover:bg-white/[0.02] hover:text-neutral-400"
			}`}
			style={isActive ? { borderLeftColor: color } : undefined}
			role="tab"
			tabIndex={0}
			aria-selected={isActive}
			onClick={handleClick}
			onDoubleClick={handleDoubleClick}
			onKeyDown={handleTabKeyDown}
			onContextMenu={handleContextMenu}
		>
			{isEditing ? (
				<input
					ref={inputRef}
					className="min-w-0 flex-1 bg-transparent text-xs text-neutral-200 outline-none"
					value={draft}
					maxLength={128}
					onChange={(e) => setDraft(e.target.value)}
					onBlur={commitRename}
					onKeyDown={handleInputKeyDown}
				/>
			) : (
				<span className="min-w-0 flex-1 truncate">{name}</span>
			)}

			{paneCount > 1 && (
				<span
					className="shrink-0 rounded px-1 text-[10px]"
					style={{
						backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)`,
						color,
					}}
				>
					{paneCount}
				</span>
			)}

			{canClose && (
				<button
					type="button"
					className={`ml-0.5 shrink-0 items-center justify-center rounded text-neutral-500 hover:bg-white/10 hover:text-neutral-300 ${
						isActive ? "inline-flex size-4 opacity-100" : "hidden size-4 group-hover:inline-flex"
					}`}
					onClick={handleClose}
					aria-label="Close workspace"
					tabIndex={-1}
				>
					×
				</button>
			)}
		</div>
	);
});
