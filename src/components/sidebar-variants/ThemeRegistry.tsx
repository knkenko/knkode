import { memo, type ReactNode } from "react";
import type { ThemePresetName } from "../../data/theme-presets";
import type {
	AddPaneButtonTokens,
	BasePaneEntryProps,
	BaseWorkspaceGitInfoProps,
	BaseWorkspaceHeaderProps,
	BracketPosition,
	CollapsedTokens,
	CollapsedVariantProps,
	ThemeVariantConfig,
} from "./types";
import {
	CatppuccinEntry,
	CatppuccinGitInfo,
	CatppuccinHeader,
	DefaultDarkEntry,
	DefaultDarkGitInfo,
	DefaultDarkHeader,
	DraculaEntry,
	DraculaGitInfo,
	DraculaHeader,
	EverforestEntry,
	EverforestGitInfo,
	EverforestHeader,
	GruvboxEntry,
	GruvboxGitInfo,
	GruvboxHeader,
	MonokaiEntry,
	MonokaiGitInfo,
	MonokaiHeader,
	NordEntry,
	NordGitInfo,
	NordHeader,
	TokyoNightEntry,
	TokyoNightGitInfo,
	TokyoNightHeader,
} from "./variants/ClassicThemes";
import {
	AmberEntry,
	AmberGitInfo,
	AmberHeader,
	ArcticEntry,
	ArcticGitInfo,
	ArcticHeader,
	CyberpunkEntry,
	CyberpunkGitInfo,
	CyberpunkHeader,
	MatrixEntry,
	MatrixGitInfo,
	MatrixHeader,
	OceanEntry,
	OceanGitInfo,
	OceanHeader,
	SolanaEntry,
	SolanaGitInfo,
	SolanaHeader,
	SunsetEntry,
	SunsetGitInfo,
	SunsetHeader,
	VaporwaveEntry,
	VaporwaveGitInfo,
	VaporwaveHeader,
} from "./variants/IdentityThemes";

// ── Collapsed decorator factories ────────────────────────────────

function dot(size: string, activeClass: string, inactiveClass: string) {
	return (isActive: boolean) => (
		<div
			className={`${size} rounded-full shrink-0 transition-all ${isActive ? activeClass : inactiveClass}`}
		/>
	);
}

function diamond(size: string, activeClass: string, inactiveClass: string) {
	return (isActive: boolean) => (
		<div
			className={`${size} rotate-45 shrink-0 transition-all ${isActive ? activeClass : inactiveClass}`}
		/>
	);
}

function monokaiArrow(isActive: boolean) {
	return (
		<svg
			width="8"
			height="8"
			viewBox="0 0 10 10"
			fill="currentColor"
			className={`shrink-0 transition-transform ${isActive ? "text-[#a6e22e]" : "text-[#75715e]"}`}
		>
			<path d="M0 0L10 5L0 10Z" />
		</svg>
	);
}

function solanaOrb(isActive: boolean) {
	return (
		<div
			className={`w-3 h-3 rounded-full shrink-0 flex items-center justify-center transition-all ${isActive ? "bg-gradient-to-tr from-[#9945ff] to-[#14f195]" : "bg-[#3d3d5c]"}`}
		>
			<div className="w-1 h-1 rounded-full bg-[#0c0c1d] transition-transform scale-100" />
		</div>
	);
}

// ── Collapsed button component ───────────────────────────────────

function CollapsedButton({
	name,
	isActive,
	onClick,
	tokens,
}: CollapsedVariantProps & { tokens: CollapsedTokens }) {
	const displayName = tokens.formatName ? tokens.formatName(name) : name;
	return (
		<button
			type="button"
			onClick={onClick}
			title={name}
			style={tokens.style}
			className={`${tokens.button} ${isActive ? tokens.active : tokens.inactive}`}
		>
			{tokens.decorator?.(isActive)}
			<span
				className={`${tokens.label}${isActive && tokens.labelActive ? ` ${tokens.labelActive}` : ""}`}
			>
				{displayName}
			</span>
		</button>
	);
}

// ── Add Pane button component ────────────────────────────────────

function AddPaneButton({ onClick, tokens }: { onClick: () => void; tokens: AddPaneButtonTokens }) {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-label="Add new pane"
			className={tokens.className}
			style={tokens.style}
		>
			{tokens.label}
		</button>
	);
}

// ── Variant Registry ─────────────────────────────────────────────

const VARIANT_REGISTRY: Record<ThemePresetName, ThemeVariantConfig> = {
	"Default Dark": {
		wrapper: {
			base: "mb-2 border-b transition-colors",
			active: "border-[#4a5280] bg-[#232946]/50",
			inactive: "border-[#3a4070] bg-[#0f1626]",
		},
		collapsed: {
			button:
				"sidebar-item flex items-center gap-2 w-full px-3 justify-center cursor-pointer border-none transition-colors duration-150",
			active: "text-[#e0e0e0] bg-[#232946]/5",
			inactive: "bg-transparent text-[#8892b0] hover:text-[#e0e0e0]",
			label: "sidebar-header text-[11px] font-medium truncate",
		},
		bracket: { active: "#6c63ff", inactive: "#3a4070" },
		Header: DefaultDarkHeader,
		Entry: DefaultDarkEntry,
		GitInfo: DefaultDarkGitInfo,
		addPaneButton: {
			className:
				"w-full px-4 py-1 text-left text-[10px] text-[#5a6380] hover:text-[#8892b0] bg-transparent border-none cursor-pointer transition-colors duration-150",
			label: "+ new",
		},
	},
	Dracula: {
		wrapper: {
			base: "mb-2 mx-1 rounded-lg overflow-hidden transition-all duration-300",
			active: "bg-[#282a36] shadow-md border border-[#bd93f9]",
			inactive: "bg-[#1e1f29] border border-[#44475a]/60",
		},
		collapsed: {
			button:
				"sidebar-item flex items-center gap-2 w-full px-3 py-1.5 justify-center cursor-pointer border-none rounded-t-md transition-all",
			active: "text-[#f8f8f2] bg-[#44475a]/40 border-b border-[#44475a]",
			inactive: "bg-transparent text-[#6272a4] hover:text-[#f8f8f2] hover:bg-[#44475a]/20",
			label: "sidebar-header text-[12px] font-bold tracking-wide truncate",
			decorator: dot("w-2 h-2", "bg-[#ff79c6] shadow-[0_0_8px_#ff79c6]", "bg-[#6272a4]"),
		},
		bracket: { active: "#bd93f9", inactive: "#44475a" },
		Header: DraculaHeader,
		Entry: DraculaEntry,
		GitInfo: DraculaGitInfo,
		addPaneButton: {
			className:
				"mx-2 mt-0.5 mb-1 px-3 py-1 text-[10px] text-[#6272a4] hover:text-[#ff79c6] bg-transparent hover:bg-[#44475a]/20 border border-dashed border-[#44475a]/40 hover:border-[#ff79c6]/40 rounded-md cursor-pointer transition-all duration-200 w-[calc(100%_-_16px)]",
			label: "+ summon",
		},
	},
	"Tokyo Night": {
		wrapper: {
			base: "mb-2 overflow-hidden transition-all",
			active: "bg-[#1a1b26] border-l-2 border-[#7aa2f7]",
			inactive: "bg-[#16161e] border-l-2 border-[#3b4261]",
		},
		collapsed: {
			button:
				"sidebar-item flex items-center gap-2 w-full px-3 py-1 justify-center cursor-pointer border-none transition-all",
			active: "text-[#c0caf5] bg-[#1f2335]",
			inactive: "bg-transparent text-[#565f89] hover:text-[#a9b1d6] hover:bg-[#1f2335]/50",
			label: "sidebar-header text-[11px] font-bold tracking-wider uppercase truncate",
			labelActive: "drop-shadow-[0_0_8px_rgba(122,162,247,0.5)] text-[#7aa2f7]",
		},
		bracket: { active: "#7aa2f7", inactive: "#3b4261" },
		Header: TokyoNightHeader,
		Entry: TokyoNightEntry,
		GitInfo: TokyoNightGitInfo,
		addPaneButton: {
			className:
				"w-full px-4 py-1 text-left text-[10px] text-[#565f89] hover:text-[#7aa2f7] bg-transparent border-none cursor-pointer transition-colors duration-200 uppercase tracking-wider font-bold",
			label: "// new",
		},
	},
	Nord: {
		wrapper: {
			base: "mb-2 mx-2 rounded-md overflow-hidden transition-all duration-300 border",
			active: "bg-[#2e3440] shadow-sm border-[#5e81ac]/40",
			inactive: "bg-[#242933] border-[#3b4252]",
		},
		collapsed: {
			button:
				"sidebar-item flex items-center gap-2 w-full px-3 py-2 justify-center cursor-pointer border-none transition-all",
			active: "text-[#eceff4] bg-[#3b4252]",
			inactive: "bg-transparent text-[#4c566a] hover:text-[#d8dee9] hover:bg-[#3b4252]/50",
			label: "sidebar-header text-[12px] font-medium tracking-wide truncate",
		},
		bracket: { active: "#5e81ac", inactive: "#3b4252" },
		Header: NordHeader,
		Entry: NordEntry,
		GitInfo: NordGitInfo,
		addPaneButton: {
			className:
				"w-full px-4 py-1 text-left text-[10px] text-[#4c566a] hover:text-[#d8dee9] bg-transparent hover:bg-[#3b4252]/30 border-none cursor-pointer transition-colors duration-200 tracking-wide",
			label: "+ new",
		},
	},
	Catppuccin: {
		wrapper: {
			base: "mb-3 mx-1.5 rounded-xl overflow-hidden transition-all duration-300 border",
			active: "bg-[#1e1e2e] shadow-sm border-[#313244]",
			inactive: "bg-[#11111b] border-[#313244]/70",
		},
		collapsed: {
			button:
				"sidebar-item flex items-center gap-2 w-full px-3 py-2 justify-center cursor-pointer border-none transition-all",
			active: "text-[#cdd6f4] bg-[#313244]",
			inactive: "bg-transparent text-[#7f849c] hover:text-[#bac2de] hover:bg-[#313244]/50",
			label: "sidebar-header text-[12px] font-semibold truncate",
			decorator: dot("w-2.5 h-2.5", "bg-[#cba6f7]", "bg-[#585b70]"),
		},
		bracket: { active: "#cba6f7", inactive: "#585b70" },
		Header: CatppuccinHeader,
		Entry: CatppuccinEntry,
		GitInfo: CatppuccinGitInfo,
		addPaneButton: {
			className:
				"mx-2 mt-0.5 mb-1 px-3 py-1 text-[10px] text-[#7f849c] hover:text-[#cba6f7] bg-transparent hover:bg-[#313244]/30 border border-dashed border-[#313244]/60 hover:border-[#cba6f7]/40 rounded-lg cursor-pointer transition-all duration-200 w-[calc(100%_-_16px)]",
			label: "+ brew",
		},
	},
	Gruvbox: {
		wrapper: {
			base: "mb-2 border-b border-[#3c3836]",
			active: "bg-[#282828]",
			inactive: "bg-[#1d2021]",
		},
		collapsed: {
			button:
				"sidebar-item flex items-center gap-1 w-full px-2 py-1 justify-center cursor-pointer border-none transition-none",
			active: "text-[#ebdbb2] bg-[#3c3836]",
			inactive: "bg-transparent text-[#a89984] hover:text-[#ebdbb2] hover:bg-[#3c3836]",
			label: "sidebar-header font-mono text-[11px] font-bold uppercase truncate",
			formatName: (name) => `[${name}]`,
		},
		bracket: { active: "#d79921", inactive: "#504945" },
		Header: GruvboxHeader,
		Entry: GruvboxEntry,
		GitInfo: GruvboxGitInfo,
		addPaneButton: {
			className:
				"w-full px-2 py-1 text-left text-[10px] text-[#a89984] hover:text-[#ebdbb2] bg-transparent hover:bg-[#3c3836] border-none cursor-pointer transition-none font-mono font-bold uppercase",
			label: "[+ NEW]",
		},
	},
	Monokai: {
		wrapper: {
			base: "mb-2 border-b border-[#3e3d32]",
			active: "bg-[#272822]",
			inactive: "bg-[#1e1f1c]",
		},
		collapsed: {
			button:
				"sidebar-item flex items-center gap-2 w-full px-3 py-1.5 justify-center cursor-pointer border-none transition-colors",
			active: "text-[#f8f8f2] bg-[#3e3d32]",
			inactive: "bg-transparent text-[#75715e] hover:text-[#f8f8f2] hover:bg-[#3e3d32]/50",
			label: "sidebar-header text-[12px] font-medium truncate",
			decorator: monokaiArrow,
		},
		bracket: { active: "#f92672", inactive: "#3e3d32" },
		Header: MonokaiHeader,
		Entry: MonokaiEntry,
		GitInfo: MonokaiGitInfo,
		addPaneButton: {
			className:
				"w-full px-3 py-1 text-left text-[10px] text-[#75715e] hover:text-[#f92672] bg-transparent border-none cursor-pointer transition-colors duration-150",
			label: "▸ new",
		},
	},
	Everforest: {
		wrapper: {
			base: "mb-2 rounded-md overflow-hidden border",
			active: "bg-[#2d353b] border-[#3d474d]",
			inactive: "bg-[#232a2e] border-[#3d474d]/70",
		},
		collapsed: {
			button:
				"sidebar-item flex items-center gap-2 w-full px-3 py-2 justify-center cursor-pointer border-none transition-colors border-b border-[#3d474d]",
			active: "text-[#d3c6aa] bg-[#3a454a]",
			inactive: "bg-transparent text-[#859289] hover:text-[#d3c6aa] hover:bg-[#343f44]",
			label: "sidebar-header text-[12px] font-medium truncate",
			decorator: diamond("w-1.5 h-1.5", "bg-[#a7c080] scale-125", "bg-[#4a555b]"),
		},
		bracket: { active: "#a7c080", inactive: "#4a555b" },
		Header: EverforestHeader,
		Entry: EverforestEntry,
		GitInfo: EverforestGitInfo,
		addPaneButton: {
			className:
				"w-full px-3 py-1 text-left text-[10px] text-[#859289] hover:text-[#a7c080] bg-transparent hover:bg-[#343f44]/40 border-none cursor-pointer transition-colors duration-200",
			label: "+ grow",
		},
	},
	Matrix: {
		wrapper: {
			base: "mb-2 border border-[#00ff41]/35",
			active: "bg-[#0a0a0a] shadow-[0_0_10px_rgba(0,255,65,0.1)]",
			inactive: "bg-black",
		},
		collapsed: {
			button:
				"sidebar-item flex items-center gap-2 w-full px-2 py-1 justify-center cursor-pointer transition-none border-y border-[#00ff41]/20 bg-[#050505] uppercase font-mono font-bold tracking-widest",
			active: "text-[#00ff41] border-[#00ff41]/60 shadow-[0_0_8px_rgba(0,255,65,0.3)]",
			inactive: "text-[#009933] hover:text-[#00ff41] hover:border-[#00ff41]/40",
			label: "sidebar-header text-[12px] truncate",
		},
		bracket: { active: "#00ff41", inactive: "#005500" },
		Header: MatrixHeader,
		Entry: MatrixEntry,
		GitInfo: MatrixGitInfo,
		addPaneButton: {
			className:
				"w-full px-2 py-1 text-left text-[10px] text-[#009933] hover:text-[#00ff41] bg-transparent hover:bg-[#00ff41]/5 border-none cursor-pointer transition-none font-mono font-bold uppercase",
			label: "> SPAWN_PROCESS",
		},
	},
	Cyberpunk: {
		wrapper: {
			base: "mb-3 overflow-hidden border-l-2 border-b",
			active: "bg-[#0d0221] border-l-[#ff2a6d]/60 border-b-[#ff2a6d]/60",
			inactive: "bg-[#050014] border-l-[#5a1080] border-b-[#5a1080]",
		},
		collapsed: {
			button:
				"sidebar-item flex items-center gap-2 w-full px-3 py-1.5 justify-center cursor-pointer transition-all border-l-4 font-bold uppercase tracking-widest",
			active: "text-[#0d0221] bg-[#ff2a6d] border-[#05d9e8]",
			inactive:
				"bg-[#130228] text-[#ff6e96] border-[#2a0550] hover:bg-[#2a0550] hover:text-[#05d9e8]",
			label: "sidebar-header text-[11px] truncate",
			style: {
				clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%)",
			},
		},
		bracket: { active: "#ff2a6d", inactive: "#5a1080" },
		Header: CyberpunkHeader,
		Entry: CyberpunkEntry,
		GitInfo: CyberpunkGitInfo,
		addPaneButton: {
			className:
				"w-full px-4 py-1 text-left text-[10px] text-[#ff6e96] hover:text-[#05d9e8] bg-transparent hover:bg-[#2a0550]/30 border-none cursor-pointer transition-all duration-200 font-bold uppercase tracking-wider",
			style: {
				clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 3px), calc(100% - 3px) 100%, 0 100%)",
			},
			label: "[ JACK_IN ]",
		},
	},
	Solana: {
		wrapper: {
			base: "mb-2 mx-1.5 rounded-2xl overflow-hidden transition-all duration-300 border",
			active: "bg-[#0c0c1d] shadow-[0_0_15px_rgba(153,69,255,0.15)] border-[#1e1e3d]",
			inactive: "bg-[#050510] border-[#35356a]",
		},
		collapsed: {
			button:
				"sidebar-item flex items-center gap-2 w-full px-3 py-2 justify-center cursor-pointer rounded-full transition-all backdrop-blur-sm",
			active:
				"text-[#f5f5ff] bg-gradient-to-r from-[#9945ff]/40 to-[#14f195]/20 shadow-[0_0_12px_rgba(153,69,255,0.3)]",
			inactive: "bg-[#0f0f24]/80 text-[#b380ff] hover:text-[#e0e0f0] hover:bg-[#1e1e3d]",
			label: "sidebar-header text-[12px] font-semibold truncate",
			decorator: solanaOrb,
		},
		bracket: { active: "#9945ff", inactive: "#35356a" },
		Header: SolanaHeader,
		Entry: SolanaEntry,
		GitInfo: SolanaGitInfo,
		addPaneButton: {
			className:
				"mx-2 mt-0.5 mb-1 px-3 py-1 text-[10px] text-[#b380ff] hover:text-[#f5f5ff] bg-transparent hover:bg-gradient-to-r hover:from-[#9945ff]/10 hover:to-[#14f195]/10 border border-dashed border-[#35356a] hover:border-[#9945ff]/40 rounded-full cursor-pointer transition-all duration-200 w-[calc(100%_-_16px)]",
			label: "◎ spawn",
		},
	},
	Amber: {
		wrapper: {
			base: "mb-2 border border-[#5c3d00]",
			active: "bg-[#0c0800]",
			inactive: "bg-black",
		},
		collapsed: {
			button:
				"sidebar-item flex items-center gap-2 w-full px-3 py-1.5 justify-center cursor-pointer transition-none border-b-2 font-mono uppercase tracking-wider",
			active:
				"text-[#ffb000] bg-[#ffb000]/10 border-[#ffb000] shadow-[0_2px_8px_rgba(255,176,0,0.2)]",
			inactive:
				"bg-transparent text-[#b37a00] border-[#5c3d10] hover:text-[#ffb000] hover:bg-[#0c0900]",
			label: "sidebar-header text-[12px] font-bold truncate",
		},
		bracket: { active: "#ffb000", inactive: "#5c3d00" },
		Header: AmberHeader,
		Entry: AmberEntry,
		GitInfo: AmberGitInfo,
		addPaneButton: {
			className:
				"w-full px-3 py-1 text-left text-[10px] text-[#b37a00] hover:text-[#ffb000] bg-transparent hover:bg-[#ffb000]/5 border-none cursor-pointer transition-none font-mono uppercase",
			label: "> init_pty",
		},
	},
	Vaporwave: {
		wrapper: {
			base: "mb-3 mx-1 rounded-md overflow-hidden border",
			active: "bg-[#0a0015] shadow-[0_0_10px_rgba(255,113,206,0.15)] border-[#2d1b4e]",
			inactive: "bg-[#05000a] border-[#2d1b4e]",
		},
		collapsed: {
			button:
				"sidebar-item flex items-center gap-2 w-full px-3 py-2 justify-center cursor-pointer transition-all border-b font-sans tracking-widest uppercase",
			active:
				"text-[#ff71ce] bg-gradient-to-r from-[#100024] to-[#220050] border-[#01cdfe] shadow-[0_1px_8px_rgba(1,205,254,0.4)]",
			inactive:
				"bg-transparent text-[#a855f7] border-[#2d1b4e] hover:text-[#f0d0ff] hover:bg-[#100024]",
			label: "sidebar-header text-[11px] font-bold italic truncate",
			decorator: diamond("w-2 h-2", "bg-[#01cdfe] shadow-[0_0_8px_#01cdfe]", "bg-[#2d1b4e]"),
		},
		bracket: { active: "#ff71ce", inactive: "#2d1b4e" },
		Header: VaporwaveHeader,
		Entry: VaporwaveEntry,
		GitInfo: VaporwaveGitInfo,
		addPaneButton: {
			className:
				"w-full px-3 py-1 text-left text-[10px] text-[#a855f7] hover:text-[#ff71ce] bg-transparent hover:bg-[#100024]/50 border-none cursor-pointer transition-all duration-300 italic tracking-widest uppercase",
			label: "＋ ＮＥＷ",
		},
	},
	Ocean: {
		wrapper: {
			base: "mb-2 mx-1 rounded-2xl overflow-hidden border",
			active: "bg-[#020b14] shadow-[0_0_15px_rgba(0,200,255,0.1)] border-[#0a2838]",
			inactive: "bg-[#01050a] border-[#144a65]",
		},
		collapsed: {
			button:
				"sidebar-item flex items-center gap-2 w-full px-3 py-2 justify-center cursor-pointer rounded-t-2xl transition-all duration-500",
			active: "text-[#d0eff8] bg-[#0070a0]/30 shadow-[inset_0_0_12px_rgba(0,200,255,0.2)]",
			inactive: "bg-transparent text-[#2890b8] hover:text-[#a0d8e8] hover:bg-[#051218]",
			label: "sidebar-header text-[12px] font-medium truncate",
		},
		bracket: { active: "#00c8ff", inactive: "#144a65" },
		Header: OceanHeader,
		Entry: OceanEntry,
		GitInfo: OceanGitInfo,
		addPaneButton: {
			className:
				"mx-2 mt-0.5 mb-1 px-3 py-1 text-[10px] text-[#2890b8] hover:text-[#00c8ff] bg-transparent hover:bg-[#0070a0]/10 border border-dashed border-[#144a65] hover:border-[#00c8ff]/30 rounded-xl cursor-pointer transition-all duration-300 w-[calc(100%_-_16px)]",
			label: "~ surface",
		},
	},
	Sunset: {
		wrapper: {
			base: "mb-2 border-l-2 border-b",
			active: "bg-[#110808] border-l-[#e04028]/50 border-b-[#9a4530]",
			inactive: "bg-[#0a0505] border-l-[#7a3525] border-b-[#9a4530]",
		},
		collapsed: {
			button:
				"sidebar-item flex items-center gap-2 w-full px-3 py-2 justify-center cursor-pointer border-none transition-all border-l-4",
			active: "text-[#fff0d8] bg-gradient-to-r from-[#e04028]/20 to-transparent border-[#e8a040]",
			inactive:
				"bg-transparent text-[#d04830] border-transparent hover:text-[#f0d8b0] hover:bg-[#180c0a]",
			label: "sidebar-header text-[12px] font-bold tracking-wide truncate",
			decorator: dot(
				"w-3 h-3",
				"bg-gradient-to-b from-[#e8a040] to-[#e04028] shadow-[0_0_10px_rgba(232,160,64,0.5)]",
				"bg-[#4d2418]",
			),
		},
		bracket: { active: "#e8a040", inactive: "#4d2418" },
		Header: SunsetHeader,
		Entry: SunsetEntry,
		GitInfo: SunsetGitInfo,
		addPaneButton: {
			className:
				"w-full px-3 py-1 text-left text-[10px] text-[#d04830] hover:text-[#e8a040] bg-transparent hover:bg-[#180c0a]/50 border-none cursor-pointer transition-all duration-200 font-bold tracking-wide",
			label: "+ kindle",
		},
	},
	Arctic: {
		wrapper: {
			base: "mb-2 mx-1 rounded-lg overflow-hidden border",
			active: "bg-[#050d18] border-[#1e3550] shadow-sm",
			inactive: "bg-[#02060c] border-[#1e3550]/70",
		},
		collapsed: {
			button:
				"sidebar-item flex items-center gap-2 w-full px-3 py-2 justify-center cursor-pointer rounded-t-lg transition-all backdrop-blur-md",
			active: "text-[#f0f8ff] bg-[#1e3550]/80 shadow-sm border-b border-[#48c8e0]/30",
			inactive:
				"bg-transparent text-[#78b8d0] border-b border-transparent hover:text-[#c8e4f0] hover:bg-[#1e3550]/40",
			label: "sidebar-header text-[11px] font-medium uppercase tracking-widest truncate",
		},
		bracket: { active: "#48c8e0", inactive: "#1e3550" },
		Header: ArcticHeader,
		Entry: ArcticEntry,
		GitInfo: ArcticGitInfo,
		addPaneButton: {
			className:
				"mx-2 mt-0.5 mb-1 px-3 py-1 text-[10px] text-[#78b8d0] hover:text-[#48c8e0] bg-transparent hover:bg-[#1e3550]/30 border border-dashed border-[#1e3550] hover:border-[#48c8e0]/30 rounded-md cursor-pointer transition-all duration-200 uppercase tracking-widest w-[calc(100%_-_16px)]",
			label: "◇ new",
		},
	},
};

// ── Public API ───────────────────────────────────────────────────

function getConfig(preset: ThemePresetName): ThemeVariantConfig {
	return VARIANT_REGISTRY[preset];
}

export function WorkspaceSectionWrapper({
	preset,
	isActive,
	children,
}: {
	preset: ThemePresetName;
	isActive: boolean;
	children: ReactNode;
}) {
	const { wrapper } = getConfig(preset);
	return (
		<div className={`${wrapper.base} ${isActive ? wrapper.active : wrapper.inactive}`}>
			{children}
		</div>
	);
}

export function WorkspaceHeaderVariant({
	preset,
	...props
}: BaseWorkspaceHeaderProps & { preset: ThemePresetName }) {
	const { Header } = getConfig(preset);
	return <Header {...props} />;
}

export function PaneEntryVariant({
	preset,
	...props
}: BasePaneEntryProps & { preset: ThemePresetName }) {
	const { Entry } = getConfig(preset);
	return <Entry {...props} />;
}

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
	const { collapsed } = getConfig(preset);
	return <CollapsedButton name={name} isActive={isActive} onClick={onClick} tokens={collapsed} />;
}

export function WorkspaceGitInfoVariant({
	preset,
	...props
}: BaseWorkspaceGitInfoProps & { preset: ThemePresetName }) {
	const { GitInfo } = getConfig(preset);
	return <GitInfo {...props} />;
}

export function AddPaneButtonVariant({
	preset,
	onClick,
}: {
	preset: ThemePresetName;
	onClick: () => void;
}) {
	const { addPaneButton } = getConfig(preset);
	return <AddPaneButton onClick={onClick} tokens={addPaneButton} />;
}

const BRACKET_POSITION_CLASSES: Record<BracketPosition, string> = {
	first: "mt-[50%] rounded-t-full",
	middle: "",
	last: "mb-[50%] rounded-b-full",
	solo: "my-[30%] rounded-full",
};

/** Renders a vertical bracket connector segment for subgroup visual grouping.
 *  Uses a thin CSS div (not Unicode) for consistent rendering and seamless vertical connection. */
export const SubgroupBracket = memo(function SubgroupBracket({
	position,
	preset,
	isActive,
}: {
	position: BracketPosition;
	preset: ThemePresetName;
	isActive: boolean;
}) {
	const { bracket } = getConfig(preset);
	const color = isActive ? bracket.active : bracket.inactive;
	return (
		<div className="w-3 shrink-0 flex justify-center" aria-hidden="true">
			<div
				className={`w-[2px] ${BRACKET_POSITION_CLASSES[position]}`}
				style={{ backgroundColor: color }}
			/>
		</div>
	);
});
