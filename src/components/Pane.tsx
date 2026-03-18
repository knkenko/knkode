import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findPreset, mergeThemeWithPreset } from "../data/theme-presets";
import { useInlineEdit } from "../hooks/useInlineEdit";
import { usePaneDragDrop } from "../hooks/usePaneDragDrop";
import { ZONE_STYLES } from "../lib/pane-drag-utils";
import type { ScreenPosition } from "../lib/ui-constants";
import {
	type GridSnapshot,
	MAX_UNFOCUSED_DIM,
	type PaneConfig,
	type PaneTheme,
	type PrInfo,
} from "../shared/types";
import { useStore } from "../store";
import { modKey } from "../utils/platform";
import { CanvasTerminal } from "./CanvasTerminal";
import { PaneContextMenu } from "./PaneContextMenu";
import { PaneBackgroundEffects, PaneOverlayEffects } from "./PaneEffects";
import { getVariant, type VariantTheme } from "./pane-chrome";
import { buildVariantTheme } from "./pane-chrome/shared";
import { SnippetDropdown } from "./SnippetDropdown";

interface PaneProps {
	paneId: string;
	workspaceId: string;
	config: PaneConfig;
	workspaceTheme: PaneTheme;
	onUpdateConfig: (paneId: string, updates: Partial<PaneConfig>) => void;
	onSplitHorizontal: (paneId: string) => void;
	onSplitVertical: (paneId: string) => void;
	onClose: (paneId: string) => void;
	canClose: boolean;
	/** Current git branch for this pane, or null if unavailable. */
	branch: string | null;
	/** Current PR info for this pane's branch, or null if no PR. */
	pr: PrInfo | null;
	isFocused: boolean;
	onFocus: (paneId: string) => void;
}

export function Pane({
	paneId,
	workspaceId,
	config,
	workspaceTheme,
	onUpdateConfig,
	onSplitHorizontal,
	onSplitVertical,
	onClose,
	canClose,
	branch,
	pr,
	isFocused,
	onFocus,
}: PaneProps) {
	const [showContext, setShowContext] = useState(false);
	const [contextPos, setContextPos] = useState<ScreenPosition>({ x: 0, y: 0 });
	const [grid, setGrid] = useState<GridSnapshot | null>(null);

	const {
		isDragging,
		dropZone,
		outerRef,
		handleHeaderMouseDown,
		handleDragStart,
		handleDragEnd,
		handlePaneDragOver,
		handlePaneDragEnter,
		handlePaneDragLeave,
		handlePaneDrop,
	} = usePaneDragDrop({ paneId, workspaceId, onFocus });

	const ensurePty = useStore((s) => s.ensurePty);
	const initialCwdRef = useRef(config.cwd);
	const initialCmdRef = useRef(config.startupCommand);
	useEffect(() => {
		ensurePty(paneId, initialCwdRef.current, initialCmdRef.current);
	}, [paneId, ensurePty]);

	// Subscribe to grid snapshots from Rust PTY renderer
	useEffect(() => {
		const unsub = window.api.onTerminalRender((id, snapshot) => {
			if (id === paneId) setGrid(snapshot);
		});
		return () => {
			unsub();
		};
	}, [paneId]);

	const handleWrite = useCallback(
		(data: string) => {
			window.api.writePty(paneId, data).catch((err: unknown) => {
				console.error(`[pane] writePty failed for ${paneId}:`, err);
			});
		},
		[paneId],
	);

	const handleResize = useCallback(
		(cols: number, rows: number) => {
			window.api.resizePty(paneId, cols, rows).catch((err: unknown) => {
				console.error(`[pane] resizePty failed for ${paneId}:`, err);
			});
		},
		[paneId],
	);

	const { isEditing, inputProps, startEditing } = useInlineEdit(config.label, (label) =>
		onUpdateConfig(paneId, { label }),
	);

	const handleContextMenu = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		setContextPos({ x: e.clientX, y: e.clientY });
		setShowContext(true);
	}, []);

	const shortCwd = config.cwd.replace(/^\/Users\/[^/]+/, "~");
	const statusBarPosition = workspaceTheme.statusBarPosition ?? "top";

	const preset = workspaceTheme.preset ? findPreset(workspaceTheme.preset) : undefined;
	const variant = getVariant(workspaceTheme.preset);
	const variantTheme = useMemo<VariantTheme>(
		() =>
			buildVariantTheme(
				{
					background: workspaceTheme.background,
					foreground: workspaceTheme.foreground,
					accent: workspaceTheme.accent,
					glow: workspaceTheme.glow,
					presetAccent: preset?.accent,
					presetGlow: preset?.glow,
				},
				workspaceTheme.statusBarPosition,
			),
		[
			workspaceTheme.background,
			workspaceTheme.foreground,
			workspaceTheme.accent,
			workspaceTheme.glow,
			workspaceTheme.statusBarPosition,
			preset,
		],
	);

	const mergedTheme = useMemo(
		() => mergeThemeWithPreset(workspaceTheme, config.themeOverride),
		[workspaceTheme, config.themeOverride],
	);

	const handleOpenExternal = useCallback((url: string) => {
		window.api.openExternal(url).catch((err: unknown) => {
			console.error("[pane] Failed to open URL:", url, err);
		});
	}, []);

	const PaneSnippetTrigger = useMemo(
		() =>
			function SnippetTrigger(props: {
				className?: string | undefined;
				style?: React.CSSProperties | undefined;
				children?: React.ReactNode;
			}) {
				return <SnippetDropdown paneId={paneId} statusBarPosition={statusBarPosition} {...props} />;
			},
		[paneId, statusBarPosition],
	);

	const handleFocus = useCallback(() => onFocus(paneId), [paneId, onFocus]);

	return (
		<div
			ref={outerRef}
			className="flex flex-col h-full w-full relative overflow-hidden"
			onMouseDown={handleFocus}
			onDragOver={handlePaneDragOver}
			onDragEnter={handlePaneDragEnter}
			onDragLeave={handlePaneDragLeave}
			onDrop={handlePaneDrop}
		>
			<PaneBackgroundEffects theme={mergedTheme} isFocused={isFocused} />

			<div className="relative z-10 flex flex-col h-full w-full pointer-events-auto">
				<variant.Frame
					label={config.label}
					cwd={shortCwd}
					branch={branch}
					pr={pr}
					onOpenExternal={handleOpenExternal}
					isFocused={isFocused}
					canClose={canClose}
					theme={variantTheme}
					onSplitVertical={() => onSplitVertical(paneId)}
					onSplitHorizontal={() => onSplitHorizontal(paneId)}
					onClose={() => onClose(paneId)}
					onDoubleClickLabel={startEditing}
					isEditing={isEditing}
					editInputProps={inputProps}
					SnippetTrigger={PaneSnippetTrigger}
					shortcuts={{
						splitV: `${modKey}+D`,
						splitH: `${modKey}+Shift+D`,
						close: `${modKey}+W`,
					}}
					headerProps={{
						draggable: !isEditing,
						"aria-roledescription": "draggable pane",
						onDragStart: handleDragStart,
						onDragEnd: handleDragEnd,
						onContextMenu: handleContextMenu,
						onMouseDown: handleHeaderMouseDown,
						className: `shrink-0 relative select-none ${isDragging ? "opacity-40" : ""}`,
					}}
					contextMenu={null}
				>
					<div className="flex-1 overflow-hidden p-px relative h-full">
						<CanvasTerminal
							grid={grid}
							onWrite={handleWrite}
							onResize={handleResize}
							fontSize={mergedTheme.fontSize}
							fontFamily={mergedTheme.fontFamily}
							background={mergedTheme.background}
						/>
						{/* Dim overlay for unfocused panes — always rendered for CSS transition */}
						<div
							className={`absolute inset-0 bg-black pointer-events-none transition-opacity duration-150 ${
								!isFocused && workspaceTheme.unfocusedDim > 0 ? "" : "opacity-0"
							}`}
							style={
								!isFocused && workspaceTheme.unfocusedDim > 0
									? {
											opacity: Math.max(
												0,
												Math.min(MAX_UNFOCUSED_DIM, workspaceTheme.unfocusedDim),
											),
										}
									: undefined
							}
						/>
					</div>
				</variant.Frame>
			</div>

			<PaneOverlayEffects theme={mergedTheme} />

			{/* Drop zone overlay — shows where the dragged pane will land */}
			{dropZone && (
				<div className="absolute pointer-events-none z-40" style={ZONE_STYLES[dropZone]} />
			)}

			{showContext && (
				<PaneContextMenu
					paneId={paneId}
					workspaceId={workspaceId}
					config={config}
					workspaceTheme={workspaceTheme}
					canClose={canClose}
					anchorPos={contextPos}
					onUpdateConfig={(updates) => onUpdateConfig(paneId, updates)}
					onSplitVertical={() => onSplitVertical(paneId)}
					onSplitHorizontal={() => onSplitHorizontal(paneId)}
					onClose={() => onClose(paneId)}
					onRename={startEditing}
					onFocus={handleFocus}
					onDismiss={() => setShowContext(false)}
				/>
			)}
		</div>
	);
}
