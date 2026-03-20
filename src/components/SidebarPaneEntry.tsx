import { useState } from "react";
import { createPortal } from "react-dom";
import { useContextMenu } from "../hooks/useContextMenu";
import { getPortalRoot } from "../lib/ui-constants";
import { DEFAULT_PRESET_NAME } from "../data/theme-presets";
import type { PaneConfig, Workspace } from "../shared/types";
import { useStore } from "../store";
import { shortenPath } from "../utils/path";
import { MoveToWorkspaceSubmenu } from "./MoveToWorkspaceSubmenu";
import { PaneEntryVariant } from "./sidebar-variants/ThemeRegistry";

interface SidebarPaneEntryProps {
	paneId: string;
	workspaceId: string;
	workspacePreset?: string | undefined;
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
	workspacePreset,
	config,
	isFocused,
	canClose,
	otherOpenWorkspaces,
	onClick,
	onClose,
}: SidebarPaneEntryProps) {
	const branch = useStore((s) => s.paneBranches[paneId] ?? null);
	const pr = useStore((s) => s.panePrs[paneId] ?? null);
	const agentStatus = useStore((s) => s.paneAgentStatuses[paneId] ?? "idle");
	const homeDir = useStore((s) => s.homeDir);
	const movePaneToWorkspace = useStore((s) => s.movePaneToWorkspace);

	const shortCwd = shortenPath(config.cwd, homeDir);
	const preset = config.themeOverride?.preset ?? workspacePreset ?? DEFAULT_PRESET_NAME;

	const ctx = useContextMenu();
	const [showMoveMenu, setShowMoveMenu] = useState(false);

	const closeContext = () => {
		ctx.close();
		setShowMoveMenu(false);
	};

	return (
		<>
			<PaneEntryVariant
				preset={preset}
				paneId={paneId}
				label={config.label}
				cwd={shortCwd}
				branch={branch}
				pr={pr}
				agentStatus={agentStatus}
				isFocused={isFocused}
				onClick={onClick}
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
