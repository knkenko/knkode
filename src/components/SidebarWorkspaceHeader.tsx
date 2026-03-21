import { createPortal } from "react-dom";
import type { ThemePresetName } from "../data/theme-presets";
import { useContextMenu } from "../hooks/useContextMenu";
import { useInlineEdit } from "../hooks/useInlineEdit";
import { getPortalRoot } from "../lib/ui-constants";
import type { Workspace } from "../shared/types";
import { WorkspaceHeaderVariant } from "./sidebar-variants/ThemeRegistry";

interface SidebarWorkspaceHeaderProps {
	workspace: Workspace;
	preset: ThemePresetName;
	isActive: boolean;
	isCollapsed: boolean;
	/** Number of panes in this workspace. Always >= 1. Badge shown when > 1. */
	paneCount: number;
	onToggleCollapse: () => void;
	onActivate: () => void;
	onRename: (name: string) => void;
	onDuplicate: () => void;
	onClose: () => void;
}

export function SidebarWorkspaceHeader({
	workspace,
	preset,
	isActive,
	isCollapsed,
	paneCount,
	onToggleCollapse,
	onActivate,
	onRename,
	onDuplicate,
	onClose,
}: SidebarWorkspaceHeaderProps) {
	const ctx = useContextMenu();

	const { isEditing, inputProps, startEditing } = useInlineEdit(workspace.name, onRename);

	const closeContext = () => {
		ctx.close();
	};

	const handleClick = (e: React.MouseEvent) => {
		if (isEditing) return;
		if (e.shiftKey) {
			onActivate();
		} else if (!isActive) {
			onActivate();
			if (isCollapsed) onToggleCollapse();
		} else {
			onToggleCollapse();
		}
	};

	return (
		<>
			<WorkspaceHeaderVariant
				preset={preset}
				name={workspace.name}
				isActive={isActive}
				isCollapsed={isCollapsed}
				paneCount={paneCount}
				isEditing={isEditing}
				inputProps={inputProps}
				onClick={handleClick}
				onContextMenu={ctx.open}
			/>

			{/* Context menu — portalled to escape overflow-hidden containers */}
			{ctx.isOpen &&
				createPortal(
					<div
						ref={ctx.ref}
						className="ctx-menu fixed z-[300]"
						style={{ left: ctx.position.x, top: ctx.position.y }}
						onKeyDown={(e) => {
							if (e.key === "Escape") closeContext();
						}}
						onMouseDown={(e) => e.stopPropagation()}
					>
						<button
							type="button"
							className="ctx-item"
							onClick={(e) => {
								e.stopPropagation();
								startEditing();
								closeContext();
							}}
						>
							Rename
						</button>
						<button
							type="button"
							className="ctx-item"
							onClick={(e) => {
								e.stopPropagation();
								onDuplicate();
								closeContext();
							}}
						>
							Duplicate
						</button>
						<div className="ctx-separator" />
						<button
							type="button"
							className="ctx-item text-danger"
							onClick={(e) => {
								e.stopPropagation();
								onClose();
								closeContext();
							}}
						>
							Close Workspace
						</button>
					</div>,
					getPortalRoot(),
				)}
		</>
	);
}
