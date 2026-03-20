import type { ReactNode } from "react";
import type { ThemePresetName } from "../../data/theme-presets";
import type { BasePaneEntryProps, BaseWorkspaceHeaderProps } from "./types";
import {
	CatppuccinEntry,
	CatppuccinHeader,
	DefaultDarkEntry,
	DefaultDarkHeader,
	DraculaEntry,
	DraculaHeader,
	EverforestEntry,
	EverforestHeader,
	GruvboxEntry,
	GruvboxHeader,
	MonokaiEntry,
	MonokaiHeader,
	NordEntry,
	NordHeader,
	TokyoNightEntry,
	TokyoNightHeader,
} from "./variants/ClassicThemes";
import {
	AmberEntry,
	AmberHeader,
	ArcticEntry,
	ArcticHeader,
	CyberpunkEntry,
	CyberpunkHeader,
	MatrixEntry,
	MatrixHeader,
	OceanEntry,
	OceanHeader,
	SolanaEntry,
	SolanaHeader,
	SunsetEntry,
	SunsetHeader,
	VaporwaveEntry,
	VaporwaveHeader,
} from "./variants/IdentityThemes";

// ── Wrapper variants ──────────────────────────────────────────────
export function WorkspaceSectionWrapper({
	preset,
	isActive,
	children,
}: {
	preset: ThemePresetName;
	isActive: boolean;
	children: ReactNode;
}) {
	switch (preset) {
		case "Dracula":
			return (
				<div className={`mb-2 mx-1 rounded-lg overflow-hidden transition-all duration-300 ${isActive ? "bg-[#282a36] shadow-md border border-[#bd93f9]" : "bg-[#1e1f29] border border-transparent"}`}>
					{children}
				</div>
			);
		case "Tokyo Night":
			return (
				<div className={`mb-2 overflow-hidden transition-all ${isActive ? "bg-[#1a1b26] border-l-2 border-[#7aa2f7]" : "bg-[#16161e] border-l-2 border-transparent"}`}>
					{children}
				</div>
			);
		case "Nord":
			return (
				<div className={`mb-2 mx-2 rounded-md overflow-hidden transition-all duration-300 ${isActive ? "bg-[#2e3440] shadow-sm" : "bg-[#242933]"}`}>
					{children}
				</div>
			);
		case "Catppuccin":
			return (
				<div className={`mb-3 mx-1.5 rounded-xl overflow-hidden transition-all duration-300 ${isActive ? "bg-[#1e1e2e] shadow-sm border border-[#313244]" : "bg-[#11111b]"}`}>
					{children}
				</div>
			);
		case "Gruvbox":
			return (
				<div className={`mb-2 border-b border-[#3c3836] ${isActive ? "bg-[#282828]" : "bg-[#1d2021]"}`}>
					{children}
				</div>
			);
		case "Monokai":
			return (
				<div className={`mb-2 border-b border-[#3e3d32] ${isActive ? "bg-[#272822]" : "bg-[#1e1f1c]"}`}>
					{children}
				</div>
			);
		case "Everforest":
			return (
				<div className={`mb-2 rounded-md overflow-hidden ${isActive ? "bg-[#2d353b] border border-[#3d474d]" : "bg-[#232a2e]"}`}>
					{children}
				</div>
			);
		case "Matrix":
			return (
				<div className={`mb-2 border border-[#00ff41]/20 ${isActive ? "bg-[#0a0a0a] shadow-[0_0_10px_rgba(0,255,65,0.1)]" : "bg-black"}`}>
					{children}
				</div>
			);
		case "Cyberpunk":
			return (
				<div className={`mb-3 overflow-hidden ${isActive ? "bg-[#0d0221]" : "bg-[#050014]"}`}>
					{children}
				</div>
			);
		case "Solana":
			return (
				<div className={`mb-2 mx-1.5 rounded-2xl overflow-hidden transition-all duration-300 ${isActive ? "bg-[#0c0c1d] shadow-[0_0_15px_rgba(153,69,255,0.15)] border border-[#1e1e3d]" : "bg-[#050510] border border-transparent"}`}>
					{children}
				</div>
			);
		case "Amber":
			return (
				<div className={`mb-2 border border-[#3d2800] ${isActive ? "bg-[#0c0800]" : "bg-black"}`}>
					{children}
				</div>
			);
		case "Vaporwave":
			return (
				<div className={`mb-3 mx-1 rounded-md overflow-hidden ${isActive ? "bg-[#0a0015] shadow-[0_0_10px_rgba(255,113,206,0.15)] border border-[#2d1b4e]" : "bg-[#05000a] border border-transparent"}`}>
					{children}
				</div>
			);
		case "Ocean":
			return (
				<div className={`mb-2 mx-1 rounded-2xl overflow-hidden ${isActive ? "bg-[#020b14] shadow-[0_0_15px_rgba(0,200,255,0.1)] border border-[#0a2838]" : "bg-[#01050a] border border-transparent"}`}>
					{children}
				</div>
			);
		case "Sunset":
			return (
				<div className={`mb-2 ${isActive ? "bg-[#110808]" : "bg-[#0a0505]"}`}>
					{children}
				</div>
			);
		case "Arctic":
			return (
				<div className={`mb-2 mx-1 rounded-lg overflow-hidden ${isActive ? "bg-[#050d18] border border-[#1e3550] shadow-sm" : "bg-[#02060c] border border-transparent"}`}>
					{children}
				</div>
			);
		default: // Default Dark
			return (
				<div className={`mb-2 border-b border-[#2a2f4a] transition-colors ${isActive ? "bg-[#232946]/50" : "bg-[#0f1626]"}`}>
					{children}
				</div>
			);
	}
}

export function WorkspaceHeaderVariant({
	preset,
	...props
}: BaseWorkspaceHeaderProps & { preset: ThemePresetName }) {
	switch (preset) {
		case "Dracula":
			return <DraculaHeader {...props} />;
		case "Tokyo Night":
			return <TokyoNightHeader {...props} />;
		case "Nord":
			return <NordHeader {...props} />;
		case "Catppuccin":
			return <CatppuccinHeader {...props} />;
		case "Gruvbox":
			return <GruvboxHeader {...props} />;
		case "Monokai":
			return <MonokaiHeader {...props} />;
		case "Everforest":
			return <EverforestHeader {...props} />;
		case "Matrix":
			return <MatrixHeader {...props} />;
		case "Cyberpunk":
			return <CyberpunkHeader {...props} />;
		case "Solana":
			return <SolanaHeader {...props} />;
		case "Amber":
			return <AmberHeader {...props} />;
		case "Vaporwave":
			return <VaporwaveHeader {...props} />;
		case "Ocean":
			return <OceanHeader {...props} />;
		case "Sunset":
			return <SunsetHeader {...props} />;
		case "Arctic":
			return <ArcticHeader {...props} />;
		default:
			return <DefaultDarkHeader {...props} />;
	}
}

export function PaneEntryVariant({ preset, ...props }: BasePaneEntryProps & { preset: ThemePresetName }) {
	switch (preset) {
		case "Dracula":
			return <DraculaEntry {...props} />;
		case "Tokyo Night":
			return <TokyoNightEntry {...props} />;
		case "Nord":
			return <NordEntry {...props} />;
		case "Catppuccin":
			return <CatppuccinEntry {...props} />;
		case "Gruvbox":
			return <GruvboxEntry {...props} />;
		case "Monokai":
			return <MonokaiEntry {...props} />;
		case "Everforest":
			return <EverforestEntry {...props} />;
		case "Matrix":
			return <MatrixEntry {...props} />;
		case "Cyberpunk":
			return <CyberpunkEntry {...props} />;
		case "Solana":
			return <SolanaEntry {...props} />;
		case "Amber":
			return <AmberEntry {...props} />;
		case "Vaporwave":
			return <VaporwaveEntry {...props} />;
		case "Ocean":
			return <OceanEntry {...props} />;
		case "Sunset":
			return <SunsetEntry {...props} />;
		case "Arctic":
			return <ArcticEntry {...props} />;
		default:
			return <DefaultDarkEntry {...props} />;
	}
}

// Collapsed variant that matches header styling exactly, but truncated
export function CollapsedWorkspaceVariant({
	preset,
	name,
	isActive,
	onClick,
}: {
	preset: ThemePresetName;
	name: string;
	isActive: boolean;
	onClick: () => void;
}) {
	switch (preset) {
		case "Dracula":
			return (
				<button type="button" onClick={onClick} title={name} className={`sidebar-item flex items-center gap-2 w-full px-3 py-1.5 justify-center cursor-pointer border-none rounded-t-md transition-all ${isActive ? "text-[#f8f8f2] bg-[#44475a]/40 border-b border-[#44475a]" : "bg-transparent text-[#6272a4] hover:text-[#f8f8f2] hover:bg-[#44475a]/20"}`}>
					<div className={`w-2 h-2 rounded-full shrink-0 transition-all ${isActive ? "bg-[#ff79c6] shadow-[0_0_8px_#ff79c6]" : "bg-[#6272a4]"}`} />
					<span className="sidebar-header text-[12px] font-bold tracking-wide truncate">{name}</span>
				</button>
			);
		case "Tokyo Night":
			return (
				<button type="button" onClick={onClick} title={name} className={`sidebar-item flex items-center gap-2 w-full px-3 py-1 justify-center cursor-pointer border-none transition-all ${isActive ? "text-[#c0caf5] bg-[#1f2335]" : "bg-transparent text-[#565f89] hover:text-[#a9b1d6] hover:bg-[#1f2335]/50"}`}>
					<span className={`sidebar-header text-[11px] font-bold tracking-wider uppercase truncate ${isActive ? "drop-shadow-[0_0_8px_rgba(122,162,247,0.5)] text-[#7aa2f7]" : ""}`}>{name}</span>
				</button>
			);
		case "Nord":
			return (
				<button type="button" onClick={onClick} title={name} className={`sidebar-item flex items-center gap-2 w-full px-3 py-2 justify-center cursor-pointer border-none transition-all ${isActive ? "text-[#eceff4] bg-[#3b4252]" : "bg-transparent text-[#4c566a] hover:text-[#d8dee9] hover:bg-[#3b4252]/50"}`}>
					<span className="sidebar-header text-[12px] font-medium tracking-wide truncate">{name}</span>
				</button>
			);
		case "Catppuccin":
			return (
				<button type="button" onClick={onClick} title={name} className={`sidebar-item flex items-center gap-2 w-full px-3 py-2 justify-center cursor-pointer border-none transition-all ${isActive ? "text-[#cdd6f4] bg-[#313244]" : "bg-transparent text-[#7f849c] hover:text-[#bac2de] hover:bg-[#313244]/50"}`}>
					<div className={`w-2.5 h-2.5 rounded-full shrink-0 transition-colors ${isActive ? "bg-[#cba6f7]" : "bg-[#585b70]"}`} />
					<span className="sidebar-header text-[12px] font-semibold truncate">{name}</span>
				</button>
			);
		case "Gruvbox":
			return (
				<button type="button" onClick={onClick} title={name} className={`sidebar-item flex items-center gap-1 w-full px-2 py-1 justify-center cursor-pointer border-none transition-none ${isActive ? "text-[#ebdbb2] bg-[#3c3836]" : "bg-transparent text-[#a89984] hover:text-[#ebdbb2] hover:bg-[#3c3836]"}`}>
					<span className="sidebar-header font-mono text-[11px] font-bold uppercase truncate">[{name}]</span>
				</button>
			);
		case "Monokai":
			return (
				<button type="button" onClick={onClick} title={name} className={`sidebar-item flex items-center gap-2 w-full px-3 py-1.5 justify-center cursor-pointer border-none transition-colors ${isActive ? "text-[#f8f8f2] bg-[#3e3d32]" : "bg-transparent text-[#75715e] hover:text-[#f8f8f2] hover:bg-[#3e3d32]/50"}`}>
					<svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor" className={`shrink-0 transition-transform ${isActive ? "text-[#a6e22e]" : "text-[#75715e]"}`}>
						<path d="M0 0L10 5L0 10Z" />
					</svg>
					<span className="sidebar-header text-[12px] font-medium truncate">{name}</span>
				</button>
			);
		case "Everforest":
			return (
				<button type="button" onClick={onClick} title={name} className={`sidebar-item flex items-center gap-2 w-full px-3 py-2 justify-center cursor-pointer border-none transition-colors border-b border-[#3d474d] ${isActive ? "text-[#d3c6aa] bg-[#3a454a]" : "bg-transparent text-[#859289] hover:text-[#d3c6aa] hover:bg-[#343f44]"}`}>
					<div className={`w-1.5 h-1.5 rotate-45 shrink-0 transition-transform ${isActive ? "bg-[#a7c080] scale-125" : "bg-[#4a555b]"}`} />
					<span className="sidebar-header text-[12px] font-medium truncate">{name}</span>
				</button>
			);
		case "Matrix":
			return (
				<button type="button" onClick={onClick} title={name} className={`sidebar-item flex items-center gap-2 w-full px-2 py-1 justify-center cursor-pointer transition-none border-y border-[#00ff41]/20 bg-[#050505] uppercase font-mono font-bold tracking-widest ${isActive ? "text-[#00ff41] border-[#00ff41]/60 shadow-[0_0_8px_rgba(0,255,65,0.3)]" : "text-[#009933] hover:text-[#00ff41] hover:border-[#00ff41]/40"}`}>
					<span className="sidebar-header text-[12px] truncate">{name}</span>
				</button>
			);
		case "Cyberpunk":
			return (
				<button type="button" onClick={onClick} title={name} style={{ clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)" }} className={`sidebar-item flex items-center gap-2 w-full px-3 py-1.5 justify-center cursor-pointer transition-all border-l-4 font-bold uppercase tracking-widest ${isActive ? "text-[#0d0221] bg-[#ff2a6d] border-[#05d9e8]" : "bg-[#130228] text-[#ff6e96] border-[#2a0550] hover:bg-[#2a0550] hover:text-[#05d9e8]"}`}>
					<span className="sidebar-header text-[11px] truncate">{name}</span>
				</button>
			);
		case "Solana":
			return (
				<button type="button" onClick={onClick} title={name} className={`sidebar-item flex items-center gap-2 w-full px-3 py-2 justify-center cursor-pointer rounded-full transition-all backdrop-blur-sm ${isActive ? "text-[#f5f5ff] bg-gradient-to-r from-[#9945ff]/40 to-[#14f195]/20 shadow-[0_0_12px_rgba(153,69,255,0.3)]" : "bg-[#0f0f24]/80 text-[#b380ff] hover:text-[#e0e0f0] hover:bg-[#1e1e3d]"}`}>
					<div className={`w-3 h-3 rounded-full shrink-0 flex items-center justify-center transition-all ${isActive ? "bg-gradient-to-tr from-[#9945ff] to-[#14f195]" : "bg-[#3d3d5c]"}`}>
						<div className="w-1 h-1 rounded-full bg-[#0c0c1d] transition-transform scale-100" />
					</div>
					<span className="sidebar-header text-[12px] font-semibold truncate">{name}</span>
				</button>
			);
		case "Amber":
			return (
				<button type="button" onClick={onClick} title={name} className={`sidebar-item flex items-center gap-2 w-full px-3 py-1.5 justify-center cursor-pointer transition-none border-b-2 font-mono uppercase tracking-wider ${isActive ? "text-[#ffb000] bg-[#ffb000]/10 border-[#ffb000] shadow-[0_2px_8px_rgba(255,176,0,0.2)]" : "bg-transparent text-[#b37a00] border-[#5c3d10] hover:text-[#ffb000] hover:bg-[#0c0900]"}`}>
					<span className="sidebar-header text-[12px] font-bold truncate">{name}</span>
				</button>
			);
		case "Vaporwave":
			return (
				<button type="button" onClick={onClick} title={name} className={`sidebar-item flex items-center gap-2 w-full px-3 py-2 justify-center cursor-pointer transition-all border-b font-sans tracking-widest uppercase ${isActive ? "text-[#ff71ce] bg-gradient-to-r from-[#100024] to-[#220050] border-[#01cdfe] shadow-[0_1px_8px_rgba(1,205,254,0.4)]" : "bg-transparent text-[#a855f7] border-[#2d1b4e] hover:text-[#f0d0ff] hover:bg-[#100024]"}`}>
					<div className={`w-2 h-2 rotate-45 shrink-0 transition-all ${isActive ? "bg-[#01cdfe] shadow-[0_0_8px_#01cdfe]" : "bg-[#2d1b4e]"}`} />
					<span className="sidebar-header text-[11px] font-bold italic truncate">{name}</span>
				</button>
			);
		case "Ocean":
			return (
				<button type="button" onClick={onClick} title={name} className={`sidebar-item flex items-center gap-2 w-full px-3 py-2 justify-center cursor-pointer rounded-t-2xl transition-all duration-500 ${isActive ? "text-[#d0eff8] bg-[#0070a0]/30 shadow-[inset_0_0_12px_rgba(0,200,255,0.2)]" : "bg-transparent text-[#2890b8] hover:text-[#a0d8e8] hover:bg-[#051218]"}`}>
					<span className="sidebar-header text-[12px] font-medium truncate">{name}</span>
				</button>
			);
		case "Sunset":
			return (
				<button type="button" onClick={onClick} title={name} className={`sidebar-item flex items-center gap-2 w-full px-3 py-2 justify-center cursor-pointer border-none transition-all border-l-4 ${isActive ? "text-[#fff0d8] bg-gradient-to-r from-[#e04028]/20 to-transparent border-[#e8a040]" : "bg-transparent text-[#d04830] border-transparent hover:text-[#f0d8b0] hover:bg-[#180c0a]"}`}>
					<div className={`w-3 h-3 rounded-full shrink-0 transition-all ${isActive ? "bg-gradient-to-b from-[#e8a040] to-[#e04028] shadow-[0_0_10px_rgba(232,160,64,0.5)]" : "bg-[#4d2418]"}`} />
					<span className="sidebar-header text-[12px] font-bold tracking-wide truncate">{name}</span>
				</button>
			);
		case "Arctic":
			return (
				<button type="button" onClick={onClick} title={name} className={`sidebar-item flex items-center gap-2 w-full px-3 py-2 justify-center cursor-pointer rounded-t-lg transition-all backdrop-blur-md ${isActive ? "text-[#f0f8ff] bg-[#1e3550]/80 shadow-sm border-b border-[#48c8e0]/30" : "bg-transparent text-[#78b8d0] border-b border-transparent hover:text-[#c8e4f0] hover:bg-[#1e3550]/40"}`}>
					<span className="sidebar-header text-[11px] font-medium uppercase tracking-widest truncate">{name}</span>
				</button>
			);
		default: // Default Dark
			return (
				<button type="button" onClick={onClick} title={name} className={`sidebar-item flex items-center gap-2 w-full px-3 justify-center cursor-pointer border-none transition-colors duration-150 ${isActive ? "text-[#e0e0e0] bg-[#232946]/5" : "bg-transparent text-[#8892b0] hover:text-[#e0e0e0]"}`}>
					<span className="sidebar-header text-[11px] font-medium truncate">{name}</span>
				</button>
			);
	}
}
