import { useState } from "react";
import { createPortal } from "react-dom";
import { useContextMenu } from "../hooks/useContextMenu";
import { getPortalRoot } from "../lib/ui-constants";
import type { PaneConfig, Workspace } from "../shared/types";
import { useStore } from "../store";
import { shortenPath } from "../utils/path";
import { MoveToWorkspaceSubmenu } from "./MoveToWorkspaceSubmenu";

interface SidebarPaneEntryProps {
	paneId: string;
	workspaceId: string;
	config: PaneConfig;
	isFocused: boolean;
	canClose: boolean;
	otherOpenWorkspaces: Workspace[];
	onClick: () => void;
	onClose?: () => void;
}

export function SidebarPaneEntry({
	paneId,
	workspaceId,
	config,
	isFocused,
	canClose,
	otherOpenWorkspaces,
	onClick,
	onClose,
}: SidebarPaneEntryProps) {
	const branch = useStore((s) => s.paneBranches[paneId] ?? null);
	const pr = useStore((s) => s.panePrs[paneId] ?? null);
	const homeDir = useStore((s) => s.homeDir);
	const movePaneToWorkspace = useStore((s) => s.movePaneToWorkspace);

	const shortCwd = shortenPath(config.cwd, homeDir);

	const ctx = useContextMenu();
	const [showMoveMenu, setShowMoveMenu] = useState(false);

	const closeContext = () => {
		ctx.close();
		setShowMoveMenu(false);
	};

	return (
		<>
			<button
				type="button"
				onClick={onClick}
				onContextMenu={ctx.open}
				data-pane-id={paneId}
				className={`flex flex-col gap-0.5 w-full text-left pl-7 pr-3 py-1 border-none cursor-pointer rounded-sm transition-colors duration-200 ${
					isFocused
						? "bg-overlay text-content"
						: "bg-transparent text-content-muted hover:bg-overlay/50 hover:text-content-secondary"
				}`}
			>
				{/* Pane label + branch + PR */}
				<div className="flex items-center gap-1.5 min-w-0">
					<span className={`text-[11px] truncate ${isFocused ? "font-medium" : ""}`}>
						{config.label}
					</span>
					{branch && (
						<span className="text-[10px] text-accent truncate max-w-[80px]">{branch}</span>
					)}
					{pr && (
						<span className="text-[10px] text-accent font-medium shrink-0">#{pr.number}</span>
					)}
				</div>

				{/* CWD */}
				<span className="text-[9px] text-content-muted truncate">{shortCwd}</span>
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
								onClick();
								closeContext();
							}}
						>
							Focus
						</button>
						{/* Only allow move/close when pane can be removed from source workspace */}
						{canClose && otherOpenWorkspaces.length > 0 && (
							<>
								<div className="ctx-separator" />
								<button
									type="button"
									className="ctx-item"
									onClick={(e) => {
										e.stopPropagation();
										setShowMoveMenu((v) => !v);
									}}
								>
									Move to Workspace
								</button>
								{showMoveMenu && (
									<MoveToWorkspaceSubmenu
										workspaces={otherOpenWorkspaces}
										onMove={(toWsId) => {
											movePaneToWorkspace(workspaceId, paneId, toWsId);
											closeContext();
										}}
									/>
								)}
							</>
						)}
						{canClose && onClose && (
							<>
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
									Close Pane
								</button>
							</>
						)}
					</div>,
					getPortalRoot(),
				)}
		</>
	);
}
