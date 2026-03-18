import { registerVariant } from ".";
import { FOCUS_VIS, FolderIcon, PrBadge } from "./shared";
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
	const glowColor = theme.glow ?? theme.accent;
	const c1 = theme.accent;
	const c2 = glowColor;
	const isBottom = theme.statusBarPosition === "bottom";

	const header = (
		<div
			{...headerProps}
			className={`${headerProps.className || ""} relative z-20 flex items-center gap-2 px-3 py-1 text-[11px] font-medium shrink-0 select-none transition-all duration-200`}
			style={{
				...headerProps.style,
				height: 30,
				color: theme.foreground,
				backgroundColor: "#0c0c1d",
				borderTop: isBottom ? "2px solid transparent" : "none",
				borderBottom: isBottom ? "none" : "2px solid transparent",
				borderImage: isFocused
					? `linear-gradient(90deg, ${c1}, ${c2}) 1`
					: `linear-gradient(90deg, ${c1}33, ${c2}33) 1`,
			}}
		>
			{isEditing ? (
				<input
					{...editInputProps}
					className="bg-transparent border rounded-sm text-[11px] py-px px-1 outline-none w-20"
					style={{ borderColor: theme.accent, color: theme.foreground }}
				/>
			) : (
				<span
					onDoubleClick={onDoubleClickLabel}
					className="cursor-default shrink-0 font-semibold"
					style={{ textShadow: isFocused ? `0 0 8px ${c1}66` : "none" }}
				>
					{label}
				</span>
			)}

			<span className="opacity-30">·</span>

			<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap opacity-60 flex items-center gap-1">
				<span style={{ color: theme.accent }}>
					<FolderIcon />
				</span>
				{cwd}
			</span>

			{branch && (
				<output
					aria-label={`Git branch: ${branch}`}
					className="min-w-0 text-[10px] font-medium px-2 py-px rounded-full overflow-hidden text-ellipsis whitespace-nowrap"
					title={branch}
					style={{
						background: `linear-gradient(135deg, ${c1}33, ${c2}33)`,
						color: theme.foreground,
						border: `1px solid ${c1}44`,
						boxShadow: isFocused ? `0 0 6px ${c2}33` : "none",
					}}
				>
					{branch}
				</output>
			)}

			{pr && (
				<PrBadge
					pr={pr}
					onOpenExternal={onOpenExternal}
					className="text-[10px] font-medium px-2 py-px rounded-full hover:brightness-110 transition-all"
					style={{
						background: `linear-gradient(135deg, ${c1}33, ${c2}33)`,
						color: theme.foreground,
						border: `1px solid ${c1}44`,
						boxShadow: isFocused ? `0 0 6px ${c2}33` : "none",
					}}
				/>
			)}

			<span className="opacity-30">·</span>

			<SnippetTrigger
				className={`bg-transparent border-none cursor-pointer text-[11px] px-0.5 leading-none opacity-50 hover:opacity-100 transition-opacity ${FOCUS_VIS}`}
				style={{ color: theme.accent }}
			>
				{">_"}
			</SnippetTrigger>

			<button
				type="button"
				onClick={onSplitVertical}
				title={`Split vertical (${shortcuts.splitV})`}
				aria-label="Split pane vertically"
				className={`bg-transparent border-none cursor-pointer text-[11px] px-0.5 leading-none opacity-50 hover:opacity-100 transition-opacity ${FOCUS_VIS}`}
				style={{ color: theme.accent }}
			>
				┃
			</button>
			<button
				type="button"
				onClick={onSplitHorizontal}
				title={`Split horizontal (${shortcuts.splitH})`}
				aria-label="Split pane horizontally"
				className={`bg-transparent border-none cursor-pointer text-[11px] px-0.5 leading-none opacity-50 hover:opacity-100 transition-opacity ${FOCUS_VIS}`}
				style={{ color: theme.accent }}
			>
				━
			</button>
			{canClose && (
				<button
					type="button"
					onClick={onClose}
					title={`Close pane (${shortcuts.close})`}
					aria-label="Close pane"
					className={`bg-transparent border-none cursor-pointer text-[11px] px-0.5 leading-none opacity-50 hover:opacity-100 transition-opacity ${FOCUS_VIS}`}
					style={{ color: theme.accent }}
				>
					✕
				</button>
			)}
			{contextMenu}
		</div>
	);

	return (
		<div className="relative flex flex-col h-full w-full bg-transparent overflow-hidden">
			{!isBottom && header}

			<div className={`relative z-10 flex-1 w-full min-h-0 ${isBottom ? "mb-1" : "mt-1"}`}>
				{children}
			</div>

			{isBottom && header}
		</div>
	);
}

function ScrollButton({ onClick, theme }: ScrollButtonProps) {
	const glowColor = theme.glow ?? theme.accent;
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label="Scroll to bottom"
			className={`absolute bottom-6 left-1/4 right-1/4 z-30 h-8 rounded-full flex items-center justify-center text-xs cursor-pointer hover:brightness-110 ${FOCUS_VIS}`}
			style={{
				color: theme.foreground,
				border: `1px solid ${theme.accent}66`,
				background: `linear-gradient(135deg, ${theme.accent}11, ${glowColor}11), ${theme.background}dd`,
				boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
			}}
		>
			↓ Scroll to bottom
		</button>
	);
}

const SolanaVariant: PaneVariant = { Frame, ScrollButton };
registerVariant("Solana", SolanaVariant);
