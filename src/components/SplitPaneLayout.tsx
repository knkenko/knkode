import { Allotment } from "allotment";
import "allotment/dist/style.css";
import { useCallback, useEffect, useRef } from "react";
import { getFirstPaneId } from "../lib/layout-tree";
import { useWorkspaceStore } from "../store/workspace";
import type { LayoutBranch, LayoutNode } from "../types/workspace";
import Pane from "./Pane";

const PANE_MIN_SIZE = 100;
const SIZE_PERSIST_DEBOUNCE_MS = 250;

interface SplitPaneLayoutProps {
	workspaceId: string;
	tree: LayoutNode;
	workspaceColor: string;
}

export default function SplitPaneLayout({
	workspaceId,
	tree,
	workspaceColor,
}: SplitPaneLayoutProps) {
	return (
		<LayoutNodeRenderer
			node={tree}
			path={[]}
			workspaceId={workspaceId}
			workspaceColor={workspaceColor}
		/>
	);
}

// -- Node renderer (dispatches to Pane or BranchRenderer) --

interface LayoutNodeRendererProps {
	node: LayoutNode;
	path: readonly number[];
	workspaceId: string;
	workspaceColor: string;
}

function LayoutNodeRenderer({ node, path, workspaceId, workspaceColor }: LayoutNodeRendererProps) {
	if (node.type === "leaf") {
		return <Pane paneId={node.paneId} workspaceColor={workspaceColor} />;
	}

	return (
		<BranchRenderer
			node={node}
			path={path}
			workspaceId={workspaceId}
			workspaceColor={workspaceColor}
		/>
	);
}

// -- Branch renderer (Allotment split with onChange size persistence) --

interface BranchRendererProps {
	node: LayoutBranch;
	path: readonly number[];
	workspaceId: string;
	workspaceColor: string;
}

function BranchRenderer({ node, path, workspaceId, workspaceColor }: BranchRendererProps) {
	const updatePaneSizes = useWorkspaceStore((s) => s.updatePaneSizes);

	// Ref avoids path array reference in useCallback deps
	const pathRef = useRef(path);
	pathRef.current = path;

	const handleChange = useDebouncedCallback(
		useCallback(
			(sizes: number[]) => {
				const total = sizes.reduce((sum, s) => sum + s, 0);
				if (total <= 0) return;
				const percentages = sizes.map((s) => (s / total) * 100);
				updatePaneSizes(workspaceId, pathRef.current, percentages);
			},
			[updatePaneSizes, workspaceId],
		),
		SIZE_PERSIST_DEBOUNCE_MS,
	);

	const defaultSizes = node.children.map((child) => child.size);

	return (
		<Allotment
			vertical={node.direction === "vertical"}
			defaultSizes={defaultSizes}
			minSize={PANE_MIN_SIZE}
			onChange={handleChange}
		>
			{node.children.map((child, index) => (
				<Allotment.Pane key={getNodeKey(child, index)}>
					<LayoutNodeRenderer
						node={child}
						path={[...path, index]}
						workspaceId={workspaceId}
						workspaceColor={workspaceColor}
					/>
				</Allotment.Pane>
			))}
		</Allotment>
	);
}

// -- Helpers --

function getNodeKey(node: LayoutNode, index: number): string {
	if (node.type === "leaf") return node.paneId;
	return getFirstPaneId(node) ?? `branch-${index}`;
}

function useDebouncedCallback<T extends unknown[]>(
	fn: (...args: T) => void,
	delay: number,
): (...args: T) => void {
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	useEffect(() => {
		return () => clearTimeout(timeoutRef.current);
	}, []);

	return useCallback(
		(...args: T) => {
			clearTimeout(timeoutRef.current);
			timeoutRef.current = setTimeout(() => fn(...args), delay);
		},
		[fn, delay],
	);
}
