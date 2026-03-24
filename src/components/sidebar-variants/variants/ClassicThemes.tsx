import type {
	BasePaneEntryProps,
	BaseWorkspaceGitInfoProps,
	BaseWorkspaceHeaderProps,
} from "../types";

// --- Default Dark ---
export function DefaultDarkHeader({
	name,
	cwd,
	isActive,
	isCollapsed,
	attentionCount,
	isEditing,
	inputProps,
	onClick,
	onContextMenu,
}: BaseWorkspaceHeaderProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			onContextMenu={onContextMenu}
			className={`sidebar-item flex flex-col gap-0.5 w-full px-3 py-3.5 text-left cursor-pointer border-none transition-colors duration-150 ${isActive ? "text-[#e0e0e0] bg-[#232946]/5" : "bg-transparent text-[#8892b0] hover:text-[#e0e0e0]"}`}
		>
			<div className="flex items-center gap-2 w-full min-w-0">
				<svg
					width="10"
					height="10"
					viewBox="0 0 10 10"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
					className={`shrink-0 transition-transform duration-200 text-[#5a6380] ${isCollapsed ? "-rotate-90" : ""}`}
				>
					<path d="M2.5 3.5L5 6.5L7.5 3.5" />
				</svg>
				{isEditing ? (
					<input
						{...inputProps}
						maxLength={64}
						onClick={(e) => e.stopPropagation()}
						className="sidebar-header bg-[#16213e] border border-[#6c63ff] rounded-sm text-[#e0e0e0] text-[11px] py-px px-1 outline-none flex-1 min-w-0"
					/>
				) : (
					<span className="sidebar-header text-[13px] font-medium truncate flex-1 min-w-0">
						{name}
					</span>
				)}
				{!isEditing && cwd && (
					<span
						className="text-[9px] text-[#5a6380] truncate min-w-0 font-mono opacity-60"
						title={cwd}
					>
						{cwd}
					</span>
				)}
				{attentionCount > 0 && (
					<span
						title={`${attentionCount} pane(s) need attention`}
						className="text-[9px] leading-none px-1.5 py-0.5 rounded-sm bg-[#232946] shrink-0 border border-[#2a2f4a]"
					>
						{attentionCount}
					</span>
				)}
			</div>
		</button>
	);
}

export function DefaultDarkEntry({
	label,
	title,
	agentStatus: _agentStatus,
	isFocused,
	onClick,
	onContextMenu,
	paneId,
}: BasePaneEntryProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			onContextMenu={onContextMenu}
			data-pane-id={paneId}
			className={`sidebar-item flex flex-col gap-0.5 w-full mt-0.5 text-left pl-4 pr-3 py-1.5 border-none border-b border-[#2a2f4a]/50 cursor-pointer transition-colors duration-150 ${isFocused ? "sidebar-pane-focused text-[#e0e0e0] border-l-2 border-[#6c63ff]" : "bg-transparent text-[#5a6380] hover:text-[#8892b0] border-l-2 border-transparent"}`}
		>
			<span className={`text-[11px] truncate ${isFocused ? "font-semibold" : ""}`}>
				{title || label}
			</span>
			{title && (
				<span className="text-[9px] truncate pl-4 opacity-60 text-[#5a6380]">
					{label}
				</span>
			)}
		</button>
	);
}

// --- Dracula ---
export function DraculaHeader({
	name,
	cwd,
	isActive,
	isCollapsed,
	attentionCount,
	isEditing,
	inputProps,
	onClick,
	onContextMenu,
}: BaseWorkspaceHeaderProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			onContextMenu={onContextMenu}
			className={`sidebar-item flex flex-col gap-0.5 w-full px-3 py-3.5 text-left cursor-pointer border-none transition-all ${isActive ? "text-[#f8f8f2] bg-[#44475a]/40 border-b border-[#44475a]" : "bg-transparent text-[#6272a4] hover:text-[#f8f8f2] hover:bg-[#44475a]/20"}`}
		>
			<div className="flex items-center gap-2 w-full min-w-0">
				<div
					className={`w-2 h-2 rounded-full shrink-0 transition-all ${isActive ? "bg-[#ff79c6] shadow-[0_0_8px_#ff79c6]" : "bg-[#6272a4]"}`}
				/>
				{isEditing ? (
					<input
						{...inputProps}
						maxLength={64}
						onClick={(e) => e.stopPropagation()}
						className="sidebar-header bg-[#282a36] border border-[#bd93f9] rounded-sm text-[#f8f8f2] text-[11px] py-px px-1 outline-none flex-1 min-w-0"
					/>
				) : (
					<span className="sidebar-header text-[13px] font-bold tracking-wide truncate flex-1 min-w-0">
						{name}
					</span>
				)}
				{!isEditing && cwd && (
					<span
						className="text-[9px] text-[#6272a4] truncate min-w-0 font-mono opacity-60"
						title={cwd}
					>
						{cwd}
					</span>
				)}
				{attentionCount > 0 && (
					<span
						title={`${attentionCount} pane(s) need attention`}
						className="text-[10px] leading-none font-bold px-1.5 py-0.5 rounded-full bg-[#bd93f9]/20 text-[#bd93f9] shrink-0"
					>
						{attentionCount}
					</span>
				)}
				<svg
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					className={`shrink-0 transition-transform duration-300 ${isCollapsed ? "rotate-180" : ""}`}
				>
					<polyline points="6 9 12 15 18 9"></polyline>
				</svg>
			</div>
		</button>
	);
}

export function DraculaEntry({
	label,
	title,
	agentStatus: _agentStatus,
	isFocused,
	onClick,
	onContextMenu,
	paneId,
}: BasePaneEntryProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			onContextMenu={onContextMenu}
			data-pane-id={paneId}
			className={`sidebar-item flex flex-col gap-0.5 w-[calc(100%-8px)] mx-1 mt-1 text-left pl-4 pr-2 py-1.5 border-none border-b border-[#44475a]/40 cursor-pointer rounded-md transition-all ${isFocused ? "sidebar-pane-focused text-[#f8f8f2] bg-[#44475a]/30" : "bg-transparent text-[#6272a4] hover:text-[#f8f8f2] hover:bg-[#44475a]/10"}`}
		>
			<span className="text-[11px] truncate font-medium">{title || label}</span>
			{title && (
				<span className="text-[9px] truncate pl-4 opacity-60 text-[#6272a4]">
					{label}
				</span>
			)}
		</button>
	);
}

// --- Tokyo Night ---
export function TokyoNightHeader({
	name,
	cwd,
	isActive,
	isCollapsed,
	attentionCount,
	isEditing,
	inputProps,
	onClick,
	onContextMenu,
}: BaseWorkspaceHeaderProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			onContextMenu={onContextMenu}
			className={`sidebar-item flex flex-col gap-0.5 w-full px-3 py-3.5 text-left cursor-pointer border-none transition-all ${isActive ? "text-[#c0caf5] bg-[#1f2335]" : "bg-transparent text-[#565f89] hover:text-[#a9b1d6] hover:bg-[#1f2335]/50"}`}
		>
			<div className="flex items-center gap-2 w-full min-w-0">
				<span className={`text-[10px] transition-transform ${isCollapsed ? "-rotate-90" : ""}`}>
					▼
				</span>
				{isEditing ? (
					<input
						{...inputProps}
						maxLength={64}
						onClick={(e) => e.stopPropagation()}
						className="sidebar-header bg-[#16161e] border border-[#7aa2f7] rounded-sm text-[#c0caf5] text-[11px] py-px px-1 outline-none flex-1 min-w-0"
					/>
				) : (
					<span
						className={`sidebar-header text-[13px] font-bold tracking-wider uppercase truncate flex-1 min-w-0 ${isActive ? "drop-shadow-[0_0_8px_rgba(122,162,247,0.5)] text-[#7aa2f7]" : ""}`}
					>
						{name}
					</span>
				)}
				{!isEditing && cwd && (
					<span
						className="text-[9px] text-[#3b4261] truncate min-w-0 font-mono opacity-60"
						title={cwd}
					>
						{cwd}
					</span>
				)}
				{attentionCount > 0 && (
					<span
						title={`${attentionCount} pane(s) need attention`}
						className="text-[9px] leading-none px-1.5 py-0.5 rounded-sm bg-[#1a1b26] border border-[#292e42] text-[#7dcfff] shrink-0"
					>
						{attentionCount}
					</span>
				)}
			</div>
		</button>
	);
}

export function TokyoNightEntry({
	label,
	title,
	agentStatus: _agentStatus,
	isFocused,
	onClick,
	onContextMenu,
	paneId,
}: BasePaneEntryProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			onContextMenu={onContextMenu}
			data-pane-id={paneId}
			className={`sidebar-item flex flex-col gap-0.5 w-full mt-0.5 text-left pl-4 pr-3 py-1.5 border-none border-b border-[#292e42]/50 cursor-pointer transition-all ${isFocused ? "sidebar-pane-focused text-[#c0caf5] border-l-2 border-[#bb9af7] bg-[#1f2335]/80" : "bg-transparent text-[#565f89] hover:text-[#a9b1d6] border-l-2 border-transparent hover:bg-[#1f2335]/30"}`}
		>
			<span className="text-[11px] truncate">{title || label}</span>
			{title && (
				<span className="text-[9px] truncate pl-4 opacity-60 text-[#565f89]">
					{label}
				</span>
			)}
		</button>
	);
}

// --- Nord ---
export function NordHeader({
	name,
	cwd,
	isActive,
	isCollapsed,
	attentionCount,
	isEditing,
	inputProps,
	onClick,
	onContextMenu,
}: BaseWorkspaceHeaderProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			onContextMenu={onContextMenu}
			className={`sidebar-item flex flex-col gap-0.5 w-full px-4 py-3.5 text-left cursor-pointer border-none transition-all ${isActive ? "text-[#eceff4] bg-[#3b4252]" : "bg-transparent text-[#4c566a] hover:text-[#d8dee9] hover:bg-[#3b4252]/50"}`}
		>
			<div className="flex items-center gap-3 w-full min-w-0">
				{isEditing ? (
					<input
						{...inputProps}
						maxLength={64}
						onClick={(e) => e.stopPropagation()}
						className="sidebar-header bg-[#2e3440] border-b-2 border-[#88c0d0] text-[#eceff4] text-[12px] py-px px-1 outline-none flex-1 min-w-0"
					/>
				) : (
					<span className="sidebar-header text-[13px] font-medium tracking-wide truncate flex-1 min-w-0">
						{name}
					</span>
				)}
				{!isEditing && cwd && (
					<span
						className="text-[9px] text-[#4c566a] truncate min-w-0 font-mono opacity-60"
						title={cwd}
					>
						{cwd}
					</span>
				)}
				{attentionCount > 0 && (
					<span
						title={`${attentionCount} pane(s) need attention`}
						className="text-[10px] leading-none px-1.5 py-0.5 rounded text-[#81a1c1] shrink-0"
					>
						{attentionCount}
					</span>
				)}
				<svg
					width="10"
					height="10"
					viewBox="0 0 10 10"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					className={`shrink-0 transition-transform duration-300 ${isCollapsed ? "-rotate-90" : ""}`}
				>
					<path d="M2 3L5 6L8 3" />
				</svg>
			</div>
		</button>
	);
}

export function NordEntry({
	label,
	title,
	agentStatus: _agentStatus,
	isFocused,
	onClick,
	onContextMenu,
	paneId,
}: BasePaneEntryProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			onContextMenu={onContextMenu}
			data-pane-id={paneId}
			className={`sidebar-item flex flex-col gap-0.5 w-full mt-0.5 text-left pl-4 pr-4 py-2 border-none border-b border-[#3b4252]/50 cursor-pointer transition-all ${isFocused ? "sidebar-pane-focused text-[#eceff4] bg-[#434c5e]" : "bg-transparent text-[#d8dee9] hover:text-[#eceff4] hover:bg-[#3b4252]"}`}
		>
			<span className="text-[12px] truncate">{title || label}</span>
			{title && (
				<span className="text-[9px] truncate pl-4 opacity-60 text-[#4c566a]">
					{label}
				</span>
			)}
		</button>
	);
}

// --- Catppuccin ---
export function CatppuccinHeader({
	name,
	cwd,
	isActive,
	isCollapsed,
	attentionCount,
	isEditing,
	inputProps,
	onClick,
	onContextMenu,
}: BaseWorkspaceHeaderProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			onContextMenu={onContextMenu}
			className={`sidebar-item flex flex-col gap-0.5 w-full px-3 py-3.5 text-left cursor-pointer border-none transition-all ${isActive ? "text-[#cdd6f4] bg-[#313244]" : "bg-transparent text-[#7f849c] hover:text-[#bac2de] hover:bg-[#313244]/50"}`}
		>
			<div className="flex items-center gap-2 w-full min-w-0">
				<div
					className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${isActive ? "bg-[#cba6f7]" : "bg-[#585b70]"}`}
				/>
				{isEditing ? (
					<input
						{...inputProps}
						maxLength={64}
						onClick={(e) => e.stopPropagation()}
						className="sidebar-header bg-[#1e1e2e] border-2 border-[#cba6f7] rounded-lg text-[#cdd6f4] text-[12px] py-0.5 px-2 outline-none flex-1 min-w-0"
					/>
				) : (
					<span className="sidebar-header text-[13px] font-semibold truncate flex-1 min-w-0">
						{name}
					</span>
				)}
				{!isEditing && cwd && (
					<span
						className="text-[9px] text-[#6c7086] truncate min-w-0 font-mono opacity-60"
						title={cwd}
					>
						{cwd}
					</span>
				)}
				{attentionCount > 0 && (
					<span
						title={`${attentionCount} pane(s) need attention`}
						className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#cba6f7]/20 text-[#cba6f7] shrink-0"
					>
						{attentionCount}
					</span>
				)}
				<svg
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2.5"
					strokeLinecap="round"
					strokeLinejoin="round"
					className={`shrink-0 transition-transform duration-300 ${isCollapsed ? "-rotate-90" : ""}`}
				>
					<path d="M6 9l6 6 6-6" />
				</svg>
			</div>
		</button>
	);
}

export function CatppuccinEntry({
	label,
	title,
	agentStatus: _agentStatus,
	isFocused,
	onClick,
	onContextMenu,
	paneId,
}: BasePaneEntryProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			onContextMenu={onContextMenu}
			data-pane-id={paneId}
			className={`sidebar-item flex flex-col gap-0.5 w-[calc(100%-12px)] mx-[6px] mt-1 text-left pl-4 pr-3 py-1.5 border-none border-b border-[#313244]/50 cursor-pointer rounded-lg transition-all ${isFocused ? "sidebar-pane-focused text-[#cdd6f4] bg-[#45475a]" : "bg-transparent text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#313244]"}`}
		>
			<span className="text-[11px] font-medium truncate">{title || label}</span>
			{title && (
				<span className="text-[9px] truncate pl-4 opacity-60 text-[#6c7086]">
					{label}
				</span>
			)}
		</button>
	);
}

// --- Gruvbox ---
export function GruvboxHeader({
	name,
	cwd,
	isActive,
	isCollapsed,
	attentionCount,
	isEditing,
	inputProps,
	onClick,
	onContextMenu,
}: BaseWorkspaceHeaderProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			onContextMenu={onContextMenu}
			className={`sidebar-item flex flex-col gap-0 w-full px-2 py-3.5 text-left cursor-pointer border-none transition-none ${isActive ? "text-[#ebdbb2] bg-[#3c3836]" : "bg-transparent text-[#a89984] hover:text-[#ebdbb2] hover:bg-[#3c3836]"}`}
		>
			<div className="flex items-center gap-2 w-full min-w-0">
				<span className="font-mono text-[11px] shrink-0 text-[#fe8019]">
					{isCollapsed ? "+" : "-"}
				</span>
				{isEditing ? (
					<input
						{...inputProps}
						maxLength={64}
						onClick={(e) => e.stopPropagation()}
						className="sidebar-header font-mono bg-[#282828] border-none text-[#ebdbb2] text-[11px] py-px px-0 outline-none flex-1 min-w-0"
					/>
				) : (
					<span className="sidebar-header font-mono text-[13px] font-bold uppercase truncate flex-1 min-w-0">
						[{name}]
					</span>
				)}
				{!isEditing && cwd && (
					<span
						className="text-[9px] text-[#928374] truncate min-w-0 font-mono opacity-60"
						title={cwd}
					>
						{cwd}
					</span>
				)}
				{attentionCount > 0 && (
					<span
						title={`${attentionCount} pane(s) need attention`}
						className="font-mono text-[10px] text-[#83a598] shrink-0"
					>
						({attentionCount})
					</span>
				)}
			</div>
		</button>
	);
}

export function GruvboxEntry({
	label,
	title,
	agentStatus: _agentStatus,
	isFocused,
	onClick,
	onContextMenu,
	paneId,
}: BasePaneEntryProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			onContextMenu={onContextMenu}
			data-pane-id={paneId}
			className={`sidebar-item flex flex-col gap-0.5 w-full mt-0.5 text-left pl-4 pr-2 py-1.5 border-none border-b border-[#3c3836]/60 cursor-pointer transition-none font-mono text-[11px] ${isFocused ? "sidebar-pane-focused text-[#ebdbb2] bg-[#504945]" : "bg-transparent text-[#928374] hover:text-[#a89984] hover:bg-[#3c3836]"}`}
		>
			<span className="truncate">{title || label}</span>
			{title && (
				<span className="text-[9px] truncate pl-4 opacity-60 text-[#928374]">
					{label}
				</span>
			)}
		</button>
	);
}

// --- Monokai ---
export function MonokaiHeader({
	name,
	cwd,
	isActive,
	isCollapsed,
	attentionCount,
	isEditing,
	inputProps,
	onClick,
	onContextMenu,
}: BaseWorkspaceHeaderProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			onContextMenu={onContextMenu}
			className={`sidebar-item flex flex-col gap-0.5 w-full px-3 py-3.5 text-left cursor-pointer border-none transition-colors ${isActive ? "text-[#f8f8f2] bg-[#3e3d32]" : "bg-transparent text-[#75715e] hover:text-[#f8f8f2] hover:bg-[#3e3d32]/50"}`}
		>
			<div className="flex items-center gap-2 w-full min-w-0">
				<svg
					width="8"
					height="8"
					viewBox="0 0 10 10"
					fill="currentColor"
					className={`shrink-0 transition-transform ${isCollapsed ? "-rotate-90" : ""} ${isActive ? "text-[#a6e22e]" : "text-[#75715e]"}`}
				>
					<path d="M0 0L10 5L0 10Z" />
				</svg>
				{isEditing ? (
					<input
						{...inputProps}
						maxLength={64}
						onClick={(e) => e.stopPropagation()}
						className="sidebar-header bg-[#272822] border-b border-[#f92672] text-[#f8f8f2] text-[11px] py-px px-1 outline-none flex-1 min-w-0"
					/>
				) : (
					<span className="sidebar-header text-[13px] font-medium truncate flex-1 min-w-0">
						{name}
					</span>
				)}
				{!isEditing && cwd && (
					<span
						className="text-[9px] text-[#75715e] truncate min-w-0 font-mono opacity-60"
						title={cwd}
					>
						{cwd}
					</span>
				)}
				{attentionCount > 0 && (
					<span
						title={`${attentionCount} pane(s) need attention`}
						className="text-[10px] px-1.5 py-0.5 rounded bg-[#49483e] text-[#66d9ef] shrink-0"
					>
						{attentionCount}
					</span>
				)}
			</div>
		</button>
	);
}

export function MonokaiEntry({
	label,
	title,
	agentStatus: _agentStatus,
	isFocused,
	onClick,
	onContextMenu,
	paneId,
}: BasePaneEntryProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			onContextMenu={onContextMenu}
			data-pane-id={paneId}
			className={`sidebar-item flex flex-col gap-0.5 w-full mt-0.5 text-left pl-4 pr-3 py-1.5 border-none border-b border-[#3e3d32]/50 cursor-pointer transition-colors ${isFocused ? "sidebar-pane-focused text-[#f8f8f2] border-l-[3px] border-[#f92672] bg-[#3e3d32]/80" : "bg-transparent text-[#75715e] hover:text-[#f8f8f2] border-l-[3px] border-transparent hover:bg-[#3e3d32]/30"}`}
		>
			<span className="text-[11px] truncate italic">{title || label}</span>
			{title && (
				<span className="text-[9px] truncate pl-4 opacity-60 text-[#75715e]">
					{label}
				</span>
			)}
		</button>
	);
}

// --- Everforest ---
export function EverforestHeader({
	name,
	cwd,
	isActive,
	isCollapsed,
	attentionCount,
	isEditing,
	inputProps,
	onClick,
	onContextMenu,
}: BaseWorkspaceHeaderProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			onContextMenu={onContextMenu}
			className={`sidebar-item flex flex-col gap-0.5 w-full px-3 py-3.5 text-left cursor-pointer border-none transition-colors ${isActive ? "text-[#d3c6aa] bg-[#3a454a]" : "bg-transparent text-[#859289] hover:text-[#d3c6aa] hover:bg-[#343f44]"}`}
		>
			<div className="flex items-center gap-2 w-full min-w-0">
				<div
					className={`w-1.5 h-1.5 rotate-45 shrink-0 transition-transform ${isActive ? "bg-[#a7c080] scale-125" : "bg-[#4a555b]"} ${isCollapsed ? "opacity-50" : ""}`}
				/>
				{isEditing ? (
					<input
						{...inputProps}
						maxLength={64}
						onClick={(e) => e.stopPropagation()}
						className="sidebar-header bg-[#2d353b] border border-[#a7c080] text-[#d3c6aa] text-[12px] py-px px-1 outline-none flex-1 min-w-0"
					/>
				) : (
					<span className="sidebar-header text-[13px] font-medium truncate flex-1 min-w-0">
						{name}
					</span>
				)}
				{!isEditing && cwd && (
					<span
						className="text-[9px] text-[#859289] truncate min-w-0 font-mono opacity-60"
						title={cwd}
					>
						{cwd}
					</span>
				)}
				{attentionCount > 0 && (
					<span
						title={`${attentionCount} pane(s) need attention`}
						className="text-[10px] px-1.5 py-0.5 rounded text-[#d699b6] shrink-0"
					>
						{attentionCount}
					</span>
				)}
			</div>
		</button>
	);
}

export function EverforestEntry({
	label,
	title,
	agentStatus: _agentStatus,
	isFocused,
	onClick,
	onContextMenu,
	paneId,
}: BasePaneEntryProps) {
	return (
		<button
			type="button"
			onClick={onClick}
			onContextMenu={onContextMenu}
			data-pane-id={paneId}
			className={`sidebar-item flex flex-col gap-0.5 w-full mt-0.5 text-left pl-4 pr-3 py-2 border-none border-b border-[#3d474d]/40 cursor-pointer transition-colors ${isFocused ? "sidebar-pane-focused text-[#d3c6aa] bg-[#3a454a]" : "bg-transparent text-[#9da9a0] hover:text-[#d3c6aa] hover:bg-[#343f44]"}`}
		>
			<span className="text-[11px] truncate">{title || label}</span>
			{title && (
				<span className="text-[9px] truncate pl-4 opacity-60">
					{label}
				</span>
			)}
		</button>
	);
}

export function DefaultDarkGitInfo({ branch, pr }: BaseWorkspaceGitInfoProps) {
	if (!branch && !pr) return null;
	return (
		<div className="mt-0.5 mb-1.5 bg-[#0e1628]/80 px-4 py-1.5">
			<div className="flex items-center justify-between gap-2">
				{branch && (
					<div className="flex items-center gap-1 min-w-0">
						<svg
							width="8"
							height="8"
							viewBox="0 0 16 16"
							fill="currentColor"
							className="text-[#5a6380] shrink-0"
						>
							<path d="M11.5 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM9 5.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zM4.5 8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM2 10.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z" />
							<path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h1V4H7A3.5 3.5 0 0 0 3.5 7.5v2h1v-2z" />
						</svg>
						<span className="text-[10px] font-medium text-[#8892b0] truncate italic opacity-80">
							{branch}
						</span>
					</div>
				)}
				{pr && (
					<div className="text-[9px] font-bold px-1.5 py-0.5 rounded-[4px] bg-[#232946] text-[#e0e0e0] shrink-0">
						#{pr.number}
					</div>
				)}
			</div>
		</div>
	);
}

export function DraculaGitInfo({ branch, pr }: BaseWorkspaceGitInfoProps) {
	if (!branch && !pr) return null;
	return (
		<div className="mt-0.5 mb-1.5 bg-[#1e1f29]/80 px-4 py-1.5">
			<div className="flex items-center justify-between gap-2">
				{branch && (
					<div className="flex items-center gap-1 min-w-0">
						<svg
							width="8"
							height="8"
							viewBox="0 0 16 16"
							fill="currentColor"
							className="text-[#6272a4] shrink-0"
						>
							<path d="M11.5 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM9 5.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zM4.5 8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM2 10.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z" />
							<path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h1V4H7A3.5 3.5 0 0 0 3.5 7.5v2h1v-2z" />
						</svg>
						<span className="text-[10px] font-medium text-[#50fa7b] truncate italic opacity-80">
							{branch}
						</span>
					</div>
				)}
				{pr && (
					<div className="text-[9px] font-bold px-1.5 py-0.5 rounded-[4px] bg-[#bd93f9]/20 text-[#bd93f9] shrink-0">
						#{pr.number}
					</div>
				)}
			</div>
		</div>
	);
}

export function TokyoNightGitInfo({ branch, pr }: BaseWorkspaceGitInfoProps) {
	if (!branch && !pr) return null;
	return (
		<div className="mt-0.5 mb-1.5 bg-[#13141f]/80 px-4 py-1.5">
			<div className="flex items-center justify-between gap-2">
				{branch && (
					<div className="flex items-center gap-1 min-w-0">
						<svg
							width="8"
							height="8"
							viewBox="0 0 16 16"
							fill="currentColor"
							className="text-[#3b4261] shrink-0"
						>
							<path d="M11.5 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM9 5.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zM4.5 8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM2 10.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z" />
							<path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h1V4H7A3.5 3.5 0 0 0 3.5 7.5v2h1v-2z" />
						</svg>
						<span className="text-[10px] font-medium text-[#9ece6a] truncate italic opacity-80">
							{branch}
						</span>
					</div>
				)}
				{pr && (
					<div className="text-[9px] font-bold px-1.5 py-0.5 rounded-[4px] bg-[#292e42] text-[#7dcfff] shrink-0">
						#{pr.number}
					</div>
				)}
			</div>
		</div>
	);
}

export function NordGitInfo({ branch, pr }: BaseWorkspaceGitInfoProps) {
	if (!branch && !pr) return null;
	return (
		<div className="mt-0.5 mb-1.5 bg-[#242933]/60 px-5 py-2">
			<div className="flex items-center justify-between gap-2">
				{branch && (
					<div className="flex items-center gap-1 min-w-0">
						<svg
							width="8"
							height="8"
							viewBox="0 0 16 16"
							fill="currentColor"
							className="text-[#4c566a] shrink-0"
						>
							<path d="M11.5 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM9 5.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zM4.5 8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM2 10.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z" />
							<path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h1V4H7A3.5 3.5 0 0 0 3.5 7.5v2h1v-2z" />
						</svg>
						<span className="text-[10px] font-medium text-[#a3be8c] truncate italic opacity-80">
							{branch}
						</span>
					</div>
				)}
				{pr && (
					<div className="text-[9px] font-bold px-1.5 py-0.5 rounded-[4px] text-[#ebcb8b] shrink-0">
						#{pr.number}
					</div>
				)}
			</div>
		</div>
	);
}

export function CatppuccinGitInfo({ branch, pr }: BaseWorkspaceGitInfoProps) {
	if (!branch && !pr) return null;
	return (
		<div className="mt-0.5 mb-1.5 bg-[#11111b]/80 px-4 py-1.5">
			<div className="flex items-center justify-between gap-2">
				{branch && (
					<div className="flex items-center gap-1 min-w-0">
						<svg
							width="8"
							height="8"
							viewBox="0 0 16 16"
							fill="currentColor"
							className="text-[#6c7086] shrink-0"
						>
							<path d="M11.5 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM9 5.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zM4.5 8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM2 10.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z" />
							<path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h1V4H7A3.5 3.5 0 0 0 3.5 7.5v2h1v-2z" />
						</svg>
						<span className="text-[10px] font-medium text-[#a6e3a1] truncate italic opacity-80">
							{branch}
						</span>
					</div>
				)}
				{pr && (
					<div className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-[#cba6f7]/15 text-[#cba6f7] shrink-0">
						#{pr.number}
					</div>
				)}
			</div>
		</div>
	);
}

export function GruvboxGitInfo({ branch, pr }: BaseWorkspaceGitInfoProps) {
	if (!branch && !pr) return null;
	return (
		<div className="mt-0.5 mb-1.5 bg-[#141617]/80 px-3 py-1">
			<div className="flex items-center justify-between gap-2">
				{branch && (
					<div className="flex items-center gap-1 min-w-0">
						<svg
							width="8"
							height="8"
							viewBox="0 0 16 16"
							fill="currentColor"
							className="text-[#928374] shrink-0"
						>
							<path d="M11.5 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM9 5.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zM4.5 8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM2 10.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z" />
							<path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h1V4H7A3.5 3.5 0 0 0 3.5 7.5v2h1v-2z" />
						</svg>
						<span className="font-mono text-[10px] text-[#b8bb26] truncate italic opacity-80">
							[{branch}]
						</span>
					</div>
				)}
				{pr && <span className="font-mono text-[9px] text-[#fabd2f] shrink-0">#{pr.number}</span>}
			</div>
		</div>
	);
}

export function MonokaiGitInfo({ branch, pr }: BaseWorkspaceGitInfoProps) {
	if (!branch && !pr) return null;
	return (
		<div className="mt-0.5 mb-1.5 bg-[#1a1b16]/80 px-4 py-1.5">
			<div className="flex items-center justify-between gap-2">
				{branch && (
					<div className="flex items-center gap-1 min-w-0">
						<svg
							width="8"
							height="8"
							viewBox="0 0 16 16"
							fill="currentColor"
							className="text-[#75715e] shrink-0"
						>
							<path d="M11.5 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM9 5.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zM4.5 8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM2 10.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z" />
							<path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h1V4H7A3.5 3.5 0 0 0 3.5 7.5v2h1v-2z" />
						</svg>
						<span className="text-[10px] font-medium text-[#e6db74] truncate italic opacity-80">
							{branch}
						</span>
					</div>
				)}
				{pr && <span className="text-[9px] font-bold text-[#ae81ff] shrink-0">#{pr.number}</span>}
			</div>
		</div>
	);
}

export function EverforestGitInfo({ branch, pr }: BaseWorkspaceGitInfoProps) {
	if (!branch && !pr) return null;
	return (
		<div className="mt-0.5 mb-1.5 bg-[#1e2529]/70 px-4 py-2">
			<div className="flex items-center justify-between gap-2">
				{branch && (
					<div className="flex items-center gap-1 min-w-0">
						<svg
							width="8"
							height="8"
							viewBox="0 0 16 16"
							fill="currentColor"
							className="text-[#859289] shrink-0"
						>
							<path d="M11.5 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM9 5.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zM4.5 8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM2 10.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z" />
							<path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h1V4H7A3.5 3.5 0 0 0 3.5 7.5v2h1v-2z" />
						</svg>
						<span className="text-[10px] font-medium text-[#83c092] truncate italic opacity-80">
							{branch}
						</span>
					</div>
				)}
				{pr && <span className="text-[9px] font-bold text-[#dbbc7f] shrink-0">#{pr.number}</span>}
			</div>
		</div>
	);
}
