import { createAndRegisterVariant } from "./createVariant";

createAndRegisterVariant("Tokyo Night", {
	statusBar: {
		height: 26,
		className: "gap-2 px-3 text-[10px] font-light transition-[opacity,background,box-shadow] duration-300 z-20",
		style: (theme, isFocused) => {
			const isBottom = theme.statusBarPosition === "bottom";
			return {
				color: theme.foreground,
				borderTop: isBottom
					? `1px solid ${isFocused ? `${theme.accent}66` : `${theme.foreground}11`}`
					: "none",
				borderBottom: isBottom
					? "none"
					: `1px solid ${isFocused ? `${theme.accent}66` : `${theme.foreground}11`}`,
				backgroundColor: isFocused ? "#16161e" : "transparent",
			};
		},
		editInput: {
			className: "border font-light text-[10px] py-px px-1 w-20",
			style: (theme, _isFocused) => ({ borderColor: theme.accent, color: theme.foreground }),
		},
		cwd: {
			className: "opacity-35 text-[10px]",
		},
		branch: {
			className: "text-[10px] font-light",
			style: (theme) => ({ color: theme.accent }),
		},
		pr: {
			className:
				"bg-transparent text-[10px] font-light px-0.5 leading-none opacity-60 hover:opacity-100 transition-opacity",
			style: (theme, _isFocused) => ({ color: theme.accent }),
		},
		action: {
			className: "text-[10px] px-0.5 leading-none",
			style: (theme, _isFocused) => ({ color: theme.foreground }),
		},
		snippet: { label: ">_" },
		sessionHistory: { label: "☰" },
		hoverRevealActions: {
			className:
				"flex items-center gap-0.5 opacity-0 hover:opacity-60 focus-within:opacity-60 has-[:focus-visible]:opacity-60 transition-opacity duration-300",
		},
	},
	scrollButton: {
		className: "bottom-3 right-3 z-30 w-6 h-6 text-sm hover:brightness-125",
		style: (theme) => ({
			color: theme.accent,
			backgroundColor: "transparent",
			border: "none",
		}),
		text: "↓",
	},
});
