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
	const glowColor = theme.glow ?? theme.accent;
	const c1 = theme.accent;
	const isBottom = theme.statusBarPosition === "bottom";

	const header = (
		<div
			{...headerProps}
			className={`${headerProps.className || ""} flex items-center gap-2 px-4 py-1 text-[11px] font-light shrink-0 select-none transition-all duration-300 z-20`}
			style={{
				...headerProps.style,
				height: 30,
				color: theme.foreground,
				backgroundColor: "#020b14",
				borderTop: isBottom ? `1px solid ${c1}28` : "none",
				borderBottom: isBottom ? "none" : `1px solid ${c1}28`,
				boxShadow: isFocused ? `0 ${isBottom ? "-" : ""}2px 8px ${glowColor}11` : "none",
			}}
		>
			{isEditing ? (
				<input
					{...editInputProps}
					className="bg-transparent border rounded-sm font-light text-[11px] py-px px-1 outline-none w-20"
					style={{ borderColor: theme.accent, color: theme.foreground }}
				/>
			) : (
				<span onDoubleClick={onDoubleClickLabel} className="cursor-default shrink-0 font-medium">
					{label}
				</span>
			)}

			<span
				className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap opacity-50"
				style={{
					maskImage: "linear-gradient(90deg, black 80%, transparent)",
					WebkitMaskImage: "linear-gradient(90deg, black 80%, transparent)",
				}}
			>
				~ {cwd}
			</span>

			{branch && (
				<output
					aria-label={`Git branch: ${branch}`}
					className="min-w-0 text-[10px] px-2 py-px rounded-md overflow-hidden text-ellipsis whitespace-nowrap"
					title={branch}
					style={{
						backgroundColor: `${theme.accent}22`,
						color: theme.foreground,
					}}
				>
					{branch}
				</output>
			)}

			{pr && (
				<PrBadge
					pr={pr}
					onOpenExternal={onOpenExternal}
					className="text-[10px] px-2 py-px rounded-md hover:brightness-110 transition-all"
					style={{
						backgroundColor: `${theme.accent}22`,
						color: theme.foreground,
					}}
				/>
			)}

			<SnippetTrigger
				className={`bg-transparent border-none cursor-pointer text-[11px] px-0.5 leading-none ${FOCUS_VIS}`}
				style={{ color: theme.accent }}
			>
				{">_"}
			</SnippetTrigger>

			<div className="flex items-center gap-0.5 opacity-0 hover:opacity-70 focus-within:opacity-70 has-[:focus-visible]:opacity-70 transition-opacity duration-200">
				<button
					type="button"
					onClick={onSplitVertical}
					title={`Split vertical (${shortcuts.splitV})`}
					aria-label="Split pane vertically"
					className={`bg-transparent border-none cursor-pointer text-[11px] px-0.5 leading-none ${FOCUS_VIS}`}
					style={{ color: theme.accent }}
				>
					┃
				</button>
				<button
					type="button"
					onClick={onSplitHorizontal}
					title={`Split horizontal (${shortcuts.splitH})`}
					aria-label="Split pane horizontally"
					className={`bg-transparent border-none cursor-pointer text-[11px] px-0.5 leading-none ${FOCUS_VIS}`}
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
						className={`bg-transparent border-none cursor-pointer text-[11px] px-0.5 leading-none ${FOCUS_VIS}`}
						style={{ color: theme.accent }}
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
			<div
				className={`relative z-10 flex-1 w-full min-h-0 bg-transparent px-2 ${isBottom ? "mb-1" : "mt-1"}`}
			>
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
			className={`absolute bottom-6 right-6 z-30 w-9 h-9 rounded-full flex items-center justify-center text-sm cursor-pointer hover:brightness-110 ${FOCUS_VIS}`}
			style={{
				backgroundColor: `${theme.accent}22`,
				color: theme.accent,
				boxShadow: `0 0 12px ${glowColor}33`,
				backdropFilter: "blur(4px)",
			}}
		>
			↓
		</button>
	);
}

const OceanVariant: PaneVariant = { Frame, ScrollButton };
registerVariant("Ocean", OceanVariant);
