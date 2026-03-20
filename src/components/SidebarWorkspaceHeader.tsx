import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useClickOutside } from "../hooks/useClickOutside";
import { useInlineEdit } from "../hooks/useInlineEdit";
import { getPortalRoot } from "../lib/ui-constants";
import type { Workspace } from "../shared/types";

interface SidebarWorkspaceHeaderProps {
	workspace: Workspace;
	isActive: boolean;
	isCollapsed: boolean;
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
	const [showContext, setShowContext] = useState(false);
	const [showColorPicker, setShowColorPicker] = useState(false);
	const [contextPos, setContextPos] = useState({ x: 0, y: 0 });
	const contextRef = useRef<HTMLDivElement>(null);

	const { isEditing, inputProps, startEditing } = useInlineEdit(workspace.name, onRename);

	const handleContextMenu = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setContextPos({ x: e.clientX, y: e.clientY });
		setShowContext(true);
	}, []);

	const closeContext = useCallback(() => {
		setShowContext(false);
		setShowColorPicker(false);
	}, []);

	useClickOutside(contextRef, closeContext, showContext);

	return (
		<>
			<button
				type="button"
				title={`${workspace.name} (click to ${isCollapsed ? "expand" : "collapse"}, Shift+click to activate)`}
				onClick={(e) => {
					if (isEditing) return;
					// Shift+click activates the workspace without toggling collapse.
					// Normal click on a non-active workspace activates + expands;
					// normal click on active workspace toggles collapse.
					if (e.shiftKey) {
						onActivate();
					} else if (!isActive) {
						onActivate();
						if (isCollapsed) onToggleCollapse();
					} else {
						onToggleCollapse();
					}
				}}
				onContextMenu={handleContextMenu}
				className={`flex items-center gap-2 w-full px-3 py-1.5 text-left cursor-pointer border-none border-l-[3px] rounded-sm transition-colors duration-200 ${
					isActive
						? "bg-overlay-active text-content"
						: "bg-transparent border-transparent text-content-secondary hover:bg-overlay hover:text-content"
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

				{/* Color dot */}
				<span
					aria-hidden="true"
					className="w-2 h-2 rounded-full shrink-0"
					style={{ background: workspace.color }}
				/>

				{/* Workspace name — inline editable */}
				{isEditing ? (
					<input
						{...inputProps}
						onClick={(e) => e.stopPropagation()}
						className="bg-elevated border border-accent rounded-sm text-content text-[11px] font-medium py-px px-1 outline-none flex-1 min-w-0"
					/>
				) : (
					<span className="text-[11px] font-medium truncate flex-1 min-w-0">
						{workspace.name}
					</span>
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
			{showContext &&
				createPortal(
					<div
						ref={contextRef}
						className="ctx-menu fixed z-[300]"
						style={{ left: contextPos.x, top: contextPos.y }}
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
											c === workspace.color
												? "outline-2 outline-content outline-offset-1"
												: ""
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
