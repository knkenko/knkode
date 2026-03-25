import { registerVariant } from ".";
import { FOCUS_VIS, LabelButton, PrBadge, getSepClass, getSepVars, resolveGlow } from "./shared";
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
	SessionHistoryTrigger,
	shortcuts,
	children,
	headerProps,
	contextMenu,
	agentStatus,
}: FrameProps) {
	const glowColor = resolveGlow(theme);
	const c1 = theme.accent;
	const c2 = theme.glow || "#05d9e8";

	// If not focused, we dull the colors to simulate power-saving
	const activeC1 = isFocused ? c1 : `${c1}88`;
	const activeC2 = isFocused ? c2 : `${c2}88`;

	const isBottom = theme.statusBarPosition === "bottom";
	const sepClass = getSepClass(agentStatus, isBottom);
	const isAnimating = agentStatus !== "idle";
	const sepStyle = isAnimating
		? getSepVars(
				`linear-gradient(90deg, transparent, ${c1}, ${c2}, transparent)`,
				c1,
				"dual-scan",
				3.5,
			)
		: {};

	const header = (
		<div
			{...headerProps}
			className={`${headerProps.className || ""} w-full flex items-center gap-2 px-4 py-1.5 text-[9px] font-mono font-bold uppercase tracking-widest shrink-0 select-none transition-[opacity,background,box-shadow] duration-300 z-20 ${sepClass}`}
			style={{
				...headerProps.style,
				height: 32,
				color: theme.foreground,
				backgroundColor: "#0d0221",
				borderTop: isBottom ? `1px solid ${activeC1}88` : "none",
				borderBottom: isBottom ? "none" : `1px solid ${activeC1}88`,
				background: `linear-gradient(90deg, ${activeC1}26 0%, ${activeC2}14 100%), #0d0221`,
				boxShadow: isFocused ? `0 ${isBottom ? "-1px" : "1px"} 8px ${glowColor}44` : "none",
				...sepStyle,
				borderColor: isAnimating ? "transparent" : `${activeC1}88`,
			}}
		>
			{isEditing ? (
				<input
					{...editInputProps}
					className="bg-transparent border font-bold uppercase tracking-wider text-[10px] py-px px-1 outline-none w-20"
					style={{ borderColor: activeC1, color: activeC1 }}
				/>
			) : (
				<LabelButton
					onEdit={onDoubleClickLabel}
					style={{ color: activeC1, textShadow: isFocused ? `0 0 4px ${activeC1}` : "none" }}
				>
					{label}
				</LabelButton>
			)}

			<span className="opacity-30">/</span>

			<span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap opacity-60 text-[9px]">
				{"// "}
				{cwd}
			</span>

			{branch && (
				<output
					aria-label={`Git branch: ${branch}`}
					className="min-w-0 text-[9px] font-bold px-3 py-px overflow-hidden text-ellipsis whitespace-nowrap"
					title={branch}
					style={{
						color: theme.background,
						backgroundColor: activeC1,
						clipPath: "polygon(6px 0, 100% 0, calc(100% - 6px) 100%, 0 100%)",
						textShadow: isFocused ? `0 0 2px ${theme.background}` : "none",
					}}
				>
					{branch}
				</output>
			)}

			{pr && (
				<PrBadge
					pr={pr}
					onOpenExternal={onOpenExternal}
					className="bg-transparent text-[9px] font-bold uppercase tracking-widest px-1 leading-none opacity-50 hover:opacity-100 transition-opacity"
					style={{ color: activeC1, textShadow: isFocused ? `0 0 4px ${glowColor}88` : "none" }}
				/>
			)}

			<SnippetTrigger
				className={`bg-transparent border-none cursor-pointer px-1 leading-none opacity-50 hover:opacity-100 transition-opacity ${FOCUS_VIS}`}
				style={{ color: activeC2 }}
			>
				{">_"}
			</SnippetTrigger>
			<SessionHistoryTrigger
				className={`bg-transparent border-none cursor-pointer px-1 text-lg leading-none opacity-50 hover:opacity-100 transition-opacity ${FOCUS_VIS}`}
				style={{ color: activeC2 }}
			>
				☰
			</SessionHistoryTrigger>

			<button
				type="button"
				onClick={onSplitVertical}
				title={`Split vertical (${shortcuts.splitV})`}
				aria-label="Split pane vertically"
				className={`bg-transparent border-none cursor-pointer px-1 leading-none opacity-50 hover:opacity-100 transition-opacity ${FOCUS_VIS}`}
				style={{ color: activeC2 }}
			>
				┃
			</button>
			<button
				type="button"
				onClick={onSplitHorizontal}
				title={`Split horizontal (${shortcuts.splitH})`}
				aria-label="Split pane horizontally"
				className={`bg-transparent border-none cursor-pointer px-1 leading-none opacity-50 hover:opacity-100 transition-opacity ${FOCUS_VIS}`}
				style={{ color: activeC2 }}
			>
				━
			</button>
			{canClose && (
				<button
					type="button"
					onClick={onClose}
					title={`Close pane (${shortcuts.close})`}
					aria-label="Close pane"
					className={`bg-transparent border-none cursor-pointer px-1 leading-none opacity-50 hover:opacity-100 transition-opacity ${FOCUS_VIS}`}
					style={{ color: activeC1 }}
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

			{/* Terminal Content */}
			<div className="relative z-10 flex-1 w-full min-h-0 bg-transparent">{children}</div>

			{isBottom && header}
		</div>
	);
}

function ScrollButton({ onClick, theme }: ScrollButtonProps) {
	const glowColor = resolveGlow(theme);
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label="Scroll to bottom"
			className={`absolute bottom-10 left-4 right-4 z-30 h-8 flex items-center justify-center text-[10px] font-bold uppercase tracking-widest cursor-pointer hover:brightness-125 ${FOCUS_VIS}`}
			style={{
				backgroundColor: `${theme.background}dd`,
				color: theme.accent,
				border: `1px solid ${theme.accent}66`,
				clipPath: "polygon(12px 0, 100% 0, calc(100% - 12px) 100%, 0 100%)",
				boxShadow: `0 0 12px ${glowColor}44`,
				textShadow: `0 0 6px ${glowColor}66`,
			}}
		>
			↓ BOTTOM
		</button>
	);
}

const CyberpunkVariant: PaneVariant = { Frame, ScrollButton };
registerVariant("Cyberpunk", CyberpunkVariant);
