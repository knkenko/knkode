import { useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useWorkspaceStore } from "../store/workspace";
import { WORKSPACE_COLORS } from "../types/workspace";

interface TabContextMenuProps {
	workspaceId: string;
	x: number;
	y: number;
	onClose: () => void;
	onStartRename: (workspaceId: string) => void;
}

export default function TabContextMenu({
	workspaceId,
	x,
	y,
	onClose,
	onStartRename,
}: TabContextMenuProps) {
	const menuRef = useRef<HTMLDivElement>(null);
	const duplicateWorkspace = useWorkspaceStore((s) => s.duplicateWorkspace);
	const removeWorkspace = useWorkspaceStore((s) => s.removeWorkspace);
	const setWorkspaceColor = useWorkspaceStore((s) => s.setWorkspaceColor);
	const currentColor = useWorkspaceStore((s) => s.workspaces[workspaceId]?.color ?? "#6c63ff");
	const workspaceCount = useWorkspaceStore((s) => s.openWorkspaceIds.length);

	// Close on outside click or Escape
	useEffect(() => {
		function handleMouseDown(e: MouseEvent) {
			if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
				onClose();
			}
		}
		function handleKeyDown(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("mousedown", handleMouseDown);
		document.addEventListener("keydown", handleKeyDown);
		return () => {
			document.removeEventListener("mousedown", handleMouseDown);
			document.removeEventListener("keydown", handleKeyDown);
		};
	}, [onClose]);

	const handleRename = useCallback(() => {
		onClose();
		onStartRename(workspaceId);
	}, [onClose, onStartRename, workspaceId]);

	const initWorkspace = useWorkspaceStore((s) => s.initWorkspace);

	const handleDuplicate = useCallback(() => {
		const newId = duplicateWorkspace(workspaceId);
		if (newId) initWorkspace(newId).catch(console.error);
		onClose();
	}, [duplicateWorkspace, initWorkspace, workspaceId, onClose]);

	const handleClose = useCallback(() => {
		removeWorkspace(workspaceId);
		onClose();
	}, [removeWorkspace, workspaceId, onClose]);

	const handleColorChange = useCallback(
		(color: (typeof WORKSPACE_COLORS)[number]) => {
			setWorkspaceColor(workspaceId, color);
			onClose();
		},
		[setWorkspaceColor, workspaceId, onClose],
	);

	return createPortal(
		<div
			ref={menuRef}
			className="fixed z-50 min-w-40 rounded-md border border-neutral-700 bg-neutral-800 py-1 shadow-lg"
			style={{ left: x, top: y }}
		>
			<MenuItem label="Rename" onClick={handleRename} />
			<MenuItem label="Duplicate" onClick={handleDuplicate} />

			{/* Color picker row */}
			<div className="flex items-center gap-1 px-3 py-1.5">
				<span className="mr-1 text-xs text-neutral-400">Color</span>
				{WORKSPACE_COLORS.map((c) => (
					<button
						key={c}
						type="button"
						className={`size-4 rounded-full border ${
							c === currentColor ? "border-white" : "border-transparent"
						}`}
						style={{ backgroundColor: c }}
						onClick={() => handleColorChange(c)}
					/>
				))}
			</div>

			{workspaceCount > 1 && (
				<>
					<div className="mx-2 my-1 border-t border-neutral-700" />
					<MenuItem label="Close" onClick={handleClose} destructive />
				</>
			)}
		</div>,
		document.body,
	);
}

function MenuItem({
	label,
	onClick,
	destructive = false,
}: {
	label: string;
	onClick: () => void;
	destructive?: boolean;
}) {
	return (
		<button
			type="button"
			className={`w-full px-3 py-1.5 text-left text-xs ${
				destructive ? "text-red-400 hover:bg-red-500/10" : "text-neutral-300 hover:bg-white/[0.06]"
			}`}
			onClick={onClick}
		>
			{label}
		</button>
	);
}
