import type { BasePaneEntryProps, BaseWorkspaceHeaderProps } from "../types";

// --- Matrix ---
export function MatrixHeader({
	name,
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
			className={`sidebar-item flex items-center gap-2 w-full px-2 py-1 text-left cursor-pointer transition-none border-y border-[#00ff41]/20 bg-[#050505] uppercase font-mono font-bold tracking-widest ${
				isActive
					? "text-[#00ff41] border-[#00ff41]/60 shadow-[0_0_8px_rgba(0,255,65,0.3)]"
					: "text-[#009933] hover:text-[#00ff41] hover:border-[#00ff41]/40"
			}`}
		>
			<span className="shrink-0">{isCollapsed ? "[+]" : "[-]"}</span>
			{isEditing ? (
				<input
					{...inputProps}
					maxLength={64}
					onClick={(e) => e.stopPropagation()}
					className="sidebar-header bg-black border border-[#00ff41] text-[#00ff41] text-[11px] py-0 px-1 outline-none flex-1 min-w-0 font-mono uppercase"
				/>
			) : (
				<span className="sidebar-header text-[12px] truncate flex-1 min-w-0">{name}</span>
			)}
			{attentionCount > 0 && (
				<span
					title={`${attentionCount} pane(s) need attention`}
					className="text-[10px] shrink-0 opacity-80"
				>
					{attentionCount}
				</span>
			)}
		</button>
	);
}

export function MatrixEntry({
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
			className={`sidebar-item flex flex-col gap-0.5 w-full text-left pl-6 pr-2 py-2 border-none cursor-pointer transition-none font-mono ${
				isFocused
					? "sidebar-pane-focused text-[#00ff41] bg-[#00ff41]/10 border-l-2 border-[#00ff41]"
					: "bg-transparent text-[#009933] hover:text-[#00ff41] border-l-2 border-transparent hover:bg-[#00ff41]/5"
			}`}
		>
			<div className="flex items-center gap-2 min-w-0 w-full uppercase">
				<span className="text-[11px] font-bold truncate flex-1">{label}</span>
				{agentStatus === "active" && (
					<span className="w-2 h-3 bg-[#00ff41] animate-pulse shrink-0" />
				)}
				{agentStatus === "attention" && (
					<span className="w-2 h-3 bg-red-500 animate-pulse shrink-0" />
				)}
			</div>
			<div className="flex items-center gap-2 min-w-0 w-full">
				<span className="text-[9px] truncate flex-1 opacity-70">&gt; {cwd}</span>
			</div>
			{(branch || pr) && (
				<div className="flex items-center gap-2 min-w-0 w-full uppercase opacity-90">
					{branch && <span className="text-[9px] truncate min-w-0 flex-1">B:{branch}</span>}
					{pr && (
						<span className="text-[9px] border border-[#00ff41]/50 px-1 shrink-0 ml-auto">
							[PR:{pr.number}]
						</span>
					)}
				</div>
			)}
		</button>
	);
}

// --- Cyberpunk ---
export function CyberpunkHeader({
	name,
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
			className={`sidebar-item flex items-center gap-2 w-[calc(100%-8px)] mx-1 px-3 py-1.5 text-left cursor-pointer transition-all border-l-4 font-bold uppercase tracking-widest ${
				isActive
					? "text-[#0d0221] bg-[#ff2a6d] border-[#05d9e8]"
					: "bg-[#130228] text-[#ff6e96] border-[#2a0550] hover:bg-[#2a0550] hover:text-[#05d9e8]"
			}`}
		>
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
				<span className="sidebar-header text-[11px] truncate flex-1 min-w-0">{name}</span>
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
		</button>
	);
}

export function CyberpunkEntry({
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
			className={`sidebar-item flex flex-col gap-0.5 w-[calc(100%-8px)] mx-1 mt-1 text-left pl-4 pr-2 py-1.5 cursor-pointer transition-all font-mono border-b ${
				isFocused
					? "sidebar-pane-focused text-[#05d9e8] bg-[#2a0550]/50 border-[#ff2a6d]"
					: "bg-transparent text-[#b967ff] hover:text-[#f0e6ff] hover:bg-[#130228] border-transparent"
			}`}
		>
			<div className="flex items-center gap-2 min-w-0 w-full uppercase">
				{agentStatus === "active" && (
					<span className="text-[10px] text-[#ff2a6d] animate-pulse">⚙</span>
				)}
				{agentStatus === "attention" && (
					<span className="text-[10px] text-[#fef08a] animate-pulse">⚠</span>
				)}
				<span className="text-[11px] font-bold truncate flex-1">{label}</span>
			</div>
			<div className="flex items-center min-w-0 w-full">
				<span className="text-[9px] truncate flex-1 opacity-70">{cwd}</span>
			</div>
			{(branch || pr) && (
				<div className="flex items-center gap-2 min-w-0 w-full uppercase">
					{branch && (
						<span className="text-[9px] text-[#01c5c4] font-bold truncate min-w-0 flex-1">
							[{branch}]
						</span>
					)}
					{pr && (
						<span className="text-[9px] bg-[#fef08a] text-[#0d0221] px-1 font-bold shrink-0 ml-auto">
							PR:{pr.number}
						</span>
					)}
				</div>
			)}
		</button>
	);
}

// --- Solana ---
export function SolanaHeader({
	name,
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
			className={`sidebar-item flex items-center gap-2 w-[calc(100%-12px)] mx-[6px] px-3 py-2 text-left cursor-pointer rounded-xl transition-all backdrop-blur-sm ${
				isActive
					? "text-[#f5f5ff] bg-gradient-to-r from-[#9945ff]/40 to-[#14f195]/20 shadow-[0_0_12px_rgba(153,69,255,0.3)]"
					: "bg-[#0f0f24]/80 text-[#b380ff] hover:text-[#e0e0f0] hover:bg-[#1e1e3d]"
			}`}
		>
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
				<span className="sidebar-header text-[12px] font-semibold truncate flex-1 min-w-0">
					{name}
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
		</button>
	);
}

export function SolanaEntry({
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
			className={`sidebar-item flex flex-col gap-0.5 w-[calc(100%-12px)] mx-[6px] mt-1 text-left pl-8 pr-3 py-2 cursor-pointer rounded-2xl transition-all border ${
				isFocused
					? "sidebar-pane-focused text-[#f5f5ff] bg-[#1e1e3d]/60 border-[#9945ff]/50"
					: "bg-transparent text-[#a6adc8] hover:text-[#e0e0f0] border-transparent hover:bg-[#0f0f24]"
			}`}
		>
			<div className="flex items-center gap-2 min-w-0 w-full relative">
				{agentStatus === "active" && (
					<span className="w-1.5 h-1.5 rounded-full bg-[#14f195] animate-ping absolute -ml-4" />
				)}
				{agentStatus === "attention" && (
					<span className="w-1.5 h-1.5 rounded-full bg-[#ff6b6b] animate-ping absolute -ml-4" />
				)}
				<span className="text-[11px] font-medium truncate flex-1">{label}</span>
			</div>
			<div className="flex items-center min-w-0 w-full">
				<span className="text-[9px] truncate flex-1 text-[#b380ff]/70">{cwd}</span>
			</div>
			{(branch || pr) && (
				<div className="flex items-center gap-2 min-w-0 w-full">
					{branch && (
						<span className="text-[9px] text-[#33e6c0] font-medium truncate min-w-0 flex-1">
							{branch}
						</span>
					)}
					{pr && (
						<span className="text-[9px] font-bold bg-[#9945ff]/20 text-[#c77dff] px-1.5 rounded-md shrink-0 ml-auto">
							#{pr.number}
						</span>
					)}
				</div>
			)}
		</button>
	);
}

// --- Amber ---
export function AmberHeader({
	name,
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
			className={`sidebar-item flex items-center gap-2 w-full px-3 py-1.5 text-left cursor-pointer transition-none border-b-2 font-mono uppercase tracking-wider ${
				isActive
					? "text-[#ffb000] bg-[#ffb000]/10 border-[#ffb000] shadow-[0_2px_8px_rgba(255,176,0,0.2)]"
					: "bg-transparent text-[#b37a00] border-[#5c3d10] hover:text-[#ffb000] hover:bg-[#0c0900]"
			}`}
		>
			<span className="text-[14px] shrink-0 font-bold">{isCollapsed ? "+" : "-"}</span>
			{isEditing ? (
				<input
					{...inputProps}
					maxLength={64}
					onClick={(e) => e.stopPropagation()}
					className="sidebar-header bg-[#080500] border border-[#ffb000] text-[#ffb000] text-[11px] py-px px-1 outline-none flex-1 min-w-0 font-mono uppercase"
				/>
			) : (
				<span className="sidebar-header text-[12px] font-bold truncate flex-1 min-w-0">{name}</span>
			)}
			{attentionCount > 0 && (
				<span
					title={`${attentionCount} pane(s) need attention`}
					className="text-[10px] px-1 border border-[#b37a00] shrink-0"
				>
					{attentionCount}
				</span>
			)}
		</button>
	);
}

export function AmberEntry({
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
			className={`sidebar-item flex flex-col gap-0.5 w-full text-left pl-6 pr-3 py-1.5 border-none cursor-pointer transition-none font-mono uppercase ${
				isFocused
					? "sidebar-pane-focused text-[#ffe0a0] bg-[#2a1c00]"
					: "bg-transparent text-[#b37a00] hover:text-[#ffb000] hover:bg-[#0c0900]"
			}`}
		>
			<div className="flex items-center gap-2 min-w-0 w-full">
				<span className="shrink-0">{isFocused ? "▶" : " "}</span>
				<span className="text-[11px] font-bold truncate flex-1">{label}</span>
				{agentStatus === "active" && <span className="text-[9px] animate-pulse">WAIT...</span>}
				{agentStatus === "attention" && (
					<span className="text-[9px] animate-pulse bg-[#ffb000] text-black px-1">INPUT</span>
				)}
			</div>
			<div className="flex items-center min-w-0 w-full pl-4 opacity-70">
				<span className="text-[9px] truncate flex-1">{cwd}</span>
			</div>
			{(branch || pr) && (
				<div className="flex items-center gap-2 min-w-0 w-full pl-4 opacity-80">
					{branch && <span className="text-[9px] truncate min-w-0 flex-1">[{branch}]</span>}
					{pr && <span className="text-[9px] shrink-0 ml-auto">PR:{pr.number}</span>}
				</div>
			)}
		</button>
	);
}

// --- Vaporwave ---
export function VaporwaveHeader({
	name,
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
			className={`sidebar-item flex items-center gap-2 w-full px-3 py-2 text-left cursor-pointer transition-all border-b font-sans tracking-widest uppercase ${
				isActive
					? "text-[#ff71ce] bg-gradient-to-r from-[#100024] to-[#220050] border-[#01cdfe] shadow-[0_1px_8px_rgba(1,205,254,0.4)]"
					: "bg-transparent text-[#a855f7] border-[#2d1b4e] hover:text-[#f0d0ff] hover:bg-[#100024]"
			}`}
		>
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
				<span className="sidebar-header text-[11px] font-bold italic truncate flex-1 min-w-0">
					{name}
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
		</button>
	);
}

export function VaporwaveEntry({
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
			className={`sidebar-item flex flex-col gap-0.5 w-full text-left pl-6 pr-3 py-2 border-none cursor-pointer transition-all font-sans ${
				isFocused
					? "sidebar-pane-focused text-[#ffffff] bg-gradient-to-r from-[#7b2fff]/30 to-transparent border-l-2 border-[#ff71ce]"
					: "bg-transparent text-[#ff9de2] hover:text-[#f0d0ff] hover:bg-[#100024] border-l-2 border-transparent"
			}`}
		>
			<div className="flex items-center gap-2 min-w-0 w-full">
				{agentStatus === "active" && (
					<span className="text-[12px] text-[#01cdfe] animate-spin shrink-0">★</span>
				)}
				{agentStatus === "attention" && (
					<span className="text-[12px] text-[#ff2d95] animate-pulse shrink-0">!</span>
				)}
				<span className="text-[11px] font-semibold truncate flex-1 uppercase">{label}</span>
			</div>
			<div className="flex items-center min-w-0 w-full opacity-80">
				<span className="text-[9px] truncate flex-1 font-mono">{cwd}</span>
			</div>
			{(branch || pr) && (
				<div className="flex items-center gap-2 min-w-0 w-full">
					{branch && (
						<span className="text-[9px] text-[#05ffa1] font-mono italic truncate min-w-0 flex-1">
							{branch}
						</span>
					)}
					{pr && (
						<span className="text-[9px] bg-[#01cdfe]/20 text-[#01cdfe] px-1 font-bold shrink-0 ml-auto">
							#{pr.number}
						</span>
					)}
				</div>
			)}
		</button>
	);
}

// --- Ocean ---
export function OceanHeader({
	name,
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
			className={`sidebar-item flex items-center gap-2 w-full px-3 py-2 text-left cursor-pointer rounded-t-2xl transition-all duration-500 ${
				isActive
					? "text-[#d0eff8] bg-[#0070a0]/30 shadow-[inset_0_0_12px_rgba(0,200,255,0.2)]"
					: "bg-transparent text-[#2890b8] hover:text-[#a0d8e8] hover:bg-[#051218]"
			}`}
		>
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
				<span className="sidebar-header text-[12px] font-medium truncate flex-1 min-w-0">
					{name}
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
		</button>
	);
}

export function OceanEntry({
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
			className={`sidebar-item flex flex-col gap-0.5 w-[calc(100%-8px)] mx-1 mt-1 text-left pl-8 pr-3 py-2 border-none cursor-pointer rounded-xl transition-all duration-300 ${
				isFocused
					? "sidebar-pane-focused text-[#b0d8e8] bg-[#0a2838]"
					: "bg-transparent text-[#44d8f0] hover:text-[#b0d8e8] hover:bg-[#051218]"
			}`}
		>
			<div className="flex items-center gap-2 min-w-0 w-full relative">
				{agentStatus === "active" && (
					<span className="w-1.5 h-1.5 rounded-full bg-[#00c8ff] animate-[ping_2s_cubic-bezier(0,0,0.2,1)_infinite] absolute -ml-4" />
				)}
				{agentStatus === "attention" && (
					<span className="w-1.5 h-1.5 rounded-full bg-[#ff6b6b] animate-pulse absolute -ml-4" />
				)}
				<span className="text-[11px] truncate flex-1">{label}</span>
			</div>
			<div className="flex items-center min-w-0 w-full opacity-70">
				<span className="text-[9px] truncate flex-1">{cwd}</span>
			</div>
			{(branch || pr) && (
				<div className="flex items-center gap-2 min-w-0 w-full">
					{branch && (
						<span className="text-[9px] text-[#4dd8e0] truncate min-w-0 flex-1">{branch}</span>
					)}
					{pr && (
						<span className="text-[9px] text-[#00e5b0] bg-[#00e5b0]/10 px-1 rounded-sm shrink-0 ml-auto">
							#{pr.number}
						</span>
					)}
				</div>
			)}
		</button>
	);
}

// --- Sunset ---
export function SunsetHeader({
	name,
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
			className={`sidebar-item flex items-center gap-2 w-full px-3 py-2 text-left cursor-pointer border-none transition-all border-l-4 ${
				isActive
					? "text-[#fff0d8] bg-gradient-to-r from-[#e04028]/20 to-transparent border-[#e8a040]"
					: "bg-transparent text-[#d04830] border-transparent hover:text-[#f0d8b0] hover:bg-[#180c0a]"
			}`}
		>
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
				<span className="sidebar-header text-[12px] font-bold tracking-wide truncate flex-1 min-w-0">
					{name}
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
		</button>
	);
}

export function SunsetEntry({
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
			className={`sidebar-item flex flex-col gap-0.5 w-full text-left pl-7 pr-3 py-1.5 border-none cursor-pointer transition-all ${
				isFocused
					? "sidebar-pane-focused text-[#f0d0a0] bg-[#301810]"
					: "bg-transparent text-[#e87858] hover:text-[#f0d8b0] hover:bg-[#180c0a]"
			}`}
		>
			<div className="flex items-center gap-2 min-w-0 w-full">
				{agentStatus === "active" && (
					<span className="w-6 h-0.5 bg-[#e8a040] animate-pulse shrink-0 rounded-full" />
				)}
				{agentStatus === "attention" && (
					<span className="w-6 h-0.5 bg-[#e04028] animate-pulse shrink-0 rounded-full" />
				)}
				<span className="text-[11px] font-medium truncate flex-1">{label}</span>
			</div>
			<div className="flex items-center min-w-0 w-full font-mono opacity-80">
				<span className="text-[9px] truncate flex-1">{cwd}</span>
			</div>
			{(branch || pr) && (
				<div className="flex items-center gap-2 min-w-0 w-full">
					{branch && (
						<span className="text-[9px] text-[#f0b048] truncate min-w-0 flex-1">{branch}</span>
					)}
					{pr && <span className="text-[9px] text-[#ffc040] shrink-0 ml-auto">#{pr.number}</span>}
				</div>
			)}
		</button>
	);
}

// --- Arctic ---
export function ArcticHeader({
	name,
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
			className={`sidebar-item flex items-center gap-2 w-[calc(100%-8px)] mx-1 px-3 py-2 text-left cursor-pointer rounded-t-lg transition-all backdrop-blur-md ${
				isActive
					? "text-[#f0f8ff] bg-[#1e3550]/80 shadow-sm border-b border-[#48c8e0]/30"
					: "bg-transparent text-[#78b8d0] border-b border-transparent hover:text-[#c8e4f0] hover:bg-[#1e3550]/40"
			}`}
		>
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
				<span className="sidebar-header text-[11px] font-medium uppercase tracking-widest truncate flex-1 min-w-0">
					{name}
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
		</button>
	);
}

export function ArcticEntry({
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
			className={`sidebar-item flex flex-col gap-0.5 w-[calc(100%-8px)] mx-1 mt-1 text-left pl-7 pr-3 py-2 border-none cursor-pointer rounded-md transition-all ${
				isFocused
					? "sidebar-pane-focused text-[#f0f8ff] bg-[#1e3550]/50"
					: "bg-transparent text-[#68d8ee] hover:text-[#c8e4f0] hover:bg-[#1e3550]/20"
			}`}
		>
			<div className="flex items-center gap-2 min-w-0 w-full">
				{agentStatus === "active" && (
					<span className="w-1.5 h-1.5 bg-[#70e8cc] rotate-45 animate-pulse shrink-0" />
				)}
				{agentStatus === "attention" && (
					<span className="w-1.5 h-1.5 bg-[#ff6e6e] rotate-45 animate-pulse shrink-0" />
				)}
				<span className="text-[11px] truncate tracking-wide flex-1">{label}</span>
			</div>
			<div className="flex items-center min-w-0 w-full opacity-60">
				<span className="text-[9px] truncate flex-1 font-mono">{cwd}</span>
			</div>
			{(branch || pr) && (
				<div className="flex items-center gap-2 min-w-0 w-full">
					{branch && (
						<span className="text-[9px] text-[#a0e0f8] font-mono truncate min-w-0 flex-1">
							{branch}
						</span>
					)}
					{pr && <span className="text-[9px] text-[#48c8e0] shrink-0 ml-auto">PR {pr.number}</span>}
				</div>
			)}
		</button>
	);
}
