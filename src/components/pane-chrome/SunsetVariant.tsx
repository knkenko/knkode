import { createAndRegisterVariant } from "./createVariant";
import { resolveGlow } from "./shared";

createAndRegisterVariant("Sunset", {
	statusBar: {
		height: 30,
		className: "gap-2 px-3 py-1 text-[11px] font-medium",
		style: (theme, isFocused) => ({
			color: theme.foreground,
			backgroundColor: "#110808",
			borderTop: `1px solid ${theme.accent}${isFocused ? "44" : "22"}`,
			boxShadow: isFocused ? `inset 0 1px 0 ${resolveGlow(theme)}22` : "none",
		}),
		separator: "│",
		separatorClassName: "opacity-20",
		separatorStyle: (theme) => ({ color: theme.accent }),
		editInput: {
			className: "border rounded-sm text-[11px] py-px px-1 w-20",
			style: (theme, _isFocused) => ({ borderColor: theme.accent, color: theme.foreground }),
		},
		label: { className: "font-semibold" },
		cwd: {
			className: "opacity-60",
			icon: "☀",
			iconStyle: (theme) => ({ color: theme.accent }),
		},
		branch: {
			className: "text-[10px] font-medium px-2 py-px rounded-md",
			style: (theme) => ({ backgroundColor: `${theme.accent}22`, color: theme.accent }),
		},
		pr: {
			className: "text-[10px] font-medium px-2 py-px rounded-md hover:brightness-110",
			style: (theme, _isFocused) => ({ backgroundColor: `${theme.accent}22`, color: theme.accent }),
		},
		action: {
			className: "text-[11px] px-0.5 opacity-50 hover:opacity-100",
			style: (theme, _isFocused) => ({ color: theme.accent }),
		},
		snippet: { label: ">_" },
		sessionHistory: { label: "☰" },
	},
	activity: {
		gradient: (theme) => `linear-gradient(90deg, ${theme.accent}88, ${theme.accent}, ${theme.accent}88)`,
		animation: "ember",
	},
	scrollButton: {
		className: "bottom-3 left-1/4 right-1/4 h-8 rounded-full text-xs hover:brightness-110",
		style: (theme) => ({
			backgroundColor: `${theme.background}dd`,
			color: theme.accent,
			border: `1px solid ${theme.accent}44`,
			boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
		}),
		text: "↓",
	},
});
