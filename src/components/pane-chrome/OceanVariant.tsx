import { createAndRegisterVariant } from "./createVariant";
import { resolveGlow } from "./shared";

createAndRegisterVariant("Ocean", {
	statusBar: {
		height: 30,
		className: "gap-2 px-4 py-1 text-[11px] font-light transition-all duration-300 z-20",
		style: (theme, isFocused) => {
			const glowColor = resolveGlow(theme);
			const isBottom = theme.statusBarPosition === "bottom";
			return {
				color: theme.foreground,
				backgroundColor: "#020b14",
				borderTop: isBottom ? `1px solid ${theme.accent}28` : "none",
				borderBottom: isBottom ? "none" : `1px solid ${theme.accent}28`,
				boxShadow: isFocused ? `0 ${isBottom ? "-" : ""}2px 8px ${glowColor}11` : "none",
			};
		},
		editInput: {
			className: "border rounded-sm font-light text-[11px] py-px px-1 w-20",
			style: (theme) => ({ borderColor: theme.accent, color: theme.foreground }),
		},
		cwd: {
			className: "opacity-50",
			prefix: "~ ",
			maskImage: "linear-gradient(90deg, black 80%, transparent)",
		},
		branch: {
			className: "min-w-0 text-[10px] px-2 py-px rounded-md",
			style: (theme) => ({
				backgroundColor: `${theme.accent}22`,
				color: theme.foreground,
			}),
		},
		pr: {
			className: "text-[10px] px-2 py-px rounded-md hover:brightness-110 transition-all",
			style: (theme) => ({
				backgroundColor: `${theme.accent}22`,
				color: theme.foreground,
			}),
		},
		action: {
			className: "text-[11px] px-0.5 leading-none",
			style: (theme) => ({ color: theme.accent }),
		},
		snippet: { label: ">_" },
		hoverRevealActions: {
			className:
				"flex items-center gap-0.5 opacity-0 hover:opacity-70 focus-within:opacity-70 has-[:focus-visible]:opacity-70 transition-opacity duration-200",
		},
	},
	scrollButton: {
		className: "bottom-6 right-6 z-30 w-9 h-9 rounded-full text-sm hover:brightness-110",
		style: (theme) => {
			const glowColor = resolveGlow(theme);
			return {
				backgroundColor: `${theme.accent}22`,
				color: theme.accent,
				boxShadow: `0 0 12px ${glowColor}33`,
				backdropFilter: "blur(4px)",
			};
		},
		text: "↓",
	},
});
