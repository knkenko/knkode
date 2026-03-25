import { createAndRegisterVariant } from "./createVariant";

createAndRegisterVariant("Catppuccin", {
	statusBar: {
		height: 30,
		className: "gap-2 px-3 text-[11px]",
		style: (theme, isFocused) => ({
			color: theme.foreground,
			borderBottom: `1px solid ${isFocused ? theme.accent : `${theme.accent}33`}`,
		}),
		separator: "·",
		separatorClassName: "opacity-25",
		editInput: {
			className: "border rounded-md text-[11px] py-px px-1 w-20",
			style: (theme, _isFocused) => ({ borderColor: theme.accent, color: theme.foreground }),
		},
		label: { className: "" },
		cwd: {
			className: "opacity-50 flex items-center gap-1 text-[10px]",
			icon: "folder",
			iconClassName: "opacity-60",
			iconStyle: (theme) => ({ color: theme.accent }),
		},
		branch: {
			className: "text-[10px] px-2 py-px rounded-md",
			style: (theme) => ({ backgroundColor: `${theme.accent}14`, color: theme.foreground }),
		},
		pr: {
			className: "text-[10px] px-2 py-px rounded-md opacity-40 hover:opacity-80",
			style: (theme, _isFocused) => ({
				backgroundColor: `${theme.accent}14`,
				color: theme.foreground,
			}),
		},
		action: {
			className: "text-[11px] px-0.5 opacity-40 hover:opacity-80 rounded-md",
			style: (theme, _isFocused) => ({ color: theme.foreground }),
		},
		snippet: { label: ">_" },
		sessionHistory: { label: "☰" },
	},
	activity: {
		gradient: (theme) => `linear-gradient(90deg, ${theme.accent}66, ${theme.accent}, ${theme.accent}66)`,
		animation: "wave",
	},
	scrollButton: {
		className: "bottom-3 left-1/4 right-1/4 h-8 rounded-xl text-xs hover:brightness-110",
		style: (theme) => ({
			backgroundColor: `${theme.accent}22`,
			color: theme.foreground,
			boxShadow: "0 2px 6px rgba(0,0,0,0.15)",
		}),
		text: "↓ bottom",
	},
});
