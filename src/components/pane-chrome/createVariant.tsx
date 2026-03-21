import { registerVariant } from ".";
import { FOCUS_VIS, FolderIcon, LabelButton, LeafIcon, PrBadge } from "./shared";
import type { FrameProps, PaneVariant, ScrollButtonProps, VariantTheme } from "./types";
import type { PrInfo } from "../../shared/types";

export type StyleFn = (theme: VariantTheme, isFocused: boolean) => React.CSSProperties;
export type ThemeFn = (theme: VariantTheme) => React.CSSProperties;

export interface VariantConfig {
	statusBar: {
		height: number;
		/** Base Tailwind classes for the container (gap, px, text size, font weight, etc.) */
		className: string;
		/** Inline styles for the root container. */
		style: StyleFn;
		/** Separator character between sections (e.g. '·', '|', '—'). Omit for no separators. */
		separator?: string;
		/** Opacity class for separators (e.g. 'opacity-30', 'opacity-40'). */
		separatorOpacity?: string;
		/** Inline styles for separator spans. */
		separatorStyle?: ThemeFn;
		/** Show separator after label (before CWD). Default true. Set false to only show before actions. */
		showSeparatorAfterLabel?: boolean;
		/** Gradient border-image styles merged into the status bar (e.g. multi-color gradient borders). */
		borderImage?: StyleFn;
		editInput: { className: string; style: ThemeFn };
		label?: { className?: string; style?: StyleFn };
		cwd: {
			className: string;
			/** Text prefix before path (e.g. '~ '). Mutually exclusive with icon. */
			prefix?: string;
			/** Icon before path. 'folder' renders FolderIcon, 'leaf' renders LeafIcon; any other string renders as text. */
			icon?: string | "folder" | "leaf";
			/** Class for the icon element (e.g. 'opacity-60'). */
			iconClassName?: string;
			/** Inline style wrapper around the icon. */
			iconStyle?: ThemeFn;
			style?: ThemeFn;
			/** Transform the displayed CWD text (e.g. `s => s.toUpperCase()`). */
			transform?: (s: string) => string;
			/** CSS mask-image value for fade effects (e.g. `"linear-gradient(90deg, black 80%, transparent)"`). */
			maskImage?: string;
			/** Gradient text via WebkitBackgroundClip. Returns background + clip styles. */
			gradientText?: StyleFn;
		};
		branch: {
			className: string;
			style: ThemeFn;
			/** Wrap/format the branch name (e.g. s => `[${s}]`). */
			format?: (branch: string) => string;
		};
		pr: {
			className: string;
			style: StyleFn;
			/** Custom PR content (e.g. `[PR#123]`). Omit for default `#N`. */
			format?: (pr: PrInfo) => React.ReactNode;
		};
		action: {
			className: string;
			style: StyleFn;
			/** Custom action button labels. Defaults: splitV ┃, splitH ━, close ✕ */
			labels?: { splitV?: string; splitH?: string; close?: string };
		};
		snippet: { label: string };
		/** Wrap action buttons in a hover-reveal container (e.g. opacity-0 → visible on hover). */
		hoverRevealActions?: { className: string };
	};
	/** Optional wrapper around terminal content for padding/spacing. */
	content?: { className?: string };
	scrollButton: {
		className: string;
		style: ThemeFn;
		text: string;
	};
}

/** Create and register a pane-chrome variant from a style configuration.
 *  Covers single-row Frame layouts — use a custom implementation
 *  for variants that need entirely custom DOM structure. */
export function createAndRegisterVariant(name: string, config: VariantConfig): PaneVariant {
	const { statusBar: sb, scrollButton: scr } = config;
	const hasSep = sb.separator != null;
	const sepClass = sb.separatorOpacity ?? "opacity-30";

	/** Stable separator component — defined once per variant, not per render. */
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
		const actionCls = `bg-transparent border-none cursor-pointer leading-none transition-opacity ${FOCUS_VIS} ${sb.action.className}`;
		const actionStyle = sb.action.style(theme, isFocused);
		const isBottom = theme.statusBarPosition === "bottom";
		const displayCwd = sb.cwd.transform ? sb.cwd.transform(cwd) : cwd;
		const cwdStyle: React.CSSProperties = {
			...sb.cwd.style?.(theme),
			...(sb.cwd.maskImage
				? { maskImage: sb.cwd.maskImage, WebkitMaskImage: sb.cwd.maskImage }
				: {}),
			...sb.cwd.gradientText?.(theme, isFocused),
		};

		const actions = (
			<>
				<SnippetTrigger className={actionCls} style={actionStyle}>
					{sb.snippet.label}
				</SnippetTrigger>
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

		const header = (
			<div
				{...headerProps}
				className={`${headerProps.className || ""} flex items-center shrink-0 select-none transition-colors duration-200 ${sb.className}`}
				style={{
					...headerProps.style,
					height: sb.height,
					...sb.style(theme, isFocused),
					...sb.borderImage?.(theme, isFocused),
				}}
			>
				{isEditing ? (
					<input
						{...editInputProps}
						className={`bg-transparent outline-none ${sb.editInput.className}`}
						style={sb.editInput.style(theme)}
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
						<>{sb.cwd.prefix}</>
					) : null}
					{displayCwd}
				</span>

				{branch && (
					<output
						aria-label={`Git branch: ${branch}`}
						className={`min-w-0 overflow-hidden text-ellipsis whitespace-nowrap ${sb.branch.className}`}
						title={branch}
						style={sb.branch.style(theme)}
					>
						{sb.branch.format ? sb.branch.format(branch) : branch}
					</output>
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
				{config.content ? (
					<div className={config.content.className}>{children}</div>
				) : (
					children
				)}
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
