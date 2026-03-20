import { registerVariant } from ".";
import { FOCUS_VIS, PrBadge } from "./shared";
import type { FrameProps, PaneVariant, ScrollButtonProps } from "./types";

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
	const isBottom = theme.statusBarPosition === "bottom";

	const header = (
		<div
			{...headerProps}
			className={`${headerProps.className || ""} flex items-center gap-2 px-3 text-[10px] font-light shrink-0 select-none transition-all duration-300 z-20`}
			style={{
				...headerProps.style,
				height: 26,
				color: theme.foreground,
				borderTop: isBottom
					? `1px solid ${isFocused ? `${theme.accent}66` : `${theme.foreground}11`}`
					: "none",
				borderBottom: isBottom
					? "none"
					: `1px solid ${isFocused ? `${theme.accent}66` : `${theme.foreground}11`}`,
				backgroundColor: isFocused ? "#16161e" : "transparent",
			}}
		>
			{isEditing ? (
				<input
					{...editInputProps}
					className="bg-transparent border font-light text-[10px] py-px px-1 outline-none w-20"
					style={{ borderColor: theme.accent, color: theme.foreground }}
				/>
			) : (
				<button
					type="button"
					onDoubleClick={onDoubleClickLabel}
					onKeyDown={(e) => { if (e.key === "Enter") onDoubleClickLabel(); }}
					className={`bg-transparent border-none p-0 cursor-default shrink-0 font-medium ${FOCUS_VIS}`}
				>
					{label}
				</button>
			)}

			<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap opacity-35 text-[10px]">
				{cwd}
			</span>

			{branch && (
				<output
					aria-label={`Git branch: ${branch}`}
					className="min-w-0 text-[10px] font-light overflow-hidden text-ellipsis whitespace-nowrap"
					title={branch}
					style={{ color: theme.accent }}
				>
					{branch}
				</output>
			)}

			{pr && (
				<PrBadge
					pr={pr}
					onOpenExternal={onOpenExternal}
					className="bg-transparent text-[10px] font-light px-0.5 leading-none opacity-60 hover:opacity-100 transition-opacity"
					style={{ color: theme.accent }}
				/>
			)}

			<SnippetTrigger
				className={`bg-transparent border-none cursor-pointer text-[10px] px-0.5 leading-none ${FOCUS_VIS}`}
				style={{ color: theme.foreground }}
			>
				{">_"}
			</SnippetTrigger>

			<div className="flex items-center gap-0.5 opacity-0 hover:opacity-60 focus-within:opacity-60 has-[:focus-visible]:opacity-60 transition-opacity duration-300">
				<button
					type="button"
					onClick={onSplitVertical}
					title={`Split vertical (${shortcuts.splitV})`}
					aria-label="Split pane vertically"
					className={`bg-transparent border-none cursor-pointer text-[10px] px-0.5 leading-none ${FOCUS_VIS}`}
					style={{ color: theme.foreground }}
				>
					┃
				</button>
				<button
					type="button"
					onClick={onSplitHorizontal}
					title={`Split horizontal (${shortcuts.splitH})`}
					aria-label="Split pane horizontally"
					className={`bg-transparent border-none cursor-pointer text-[10px] px-0.5 leading-none ${FOCUS_VIS}`}
					style={{ color: theme.foreground }}
				>
					━
				</button>
				{canClose && (
					<button
						type="button"
						onClick={onClose}
						title={`Close pane (${shortcuts.close})`}
						aria-label="Close pane"
						className={`bg-transparent border-none cursor-pointer text-[10px] px-0.5 leading-none ${FOCUS_VIS}`}
						style={{ color: theme.foreground }}
					>
						✕
					</button>
				)}
			</div>
			{contextMenu}
		</div>
	);

	return (
		<div className="relative flex flex-col h-full w-full bg-transparent overflow-hidden">
			{!isBottom && header}

			{/* Terminal Content */}
			<div className="relative z-10 flex-1 w-full min-h-0 bg-transparent">{children}</div>

			{isBottom && header}
		</div>
	);
}

function ScrollButton({ onClick, theme }: ScrollButtonProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label="Scroll to bottom"
			className={`absolute bottom-3 right-3 z-30 w-6 h-6 flex items-center justify-center text-sm cursor-pointer hover:brightness-125 ${FOCUS_VIS}`}
			style={{
				color: theme.accent,
				backgroundColor: "transparent",
				border: "none",
			}}
		>
			↓
		</button>
	);
}

const TokyoNightVariant: PaneVariant = { Frame, ScrollButton };
registerVariant("Tokyo Night", TokyoNightVariant);
