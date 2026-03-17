import { useCallback } from "react";
import { useWorkspaceStore } from "../store/workspace";
import Terminal from "./Terminal";

interface PaneProps {
	paneId: string;
	workspaceId: string;
}

export default function Pane({ paneId, workspaceId }: PaneProps) {
	const isActive = useWorkspaceStore((s) => s.activePaneId === paneId);
	const connected = useWorkspaceStore((s) => s.paneTerminals[paneId]?.connected ?? false);
	const error = useWorkspaceStore((s) => s.paneTerminals[paneId]?.error ?? null);
	const setActivePane = useWorkspaceStore((s) => s.setActivePane);
	const splitPane = useWorkspaceStore((s) => s.splitPane);
	const closePane = useWorkspaceStore((s) => s.closePane);
	const workspaceColor = useWorkspaceStore((s) => s.workspaces[workspaceId]?.color ?? null);
	const label = useWorkspaceStore(
		(s) => s.workspaces[workspaceId]?.panes[paneId]?.label || "Terminal",
	);

	const handleFocus = useCallback(() => {
		if (isActive) return;
		setActivePane(paneId);
	}, [setActivePane, paneId, isActive]);

	const handleSplitRight = useCallback(() => {
		splitPane(paneId, "horizontal");
	}, [splitPane, paneId]);

	const handleSplitDown = useCallback(() => {
		splitPane(paneId, "vertical");
	}, [splitPane, paneId]);

	const handleClose = useCallback(() => {
		closePane(paneId);
	}, [closePane, paneId]);

	return (
		<div
			className="flex h-full w-full flex-col overflow-hidden"
			role="group"
			aria-label="Terminal pane"
			onMouseDown={handleFocus}
		>
			<div
				className={`group/header flex h-7 shrink-0 items-center border-t-2 px-2 text-xs ${
					isActive ? "bg-white/[0.03]" : "border-transparent"
				}`}
				style={isActive && workspaceColor ? { borderTopColor: workspaceColor } : undefined}
			>
				<span className="truncate text-neutral-500">{label}</span>
				<div className="ml-auto flex items-center gap-0.5 opacity-0 transition-opacity group-hover/header:opacity-100">
					<button
						type="button"
						className="flex size-5 items-center justify-center rounded text-neutral-500 hover:bg-white/10 hover:text-neutral-300"
						onClick={handleSplitRight}
						aria-label="Split pane right"
						title="Split right"
					>
						<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
							<rect x="0.5" y="0.5" width="11" height="11" rx="1" stroke="currentColor" />
							<line x1="6" y1="1" x2="6" y2="11" stroke="currentColor" />
						</svg>
					</button>
					<button
						type="button"
						className="flex size-5 items-center justify-center rounded text-neutral-500 hover:bg-white/10 hover:text-neutral-300"
						onClick={handleSplitDown}
						aria-label="Split pane down"
						title="Split down"
					>
						<svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
							<rect x="0.5" y="0.5" width="11" height="11" rx="1" stroke="currentColor" />
							<line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" />
						</svg>
					</button>
					<button
						type="button"
						className="flex size-5 items-center justify-center rounded text-neutral-500 hover:bg-white/10 hover:text-neutral-300"
						onClick={handleClose}
						aria-label="Close pane"
						title="Close pane"
					>
						<svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
							<line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.2" />
							<line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.2" />
						</svg>
					</button>
				</div>
			</div>
			<div className="min-h-0 flex-1">
				{connected ? (
					<Terminal paneId={paneId} />
				) : (
					<div className="flex h-full items-center justify-center bg-[#1d1f21] text-sm text-neutral-500">
						{error ?? "Connecting..."}
					</div>
				)}
			</div>
		</div>
	);
}
