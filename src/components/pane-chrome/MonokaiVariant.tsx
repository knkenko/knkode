import { createAndRegisterVariant } from "./createVariant";

createAndRegisterVariant("Monokai", {
	statusBar: {
		height: 28,
		className: "gap-2 px-3 text-[11px]",
		style: (theme, isFocused) => ({
			color: theme.foreground,
			borderBottom: `1px solid ${isFocused ? theme.accent : `${theme.foreground}22`}`,
		}),
		separator: "|",
		separatorClassName: "opacity-30",
		editInput: {
			className: "border rounded-sm text-[11px] py-px px-1 w-20",
			style: (theme, _isFocused) => ({ borderColor: theme.accent, color: theme.foreground }),
		},
		cwd: {
			className: "opacity-50 text-[10px]",
			icon: "▶",
			iconStyle: (theme) => ({ color: theme.accent }),
		},
		branch: {
			className: "text-[10px] px-2 py-px rounded-md",
			style: (theme) => ({ backgroundColor: `${theme.accent}18`, color: theme.foreground }),
		},
		pr: {
			className: "text-[10px] px-2 py-px rounded-md hover:brightness-110",
			style: (theme, _isFocused) => ({
				backgroundColor: `${theme.accent}18`,
				color: theme.foreground,
			}),
		},
		action: {
			className: "text-[11px] px-0.5 opacity-50 hover:opacity-100",
			style: (theme, _isFocused) => ({ color: theme.accent }),
		},
		snippet: { label: ">_" },
		sessionHistory: { label: "☰" },
	},
	scrollButton: {
		className: "bottom-3 left-3 right-3 h-7 text-[11px] hover:brightness-110",
		style: (theme) => ({
			backgroundColor: `${theme.background}dd`,
			color: theme.foreground,
			border: `1px solid ${theme.foreground}22`,
			borderLeft: `3px solid ${theme.accent}`,
			borderRadius: 2,
		}),
		text: "↓ scroll to bottom",
	},
});
