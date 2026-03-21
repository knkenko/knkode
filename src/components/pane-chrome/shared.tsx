/** Shared constants and utilities for pane-chrome variant components. */

import type { AgentStatus, PrInfo } from "../../shared/types";
import { DEFAULT_ACCENT_DARK, isValidHex } from "../../utils/colors";
import type { VariantTheme } from "./types";

/** Build a VariantTheme from workspace/preset colors with validated fallback accent.
 *  Validates hex colors to prevent CSS injection via inline styles. */
export function buildVariantTheme(
	colors: {
		background: string;
		foreground: string;
		accent?: string | undefined;
		glow?: string | undefined;
		presetAccent?: string | undefined;
		presetGlow?: string | undefined;
	},
	statusBarPosition?: "top" | "bottom" | undefined,
): VariantTheme {
	const rawAccent = colors.accent ?? colors.presetAccent;
	const rawGlow = colors.glow ?? colors.presetGlow;
	return {
		background: colors.background,
		foreground: colors.foreground,
		accent: rawAccent && isValidHex(rawAccent) ? rawAccent : DEFAULT_ACCENT_DARK,
		glow: rawGlow && isValidHex(rawGlow) ? rawGlow : undefined,
		statusBarPosition: statusBarPosition ?? "top",
	};
}

/** Resolve the glow color for a variant theme, falling back to accent. */
export function resolveGlow(theme: VariantTheme): string {
	return theme.glow ?? theme.accent;
}

/** Focus-visible ring applied to interactive elements in all variants. */
export const FOCUS_VIS =
	"focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none";

/** Folder icon SVG used in several variant status bars. Pass className for opacity. */
export function FolderIcon({ className }: { className?: string | undefined }) {
	return (
		<svg
			viewBox="0 0 16 16"
			fill="currentColor"
			aria-hidden="true"
			className={`w-3 h-3 shrink-0 ${className ?? ""}`}
		>
			<path d="M1.75 1A1.75 1.75 0 0 0 0 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0 0 16 13.25v-8.5A1.75 1.75 0 0 0 14.25 3H7.5a.25.25 0 0 1-.2-.1l-.9-1.2c-.33-.44-.85-.7-1.4-.7Z" />
		</svg>
	);
}

/** Leaf icon SVG used for Everforest cwd. */
export function LeafIcon({ className }: { className?: string | undefined }) {
	return (
		<svg
			viewBox="0 0 16 16"
			fill="currentColor"
			aria-hidden="true"
			className={`w-3 h-3 shrink-0 ${className ?? ""}`}
		>
			<path d="M6.5 1.75a.75.75 0 0 1 1.5 0v1.5a5.25 5.25 0 0 1-4.778 5.231A3.5 3.5 0 0 0 7 12.5h1.25a.75.75 0 0 1 0 1.5H7a5 5 0 0 1-4.975-4.525A6.75 6.75 0 0 1 6.5 3.25ZM14.25 2a.75.75 0 0 0-.75.75v.5A5.25 5.25 0 0 1 8.25 8.5H7.5a.75.75 0 0 0 0 1.5h.75a6.75 6.75 0 0 0 6.75-6.75v-.5a.75.75 0 0 0-.75-.75Z" />
		</svg>
	);
}

/** Git branch icon SVG. */
export function GitIcon({ className }: { className?: string | undefined }) {
	return (
		<svg
			viewBox="0 0 16 16"
			fill="currentColor"
			aria-hidden="true"
			className={`w-2.5 h-2.5 shrink-0 ${className ?? ""}`}
		>
			<path d="M9.5 3.25a2.25 2.25 0 1 1 3 2.122V6A2.5 2.5 0 0 1 10 8.5H6a1 1 0 0 0-1 1v1.128a2.251 2.251 0 1 1-1.5 0V5.372a2.25 2.25 0 1 1 1.5 0v1.836A2.5 2.5 0 0 1 6 7h4a1 1 0 0 0 1-1v-.628A2.25 2.25 0 0 1 9.5 3.25Z" />
		</svg>
	);
}

/** Pane label button with double-click rename and Enter key a11y. */
export function LabelButton({
	onEdit,
	className,
	style,
	children,
}: {
	onEdit: () => void;
	className?: string | undefined;
	style?: React.CSSProperties | undefined;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			onDoubleClick={onEdit}
			onKeyDown={(e) => {
				if (e.key === "Enter") onEdit();
			}}
			title="Double-click to rename"
			className={`bg-transparent border-none p-0 cursor-default shrink-0 ${FOCUS_VIS} ${className ?? ""}`}
			style={style}
		>
			{children}
		</button>
	);
}

/** Activity separator animation style.
 *  - scan: single bright band sweeping L→R (default, most themes)
 *  - dual-scan: two bands sweeping in opposite directions (Cyberpunk, Vaporwave)
 *  - wave: gentle opacity pulse (Nord, Catppuccin, Everforest)
 *  - ember: warm glow brighten/fade (Amber, Sunset, Gruvbox)
 *  - shimmer: fast sparkle sweep (Matrix, Solana) */
export type SeparatorAnimation = "scan" | "dual-scan" | "wave" | "ember" | "shimmer";

/** Separator between status bar and terminal content.
 *  Always renders at fixed height to prevent layout shift.
 *  Idle: subtle theme-colored line. Active: themed scanning animation.
 *  Attention: static glowing bar. */
export function ActivitySeparator({
	status,
	color,
	animation = "scan",
}: {
	status: AgentStatus;
	color: string;
	animation?: SeparatorAnimation;
}) {
	const style: React.CSSProperties = { height: 3 };

	if (status === "idle") {
		// Subtle static line — always present, no layout shift
		style.background = color;
		style.opacity = 0.15;
	} else if (status === "attention") {
		// Attention — static colored bar with glow
		style.background = color;
		style.opacity = 0.7;
		style.boxShadow = `0 0 6px ${color}88`;
	} else {
		// Active — themed animation
		Object.assign(style, getAnimationStyles(animation, color));
	}

	return (
		<div
			role="status"
			aria-label={
				status === "active"
					? "Agent is active"
					: status === "attention"
						? "Agent needs attention"
						: undefined
			}
			className="w-full shrink-0 motion-reduce:animate-none"
			style={style}
		/>
	);
}

/** Build CSS styles for each animation type. */
function getAnimationStyles(animation: SeparatorAnimation, color: string): React.CSSProperties {
	switch (animation) {
		case "scan":
			return {
				background: `linear-gradient(90deg, transparent 0%, ${color} 50%, transparent 100%)`,
				backgroundSize: "200% 100%",
				animation: "activity-scan 3s linear infinite",
				opacity: 0.9,
				boxShadow: `0 0 4px ${color}66`,
			};
		case "dual-scan":
			return {
				background: `linear-gradient(90deg, transparent 0%, ${color} 30%, transparent 50%, ${color}88 70%, transparent 100%)`,
				backgroundSize: "200% 100%",
				animation: "activity-dual-scan 3.5s linear infinite",
				opacity: 0.9,
				boxShadow: `0 0 6px ${color}66`,
			};
		case "wave":
			return {
				background: `linear-gradient(90deg, ${color}66, ${color}, ${color}66)`,
				animation: "activity-wave 3s ease-in-out infinite",
				boxShadow: `0 0 4px ${color}44`,
			};
		case "ember":
			return {
				background: `linear-gradient(90deg, ${color}88, ${color}, ${color}88)`,
				animation: "activity-ember 3s ease-in-out infinite",
				boxShadow: `0 0 6px ${color}44`,
			};
		case "shimmer":
			return {
				background: `linear-gradient(90deg, ${color}44 0%, ${color} 20%, ${color}ff 25%, ${color}44 45%, ${color} 70%, ${color}44 100%)`,
				backgroundSize: "200% 100%",
				animation: "activity-shimmer 2.5s linear infinite",
				opacity: 0.9,
				boxShadow: `0 0 6px ${color}88`,
			};
	}
}

/** Clickable PR badge — shared structure, per-variant styling via className/style/children. */
export function PrBadge({
	pr,
	onOpenExternal,
	className,
	style,
	children,
}: {
	pr: PrInfo;
	onOpenExternal: (url: string) => void;
	className?: string | undefined;
	style?: React.CSSProperties | undefined;
	children?: React.ReactNode | undefined;
}) {
	return (
		<button
			type="button"
			onClick={() => onOpenExternal(pr.url)}
			title={pr.title}
			aria-label={`Open PR #${pr.number}`}
			className={`cursor-pointer ${FOCUS_VIS} ${className ?? ""}`}
			style={style}
		>
			{children ?? `#${pr.number}`}
		</button>
	);
}
