import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { findPreset, mergeThemeWithPreset } from "../data/theme-presets";
import { useFileDrop } from "../hooks/useFileDrop";
import { useInlineEdit } from "../hooks/useInlineEdit";
import { usePaneDragDrop } from "../hooks/usePaneDragDrop";
import { ZONE_STYLES } from "../lib/pane-drag-utils";
import { SCROLLBAR_HIDE_DELAY_MS, type ScreenPosition } from "../lib/ui-constants";
import {
	clampFontSize,
	effectMul,
	type GridSnapshot,
	MAX_UNFOCUSED_DIM,
	PANE_RENAME_EVENT,
	PANE_SCROLL_EVENT,
	type PaneConfig,
	type PaneRenameDetail,
	type PaneScrollDetail,
	type PaneTheme,
	type PrInfo,
} from "../shared/types";
import { useStore } from "../store";
import { shortenPath } from "../utils/path";
import { modKey } from "../utils/platform";
import { CanvasTerminal, type CanvasTerminalHandle } from "./CanvasTerminal";
import { PaneContextMenu } from "./PaneContextMenu";
import { PaneBackgroundEffects, PaneOverlayEffects } from "./PaneEffects";
import { getVariant, type VariantTheme } from "./pane-chrome";
import { buildVariantTheme } from "./pane-chrome/shared";
import { SnippetDropdown } from "./SnippetDropdown";
import { TerminalContextMenu } from "./TerminalContextMenu";

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
	const [terminalContext, setTerminalContext] = useState<{
		pos: ScreenPosition;
		hasSelection: boolean;
	} | null>(null);
	const terminalHandleRef = useRef<CanvasTerminalHandle | null>(null);
	const [grid, setGrid] = useState<GridSnapshot | null>(null);
	const [ptyError, setPtyError] = useState(false);
	const homeDir = useStore((s) => s.homeDir);
	const agentStatus = useStore((s) => s.paneAgentStatuses[paneId] ?? "idle");

	// --- Scrollback state ---
	// scrollOffset: rows from bottom (0 = live viewport, >0 = scrolled into scrollback)
	const scrollOffsetRef = useRef(0);
	const maxScrollRef = useRef(0);
	const isScrolledRef = useRef(false);
	const pendingScrollDelta = useRef(0);
	const scrollRafId = useRef(0);
	const [scrollbarVisible, setScrollbarVisible] = useState(false);
	const scrollbarVisibleRef = useRef(false);
	const scrollbarTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
	const scrollbarTrackRef = useRef<HTMLDivElement>(null);
	const scrollDragCleanupRef = useRef<(() => void) | null>(null);

	// Scrollbar visibility helpers — guard state updates so continuous scrolling
	// doesn't fire no-op setScrollbarVisible(true) every animation frame.
	const showScrollbar = useCallback(() => {
		if (!scrollbarVisibleRef.current) {
			scrollbarVisibleRef.current = true;
			setScrollbarVisible(true);
		}
		if (scrollbarTimerRef.current) clearTimeout(scrollbarTimerRef.current);
	}, []);

	const scheduleScrollbarHide = useCallback(() => {
		scrollbarTimerRef.current = setTimeout(() => {
			scrollbarVisibleRef.current = false;
			setScrollbarVisible(false);
		}, SCROLLBAR_HIDE_DELAY_MS);
	}, []);

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
					// Re-check: user may have scrolled up between event and RAF execution
					if (isScrolledRef.current) return;
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

	// Shared scroll-to-offset logic — sets refs and fires IPC (or snaps to bottom).
	// Used by both the scrollbar drag handler and the wheel-scroll handler.
	const applyScrollOffset = useCallback(
		(newOffset: number) => {
			// Defensively clamp to non-negative integer
			const clamped = Math.max(0, Math.round(newOffset));

			if (clamped === 0) {
				scrollToBottom();
				return;
			}

			scrollOffsetRef.current = clamped;
			isScrolledRef.current = true;

			window.api
				.scrollTerminal(paneId, clamped)
				.then((snapshot) => {
					maxScrollRef.current = snapshot.scrollbackRows;
					if (scrollOffsetRef.current > 0) setGrid(snapshot);
				})
				.catch((err: unknown) => {
					console.error(`[pane] scrollTerminal failed for ${paneId}:`, err);
				});
		},
		[paneId, scrollToBottom],
	);

	const scrollToTop = useCallback(() => {
		const max = maxScrollRef.current;
		if (max <= 0) return;
		applyScrollOffset(max);
	}, [applyScrollOffset]);

	// Scrollbar drag — convert pointer Y within the track to a scroll offset.
	// Uses document-level move/up listeners with a cleanup-ref for unmount safety
	// (matches usePaneDragDrop pattern). Drag moves are RAF-throttled to one IPC
	// call per frame, consistent with handleScroll.
	const handleScrollbarPointerDown = useCallback(
		(e: React.PointerEvent<HTMLDivElement>) => {
			const track = scrollbarTrackRef.current;
			if (!track) {
				console.warn(`[pane] scrollbar track ref missing for ${paneId}`);
				return;
			}
			e.preventDefault();
			e.stopPropagation();

			const rect = track.getBoundingClientRect();
			if (rect.height <= 0) {
				console.warn(`[pane] scrollbar track has zero height for ${paneId}`);
				return;
			}

			// Capture pointer so touch drags aren't hijacked by the browser
			track.setPointerCapture(e.pointerId);
			const pointerId = e.pointerId;

			// Re-read rect each call — window may resize mid-drag; cost is
			// negligible vs. the IPC call that follows.
			const jumpToY = (clientY: number) => {
				const r = track.getBoundingClientRect();
				if (r.height <= 0) return;
				const ratio = Math.max(0, Math.min(1, (clientY - r.top) / r.height));
				// ratio 0 = top of scrollback, ratio 1 = bottom (live viewport)
				const max = maxScrollRef.current;
				const newOffset = Math.round(max * (1 - ratio));
				if (newOffset === scrollOffsetRef.current) return;
				applyScrollOffset(newOffset);
			};

			showScrollbar();
			jumpToY(e.clientY);

			// RAF-throttle drag moves to one IPC call per frame
			let latestClientY = e.clientY;
			let dragRafId = 0;
			const onMove = (ev: PointerEvent) => {
				latestClientY = ev.clientY;
				if (dragRafId === 0) {
					dragRafId = requestAnimationFrame(() => {
						dragRafId = 0;
						jumpToY(latestClientY);
					});
				}
			};
			const onUp = () => {
				if (dragRafId) cancelAnimationFrame(dragRafId);
				track.releasePointerCapture(pointerId);
				document.removeEventListener("pointermove", onMove);
				document.removeEventListener("pointerup", onUp);
				scrollDragCleanupRef.current = null;
				scheduleScrollbarHide();
			};

			// Clean up any stale listeners before adding new ones
			scrollDragCleanupRef.current?.();

			document.addEventListener("pointermove", onMove);
			document.addEventListener("pointerup", onUp);
			scrollDragCleanupRef.current = () => {
				if (dragRafId) cancelAnimationFrame(dragRafId);
				track.releasePointerCapture(pointerId);
				document.removeEventListener("pointermove", onMove);
				document.removeEventListener("pointerup", onUp);
			};
		},
		[applyScrollOffset, paneId, showScrollbar, scheduleScrollbarHide],
	);

	// Cleanup scrollbar drag listeners and pending scroll RAF on unmount
	useEffect(() => {
		return () => {
			scrollDragCleanupRef.current?.();
			if (scrollRafId.current) cancelAnimationFrame(scrollRafId.current);
		};
	}, []);

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

	const handleFontSizeChange = useCallback(
		(newSize: number) => {
			// Read themeOverride from the store imperatively to keep this callback stable —
			// avoids recreation on every font size change (which would churn CanvasTerminal props)
			const ws = useStore.getState().workspaces.find((w) => w.id === workspaceId);
			const currentOverride = ws?.panes[paneId]?.themeOverride;
			onUpdateConfig(paneId, {
				themeOverride: { ...(currentOverride ?? {}), fontSize: clampFontSize(newSize) },
			});
		},
		[paneId, workspaceId, onUpdateConfig],
	);

	const handleTerminalContextMenu = useCallback((pos: ScreenPosition, hasSelection: boolean) => {
		setShowContext(false);
		setTerminalContext({ pos, hasSelection });
	}, []);

	const { isDropTarget } = useFileDrop({ containerRef: outerRef, onWrite: handleWrite });

	// RAF-throttled scroll handler — accumulates fractional deltas from trackpad,
	// rounds to integer offset, and coalesces into one IPC call per frame.
	const handleScroll = useCallback(
		(deltaLines: number) => {
			pendingScrollDelta.current += deltaLines;
			if (scrollRafId.current !== 0) return;

			scrollRafId.current = requestAnimationFrame(() => {
				scrollRafId.current = 0;
				const totalDelta = pendingScrollDelta.current;
				pendingScrollDelta.current = 0;

				// No scrollback (alt-buffer): nothing to scroll — just clear any stale flag
				if (maxScrollRef.current === 0) {
					if (isScrolledRef.current) scrollToBottom();
					return;
				}

				showScrollbar();
				scheduleScrollbarHide();

				// Mark scrolled-up so the render RAF won't push new output
				if (totalDelta > 0) isScrolledRef.current = true;

				const rawOffset = scrollOffsetRef.current + totalDelta;
				const newOffset = Math.max(0, Math.min(maxScrollRef.current, Math.round(rawOffset)));
				// Offset unchanged after clamping — e.g. user at bottom scrolls up but
				// delta rounds to 0. Flush any pending render if still flagged as scrolled.
				if (newOffset === scrollOffsetRef.current) {
					if (newOffset === 0 && isScrolledRef.current) scrollToBottom();
					return;
				}
				applyScrollOffset(newOffset);
			});
		},
		[applyScrollOffset, scrollToBottom, showScrollbar, scheduleScrollbarHide],
	);

	// Listen for Mod+Up/Down scroll shortcuts dispatched by useKeyboardShortcuts
	useEffect(() => {
		const handler = (e: Event) => {
			const { paneId: targetId, to } = (e as CustomEvent<PaneScrollDetail>).detail;
			if (targetId !== paneId) return;
			if (to === "bottom") scrollToBottom();
			else scrollToTop();
		};
		window.addEventListener(PANE_SCROLL_EVENT, handler);
		return () => window.removeEventListener(PANE_SCROLL_EVENT, handler);
	}, [paneId, scrollToBottom, scrollToTop]);

	const { isEditing, inputProps, startEditing } = useInlineEdit(config.label, (label) =>
		onUpdateConfig(paneId, { label }),
	);

	// Listen for pane:rename events dispatched by sidebar context menu
	useEffect(() => {
		const handler = (e: Event) => {
			const detail = (e as CustomEvent<PaneRenameDetail>).detail;
			if (!detail?.paneId || detail.paneId !== paneId) return;
			startEditing();
		};
		window.addEventListener(PANE_RENAME_EVENT, handler);
		return () => window.removeEventListener(PANE_RENAME_EVENT, handler);
	}, [paneId, startEditing]);

	const handleContextMenu = useCallback((e: React.MouseEvent) => {
		e.preventDefault();
		setTerminalContext(null);
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
					agentStatus={agentStatus}
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
					<div className="flex-1 overflow-hidden p-2 h-full relative">
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
							selectionColor={mergedTheme.selectionColor ?? mergedTheme.accent}
							paneId={paneId}
							accentColor={variantTheme.accent}
							onFontSizeChange={handleFontSizeChange}
							handleRef={terminalHandleRef}
							onTerminalContextMenu={handleTerminalContextMenu}
						/>
						{/* Scrollbar track — themed, fades in/out, supports click-and-drag positioning when visible.
						    Wide hit area (w-5) for touch; visible thumb stays w-1 via pointer-events-none. */}
						{hasScrollback && (
							<div
								ref={scrollbarTrackRef}
								onPointerDown={handleScrollbarPointerDown}
								className={`absolute right-0 top-2 bottom-2 w-5 z-20 touch-none transition-opacity duration-500 ${
									scrollbarVisible ? "pointer-events-auto cursor-pointer" : "pointer-events-none"
								}`}
								style={{ opacity: scrollbarVisible ? 1 : 0 }}
							>
								{/* pointer-events-none on thumb lets pointerdown events reach the track for drag handling */}
								<div
									className="absolute right-2 w-1 rounded-full pointer-events-none"
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

			{terminalContext && terminalHandleRef.current && (
				<TerminalContextMenu
					anchorPos={terminalContext.pos}
					hasSelection={terminalContext.hasSelection}
					terminalHandle={terminalHandleRef.current}
					onWrite={handleWrite}
					onDismiss={() => setTerminalContext(null)}
				/>
			)}
		</div>
	);
});
