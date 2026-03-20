import { registerVariant } from ".";
import { FOCUS_VIS, LabelButton, PrBadge } from "./shared";
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
	const fg = isFocused ? theme.accent : theme.foreground;
	const isBottom = theme.statusBarPosition === "bottom";

	const header = (
		<div
			{...headerProps}
			className={`${headerProps.className || ""} flex items-center gap-1 px-3 py-1 text-[10px] font-mono uppercase shrink-0 select-none transition-colors duration-200 z-20`}
			style={{
				...headerProps.style,
				height: 28,
				color: fg,
				backgroundColor: "#0c0800",
				borderTop: isBottom
					? `1px dashed ${isFocused ? `${theme.accent}66` : `${theme.accent}33`}`
					: "none",
				borderBottom: isBottom
					? "none"
					: `1px dashed ${isFocused ? `${theme.accent}66` : `${theme.accent}33`}`,
				textShadow: isFocused ? `0 0 8px ${theme.accent}66` : "none",
			}}
		>
			{isEditing ? (
				<input
					{...editInputProps}
					className="bg-transparent border font-mono uppercase text-[10px] py-px px-1 outline-none w-20"
					style={{ borderColor: theme.accent, color: fg }}
				/>
			) : (
				<LabelButton onEdit={onDoubleClickLabel} className="font-bold">
					{label}
				</LabelButton>
			)}

			<span className="mx-2 opacity-40">│</span>

			<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap opacity-70">
				CWD: {cwd.toUpperCase()}
			</span>

			{branch && (
				<output
					aria-label={`Git branch: ${branch}`}
					className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap opacity-80 font-bold"
					title={branch}
				>
					<span className="mx-2 opacity-40">│</span>
					BR: {branch.toUpperCase()}
				</output>
			)}

			{pr && (
				<PrBadge
					pr={pr}
					onOpenExternal={onOpenExternal}
					className="bg-transparent px-1 leading-none opacity-60 hover:opacity-100"
					style={{ color: fg }}
				>
					[PR#{pr.number}]
				</PrBadge>
			)}

			<span className="mx-2 opacity-40">│</span>

			<SnippetTrigger
				className={`bg-transparent border-none cursor-pointer px-1 leading-none opacity-60 hover:opacity-100 ${FOCUS_VIS}`}
				style={{ color: fg }}
			>
				[CMD]
			</SnippetTrigger>

			<button
				type="button"
				onClick={onSplitVertical}
				title={`Split vertical (${shortcuts.splitV})`}
				aria-label="Split pane vertically"
				className={`bg-transparent border-none cursor-pointer px-1 leading-none opacity-60 hover:opacity-100 ${FOCUS_VIS}`}
				style={{ color: fg }}
			>
				[SPLIT-V]
			</button>
			<button
				type="button"
				onClick={onSplitHorizontal}
				title={`Split horizontal (${shortcuts.splitH})`}
				aria-label="Split pane horizontally"
				className={`bg-transparent border-none cursor-pointer px-1 leading-none opacity-60 hover:opacity-100 ${FOCUS_VIS}`}
				style={{ color: fg }}
			>
				[SPLIT-H]
			</button>
			{canClose && (
				<button
					type="button"
					onClick={onClose}
					title={`Close pane (${shortcuts.close})`}
					aria-label="Close pane"
					className={`bg-transparent border-none cursor-pointer px-1 leading-none opacity-60 hover:opacity-100 ${FOCUS_VIS}`}
					style={{ color: fg }}
				>
					[CLOSE]
				</button>
			)}
			{contextMenu}
		</div>
	);

	return (
		<div className="relative flex flex-col h-full w-full bg-transparent overflow-hidden">
			{!isBottom && header}

			{/* Terminal Content */}
			<div
				className={`relative z-10 flex-1 w-full min-h-0 bg-transparent px-1 ${isBottom ? "mb-1" : "mt-1"}`}
			>
				{children}
			</div>

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
			className={`absolute bottom-6 left-6 right-6 z-30 h-7 flex items-center justify-center text-[10px] font-mono uppercase tracking-widest cursor-pointer hover:brightness-125 ${FOCUS_VIS}`}
			style={{
				backgroundColor: `${theme.background}dd`,
				color: theme.accent,
				border: `1px dotted ${theme.accent}44`,
				textShadow: `0 0 6px ${theme.accent}44`,
			}}
		>
			{">>> SCROLL DOWN <<<"}
		</button>
	);
}

const AmberVariant: PaneVariant = { Frame, ScrollButton };
registerVariant("Amber", AmberVariant);
