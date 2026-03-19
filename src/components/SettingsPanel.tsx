import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_PRESET_NAME, findPreset } from "../data/theme-presets";
import {
	DEFAULT_CURSOR_STYLE,
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
	onClose: () => void;
}

const SETTINGS_TABS = ["Workspace", "Terminal"] as const;
type SettingsTab = (typeof SETTINGS_TABS)[number];

export function SettingsPanel({ workspace, onClose }: SettingsPanelProps) {
	const updateWorkspace = useStore((s) => s.updateWorkspace);
	const removeWorkspace = useStore((s) => s.removeWorkspace);
	const updatePaneConfig = useStore((s) => s.updatePaneConfig);
	const killPtys = useStore((s) => s.killPtys);
	const homeDir = useStore((s) => s.homeDir);

	const [activeTab, setActiveTab] = useState<SettingsTab>("Workspace");
	const [name, setName] = useState(workspace.name);
	const [color, setColor] = useState(workspace.color);
	const [selectedPreset, setSelectedPreset] = useState(
		workspace.theme.preset ?? DEFAULT_PRESET_NAME,
	);
	const [fontSize, setFontSize] = useState(workspace.theme.fontSize);
	const [fontFamily, setFontFamily] = useState(workspace.theme.fontFamily ?? "");
	const [scrollback, setScrollback] = useState(workspace.theme.scrollback ?? DEFAULT_SCROLLBACK);
	const [cursorStyle, setCursorStyle] = useState(
		workspace.theme.cursorStyle ?? DEFAULT_CURSOR_STYLE,
	);
	const [statusBarPosition, setStatusBarPosition] = useState<"top" | "bottom">(
		workspace.theme.statusBarPosition ?? "top",
	);
	const [dimLevel, setDimLevel] = useState<EffectLevel>(
		closestLevel(workspace.theme.unfocusedDim, DIM_VALUES),
	);
	const [opacityLevel, setOpacityLevel] = useState<EffectLevel>(
		closestLevel(workspace.theme.paneOpacity ?? DEFAULT_PANE_OPACITY, OPACITY_VALUES),
	);
	const [gradientLevel, setGradientLevel] = useState<EffectLevel>(
		isEffectLevel(workspace.theme.gradientLevel) ? workspace.theme.gradientLevel : "off",
	);
	const [glowLevel, setGlowLevel] = useState<EffectLevel>(
		isEffectLevel(workspace.theme.glowLevel) ? workspace.theme.glowLevel : "off",
	);
	const [scanlineLevel, setScanlineLevel] = useState<EffectLevel>(
		isEffectLevel(workspace.theme.scanlineLevel) ? workspace.theme.scanlineLevel : "off",
	);
	const [noiseLevel, setNoiseLevel] = useState<EffectLevel>(
		isEffectLevel(workspace.theme.noiseLevel) ? workspace.theme.noiseLevel : "off",
	);
	const [lineHeight, setLineHeight] = useState(workspace.theme.lineHeight ?? DEFAULT_LINE_HEIGHT);
	const [saveFailed, setSaveFailed] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);

	const dialogRef = useRef<HTMLDivElement>(null);
	const currentPreset = workspace.layout.type === "preset" ? workspace.layout.preset : null;

	const effects: Record<EffectCategory, EffectLevel> = {
		dim: dimLevel,
		opacity: opacityLevel,
		gradient: gradientLevel,
		glow: glowLevel,
		scanline: scanlineLevel,
		noise: noiseLevel,
	};

	const handleEffectChange = useCallback(
		(category: EffectCategory, level: EffectLevel) => {
			const setters: Record<EffectCategory, (l: EffectLevel) => void> = {
				dim: setDimLevel,
				opacity: setOpacityLevel,
				gradient: setGradientLevel,
				glow: setGlowLevel,
				scanline: setScanlineLevel,
				noise: setNoiseLevel,
			};
			setters[category](level);
		},
		// biome-ignore lint/correctness/useExhaustiveDependencies: useState dispatchers are stable
		[],
	);

	const buildThemeFromInputs = useCallback((): PaneTheme => {
		const preset = findPreset(selectedPreset);
		if (!preset) console.warn("[settings] unknown theme preset:", selectedPreset);
		return {
			background: preset?.background ?? "#1a1a2e",
			foreground: preset?.foreground ?? "#e0e0e0",
			fontSize,
			unfocusedDim: DIM_VALUES[dimLevel],
			...(fontFamily ? { fontFamily } : {}),
			scrollback,
			cursorStyle,
			statusBarPosition,
			paneOpacity: OPACITY_VALUES[opacityLevel],
			...(preset?.ansiColors ? { ansiColors: preset.ansiColors } : {}),
			...(preset?.accent ? { accent: preset.accent } : {}),
			...(preset?.glow ? { glow: preset.glow } : {}),
			...(preset?.gradient ? { gradient: preset.gradient } : {}),
			gradientLevel,
			glowLevel,
			scanlineLevel,
			noiseLevel,
			...(preset?.scrollbarAccent ? { scrollbarAccent: preset.scrollbarAccent } : {}),
			...(preset?.cursorColor ? { cursorColor: preset.cursorColor } : {}),
			...(preset?.selectionColor ? { selectionColor: preset.selectionColor } : {}),
			lineHeight,
			preset: selectedPreset,
		};
	}, [
		selectedPreset,
		fontSize,
		dimLevel,
		fontFamily,
		scrollback,
		cursorStyle,
		statusBarPosition,
		opacityLevel,
		gradientLevel,
		glowLevel,
		scanlineLevel,
		noiseLevel,
		lineHeight,
	]);

	/** Persist workspace, surfacing errors to the user via saveFailed indicator. */
	const persistWorkspace = useCallback(
		(ws: Workspace) => {
			setSaveFailed(false);
			updateWorkspace(ws).catch((err: unknown) => {
				console.error("[settings] persist failed:", err);
				setSaveFailed(true);
			});
		},
		[updateWorkspace],
	);

	// Auto-persist: save full workspace with updated color/theme whenever those fields change.
	// Reads latest workspace from store (not the prop) to avoid overwriting concurrent updates.
	// Tracks previous values via ref and compares to current values before persisting.
	// A simple useRef(false) mount guard would misfire under React 18 StrictMode,
	// which double-invokes effects on mount.
	const prevAutoSaveRef = useRef({ color, buildThemeFromInputs });
	useEffect(() => {
		if (
			prevAutoSaveRef.current.color === color &&
			prevAutoSaveRef.current.buildThemeFromInputs === buildThemeFromInputs
		) {
			return;
		}
		prevAutoSaveRef.current = { color, buildThemeFromInputs };
		const latest = getLatestWorkspace(workspace.id);
		if (!latest) return;
		// Debounce theme persist to avoid saving on every keystroke (e.g. font-size stepper)
		const timer = setTimeout(() => {
			const current = getLatestWorkspace(workspace.id);
			if (!current) return;
			persistWorkspace({ ...current, color, theme: buildThemeFromInputs() });
		}, 200);
		return () => clearTimeout(timer);
	}, [workspace.id, color, buildThemeFromInputs, persistWorkspace]);

	// Reset effect levels to preset defaults when the user switches presets.
	const prevPresetRef = useRef(selectedPreset);
	useEffect(() => {
		if (prevPresetRef.current === selectedPreset) return;
		prevPresetRef.current = selectedPreset;
		const preset = findPreset(selectedPreset);
		setGradientLevel(preset?.gradientLevel ?? "off");
		setGlowLevel(preset?.glowLevel ?? "off");
		setScanlineLevel(preset?.scanlineLevel ?? "off");
		setNoiseLevel(preset?.noiseLevel ?? "off");
		setStatusBarPosition(preset?.statusBarPosition ?? "top");
		if (preset) {
			if (preset.fontFamily) setFontFamily(preset.fontFamily);
			else setFontFamily("");
			if (preset.fontSize) setFontSize(preset.fontSize);
			else setFontSize(14);
			if (preset.lineHeight) setLineHeight(preset.lineHeight);
			else setLineHeight(DEFAULT_LINE_HEIGHT);
		}
	}, [selectedPreset]);

	// Auto-persist name with debounce.
	// Uses value-comparison ref instead of useRef(false) mount guard for StrictMode compat.
	const prevNameRef = useRef(name);
	useEffect(() => {
		if (prevNameRef.current === name) return;
		prevNameRef.current = name;
		const trimmed = name.trim();
		if (!trimmed) return;
		const latest = getLatestWorkspace(workspace.id);
		if (!latest || trimmed === latest.name) return;
		const timer = setTimeout(() => {
			const current = getLatestWorkspace(workspace.id);
			if (!current) return;
			persistWorkspace({ ...current, name: trimmed });
		}, 300);
		return () => clearTimeout(timer);
	}, [workspace.id, name, persistWorkspace]);

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
		if (!confirmDelete) {
			setConfirmDelete(true);
			// Reset after 3 seconds if user doesn't confirm
			setTimeout(() => setConfirmDelete(false), 3000);
			return;
		}
		removeWorkspace(workspace.id);
		onClose();
	}, [confirmDelete, workspace.id, removeWorkspace, onClose]);

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
					{saveFailed && <span className="text-[10px] text-danger">Save failed</span>}
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
							aria-selected={activeTab === tab}
							aria-controls={`settings-tabpanel-${tab}`}
							tabIndex={activeTab === tab ? 0 : -1}
							onClick={() => setActiveTab(tab)}
							onKeyDown={(e) => {
								const idx = SETTINGS_TABS.indexOf(tab);
								if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
									e.preventDefault();
									const next =
										e.key === "ArrowRight"
											? SETTINGS_TABS[(idx + 1) % SETTINGS_TABS.length]!
											: SETTINGS_TABS[(idx - 1 + SETTINGS_TABS.length) % SETTINGS_TABS.length]!;
									setActiveTab(next);
									document.getElementById(`settings-tab-${next}`)?.focus();
								}
							}}
							className={`px-4 py-2 text-xs font-medium border-b-2 transition-colors cursor-pointer bg-transparent ${
								activeTab === tab
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
					name={name}
					onNameChange={setName}
					color={color}
					onColorChange={setColor}
					homeDir={homeDir}
					currentPreset={currentPreset}
					onLayoutChange={handleLayoutChange}
					statusBarPosition={statusBarPosition}
					onStatusBarPositionChange={setStatusBarPosition}
					onPaneUpdate={handlePaneUpdate}
					hidden={activeTab !== "Workspace"}
				/>

				<TerminalTabPanel
					selectedPreset={selectedPreset}
					onPresetChange={setSelectedPreset}
					fontFamily={fontFamily}
					onFontFamilyChange={setFontFamily}
					fontSize={fontSize}
					onFontSizeChange={setFontSize}
					lineHeight={lineHeight}
					onLineHeightChange={setLineHeight}
					cursorStyle={cursorStyle}
					onCursorStyleChange={setCursorStyle}
					scrollback={scrollback}
					onScrollbackChange={setScrollback}
					effects={effects}
					onEffectChange={handleEffectChange}
					hidden={activeTab !== "Terminal"}
				/>

				<div className="flex items-center gap-2 px-6 py-3 border-t border-edge/50">
					<button
						type="button"
						onClick={handleDelete}
						className={`border cursor-pointer text-xs py-1.5 px-3 rounded-sm focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none ${
							confirmDelete
								? "bg-danger text-white border-danger"
								: "bg-transparent border-danger text-danger hover:bg-danger/10"
						}`}
					>
						{confirmDelete ? "Are you sure?" : "Delete Workspace"}
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
