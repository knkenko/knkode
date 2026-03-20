import { registerVariant } from ".";
import { FOCUS_VIS, LabelButton, PrBadge, resolveGlow } from "./shared";
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
	const glowColor = resolveGlow(theme);

	const isBottom = theme.statusBarPosition === "bottom";

	const header = (
		<div
			{...headerProps}
			className={`${headerProps.className || ""} flex items-center gap-1 px-3 py-1 text-[10px] font-mono uppercase shrink-0 select-none transition-colors duration-200 z-20`}
			style={{
				...headerProps.style,
				height: 28,
				color: fg,
				backgroundColor: "#0a0a0a",
				borderTop: isBottom ? `1px solid ${theme.accent}66` : "none",
				borderBottom: isBottom ? "none" : `1px solid ${theme.accent}66`,
				textShadow: isFocused ? `0 0 6px ${glowColor}44` : "none",
			}}
		>
			{isEditing ? (
				<input
					{...editInputProps}
					className="bg-transparent border font-mono uppercase text-[10px] py-px px-1 outline-none w-20"
					style={{ borderColor: theme.accent, color: fg }}
				/>
			) : (
				<LabelButton onEdit={onDoubleClickLabel}>
					{label}
				</LabelButton>
			)}

			<span className="mx-1 opacity-40">|</span>

			<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap opacity-70">
				{"> "}
				{cwd}
			</span>

			{branch && (
				<output
					aria-label={`Git branch: ${branch}`}
					className="min-w-0 overflow-hidden text-ellipsis whitespace-nowrap opacity-80"
					title={branch}
				>
					<span className="mx-1 opacity-40">|</span>[{branch}]
				</output>
			)}

			{pr && (
				<PrBadge
					pr={pr}
					onOpenExternal={onOpenExternal}
					className="bg-transparent px-0.5 leading-none opacity-60 hover:opacity-100"
					style={{ color: fg }}
				>
					[PR#{pr.number}]
				</PrBadge>
			)}

			<span className="mx-1 opacity-40">|</span>

			<SnippetTrigger
				className={`bg-transparent border-none cursor-pointer px-0.5 leading-none opacity-60 hover:opacity-100 ${FOCUS_VIS}`}
				style={{ color: fg }}
			>
				[CMD]
			</SnippetTrigger>

			<button
				type="button"
				onClick={onSplitVertical}
				title={`Split vertical (${shortcuts.splitV})`}
				aria-label="Split pane vertically"
				className={`bg-transparent border-none cursor-pointer px-0.5 leading-none opacity-60 hover:opacity-100 ${FOCUS_VIS}`}
				style={{ color: fg }}
			>
				┃
			</button>
			<button
				type="button"
				onClick={onSplitHorizontal}
				title={`Split horizontal (${shortcuts.splitH})`}
				aria-label="Split pane horizontally"
				className={`bg-transparent border-none cursor-pointer px-0.5 leading-none opacity-60 hover:opacity-100 ${FOCUS_VIS}`}
				style={{ color: fg }}
			>
				━
			</button>
			{canClose && (
				<button
					type="button"
					onClick={onClose}
					title={`Close pane (${shortcuts.close})`}
					aria-label="Close pane"
					className={`bg-transparent border-none cursor-pointer px-0.5 leading-none opacity-60 hover:opacity-100 ${FOCUS_VIS}`}
					style={{ color: fg }}
				>
					✕
				</button>
			)}
			{contextMenu}
		</div>
	);

	return (
		<div className="relative flex flex-col h-full w-full bg-transparent overflow-hidden">
			{/* Phosphor Frame Background / Scanlines */}
			<div
				className="absolute inset-0 pointer-events-none z-0"
				style={{
					boxShadow: isFocused ? `inset 0 0 20px ${glowColor}22` : "inset 0 0 10px #000",
					border: `1px solid ${isFocused ? `${glowColor}44` : "#111"}`,
				}}
			/>

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
			className={`absolute bottom-6 left-6 right-6 z-30 h-7 flex items-center justify-center text-[10px] font-mono uppercase cursor-pointer tracking-widest hover:brightness-125 ${FOCUS_VIS}`}
			style={{
				backgroundColor: `${theme.background}dd`,
				color: theme.accent,
				border: `1px solid ${theme.accent}44`,
				textShadow: `0 0 8px ${resolveGlow(theme)}66`,
			}}
		>
			[▼ SCROLL TO BOTTOM]
		</button>
	);
}

const MatrixVariant: PaneVariant = { Frame, ScrollButton };
registerVariant("Matrix", MatrixVariant);
