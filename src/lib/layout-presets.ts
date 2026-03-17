import type { LayoutNode, LayoutPreset, PaneConfig, WorkspaceLayout } from "../types/workspace";

type PresetFactory = (ids: () => string) => { tree: LayoutNode; paneIds: string[] };

const PRESET_FACTORIES: Record<LayoutPreset, PresetFactory> = {
	single: (ids) => {
		const id = ids();
		return { tree: { paneId: id, size: 100 }, paneIds: [id] };
	},

	"2-column": (ids) => {
		const [a, b] = [ids(), ids()];
		return {
			tree: {
				direction: "horizontal",
				size: 100,
				children: [
					{ paneId: a, size: 50 },
					{ paneId: b, size: 50 },
				],
			},
			paneIds: [a, b],
		};
	},

	"2-row": (ids) => {
		const [a, b] = [ids(), ids()];
		return {
			tree: {
				direction: "vertical",
				size: 100,
				children: [
					{ paneId: a, size: 50 },
					{ paneId: b, size: 50 },
				],
			},
			paneIds: [a, b],
		};
	},

	"3-panel-l": (ids) => {
		const [main, tr, br] = [ids(), ids(), ids()];
		return {
			tree: {
				direction: "horizontal",
				size: 100,
				children: [
					{ paneId: main, size: 60 },
					{
						direction: "vertical",
						size: 40,
						children: [
							{ paneId: tr, size: 50 },
							{ paneId: br, size: 50 },
						],
					},
				],
			},
			paneIds: [main, tr, br],
		};
	},

	"3-panel-t": (ids) => {
		const [top, bl, bRight] = [ids(), ids(), ids()];
		return {
			tree: {
				direction: "vertical",
				size: 100,
				children: [
					{ paneId: top, size: 60 },
					{
						direction: "horizontal",
						size: 40,
						children: [
							{ paneId: bl, size: 50 },
							{ paneId: bRight, size: 50 },
						],
					},
				],
			},
			paneIds: [top, bl, bRight],
		};
	},

	"2x2-grid": (ids) => {
		const [tl, tr, bl, br] = [ids(), ids(), ids(), ids()];
		return {
			tree: {
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
			},
			paneIds: [tl, tr, bl, br],
		};
	},
};

/**
 * Create a workspace layout from a preset.
 * Returns the layout and a map of pane configs keyed by pane ID.
 */
export function createLayoutFromPreset(
	preset: LayoutPreset,
	generateId: () => string,
	defaultCwd: string,
): { layout: WorkspaceLayout; panes: Record<string, PaneConfig> } {
	const factory = PRESET_FACTORIES[preset];
	const { tree, paneIds } = factory(generateId);

	const panes: Record<string, PaneConfig> = {};
	for (const id of paneIds) {
		panes[id] = { label: "", cwd: defaultCwd, startupCommand: null };
	}

	return {
		layout: { type: "preset", preset, tree },
		panes,
	};
}

/** All available preset names. */
export const LAYOUT_PRESETS: readonly LayoutPreset[] = [
	"single",
	"2-column",
	"2-row",
	"3-panel-l",
	"3-panel-t",
	"2x2-grid",
];
