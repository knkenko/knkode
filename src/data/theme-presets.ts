import { type AnsiColors, effectMul, type PaneTheme, type SidebarTheme } from "../shared/types";
import { hexToRgba, isValidHex, resolveBackground } from "../utils/colors";

export type ThemePreset = Pick<
	PaneTheme,
	| "background"
	| "foreground"
	| "ansiColors"
	| "accent"
	| "glow"
	| "gradient"
	| "gradientLevel"
	| "glowLevel"
	| "scanlineLevel"
	| "noiseLevel"
	| "scrollbarAccent"
	| "cursorColor"
	| "selectionColor"
> &
	Partial<Pick<PaneTheme, "fontFamily" | "fontSize" | "lineHeight" | "statusBarPosition">> & {
		name: string;
		decoration?: string;
		sidebar?: SidebarTheme;
	};

/** Tango-based ANSI palette used by the Default Dark preset. */
export const DEFAULT_ANSI: AnsiColors = {
	black: "#000000",
	red: "#cc0000",
	green: "#4e9a06",
	yellow: "#c4a000",
	blue: "#3465a4",
	magenta: "#75507b",
	cyan: "#06989a",
	white: "#d3d7cf",
	brightBlack: "#555753",
	brightRed: "#ef2929",
	brightGreen: "#8ae234",
	brightYellow: "#fce94f",
	brightBlue: "#729fcf",
	brightMagenta: "#ad7fa8",
	brightCyan: "#34e2e2",
	brightWhite: "#eeeeec",
};

export const THEME_PRESETS = [
	// ── Standard themes (community palettes, minimal effects) ───
	{
		name: "Default Dark",
		background: "#1a1a2e",
		foreground: "#e0e0e0",
		fontFamily: "Cascadia Code",
		accent: "#6c63ff",
		ansiColors: DEFAULT_ANSI,
	},
	{
		name: "Dracula",
		background: "#282a36",
		foreground: "#f8f8f2",
		fontFamily: "Fira Code",
		accent: "#bd93f9",
		glow: "#bd93f9",
		ansiColors: {
			black: "#21222c",
			red: "#ff5555",
			green: "#50fa7b",
			yellow: "#f1fa8c",
			blue: "#bd93f9",
			magenta: "#ff79c6",
			cyan: "#8be9fd",
			white: "#f8f8f2",
			brightBlack: "#6272a4",
			brightRed: "#ff6e6e",
			brightGreen: "#69ff94",
			brightYellow: "#ffffa5",
			brightBlue: "#d6acff",
			brightMagenta: "#ff92df",
			brightCyan: "#a4ffff",
			brightWhite: "#ffffff",
		},

		sidebar: {
			glass: 4,
			borderStyle: "glow",
			borderColor: "#6272a4",
			accentGlow: true,
			itemRadius: 4,
			separatorStyle: "glow",
			separatorColor: "#6272a4",
			cardBg: "#2a2c36",
			cardBorder: "#363848",
			cardRadius: 6,
		},
	},
	{
		name: "Tokyo Night",
		background: "#1a1b26",
		foreground: "#a9b1d6",
		fontFamily: "Fira Code",
		accent: "#7aa2f7",
		glow: "#7aa2f7",
		ansiColors: {
			black: "#15161e",
			red: "#f7768e",
			green: "#9ece6a",
			yellow: "#e0af68",
			blue: "#7aa2f7",
			magenta: "#bb9af7",
			cyan: "#7dcfff",
			white: "#a9b1d6",
			brightBlack: "#414868",
			brightRed: "#f7768e",
			brightGreen: "#9ece6a",
			brightYellow: "#e0af68",
			brightBlue: "#7aa2f7",
			brightMagenta: "#bb9af7",
			brightCyan: "#7dcfff",
			brightWhite: "#c0caf5",
		},

		sidebar: {
			background: "#16161e",
			borderStyle: "solid",
			spacing: "compact",
			separatorStyle: "solid",
			separatorColor: "#24283b",
			cardBg: "#1c1d2a",
			cardBorder: "#24283b",
		},
	},
	{
		name: "Nord",
		background: "#2e3440",
		foreground: "#d8dee9",
		fontFamily: "Victor Mono",
		accent: "#88c0d0",
		ansiColors: {
			black: "#3b4252",
			red: "#bf616a",
			green: "#a3be8c",
			yellow: "#ebcb8b",
			blue: "#81a1c1",
			magenta: "#b48ead",
			cyan: "#88c0d0",
			white: "#e5e9f0",
			brightBlack: "#4c566a",
			brightRed: "#bf616a",
			brightGreen: "#a3be8c",
			brightYellow: "#ebcb8b",
			brightBlue: "#81a1c1",
			brightMagenta: "#b48ead",
			brightCyan: "#8fbcbb",
			brightWhite: "#eceff4",
		},

		sidebar: {
			glass: 6,
			borderStyle: "none",
			itemRadius: 6,
			spacing: "spacious",
			transition: "cubic-bezier(0.22, 1, 0.36, 1)",
			separatorStyle: "solid",
			separatorColor: "#3b4252",
			cardBg: "#2e3542",
			cardBorder: "#3b4252",
			cardRadius: 8,
		},
	},
	{
		name: "Catppuccin",
		background: "#1e1e2e",
		foreground: "#cdd6f4",
		fontFamily: "JetBrains Mono",
		accent: "#cba6f7",
		glow: "#cba6f7",
		ansiColors: {
			black: "#45475a",
			red: "#f38ba8",
			green: "#a6e3a1",
			yellow: "#f9e2af",
			blue: "#89b4fa",
			magenta: "#cba6f7",
			cyan: "#94e2d5",
			white: "#bac2de",
			brightBlack: "#585b70",
			brightRed: "#f38ba8",
			brightGreen: "#a6e3a1",
			brightYellow: "#f9e2af",
			brightBlue: "#89b4fa",
			brightMagenta: "#cba6f7",
			brightCyan: "#94e2d5",
			brightWhite: "#a6adc8",
		},

		sidebar: {
			glass: 3,
			borderStyle: "glow",
			borderColor: "#45475a",
			accentGlow: true,
			itemRadius: 4,
			spacing: "spacious",
			separatorStyle: "glow",
			separatorColor: "#45475a",
			cardBg: "#222236",
			cardBorder: "#313244",
			cardRadius: 8,
		},
	},
	{
		name: "Gruvbox",
		background: "#282828",
		foreground: "#ebdbb2",
		fontFamily: "IBM Plex Mono",
		accent: "#fe8019",
		selectionColor: "#d79921", // Gruvbox canonical yellow, not accent orange
		ansiColors: {
			black: "#282828",
			red: "#cc241d",
			green: "#98971a",
			yellow: "#d79921",
			blue: "#458588",
			magenta: "#b16286",
			cyan: "#689d6a",
			white: "#a89984",
			brightBlack: "#928374",
			brightRed: "#fb4934",
			brightGreen: "#b8bb26",
			brightYellow: "#fabd2f",
			brightBlue: "#83a598",
			brightMagenta: "#d3869b",
			brightCyan: "#8ec07c",
			brightWhite: "#ebdbb2",
		},

		sidebar: {
			background: "#1d2021",
			borderStyle: "solid",
			borderColor: "#3c3836",
			itemRadius: 0,
			spacing: "compact",
			separatorStyle: "solid",
			separatorColor: "#3c3836",
			cardBg: "#252627",
			cardBorder: "#3c3836",
			cardRadius: 0,
		},
	},
	{
		name: "Monokai",
		background: "#272822",
		foreground: "#f8f8f2",
		fontFamily: "Source Code Pro",
		accent: "#a6e22e",
		selectionColor: "#75715e", // Monokai comment gray — #49483e is too close to background
		ansiColors: {
			black: "#272822",
			red: "#f92672",
			green: "#a6e22e",
			yellow: "#f4bf75",
			blue: "#66d9ef",
			magenta: "#ae81ff",
			cyan: "#a1efe4",
			white: "#f8f8f2",
			brightBlack: "#75715e",
			brightRed: "#f92672",
			brightGreen: "#a6e22e",
			brightYellow: "#f4bf75",
			brightBlue: "#66d9ef",
			brightMagenta: "#ae81ff",
			brightCyan: "#a1efe4",
			brightWhite: "#f9f8f5",
		},

		sidebar: {
			background: "#1e1f1c",
			borderStyle: "solid",
			borderColor: "#3e3d32",
			itemRadius: 0,
			spacing: "compact",
			separatorStyle: "solid",
			separatorColor: "#3e3d32",
			cardBg: "#252620",
			cardBorder: "#3e3d32",
			cardRadius: 0,
		},
	},
	{
		name: "Everforest",
		background: "#2d353b",
		foreground: "#d3c6aa",
		fontFamily: "Hack",
		accent: "#a7c080",
		ansiColors: {
			black: "#343f44",
			red: "#e67e80",
			green: "#a7c080",
			yellow: "#dbbc7f",
			blue: "#7fbbb3",
			magenta: "#d699b6",
			cyan: "#83c092",
			white: "#d3c6aa",
			brightBlack: "#4a555b",
			brightRed: "#e67e80",
			brightGreen: "#a7c080",
			brightYellow: "#dbbc7f",
			brightBlue: "#7fbbb3",
			brightMagenta: "#d699b6",
			brightCyan: "#83c092",
			brightWhite: "#e4dcd4",
		},

		sidebar: {
			borderStyle: "solid",
			itemRadius: 4,
			separatorStyle: "solid",
			separatorColor: "#3d474d",
			cardBg: "#313b42",
			cardBorder: "#3d474d",
			cardRadius: 4,
		},
	},
	// ── Identity themes (gradient, decoration, glow/scanline/noise effects) ──
	{
		name: "Matrix",
		background: "#0a0a0a",
		foreground: "#00ff41",
		fontFamily: "IBM Plex Mono",
		accent: "#00ff41",
		glow: "#00ff41",
		gradient: "linear-gradient(180deg, rgba(0, 255, 65, 0.3) 0%, transparent 40%)",
		gradientLevel: "medium",
		glowLevel: "medium",
		scanlineLevel: "subtle",
		noiseLevel: "subtle",
		scrollbarAccent: "medium",
		cursorColor: "#00ff41",
		selectionColor: "#00ff41",
		decoration:
			'url("data:image/svg+xml,%3Csvg%20width%3D%22256%22%20height%3D%22256%22%20viewBox%3D%220%200%20256%20256%22%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%3E%0A%3Cstyle%3E%0A%20%20%20%20.t%20%7B%20font-family%3A%20monospace%3B%20font-size%3A%2012px%3B%20fill%3A%20%2300ff41%3B%20%7D%0A%20%20%20%20.w%20%7B%20fill%3A%20%2300ff41%3B%20fill-opacity%3A%200.30%3B%20%7D%0A%3C%2Fstyle%3E%0A%3Cg%20class%3D%22t%22%3E%3Ctext%20x%3D%2212%22%20y%3D%22-20%22%20fill-opacity%3D%220.00%22%3E%EF%BD%B6%3C%2Ftext%3E%3Ctext%20x%3D%2212%22%20y%3D%22-6%22%20fill-opacity%3D%220.01%22%3E%EF%BE%95%3C%2Ftext%3E%3Ctext%20x%3D%2212%22%20y%3D%228%22%20fill-opacity%3D%220.02%22%3E%EF%BE%8D%3C%2Ftext%3E%3Ctext%20x%3D%2212%22%20y%3D%2222%22%20fill-opacity%3D%220.04%22%3E%EF%BE%93%3C%2Ftext%3E%3Ctext%20x%3D%2212%22%20y%3D%2236%22%20fill-opacity%3D%220.05%22%3E%EF%BE%8D%3C%2Ftext%3E%3Ctext%20x%3D%2212%22%20y%3D%2250%22%20fill-opacity%3D%220.06%22%3E%EF%BE%92%3C%2Ftext%3E%3Ctext%20x%3D%2212%22%20y%3D%2264%22%20fill-opacity%3D%220.07%22%3E%EF%BD%BD%3C%2Ftext%3E%3Ctext%20x%3D%2212%22%20y%3D%2278%22%20fill-opacity%3D%220.09%22%3E1%3C%2Ftext%3E%3Ctext%20x%3D%2212%22%20y%3D%2292%22%20fill-opacity%3D%220.10%22%3E%EF%BD%B7%3C%2Ftext%3E%3Ctext%20x%3D%2212%22%20y%3D%22106%22%20fill-opacity%3D%220.11%22%3E%EF%BE%95%3C%2Ftext%3E%3Ctext%20x%3D%2212%22%20y%3D%22120%22%20fill-opacity%3D%220.13%22%3E%EF%BE%91%3C%2Ftext%3E%3Ctext%20x%3D%2212%22%20y%3D%22134%22%20class%3D%22w%22%3E%EF%BD%B6%3C%2Ftext%3E%3Ctext%20x%3D%2238%22%20y%3D%2240%22%20fill-opacity%3D%220.00%22%3E%EF%BE%97%3C%2Ftext%3E%3Ctext%20x%3D%2238%22%20y%3D%2254%22%20fill-opacity%3D%220.02%22%3E0%3C%2Ftext%3E%3Ctext%20x%3D%2238%22%20y%3D%2268%22%20fill-opacity%3D%220.03%22%3E%EF%BD%B5%3C%2Ftext%3E%3Ctext%20x%3D%2238%22%20y%3D%2282%22%20fill-opacity%3D%220.05%22%3E%EF%BD%BB%3C%2Ftext%3E%3Ctext%20x%3D%2238%22%20y%3D%2296%22%20fill-opacity%3D%220.07%22%3E%EF%BD%B6%3C%2Ftext%3E%3Ctext%20x%3D%2238%22%20y%3D%22110%22%20fill-opacity%3D%220.08%22%3E%EF%BE%82%3C%2Ftext%3E%3Ctext%20x%3D%2238%22%20y%3D%22124%22%20fill-opacity%3D%220.10%22%3E%EF%BE%80%3C%2Ftext%3E%3Ctext%20x%3D%2238%22%20y%3D%22138%22%20fill-opacity%3D%220.12%22%3E1%3C%2Ftext%3E%3Ctext%20x%3D%2238%22%20y%3D%22152%22%20fill-opacity%3D%220.13%22%3E%EF%BE%8D%3C%2Ftext%3E%3Ctext%20x%3D%2238%22%20y%3D%22166%22%20fill-opacity%3D%220.15%22%3E%EF%BE%8A%3C%2Ftext%3E%3Ctext%20x%3D%2238%22%20y%3D%22180%22%20fill-opacity%3D%220.17%22%3E%EF%BE%85%3C%2Ftext%3E%3Ctext%20x%3D%2238%22%20y%3D%22194%22%20fill-opacity%3D%220.18%22%3E%EF%BE%9C%3C%2Ftext%3E%3Ctext%20x%3D%2238%22%20y%3D%22208%22%20fill-opacity%3D%220.20%22%3E%EF%BE%8E%3C%2Ftext%3E%3Ctext%20x%3D%2238%22%20y%3D%22222%22%20fill-opacity%3D%220.22%22%3E%EF%BD%BE%3C%2Ftext%3E%3Ctext%20x%3D%2238%22%20y%3D%22236%22%20class%3D%22w%22%3E%EF%BE%87%3C%2Ftext%3E%3Ctext%20x%3D%2268%22%20y%3D%2210%22%20fill-opacity%3D%220.00%22%3E%EF%BE%8D%3C%2Ftext%3E%3Ctext%20x%3D%2268%22%20y%3D%2224%22%20fill-opacity%3D%220.01%22%3E%EF%BE%95%3C%2Ftext%3E%3Ctext%20x%3D%2268%22%20y%3D%2238%22%20fill-opacity%3D%220.03%22%3E%EF%BE%83%3C%2Ftext%3E%3Ctext%20x%3D%2268%22%20y%3D%2252%22%20fill-opacity%3D%220.04%22%3E%EF%BE%8A%3C%2Ftext%3E%3Ctext%20x%3D%2268%22%20y%3D%2266%22%20fill-opacity%3D%220.05%22%3E%EF%BE%86%3C%2Ftext%3E%3Ctext%20x%3D%2268%22%20y%3D%2280%22%20fill-opacity%3D%220.06%22%3E%EF%BE%88%3C%2Ftext%3E%3Ctext%20x%3D%2268%22%20y%3D%2294%22%20fill-opacity%3D%220.08%22%3E%EF%BE%86%3C%2Ftext%3E%3Ctext%20x%3D%2268%22%20y%3D%22108%22%20class%3D%22w%22%3E%EF%BE%8F%3C%2Ftext%3E%3Ctext%20x%3D%2292%22%20y%3D%2290%22%20fill-opacity%3D%220.00%22%3E1%3C%2Ftext%3E%3Ctext%20x%3D%2292%22%20y%3D%22104%22%20fill-opacity%3D%220.02%22%3E%EF%BD%B0%3C%2Ftext%3E%3Ctext%20x%3D%2292%22%20y%3D%22118%22%20fill-opacity%3D%220.03%22%3E%EF%BE%85%3C%2Ftext%3E%3Ctext%20x%3D%2292%22%20y%3D%22132%22%20fill-opacity%3D%220.05%22%3E%EF%BE%8A%3C%2Ftext%3E%3Ctext%20x%3D%2292%22%20y%3D%22146%22%20fill-opacity%3D%220.07%22%3E%EF%BE%82%3C%2Ftext%3E%3Ctext%20x%3D%2292%22%20y%3D%22160%22%20fill-opacity%3D%220.08%22%3E%EF%BD%B0%3C%2Ftext%3E%3Ctext%20x%3D%2292%22%20y%3D%22174%22%20fill-opacity%3D%220.10%22%3E%EF%BD%B1%3C%2Ftext%3E%3Ctext%20x%3D%2292%22%20y%3D%22188%22%20fill-opacity%3D%220.12%22%3E%EF%BD%BC%3C%2Ftext%3E%3Ctext%20x%3D%2292%22%20y%3D%22202%22%20fill-opacity%3D%220.13%22%3E%EF%BD%BE%3C%2Ftext%3E%3Ctext%20x%3D%2292%22%20y%3D%22216%22%20fill-opacity%3D%220.15%22%3E%EF%BE%9C%3C%2Ftext%3E%3Ctext%20x%3D%2292%22%20y%3D%22230%22%20fill-opacity%3D%220.17%22%3E%EF%BD%B1%3C%2Ftext%3E%3Ctext%20x%3D%2292%22%20y%3D%22244%22%20fill-opacity%3D%220.18%22%3E%EF%BE%83%3C%2Ftext%3E%3Ctext%20x%3D%2292%22%20y%3D%22258%22%20fill-opacity%3D%220.20%22%3E%EF%BE%8A%3C%2Ftext%3E%3Ctext%20x%3D%2292%22%20y%3D%22272%22%20fill-opacity%3D%220.22%22%3E%EF%BD%BD%3C%2Ftext%3E%3Ctext%20x%3D%2292%22%20y%3D%22286%22%20fill-opacity%3D%220.23%22%3E%EF%BE%8D%3C%2Ftext%3E%3Ctext%20x%3D%2292%22%20y%3D%22300%22%20fill-opacity%3D%220.25%22%3E%EF%BD%B0%3C%2Ftext%3E%3Ctext%20x%3D%2292%22%20y%3D%22314%22%20fill-opacity%3D%220.27%22%3E%EF%BD%B5%3C%2Ftext%3E%3Ctext%20x%3D%2292%22%20y%3D%22328%22%20class%3D%22w%22%3E%EF%BD%B3%3C%2Ftext%3E%3Ctext%20x%3D%22122%22%20y%3D%22-10%22%20fill-opacity%3D%220.00%22%3E%EF%BD%B1%3C%2Ftext%3E%3Ctext%20x%3D%22122%22%20y%3D%224%22%20fill-opacity%3D%220.01%22%3E%EF%BE%82%3C%2Ftext%3E%3Ctext%20x%3D%22122%22%20y%3D%2218%22%20fill-opacity%3D%220.03%22%3E%EF%BE%82%3C%2Ftext%3E%3Ctext%20x%3D%22122%22%20y%3D%2232%22%20fill-opacity%3D%220.04%22%3E%EF%BE%92%3C%2Ftext%3E%3Ctext%20x%3D%22122%22%20y%3D%2246%22%20fill-opacity%3D%220.06%22%3E%EF%BE%98%3C%2Ftext%3E%3Ctext%20x%3D%22122%22%20y%3D%2260%22%20fill-opacity%3D%220.07%22%3E%EF%BE%87%3C%2Ftext%3E%3Ctext%20x%3D%22122%22%20y%3D%2274%22%20fill-opacity%3D%220.09%22%3E%EF%BE%91%3C%2Ftext%3E%3Ctext%20x%3D%22122%22%20y%3D%2288%22%20fill-opacity%3D%220.10%22%3E%EF%BD%BB%3C%2Ftext%3E%3Ctext%20x%3D%22122%22%20y%3D%22102%22%20fill-opacity%3D%220.11%22%3E0%3C%2Ftext%3E%3Ctext%20x%3D%22122%22%20y%3D%22116%22%20fill-opacity%3D%220.13%22%3E%EF%BE%8B%3C%2Ftext%3E%3Ctext%20x%3D%22122%22%20y%3D%22130%22%20fill-opacity%3D%220.14%22%3E%EF%BE%91%3C%2Ftext%3E%3Ctext%20x%3D%22122%22%20y%3D%22144%22%20fill-opacity%3D%220.16%22%3E%EF%BD%BE%3C%2Ftext%3E%3Ctext%20x%3D%22122%22%20y%3D%22158%22%20fill-opacity%3D%220.17%22%3E%EF%BD%BC%3C%2Ftext%3E%3Ctext%20x%3D%22122%22%20y%3D%22172%22%20class%3D%22w%22%3E0%3C%2Ftext%3E%3Ctext%20x%3D%22152%22%20y%3D%2260%22%20fill-opacity%3D%220.00%22%3E%EF%BE%87%3C%2Ftext%3E%3Ctext%20x%3D%22152%22%20y%3D%2274%22%20fill-opacity%3D%220.01%22%3E%EF%BE%98%3C%2Ftext%3E%3Ctext%20x%3D%22152%22%20y%3D%2288%22%20fill-opacity%3D%220.03%22%3E%EF%BE%90%3C%2Ftext%3E%3Ctext%20x%3D%22152%22%20y%3D%22102%22%20fill-opacity%3D%220.04%22%3E%EF%BE%95%3C%2Ftext%3E%3Ctext%20x%3D%22152%22%20y%3D%22116%22%20fill-opacity%3D%220.06%22%3E%EF%BD%BD%3C%2Ftext%3E%3Ctext%20x%3D%22152%22%20y%3D%22130%22%20fill-opacity%3D%220.07%22%3E%EF%BE%87%3C%2Ftext%3E%3Ctext%20x%3D%22152%22%20y%3D%22144%22%20fill-opacity%3D%220.09%22%3E%EF%BE%8F%3C%2Ftext%3E%3Ctext%20x%3D%22152%22%20y%3D%22158%22%20fill-opacity%3D%220.10%22%3E%EF%BD%BC%3C%2Ftext%3E%3Ctext%20x%3D%22152%22%20y%3D%22172%22%20fill-opacity%3D%220.12%22%3E%EF%BE%85%3C%2Ftext%3E%3Ctext%20x%3D%22152%22%20y%3D%22186%22%20class%3D%22w%22%3E%EF%BD%B9%3C%2Ftext%3E%3Ctext%20x%3D%22178%22%20y%3D%2220%22%20fill-opacity%3D%220.00%22%3E%EF%BD%B6%3C%2Ftext%3E%3Ctext%20x%3D%22178%22%20y%3D%2234%22%20fill-opacity%3D%220.02%22%3E%EF%BE%8F%3C%2Ftext%3E%3Ctext%20x%3D%22178%22%20y%3D%2248%22%20fill-opacity%3D%220.03%22%3E%EF%BD%B9%3C%2Ftext%3E%3Ctext%20x%3D%22178%22%20y%3D%2262%22%20fill-opacity%3D%220.05%22%3E%EF%BE%80%3C%2Ftext%3E%3Ctext%20x%3D%22178%22%20y%3D%2276%22%20fill-opacity%3D%220.06%22%3E%EF%BE%85%3C%2Ftext%3E%3Ctext%20x%3D%22178%22%20y%3D%2290%22%20fill-opacity%3D%220.08%22%3E%EF%BE%90%3C%2Ftext%3E%3Ctext%20x%3D%22178%22%20y%3D%22104%22%20fill-opacity%3D%220.09%22%3E%EF%BD%BD%3C%2Ftext%3E%3Ctext%20x%3D%22178%22%20y%3D%22118%22%20fill-opacity%3D%220.11%22%3E%EF%BD%B7%3C%2Ftext%3E%3Ctext%20x%3D%22178%22%20y%3D%22132%22%20fill-opacity%3D%220.13%22%3E%EF%BE%80%3C%2Ftext%3E%3Ctext%20x%3D%22178%22%20y%3D%22146%22%20fill-opacity%3D%220.14%22%3E%EF%BE%80%3C%2Ftext%3E%3Ctext%20x%3D%22178%22%20y%3D%22160%22%20fill-opacity%3D%220.16%22%3E1%3C%2Ftext%3E%3Ctext%20x%3D%22178%22%20y%3D%22174%22%20fill-opacity%3D%220.17%22%3E%EF%BD%B9%3C%2Ftext%3E%3Ctext%20x%3D%22178%22%20y%3D%22188%22%20fill-opacity%3D%220.19%22%3E%EF%BD%BE%3C%2Ftext%3E%3Ctext%20x%3D%22178%22%20y%3D%22202%22%20fill-opacity%3D%220.20%22%3E%EF%BE%90%3C%2Ftext%3E%3Ctext%20x%3D%22178%22%20y%3D%22216%22%20fill-opacity%3D%220.22%22%3E%EF%BD%B1%3C%2Ftext%3E%3Ctext%20x%3D%22178%22%20y%3D%22230%22%20class%3D%22w%22%3E%EF%BE%9C%3C%2Ftext%3E%3Ctext%20x%3D%22208%22%20y%3D%22110%22%20fill-opacity%3D%220.00%22%3E%EF%BE%8D%3C%2Ftext%3E%3Ctext%20x%3D%22208%22%20y%3D%22124%22%20fill-opacity%3D%220.01%22%3E0%3C%2Ftext%3E%3Ctext%20x%3D%22208%22%20y%3D%22138%22%20fill-opacity%3D%220.02%22%3E%EF%BE%80%3C%2Ftext%3E%3Ctext%20x%3D%22208%22%20y%3D%22152%22%20fill-opacity%3D%220.03%22%3E%EF%BE%82%3C%2Ftext%3E%3Ctext%20x%3D%22208%22%20y%3D%22166%22%20fill-opacity%3D%220.03%22%3E%EF%BE%9C%3C%2Ftext%3E%3Ctext%20x%3D%22208%22%20y%3D%22180%22%20fill-opacity%3D%220.04%22%3E%EF%BE%90%3C%2Ftext%3E%3Ctext%20x%3D%22208%22%20y%3D%22194%22%20fill-opacity%3D%220.05%22%3E%EF%BD%B1%3C%2Ftext%3E%3Ctext%20x%3D%22208%22%20y%3D%22208%22%20fill-opacity%3D%220.06%22%3E%EF%BE%85%3C%2Ftext%3E%3Ctext%20x%3D%22208%22%20y%3D%22222%22%20fill-opacity%3D%220.07%22%3E%EF%BE%8A%3C%2Ftext%3E%3Ctext%20x%3D%22208%22%20y%3D%22236%22%20fill-opacity%3D%220.08%22%3E%EF%BE%9C%3C%2Ftext%3E%3Ctext%20x%3D%22208%22%20y%3D%22250%22%20fill-opacity%3D%220.08%22%3E%EF%BE%9C%3C%2Ftext%3E%3Ctext%20x%3D%22208%22%20y%3D%22264%22%20class%3D%22w%22%3E%EF%BE%8D%3C%2Ftext%3E%3Ctext%20x%3D%22232%22%20y%3D%2230%22%20fill-opacity%3D%220.00%22%3E%EF%BE%82%3C%2Ftext%3E%3Ctext%20x%3D%22232%22%20y%3D%2244%22%20fill-opacity%3D%220.01%22%3E%EF%BE%87%3C%2Ftext%3E%3Ctext%20x%3D%22232%22%20y%3D%2258%22%20fill-opacity%3D%220.02%22%3E%EF%BD%BB%3C%2Ftext%3E%3Ctext%20x%3D%22232%22%20y%3D%2272%22%20fill-opacity%3D%220.03%22%3E%EF%BE%97%3C%2Ftext%3E%3Ctext%20x%3D%22232%22%20y%3D%2286%22%20fill-opacity%3D%220.04%22%3E%EF%BD%BB%3C%2Ftext%3E%3Ctext%20x%3D%22232%22%20y%3D%22100%22%20fill-opacity%3D%220.05%22%3E%EF%BE%86%3C%2Ftext%3E%3Ctext%20x%3D%22232%22%20y%3D%22114%22%20fill-opacity%3D%220.06%22%3E%EF%BE%8D%3C%2Ftext%3E%3Ctext%20x%3D%22232%22%20y%3D%22128%22%20fill-opacity%3D%220.07%22%3E%EF%BE%9C%3C%2Ftext%3E%3Ctext%20x%3D%22232%22%20y%3D%22142%22%20fill-opacity%3D%220.08%22%3E%EF%BE%8D%3C%2Ftext%3E%3Ctext%20x%3D%22232%22%20y%3D%22156%22%20fill-opacity%3D%220.09%22%3E%EF%BE%8F%3C%2Ftext%3E%3Ctext%20x%3D%22232%22%20y%3D%22170%22%20fill-opacity%3D%220.10%22%3E%EF%BE%8D%3C%2Ftext%3E%3Ctext%20x%3D%22232%22%20y%3D%22184%22%20fill-opacity%3D%220.11%22%3E%EF%BE%97%3C%2Ftext%3E%3Ctext%20x%3D%22232%22%20y%3D%22198%22%20fill-opacity%3D%220.12%22%3E0%3C%2Ftext%3E%3Ctext%20x%3D%22232%22%20y%3D%22212%22%20fill-opacity%3D%220.13%22%3E%EF%BD%B4%3C%2Ftext%3E%3Ctext%20x%3D%22232%22%20y%3D%22226%22%20fill-opacity%3D%220.14%22%3E%EF%BE%8A%3C%2Ftext%3E%3Ctext%20x%3D%22232%22%20y%3D%22240%22%20fill-opacity%3D%220.15%22%3E%EF%BE%90%3C%2Ftext%3E%3Ctext%20x%3D%22232%22%20y%3D%22254%22%20fill-opacity%3D%220.16%22%3E%EF%BD%B5%3C%2Ftext%3E%3Ctext%20x%3D%22232%22%20y%3D%22268%22%20fill-opacity%3D%220.17%22%3E%EF%BE%8D%3C%2Ftext%3E%3Ctext%20x%3D%22232%22%20y%3D%22282%22%20fill-opacity%3D%220.18%22%3E%EF%BE%80%3C%2Ftext%3E%3Ctext%20x%3D%22232%22%20y%3D%22296%22%20class%3D%22w%22%3E1%3C%2Ftext%3E%3C%2Fg%3E%3C%2Fsvg%3E")',
		ansiColors: {
			black: "#0a0a0a",
			red: "#00cc33",
			green: "#00ff41",
			yellow: "#33ff77",
			blue: "#009933",
			magenta: "#00ff99",
			cyan: "#66ffcc",
			white: "#b3ffb3",
			brightBlack: "#1a4d2e",
			brightRed: "#00ff66",
			brightGreen: "#39ff14",
			brightYellow: "#99ffcc",
			brightBlue: "#00cc66",
			brightMagenta: "#33ff99",
			brightCyan: "#66ffaa",
			brightWhite: "#ccffcc",
		},

		sidebar: {
			background: "#050505",
			borderStyle: "glow",
			borderColor: "#00ff41",
			itemRadius: 0,
			spacing: "compact",
			accentGlow: true,
			transition: "linear",
			textTransform: "uppercase",
			letterSpacing: 0.1,
			headerWeight: "bold",
			separatorStyle: "glow",
			separatorColor: "#00ff41",
			cardBg: "#080808",
			cardBorder: "#0a1f0d",
			cardRadius: 0,
		},
	},
	{
		name: "Cyberpunk",
		background: "#0d0221",
		foreground: "#f0e6ff",
		fontFamily: "Fira Code",
		accent: "#ff2a6d",
		glow: "#ff2a6d",
		gradient: "linear-gradient(135deg, rgba(255, 42, 109, 0.3) 0%, rgba(5, 217, 232, 0.2) 100%)",
		gradientLevel: "medium",
		glowLevel: "medium",
		statusBarPosition: "bottom",
		scrollbarAccent: "medium",
		cursorColor: "#ff2a6d",
		selectionColor: "#05d9e8",
		decoration:
			"linear-gradient(135deg, transparent 60%, rgba(255,42,109,0.1) 75%, rgba(255,42,109,0.06) 100%) no-repeat, linear-gradient(315deg, transparent 70%, rgba(5,217,232,0.07) 85%, rgba(5,217,232,0.04) 100%) no-repeat",
		ansiColors: {
			black: "#0d0221",
			red: "#ff2a6d",
			green: "#05d9e8",
			yellow: "#fef08a",
			blue: "#01c5c4",
			magenta: "#b967ff",
			cyan: "#05d9e8",
			white: "#f0e6ff",
			brightBlack: "#2e1065",
			brightRed: "#ff6e96",
			brightGreen: "#44f1f4",
			brightYellow: "#fff59d",
			brightBlue: "#7df9ff",
			brightMagenta: "#d4aaff",
			brightCyan: "#76f4f8",
			brightWhite: "#ffffff",
		},

		sidebar: {
			glass: 8,
			borderStyle: "gradient",
			shadow: "2px 0 12px rgba(255, 42, 109, 0.2)",
			accentGlow: true,
			itemRadius: 2,
			transition: "cubic-bezier(0.4, 0, 0.2, 1)",
			textTransform: "uppercase",
			letterSpacing: 0.15,
			headerWeight: "bold",
			separatorStyle: "gradient",
			cardBg: "#130228",
			cardBorder: "#2a0550",
			cardRadius: 2,
		},
	},
	{
		name: "Solana",
		background: "#0c0c1d",
		foreground: "#e0e0f0",
		fontFamily: "Roboto Mono",
		accent: "#9945ff",
		glow: "#14f195",
		gradient: "linear-gradient(160deg, rgba(153, 69, 255, 0.3) 0%, rgba(20, 241, 149, 0.2) 100%)",
		gradientLevel: "medium",
		glowLevel: "medium",
		scrollbarAccent: "medium",
		cursorColor: "#14f195",
		selectionColor: "#9945ff",
		decoration:
			"radial-gradient(circle at 82% 27%, rgba(153,69,255,0.07) 0%, transparent 40%), radial-gradient(circle at 18% 80%, rgba(20,241,149,0.05) 0%, transparent 35%)",
		ansiColors: {
			black: "#0c0c1d",
			red: "#ff6b6b",
			green: "#14f195",
			yellow: "#ffd93d",
			blue: "#9945ff",
			magenta: "#c77dff",
			cyan: "#00d4aa",
			white: "#e0e0f0",
			brightBlack: "#3d3d5c",
			brightRed: "#ff8a8a",
			brightGreen: "#47f5ad",
			brightYellow: "#ffe066",
			brightBlue: "#b380ff",
			brightMagenta: "#daa6ff",
			brightCyan: "#33e6c0",
			brightWhite: "#f5f5ff",
		},

		sidebar: {
			glass: 6,
			borderStyle: "gradient",
			accentGlow: true,
			itemRadius: 4,
			separatorStyle: "gradient",
			cardBg: "#0f0f24",
			cardBorder: "#1e1e3d",
			cardRadius: 6,
		},
	},
	{
		name: "Amber",
		background: "#0c0800",
		foreground: "#ffb000",
		fontFamily: "IBM Plex Mono",
		accent: "#ffb000",
		glow: "#ffb000",
		gradient: "linear-gradient(180deg, rgba(255, 176, 0, 0.25) 0%, transparent 40%)",
		gradientLevel: "medium",
		glowLevel: "medium",
		scanlineLevel: "subtle",
		noiseLevel: "subtle",
		scrollbarAccent: "medium",
		cursorColor: "#ffb000",
		selectionColor: "#e09000",
		decoration:
			"radial-gradient(ellipse 70% 70% at 50% 50%, rgba(255,176,0,0.06) 0%, transparent 60%)",
		ansiColors: {
			black: "#0c0800",
			red: "#cc7a00",
			green: "#ffb000",
			yellow: "#ffcc44",
			blue: "#8a5a10",
			magenta: "#e09000",
			cyan: "#d4a030",
			white: "#ffe0a0",
			brightBlack: "#5c3d10",
			brightRed: "#ff9020",
			brightGreen: "#ffbb33",
			brightYellow: "#ffdd77",
			brightBlue: "#b37a00",
			brightMagenta: "#ffcc55",
			brightCyan: "#e8b040",
			brightWhite: "#fff2d5",
		},

		sidebar: {
			background: "#080500",
			borderStyle: "solid",
			borderColor: "#3d2800",
			itemRadius: 0,
			spacing: "compact",
			transition: "linear",
			textTransform: "uppercase",
			letterSpacing: 0.08,
			headerWeight: "bold",
			separatorStyle: "dashed",
			separatorColor: "#3d2800",
			cardBg: "#0c0900",
			cardBorder: "#2a1c00",
			cardRadius: 0,
		},
	},
	{
		name: "Vaporwave",
		background: "#0a0015",
		foreground: "#f0d0ff",
		fontFamily: "Ubuntu Mono",
		accent: "#ff2d95",
		glow: "#ff71ce",
		gradient:
			"linear-gradient(135deg, rgba(255, 45, 149, 0.3) 0%, rgba(1, 205, 254, 0.2) 50%, rgba(123, 47, 255, 0.25) 100%)",
		gradientLevel: "medium",
		glowLevel: "intense",
		statusBarPosition: "bottom",
		scrollbarAccent: "medium",
		cursorColor: "#01cdfe",
		selectionColor: "#7b2fff",
		decoration:
			"linear-gradient(0deg, rgba(255,113,206,0.06) 0px, rgba(255,113,206,0.06) 1px, transparent 1px) no-repeat 0 68% / 100% 1px, linear-gradient(0deg, rgba(255,113,206,0.06) 0px, rgba(255,113,206,0.06) 1px, transparent 1px) no-repeat 0 78% / 100% 1px, linear-gradient(0deg, rgba(255,113,206,0.06) 0px, rgba(255,113,206,0.06) 1px, transparent 1px) no-repeat 0 90% / 100% 1px, linear-gradient(180deg, transparent 60%, rgba(123,47,255,0.06) 100%)",
		ansiColors: {
			black: "#0a0015",
			red: "#ff2d95",
			green: "#05ffa1",
			yellow: "#ffe900",
			blue: "#7b2fff",
			magenta: "#ff71ce",
			cyan: "#01cdfe",
			white: "#f0d0ff",
			brightBlack: "#2d1b4e",
			brightRed: "#ff6eb4",
			brightGreen: "#44ffbb",
			brightYellow: "#fffc7e",
			brightBlue: "#a855f7",
			brightMagenta: "#ff9de2",
			brightCyan: "#67e8f9",
			brightWhite: "#ffffff",
		},

		sidebar: {
			glass: 10,
			borderStyle: "gradient",
			accentGlow: true,
			itemRadius: 6,
			spacing: "spacious",
			transition: "cubic-bezier(0.22, 1, 0.36, 1)",
			separatorStyle: "gradient",
			cardBg: "#100024",
			cardBorder: "#220050",
			cardRadius: 8,
		},
	},
	{
		name: "Ocean",
		background: "#020b14",
		foreground: "#a0d8e8",
		fontFamily: "JetBrains Mono",
		accent: "#00c8ff",
		glow: "#00e5b0",
		gradient:
			"linear-gradient(180deg, rgba(0, 200, 255, 0.2) 0%, rgba(0, 229, 176, 0.1) 30%, transparent 60%)",
		gradientLevel: "medium",
		glowLevel: "medium",
		scrollbarAccent: "medium",
		cursorColor: "#00e5b0",
		selectionColor: "#0070a0",
		decoration:
			"radial-gradient(ellipse 50% 50% at 30% 40%, rgba(0,200,255,0.08) 0%, transparent 50%)",
		ansiColors: {
			black: "#020b14",
			red: "#1e8fa0",
			green: "#00e5b0",
			yellow: "#4dd8e0",
			blue: "#0070a0",
			magenta: "#3a80b8",
			cyan: "#00c8ff",
			white: "#b0d8e8",
			brightBlack: "#14384f",
			brightRed: "#40b8cc",
			brightGreen: "#30ffc8",
			brightYellow: "#78e8ee",
			brightBlue: "#2890b8",
			brightMagenta: "#5aa0cc",
			brightCyan: "#44d8f0",
			brightWhite: "#d0eff8",
		},

		sidebar: {
			glass: 8,
			borderStyle: "none",
			shadow: "1px 0 16px rgba(0, 200, 255, 0.12)",
			itemRadius: 4,
			separatorStyle: "glow",
			separatorColor: "#0070a0",
			cardBg: "#051218",
			cardBorder: "#0a2838",
			cardRadius: 6,
		},
	},
	{
		name: "Sunset",
		background: "#110808",
		foreground: "#f0d0a0",
		fontFamily: "Hack",
		accent: "#e8a040",
		glow: "#e04028",
		gradient:
			"linear-gradient(180deg, rgba(255, 192, 64, 0.25) 0%, rgba(224, 64, 40, 0.15) 50%, transparent 80%)",
		gradientLevel: "medium",
		glowLevel: "medium",
		noiseLevel: "subtle",
		scrollbarAccent: "medium",
		cursorColor: "#ffc040",
		selectionColor: "#e04028",
		decoration:
			"radial-gradient(ellipse 60% 60% at 50% 20%, rgba(232,160,64,0.08) 0%, transparent 50%)",
		ansiColors: {
			black: "#110808",
			red: "#e04028",
			green: "#e09838",
			yellow: "#ffc040",
			blue: "#b83820",
			magenta: "#cc6038",
			cyan: "#e8a050",
			white: "#f0d8b0",
			brightBlack: "#4d2418",
			brightRed: "#ff5040",
			brightGreen: "#f0b048",
			brightYellow: "#ffd880",
			brightBlue: "#d04830",
			brightMagenta: "#e87858",
			brightCyan: "#ffb070",
			brightWhite: "#fff0d8",
		},

		sidebar: {
			glass: 4,
			borderStyle: "glow",
			borderColor: "#4d2418",
			itemRadius: 4,
			separatorStyle: "glow",
			separatorColor: "#4d2418",
			cardBg: "#180c0a",
			cardBorder: "#301810",
			cardRadius: 4,
		},
	},
	{
		name: "Arctic",
		background: "#050d18",
		foreground: "#c8e4f0",
		fontFamily: "SF Mono",
		accent: "#48c8e0",
		glow: "#70e8cc",
		gradient:
			"linear-gradient(180deg, rgba(112, 232, 204, 0.15) 0%, rgba(72, 200, 224, 0.1) 30%, transparent 50%)",
		gradientLevel: "medium",
		glowLevel: "medium",
		scrollbarAccent: "medium",
		cursorColor: "#a0e0f8",
		selectionColor: "#3878a0",
		decoration:
			"linear-gradient(150deg, transparent 55%, rgba(72,200,224,0.04) 80%, transparent 95%) no-repeat 100% 0 / 30% 35%, linear-gradient(330deg, transparent 60%, rgba(72,200,224,0.03) 85%, transparent 100%) no-repeat 0 70% / 25% 30%",
		ansiColors: {
			black: "#050d18",
			red: "#5898b8",
			green: "#70e8cc",
			yellow: "#a0e0f8",
			blue: "#3878a0",
			magenta: "#7898c0",
			cyan: "#48c8e0",
			white: "#d0e8f0",
			brightBlack: "#1e3550",
			brightRed: "#78b8d0",
			brightGreen: "#88f0dd",
			brightYellow: "#b8f0ff",
			brightBlue: "#5090b0",
			brightMagenta: "#98b8d8",
			brightCyan: "#68d8ee",
			brightWhite: "#f0f8ff",
		},

		sidebar: {
			glass: 12,
			borderStyle: "none",
			shadow: "1px 0 12px rgba(72, 200, 224, 0.08)",
			itemRadius: 6,
			spacing: "spacious",
			transition: "cubic-bezier(0.22, 1, 0.36, 1)",
			textTransform: "uppercase",
			letterSpacing: 0.12,
			headerWeight: "normal",
			separatorStyle: "solid",
			separatorColor: "#1e3550",
			cardRadius: 4,
		},
	},
] as const satisfies readonly ThemePreset[];

/** Union of all built-in theme preset name literals, derived from the THEME_PRESETS array. */
export type ThemePresetName = (typeof THEME_PRESETS)[number]["name"];

export const TERMINAL_FONTS = [
	"JetBrains Mono",
	"Fira Code",
	"Source Code Pro",
	"Cascadia Code",
	"SF Mono",
	"Menlo",
	"Monaco",
	"Consolas",
	"IBM Plex Mono",
	"Hack",
	"Inconsolata",
	"Ubuntu Mono",
	"Roboto Mono",
	"Victor Mono",
] as const;

// Fallbacks intentionally overlap with TERMINAL_FONTS; unavailable fonts are skipped.
// Order: Windows-first (Consolas, Cascadia Code), then macOS (Menlo, Monaco), then generic.
// "Symbols Nerd Font Mono" is a symbols-only fallback for Powerline/icon glyphs on unpatched fonts.
const FONT_FALLBACKS =
	"Consolas, Cascadia Code, Menlo, Monaco, Symbols Nerd Font Mono, monospace";

export const DEFAULT_FONT_FAMILY = `${TERMINAL_FONTS[0]}, ${FONT_FALLBACKS}`;

export function buildFontFamily(family?: string): string {
	if (family && (TERMINAL_FONTS as readonly string[]).includes(family)) {
		return `${family}, ${FONT_FALLBACKS}`;
	}
	return DEFAULT_FONT_FAMILY;
}

/** Remove keys whose value is `undefined` so they don't poison exactOptionalPropertyTypes.
 *  Returns Partial<T> because the result may lack keys that T requires. */
function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
	const result: Partial<T> = {};
	for (const key of Object.keys(obj) as (keyof T)[]) {
		const val = obj[key];
		if (val !== undefined) result[key] = val;
	}
	return result;
}

/** PaneTheme fields copied from the matched preset when the user's theme
 *  config does not already define them (fill-if-missing semantics). */
const PRESET_FILL_KEYS = [
	// Typography
	"fontFamily",
	"fontSize",
	"lineHeight",
	// Colors
	"cursorColor",
	"selectionColor",
	"ansiColors",
	// Effects
	"gradientLevel",
	"glowLevel",
	"scanlineLevel",
	"noiseLevel",
	"scrollbarAccent",
] as const;

/** Merge a workspace theme + optional per-pane override with preset fallbacks. */
export function mergeThemeWithPreset(
	theme: PaneTheme,
	override?: Partial<PaneTheme> | null,
): PaneTheme {
	// Merge override into theme, stripping undefined values to satisfy exactOptionalPropertyTypes
	const base: Partial<PaneTheme> = override
		? stripUndefined({ ...theme, ...override })
		: { ...theme };
	const preset = base.preset ? findPreset(base.preset) : undefined;
	if (!preset) return base as PaneTheme;

	// Fill in preset values only for missing optional fields
	const result = { ...base } as { -readonly [K in keyof PaneTheme]?: PaneTheme[K] };
	for (const key of PRESET_FILL_KEYS) {
		if (result[key] === undefined && preset[key] !== undefined) {
			// Cast needed: PRESET_FILL_KEYS is a compile-time-known subset of PaneTheme keys,
			// but TS can't prove dynamic key assignment is safe on the mapped type.
			(result as Record<string, unknown>)[key] = preset[key];
		}
	}
	return result as PaneTheme;
}

/** Compute scrollbar accent colors for normal/hover/active states.
 *  Returns undefined when the effect is off or no valid glow/accent color exists. */
function resolveScrollbarAccent(
	t: Pick<PaneTheme, "scrollbarAccent" | "glow" | "accent">,
): { background: string; hover: string; active: string } | undefined {
	const mul = effectMul(t.scrollbarAccent);
	if (mul <= 0) return undefined;
	const color = t.glow ?? t.accent;
	if (!color || !isValidHex(color)) return undefined;
	const base = Math.round((0.4 + 0.6 * mul) * 100) / 100;
	return {
		background: hexToRgba(color, base),
		hover: hexToRgba(color, Math.min(1, Math.round((base + 0.1) * 100) / 100)),
		active: hexToRgba(color, Math.min(1, Math.round((base + 0.2) * 100) / 100)),
	};
}

/** Build terminal theme colors from a PaneTheme's color fields.
 *  When opacity < 1, the background is converted to an rgba value for translucency.
 *  Returns an object with resolved background, foreground, cursor, selection, ANSI colors,
 *  and optional scrollbar accent colors. */
export function buildTerminalTheme(
	t: Pick<
		PaneTheme,
		| "background"
		| "foreground"
		| "ansiColors"
		| "cursorColor"
		| "selectionColor"
		| "scrollbarAccent"
		| "glow"
		| "accent"
	>,
	opacity = 1,
) {
	const theme: Record<string, string> = {
		background: resolveBackground(t.background, opacity),
		foreground: t.foreground,
		cursor: t.cursorColor && isValidHex(t.cursorColor) ? t.cursorColor : t.foreground,
		selectionBackground:
			t.selectionColor && isValidHex(t.selectionColor)
				? `${t.selectionColor}55`
				: `${t.foreground}33`,
	};

	if (t.ansiColors) {
		for (const [key, value] of Object.entries(t.ansiColors)) {
			if (isValidHex(value)) {
				theme[key] = value;
			}
		}
	}

	const scrollbar = resolveScrollbarAccent(t);
	if (scrollbar) {
		theme.scrollbarSliderBackground = scrollbar.background;
		theme.scrollbarSliderHoverBackground = scrollbar.hover;
		theme.scrollbarSliderActiveBackground = scrollbar.active;
	}

	return theme;
}

export const DEFAULT_PRESET_NAME = THEME_PRESETS[0].name;

const PRESET_NAMES = new Set<ThemePresetName>(THEME_PRESETS.map((p) => p.name));

/** Validate a preset name, falling back to DEFAULT_PRESET_NAME for unknown or missing values.
 *  Accepts plain `string` for deserialization boundaries (persisted config, legacy data). */
export function toPresetName(name: string | undefined): ThemePresetName {
	return name && PRESET_NAMES.has(name as ThemePresetName) ? (name as ThemePresetName) : DEFAULT_PRESET_NAME;
}

/** Look up a theme preset by name. Returns undefined if not found.
 *  Accepts plain `string` for deserialization boundaries (persisted config, migration). */
export function findPreset(name: string): ThemePreset | undefined {
	return THEME_PRESETS.find((p) => p.name === name);
}
