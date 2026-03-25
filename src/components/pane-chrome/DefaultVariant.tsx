import { FOCUS_VIS, FolderIcon, GitIcon, LabelButton, PrBadge, getSepClass, getSepVars } from "./shared";
import type { FrameProps, PaneVariant, ScrollButtonProps } from "./types";

// DefaultVariant intentionally uses Tailwind semantic classes (bg-elevated, text-accent, etc.)
// instead of the theme prop, so it adapts via CSS custom properties rather than inline styles.
function Frame({
	label,
	cwd,
	branch,
	pr,
	onOpenExternal,
	isFocused,
	canClose,
	onSplitVertical,
	onSplitHorizontal,
	onClose,
	onDoubleClickLabel,
	isEditing,
	editInputProps,
	SnippetTrigger,
	SessionHistoryTrigger,
	shortcuts,
	children,
	headerProps,
	contextMenu,
	theme,
	agentStatus,
}: FrameProps) {
	const isBottom = theme.statusBarPosition === "bottom";
	const sepClass = getSepClass(agentStatus, isBottom);
	const isAnimating = agentStatus !== "idle";
	const sepStyle = isAnimating
		? {
				...getSepVars(
					`linear-gradient(90deg, transparent 0%, ${theme.accent} 50%, transparent 100%)`,
					theme.accent,
				),
				borderColor: "transparent",
			}
		: {};

	const header = (
		<div
			{...headerProps}
			className={`${headerProps.className || ""} flex items-center gap-2 px-2 text-[11px] shrink-0 select-none transition-colors duration-200 ${
				isFocused ? "bg-elevated border-b border-accent" : "bg-sunken border-b border-edge"
			} ${isBottom ? "border-b-0 border-t" : ""} ${sepClass}`}
			style={{ ...headerProps.style, height: 30, ...sepStyle }}
		>
			{isEditing ? (
				<input
					{...editInputProps}
					className="bg-elevated border border-accent rounded-sm text-content text-[11px] py-px px-1 outline-none w-20"
				/>
			) : (
				<LabelButton onEdit={onDoubleClickLabel} className="text-content font-medium">
					{label}
				</LabelButton>
			)}

			<span className="text-content-muted text-[10px]">·</span>

			<span className="text-content-muted flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[10px] flex items-center gap-1">
				<FolderIcon className="opacity-50" />
				{cwd}
			</span>

			{branch && (
				<output
					aria-label={`Git branch: ${branch}`}
					className="flex items-center gap-1 text-accent text-[10px] font-medium min-w-0"
					title={branch}
				>
					<GitIcon />
					<span className="overflow-hidden text-ellipsis whitespace-nowrap">{branch}</span>
				</output>
			)}

			{pr && (
				<PrBadge
					pr={pr}
					onOpenExternal={onOpenExternal}
					className="bg-transparent text-accent text-[10px] font-medium px-0.5 leading-none hover:text-content"
				/>
			)}

			<SnippetTrigger
				className={`bg-transparent border-none text-content-muted cursor-pointer px-0.5 text-[11px] leading-none hover:text-content ${FOCUS_VIS}`}
			>
				{">_"}
			</SnippetTrigger>
			<SessionHistoryTrigger
				className={`bg-transparent border-none text-content-muted cursor-pointer px-0.5 text-lg leading-none hover:text-content ${FOCUS_VIS}`}
			>
				☰
			</SessionHistoryTrigger>

			<span className="text-content-muted text-[10px]">·</span>

			<button
				type="button"
				onClick={onSplitVertical}
				title={`Split vertical (${shortcuts.splitV})`}
				aria-label="Split pane vertically"
				className={`bg-transparent border-none text-content-muted cursor-pointer px-0.5 text-[11px] leading-none hover:text-content ${FOCUS_VIS}`}
			>
				┃
			</button>
			<button
				type="button"
				onClick={onSplitHorizontal}
				title={`Split horizontal (${shortcuts.splitH})`}
				aria-label="Split pane horizontally"
				className={`bg-transparent border-none text-content-muted cursor-pointer px-0.5 text-[11px] leading-none hover:text-content ${FOCUS_VIS}`}
			>
				━
			</button>
			{canClose && (
				<button
					type="button"
					onClick={onClose}
					title={`Close pane (${shortcuts.close})`}
					aria-label="Close pane"
					className={`bg-transparent border-none text-danger cursor-pointer px-0.5 text-[11px] leading-none hover:brightness-125 ${FOCUS_VIS}`}
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
			className={`absolute bottom-3 left-3 right-3 z-10 h-9 rounded-md flex items-center justify-center gap-1.5 text-xs cursor-pointer whitespace-nowrap overflow-hidden hover:brightness-110 ${FOCUS_VIS}`}
			style={{
				backgroundColor: `${theme.background}e6`,
				color: theme.foreground,
				border: `1px solid ${theme.foreground}22`,
				boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
			}}
		>
			↓ Scroll to bottom
		</button>
	);
}

export const DefaultVariant: PaneVariant = { Frame, ScrollButton };
