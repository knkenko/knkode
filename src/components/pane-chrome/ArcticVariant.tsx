import { createAndRegisterVariant } from "./createVariant";

createAndRegisterVariant("Arctic", {
	statusBar: {
		height: 28,
		className: "gap-2 px-3 py-1 text-[10px] tracking-wider font-light",
		style: (theme, isFocused) => ({
			color: theme.foreground,
			backgroundColor: "#050d18",
			borderBottom: `1px solid ${isFocused ? `${theme.accent}44` : `${theme.accent}22`}`,
		}),
		separator: "│",
		separatorClassName: "opacity-20",
		separatorStyle: (theme) => ({ color: theme.accent }),
		editInput: {
			className: "border tracking-wider font-light text-[10px] py-px px-1 w-20",
			style: (theme, _isFocused) => ({ borderColor: theme.accent, color: theme.foreground }),
		},
		cwd: {
			className: "opacity-50",
			icon: "◆",
			iconStyle: (theme) => ({ color: theme.accent }),
		},
		branch: {
			className: "text-[10px] tracking-wider font-light px-2 py-px",
			style: (theme) => ({
				border: `1px solid ${theme.accent}44`,
				color: theme.foreground,
				borderRadius: 0,
			}),
		},
		pr: {
			className: "text-[10px] tracking-wider font-light px-2 py-px opacity-40 hover:opacity-100",
			style: (theme, _isFocused) => ({
				border: `1px solid ${theme.accent}44`,
				color: theme.foreground,
				borderRadius: 0,
				backgroundColor: "transparent",
			}),
		},
		action: {
			className: "px-0.5 opacity-40 hover:opacity-100",
			style: (theme, _isFocused) => ({ color: theme.accent }),
		},
		snippet: { label: ">_" },
		sessionHistory: { label: "☰" },
	},
	scrollButton: {
		className:
			"bottom-3 left-3 right-3 h-7 text-[10px] tracking-widest font-light uppercase hover:brightness-110",
		style: (theme) => ({
			backgroundColor: `${theme.background}dd`,
			color: theme.accent,
			border: `1px solid ${theme.accent}44`,
			borderRadius: 0,
		}),
		text: "↓ BOTTOM",
	},
});
