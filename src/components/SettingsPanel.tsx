import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { DEFAULT_PRESET_NAME, findPreset } from "../data/theme-presets";
import type { UpdateActions, UpdateState } from "../hooks/useUpdateChecker";
import {
	type CursorStyle,
	DEFAULT_CURSOR_STYLE,
	DEFAULT_FONT_SIZE,
	DEFAULT_LINE_HEIGHT,
	DEFAULT_PANE_OPACITY,
	DEFAULT_SCROLLBACK,
	EFFECT_LEVELS,
	type EffectLevel,
	isEffectLevel,
	type LayoutPreset,
	MAX_UNFOCUSED_DIM,
	MIN_PANE_OPACITY,
	type PaneConfig,
	type PaneTheme,
	type Workspace,
} from "../shared/types";
import { applyPresetWithRemap, useStore } from "../store";
import { AboutTabPanel } from "./AboutTabPanel";
import { type EffectCategory, TerminalTabPanel } from "./TerminalTabPanel";
import { WorkspaceTabPanel } from "./WorkspaceTabPanel";

/** Numeric values for the EffectLevel-based dim and opacity controls. */
const DIM_VALUES: Record<EffectLevel, number> = {
	off: 0,
	subtle: 0.3,
	medium: 0.6,
	intense: MAX_UNFOCUSED_DIM,
};
const OPACITY_VALUES: Record<EffectLevel, number> = {
	off: 1.0,
	subtle: 0.7,
	medium: 0.4,
	intense: MIN_PANE_OPACITY,
};

/** Find the closest EffectLevel key for a numeric value. */
function closestLevel(value: number, map: Record<EffectLevel, number>): EffectLevel {
	let best: EffectLevel = "off";
	let bestDist = Number.POSITIVE_INFINITY;
	for (const level of EFFECT_LEVELS) {
		const dist = Math.abs(value - map[level]);
		if (dist <= bestDist) {
			bestDist = dist;
			best = level;
		}
	}
	return best;
}

/** Read the latest workspace from the store to avoid stale-snapshot races
 *  when multiple auto-persist effects fire in close succession. */
function getLatestWorkspace(wsId: string): Workspace | undefined {
	return useStore.getState().workspaces.find((w) => w.id === wsId);
}

interface SettingsPanelProps {
	workspace: Workspace;
	updateState: UpdateState;
	updateActions: UpdateActions;
	onClose: () => void;
}

const SETTINGS_TABS = ["Workspace", "Terminal", "About"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

// ── Settings reducer ──────────────────────────────────────────────

interface SettingsState {
	activeTab: SettingsTab;
	name: string;
	themePreset: string;
	fontSize: number;
	fontFamily: string;
	scrollback: number;
	cursorStyle: CursorStyle;
	statusBarPosition: "top" | "bottom";
	lineHeight: number;
	dimLevel: EffectLevel;
	opacityLevel: EffectLevel;
	gradientLevel: EffectLevel;
	glowLevel: EffectLevel;
	scanlineLevel: EffectLevel;
	noiseLevel: EffectLevel;
	saveFailed: boolean;
	confirmDelete: boolean;
}

type SettingsAction =
	| { type: "UPDATE"; patch: Partial<SettingsState> }
	| { type: "SET_EFFECT"; category: EffectCategory; level: EffectLevel }
	| { type: "APPLY_PRESET"; preset: string };

/** Effect-level field names within SettingsState. */
type EffectStateField =
	| "dimLevel"
	| "opacityLevel"
	| "gradientLevel"
	| "glowLevel"
	| "scanlineLevel"
	| "noiseLevel";

/** Maps effect UI categories to their corresponding state field names, used by SET_EFFECT. */
const EFFECT_STATE_KEY: Record<EffectCategory, EffectStateField> = {
	dim: "dimLevel",
	opacity: "opacityLevel",
	gradient: "gradientLevel",
	glow: "glowLevel",
	scanline: "scanlineLevel",
	noise: "noiseLevel",
};

function initState(workspace: Workspace): SettingsState {
	const t = workspace.theme;
	return {
		activeTab: "Workspace",
		name: workspace.name,
		themePreset: t.preset ?? DEFAULT_PRESET_NAME,
		fontSize: t.fontSize,
		fontFamily: t.fontFamily ?? "",
		scrollback: t.scrollback ?? DEFAULT_SCROLLBACK,
		cursorStyle: t.cursorStyle ?? DEFAULT_CURSOR_STYLE,
		statusBarPosition: t.statusBarPosition ?? "top",
		lineHeight: t.lineHeight ?? DEFAULT_LINE_HEIGHT,
		dimLevel: closestLevel(t.unfocusedDim, DIM_VALUES),
		opacityLevel: closestLevel(t.paneOpacity ?? DEFAULT_PANE_OPACITY, OPACITY_VALUES),
		gradientLevel: isEffectLevel(t.gradientLevel) ? t.gradientLevel : "off",
		glowLevel: isEffectLevel(t.glowLevel) ? t.glowLevel : "off",
		scanlineLevel: isEffectLevel(t.scanlineLevel) ? t.scanlineLevel : "off",
		noiseLevel: isEffectLevel(t.noiseLevel) ? t.noiseLevel : "off",
		saveFailed: false,
		confirmDelete: false,
	};
}

function settingsReducer(state: SettingsState, action: SettingsAction): SettingsState {
	switch (action.type) {
		case "UPDATE":
			return { ...state, ...action.patch };
		case "SET_EFFECT":
			return { ...state, [EFFECT_STATE_KEY[action.category]]: action.level };
		case "APPLY_PRESET": {
			const p = findPreset(action.preset);
			if (!p) console.warn("[settings] unknown theme preset:", action.preset);
			return {
				...state,
				themePreset: action.preset,
				gradientLevel: p?.gradientLevel ?? "off",
				glowLevel: p?.glowLevel ?? "off",
				scanlineLevel: p?.scanlineLevel ?? "off",
				noiseLevel: p?.noiseLevel ?? "off",
				statusBarPosition: p?.statusBarPosition ?? "top",
				fontFamily: p?.fontFamily ?? "",
				fontSize: p?.fontSize ?? DEFAULT_FONT_SIZE,
				lineHeight: p?.lineHeight ?? DEFAULT_LINE_HEIGHT,
			};
		}
		default:
			return state;
	}
}

// ── Component ─────────────────────────────────────────────────────

export function SettingsPanel({
	workspace,
	updateState,
	updateActions,
	onClose,
}: SettingsPanelProps) {
	const updateWorkspace = useStore((s) => s.updateWorkspace);
	const removeWorkspace = useStore((s) => s.removeWorkspace);
	const updatePaneConfig = useStore((s) => s.updatePaneConfig);
	const killPtys = useStore((s) => s.killPtys);
	const homeDir = useStore((s) => s.homeDir);

	const [state, dispatch] = useReducer(settingsReducer, workspace, initState);

	const dialogRef = useRef<HTMLDivElement>(null);
	const currentPreset = workspace.layout.type === "preset" ? workspace.layout.preset : null;

	const update = useCallback(
		(patch: Partial<SettingsState>) => dispatch({ type: "UPDATE", patch }),
		[],
	);

	const effects = useMemo(() => {
		const rec = {} as Record<EffectCategory, EffectLevel>;
		for (const [cat, key] of Object.entries(EFFECT_STATE_KEY) as [
			EffectCategory,
			EffectStateField,
		][]) {
			rec[cat] = state[key];
		}
		return rec;
	}, [
		state.dimLevel,
		state.opacityLevel,
		state.gradientLevel,
		state.glowLevel,
		state.scanlineLevel,
		state.noiseLevel,
	]);

	const handleEffectChange = useCallback((category: EffectCategory, level: EffectLevel) => {
		dispatch({ type: "SET_EFFECT", category, level });
	}, []);

	const buildThemeFromInputs = useCallback((): PaneTheme => {
		const preset = findPreset(state.themePreset);
		if (!preset) console.warn("[settings] unknown theme preset:", state.themePreset);
		return {
			background: preset?.background ?? "#1a1a2e",
			foreground: preset?.foreground ?? "#e0e0e0",
			fontSize: state.fontSize,
			unfocusedDim: DIM_VALUES[state.dimLevel],
			...(state.fontFamily ? { fontFamily: state.fontFamily } : {}),
			scrollback: state.scrollback,
			cursorStyle: state.cursorStyle,
			statusBarPosition: state.statusBarPosition,
			paneOpacity: OPACITY_VALUES[state.opacityLevel],
			...(preset?.ansiColors ? { ansiColors: preset.ansiColors } : {}),
			...(preset?.accent ? { accent: preset.accent } : {}),
			...(preset?.glow ? { glow: preset.glow } : {}),
			...(preset?.gradient ? { gradient: preset.gradient } : {}),
			gradientLevel: state.gradientLevel,
			glowLevel: state.glowLevel,
			scanlineLevel: state.scanlineLevel,
			noiseLevel: state.noiseLevel,
			...(preset?.scrollbarAccent ? { scrollbarAccent: preset.scrollbarAccent } : {}),
			...(preset?.cursorColor ? { cursorColor: preset.cursorColor } : {}),
			...(preset?.selectionColor ? { selectionColor: preset.selectionColor } : {}),
			lineHeight: state.lineHeight,
			preset: state.themePreset,
		};
	}, [state]);

	/** Persist workspace, surfacing errors to the user via saveFailed indicator. */
	const persistWorkspace = useCallback(
		(ws: Workspace) => {
			update({ saveFailed: false });
			updateWorkspace(ws).catch((err: unknown) => {
				console.error("[settings] persist failed:", err);
				update({ saveFailed: true });
			});
		},
		[updateWorkspace],
	);

	// Auto-persist: save full workspace with updated theme whenever buildThemeFromInputs changes.
	// Reads latest workspace from store (not the prop) to avoid overwriting concurrent updates.
	// Tracks previous value via ref and compares to current value before persisting.
	// A simple useRef(false) mount guard would misfire under React 18 StrictMode,
	// which double-invokes effects on mount.
	const prevAutoSaveRef = useRef(buildThemeFromInputs);
	useEffect(() => {
		if (prevAutoSaveRef.current === buildThemeFromInputs) return;
		prevAutoSaveRef.current = buildThemeFromInputs;
		const latest = getLatestWorkspace(workspace.id);
		if (!latest) return;
		// Debounce theme persist to avoid saving on every keystroke (e.g. font-size stepper)
		const timer = setTimeout(() => {
			const current = getLatestWorkspace(workspace.id);
			if (!current) return;
			persistWorkspace({ ...current, theme: buildThemeFromInputs() });
		}, 200);
		return () => clearTimeout(timer);
	}, [workspace.id, buildThemeFromInputs, persistWorkspace]);

	// Auto-persist name with debounce.
	// Uses value-comparison ref instead of useRef(false) mount guard for StrictMode compat.
	const prevNameRef = useRef(state.name);
	useEffect(() => {
		if (prevNameRef.current === state.name) return;
		prevNameRef.current = state.name;
		const trimmed = state.name.trim();
		if (!trimmed) return;
		const latest = getLatestWorkspace(workspace.id);
		if (!latest || trimmed === latest.name) return;
		const timer = setTimeout(() => {
			const current = getLatestWorkspace(workspace.id);
			if (!current) return;
			persistWorkspace({ ...current, name: trimmed });
		}, 300);
		return () => clearTimeout(timer);
	}, [workspace.id, state.name, persistWorkspace]);

	const handleLayoutChange = useCallback(
		(preset: LayoutPreset) => {
			const latest = getLatestWorkspace(workspace.id);
			if (!latest) return;
			const { layout, panes, killedPaneIds } = applyPresetWithRemap(latest, preset, homeDir);
			if (killedPaneIds.length > 0) {
				killPtys(killedPaneIds);
			}
			persistWorkspace({ ...latest, layout, panes });
		},
		[workspace.id, persistWorkspace, killPtys, homeDir],
	);

	const handleDelete = useCallback(() => {
		if (!state.confirmDelete) {
			update({ confirmDelete: true });
			setTimeout(() => update({ confirmDelete: false }), 3000);
			return;
		}
		removeWorkspace(workspace.id);
		onClose();
	}, [state.confirmDelete, workspace.id, removeWorkspace, onClose]);

	// Close on Escape key
	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [onClose]);

	// Focus trap — contain Tab/Shift+Tab within the dialog
	useEffect(() => {
		const dialog = dialogRef.current;
		if (!dialog) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key !== "Tab") return;
			const focusable = dialog.querySelectorAll<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
			);
			if (focusable.length === 0) return;
			const first = focusable[0]!;
			const last = focusable[focusable.length - 1]!;
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		};
		dialog.addEventListener("keydown", handler);
		// Auto-focus first focusable element on mount
		const firstFocusable = dialog.querySelector<HTMLElement>(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
		);
		firstFocusable?.focus();
		return () => dialog.removeEventListener("keydown", handler);
	}, []);

	const handlePaneUpdate = useCallback(
		(paneId: string, updates: Partial<PaneConfig>) => {
			updatePaneConfig(workspace.id, paneId, updates);
		},
		[workspace.id, updatePaneConfig],
	);

	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: Escape key handled via document listener above
		<div
			role="presentation"
			className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200]"
			onClick={onClose}
		>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation only, keyboard handled by overlay */}
			{/* biome-ignore lint/a11y/useSemanticElements: native dialog has styling/focus-trap limitations */}
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-label="Workspace Settings"
				className="bg-canvas/80 backdrop-blur-2xl border border-edge/50 rounded-md w-[600px] max-w-[calc(100vw-2rem)] h-[85vh] flex flex-col shadow-panel animate-panel-in"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between px-6 py-4 border-b border-edge/50">
					<h2 className="text-sm font-semibold tracking-wide">Workspace Settings</h2>
					{state.saveFailed && <span className="text-[10px] text-danger">Save failed</span>}
					<button
						type="button"
						onClick={onClose}
						aria-label="Close settings"
						className="bg-transparent border-none text-content-muted cursor-pointer text-sm hover:text-content focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none"
					>
						&#x2715;
					</button>
				</div>

				{/* Tab bar — WAI-ARIA tabs pattern with arrow-key navigation */}
				<div className="flex px-6 border-b border-edge/50" role="tablist" aria-label="Settings">
					{SETTINGS_TABS.map((tab) => (
						<button
							key={tab}
							id={`settings-tab-${tab}`}
							type="button"
							role="tab"
							aria-selected={state.activeTab === tab}
							aria-controls={`settings-tabpanel-${tab}`}
							tabIndex={state.activeTab === tab ? 0 : -1}
							onClick={() => update({ activeTab: tab })}
							onKeyDown={(e) => {
								const idx = SETTINGS_TABS.indexOf(tab);
								if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
									e.preventDefault();
									const next =
										e.key === "ArrowRight"
											? SETTINGS_TABS[(idx + 1) % SETTINGS_TABS.length]!
											: SETTINGS_TABS[(idx - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length]!;
									update({ activeTab: next });
									document.getElementById(`settings-tab-${next}`)?.focus();
								}
							}}
							className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer bg-transparent ${
								state.activeTab === tab
									? "border-accent text-content"
									: "border-transparent text-content-muted hover:text-content-secondary"
							}`}
						>
							{tab}
						</button>
					))}
				</div>

				<WorkspaceTabPanel
					panes={workspace.panes}
					name={state.name}
					onNameChange={(v) => update({ name: v })}
					homeDir={homeDir}
					currentPreset={currentPreset}
					onLayoutChange={handleLayoutChange}
					statusBarPosition={state.statusBarPosition}
					onStatusBarPositionChange={(v) => update({ statusBarPosition: v })}
					onPaneUpdate={handlePaneUpdate}
					hidden={state.activeTab !== "Workspace"}
				/>

				<TerminalTabPanel
					selectedPreset={state.themePreset}
					onPresetChange={(name) => dispatch({ type: "APPLY_PRESET", preset: name })}
					fontFamily={state.fontFamily}
					onFontFamilyChange={(v) => update({ fontFamily: v })}
					fontSize={state.fontSize}
					onFontSizeChange={(v) => update({ fontSize: v })}
					lineHeight={state.lineHeight}
					onLineHeightChange={(v) => update({ lineHeight: v })}
					cursorStyle={state.cursorStyle}
					onCursorStyleChange={(v) => update({ cursorStyle: v })}
					scrollback={state.scrollback}
					onScrollbackChange={(v) => update({ scrollback: v })}
					effects={effects}
					onEffectChange={handleEffectChange}
					hidden={state.activeTab !== "Terminal"}
				/>

				<AboutTabPanel
					updateState={updateState}
					updateActions={updateActions}
					hidden={state.activeTab !== "About"}
				/>

				<div className="flex items-center gap-2 px-6 py-3 border-t border-edge/50">
					<button
						type="button"
						onClick={handleDelete}
						className={`border cursor-pointer text-xs py-1.5 px-3 rounded-sm focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none ${
							state.confirmDelete
								? "bg-danger text-white border-danger"
								: "bg-transparent border-danger text-danger hover:bg-danger/10"
						}`}
					>
						{state.confirmDelete ? "Are you sure?" : "Delete Workspace"}
					</button>
					<div className="flex-1" />
					<button
						type="button"
						onClick={onClose}
						className="bg-transparent border border-edge text-content-secondary cursor-pointer text-xs py-1.5 px-3 rounded-sm hover:text-content hover:border-content-muted focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none"
					>
						Done
					</button>
				</div>
			</div>
		</div>
	);
}
