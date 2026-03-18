import type { LayoutNode, LayoutPreset, PaneConfig, WorkspaceLayout } from "../shared/types";
import { isLayoutBranch } from "../shared/types";

/** Remove a leaf from a layout tree by pane ID.
 *  If a branch is left with one child, collapse it upward
 *  (promote the child, preserving the parent's size).
 *  Returns null if the target was the only node (callers should guard against this). */
export function removeLeafFromTree(node: LayoutNode, targetPaneId: string): LayoutNode | null {
	if (!isLayoutBranch(node)) {
		return node.paneId === targetPaneId ? null : node;
	}
	const remaining = node.children
		.map((child) => removeLeafFromTree(child, targetPaneId))
		.filter((n): n is LayoutNode => n !== null);
	if (remaining.length === 0) return null;
	if (remaining.length === 1) return { ...remaining[0]!, size: node.size };
	return { ...node, children: remaining };
}

/** Find a node by pane ID and replace it using the given function.
 *  The replacer receives the matched node and returns its replacement. */
export function replaceLeafInTree(
	node: LayoutNode,
	targetPaneId: string,
	replacer: (matched: LayoutNode) => LayoutNode,
): LayoutNode {
	if (isLayoutBranch(node)) {
		return {
			...node,
			children: node.children.map((c) => replaceLeafInTree(c, targetPaneId, replacer)),
		};
	}
	return node.paneId === targetPaneId ? replacer(node) : node;
}

/** Immutably update child sizes at a given tree path.
 *  `path` is an array of child indices leading to the target branch node.
 *  An empty path means the root node itself is the target. */
export function updateSizesAtPath(node: LayoutNode, path: number[], sizes: number[]): LayoutNode {
	if (path.length === 0) {
		if (!isLayoutBranch(node)) return node;
		if (sizes.length !== node.children.length) {
			console.warn("[layout] updateSizesAtPath: sizes/children length mismatch", {
				sizes: sizes.length,
				children: node.children.length,
			});
		}
		let changed = false;
		const newChildren = node.children.map((child, i) => {
			const newSize = sizes[i] ?? child.size;
			if (newSize === child.size) return child;
			changed = true;
			return { ...child, size: newSize };
		});
		if (!changed) return node;
		return { ...node, children: newChildren };
	}
	if (!isLayoutBranch(node)) {
		console.warn("[layout] updateSizesAtPath: path traversal hit leaf before exhausting path");
		return node;
	}
	const [head, ...rest] = path;
	if (head === undefined || head < 0 || head >= node.children.length) {
		console.warn("[layout] updateSizesAtPath: path index out of range", {
			head,
			children: node.children.length,
		});
		return node;
	}
	const updatedChild = updateSizesAtPath(node.children[head]!, rest, sizes);
	if (updatedChild === node.children[head]) return node;
	return {
		...node,
		children: node.children.map((child, i) => (i === head ? updatedChild : child)),
	};
}

/** Get the first leaf pane ID in a subtree (depth-first, left-child-first).
 *  Returns null for branches with no children (corrupted state guard). */
export function getFirstPaneId(node: LayoutNode): string | null {
	if (!isLayoutBranch(node)) return node.paneId;
	const first = node.children[0];
	if (!first) {
		console.warn("[layout] getFirstPaneId: branch has no children (corrupted state)");
		return null;
	}
	return getFirstPaneId(first);
}

/** Get pane IDs in depth-first, left-child-first order
 *  (left-to-right for horizontal splits, top-to-bottom for vertical). */
export function getPaneIdsInOrder(node: LayoutNode): string[] {
	if (!isLayoutBranch(node)) return [node.paneId];
	return node.children.flatMap(getPaneIdsInOrder);
}

/** Walk a layout tree and remap every leaf's paneId via the given function. */
export function remapLayoutTree(node: LayoutNode, mapId: (id: string) => string): LayoutNode {
	if (isLayoutBranch(node)) {
		return { ...node, children: node.children.map((c) => remapLayoutTree(c, mapId)) };
	}
	return { ...node, paneId: mapId(node.paneId) };
}

export function createLayoutFromPreset(
	preset: LayoutPreset,
	homeDir: string,
): {
	layout: WorkspaceLayout;
	panes: Record<string, PaneConfig>;
} {
	const makePaneConfig = (label: string): PaneConfig => ({
		label,
		cwd: homeDir,
		startupCommand: null,
		themeOverride: null,
	});

	const panes: Record<string, PaneConfig> = {};
	let tree: LayoutNode;

	switch (preset) {
		case "single": {
			const id = crypto.randomUUID();
			panes[id] = makePaneConfig("terminal");
			tree = { paneId: id, size: 100 };
			break;
		}
		case "2-column": {
			const left = crypto.randomUUID();
			const right = crypto.randomUUID();
			panes[left] = makePaneConfig("left");
			panes[right] = makePaneConfig("right");
			tree = {
				direction: "horizontal",
				size: 100,
				children: [
					{ paneId: left, size: 50 },
					{ paneId: right, size: 50 },
				],
			};
			break;
		}
		case "2-row": {
			const top = crypto.randomUUID();
			const bottom = crypto.randomUUID();
			panes[top] = makePaneConfig("top");
			panes[bottom] = makePaneConfig("bottom");
			tree = {
				direction: "vertical",
				size: 100,
				children: [
					{ paneId: top, size: 50 },
					{ paneId: bottom, size: 50 },
				],
			};
			break;
		}
		case "3-panel-l": {
			const main = crypto.randomUUID();
			const topRight = crypto.randomUUID();
			const bottomRight = crypto.randomUUID();
			panes[main] = makePaneConfig("main");
			panes[topRight] = makePaneConfig("top-right");
			panes[bottomRight] = makePaneConfig("bottom-right");
			tree = {
				direction: "horizontal",
				size: 100,
				children: [
					{ paneId: main, size: 60 },
					{
						direction: "vertical",
						size: 40,
						children: [
							{ paneId: topRight, size: 50 },
							{ paneId: bottomRight, size: 50 },
						],
					},
				],
			};
			break;
		}
		case "3-panel-t": {
			const top = crypto.randomUUID();
			const bottomLeft = crypto.randomUUID();
			const bottomRight = crypto.randomUUID();
			panes[top] = makePaneConfig("top");
			panes[bottomLeft] = makePaneConfig("bottom-left");
			panes[bottomRight] = makePaneConfig("bottom-right");
			tree = {
				direction: "vertical",
				size: 100,
				children: [
					{ paneId: top, size: 60 },
					{
						direction: "horizontal",
						size: 40,
						children: [
							{ paneId: bottomLeft, size: 50 },
							{ paneId: bottomRight, size: 50 },
						],
					},
				],
			};
			break;
		}
		case "2x2-grid": {
			const tl = crypto.randomUUID();
			const tr = crypto.randomUUID();
			const bl = crypto.randomUUID();
			const br = crypto.randomUUID();
			panes[tl] = makePaneConfig("top-left");
			panes[tr] = makePaneConfig("top-right");
			panes[bl] = makePaneConfig("bottom-left");
			panes[br] = makePaneConfig("bottom-right");
			tree = {
				direction: "vertical",
				size: 100,
				children: [
					{
						direction: "horizontal",
						size: 50,
						children: [
							{ paneId: tl, size: 50 },
							{ paneId: tr, size: 50 },
						],
					},
					{
						direction: "horizontal",
						size: 50,
						children: [
							{ paneId: bl, size: 50 },
							{ paneId: br, size: 50 },
						],
					},
				],
			};
			break;
		}
		default: {
			const _exhaustive: never = preset;
			throw new Error(`[layout] Unknown preset: ${_exhaustive}`);
		}
	}

	return {
		layout: { type: "preset", preset, tree },
		panes,
	};
}

/** Apply a layout preset while preserving existing panes by position.
 *  - Same slot count: 1:1 remap, all PTYs survive.
 *  - Fewer slots: first N panes kept, excess returned in `killedPaneIds`.
 *  - More slots: existing panes fill first slots, fresh empty panes fill the rest. */
export function applyPresetWithRemap(
	workspace: { layout: WorkspaceLayout; panes: Record<string, PaneConfig> },
	preset: LayoutPreset,
	homeDir: string,
): {
	layout: WorkspaceLayout;
	panes: Record<string, PaneConfig>;
	killedPaneIds: string[];
} {
	const existingIds = getPaneIdsInOrder(workspace.layout.tree);
	const { layout: freshLayout, panes: freshPanes } = createLayoutFromPreset(preset, homeDir);
	const freshIds = getPaneIdsInOrder(freshLayout.tree);

	const idMap = new Map<string, string>();
	const panes: Record<string, PaneConfig> = {};
	const killedPaneIds: string[] = [];

	for (let i = 0; i < freshIds.length; i++) {
		const freshId = freshIds[i]!;
		if (i < existingIds.length) {
			const existingId = existingIds[i]!;
			const config = workspace.panes[existingId];
			if (!config)
				throw new Error(`[applyPresetWithRemap] missing pane config for "${existingId}"`);
			idMap.set(freshId, existingId);
			panes[existingId] = config;
		} else {
			idMap.set(freshId, freshId);
			panes[freshId] = freshPanes[freshId]!;
		}
	}

	for (let i = freshIds.length; i < existingIds.length; i++) {
		killedPaneIds.push(existingIds[i]!);
	}

	const requireMapped = (id: string): string => {
		const mapped = idMap.get(id);
		if (!mapped) throw new Error(`[applyPresetWithRemap] unmapped pane ID "${id}"`);
		return mapped;
	};

	return {
		layout: { type: "preset", preset, tree: remapLayoutTree(freshLayout.tree, requireMapped) },
		panes,
		killedPaneIds,
	};
}
