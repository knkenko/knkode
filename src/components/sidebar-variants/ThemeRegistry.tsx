import type { ReactNode } from "react";
import type { ThemePresetName } from "../../data/theme-presets";
import type { BasePaneEntryProps, BaseWorkspaceHeaderProps, ThemeVariantConfig } from "./types";
import {
	CatppuccinCollapsed,
	CatppuccinEntry,
	CatppuccinHeader,
	DefaultDarkCollapsed,
	DefaultDarkEntry,
	DefaultDarkHeader,
	DraculaCollapsed,
	DraculaEntry,
	DraculaHeader,
	EverforestCollapsed,
	EverforestEntry,
	EverforestHeader,
	GruvboxCollapsed,
	GruvboxEntry,
	GruvboxHeader,
	MonokaiCollapsed,
	MonokaiEntry,
	MonokaiHeader,
	NordCollapsed,
	NordEntry,
	NordHeader,
	TokyoNightCollapsed,
	TokyoNightEntry,
	TokyoNightHeader,
} from "./variants/ClassicThemes";
import {
	AmberCollapsed,
	AmberEntry,
	AmberHeader,
	ArcticCollapsed,
	ArcticEntry,
	ArcticHeader,
	CyberpunkCollapsed,
	CyberpunkEntry,
	CyberpunkHeader,
	MatrixCollapsed,
	MatrixEntry,
	MatrixHeader,
	OceanCollapsed,
	OceanEntry,
	OceanHeader,
	SolanaCollapsed,
	SolanaEntry,
	SolanaHeader,
	SunsetCollapsed,
	SunsetEntry,
	SunsetHeader,
	VaporwaveCollapsed,
	VaporwaveEntry,
	VaporwaveHeader,
} from "./variants/IdentityThemes";

// ── Variant Registry ─────────────────────────────────────────────
const VARIANT_REGISTRY: Record<ThemePresetName, ThemeVariantConfig> = {
	"Default Dark": {
		wrapper: {
			base: "mb-2 border-b transition-colors",
			active: "border-[#2a2f4a] bg-[#232946]/50",
			inactive: "border-[#2a2f4a] bg-[#0f1626]",
		},
		Header: DefaultDarkHeader,
		Entry: DefaultDarkEntry,
		Collapsed: DefaultDarkCollapsed,
	},
	Dracula: {
		wrapper: {
			base: "mb-2 mx-1 rounded-lg overflow-hidden transition-all duration-300",
			active: "bg-[#282a36] shadow-md border border-[#bd93f9]",
			inactive: "bg-[#1e1f29] border border-transparent",
		},
		Header: DraculaHeader,
		Entry: DraculaEntry,
		Collapsed: DraculaCollapsed,
	},
	"Tokyo Night": {
		wrapper: {
			base: "mb-2 overflow-hidden transition-all",
			active: "bg-[#1a1b26] border-l-2 border-[#7aa2f7]",
			inactive: "bg-[#16161e] border-l-2 border-transparent",
		},
		Header: TokyoNightHeader,
		Entry: TokyoNightEntry,
		Collapsed: TokyoNightCollapsed,
	},
	Nord: {
		wrapper: {
			base: "mb-2 mx-2 rounded-md overflow-hidden transition-all duration-300",
			active: "bg-[#2e3440] shadow-sm",
			inactive: "bg-[#242933]",
		},
		Header: NordHeader,
		Entry: NordEntry,
		Collapsed: NordCollapsed,
	},
	Catppuccin: {
		wrapper: {
			base: "mb-3 mx-1.5 rounded-xl overflow-hidden transition-all duration-300",
			active: "bg-[#1e1e2e] shadow-sm border border-[#313244]",
			inactive: "bg-[#11111b]",
		},
		Header: CatppuccinHeader,
		Entry: CatppuccinEntry,
		Collapsed: CatppuccinCollapsed,
	},
	Gruvbox: {
		wrapper: {
			base: "mb-2 border-b border-[#3c3836]",
			active: "bg-[#282828]",
			inactive: "bg-[#1d2021]",
		},
		Header: GruvboxHeader,
		Entry: GruvboxEntry,
		Collapsed: GruvboxCollapsed,
	},
	Monokai: {
		wrapper: {
			base: "mb-2 border-b border-[#3e3d32]",
			active: "bg-[#272822]",
			inactive: "bg-[#1e1f1c]",
		},
		Header: MonokaiHeader,
		Entry: MonokaiEntry,
		Collapsed: MonokaiCollapsed,
	},
	Everforest: {
		wrapper: {
			base: "mb-2 rounded-md overflow-hidden",
			active: "bg-[#2d353b] border border-[#3d474d]",
			inactive: "bg-[#232a2e]",
		},
		Header: EverforestHeader,
		Entry: EverforestEntry,
		Collapsed: EverforestCollapsed,
	},
	Matrix: {
		wrapper: {
			base: "mb-2 border border-[#00ff41]/20",
			active: "bg-[#0a0a0a] shadow-[0_0_10px_rgba(0,255,65,0.1)]",
			inactive: "bg-black",
		},
		Header: MatrixHeader,
		Entry: MatrixEntry,
		Collapsed: MatrixCollapsed,
	},
	Cyberpunk: {
		wrapper: {
			base: "mb-3 overflow-hidden",
			active: "bg-[#0d0221]",
			inactive: "bg-[#050014]",
		},
		Header: CyberpunkHeader,
		Entry: CyberpunkEntry,
		Collapsed: CyberpunkCollapsed,
	},
	Solana: {
		wrapper: {
			base: "mb-2 mx-1.5 rounded-2xl overflow-hidden transition-all duration-300",
			active: "bg-[#0c0c1d] shadow-[0_0_15px_rgba(153,69,255,0.15)] border border-[#1e1e3d]",
			inactive: "bg-[#050510] border border-transparent",
		},
		Header: SolanaHeader,
		Entry: SolanaEntry,
		Collapsed: SolanaCollapsed,
	},
	Amber: {
		wrapper: {
			base: "mb-2 border border-[#3d2800]",
			active: "bg-[#0c0800]",
			inactive: "bg-black",
		},
		Header: AmberHeader,
		Entry: AmberEntry,
		Collapsed: AmberCollapsed,
	},
	Vaporwave: {
		wrapper: {
			base: "mb-3 mx-1 rounded-md overflow-hidden",
			active: "bg-[#0a0015] shadow-[0_0_10px_rgba(255,113,206,0.15)] border border-[#2d1b4e]",
			inactive: "bg-[#05000a] border border-transparent",
		},
		Header: VaporwaveHeader,
		Entry: VaporwaveEntry,
		Collapsed: VaporwaveCollapsed,
	},
	Ocean: {
		wrapper: {
			base: "mb-2 mx-1 rounded-2xl overflow-hidden",
			active: "bg-[#020b14] shadow-[0_0_15px_rgba(0,200,255,0.1)] border border-[#0a2838]",
			inactive: "bg-[#01050a] border border-transparent",
		},
		Header: OceanHeader,
		Entry: OceanEntry,
		Collapsed: OceanCollapsed,
	},
	Sunset: {
		wrapper: {
			base: "mb-2",
			active: "bg-[#110808]",
			inactive: "bg-[#0a0505]",
		},
		Header: SunsetHeader,
		Entry: SunsetEntry,
		Collapsed: SunsetCollapsed,
	},
	Arctic: {
		wrapper: {
			base: "mb-2 mx-1 rounded-lg overflow-hidden",
			active: "bg-[#050d18] border border-[#1e3550] shadow-sm",
			inactive: "bg-[#02060c] border border-transparent",
		},
		Header: ArcticHeader,
		Entry: ArcticEntry,
		Collapsed: ArcticCollapsed,
	},
};

function getConfig(preset: ThemePresetName): ThemeVariantConfig {
	return VARIANT_REGISTRY[preset];
}

// ── Public API ───────────────────────────────────────────────────

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
	const { Collapsed } = getConfig(preset);
	return <Collapsed name={name} isActive={isActive} onClick={onClick} />;
}
