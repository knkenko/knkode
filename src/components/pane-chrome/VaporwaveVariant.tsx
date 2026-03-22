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
	shortcuts,
	children,
	headerProps,
	contextMenu,
	agentStatus,
}: FrameProps) {
	const glowColor = resolveGlow(theme);
	const c1 = theme.accent;
	const c2 = "#01cdfe";
	const c3 = "#7b2fff";

	const activeOpacity = isFocused ? 1 : 0.6;
	const isBottom = theme.statusBarPosition === "bottom";
	const sepClass = getSepClass(agentStatus, isBottom);
	const isAnimating = agentStatus !== "idle";
	const sepStyle = isAnimating
		? getSepVars(
				`linear-gradient(90deg, transparent, ${c1}, ${c2}, ${c3}, transparent)`,
				c1,
				"dual-scan",
				3.5,
				3,
			)
		: {};

	const header = (
		<div
			{...headerProps}
			className={`${headerProps.className || ""} relative z-20 flex items-center gap-2 px-3 py-1.5 text-[11px] tracking-wider font-light shrink-0 select-none transition-[opacity,background,box-shadow] duration-300 ${sepClass}`}
			style={{
				...headerProps.style,
				height: 32,
				color: theme.foreground,
				opacity: activeOpacity,
				borderBottom: isBottom ? "none" : "3px solid transparent",
				borderTop: isBottom ? "3px solid transparent" : "none",
				borderImage: isFocused
					? `linear-gradient(90deg, ${c1}, ${c2}, ${c3}) 1`
					: `linear-gradient(90deg, ${c1}44, ${c2}44, ${c3}44) 1`,
				backgroundColor: "#0a0015dd",
				backdropFilter: "blur(4px)",
				...sepStyle,
				...(isAnimating
					? { borderImage: "none", borderColor: "transparent" }
					: { borderColor: "transparent" }),
			}}
		>
			{isEditing ? (
				<input
					{...editInputProps}
					className="bg-transparent border rounded-sm tracking-wider font-light text-[11px] py-px px-1 outline-none w-20"
					style={{ borderColor: theme.accent, color: theme.accent }}
				/>
			) : (
				<LabelButton
					onEdit={onDoubleClickLabel}
					className="font-medium"
					style={{ color: theme.accent, textShadow: isFocused ? `0 0 8px ${c1}` : "none" }}
				>
					{label}
				</LabelButton>
			)}

			<span
				className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap opacity-80"
				style={{
					backgroundImage: `linear-gradient(90deg, ${c1}, ${c2})`,
					WebkitBackgroundClip: "text",
					WebkitTextFillColor: "transparent",
				}}
			>
				{cwd}
			</span>

			{branch && (
				<output
					aria-label={`Git branch: ${branch}`}
					className="min-w-0 text-[10px] font-medium px-3 py-0.5 rounded-full overflow-hidden text-ellipsis whitespace-nowrap"
					title={branch}
					style={{
						background: `linear-gradient(135deg, ${c1}, ${c3})`,
						color: theme.background,
						boxShadow: isFocused ? `0 0 8px ${glowColor}44` : "none",
					}}
				>
					{branch}
				</output>
			)}

			{pr && (
				<PrBadge
					pr={pr}
					onOpenExternal={onOpenExternal}
					className="text-[10px] font-medium px-3 py-0.5 rounded-full hover:brightness-110 transition-all"
					style={{
						background: `linear-gradient(135deg, ${c1}, ${c3})`,
						color: theme.background,
						boxShadow: isFocused ? `0 0 8px ${glowColor}44` : "none",
					}}
				/>
			)}

			<SnippetTrigger
				className={`text-[9px] tracking-wider font-medium px-2 py-0.5 rounded-full cursor-pointer border-none hover:brightness-110 transition-all ${FOCUS_VIS}`}
				style={{
					background: `linear-gradient(135deg, ${c1}44, ${c2}44)`,
					color: theme.foreground,
					boxShadow: isFocused ? `0 0 6px ${c2}44` : "none",
				}}
			>
				{">_"}
			</SnippetTrigger>

			<button
				type="button"
				onClick={onSplitVertical}
				title={`Split vertical (${shortcuts.splitV})`}
				aria-label="Split pane vertically"
				className={`text-[9px] tracking-wider font-medium px-2 py-0.5 rounded-full cursor-pointer border-none hover:brightness-110 transition-all ${FOCUS_VIS}`}
				style={{
					background: `linear-gradient(135deg, ${c1}44, ${c2}44)`,
					color: theme.foreground,
				}}
			>
				SPLIT ┃
			</button>
			<button
				type="button"
				onClick={onSplitHorizontal}
				title={`Split horizontal (${shortcuts.splitH})`}
				aria-label="Split pane horizontally"
				className={`text-[9px] tracking-wider font-medium px-2 py-0.5 rounded-full cursor-pointer border-none hover:brightness-110 transition-all ${FOCUS_VIS}`}
				style={{
					background: `linear-gradient(135deg, ${c1}44, ${c2}44)`,
					color: theme.foreground,
				}}
			>
				SPLIT ━
			</button>
			{canClose && (
				<button
					type="button"
					onClick={onClose}
					title={`Close pane (${shortcuts.close})`}
					aria-label="Close pane"
					className={`text-[9px] tracking-wider font-medium px-2 py-0.5 rounded-full cursor-pointer border-none hover:brightness-110 transition-all ${FOCUS_VIS}`}
					style={{
						background: `linear-gradient(135deg, ${c1}44, ${c2}44)`,
						color: theme.foreground,
					}}
				>
					CLOSE ✕
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
				className={`relative z-10 flex-1 w-full min-h-0 bg-transparent ${isBottom ? "mb-1" : "mt-1"}`}
			>
				{children}
			</div>

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
			className={`absolute bottom-4 left-1/4 right-1/4 z-30 h-9 rounded-full flex items-center justify-center text-xs tracking-wider font-medium cursor-pointer hover:brightness-110 ${FOCUS_VIS}`}
			style={{
				background: `linear-gradient(135deg, ${theme.accent}cc, ${glowColor}cc)`,
				color: theme.background,
				boxShadow: `0 4px 16px ${glowColor}44`,
			}}
		>
			↓
		</button>
	);
}

const VaporwaveVariant: PaneVariant = { Frame, ScrollButton };
registerVariant("Vaporwave", VaporwaveVariant);
