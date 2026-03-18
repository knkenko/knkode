import { useMemo } from "react";
import { findPreset } from "../data/theme-presets";
import { DEFAULT_PANE_OPACITY, effectMul, type PaneTheme } from "../shared/types";
import { hexToRgba, isValidGradient, resolveBackground } from "../utils/colors";

interface PaneBackgroundEffectsProps {
	theme: PaneTheme;
	isFocused: boolean;
}

/**
 * Background effects for a pane — gradient, decoration, glow, and the
 * translucent background. Renders at z-0, behind the Frame + terminal content.
 *
 * Sibling: {@link PaneOverlayEffects} renders scanlines/noise at z-20 above content.
 *
 * Pane z-index stacking (in parent): z-0 background, z-10 content, z-20 overlay, z-40 drop zone.
 *
 * Internal stacking: z-0 gradient, z-[1] decoration, z-[2] glow.
 * Uses `contain: layout paint style` on gradient, decoration, and glow layers for GPU compositing.
 */
export function PaneBackgroundEffects({ theme, isFocused }: PaneBackgroundEffectsProps) {
	const { wrapperBg, blurPx } = useMemo(() => {
		const opacity = theme.paneOpacity ?? DEFAULT_PANE_OPACITY;
		return {
			wrapperBg: resolveBackground(theme.background, opacity),
			blurPx: opacity < 1 ? Math.round((1 - opacity) * 24) : 0,
		};
	}, [theme.paneOpacity, theme.background]);

	const { gradientMul, glowMul } = useMemo(
		() => ({
			gradientMul: effectMul(theme.gradientLevel),
			glowMul: effectMul(theme.glowLevel),
		}),
		[theme.gradientLevel, theme.glowLevel],
	);

	const { effectGlow, effectGradient } = useMemo(() => {
		const glow = theme.glow ?? theme.accent;
		const gradient =
			theme.gradient ??
			(glow ? `linear-gradient(180deg, ${hexToRgba(glow, 0.25)} 0%, transparent 50%)` : null);
		return { effectGlow: glow, effectGradient: gradient };
	}, [theme.glow, theme.accent, theme.gradient]);

	const glowInnerAlpha = 0.5 * glowMul;
	const glowOuterAlpha = 0.7 * glowMul;

	const presetDecoration = useMemo(
		() => (theme.preset ? findPreset(theme.preset)?.decoration : undefined),
		[theme.preset],
	);

	return (
		<div
			className="absolute inset-0 pointer-events-none z-0 overflow-hidden rounded-sm"
			style={{
				backgroundColor: wrapperBg,
				backdropFilter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
				WebkitBackdropFilter: blurPx > 0 ? `blur(${blurPx}px)` : undefined,
			}}
		>
			{gradientMul > 0 && effectGradient && isValidGradient(effectGradient) && (
				<div
					className="absolute inset-0 pointer-events-none z-0"
					style={{
						background: effectGradient,
						opacity: gradientMul,
						contain: "layout paint style",
					}}
				/>
			)}
			{presetDecoration && (
				<div
					className="absolute inset-0 pointer-events-none z-[1]"
					style={{ background: presetDecoration, contain: "layout paint style" }}
				/>
			)}
			{glowMul > 0 && effectGlow && (
				<div
					className="pane-glow absolute inset-0 pointer-events-none z-[2] transition-opacity duration-300"
					style={{
						opacity: isFocused ? 1 : 0.5,
						boxShadow: `inset 0 0 18px ${hexToRgba(effectGlow, glowInnerAlpha)}, inset 0 0 12px ${hexToRgba(effectGlow, glowOuterAlpha)}`,
						contain: "layout paint style",
					}}
				/>
			)}
		</div>
	);
}

interface PaneOverlayEffectsProps {
	theme: PaneTheme;
}

/**
 * Foreground overlay effects — scanlines and noise. Renders at z-20, on top of
 * the Frame + terminal content (z-10), so these effects visually affect the text.
 * Fully pointer-events-none so the terminal remains interactive.
 *
 * Sibling: {@link PaneBackgroundEffects} renders gradient/glow/decoration at z-0.
 * The drop zone indicator renders at z-40, above this overlay.
 */
export function PaneOverlayEffects({ theme }: PaneOverlayEffectsProps) {
	const { scanlineMul, noiseMul } = useMemo(
		() => ({
			scanlineMul: effectMul(theme.scanlineLevel),
			noiseMul: effectMul(theme.noiseLevel),
		}),
		[theme.scanlineLevel, theme.noiseLevel],
	);

	if (scanlineMul === 0 && noiseMul === 0) return null;

	return (
		<div className="absolute inset-0 pointer-events-none z-20 overflow-hidden rounded-sm">
			{scanlineMul > 0 && (
				<div
					className="pane-scanline absolute inset-0"
					style={{ opacity: scanlineMul, contain: "layout paint style" }}
				/>
			)}
			{noiseMul > 0 && (
				<div
					className="pane-noise absolute inset-0"
					style={{ opacity: noiseMul * 0.5, contain: "layout paint style" }}
				/>
			)}
		</div>
	);
}
