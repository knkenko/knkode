/** Default unfocused pane dimming opacity. */
export const DEFAULT_UNFOCUSED_DIM = 0.3;
/** Maximum unfocused dim overlay opacity. UI clamps to [0, MAX_UNFOCUSED_DIM]. */
export const MAX_UNFOCUSED_DIM = 0.9;

/** Default pane background opacity (fully opaque). */
export const DEFAULT_PANE_OPACITY = 1;
/** Minimum pane background opacity. UI clamps to [MIN_PANE_OPACITY, 1]. */
export const MIN_PANE_OPACITY = 0.05;

/** Agent activity status for a terminal pane. */
export type AgentStatus = "idle" | "in_progress" | "input_required";

export const CURSOR_STYLES = ["block", "underline", "bar"] as const;
export type CursorStyle = (typeof CURSOR_STYLES)[number];
/** Cursor shape from terminal state (DECSCUSR). "default" = no TUI override. */
export type CursorShape = CursorStyle | "default";

// Ordered by intensity, low to high — UI renders left-to-right in this order
export const EFFECT_LEVELS = ["off", "subtle", "medium", "intense"] as const;
export type EffectLevel = (typeof EFFECT_LEVELS)[number];

/** Opacity/intensity multiplier for each effect level. Applied to gradient div opacity,
 *  glow box-shadow alpha values, scanline overlay opacity, noise overlay opacity,
 *  and scrollbar accent color alpha.
 *  All values are in [0, 1] so they can be used directly as CSS opacity. */
export const EFFECT_MULTIPLIERS = {
	off: 0,
	subtle: 0.4,
	medium: 0.7,
	intense: 1.0,
} as const satisfies Record<EffectLevel, number>;

export function isEffectLevel(v: unknown): v is EffectLevel {
	return typeof v === "string" && (EFFECT_LEVELS as readonly string[]).includes(v);
}

/** Resolve an effect level to its numeric multiplier (0–1). */
export function effectMul(level: unknown): number {
	return EFFECT_MULTIPLIERS[isEffectLevel(level) ? level : "off"];
}

export const DEFAULT_CURSOR_STYLE: CursorStyle = "bar";
export const DEFAULT_SCROLLBACK = 5000;
export const MIN_SCROLLBACK = 500;
export const MAX_SCROLLBACK = 50000;

export const DEFAULT_FONT_SIZE = 14;
export const MIN_FONT_SIZE = 8;
export const MAX_FONT_SIZE = 32;

export const DEFAULT_BACKGROUND = "#1e1e1e";
export const DEFAULT_FOREGROUND = "#e0e0e0";
export const DEFAULT_CURSOR_COLOR = "#c0c0c0";

export const DEFAULT_LINE_HEIGHT = 1.0;
export const MIN_LINE_HEIGHT = 1.0;
export const MAX_LINE_HEIGHT = 2.0;

export function isCursorStyle(v: string): v is CursorStyle {
	return (CURSOR_STYLES as readonly string[]).includes(v);
}

/** ANSI 16-color palette for terminal themes. All values are hex strings (#RRGGBB).
 *  Mirrors `AnsiThemeColors` in `src-tauri/src/terminal.rs` and
 *  `ANSI_KEYS` in `src-tauri/src/config.rs`. Keep all three in sync. */
export interface AnsiColors {
	readonly black: string;
	readonly red: string;
	readonly green: string;
	readonly yellow: string;
	readonly blue: string;
	readonly magenta: string;
	readonly cyan: string;
	readonly white: string;
	readonly brightBlack: string;
	readonly brightRed: string;
	readonly brightGreen: string;
	readonly brightYellow: string;
	readonly brightBlue: string;
	readonly brightMagenta: string;
	readonly brightCyan: string;
	readonly brightWhite: string;
}

export interface PaneTheme {
	readonly background: string;
	readonly foreground: string;
	readonly fontSize: number;
	/** Overlay opacity on unfocused panes. Clamped to [0, MAX_UNFOCUSED_DIM] by the UI. */
	readonly unfocusedDim: number;
	readonly fontFamily?: string;
	/** Terminal scrollback buffer size in lines. Valid: 500–50000. Defaults to DEFAULT_SCROLLBACK if omitted. */
	readonly scrollback?: number;
	/** Terminal cursor style. Defaults to DEFAULT_CURSOR_STYLE if omitted. */
	readonly cursorStyle?: CursorStyle;
	/** Terminal background opacity. MIN_PANE_OPACITY = near-transparent, 1 = fully opaque. Clamped to [MIN_PANE_OPACITY, 1] by the UI. Defaults to DEFAULT_PANE_OPACITY. */
	readonly paneOpacity?: number;
	/** ANSI 16-color palette. When omitted, terminal uses built-in defaults. */
	readonly ansiColors?: AnsiColors;
	/** UI accent color (buttons, focus rings, active tab indicators). Auto-derived if omitted. */
	readonly accent?: string;
	/** Glow color for theme effects (box-shadow). No glow when omitted. */
	readonly glow?: string;
	/** CSS gradient overlay on terminal panes. Applied as a low-opacity overlay. */
	readonly gradient?: string;
	/** Gradient overlay intensity. Controls the div opacity via EFFECT_MULTIPLIERS. */
	readonly gradientLevel?: EffectLevel;
	/** Glow effect intensity. Controls box-shadow alpha scaling via EFFECT_MULTIPLIERS. */
	readonly glowLevel?: EffectLevel;
	/** CRT scanline overlay intensity. Controls scanline opacity via EFFECT_MULTIPLIERS. */
	readonly scanlineLevel?: EffectLevel;
	/** Noise/grain overlay intensity. Static texture for film/CRT aesthetic. */
	readonly noiseLevel?: EffectLevel;
	/** Scrollbar thumb accent color intensity. Uses glow/accent color. */
	readonly scrollbarAccent?: EffectLevel;
	/** Custom cursor color (hex). Falls back to foreground when omitted. */
	readonly cursorColor?: string;
	/** Custom selection highlight color (hex). Falls back to foreground+alpha when omitted. */
	readonly selectionColor?: string;
	/** Terminal line height multiplier. Range [1.0, 2.0]. Defaults to DEFAULT_LINE_HEIGHT. */
	readonly lineHeight?: number;
	/** Theme preset name. Identifies which built-in theme this config was derived from. */
	readonly preset?: string;
	/** Status bar position. Defaults to 'top' */
	readonly statusBarPosition?: "top" | "bottom";
}

/** Sidebar appearance config — themes define these to give the sidebar a distinct personality.
 *  All fields optional; sensible defaults are derived from the workspace theme colors. */
export interface SidebarTheme {
	/** Override sidebar background. Default: derived sunken surface. */
	readonly background?: string;
	/** Backdrop-filter blur in px (0–20). Creates frosted glass effect. Default: 0. */
	readonly glass?: number;
	/** Right border style. Default: "solid". */
	readonly borderStyle?: "solid" | "gradient" | "glow" | "none";
	/** Border/glow color override. Default: derived from edge. */
	readonly borderColor?: string;
	/** Item hover background override. Default: derived overlay. */
	readonly itemHover?: string;
	/** Active/selected item background override. Default: derived overlay-active. */
	readonly itemActive?: string;
	/** Border radius on interactive items (0–8px). Default: 2. */
	readonly itemRadius?: number;
	/** Box-shadow on sidebar container. Default: "none". */
	readonly shadow?: string;
	/** Glow effect on active workspace accent indicator. Default: false. */
	readonly accentGlow?: boolean;
	/** Vertical spacing density. Default: "default". */
	readonly spacing?: "compact" | "default" | "spacious";
	/** CSS transition-timing-function for hover/active transitions. Default: "ease". */
	readonly transition?: string;

	// ── Section card styling ──────────────────────────────────────
	/** Text transform on workspace headers. Default: "none". */
	readonly textTransform?: "none" | "uppercase";
	/** Letter spacing on workspace headers in em. Default: 0. */
	readonly letterSpacing?: number;
	/** Font weight on workspace headers. Default: "medium". */
	readonly headerWeight?: "normal" | "medium" | "bold";
	/** Separator between workspace sections. Default: "solid". */
	readonly separatorStyle?: "solid" | "dashed" | "gradient" | "glow" | "none";
	/** Separator color override. Default: derived from edge. */
	readonly separatorColor?: string;
	/** Workspace section card background. Default: "transparent". */
	readonly cardBg?: string;
	/** Workspace card border color. "none" for no border. Default: "none". */
	readonly cardBorder?: string;
	/** Workspace card border radius (0–12px). Default: 0. */
	readonly cardRadius?: number;
}

export interface PaneConfig {
	readonly label: string;
	readonly cwd: string;
	readonly startupCommand: string | null;
	readonly themeOverride: Partial<PaneTheme> | null;
}

export type SplitDirection = "horizontal" | "vertical";
export type DropPosition = "left" | "right" | "top" | "bottom";

export interface LayoutLeaf {
	readonly paneId: string;
	readonly size: number;
}

export interface LayoutBranch {
	readonly direction: SplitDirection;
	readonly size: number;
	readonly children: readonly LayoutNode[];
}

export type LayoutNode = LayoutLeaf | LayoutBranch;

export function isLayoutBranch(node: LayoutNode): node is LayoutBranch {
	return "children" in node;
}

export type LayoutPreset = "single" | "2-column" | "2-row" | "3-panel-l" | "3-panel-t" | "2x2-grid";

export type WorkspaceLayout =
	| { type: "preset"; preset: LayoutPreset; tree: LayoutNode }
	| { type: "custom"; tree: LayoutNode };

export interface Workspace {
	readonly id: string;
	readonly name: string;
	readonly theme: PaneTheme;
	readonly layout: WorkspaceLayout;
	readonly panes: Record<string, PaneConfig>;
}

export interface AppState {
	readonly openWorkspaceIds: readonly string[];
	readonly activeWorkspaceId: string | null;
	/** Whether the sidebar tree is in narrow/icon-only mode. */
	readonly sidebarCollapsed: boolean;
	readonly windowBounds: {
		readonly x: number;
		readonly y: number;
		readonly width: number;
		readonly height: number;
	};
}

/** A reusable shell command that can be executed in any terminal pane. */
export interface Snippet {
	readonly id: string;
	readonly name: string;
	readonly command: string;
}

/** PR info for a pane's current branch. */
export interface PrInfo {
	readonly number: number;
	readonly url: string;
	readonly title: string;
}

/** Detail payload for the `pane:scroll` CustomEvent dispatched by global shortcuts. */
export interface PaneScrollDetail {
	readonly paneId: string;
	readonly to: "top" | "bottom";
}

export interface ScrollDebugEvent {
	readonly paneId: string;
	readonly workspaceId: string | null;
	readonly workspaceName: string | null;
	readonly paneLabel: string | null;
	readonly activeWorkspaceId: string | null;
	readonly seq: number;
	readonly event: string;
	readonly details?: Record<string, unknown>;
}

// --- Terminal grid rendering ---

/** A reference to an image slice within a terminal cell. Texture coordinates
 *  define which portion of the full image to render in this cell
 *  (0.0–1.0 normalized coordinates). */
export interface ImageCellSnapshot {
	readonly hash: string;
	readonly topLeftX: number;
	readonly topLeftY: number;
	readonly bottomRightX: number;
	readonly bottomRightY: number;
	/** Negative zIndex renders behind text; zero or positive renders on top. */
	readonly zIndex: number;
}

/** Full image data sent once per unique image. Frontend caches decoded ImageBitmaps by hash. */
export interface ImageSnapshot {
	readonly data: string;
	readonly width: number;
	readonly height: number;
}

/** A single cell in the terminal grid. Designed to be serialized from Rust (wezterm-term). */
export interface CellSnapshot {
	readonly text: string;
	readonly fg: string;
	readonly bg: string;
	readonly bold: boolean;
	readonly italic: boolean;
	readonly underline: boolean;
	readonly strikethrough: boolean;
	readonly images?: readonly ImageCellSnapshot[];
}

/** Full terminal grid state, designed to be emitted by Rust via `terminal:render` event.
 *  The frontend receives pre-rendered grid snapshots, never raw escape sequences. */
export interface GridSnapshot {
	readonly rows: readonly (readonly CellSnapshot[])[];
	readonly cursorRow: number;
	readonly cursorCol: number;
	readonly cursorVisible: boolean;
	/** Cursor shape from terminal state (DECSCUSR): "default", "block", "underline", or "bar".
	 *  "default" means no TUI override — use the user's cursorStyle setting. */
	readonly cursorShape: CursorShape;
	/** Whether the terminal requests cursor blinking (from DECSCUSR).
	 *  TODO: not yet consumed by frontend — reserved for future DECSCUSR support. */
	readonly cursorBlink: boolean;
	readonly cols: number;
	readonly totalRows: number;
	/** Number of rows available above the visible viewport (scrollback depth). */
	readonly scrollbackRows: number;
	/** Current scroll position: 0 = at bottom (live), >0 = scrolled up N rows. */
	readonly scrollOffset: number;
	/** Terminal palette default background (hex). Cells matching this have no
	 *  custom background and should be left transparent so theme effects show. */
	readonly defaultBg: string;
	/** Unique images visible in the viewport, keyed by hex SHA256 hash.
	 *  Only includes images not previously sent — frontend caches by hash. */
	readonly images?: Readonly<Record<string, ImageSnapshot>>;
}

// --- Selection ---

/** Cell range for text extraction. Row indices are absolute physical rows
 *  in the scrollback buffer (row 0 = oldest line), not viewport-relative.
 *  All positions are inclusive: startCol=0, endCol=4 selects 5 columns.
 *  Values must be non-negative integers (Rust expects usize). */
export interface SelectionRange {
	readonly startRow: number;
	readonly startCol: number;
	readonly endRow: number;
	readonly endCol: number;
}

// --- API interface ---

export type Unsubscribe = () => void;

export interface KnkodeApi {
	// App
	getHomeDir(): Promise<string>;
	openExternal(url: string): Promise<void>;
	logScrollDebug(event: ScrollDebugEvent): void;

	// Config
	getWorkspaces(): Promise<Workspace[]>;
	saveWorkspace(workspace: Workspace): Promise<void>;
	deleteWorkspace(id: string): Promise<void>;
	getAppState(): Promise<AppState>;
	saveAppState(state: AppState): Promise<void>;
	getSnippets(): Promise<Snippet[]>;
	saveSnippets(snippets: Snippet[]): Promise<void>;

	// PTY
	trackPaneGit(id: string, cwd: string): Promise<void>;
	createPty(id: string, cwd: string, startupCommand: string | null): Promise<void>;
	writePty(id: string, data: string): Promise<void>;
	resizePty(
		id: string,
		cols: number,
		rows: number,
		pixelWidth: number,
		pixelHeight: number,
	): Promise<void>;
	killPty(id: string): Promise<void>;

	// Terminal scroll — request a snapshot at a given scrollback offset (0 = bottom)
	scrollTerminal(id: string, offset: number): Promise<GridSnapshot>;

	// Terminal colors — send theme ANSI palette to Rust for per-terminal color resolution
	setTerminalColors(
		id: string,
		ansiColors: AnsiColors,
		foreground: string,
		background: string,
	): Promise<void>;

	// Terminal selection — extract text from a cell range (absolute row indices)
	getSelectionText(id: string, range: SelectionRange): Promise<string>;

	// Terminal grid events — Rust processes PTY data via wezterm-term, sends rendered snapshots
	onTerminalRender(cb: (id: string, grid: GridSnapshot) => void): Unsubscribe;
	onPtyExit(cb: (id: string, exitCode: number) => void): Unsubscribe;
	onPtyCwdChanged(cb: (paneId: string, cwd: string) => void): Unsubscribe;
	onPtyBranchChanged(cb: (paneId: string, branch: string | null) => void): Unsubscribe;
	onPtyPrChanged(cb: (paneId: string, pr: PrInfo | null) => void): Unsubscribe;
}
