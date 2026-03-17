import { useCallback, useEffect, useRef, useState } from "react";
import { getPaneIdsInOrder } from "../lib/layout-tree";
import { useWorkspaceStore } from "../store/workspace";

interface WorkspaceTabProps {
	workspaceId: string;
	canClose: boolean;
	isRenaming: boolean;
	onContextMenu: (e: React.MouseEvent, workspaceId: string) => void;
	onRenameComplete: () => void;
}

export default function WorkspaceTab({
	workspaceId,
	canClose,
	isRenaming: externalRenaming,
	onContextMenu,
	onRenameComplete,
}: WorkspaceTabProps) {
	const isActive = useWorkspaceStore((s) => s.activeWorkspaceId === workspaceId);
	const name = useWorkspaceStore((s) => s.workspaces[workspaceId]?.name ?? "");
	const color = useWorkspaceStore((s) => s.workspaces[workspaceId]?.color ?? "#6c63ff");
	const paneCount = useWorkspaceStore((s) => {
		const ws = s.workspaces[workspaceId];
		return ws ? getPaneIdsInOrder(ws.layout.tree).length : 0;
	});
	const setActiveWorkspace = useWorkspaceStore((s) => s.setActiveWorkspace);
	const renameWorkspace = useWorkspaceStore((s) => s.renameWorkspace);
	const removeWorkspace = useWorkspaceStore((s) => s.removeWorkspace);

	const [isEditing, setIsEditing] = useState(false);
	const [draft, setDraft] = useState(name);
	const inputRef = useRef<HTMLInputElement>(null);

	// Trigger editing from parent (context menu "Rename") or double-click
	useEffect(() => {
		if (externalRenaming && !isEditing) {
			setIsEditing(true);
		}
	}, [externalRenaming, isEditing]);

	useEffect(() => {
		if (isEditing) {
			setDraft(name);
			requestAnimationFrame(() => inputRef.current?.select());
		}
	}, [isEditing, name]);

	const commitRename = useCallback(() => {
		const trimmed = draft.trim();
		if (trimmed && trimmed !== name) {
			renameWorkspace(workspaceId, trimmed);
		}
		setIsEditing(false);
		onRenameComplete();
	}, [draft, name, renameWorkspace, workspaceId, onRenameComplete]);

	const handleClick = useCallback(() => {
		if (!isActive) setActiveWorkspace(workspaceId);
	}, [isActive, setActiveWorkspace, workspaceId]);

	const handleDoubleClick = useCallback(() => {
		setIsEditing(true);
	}, []);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent) => {
			if (e.key === "Enter") {
				commitRename();
			} else if (e.key === "Escape") {
				setIsEditing(false);
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
				if (!isActive) setActiveWorkspace(workspaceId);
			}
		},
		[isActive, setActiveWorkspace, workspaceId],
	);

	const handleContextMenu = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			onContextMenu(e, workspaceId);
		},
		[onContextMenu, workspaceId],
	);

	return (
		<div
			className={`group flex h-full items-center gap-1.5 border-b-2 px-3 text-xs transition-colors ${
				isActive
					? "bg-white/[0.04] text-neutral-200"
					: "border-transparent text-neutral-500 hover:bg-white/[0.02] hover:text-neutral-400"
			}`}
			style={isActive ? { borderBottomColor: color } : undefined}
			role="tab"
			tabIndex={0}
			aria-selected={isActive}
			onClick={handleClick}
			onDoubleClick={handleDoubleClick}
			onKeyDown={handleTabKeyDown}
			onContextMenu={handleContextMenu}
		>
			{/* Color dot */}
			<span
				className="inline-block size-2 shrink-0 rounded-full"
				style={{ backgroundColor: color }}
			/>

			{/* Name or rename input */}
			{isEditing ? (
				<input
					ref={inputRef}
					className="w-20 bg-transparent text-xs text-neutral-200 outline-none"
					value={draft}
					onChange={(e) => setDraft(e.target.value)}
					onBlur={commitRename}
					onKeyDown={handleKeyDown}
				/>
			) : (
				<span className="max-w-32 truncate">{name}</span>
			)}

			{/* Pane count badge */}
			{paneCount > 1 && (
				<span className="rounded bg-white/[0.06] px-1 text-[10px] text-neutral-500">
					{paneCount}
				</span>
			)}

			{/* Close button */}
			{canClose && (
				<button
					type="button"
					className="ml-0.5 hidden size-4 items-center justify-center rounded text-neutral-500 hover:bg-white/10 hover:text-neutral-300 group-hover:inline-flex"
					onClick={handleClose}
					tabIndex={-1}
				>
					×
				</button>
			)}
		</div>
	);
}
