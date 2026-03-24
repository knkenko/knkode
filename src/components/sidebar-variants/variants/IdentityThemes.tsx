import type {
	BasePaneEntryProps,
	BaseWorkspaceGitInfoProps,
	BaseWorkspaceHeaderProps,
} from "../types";

// --- Matrix ---
export function MatrixHeader({
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
			className={`sidebar-item flex flex-col gap-0.5 w-full px-2 py-3.5 text-left cursor-pointer transition-none border-y border-[#00ff41]/20 bg-[#050505] uppercase font-mono font-bold tracking-widest ${
				isActive
					? "text-[#00ff41] border-[#00ff41]/60 shadow-[0_0_8px_rgba(0,255,65,0.3)]"
					: "text-[#009933] hover:text-[#00ff41] hover:border-[#00ff41]/40"
			}`}
		>
			<div className="flex items-center gap-2 w-full min-w-0">
				<span className="shrink-0">{isCollapsed ? "[+]" : "[-]"}</span>
				{isEditing ? (
					<input
						{...inputProps}
						maxLength={64}
						onClick={(e) => e.stopPropagation()}
						className="sidebar-header bg-black border border-[#00ff41] text-[#00ff41] text-[11px] py-0 px-1 outline-none flex-1 min-w-0 font-mono uppercase"
					/>
				) : (
					<span className="sidebar-header text-[13px] truncate flex-1 min-w-0">{name}</span>
				)}
				{!isEditing && cwd && (
					<span
						className="text-[9px] text-[#006622] truncate min-w-0 font-mono uppercase opacity-60"
						title={cwd}
					>
						{cwd}
					</span>
				)}
				{attentionCount > 0 && (
					<span
						title={`${attentionCount} pane(s) need attention`}
						className="text-[10px] shrink-0 opacity-80"
					>
						{attentionCount}
					</span>
				)}
			</div>
		</button>
	);
}

export function MatrixEntry({
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
			className={`sidebar-item flex flex-col gap-0.5 w-full text-left pl-4 pr-2 py-2 mt-0.5 border-b border-b-[#00ff41]/20 cursor-pointer transition-none font-mono uppercase ${
				isFocused
					? "sidebar-pane-focused text-[#00ff41] bg-[#00ff41]/10 border-l-2 border-l-[#00ff41]"
					: "bg-transparent text-[#009933] hover:text-[#00ff41] border-l-2 border-l-transparent hover:bg-[#00ff41]/5"
			}`}
		>
			<span className="text-[11px] font-bold truncate">{title || label}</span>
			{title && (
				<span className="text-[9px] truncate pl-4 opacity-60 text-[#009933] font-mono">
					&gt; {label}
				</span>
			)}
		</button>
	);
}

// --- Cyberpunk ---
export function CyberpunkHeader({
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
			style={{
				clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)",
			}}
			className={`sidebar-item flex flex-col gap-0.5 w-full px-3 py-3.5 text-left cursor-pointer transition-all border-l-4 font-bold uppercase tracking-widest ${
				isActive
					? "text-[#0d0221] bg-[#ff2a6d] border-[#05d9e8]"
					: "bg-[#130228] text-[#ff6e96] border-[#2a0550] hover:bg-[#2a0550] hover:text-[#05d9e8]"
			}`}
		>
			<div className="flex items-center gap-2 w-full min-w-0">
				<span className={`text-[10px] transition-transform ${isCollapsed ? "" : "rotate-90"}`}>
					❯
				</span>
				{isEditing ? (
					<input
						{...inputProps}
						maxLength={64}
						onClick={(e) => e.stopPropagation()}
						className="sidebar-header bg-black border border-[#05d9e8] text-[#05d9e8] text-[11px] py-0 px-1 outline-none flex-1 min-w-0 font-bold uppercase"
					/>
				) : (
					<span className="sidebar-header text-[13px] truncate flex-1 min-w-0">{name}</span>
				)}
				{!isEditing && cwd && (
					<span
						className="text-[9px] text-[#b967ff] truncate min-w-0 font-bold uppercase opacity-60"
						title={cwd}
					>
						{cwd}
					</span>
				)}
				{attentionCount > 0 && (
					<span
						title={`${attentionCount} pane(s) need attention`}
						className={`text-[9px] px-1 shrink-0 ${
							isActive ? "bg-[#0d0221] text-[#05d9e8]" : "bg-[#2a0550] text-[#05d9e8]"
						}`}
					>
						{attentionCount}
					</span>
				)}
			</div>
		</button>
	);
}

export function CyberpunkEntry({
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
			className={`sidebar-item flex flex-col gap-0.5 w-[calc(100%-8px)] mx-1 mt-1 text-left pl-4 pr-2 py-1.5 cursor-pointer transition-all font-mono border-b border-b-[#ff2a6d]/25 uppercase ${
				isFocused
					? "sidebar-pane-focused text-[#05d9e8] bg-[#2a0550]/50"
					: "bg-transparent text-[#b967ff] hover:text-[#f0e6ff] hover:bg-[#130228]"
			}`}
		>
			<span className="text-[11px] font-bold truncate">{title || label}</span>
			{title && (
				<span className="text-[9px] truncate pl-4 opacity-60 text-[#b967ff] font-mono">
					{label}
				</span>
			)}
		</button>
	);
}

// --- Solana ---
export function SolanaHeader({
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
			className={`sidebar-item flex flex-col gap-0.5 w-full px-3 py-3.5 text-left cursor-pointer transition-all backdrop-blur-sm ${
				isActive
					? "text-[#f5f5ff] bg-gradient-to-r from-[#9945ff]/40 to-[#14f195]/20 shadow-[0_0_12px_rgba(153,69,255,0.3)]"
					: "bg-[#0f0f24]/80 text-[#b380ff] hover:text-[#e0e0f0] hover:bg-[#1e1e3d]"
			}`}
		>
			<div className="flex items-center gap-2 w-full min-w-0">
				<div
					className={`w-3 h-3 rounded-full shrink-0 flex items-center justify-center transition-all ${
						isActive ? "bg-gradient-to-tr from-[#9945ff] to-[#14f195]" : "bg-[#3d3d5c]"
					}`}
				>
					<div
						className={`w-1 h-1 rounded-full bg-[#0c0c1d] transition-transform ${
							isCollapsed ? "scale-0" : "scale-100"
						}`}
					/>
				</div>
				{isEditing ? (
					<input
						{...inputProps}
						maxLength={64}
						onClick={(e) => e.stopPropagation()}
						className="sidebar-header bg-[#0c0c1d] border border-[#14f195] rounded-lg text-[#e0e0f0] text-[12px] py-px px-2 outline-none flex-1 min-w-0"
					/>
				) : (
					<span className="sidebar-header text-[13px] font-semibold truncate flex-1 min-w-0">
						{name}
					</span>
				)}
				{!isEditing && cwd && (
					<span
						className="text-[9px] text-[#b380ff] truncate min-w-0 font-mono opacity-60"
						title={cwd}
					>
						{cwd}
					</span>
				)}
				{attentionCount > 0 && (
					<span
						title={`${attentionCount} pane(s) need attention`}
						className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#14f195]/20 text-[#14f195] shrink-0"
					>
						{attentionCount}
					</span>
				)}
			</div>
		</button>
	);
}

export function SolanaEntry({
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
			className={`sidebar-item flex flex-col gap-0.5 w-[calc(100%-12px)] mx-[6px] mt-1 text-left pl-4 pr-3 py-2 cursor-pointer rounded-2xl transition-all border-b border-b-[#9945ff]/20 ${
				isFocused
					? "sidebar-pane-focused text-[#f5f5ff] bg-[#1e1e3d]/60"
					: "bg-transparent text-[#a6adc8] hover:text-[#e0e0f0] hover:bg-[#0f0f24]"
			}`}
		>
			<span className="text-[11px] font-medium truncate">{title || label}</span>
			{title && (
				<span className="text-[9px] truncate pl-4 opacity-60 text-[#b380ff]/70">{label}</span>
			)}
		</button>
	);
}

// --- Amber ---
export function AmberHeader({
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
			className={`sidebar-item flex flex-col gap-0.5 w-full px-3 py-3.5 text-left cursor-pointer transition-none border-b-2 font-mono uppercase tracking-wider ${
				isActive
					? "text-[#ffb000] bg-[#ffb000]/10 border-[#ffb000] shadow-[0_2px_8px_rgba(255,176,0,0.2)]"
					: "bg-transparent text-[#b37a00] border-[#5c3d10] hover:text-[#ffb000] hover:bg-[#0c0900]"
			}`}
		>
			<div className="flex items-center gap-2 w-full min-w-0">
				<span className="text-[14px] shrink-0 font-bold">{isCollapsed ? "+" : "-"}</span>
				{isEditing ? (
					<input
						{...inputProps}
						maxLength={64}
						onClick={(e) => e.stopPropagation()}
						className="sidebar-header bg-[#080500] border border-[#ffb000] text-[#ffb000] text-[11px] py-px px-1 outline-none flex-1 min-w-0 font-mono uppercase"
					/>
				) : (
					<span className="sidebar-header text-[13px] font-bold truncate flex-1 min-w-0">
						{name}
					</span>
				)}
				{!isEditing && cwd && (
					<span
						className="text-[9px] text-[#b37a00] truncate min-w-0 font-mono uppercase opacity-60"
						title={cwd}
					>
						{cwd}
					</span>
				)}
				{attentionCount > 0 && (
					<span
						title={`${attentionCount} pane(s) need attention`}
						className="text-[10px] px-1 border border-[#b37a00] shrink-0"
					>
						{attentionCount}
					</span>
				)}
			</div>
		</button>
	);
}

export function AmberEntry({
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
			className={`sidebar-item flex flex-col gap-0.5 w-full text-left pl-4 pr-3 py-1.5 mt-0.5 border-b border-b-[#5c3d00]/40 cursor-pointer transition-none font-mono uppercase ${
				isFocused
					? "sidebar-pane-focused text-[#ffe0a0] bg-[#2a1c00]"
					: "bg-transparent text-[#b37a00] hover:text-[#ffb000] hover:bg-[#0c0900]"
			}`}
		>
			<span className="text-[11px] font-bold truncate">{title || label}</span>
			{title && (
				<span className="text-[9px] truncate pl-4 opacity-60 text-[#b37a00] font-mono">
					{label}
				</span>
			)}
		</button>
	);
}

// --- Vaporwave ---
export function VaporwaveHeader({
	name,
	cwd,
	isActive,
	isCollapsed: _isCollapsed,
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
			className={`sidebar-item flex flex-col gap-0.5 w-full px-3 py-3.5 text-left cursor-pointer transition-all border-b font-sans tracking-widest uppercase ${
				isActive
					? "text-[#ff71ce] bg-gradient-to-r from-[#100024] to-[#220050] border-[#01cdfe] shadow-[0_1px_8px_rgba(1,205,254,0.4)]"
					: "bg-transparent text-[#a855f7] border-[#2d1b4e] hover:text-[#f0d0ff] hover:bg-[#100024]"
			}`}
		>
			<div className="flex items-center gap-2 w-full min-w-0">
				<div
					className={`w-2 h-2 rotate-45 shrink-0 transition-all ${
						isActive ? "bg-[#01cdfe] shadow-[0_0_8px_#01cdfe]" : "bg-[#2d1b4e]"
					}`}
				/>
				{isEditing ? (
					<input
						{...inputProps}
						maxLength={64}
						onClick={(e) => e.stopPropagation()}
						className="sidebar-header bg-[#0a0015] border border-[#ff71ce] text-[#f0d0ff] text-[11px] py-px px-1 outline-none flex-1 min-w-0 font-bold uppercase"
					/>
				) : (
					<span className="sidebar-header text-[13px] font-bold italic truncate flex-1 min-w-0">
						{name}
					</span>
				)}
				{!isEditing && cwd && (
					<span
						className="text-[9px] text-[#a855f7] truncate min-w-0 font-mono opacity-60"
						title={cwd}
					>
						{cwd}
					</span>
				)}
				{attentionCount > 0 && (
					<span
						title={`${attentionCount} pane(s) need attention`}
						className="text-[10px] px-1.5 bg-[#ff2d95]/20 text-[#ff2d95] rounded-sm shrink-0 font-bold"
					>
						{attentionCount}
					</span>
				)}
			</div>
		</button>
	);
}

export function VaporwaveEntry({
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
			className={`sidebar-item flex flex-col gap-0.5 w-full text-left pl-4 pr-3 py-2 mt-0.5 border-b border-b-[#2d1b4e]/50 cursor-pointer transition-all font-sans ${
				isFocused
					? "sidebar-pane-focused text-[#ffffff] bg-gradient-to-r from-[#7b2fff]/30 to-transparent border-l-2 border-l-[#ff71ce]"
					: "bg-transparent text-[#ff9de2] hover:text-[#f0d0ff] hover:bg-[#100024] border-l-2 border-l-transparent"
			}`}
		>
			<span className="text-[11px] font-semibold truncate uppercase">{title || label}</span>
			{title && <span className="text-[9px] truncate pl-4 opacity-60 text-[#ff9de2]">{label}</span>}
		</button>
	);
}

// --- Ocean ---
export function OceanHeader({
	name,
	cwd,
	isActive,
	isCollapsed: _isCollapsed,
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
			className={`sidebar-item flex flex-col gap-0.5 w-full px-3 py-3.5 text-left cursor-pointer rounded-t-2xl transition-all duration-500 ${
				isActive
					? "text-[#d0eff8] bg-[#0070a0]/30 shadow-[inset_0_0_12px_rgba(0,200,255,0.2)]"
					: "bg-transparent text-[#2890b8] hover:text-[#a0d8e8] hover:bg-[#051218]"
			}`}
		>
			<div className="flex items-center gap-2 w-full min-w-0">
				<svg
					width="12"
					height="12"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					className={`shrink-0 transition-transform duration-500 ${isActive ? "text-[#00e5b0]" : ""}`}
				>
					<path d="M2 12h4l2-4 4 8 2-4h4" />
				</svg>
				{isEditing ? (
					<input
						{...inputProps}
						maxLength={64}
						onClick={(e) => e.stopPropagation()}
						className="sidebar-header bg-[#020b14] border border-[#00c8ff] rounded-xl text-[#d0eff8] text-[11px] py-px px-2 outline-none flex-1 min-w-0"
					/>
				) : (
					<span className="sidebar-header text-[13px] font-medium truncate flex-1 min-w-0">
						{name}
					</span>
				)}
				{!isEditing && cwd && (
					<span
						className="text-[9px] text-[#2890b8] truncate min-w-0 font-mono opacity-60"
						title={cwd}
					>
						{cwd}
					</span>
				)}
				{attentionCount > 0 && (
					<span
						title={`${attentionCount} pane(s) need attention`}
						className="text-[10px] px-2 rounded-full bg-[#00e5b0]/20 text-[#00e5b0] shrink-0"
					>
						{attentionCount}
					</span>
				)}
			</div>
		</button>
	);
}

export function OceanEntry({
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
			className={`sidebar-item flex flex-col gap-0.5 w-[calc(100%-8px)] mx-1 mt-1 text-left pl-4 pr-3 py-2 border-b border-b-[#0a2838]/50 cursor-pointer rounded-xl transition-all duration-300 ${
				isFocused
					? "sidebar-pane-focused text-[#b0d8e8] bg-[#0a2838]"
					: "bg-transparent text-[#44d8f0] hover:text-[#b0d8e8] hover:bg-[#051218]"
			}`}
		>
			<span className="text-[11px] truncate">{title || label}</span>
			{title && <span className="text-[9px] truncate pl-4 opacity-60 text-[#44d8f0]">{label}</span>}
		</button>
	);
}

// --- Sunset ---
export function SunsetHeader({
	name,
	cwd,
	isActive,
	isCollapsed: _isCollapsed,
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
			className={`sidebar-item flex flex-col gap-0.5 w-full px-3 py-3.5 text-left cursor-pointer border-none transition-all border-l-4 ${
				isActive
					? "text-[#fff0d8] bg-gradient-to-r from-[#e04028]/20 to-transparent border-[#e8a040]"
					: "bg-transparent text-[#d04830] border-transparent hover:text-[#f0d8b0] hover:bg-[#180c0a]"
			}`}
		>
			<div className="flex items-center gap-2 w-full min-w-0">
				<div
					className={`w-3 h-3 rounded-full shrink-0 transition-all ${
						isActive
							? "bg-gradient-to-b from-[#e8a040] to-[#e04028] shadow-[0_0_10px_rgba(232,160,64,0.5)]"
							: "bg-[#4d2418]"
					}`}
				/>
				{isEditing ? (
					<input
						{...inputProps}
						maxLength={64}
						onClick={(e) => e.stopPropagation()}
						className="sidebar-header bg-[#110808] border border-[#e8a040] text-[#fff0d8] text-[11px] py-px px-1 outline-none flex-1 min-w-0"
					/>
				) : (
					<span className="sidebar-header text-[13px] font-bold tracking-wide truncate flex-1 min-w-0">
						{name}
					</span>
				)}
				{!isEditing && cwd && (
					<span
						className="text-[9px] text-[#d04830] truncate min-w-0 font-mono opacity-60"
						title={cwd}
					>
						{cwd}
					</span>
				)}
				{attentionCount > 0 && (
					<span
						title={`${attentionCount} pane(s) need attention`}
						className="text-[10px] px-1.5 rounded-sm bg-[#b83820] text-[#fff0d8] shrink-0 font-bold"
					>
						{attentionCount}
					</span>
				)}
			</div>
		</button>
	);
}

export function SunsetEntry({
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
			className={`sidebar-item flex flex-col gap-0.5 w-full text-left pl-4 pr-3 py-1.5 mt-0.5 border-b border-b-[#9a4530]/30 cursor-pointer transition-all ${
				isFocused
					? "sidebar-pane-focused text-[#f0d0a0] bg-[#301810]"
					: "bg-transparent text-[#e87858] hover:text-[#f0d8b0] hover:bg-[#180c0a]"
			}`}
		>
			<span className="text-[11px] font-medium truncate">{title || label}</span>
			{title && <span className="text-[9px] truncate pl-4 opacity-60 text-[#e87858]">{label}</span>}
		</button>
	);
}

// --- Arctic ---
export function ArcticHeader({
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
			className={`sidebar-item flex flex-col gap-0.5 w-full px-3 py-3.5 text-left cursor-pointer rounded-t-lg transition-all backdrop-blur-md ${
				isActive
					? "text-[#f0f8ff] bg-[#1e3550]/80 shadow-sm border-b border-[#48c8e0]/30"
					: "bg-transparent text-[#78b8d0] border-b border-transparent hover:text-[#c8e4f0] hover:bg-[#1e3550]/40"
			}`}
		>
			<div className="flex items-center gap-2 w-full min-w-0">
				<svg
					width="10"
					height="10"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth="2"
					strokeLinecap="round"
					strokeLinejoin="round"
					className={`shrink-0 transition-transform duration-300 ${
						isCollapsed ? "-rotate-90" : ""
					} ${isActive ? "text-[#70e8cc]" : ""}`}
				>
					<polyline points="6 9 12 15 18 9"></polyline>
				</svg>
				{isEditing ? (
					<input
						{...inputProps}
						maxLength={64}
						onClick={(e) => e.stopPropagation()}
						className="sidebar-header bg-[#050d18] border border-[#a0e0f8] rounded text-[#f0f8ff] text-[11px] py-px px-1 outline-none flex-1 min-w-0"
					/>
				) : (
					<span className="sidebar-header text-[13px] font-medium uppercase tracking-widest truncate flex-1 min-w-0">
						{name}
					</span>
				)}
				{!isEditing && cwd && (
					<span
						className="text-[9px] text-[#78b8d0] truncate min-w-0 font-mono opacity-60"
						title={cwd}
					>
						{cwd}
					</span>
				)}
				{attentionCount > 0 && (
					<span
						title={`${attentionCount} pane(s) need attention`}
						className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#a0e0f8]/20 text-[#a0e0f8] shrink-0 font-medium"
					>
						{attentionCount}
					</span>
				)}
			</div>
		</button>
	);
}

export function ArcticEntry({
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
			className={`sidebar-item flex flex-col gap-0.5 w-[calc(100%-8px)] mx-1 mt-1 text-left pl-4 pr-3 py-2 border-b border-b-[#1e3550]/40 cursor-pointer rounded-md transition-all ${
				isFocused
					? "sidebar-pane-focused text-[#f0f8ff] bg-[#1e3550]/50"
					: "bg-transparent text-[#68d8ee] hover:text-[#c8e4f0] hover:bg-[#1e3550]/20"
			}`}
		>
			<span className="text-[11px] truncate tracking-wide">{title || label}</span>
			{title && <span className="text-[9px] truncate pl-4 opacity-60 text-[#68d8ee]">{label}</span>}
		</button>
	);
}

export function MatrixGitInfo({ branch, pr }: BaseWorkspaceGitInfoProps) {
	if (!branch && !pr) return null;
	return (
		<div className="mt-0.5 mb-1.5 bg-[#010401]/90 px-3 py-1">
			<div className="flex items-center gap-2">
				{branch && (
					<span className="text-[9px] text-[#00ff41] font-mono uppercase italic opacity-80 truncate min-w-0">
						&gt; {branch}
					</span>
				)}
				{pr && (
					<span className="text-[9px] font-mono uppercase border border-[#00ff41]/40 px-1 shrink-0">
						[PR:{pr.number}]
					</span>
				)}
			</div>
		</div>
	);
}

export function CyberpunkGitInfo({ branch, pr }: BaseWorkspaceGitInfoProps) {
	if (!branch && !pr) return null;
	return (
		<div
			className="mt-0.5 mb-1.5 bg-[#08011a]/90 px-4 py-1.5"
			style={{
				clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%)",
			}}
		>
			<div className="flex items-center gap-2">
				{branch && (
					<span className="text-[9px] text-[#05d9e8] font-bold font-mono uppercase italic opacity-80 truncate min-w-0">
						// {branch}
					</span>
				)}
				{pr && (
					<span className="text-[9px] bg-[#fef08a] text-[#0d0221] font-bold px-1 shrink-0">
						#{pr.number}
					</span>
				)}
			</div>
		</div>
	);
}

export function SolanaGitInfo({ branch, pr }: BaseWorkspaceGitInfoProps) {
	if (!branch && !pr) return null;
	return (
		<div className="mt-0.5 mb-1.5 bg-[#06060f]/80 px-5 py-2">
			<div className="flex items-center gap-2">
				{branch && (
					<div className="flex items-center gap-1 min-w-0">
						<svg
							width="8"
							height="8"
							viewBox="0 0 16 16"
							fill="currentColor"
							className="text-[#33e6c0] shrink-0"
						>
							<path d="M11.5 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM9 5.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zM4.5 8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM2 10.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z" />
							<path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h1V4H7A3.5 3.5 0 0 0 3.5 7.5v2h1v-2z" />
						</svg>
						<span className="text-[10px] text-[#33e6c0] font-medium italic opacity-80 truncate">
							{branch}
						</span>
					</div>
				)}
				{pr && (
					<span className="text-[9px] bg-[#9945ff]/20 text-[#c77dff] rounded-md font-bold px-1.5 py-0.5 shrink-0">
						#{pr.number}
					</span>
				)}
			</div>
		</div>
	);
}

export function AmberGitInfo({ branch, pr }: BaseWorkspaceGitInfoProps) {
	if (!branch && !pr) return null;
	return (
		<div className="mt-0.5 mb-1.5 bg-[#060400]/80 px-3 py-1">
			<div className="flex items-center gap-2">
				{branch && (
					<span className="text-[9px] text-[#ffb000] font-mono font-bold uppercase italic opacity-80 truncate min-w-0">
						[{branch}]
					</span>
				)}
				{pr && (
					<span className="text-[9px] text-[#ffb000] font-mono uppercase shrink-0">
						PR:{pr.number}
					</span>
				)}
			</div>
		</div>
	);
}

export function VaporwaveGitInfo({ branch, pr }: BaseWorkspaceGitInfoProps) {
	if (!branch && !pr) return null;
	return (
		<div className="mt-0.5 mb-1.5 bg-[#06000d]/80 px-4 py-1.5">
			<div className="flex items-center gap-2">
				{branch && (
					<div className="flex items-center gap-1 min-w-0">
						<svg
							width="8"
							height="8"
							viewBox="0 0 16 16"
							fill="currentColor"
							className="text-[#05ffa1] shrink-0"
						>
							<path d="M11.5 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM9 5.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zM4.5 8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM2 10.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z" />
							<path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h1V4H7A3.5 3.5 0 0 0 3.5 7.5v2h1v-2z" />
						</svg>
						<span className="text-[9px] text-[#05ffa1] italic opacity-80 truncate">{branch}</span>
					</div>
				)}
				{pr && (
					<span className="text-[9px] bg-[#01cdfe]/15 text-[#01cdfe] font-bold px-1.5 py-0.5 shrink-0">
						#{pr.number}
					</span>
				)}
			</div>
		</div>
	);
}

export function OceanGitInfo({ branch, pr }: BaseWorkspaceGitInfoProps) {
	if (!branch && !pr) return null;
	return (
		<div className="mt-0.5 mb-1.5 bg-[#010509]/80 px-4 py-2">
			<div className="flex items-center gap-2">
				{branch && (
					<div className="flex items-center gap-1 min-w-0">
						<svg
							width="8"
							height="8"
							viewBox="0 0 16 16"
							fill="currentColor"
							className="text-[#4dd8e0] shrink-0"
						>
							<path d="M11.5 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM9 5.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zM4.5 8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM2 10.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z" />
							<path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h1V4H7A3.5 3.5 0 0 0 3.5 7.5v2h1v-2z" />
						</svg>
						<span className="text-[10px] text-[#4dd8e0] italic opacity-80 truncate">{branch}</span>
					</div>
				)}
				{pr && (
					<span className="text-[9px] text-[#00e5b0] bg-[#00e5b0]/10 rounded-sm px-1.5 py-0.5 shrink-0">
						#{pr.number}
					</span>
				)}
			</div>
		</div>
	);
}

export function SunsetGitInfo({ branch, pr }: BaseWorkspaceGitInfoProps) {
	if (!branch && !pr) return null;
	return (
		<div className="mt-0.5 mb-1.5 bg-[#0a0404]/80 px-4 py-1.5">
			<div className="flex items-center gap-2">
				{branch && (
					<div className="flex items-center gap-1 min-w-0">
						<svg
							width="8"
							height="8"
							viewBox="0 0 16 16"
							fill="currentColor"
							className="text-[#f0b048] shrink-0"
						>
							<path d="M11.5 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM9 5.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zM4.5 8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM2 10.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z" />
							<path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h1V4H7A3.5 3.5 0 0 0 3.5 7.5v2h1v-2z" />
						</svg>
						<span className="text-[10px] text-[#f0b048] italic opacity-80 truncate">{branch}</span>
					</div>
				)}
				{pr && <span className="text-[9px] text-[#ffc040] font-bold shrink-0">#{pr.number}</span>}
			</div>
		</div>
	);
}

export function ArcticGitInfo({ branch, pr }: BaseWorkspaceGitInfoProps) {
	if (!branch && !pr) return null;
	return (
		<div className="mt-0.5 mb-1.5 bg-[#020810]/70 backdrop-blur-sm px-4 py-2">
			<div className="flex items-center gap-2">
				{branch && (
					<div className="flex items-center gap-1 min-w-0">
						<svg
							width="8"
							height="8"
							viewBox="0 0 16 16"
							fill="currentColor"
							className="text-[#a0e0f8] shrink-0"
						>
							<path d="M11.5 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM9 5.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zM4.5 8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM2 10.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z" />
							<path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h1V4H7A3.5 3.5 0 0 0 3.5 7.5v2h1v-2z" />
						</svg>
						<span className="text-[10px] text-[#a0e0f8] italic opacity-80 truncate">{branch}</span>
					</div>
				)}
				{pr && <span className="text-[9px] text-[#48c8e0] shrink-0">#{pr.number}</span>}
			</div>
		</div>
	);
}
