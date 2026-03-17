import { describe, expect, it } from "vitest";
import type { LayoutBranch, LayoutNode } from "../../types/workspace";
import {
	countPanes,
	findPanePath,
	getFirstPaneId,
	getPaneIdsInOrder,
	remapTree,
	removeLeaf,
	replaceLeaf,
	splitAtPane,
	updateSizesAtPath,
} from "../layout-tree";

// -- Fixtures --

const singleLeaf: LayoutNode = { paneId: "a", size: 100 };

const twoColumn: LayoutBranch = {
	direction: "horizontal",
	size: 100,
	children: [
		{ paneId: "a", size: 50 },
		{ paneId: "b", size: 50 },
	],
};

const nested: LayoutBranch = {
	direction: "vertical",
	size: 100,
	children: [
		{ paneId: "a", size: 60 },
		{
			direction: "horizontal",
			size: 40,
			children: [
				{ paneId: "b", size: 50 },
				{ paneId: "c", size: 50 },
			],
		},
	],
};

// -- getFirstPaneId --

describe("getFirstPaneId", () => {
	it("returns the pane ID for a leaf", () => {
		expect(getFirstPaneId(singleLeaf)).toBe("a");
	});

	it("returns the leftmost pane in a branch", () => {
		expect(getFirstPaneId(twoColumn)).toBe("a");
	});

	it("returns the leftmost pane in a nested tree", () => {
		expect(getFirstPaneId(nested)).toBe("a");
	});
});

// -- getPaneIdsInOrder --

describe("getPaneIdsInOrder", () => {
	it("returns single ID for a leaf", () => {
		expect(getPaneIdsInOrder(singleLeaf)).toEqual(["a"]);
	});

	it("returns IDs in depth-first order", () => {
		expect(getPaneIdsInOrder(nested)).toEqual(["a", "b", "c"]);
	});
});

// -- removeLeaf --

describe("removeLeaf", () => {
	it("returns undefined when removing the root leaf", () => {
		expect(removeLeaf(singleLeaf, "a")).toBeUndefined();
	});

	it("does not modify tree when pane not found", () => {
		expect(removeLeaf(twoColumn, "z")).toEqual(twoColumn);
	});

	it("collapses single-child branch after removal", () => {
		const result = removeLeaf(twoColumn, "a");
		expect(result).toEqual({ paneId: "b", size: 100 });
	});

	it("redistributes sizes after removal from 3-child branch", () => {
		const threeChildren: LayoutBranch = {
			direction: "horizontal",
			size: 100,
			children: [
				{ paneId: "a", size: 33.33 },
				{ paneId: "b", size: 33.33 },
				{ paneId: "c", size: 33.33 },
			],
		};
		const result = removeLeaf(threeChildren, "b") as LayoutBranch;
		expect(result.children).toHaveLength(2);
		const totalSize = result.children.reduce((s, c) => s + c.size, 0);
		expect(totalSize).toBeCloseTo(100);
	});

	it("removes from nested tree and collapses", () => {
		const result = removeLeaf(nested, "b") as LayoutBranch;
		// After removing "b", the inner branch collapses to just "c"
		expect(getPaneIdsInOrder(result)).toEqual(["a", "c"]);
		expect(result.children).toHaveLength(2);
	});
});

// -- replaceLeaf --

describe("replaceLeaf", () => {
	it("replaces a leaf at root level", () => {
		const result = replaceLeaf(singleLeaf, "a", () => ({ paneId: "x", size: 100 }));
		expect(result).toEqual({ paneId: "x", size: 100 });
	});

	it("replaces a leaf in a branch", () => {
		const result = replaceLeaf(twoColumn, "b", () => ({ paneId: "x", size: 50 }));
		expect(getPaneIdsInOrder(result)).toEqual(["a", "x"]);
	});

	it("does not modify when pane not found", () => {
		const result = replaceLeaf(twoColumn, "z", () => ({ paneId: "x", size: 50 }));
		expect(result).toEqual(twoColumn);
	});
});

// -- remapTree --

describe("remapTree", () => {
	it("remaps a single leaf", () => {
		const result = remapTree(singleLeaf, (id) => `new-${id}`);
		expect(result).toEqual({ paneId: "new-a", size: 100 });
	});

	it("remaps all leaves in a nested tree", () => {
		const result = remapTree(nested, (id) => `new-${id}`);
		expect(getPaneIdsInOrder(result)).toEqual(["new-a", "new-b", "new-c"]);
	});
});

// -- updateSizesAtPath --

describe("updateSizesAtPath", () => {
	it("updates root branch children sizes", () => {
		const result = updateSizesAtPath(twoColumn, [], [70, 30]) as LayoutBranch;
		expect(result.children[0]?.size).toBe(70);
		expect(result.children[1]?.size).toBe(30);
	});

	it("updates nested branch sizes", () => {
		const result = updateSizesAtPath(nested, [1], [30, 70]) as LayoutBranch;
		const inner = result.children[1] as LayoutBranch;
		expect(inner.children[0]?.size).toBe(30);
		expect(inner.children[1]?.size).toBe(70);
	});

	it("returns node unchanged for invalid path", () => {
		const result = updateSizesAtPath(singleLeaf, [0], [50, 50]);
		expect(result).toEqual(singleLeaf);
	});

	it("returns node unchanged for mismatched sizes length", () => {
		const result = updateSizesAtPath(twoColumn, [], [50]);
		expect(result).toEqual(twoColumn);
	});
});

// -- countPanes --

describe("countPanes", () => {
	it("counts 1 for a leaf", () => {
		expect(countPanes(singleLeaf)).toBe(1);
	});

	it("counts all panes in nested tree", () => {
		expect(countPanes(nested)).toBe(3);
	});
});

// -- findPanePath --

describe("findPanePath", () => {
	it("returns empty array for root leaf", () => {
		expect(findPanePath(singleLeaf, "a")).toEqual([]);
	});

	it("returns path to pane in branch", () => {
		expect(findPanePath(twoColumn, "b")).toEqual([1]);
	});

	it("returns path to pane in nested tree", () => {
		expect(findPanePath(nested, "c")).toEqual([1, 1]);
	});

	it("returns undefined for missing pane", () => {
		expect(findPanePath(nested, "z")).toBeUndefined();
	});
});

// -- splitAtPane --

describe("splitAtPane", () => {
	it("splits a root leaf into a branch", () => {
		const result = splitAtPane(singleLeaf, "a", "new", "horizontal") as LayoutBranch;
		expect(result.direction).toBe("horizontal");
		expect(result.children).toHaveLength(2);
		expect(getPaneIdsInOrder(result)).toEqual(["a", "new"]);
	});

	it("splits a leaf inside a branch", () => {
		const result = splitAtPane(twoColumn, "b", "new", "vertical");
		expect(countPanes(result)).toBe(3);
		expect(getPaneIdsInOrder(result)).toEqual(["a", "b", "new"]);
	});

	it("preserves the rest of the tree", () => {
		const result = splitAtPane(nested, "c", "new", "horizontal");
		expect(countPanes(result)).toBe(4);
		expect(getPaneIdsInOrder(result)).toEqual(["a", "b", "c", "new"]);
	});
});
