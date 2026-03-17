/** Layout presets matching v1. Names follow iTerm2 convention. */
export type LayoutPreset = "single" | "2-column" | "2-row" | "3-panel-l" | "3-panel-t" | "2x2-grid";

/** Leaf node — a single pane in the layout tree. */
export interface LayoutLeaf {
	readonly paneId: string;
	/** Percentage size relative to siblings (0-100). */
	readonly size: number;
}

/** Branch node — splits children horizontally or vertically. */
export interface LayoutBranch {
	/** 'horizontal' = side-by-side (vertical divider), 'vertical' = stacked (horizontal divider). */
	readonly direction: "horizontal" | "vertical";
	/** Percentage size relative to siblings (0-100). */
	readonly size: number;
	readonly children: readonly LayoutNode[];
}

/** A node in the layout tree — either a leaf (pane) or a branch (split). */
export type LayoutNode = LayoutLeaf | LayoutBranch;

/** Workspace layout: either a named preset or a custom (user-modified) layout. */
export type WorkspaceLayout =
	| { readonly type: "preset"; readonly preset: LayoutPreset; readonly tree: LayoutNode }
	| { readonly type: "custom"; readonly tree: LayoutNode };

/** Per-pane configuration. */
export interface PaneConfig {
	readonly label: string;
	readonly cwd: string;
	readonly startupCommand: string | null;
}

/** 8-color palette for workspace tab accents. */
export const WORKSPACE_COLORS = [
	"#6c63ff",
	"#e74c3c",
	"#2ecc71",
	"#f39c12",
	"#3498db",
	"#9b59b6",
	"#1abc9c",
	"#e67e22",
] as const;

/** Full workspace definition. */
export interface Workspace {
	readonly id: string;
	readonly name: string;
	readonly color: string;
	readonly layout: WorkspaceLayout;
	readonly panes: Readonly<Record<string, PaneConfig>>;
}

/** Persistent app-level state (tab order, active workspace, window bounds). */
export interface AppState {
	readonly openWorkspaceIds: readonly string[];
	readonly activeWorkspaceId: string | null;
	readonly windowBounds: {
		readonly x: number;
		readonly y: number;
		readonly width: number;
		readonly height: number;
	};
}

// -- Type guards --

export function isLayoutLeaf(node: LayoutNode): node is LayoutLeaf {
	return "paneId" in node;
}

export function isLayoutBranch(node: LayoutNode): node is LayoutBranch {
	return "direction" in node;
}
