import { AgentStatusIndicator } from "../AgentStatusIndicator";
import type { BasePaneEntryProps, BaseWorkspaceHeaderProps } from "../types";

// --- Default Dark ---
export function DefaultDarkHeader({
	name,
	isActive,
	isCollapsed,
	paneCount,
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
			className={`sidebar-item flex items-center gap-2 w-full px-3 text-left cursor-pointer border-none transition-colors duration-150 ${isActive ? "text-[#e0e0e0] bg-[#232946]/5" : "bg-transparent text-[#8892b0] hover:text-[#e0e0e0]"}`}
		>
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
				<span className="sidebar-header text-[11px] font-medium truncate flex-1 min-w-0">
					{name}
				</span>
			)}
			{paneCount > 1 && (
				<span className="text-[9px] leading-none px-1.5 py-0.5 rounded-sm bg-[#232946] shrink-0 border border-[#2a2f4a]">
					{paneCount}
				</span>
			)}
		</button>
	);
}

export function DefaultDarkEntry({
	label,
	cwd,
	branch,
	pr,
	agentStatus,
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
			className={`sidebar-item flex flex-col gap-0.5 w-full text-left pl-7 pr-3 py-1.5 border-none cursor-pointer transition-colors duration-150 ${isFocused ? "sidebar-pane-focused text-[#e0e0e0] border-l-2 border-[#6c63ff]" : "bg-transparent text-[#5a6380] hover:text-[#8892b0] border-l-2 border-transparent"}`}
		>
			<div className="flex items-center gap-1.5 min-w-0 w-full">
				<AgentStatusIndicator status={agentStatus} />
				<span className={`text-[11px] truncate flex-1 ${isFocused ? "font-semibold" : ""}`}>
					{label}
				</span>
			</div>
			<div className="flex items-center min-w-0 w-full">
				<span className="text-[9px] text-[#5a6380] truncate flex-1 opacity-70">{cwd}</span>
			</div>
			{(branch || pr) && (
				<div className="flex items-center gap-2 min-w-0 w-full pl-0">
					{branch && (
						<span className="text-[9px] font-mono text-[#8892b0] truncate min-w-0 flex-1 opacity-70">
							 {branch}
						</span>
					)}
					{pr && (
						<span className="text-[9px] font-mono bg-[#232946] px-1 rounded-sm text-[#8892b0] shrink-0 ml-auto">
							#{pr.number}
						</span>
					)}
				</div>
			)}
		</button>
	);
}

// --- Dracula ---
export function DraculaHeader({
	name,
	isActive,
	isCollapsed,
	paneCount,
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
			className={`sidebar-item flex items-center gap-2 w-full px-3 py-1.5 text-left cursor-pointer border-none rounded-t-md transition-all ${isActive ? "text-[#f8f8f2] bg-[#44475a]/40 border-b border-[#44475a]" : "bg-transparent text-[#6272a4] hover:text-[#f8f8f2] hover:bg-[#44475a]/20"}`}
		>
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
				<span className="sidebar-header text-[12px] font-bold tracking-wide truncate flex-1 min-w-0">
					{name}
				</span>
			)}
			{paneCount > 1 && (
				<span className="text-[10px] leading-none font-bold px-1.5 py-0.5 rounded-full bg-[#bd93f9]/20 text-[#bd93f9] shrink-0">
					{paneCount}
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
		</button>
	);
}

export function DraculaEntry({
	label,
	cwd,
	branch,
	pr,
	agentStatus,
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
			className={`sidebar-item flex flex-col gap-0.5 w-[calc(100%-8px)] mx-1 mt-1 text-left pl-6 pr-2 py-1.5 border-none cursor-pointer rounded-md transition-all ${isFocused ? "sidebar-pane-focused text-[#f8f8f2] bg-[#44475a]/30" : "bg-transparent text-[#6272a4] hover:text-[#f8f8f2] hover:bg-[#44475a]/10"}`}
		>
			<div className="flex items-center gap-1.5 min-w-0 w-full">
				<AgentStatusIndicator status={agentStatus} />
				<span className="text-[11px] truncate font-medium flex-1">{label}</span>
			</div>
			<div className="flex items-center gap-2 min-w-0 w-full">
				<span className="text-[9px] truncate flex-1 font-mono opacity-80">{cwd}</span>
			</div>
			{(branch || pr) && (
				<div className="flex items-center gap-2 min-w-0 w-full pl-0">
					{branch && (
						<span className="text-[9px] text-[#50fa7b] font-mono truncate min-w-0 flex-1">
							{branch}
						</span>
					)}
					{pr && <span className="text-[9px] text-[#ffb86c] font-mono shrink-0 ml-auto">#{pr.number}</span>}
				</div>
			)}
		</button>
	);
}

// --- Tokyo Night ---
export function TokyoNightHeader({
	name,
	isActive,
	isCollapsed,
	paneCount,
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
			className={`sidebar-item flex items-center gap-2 w-full px-3 py-1 text-left cursor-pointer border-none transition-all ${isActive ? "text-[#c0caf5] bg-[#1f2335]" : "bg-transparent text-[#565f89] hover:text-[#a9b1d6] hover:bg-[#1f2335]/50"}`}
		>
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
					className={`sidebar-header text-[11px] font-bold tracking-wider uppercase truncate flex-1 min-w-0 ${isActive ? "drop-shadow-[0_0_8px_rgba(122,162,247,0.5)] text-[#7aa2f7]" : ""}`}
				>
					{name}
				</span>
			)}
			{paneCount > 1 && (
				<span className="text-[9px] leading-none px-1.5 py-0.5 rounded-sm bg-[#1a1b26] border border-[#292e42] text-[#7dcfff] shrink-0">
					{paneCount}
				</span>
			)}
		</button>
	);
}

export function TokyoNightEntry({
	label,
	cwd,
	branch,
	pr,
	agentStatus,
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
			className={`sidebar-item flex flex-col gap-0.5 w-full text-left pl-6 pr-3 py-1.5 border-none cursor-pointer transition-all ${isFocused ? "sidebar-pane-focused text-[#c0caf5] border-l-2 border-[#bb9af7] bg-[#1f2335]/80" : "bg-transparent text-[#565f89] hover:text-[#a9b1d6] border-l-2 border-transparent hover:bg-[#1f2335]/30"}`}
		>
			<div className="flex items-center gap-1.5 min-w-0 w-full">
				<AgentStatusIndicator status={agentStatus} />
				<span className="text-[11px] truncate flex-1">{label}</span>
			</div>
			<div className="flex items-center min-w-0 w-full">
				<span className="text-[9px] truncate flex-1 font-mono opacity-70">{cwd}</span>
			</div>
			{(branch || pr) && (
				<div className="flex items-center gap-2 min-w-0 w-full pl-0">
					{branch && (
						<span className="text-[9px] text-[#9ece6a] font-mono truncate min-w-0 flex-1">
							{branch}
						</span>
					)}
					{pr && (
						<span className="text-[9px] font-mono bg-[#1a1b26] text-[#ff9e64] px-1 rounded-sm border border-[#292e42] shrink-0 ml-auto">
							PR:{pr.number}
						</span>
					)}
				</div>
			)}
		</button>
	);
}

// --- Nord ---
export function NordHeader({
	name,
	isActive,
	isCollapsed,
	paneCount,
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
			className={`sidebar-item flex items-center gap-3 w-full px-4 py-2 text-left cursor-pointer border-none transition-all ${isActive ? "text-[#eceff4] bg-[#3b4252]" : "bg-transparent text-[#4c566a] hover:text-[#d8dee9] hover:bg-[#3b4252]/50"}`}
		>
			{isEditing ? (
				<input
					{...inputProps}
					maxLength={64}
					onClick={(e) => e.stopPropagation()}
					className="sidebar-header bg-[#2e3440] border-b-2 border-[#88c0d0] text-[#eceff4] text-[12px] py-px px-1 outline-none flex-1 min-w-0"
				/>
			) : (
				<span className="sidebar-header text-[12px] font-medium tracking-wide truncate flex-1 min-w-0">
					{name}
				</span>
			)}
			{paneCount > 1 && (
				<span className="text-[10px] leading-none px-1.5 py-0.5 rounded text-[#81a1c1] shrink-0">
					{paneCount}
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
		</button>
	);
}

export function NordEntry({
	label,
	cwd,
	branch,
	pr,
	agentStatus,
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
			className={`sidebar-item flex flex-col gap-0.5 w-full text-left pl-8 pr-4 py-2 border-none cursor-pointer transition-all ${isFocused ? "sidebar-pane-focused text-[#eceff4] bg-[#434c5e]" : "bg-transparent text-[#d8dee9] hover:text-[#eceff4] hover:bg-[#3b4252]"}`}
		>
			<div className="flex items-center gap-2 min-w-0 w-full">
				{isFocused && <span className="w-1.5 h-1.5 rounded-full bg-[#88c0d0] shrink-0" />}
				<AgentStatusIndicator status={agentStatus} />
				<span className="text-[12px] truncate flex-1">{label}</span>
			</div>
			<div className="flex items-center min-w-0 w-full pl-3.5">
				<span className="text-[9px] truncate flex-1 text-[#4c566a]">{cwd}</span>
			</div>
			{(branch || pr) && (
				<div className="flex items-center gap-2 min-w-0 w-full pl-3.5">
					{branch && (
						<span className="text-[9px] text-[#a3be8c] truncate min-w-0 flex-1">
							{branch}
						</span>
					)}
					{pr && <span className="text-[9px] text-[#ebcb8b] shrink-0 ml-auto">#{pr.number}</span>}
				</div>
			)}
		</button>
	);
}

// --- Catppuccin ---
export function CatppuccinHeader({
	name,
	isActive,
	isCollapsed,
	paneCount,
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
			className={`sidebar-item flex items-center gap-2 w-full px-3 py-2 text-left cursor-pointer border-none transition-all ${isActive ? "text-[#cdd6f4] bg-[#313244]" : "bg-transparent text-[#7f849c] hover:text-[#bac2de] hover:bg-[#313244]/50"}`}
		>
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
				<span className="sidebar-header text-[12px] font-semibold truncate flex-1 min-w-0">
					{name}
				</span>
			)}
			{paneCount > 1 && (
				<span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#cba6f7]/20 text-[#cba6f7] shrink-0">
					{paneCount}
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
		</button>
	);
}

export function CatppuccinEntry({
	label,
	cwd,
	branch,
	pr,
	agentStatus,
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
			className={`sidebar-item flex flex-col gap-0.5 w-[calc(100%-12px)] mx-[6px] mt-1 text-left pl-7 pr-3 py-1.5 border-none cursor-pointer rounded-lg transition-all ${isFocused ? "sidebar-pane-focused text-[#cdd6f4] bg-[#45475a]" : "bg-transparent text-[#a6adc8] hover:text-[#cdd6f4] hover:bg-[#313244]"}`}
		>
			<div className="flex items-center gap-2 min-w-0 w-full">
				<AgentStatusIndicator status={agentStatus} />
				<span className="text-[11px] font-medium truncate flex-1">{label}</span>
			</div>
			<div className="flex items-center min-w-0 w-full pl-0">
				<span className="text-[9px] truncate flex-1 text-[#6c7086]">{cwd}</span>
			</div>
			{(branch || pr) && (
				<div className="flex items-center gap-2 min-w-0 w-full pl-0">
					{branch && (
						<span className="text-[9px] text-[#a6e3a1] font-medium truncate min-w-0 flex-1">
							 {branch}
						</span>
					)}
					{pr && (
						<span className="text-[9px] font-bold bg-[#f9e2af]/20 text-[#f9e2af] px-1.5 rounded-md shrink-0 ml-auto">
							PR {pr.number}
						</span>
					)}
				</div>
			)}
		</button>
	);
}

// --- Gruvbox ---
export function GruvboxHeader({
	name,
	isActive,
	isCollapsed,
	paneCount,
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
			className={`sidebar-item flex items-center gap-2 w-full px-2 py-1 text-left cursor-pointer border-none transition-none ${isActive ? "text-[#ebdbb2] bg-[#3c3836]" : "bg-transparent text-[#a89984] hover:text-[#ebdbb2] hover:bg-[#3c3836]"}`}
		>
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
				<span className="sidebar-header font-mono text-[11px] font-bold uppercase truncate flex-1 min-w-0">
					[{name}]
				</span>
			)}
			{paneCount > 1 && (
				<span className="font-mono text-[10px] text-[#83a598] shrink-0">({paneCount})</span>
			)}
		</button>
	);
}

export function GruvboxEntry({
	label,
	cwd,
	branch,
	pr,
	agentStatus,
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
			className={`sidebar-item flex flex-col gap-0 w-full text-left pl-6 pr-2 py-1.5 border-none cursor-pointer transition-none ${isFocused ? "sidebar-pane-focused text-[#ebdbb2] bg-[#504945]" : "bg-transparent text-[#928374] hover:text-[#a89984] hover:bg-[#3c3836]"}`}
		>
			<div className="flex items-center gap-2 min-w-0 w-full font-mono text-[11px]">
				<span className="shrink-0">{isFocused ? "->" : "  "}</span>
				<AgentStatusIndicator status={agentStatus} gruvbox />
				<span className="truncate flex-1">{label}</span>
			</div>
			<div className="flex items-center min-w-0 w-full pl-6 font-mono">
				<span className="text-[9px] truncate flex-1">{cwd}</span>
			</div>
			{(branch || pr) && (
				<div className="flex items-center gap-2 min-w-0 w-full pl-6 font-mono">
					{branch && (
						<span className="text-[9px] text-[#b8bb26] truncate min-w-0 flex-1">
							[{branch}]
						</span>
					)}
					{pr && <span className="text-[9px] text-[#fabd2f] shrink-0 ml-auto">#{pr.number}</span>}
				</div>
			)}
		</button>
	);
}

// --- Monokai ---
export function MonokaiHeader({
	name,
	isActive,
	isCollapsed,
	paneCount,
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
			className={`sidebar-item flex items-center gap-2 w-full px-3 py-1.5 text-left cursor-pointer border-none transition-colors ${isActive ? "text-[#f8f8f2] bg-[#3e3d32]" : "bg-transparent text-[#75715e] hover:text-[#f8f8f2] hover:bg-[#3e3d32]/50"}`}
		>
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
				<span className="sidebar-header text-[12px] font-medium truncate flex-1 min-w-0">
					{name}
				</span>
			)}
			{paneCount > 1 && (
				<span className="text-[10px] px-1.5 py-0.5 rounded bg-[#49483e] text-[#66d9ef] shrink-0">
					{paneCount}
				</span>
			)}
		</button>
	);
}

export function MonokaiEntry({
	label,
	cwd,
	branch,
	pr,
	agentStatus,
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
			className={`sidebar-item flex flex-col gap-0.5 w-full text-left pl-7 pr-3 py-1.5 border-none cursor-pointer transition-colors ${isFocused ? "sidebar-pane-focused text-[#f8f8f2] border-l-[3px] border-[#f92672] bg-[#3e3d32]/80" : "bg-transparent text-[#75715e] hover:text-[#f8f8f2] border-l-[3px] border-transparent hover:bg-[#3e3d32]/30"}`}
		>
			<div className="flex items-center gap-2 min-w-0 w-full">
				<AgentStatusIndicator status={agentStatus} />
				<span className="text-[11px] truncate flex-1 italic">{label}</span>
			</div>
			<div className="flex items-center min-w-0 w-full font-mono pl-0">
				<span className="text-[9px] truncate flex-1 text-[#75715e]">{cwd}</span>
			</div>
			{(branch || pr) && (
				<div className="flex items-center gap-2 min-w-0 w-full font-mono pl-0">
					{branch && (
						<span className="text-[9px] text-[#e6db74] truncate min-w-0 flex-1">
							{branch}
						</span>
					)}
					{pr && <span className="text-[9px] text-[#ae81ff] shrink-0 ml-auto">#{pr.number}</span>}
				</div>
			)}
		</button>
	);
}

// --- Everforest ---
export function EverforestHeader({
	name,
	isActive,
	isCollapsed,
	paneCount,
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
			className={`sidebar-item flex items-center gap-2 w-full px-3 py-2 text-left cursor-pointer border-none transition-colors border-b border-[#3d474d] ${isActive ? "text-[#d3c6aa] bg-[#3a454a]" : "bg-transparent text-[#859289] hover:text-[#d3c6aa] hover:bg-[#343f44]"}`}
		>
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
				<span className="sidebar-header text-[12px] font-medium truncate flex-1 min-w-0">
					{name}
				</span>
			)}
			{paneCount > 1 && (
				<span className="text-[10px] px-1.5 py-0.5 rounded text-[#d699b6] shrink-0">
					{paneCount}
				</span>
			)}
		</button>
	);
}

export function EverforestEntry({
	label,
	cwd,
	branch,
	pr,
	agentStatus,
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
			className={`sidebar-item flex flex-col gap-0.5 w-full text-left pl-6 pr-3 py-2 border-none cursor-pointer transition-colors ${isFocused ? "sidebar-pane-focused text-[#d3c6aa] bg-[#3a454a]" : "bg-transparent text-[#9da9a0] hover:text-[#d3c6aa] hover:bg-[#343f44]"}`}
		>
			<div className="flex items-center gap-2 min-w-0 w-full">
				<AgentStatusIndicator status={agentStatus} />
				<span className="text-[11px] truncate flex-1">{label}</span>
			</div>
			<div className="flex items-center min-w-0 w-full pl-0">
				<span className="text-[9px] truncate flex-1 opacity-60">{cwd}</span>
			</div>
			{(branch || pr) && (
				<div className="flex items-center gap-2 min-w-0 w-full pl-0">
					{branch && (
						<span className="text-[9px] text-[#83c092] truncate min-w-0 flex-1">
							{branch}
						</span>
					)}
					{pr && <span className="text-[9px] text-[#dbbc7f] shrink-0 ml-auto">PR-{pr.number}</span>}
				</div>
			)}
		</button>
	);
}
