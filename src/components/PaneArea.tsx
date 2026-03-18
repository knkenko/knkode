import { Allotment } from "allotment";
import { useCallback } from "react";
import "allotment/dist/style.css";
import type { LayoutNode, PaneConfig, Workspace } from "../shared/types";
import { isLayoutBranch } from "../shared/types";
import { getFirstPaneId, useStore } from "../store";
import { Pane } from "./Pane";

interface PaneAreaProps {
	workspace: Workspace;
}

export function PaneArea({ workspace }: PaneAreaProps) {
	const splitPane = useStore((s) => s.splitPane);
	const closePane = useStore((s) => s.closePane);
	const updatePaneConfig = useStore((s) => s.updatePaneConfig);
	const updateNodeSizes = useStore((s) => s.updateNodeSizes);
	const focusedPaneId = useStore((s) => s.focusedPaneId);
	const setFocusedPane = useStore((s) => s.setFocusedPane);
	const paneBranches = useStore((s) => s.paneBranches);
	const panePrs = useStore((s) => s.panePrs);
	const paneCount = Object.keys(workspace.panes).length;

	const handleUpdateConfig = useCallback(
		(paneId: string, updates: Partial<PaneConfig>) => {
			updatePaneConfig(workspace.id, paneId, updates);
		},
		[workspace.id, updatePaneConfig],
	);

	const handleSplit = useCallback(
		(paneId: string, direction: "horizontal" | "vertical") => {
			splitPane(workspace.id, paneId, direction);
		},
		[workspace.id, splitPane],
	);

	const handleClose = useCallback(
		(paneId: string) => {
			closePane(workspace.id, paneId);
		},
		[workspace.id, closePane],
	);

	const renderNode = (node: LayoutNode, path: number[] = []): React.ReactNode => {
		if (!isLayoutBranch(node)) {
			const config = workspace.panes[node.paneId];
			if (!config) return null;
			return (
				<Pane
					key={node.paneId}
					paneId={node.paneId}
					workspaceId={workspace.id}
					config={config}
					workspaceTheme={workspace.theme}
					onUpdateConfig={handleUpdateConfig}
					// iTerm2 convention: "Split Horizontal" = horizontal divider = vertical stacking
					onSplitHorizontal={(id) => handleSplit(id, "vertical")}
					// iTerm2 convention: "Split Vertical" = vertical divider = horizontal (side-by-side)
					onSplitVertical={(id) => handleSplit(id, "horizontal")}
					onClose={handleClose}
					canClose={paneCount > 1}
					branch={paneBranches[node.paneId] ?? null}
					pr={panePrs[node.paneId] ?? null}
					isFocused={focusedPaneId === node.paneId}
					onFocus={setFocusedPane}
				/>
			);
		}

		const isVertical = node.direction === "vertical";

		return (
			<Allotment
				vertical={isVertical}
				key={`${node.direction}-${node.children.length}`}
				// onDragEnd (not onChange) — fires once per drag to avoid per-pixel state writes
				onDragEnd={(sizes) => updateNodeSizes(workspace.id, path, sizes)}
			>
				{node.children.map((child, i) => (
					<Allotment.Pane key={getFirstPaneId(child)} preferredSize={`${child.size}%`}>
						{renderNode(child, [...path, i])}
					</Allotment.Pane>
				))}
			</Allotment>
		);
	};

	return <div className="flex-1 overflow-hidden">{renderNode(workspace.layout.tree)}</div>;
}
