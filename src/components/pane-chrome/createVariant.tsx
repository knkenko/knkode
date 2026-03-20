import { registerVariant } from ".";
import { FOCUS_VIS, FolderIcon, LeafIcon, PrBadge } from "./shared";
import type { FrameProps, PaneVariant, ScrollButtonProps, VariantTheme } from "./types";

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
		};
		branch: {
			className: string;
			style: ThemeFn;
			/** Wrap/format the branch name (e.g. s => `[${s}]`). */
			format?: (branch: string) => string;
		};
		pr: { className: string; style: ThemeFn };
		action: { className: string; style: ThemeFn };
		snippet: { label: string };
	};
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
		const actionStyle = sb.action.style(theme);
		const isBottom = theme.statusBarPosition === "bottom";

		const header = (
			<div
				{...headerProps}
				className={`${headerProps.className || ""} flex items-center shrink-0 select-none transition-colors duration-200 ${sb.className}`}
				style={{ ...headerProps.style, height: sb.height, ...sb.style(theme, isFocused) }}
			>
				{isEditing ? (
					<input
						{...editInputProps}
						className={`bg-transparent outline-none ${sb.editInput.className}`}
						style={sb.editInput.style(theme)}
					/>
				) : (
					<button
						type="button"
						onDoubleClick={onDoubleClickLabel}
						onKeyDown={(e) => { if (e.key === "Enter") onDoubleClickLabel(); }}
						className={`bg-transparent border-none p-0 cursor-default shrink-0 ${FOCUS_VIS} ${sb.label?.className ?? "font-medium"}`}
						style={sb.label?.style?.(theme, isFocused)}
					>
						{label}
					</button>
				)}

				{(sb.showSeparatorAfterLabel ?? true) && <Sep theme={theme} />}

				<span
					className={`flex-1 overflow-hidden text-ellipsis whitespace-nowrap ${sb.cwd.className}`}
					style={sb.cwd.style?.(theme)}
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
					{cwd}
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
						style={sb.pr.style(theme)}
					/>
				)}

				<Sep theme={theme} />

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
					┃
				</button>
				<button
					type="button"
					onClick={onSplitHorizontal}
					title={`Split horizontal (${shortcuts.splitH})`}
					aria-label="Split pane horizontally"
					className={actionCls}
					style={actionStyle}
				>
					━
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
						✕
					</button>
				)}
				{contextMenu}
			</div>
		);

		return (
			<>
				{!isBottom && header}
				{children}
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
