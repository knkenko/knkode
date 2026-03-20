import { useState } from "react";
import { createPortal } from "react-dom";
import { useContextMenu } from "../hooks/useContextMenu";
import { useInlineEdit } from "../hooks/useInlineEdit";
import { getPortalRoot } from "../lib/ui-constants";
import type { Workspace } from "../shared/types";

interface SidebarWorkspaceHeaderProps {
	workspace: Workspace;
	isActive: boolean;
	isCollapsed: boolean;
	/** Number of panes in this workspace. Always >= 1. Badge shown when > 1. */
	paneCount: number;
	colors: readonly string[];
	onToggleCollapse: () => void;
	onActivate: () => void;
	onRename: (name: string) => void;
	onChangeColor: (color: string) => void;
	onDuplicate: () => void;
	onClose: () => void;
}

export function SidebarWorkspaceHeader({
	workspace,
	isActive,
	isCollapsed,
	paneCount,
	colors,
	onToggleCollapse,
	onActivate,
	onRename,
	onChangeColor,
	onDuplicate,
	onClose,
}: SidebarWorkspaceHeaderProps) {
	const [showColorPicker, setShowColorPicker] = useState(false);
	const ctx = useContextMenu();

	const { isEditing, inputProps, startEditing } = useInlineEdit(workspace.name, onRename);

	const closeContext = () => {
		ctx.close();
		setShowColorPicker(false);
	};

	return (
		<>
			<button
				type="button"
				title={`${workspace.name} (click to ${isCollapsed ? "expand" : "collapse"}, Shift+click to activate)`}
				onClick={(e) => {
					if (isEditing) return;
					if (e.shiftKey) {
						onActivate();
					} else if (!isActive) {
						onActivate();
						if (isCollapsed) onToggleCollapse();
					} else {
						onToggleCollapse();
					}
				}}
				onContextMenu={ctx.open}
				className={`sidebar-item flex items-center gap-2 w-full px-3 text-left cursor-pointer border-none border-l-[3px] ${
					isActive
						? "sidebar-item-active text-content"
						: "bg-transparent border-transparent text-content-secondary hover:text-content"
				}`}
				style={isActive ? { borderColor: workspace.color } : undefined}
			>
				{/* Collapse chevron */}
				<svg
					width="10"
					height="10"
					viewBox="0 0 10 10"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
					className={`shrink-0 transition-transform duration-200 text-content-muted ${
						isCollapsed ? "-rotate-90" : ""
					}`}
				>
					<path d="M2.5 3.5L5 6.5L7.5 3.5" />
				</svg>

				{/* Workspace name — inline editable */}
				{isEditing ? (
					<input
						{...inputProps}
						maxLength={64}
						onClick={(e) => e.stopPropagation()}
						className="sidebar-header bg-elevated border border-accent rounded-sm text-content text-[11px] py-px px-1 outline-none flex-1 min-w-0"
					/>
				) : (
					<span className="sidebar-header text-[11px] truncate flex-1 min-w-0">{workspace.name}</span>
				)}

				{/* Pane count badge */}
				{paneCount > 1 && (
					<span
						className="text-[9px] leading-none font-medium px-1 py-0.5 rounded-full shrink-0"
						style={{
							background: `color-mix(in srgb, ${workspace.color} 20%, transparent)`,
							color: workspace.color,
						}}
					>
						{paneCount}
					</span>
				)}
			</button>

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
								setShowColorPicker((v) => !v);
							}}
						>
							Change Color
						</button>
						{showColorPicker && (
							<div className="flex flex-wrap gap-1 px-3 py-1 pb-2">
								{colors.map((c) => (
									<button
										type="button"
										key={c}
										aria-label={`Color ${c}`}
										className={`size-4.5 rounded-full border-none cursor-pointer p-0 ${
											c === workspace.color ? "outline-2 outline-content outline-offset-1" : ""
										}`}
										style={{ background: c }}
										onClick={(e) => {
											e.stopPropagation();
											onChangeColor(c);
											closeContext();
										}}
									/>
								))}
							</div>
						)}
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
