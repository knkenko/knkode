import { createAndRegisterVariant } from "./createVariant";

createAndRegisterVariant("Dracula", {
	statusBar: {
		height: 30,
		className: "gap-2 px-3 text-[11px] font-medium",
		style: (theme, isFocused) => ({
			color: theme.foreground,
			borderBottom: `1px solid ${isFocused ? theme.accent : `${theme.accent}33`}`,
		}),
		separator: "│",
		separatorClassName: "opacity-20",
		separatorStyle: (theme) => ({ color: theme.accent }),
		showSeparatorAfterLabel: false,
		editInput: {
			className: "border rounded-sm text-[11px] py-px px-1 w-20",
			style: (theme, _isFocused) => ({ borderColor: theme.accent, color: theme.foreground }),
		},
		label: { className: "font-semibold" },
		cwd: {
			className: "opacity-50 flex items-center gap-1 text-[10px]",
			icon: "folder",
			iconStyle: (theme) => ({ color: theme.accent }),
		},
		branch: {
			className: "text-[10px] font-medium px-2 py-px rounded-md",
			style: (theme) => ({ backgroundColor: `${theme.accent}18`, color: theme.foreground }),
		},
		pr: {
			className: "text-[10px] font-medium px-2 py-px rounded-md hover:brightness-110",
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
	},
	scrollButton: {
		className: "bottom-3 left-1/4 right-1/4 h-8 rounded-full text-xs hover:brightness-110",
		style: (theme) => ({
			backgroundColor: `${theme.background}dd`,
			color: theme.foreground,
			border: `1px solid ${theme.accent}44`,
			boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
		}),
		text: "↓ bottom",
	},
});
