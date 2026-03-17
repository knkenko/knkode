import { describe, expect, it } from "vitest";
import { isLayoutBranch, isLayoutLeaf } from "../../types/workspace";
import { createLayoutFromPreset, LAYOUT_PRESETS } from "../layout-presets";
import { countPanes, getPaneIdsInOrder } from "../layout-tree";

describe("createLayoutFromPreset", () => {
	let counter = 0;
	const generateId = () => `pane-${++counter}`;

	function resetCounter() {
		counter = 0;
	}

	it.each(LAYOUT_PRESETS)("creates valid layout for preset '%s'", (preset) => {
		resetCounter();
		const { layout, panes } = createLayoutFromPreset(preset, generateId, "/home");

		expect(layout.type).toBe("preset");
		if (layout.type === "preset") {
			expect(layout.preset).toBe(preset);
		}

		// All pane IDs in tree should have matching configs
		const treeIds = getPaneIdsInOrder(layout.tree);
		expect(treeIds.length).toBeGreaterThan(0);
		for (const id of treeIds) {
			expect(panes[id]).toBeDefined();
			expect(panes[id]?.cwd).toBe("/home");
			expect(panes[id]?.startupCommand).toBeNull();
		}

		// Number of pane configs should match tree leaves
		expect(Object.keys(panes)).toHaveLength(treeIds.length);
	});

	it("single preset creates 1 pane", () => {
		resetCounter();
		const { layout } = createLayoutFromPreset("single", generateId, "/home");
		expect(countPanes(layout.tree)).toBe(1);
		expect(isLayoutLeaf(layout.tree)).toBe(true);
	});

	it("2-column preset creates 2 panes in horizontal split", () => {
		resetCounter();
		const { layout } = createLayoutFromPreset("2-column", generateId, "/home");
		expect(countPanes(layout.tree)).toBe(2);
		if (isLayoutBranch(layout.tree)) {
			expect(layout.tree.direction).toBe("horizontal");
		}
	});

	it("2-row preset creates 2 panes in vertical split", () => {
		resetCounter();
		const { layout } = createLayoutFromPreset("2-row", generateId, "/home");
		expect(countPanes(layout.tree)).toBe(2);
		if (isLayoutBranch(layout.tree)) {
			expect(layout.tree.direction).toBe("vertical");
		}
	});

	it("3-panel-l preset creates 3 panes", () => {
		resetCounter();
		const { layout } = createLayoutFromPreset("3-panel-l", generateId, "/home");
		expect(countPanes(layout.tree)).toBe(3);
	});

	it("3-panel-t preset creates 3 panes", () => {
		resetCounter();
		const { layout } = createLayoutFromPreset("3-panel-t", generateId, "/home");
		expect(countPanes(layout.tree)).toBe(3);
	});

	it("2x2-grid preset creates 4 panes", () => {
		resetCounter();
		const { layout } = createLayoutFromPreset("2x2-grid", generateId, "/home");
		expect(countPanes(layout.tree)).toBe(4);
	});

	it("root node always has size 100", () => {
		for (const preset of LAYOUT_PRESETS) {
			resetCounter();
			const { layout } = createLayoutFromPreset(preset, generateId, "/home");
			expect(layout.tree.size).toBe(100);
		}
	});
});
