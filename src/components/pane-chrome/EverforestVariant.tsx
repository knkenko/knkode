import { createAndRegisterVariant } from "./createVariant";

createAndRegisterVariant("Everforest", {
	statusBar: {
		height: 28,
		className: "gap-2 px-3 text-[11px]",
		style: (theme, isFocused) => ({
			color: theme.foreground,
			borderBottom: `1px solid ${isFocused ? `${theme.accent}66` : `${theme.accent}22`}`,
		}),
		separator: "·",
		separatorClassName: "opacity-30",
		editInput: {
			className: "border rounded text-[11px] py-px px-1 w-20",
			style: (theme, _isFocused) => ({ borderColor: theme.accent, color: theme.foreground }),
		},
		cwd: {
			className: "opacity-50 text-[10px]",
			icon: "leaf",
			iconStyle: (theme) => ({ color: theme.accent }),
		},
		branch: {
			className: "text-[10px] font-medium px-2 py-px rounded-md",
			style: (theme) => ({
				backgroundColor: `${theme.accent}18`,
				color: theme.accent,
			}),
		},
		pr: {
			className: "text-[10px] font-medium px-2 py-px rounded-md opacity-40 hover:opacity-80",
			style: (theme, _isFocused) => ({
				backgroundColor: `${theme.accent}18`,
				color: theme.accent,
			}),
		},
		action: {
			className: "text-[11px] px-0.5 opacity-40 hover:opacity-80",
			style: (theme, _isFocused) => ({ color: theme.foreground }),
		},
		snippet: { label: ">_" },
		sessionHistory: { label: "⟳" },
	},
	activity: {
		gradient: (theme) => `linear-gradient(90deg, ${theme.accent}66, ${theme.accent}, ${theme.accent}66)`,
		animation: "wave",
	},
	scrollButton: {
		className: "bottom-3 left-1/4 right-1/4 h-7 rounded text-[11px] hover:brightness-110",
		style: (theme) => ({
			backgroundColor: `${theme.background}dd`,
			color: theme.accent,
			border: `1px solid ${theme.accent}33`,
		}),
		text: "↓ scroll down",
	},
});
