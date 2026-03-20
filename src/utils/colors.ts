import type React from "react";
import { buildFontFamily } from "../data/theme-presets";
import type { SidebarTheme } from "../shared/types";

const HEX_RE = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Test whether a string is a valid hex color (#RGB, #RRGGBB, or bare RGB/RRGGBB). */
export function isValidHex(hex: string): boolean {
	return HEX_RE.test(hex);
}

/** Allowlist-based CSS gradient validator.
 *  Permits linear-gradient, radial-gradient, conic-gradient (and repeating- variants)
 *  with hex/rgb/hsl/named color values and numeric stops. Rejects anything else. */
const GRADIENT_RE = /^(repeating-)?(linear|radial|conic)-gradient\([\s,\w#().%\d/-]+\)$/i;
export function isValidGradient(value: string): boolean {
	return GRADIENT_RE.test(value);
}

/** Allowlist for CSS transition-timing-function values. */
const TIMING_FN_RE = /^(ease|linear|ease-in|ease-out|ease-in-out|cubic-bezier\([\d.,\s]+\))$/i;
function isValidTimingFn(value: string): boolean {
	return TIMING_FN_RE.test(value);
}

/** Allowlist for CSS box-shadow values — digits, units, hex/rgba colors, commas, spaces. */
const BOX_SHADOW_RE = /^[\w\s,().#/%+-]+$/;
function isValidBoxShadow(value: string): boolean {
	return value === "none" || BOX_SHADOW_RE.test(value);
}

/** Default accent color for dark themes. */
export const DEFAULT_ACCENT_DARK = "#6c63ff";
/** Default accent color for light themes. */
export const DEFAULT_ACCENT_LIGHT = "#4d46e5";
/** Standard danger/error color. */
export const COLOR_DANGER = "#e74c3c";

/** Parse a hex color string (#RGB or #RRGGBB) into an RGB tuple. Returns [0,0,0] on malformed input. */
export function hexToRgb(hex: string): [number, number, number] {
	const match = hex.match(HEX_RE);
	if (!match) {
		console.warn("[theme] malformed hex color:", hex);
		return [0, 0, 0];
	}
	// match[1] is always defined when the regex matches (single capture group)
	const c = match[1]!;
	if (c.length === 3) {
		return [
			Number.parseInt(c[0]! + c[0]!, 16),
			Number.parseInt(c[1]! + c[1]!, 16),
			Number.parseInt(c[2]! + c[2]!, 16),
		];
	}
	return [
		Number.parseInt(c.slice(0, 2), 16),
		Number.parseInt(c.slice(2, 4), 16),
		Number.parseInt(c.slice(4, 6), 16),
	];
}

/** Convert RGB values to a hex string. Clamps each channel to [0, 255]. */
export function rgbToHex(r: number, g: number, b: number): string {
	return `#${[r, g, b]
		.map((x) =>
			Math.round(Math.max(0, Math.min(255, x)))
				.toString(16)
				.padStart(2, "0"),
		)
		.join("")}`;
}

type RGB = [number, number, number];

/** Linearly interpolate between two RGB tuples. Avoids re-parsing when called in a loop. */
function mixRgb(c1: RGB, c2: RGB, weight: number): string {
	const w = Math.max(0, Math.min(1, weight));
	return rgbToHex(
		c1[0] * w + c2[0] * (1 - w),
		c1[1] * w + c2[1] * (1 - w),
		c1[2] * w + c2[2] * (1 - w),
	);
}

/** Linearly interpolate between two hex colors. Weight 1 = 100% color1, 0 = 100% color2. Clamps weight to [0, 1]. */
export function mixColors(color1: string, color2: string, weight: number): string {
	return mixRgb(hexToRgb(color1), hexToRgb(color2), weight);
}

/** Convert a hex color (#RGB or #RRGGBB) to an rgba() CSS string.
 *  Delegates to hexToRgb for parsing — malformed input produces rgba(0, 0, 0, opacity).
 *  Opacity is clamped to [0, 1]; non-finite values default to 1. */
export function hexToRgba(hex: string, opacity: number): string {
	const [r, g, b] = hexToRgb(hex);
	const a = Number.isFinite(opacity) ? Math.max(0, Math.min(1, opacity)) : 1;
	return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Return an rgba background when translucent, or the raw hex when opaque.
 *  Centralizes the `opacity < 1` threshold so it's defined in one place. */
export function resolveBackground(hex: string, opacity: number): string {
	return opacity < 1 ? hexToRgba(hex, opacity) : hex;
}

/** Returns true if the color has low perceived luminance (< 0.5).
 *  Invalid input → hexToRgb returns [0,0,0] → luminance 0 → true (dark). */
export function isDark(hex: string): boolean {
	const [r, g, b] = hexToRgb(hex);
	const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
	return luminance < 0.5;
}

/** The exact set of CSS custom properties produced by generateThemeVariables.
 *  Intersected with React.CSSProperties so the result can be spread into a `style` prop. */
export type ThemeVariables = {
	"--color-canvas": string;
	"--color-elevated": string;
	"--color-sunken": string;
	"--color-overlay": string;
	"--color-overlay-hover": string;
	"--color-overlay-active": string;
	"--color-content": string;
	"--color-content-secondary": string;
	"--color-content-muted": string;
	"--color-edge": string;
	"--color-accent": string;
	"--color-danger": string;
	"--theme-glow": string;
	"--font-family-ui": string;
	"--font-size-ui": string;
	"--sidebar-bg": string;
	"--sidebar-glass": string;
	"--sidebar-border": string;
	"--sidebar-shadow": string;
	"--sidebar-item-hover": string;
	"--sidebar-item-active": string;
	"--sidebar-item-radius": string;
	"--sidebar-spacing": string;
	"--sidebar-transition": string;
	"--sidebar-accent-glow": string;
	"--sidebar-text-transform": string;
	"--sidebar-letter-spacing": string;
	"--sidebar-header-weight": string;
	"--sidebar-separator": string;
	"--sidebar-card-bg": string;
	"--sidebar-card-border": string;
	"--sidebar-card-radius": string;
} & React.CSSProperties;

/** Sidebar spacing density multiplier — hoisted to avoid per-call allocation. */
const SPACING_MAP = { compact: "0.75", default: "1", spacious: "1.25" } as const;

const MIN_UI_FONT_SIZE = 11;
const MAX_UI_FONT_SIZE = 15;
const DEFAULT_UI_FONT_SIZE = 13;

export interface ThemeVarOptions {
	bg?: string | undefined;
	fg?: string | undefined;
	fontFamily?: string | undefined;
	fontSize?: number | undefined;
	accent?: string | undefined;
	glow?: string | undefined;
	sidebar?: SidebarTheme | undefined;
}

/**
 * Derive a full set of CSS custom properties from theme colors and typography.
 * Auto-detects dark vs light mode from the background luminance.
 * Accepts per-theme accent and glow colors — falls back to defaults when omitted.
 * Returns an object suitable for React inline `style` — keys are CSS variable names.
 */
export function generateThemeVariables(opts: ThemeVarOptions): ThemeVariables {
	const { bg, fg, fontFamily, fontSize, accent: accentOverride, glow, sidebar } = opts;

	// Safe fallbacks for missing or malformed colors to prevent app crashes
	const safeBg = bg && isValidHex(bg) ? bg : "#1a1a2e";
	const safeFg = fg && isValidHex(fg) ? fg : "#e0e0e0";

	const dark = isDark(safeBg);

	// Pre-parse to RGB tuples to avoid redundant hex parsing in mixRgb calls
	const bgRgb = hexToRgb(safeBg);
	const fgRgb = hexToRgb(safeFg);

	// Surfaces shift toward white (dark mode) or black (light mode) for depth
	const depthRgb: RGB = dark ? [255, 255, 255] : [0, 0, 0];
	const recessRgb: RGB = dark ? [0, 0, 0] : [232, 232, 232];

	// Surface levels by elevation: sunken < canvas < elevated < overlay
	const elevated = mixRgb(bgRgb, depthRgb, 0.95);
	const sunken = mixRgb(bgRgb, recessRgb, 0.92);
	const overlay = mixRgb(bgRgb, depthRgb, 0.9);
	const overlayHover = mixRgb(bgRgb, depthRgb, 0.85);
	const overlayActive = mixRgb(bgRgb, depthRgb, 0.8);

	// Content — three tiers of text prominence
	const contentSecondary = mixRgb(fgRgb, bgRgb, 0.8);
	const contentMuted = mixRgb(fgRgb, bgRgb, 0.55);

	// Border: 85% background + 15% foreground tint
	const edge = mixRgb(bgRgb, fgRgb, 0.85);

	// Per-theme accent or sensible default
	const accent =
		accentOverride && isValidHex(accentOverride)
			? accentOverride
			: dark
				? DEFAULT_ACCENT_DARK
				: DEFAULT_ACCENT_LIGHT;

	// Glow: box-shadow effect for themed components.
	const glowValue = glow && isValidHex(glow) ? `0 0 12px ${hexToRgba(glow, 0.4)}` : "none";

	// Typography: 1px smaller than terminal font size, clamped to 11-15px range
	const uiFontSize =
		typeof fontSize === "number" && Number.isFinite(fontSize) && fontSize > 0
			? Math.max(MIN_UI_FONT_SIZE, Math.min(MAX_UI_FONT_SIZE, fontSize - 1))
			: DEFAULT_UI_FONT_SIZE;

	// Sidebar — derive from sidebar config or auto-generate from theme colors
	const sidebarGlass = Math.max(0, Math.min(20, sidebar?.glass ?? 0));
	const sidebarBgHex =
		sidebar?.background && isValidHex(sidebar.background) ? sidebar.background : sunken;
	// When glass blur is active, make sidebar semi-transparent so blur is visible
	const sidebarBg = sidebarGlass > 0 ? hexToRgba(sidebarBgHex, 0.75) : sidebarBgHex;
	const sidebarBorderColor =
		sidebar?.borderColor && isValidHex(sidebar.borderColor) ? sidebar.borderColor : edge;
	const sidebarBorderStyle = sidebar?.borderStyle ?? "solid";
	const sidebarBorder =
		sidebarBorderStyle === "none"
			? "none"
			: sidebarBorderStyle === "gradient"
				? `1px solid ${accent}`
				: `1px solid ${sidebarBorderColor}`;
	const sidebarShadow =
		sidebar?.shadow && isValidBoxShadow(sidebar.shadow)
			? sidebar.shadow
			: sidebarBorderStyle === "glow" && isValidHex(sidebarBorderColor)
				? `1px 0 8px ${hexToRgba(sidebarBorderColor, 0.3)}`
				: "none";
	const sidebarItemHover =
		sidebar?.itemHover && isValidHex(sidebar.itemHover) ? sidebar.itemHover : overlay;
	const sidebarItemActive =
		sidebar?.itemActive && isValidHex(sidebar.itemActive) ? sidebar.itemActive : overlayActive;
	const sidebarItemRadius = Math.max(0, Math.min(8, sidebar?.itemRadius ?? 2));
	const sidebarSpacing = SPACING_MAP[sidebar?.spacing ?? "default"];
	const sidebarTransition =
		sidebar?.transition && isValidTimingFn(sidebar.transition) ? sidebar.transition : "ease";
	const sidebarAccentGlow =
		sidebar?.accentGlow && isValidHex(accent) ? `0 0 6px ${hexToRgba(accent, 0.4)}` : "none";

	// Section card styling
	const sidebarTextTransform = sidebar?.textTransform ?? "none";
	const sidebarLetterSpacing = `${Math.max(0, Math.min(0.3, sidebar?.letterSpacing ?? 0))}em`;
	const sidebarHeaderWeight =
		sidebar?.headerWeight === "bold" ? "700" : sidebar?.headerWeight === "normal" ? "400" : "500";
	const sepColor =
		sidebar?.separatorColor && isValidHex(sidebar.separatorColor)
			? sidebar.separatorColor
			: edge;
	const sepStyle = sidebar?.separatorStyle ?? "solid";
	const sidebarSeparator =
		sepStyle === "none"
			? "none"
			: sepStyle === "dashed"
				? `1px dashed ${sepColor}`
				: sepStyle === "gradient"
					? `1px solid ${accent}`
					: sepStyle === "glow"
						? `1px solid ${hexToRgba(sepColor, 0.5)}`
						: `1px solid ${sepColor}`;
	const sidebarCardBg =
		sidebar?.cardBg && isValidHex(sidebar.cardBg) ? sidebar.cardBg : "transparent";
	const sidebarCardBorder =
		sidebar?.cardBorder && isValidHex(sidebar.cardBorder)
			? `1px solid ${sidebar.cardBorder}`
			: "none";
	const sidebarCardRadius = `${Math.max(0, Math.min(12, sidebar?.cardRadius ?? 0))}px`;

	return {
		"--color-canvas": safeBg,
		"--color-elevated": elevated,
		"--color-sunken": sunken,
		"--color-overlay": overlay,
		"--color-overlay-hover": overlayHover,
		"--color-overlay-active": overlayActive,
		"--color-content": safeFg,
		"--color-content-secondary": contentSecondary,
		"--color-content-muted": contentMuted,
		"--color-edge": edge,
		"--color-accent": accent,
		"--color-danger": COLOR_DANGER,
		"--theme-glow": glowValue,
		"--font-family-ui": buildFontFamily(fontFamily),
		"--font-size-ui": `${uiFontSize}px`,
		"--sidebar-bg": sidebarBg,
		"--sidebar-glass": `${sidebarGlass}px`,
		"--sidebar-border": sidebarBorder,
		"--sidebar-shadow": sidebarShadow,
		"--sidebar-item-hover": sidebarItemHover,
		"--sidebar-item-active": sidebarItemActive,
		"--sidebar-item-radius": `${sidebarItemRadius}px`,
		"--sidebar-spacing": sidebarSpacing,
		"--sidebar-transition": sidebarTransition,
		"--sidebar-accent-glow": sidebarAccentGlow,
		"--sidebar-text-transform": sidebarTextTransform,
		"--sidebar-letter-spacing": sidebarLetterSpacing,
		"--sidebar-header-weight": sidebarHeaderWeight,
		"--sidebar-separator": sidebarSeparator,
		"--sidebar-card-bg": sidebarCardBg,
		"--sidebar-card-border": sidebarCardBorder,
		"--sidebar-card-radius": sidebarCardRadius,
	};
}
