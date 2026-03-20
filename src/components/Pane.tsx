import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findPreset, mergeThemeWithPreset } from "../data/theme-presets";
import { useFileDrop } from "../hooks/useFileDrop";
import { useInlineEdit } from "../hooks/useInlineEdit";
import { usePaneDragDrop } from "../hooks/usePaneDragDrop";
import { ZONE_STYLES } from "../lib/pane-drag-utils";
import type { ScreenPosition } from "../lib/ui-constants";
import {
	effectMul,
	type GridSnapshot,
	MAX_UNFOCUSED_DIM,
	type PaneConfig,
	type PaneScrollDetail,
	type PaneTheme,
	type PrInfo,
} from "../shared/types";
import { useStore } from "../store";
import { shortenPath } from "../utils/path";
import { modKey } from "../utils/platform";
import { CanvasTerminal } from "./CanvasTerminal";
import { PaneContextMenu } from "./PaneContextMenu";
import { PaneBackgroundEffects, PaneOverlayEffects } from "./PaneEffects";
import { getVariant, type VariantTheme } from "./pane-chrome";
import { buildVariantTheme } from "./pane-chrome/shared";
import { SnippetDropdown } from "./SnippetDropdown";

/** Stable component for snippet trigger — defined outside Pane to avoid
 *  creating a new component type on every render or memo invalidation. */
function PaneSnippetTrigger({
	paneId,
	statusBarPosition,
	...rest
}: {
	paneId: string;
	statusBarPosition: "top" | "bottom";
	className?: string | undefined;
	style?: React.CSSProperties | undefined;
	children?: React.ReactNode;
}) {
	return <SnippetDropdown paneId={paneId} statusBarPosition={statusBarPosition} {...rest} />;
}

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

export const Pane = memo(function Pane({
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
	const [ptyError, setPtyError] = useState(false);
	const homeDir = useStore((s) => s.homeDir);

	// --- Scrollback state ---
	// scrollOffset: rows from bottom (0 = live viewport, >0 = scrolled into scrollback)
	const scrollOffsetRef = useRef(0);
	const maxScrollRef = useRef(0);
	const isScrolledRef = useRef(false);
	const pendingScrollDelta = useRef(0);
	const scrollRafId = useRef(0);
	const [scrollbarVisible, setScrollbarVisible] = useState(false);
	const scrollbarTimerRef = useRef<ReturnType<typeof setTimeout>>(null);

	const { isDragging, dropZone, outerRef, handleHeaderPointerDown } = usePaneDragDrop({
		paneId,
		workspaceId,
		onFocus,
	});

	const ensurePty = useStore((s) => s.ensurePty);
	// One-shot capture — PTY should only use initial CWD and startup command
	const initialCwdRef = useRef(config.cwd);
	const initialCmdRef = useRef(config.startupCommand);
	useEffect(() => {
		ensurePty(paneId, initialCwdRef.current, initialCmdRef.current);
	}, [paneId, ensurePty]);

	// Subscribe to grid snapshots from Rust PTY renderer.
	// RAF-throttle: coalesce rapid PTY updates into one React render per frame.
	// When the user is scrolled into scrollback, store the latest render but don't
	// display it — the user sees the scroll-request snapshots instead.
	const pendingGridRef = useRef<GridSnapshot | null>(null);
	const rafIdRef = useRef(0);
	useEffect(() => {
		const unsub = window.api.onTerminalRender((id, snapshot) => {
			if (id !== paneId) return;

			// Always track the latest scrollback depth for clamping scroll offset
			maxScrollRef.current = snapshot.scrollbackRows;

			// When scrolled up, store but don't display — user sees scroll snapshots
			if (isScrolledRef.current) {
				pendingGridRef.current = snapshot;
				return;
			}

			pendingGridRef.current = snapshot;
			if (rafIdRef.current === 0) {
				rafIdRef.current = requestAnimationFrame(() => {
					rafIdRef.current = 0;
					const latest = pendingGridRef.current;
					if (latest) {
						pendingGridRef.current = null;
						setGrid(latest);
					}
				});
			}
		});
		return () => {
			unsub();
			if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
		};
	}, [paneId]);

	const scrollToBottom = useCallback(() => {
		scrollOffsetRef.current = 0;
		isScrolledRef.current = false;
		const latest = pendingGridRef.current;
		if (latest) {
			pendingGridRef.current = null;
			setGrid(latest);
		} else {
			// No stored snapshot — request a fresh one at the bottom
			window.api.scrollTerminal(paneId, 0).then(setGrid).catch(console.error);
		}
	}, [paneId]);

	const scrollToTop = useCallback(() => {
		const max = maxScrollRef.current;
		if (max <= 0) return;
		scrollOffsetRef.current = max;
		isScrolledRef.current = true;
		window.api.scrollTerminal(paneId, max).then(setGrid).catch(console.error);
	}, [paneId]);

	const handleWrite = useCallback(
		(data: string) => {
			// Auto-scroll to bottom on user input
			if (isScrolledRef.current) {
				scrollToBottom();
			}

			window.api.writePty(paneId, data).catch((err: unknown) => {
				console.error(`[pane] writePty failed for ${paneId}:`, err);
				setPtyError(true);
			});
		},
		[paneId, scrollToBottom],
	);

	const handleResize = useCallback(
		(cols: number, rows: number, pixelWidth: number, pixelHeight: number) => {
			window.api.resizePty(paneId, cols, rows, pixelWidth, pixelHeight).catch((err: unknown) => {
				console.error(`[pane] resizePty failed for ${paneId}:`, err);
			});
		},
		[paneId],
	);

	const { isDropTarget } = useFileDrop({ containerRef: outerRef, onWrite: handleWrite });

	// RAF-throttled scroll handler — accumulates fractional deltas from trackpad,
	// rounds to integer offset, and coalesces into one IPC call per frame.
	const handleScroll = useCallback(
		(deltaLines: number) => {
			// Show scrollbar, auto-hide after 2s of inactivity
			setScrollbarVisible(true);
			if (scrollbarTimerRef.current) clearTimeout(scrollbarTimerRef.current);
			scrollbarTimerRef.current = setTimeout(() => setScrollbarVisible(false), 2000);

			pendingScrollDelta.current += deltaLines;
			if (scrollRafId.current !== 0) return;

			scrollRafId.current = requestAnimationFrame(() => {
				scrollRafId.current = 0;
				const totalDelta = pendingScrollDelta.current;
				pendingScrollDelta.current = 0;

				const rawOffset = scrollOffsetRef.current + totalDelta;
				const newOffset = Math.max(0, Math.min(maxScrollRef.current, Math.round(rawOffset)));
				if (newOffset === scrollOffsetRef.current) return;
				scrollOffsetRef.current = newOffset;
				isScrolledRef.current = newOffset > 0;

				if (newOffset === 0) {
					scrollToBottom();
					return;
				}

				window.api
					.scrollTerminal(paneId, newOffset)
					.then((snapshot) => {
						maxScrollRef.current = snapshot.scrollbackRows;
						// Only display if still scrolled at this position
						if (scrollOffsetRef.current > 0) {
							setGrid(snapshot);
						}
					})
					.catch((err: unknown) => {
						console.error(`[pane] scrollTerminal failed for ${paneId}:`, err);
					});
			});
		},
		[paneId, scrollToBottom],
	);

	// Listen for Mod+Up/Down scroll shortcuts dispatched by useKeyboardShortcuts
	useEffect(() => {
		const handler = (e: Event) => {
			const { paneId: targetId, to } = (e as CustomEvent<PaneScrollDetail>).detail;
			if (targetId !== paneId) return;
			if (to === "bottom") scrollToBottom();
			else scrollToTop();
		};
		window.addEventListener("pane:scroll", handler);
		return () => window.removeEventListener("pane:scroll", handler);
	}, [paneId, scrollToBottom, scrollToTop]);

	const { isEditing, inputProps, startEditing } = useInlineEdit(config.label, (label) =>
		onUpdateConfig(paneId, { label }),
	);

	const handleContextMenu = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		setContextPos({ x: e.clientX, y: e.clientY });
		setShowContext(true);
	}, []);

	const shortCwd = shortenPath(config.cwd, homeDir);
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

	// Stable key — prevents the effect from firing when the ansiColors object
	// reference changes but values are identical (e.g. useMemo recompute).
	const ansiColorsKey = useMemo(
		() => (mergedTheme.ansiColors ? JSON.stringify(mergedTheme.ansiColors) : null),
		[mergedTheme.ansiColors],
	);

	// Sync theme ANSI palette to Rust when palette-related fields change.
	// biome-ignore lint/correctness/useExhaustiveDependencies: ansiColorsKey replaces mergedTheme.ansiColors — JSON serialization avoids redundant IPC on object-reference churn
	useEffect(() => {
		if (mergedTheme.ansiColors) {
			window.api
				.setTerminalColors(
					paneId,
					mergedTheme.ansiColors,
					mergedTheme.foreground,
					mergedTheme.background,
				)
				.catch((err: unknown) => {
					console.error(`[pane] setTerminalColors failed for ${paneId}:`, err);
				});
		}
	}, [paneId, ansiColorsKey, mergedTheme.foreground, mergedTheme.background]);

	const handleOpenExternal = useCallback((url: string) => {
		window.api.openExternal(url).catch((err: unknown) => {
			console.error("[pane] Failed to open URL:", url, err);
		});
	}, []);

	// Stable snippet trigger props — avoids creating new component type per render
	const snippetTriggerProps = useMemo(
		() => ({ paneId, statusBarPosition }),
		[paneId, statusBarPosition],
	);

	const handleFocus = useCallback(() => onFocus(paneId), [paneId, onFocus]);

	// Compute dim opacity once, use inline style exclusively (no class/inline conflict)
	const dimOpacity =
		!isFocused && workspaceTheme.unfocusedDim > 0
			? Math.max(0, Math.min(MAX_UNFOCUSED_DIM, workspaceTheme.unfocusedDim))
			: 0;

	// Scrollbar metrics — derived from the current grid snapshot
	const scrollColor = mergedTheme.accent ?? mergedTheme.glow ?? mergedTheme.foreground;
	const scrollbarBaseOpacity = effectMul(mergedTheme.scrollbarAccent ?? "subtle");
	const hasScrollback = grid !== null && grid.scrollbackRows > 0;
	const isUserScrolled = grid !== null && grid.scrollOffset > 0;

	let scrollThumbTop = 0;
	let scrollThumbHeight = 100;
	if (hasScrollback && grid) {
		const totalContent = grid.scrollbackRows + grid.totalRows;
		scrollThumbHeight = Math.max(5, (grid.totalRows / totalContent) * 100);
		scrollThumbTop = ((grid.scrollbackRows - grid.scrollOffset) / totalContent) * 100;
	}

	return (
		<div
			ref={outerRef}
			data-pane-id={paneId}
			className="flex flex-col h-full w-full relative overflow-hidden select-none"
			onMouseDown={handleFocus}
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
					SnippetTrigger={(props) => <PaneSnippetTrigger {...snippetTriggerProps} {...props} />}
					shortcuts={{
						splitV: `${modKey}+D`,
						splitH: `${modKey}+Shift+D`,
						close: `${modKey}+W`,
					}}
					headerProps={{
						"aria-roledescription": "draggable pane",
						onPointerDown: handleHeaderPointerDown,
						onContextMenu: handleContextMenu,
						className: `shrink-0 relative select-none cursor-grab active:cursor-grabbing ${isDragging ? "opacity-40" : ""}`,
					}}
					contextMenu={null}
				>
					<div className="flex-1 overflow-hidden p-2 relative h-full">
						<CanvasTerminal
							grid={grid}
							onWrite={handleWrite}
							onResize={handleResize}
							onScroll={handleScroll}
							fontSize={mergedTheme.fontSize}
							fontFamily={mergedTheme.fontFamily}
							lineHeight={mergedTheme.lineHeight}
							background={mergedTheme.background}
							cursorStyle={mergedTheme.cursorStyle}
							cursorColor={mergedTheme.cursorColor ?? mergedTheme.foreground}
							isFocused={isFocused}
							selectionColor={mergedTheme.selectionColor}
							paneId={paneId}
						/>
						{/* Scrollbar — themed track, fades in on scroll, fades out after 2s */}
						{hasScrollback && (
							<div
								className="absolute right-2 top-2 bottom-2 w-2 z-20 pointer-events-none transition-opacity duration-500"
								style={{ opacity: scrollbarVisible ? 1 : 0 }}
							>
								<div
									className="absolute right-0 w-1 rounded-full"
									style={{
										top: `${scrollThumbTop}%`,
										height: `${scrollThumbHeight}%`,
										backgroundColor: scrollColor,
										opacity: isUserScrolled
											? Math.max(scrollbarBaseOpacity, 0.5)
											: scrollbarBaseOpacity,
									}}
								/>
							</div>
						)}
						{/* Scroll-to-bottom — themed per variant */}
						{isUserScrolled && (
							<variant.ScrollButton onClick={scrollToBottom} theme={variantTheme} />
						)}
						{/* Dim overlay — uses inline style exclusively to avoid class/inline transition conflict */}
						<div
							className="absolute inset-0 bg-black pointer-events-none transition-opacity duration-150"
							style={{ opacity: dimOpacity }}
						/>
						{ptyError && (
							<div className="absolute bottom-2 left-2 right-2 text-xs text-danger bg-danger/10 rounded px-2 py-1 pointer-events-none">
								Terminal disconnected
							</div>
						)}
					</div>
				</variant.Frame>
			</div>

			<PaneOverlayEffects theme={mergedTheme} />

			{/* Drop zone overlay — shows where the dragged pane will land */}
			{dropZone && (
				<div className="absolute pointer-events-none z-40" style={ZONE_STYLES[dropZone]} />
			)}

			{/* File drop overlay — shows when files are dragged over this pane */}
			{isDropTarget && (
				<div className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center bg-accent/10 border-2 border-dashed border-accent/40 rounded">
					<span className="text-xs font-medium text-content-muted bg-canvas/80 backdrop-blur-sm rounded px-3 py-1.5">
						Drop files here
					</span>
				</div>
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
});
