import type { PrInfo } from "../../shared/types";
import { registerVariant } from ".";
import { type SeparatorAnimation, FOCUS_VIS, FolderIcon, LabelButton, LeafIcon, PrBadge, getSepClass, getSepVars } from "./shared";
import type { FrameProps, PaneVariant, ScrollButtonProps, VariantTheme } from "./types";

export type StyleFn = (theme: VariantTheme, isFocused: boolean) => React.CSSProperties;
export type ThemeFn = (theme: VariantTheme) => React.CSSProperties;

export interface VariantConfig {
	statusBar: {
		height: number;
		/** Tailwind classes for the status bar container. */
		className: string;
		/** Inline styles for the status bar container. */
		style: StyleFn;
		/** Separator character between sections (e.g. '·', '|', '—'). Omit for no separators. */
		separator?: string;
		/** Tailwind classes applied to separator spans (e.g. 'opacity-30', 'mx-2 opacity-40'). */
		separatorClassName?: string;
		/** Inline styles for separator spans. */
		separatorStyle?: ThemeFn;
		/** Show separator after label (before CWD). Default true. Set false to only show before actions. */
		showSeparatorAfterLabel?: boolean;
		/** Show separator before branch name (after CWD). Default false. */
		showSeparatorBeforeBranch?: boolean;
		/** Gradient border-image styles spread onto the status bar container. */
		borderImage?: StyleFn;
		editInput: { className: string; style: StyleFn };
		label?: { className?: string; style?: StyleFn };
		cwd: {
			className: string;
			/** Text prefix before path (e.g. '~ '). Takes priority over icon when both are set. */
			prefix?: string;
			/** Icon before path. 'folder' renders FolderIcon, 'leaf' renders LeafIcon; any other string renders as text. */
			icon?: "folder" | "leaf" | (string & {});
			/** Class for the icon element (e.g. 'opacity-60'). */
			iconClassName?: string;
			/** Inline style wrapper around the icon. */
			iconStyle?: ThemeFn;
			style?: ThemeFn;
			/** Transform the displayed CWD text (e.g. `s => s.toUpperCase()`). */
			transform?: (s: string) => string;
			/** CSS mask-image value for fade effects (e.g. `"linear-gradient(90deg, black 80%, transparent)"`). */
			maskImage?: string;
			/** Gradient text effect via WebkitBackgroundClip. Should return background, backgroundClip, and WebkitBackgroundClip styles. */
			gradientText?: StyleFn;
		};
		branch: {
			className: string;
			style?: ThemeFn;
			/** Wrap/format the branch name (e.g. s => `[${s}]`). */
			format?: (branch: string) => string;
		};
		pr: {
			className: string;
			style: StyleFn;
			/** Custom PR content rendered inside PrBadge. Omit to show default "#N" text. */
			format?: (pr: PrInfo) => React.ReactNode;
		};
		action: {
			className: string;
			style: StyleFn;
			/** Custom action button labels. Defaults: splitV ┃, splitH ━, close ✕ */
			labels?: Partial<Record<"splitV" | "splitH" | "close", string>>;
		};
		snippet: { label: string };
		/** Wrap action buttons (excluding snippet trigger) in a hover-reveal container. */
		hoverRevealActions?: { className: string };
	};
	/** Activity animation on the status bar border when agent is active.
	 *  `gradient` is the CSS gradient/color to sweep across the border.
	 *  `animation` selects the keyframe style (default: "scan").
	 *  When omitted, falls back to a single-color scan using accent. */
	activity?: {
		gradient: (theme: VariantTheme) => string;
		animation?: SeparatorAnimation;
		/** Duration in seconds (default: 3). */
		duration?: number;
	};
	/** Wrapper div around children (terminal content) for padding/spacing. */
	content?: { className: string };
	scrollButton: {
		className: string;
		style: ThemeFn;
		text: string;
	};
}

/** Create and register a pane-chrome variant from a style configuration.
 *  Covers single-row Frame layouts — use a custom implementation
 *  for variants that need entirely custom DOM structure.
 *  Returns the created PaneVariant. */
export function createAndRegisterVariant(name: string, config: VariantConfig): PaneVariant {
	const { statusBar: sb, scrollButton: scr } = config;
	const hasSep = sb.separator != null;
	const sepClass = sb.separatorClassName ?? "opacity-30";
	const actionCls = `bg-transparent border-none cursor-pointer leading-none transition-opacity ${FOCUS_VIS} ${sb.action.className}`;

	/** Shared separator — defined once per variant, not per render. */
	function Sep({ theme }: { theme: VariantTheme }) {
		if (!hasSep) return null;
		return (
			<span className={sepClass} style={sb.separatorStyle?.(theme)}>
				{sb.separator}
			</span>
		);
	}

	function Frame({
		label,
		cwd,
		branch,
		pr,
		onOpenExternal,
		isFocused,
		canClose,
		theme,
		agentStatus,
		onSplitVertical,
		onSplitHorizontal,
		onClose,
		onDoubleClickLabel,
		isEditing,
		editInputProps,
		SnippetTrigger,
		shortcuts,
		children,
		headerProps,
		contextMenu,
	}: FrameProps) {
		const actionStyle = sb.action.style(theme, isFocused);
		const isBottom = theme.statusBarPosition === "bottom";
		const displayCwd = sb.cwd.transform ? sb.cwd.transform(cwd) : cwd;
		const cwdStyle: React.CSSProperties =
			sb.cwd.maskImage || sb.cwd.gradientText
				? {
						...sb.cwd.style?.(theme),
						...(sb.cwd.maskImage
							? { maskImage: sb.cwd.maskImage, WebkitMaskImage: sb.cwd.maskImage }
							: {}),
						...sb.cwd.gradientText?.(theme, isFocused),
					}
				: (sb.cwd.style?.(theme) ?? {});

		const actions = (
			<>
				<button
					type="button"
					onClick={onSplitVertical}
					title={`Split vertical (${shortcuts.splitV})`}
					aria-label="Split pane vertically"
					className={actionCls}
					style={actionStyle}
				>
					{sb.action.labels?.splitV ?? "┃"}
				</button>
				<button
					type="button"
					onClick={onSplitHorizontal}
					title={`Split horizontal (${shortcuts.splitH})`}
					aria-label="Split pane horizontally"
					className={actionCls}
					style={actionStyle}
				>
					{sb.action.labels?.splitH ?? "━"}
				</button>
				{canClose && (
					<button
						type="button"
						onClick={onClose}
						title={`Close pane (${shortcuts.close})`}
						aria-label="Close pane"
						className={actionCls}
						style={actionStyle}
					>
						{sb.action.labels?.close ?? "✕"}
					</button>
				)}
			</>
		);

		// Build activity CSS class + custom properties for the header's border animation.
		// When active/attention, the ::after pseudo-element replaces the original border,
		// so we clear border styles to avoid doubling.
		const sepClass = getSepClass(agentStatus, isBottom);
		const isAnimating = agentStatus !== "idle";
		const sepStyle = isAnimating
			? getSepVars(
					config.activity?.gradient(theme) ??
						`linear-gradient(90deg, transparent 0%, ${theme.glow ?? theme.accent} 50%, transparent 100%)`,
					theme.glow ?? theme.accent,
					config.activity?.animation ?? "scan",
					config.activity?.duration ?? 3,
				)
			: {};
		// Border is always transparent — the wrapper/pseudo-element handles visible borders.
		// When animating, also clear borderImage so the ::after gradient isn't doubled.
		const borderClear: React.CSSProperties = isAnimating
			? { borderImage: "none", borderColor: "transparent" }
			: { borderColor: "transparent" };

		const header = (
			<div
				{...headerProps}
				className={`${headerProps.className || ""} flex items-center shrink-0 select-none transition-colors duration-200 ${sb.className} ${sepClass}`}
				style={{
					...headerProps.style,
					height: sb.height,
					...sb.style(theme, isFocused),
					...sb.borderImage?.(theme, isFocused),
					...sepStyle,
					...borderClear,
				}}
			>
				{isEditing ? (
					<input
						{...editInputProps}
						className={`bg-transparent outline-none ${sb.editInput.className}`}
						style={sb.editInput.style(theme, isFocused)}
					/>
				) : (
					<LabelButton
						onEdit={onDoubleClickLabel}
						className={sb.label?.className ?? "font-medium"}
						style={sb.label?.style?.(theme, isFocused)}
					>
						{label}
					</LabelButton>
				)}

				{(sb.showSeparatorAfterLabel ?? true) && <Sep theme={theme} />}

				<span
					className={`flex-1 overflow-hidden text-ellipsis whitespace-nowrap ${sb.cwd.className}`}
					style={cwdStyle}
				>
					{sb.cwd.icon === "folder" || sb.cwd.icon === "leaf" ? (
						<span className="inline-flex items-center mr-1" style={sb.cwd.iconStyle?.(theme)}>
							{sb.cwd.icon === "folder" ? (
								<FolderIcon className={sb.cwd.iconClassName} />
							) : (
								<LeafIcon className={sb.cwd.iconClassName} />
							)}
						</span>
					) : sb.cwd.icon ? (
						<>
							<span style={sb.cwd.iconStyle?.(theme)}>{sb.cwd.icon}</span>{" "}
						</>
					) : sb.cwd.prefix ? (
						sb.cwd.prefix
					) : null}
					{displayCwd}
				</span>

				{branch && (
					<>
						{sb.showSeparatorBeforeBranch && <Sep theme={theme} />}
						<output
							aria-label={`Git branch: ${branch}`}
							className={`min-w-0 overflow-hidden text-ellipsis whitespace-nowrap ${sb.branch.className}`}
							title={branch}
							style={sb.branch.style?.(theme)}
						>
							{sb.branch.format ? sb.branch.format(branch) : branch}
						</output>
					</>
				)}

				{pr && (
					<PrBadge
						pr={pr}
						onOpenExternal={onOpenExternal}
						className={`transition-all ${sb.pr.className}`}
						style={sb.pr.style(theme, isFocused)}
					>
						{sb.pr.format?.(pr)}
					</PrBadge>
				)}

				<Sep theme={theme} />

				<SnippetTrigger className={actionCls} style={actionStyle}>
					{sb.snippet.label}
				</SnippetTrigger>
				{sb.hoverRevealActions ? (
					<div className={sb.hoverRevealActions.className}>{actions}</div>
				) : (
					actions
				)}
				{contextMenu}
			</div>
		);

		return (
			<>
				{!isBottom && header}
				{config.content ? <div className={`flex-1 min-h-0 ${config.content.className}`}>{children}</div> : children}
				{isBottom && header}
			</>
		);
	}

	function ScrollButton({ onClick, theme }: ScrollButtonProps) {
		return (
			<button
				type="button"
				onClick={onClick}
				aria-label="Scroll to bottom"
				className={`absolute z-10 flex items-center justify-center cursor-pointer ${FOCUS_VIS} ${scr.className}`}
				style={scr.style(theme)}
			>
				{scr.text}
			</button>
		);
	}

	const variant: PaneVariant = { Frame, ScrollButton };
	registerVariant(name, variant);
	return variant;
}
