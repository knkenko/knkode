import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useClickOutside } from "../hooks/useClickOutside";
import { getPortalRoot, type ScreenPosition, VIEWPORT_MARGIN } from "../lib/ui-constants";
import type { PaneConfig } from "../shared/types";
import { useStore } from "../store";
import { isValidCwd } from "../utils/validation";
import { MoveToWorkspaceSubmenu } from "./MoveToWorkspaceSubmenu";

type ContextPanelKind = "cwd" | "cmd" | "move";

interface PaneContextMenuProps {
	paneId: string;
	workspaceId: string;
	config: PaneConfig;
	canClose: boolean;
	anchorPos: ScreenPosition;
	onUpdateConfig: (updates: Partial<PaneConfig>) => void;
	onSplitVertical: () => void;
	onSplitHorizontal: () => void;
	onClose: () => void;
	onRename: () => void;
	onFocus: () => void;
	onDismiss: () => void;
}

export function PaneContextMenu({
	paneId,
	workspaceId,
	config,
	canClose,
	anchorPos,
	onUpdateConfig,
	onSplitVertical,
	onSplitHorizontal,
	onClose,
	onRename,
	onFocus,
	onDismiss,
}: PaneContextMenuProps) {
	const [clampedPos, setClampedPos] = useState<ScreenPosition | null>(null);
	const [contextPanel, setContextPanel] = useState<ContextPanelKind | null>(null);
	const contextRef = useRef<HTMLDivElement>(null);
	const [cwdInput, setCwdInput] = useState(config.cwd);
	const [cmdInput, setCmdInput] = useState(config.startupCommand ?? "");

	const movePaneToWorkspace = useStore((s) => s.movePaneToWorkspace);
	const workspaces = useStore((s) => s.workspaces);
	const openWorkspaceIds = useStore((s) => s.appState.openWorkspaceIds);
	const ensurePty = useStore((s) => s.ensurePty);
	const killPtys = useStore((s) => s.killPtys);

	const otherOpenWorkspaces = useMemo(
		() => workspaces.filter((w) => openWorkspaceIds.includes(w.id) && w.id !== workspaceId),
		[workspaces, openWorkspaceIds, workspaceId],
	);

	const closeContext = useCallback(() => {
		onDismiss();
		setContextPanel(null);
	}, [onDismiss]);

	useClickOutside(contextRef, closeContext, true);

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") closeContext();
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [closeContext]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: contextPanel intentionally triggers re-clamp on sub-panel toggle
	useLayoutEffect(() => {
		const el = contextRef.current;
		if (!el) return;
		const clamp = () => {
			const { width, height } = el.getBoundingClientRect();
			setClampedPos({
				x: Math.max(
					VIEWPORT_MARGIN,
					Math.min(anchorPos.x, window.innerWidth - width - VIEWPORT_MARGIN),
				),
				y: Math.max(
					VIEWPORT_MARGIN,
					Math.min(anchorPos.y, window.innerHeight - height - VIEWPORT_MARGIN),
				),
			});
		};
		clamp();
		window.addEventListener("resize", clamp);
		return () => window.removeEventListener("resize", clamp);
	}, [anchorPos.x, anchorPos.y, contextPanel]);

	// Portalled to escape pane stacking context — z-order breaks without this
	return createPortal(
		<div
			ref={contextRef}
			className="ctx-menu"
			style={{
				position: "fixed",
				left: clampedPos?.x ?? 0,
				top: clampedPos?.y ?? 0,
				visibility: clampedPos ? "visible" : "hidden",
			}}
			onMouseDown={(e) => e.stopPropagation()}
		>
			<button
				type="button"
				className="ctx-item"
				onClick={() => {
					onSplitVertical();
					closeContext();
				}}
			>
				Split Vertical
			</button>
			<button
				type="button"
				className="ctx-item"
				onClick={() => {
					onSplitHorizontal();
					closeContext();
				}}
			>
				Split Horizontal
			</button>
			{canClose && otherOpenWorkspaces.length > 0 && (
				<>
					<div className="ctx-separator" />
					<button
						type="button"
						className="ctx-item"
						onClick={() => setContextPanel(contextPanel === "move" ? null : "move")}
					>
						Move to Workspace
					</button>
					{contextPanel === "move" && (
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
			<div className="ctx-separator" />
			<button
				type="button"
				className="ctx-item"
				onClick={() => {
					onRename();
					closeContext();
				}}
			>
				Rename
			</button>
			<button
				type="button"
				className="ctx-item"
				onClick={() => {
					setCwdInput(config.cwd);
					setContextPanel(contextPanel === "cwd" ? null : "cwd");
				}}
			>
				Change Directory
			</button>
			{contextPanel === "cwd" && (
				<form
					className="flex gap-1 px-3 py-1 pb-2"
					onSubmit={(e) => {
						e.preventDefault();
						const cwd = cwdInput.trim();
						if (cwd && isValidCwd(cwd)) {
							onUpdateConfig({ cwd });
						}
						closeContext();
					}}
				>
					<input
						type="text"
						value={cwdInput}
						onChange={(e) => setCwdInput(e.target.value)}
						placeholder="/path/to/directory"
						className="ctx-input flex-1 min-w-0"
						autoFocus
					/>
					<button type="submit" className="ctx-submit">
						Set
					</button>
				</form>
			)}
			<button
				type="button"
				className="ctx-item"
				onClick={() => {
					setCmdInput(config.startupCommand ?? "");
					setContextPanel(contextPanel === "cmd" ? null : "cmd");
				}}
			>
				Set Startup Command
			</button>
			{contextPanel === "cmd" && (
				<form
					className="flex gap-1 px-3 py-1 pb-2"
					onSubmit={(e) => {
						e.preventDefault();
						onUpdateConfig({
							startupCommand: cmdInput.trim() || null,
						});
						closeContext();
					}}
				>
					<input
						type="text"
						value={cmdInput}
						onChange={(e) => setCmdInput(e.target.value)}
						placeholder="npm run dev"
						className="ctx-input flex-1 min-w-0"
						autoFocus
					/>
					<button type="submit" className="ctx-submit">
						Set
					</button>
				</form>
			)}
			<div className="ctx-separator" />
			<button
				type="button"
				className="ctx-item"
				onClick={() => {
					killPtys([paneId]);
					ensurePty(paneId, config.cwd, config.startupCommand);
					closeContext();
					onFocus();
				}}
			>
				Restart Pane
			</button>
			{canClose && (
				<button
					type="button"
					className="ctx-item text-danger"
					onClick={() => {
						onClose();
						closeContext();
					}}
				>
					Close Pane
				</button>
			)}
		</div>,
		getPortalRoot(),
	);
}
