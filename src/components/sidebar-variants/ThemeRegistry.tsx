import type { ReactNode } from "react";
import type { ThemePresetName } from "../../data/theme-presets";
import type {
	BasePaneEntryProps,
	BaseWorkspaceHeaderProps,
	CollapsedTokens,
	CollapsedVariantProps,
	ThemeVariantConfig,
} from "./types";
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

function globe(size: string, activeClass: string, inactiveClass: string) {
	return (isActive: boolean) => (
		<div
			className={`${size} rounded-full shrink-0 transition-all ${isActive ? activeClass : inactiveClass}`}
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
		Header: DefaultDarkHeader,
		Entry: DefaultDarkEntry,
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
		Header: DraculaHeader,
		Entry: DraculaEntry,
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
		Header: TokyoNightHeader,
		Entry: TokyoNightEntry,
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
		Header: NordHeader,
		Entry: NordEntry,
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
		Header: CatppuccinHeader,
		Entry: CatppuccinEntry,
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
		Header: GruvboxHeader,
		Entry: GruvboxEntry,
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
		Header: MonokaiHeader,
		Entry: MonokaiEntry,
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
		Header: EverforestHeader,
		Entry: EverforestEntry,
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
		Header: MatrixHeader,
		Entry: MatrixEntry,
	},
	Cyberpunk: {
		wrapper: {
			base: "mb-3 overflow-hidden border-l-2",
			active: "bg-[#0d0221] border-[#ff2a6d]/60",
			inactive: "bg-[#050014] border-[#5a1080]",
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
		Header: CyberpunkHeader,
		Entry: CyberpunkEntry,
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
		Header: SolanaHeader,
		Entry: SolanaEntry,
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
		Header: AmberHeader,
		Entry: AmberEntry,
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
		Header: VaporwaveHeader,
		Entry: VaporwaveEntry,
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
		Header: OceanHeader,
		Entry: OceanEntry,
	},
	Sunset: {
		wrapper: {
			base: "mb-2 border-l-2",
			active: "bg-[#110808] border-[#e04028]/50",
			inactive: "bg-[#0a0505] border-[#7a3525]",
		},
		collapsed: {
			button:
				"sidebar-item flex items-center gap-2 w-full px-3 py-2 justify-center cursor-pointer border-none transition-all border-l-4",
			active: "text-[#fff0d8] bg-gradient-to-r from-[#e04028]/20 to-transparent border-[#e8a040]",
			inactive:
				"bg-transparent text-[#d04830] border-transparent hover:text-[#f0d8b0] hover:bg-[#180c0a]",
			label: "sidebar-header text-[12px] font-bold tracking-wide truncate",
			decorator: globe(
				"w-3 h-3",
				"bg-gradient-to-b from-[#e8a040] to-[#e04028] shadow-[0_0_10px_rgba(232,160,64,0.5)]",
				"bg-[#4d2418]",
			),
		},
		Header: SunsetHeader,
		Entry: SunsetEntry,
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
		Header: ArcticHeader,
		Entry: ArcticEntry,
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
