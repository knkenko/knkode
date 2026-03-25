import { createAndRegisterVariant } from "./createVariant";

createAndRegisterVariant("Amber", {
	statusBar: {
		height: 28,
		className: "gap-1 px-3 py-1 text-[10px] font-mono uppercase z-20",
		style: (theme, isFocused) => {
			const isBottom = theme.statusBarPosition === "bottom";
			const fg = isFocused ? theme.accent : theme.foreground;
			return {
				color: fg,
				backgroundColor: "#0c0800",
				borderTop: isBottom
					? `1px dashed ${isFocused ? `${theme.accent}66` : `${theme.accent}33`}`
					: "none",
				borderBottom: isBottom
					? "none"
					: `1px dashed ${isFocused ? `${theme.accent}66` : `${theme.accent}33`}`,
				textShadow: isFocused ? `0 0 8px ${theme.accent}66` : "none",
			};
		},
		separator: "│",
		separatorClassName: "mx-2 opacity-40",
		showSeparatorBeforeBranch: true,
		editInput: {
			className: "border font-mono uppercase text-[10px] py-px px-1 w-20",
			style: (theme, isFocused) => ({
				borderColor: theme.accent,
				color: isFocused ? theme.accent : theme.foreground,
			}),
		},
		label: { className: "font-bold" },
		cwd: {
			className: "opacity-70",
			prefix: "CWD: ",
			transform: (s) => s.toUpperCase(),
		},
		branch: {
			className: "opacity-80 font-bold",
			format: (b) => `BR: ${b.toUpperCase()}`,
		},
		pr: {
			className: "bg-transparent px-1 leading-none opacity-60 hover:opacity-100",
			style: (theme, isFocused) => ({
				color: isFocused ? theme.accent : theme.foreground,
			}),
			format: (pr) => `[PR#${pr.number}]`,
		},
		action: {
			className: "px-1 opacity-60 hover:opacity-100",
			style: (theme, isFocused) => ({
				color: isFocused ? theme.accent : theme.foreground,
			}),
			labels: { splitV: "[SPLIT-V]", splitH: "[SPLIT-H]", close: "[CLOSE]" },
		},
		snippet: { label: "[CMD]" },
		sessionHistory: { label: "[LOG]" },
	},
	activity: {
		gradient: (theme) => `linear-gradient(90deg, ${theme.accent}88, ${theme.accent}, ${theme.accent}88)`,
		animation: "ember",
	},
	content: { className: "px-1" },
	scrollButton: {
		className:
			"bottom-6 left-6 right-6 z-30 h-7 text-[10px] font-mono uppercase tracking-widest hover:brightness-125",
		style: (theme) => ({
			backgroundColor: `${theme.background}dd`,
			color: theme.accent,
			border: `1px dotted ${theme.accent}44`,
			textShadow: `0 0 6px ${theme.accent}44`,
		}),
		text: ">>> SCROLL DOWN <<<",
	},
});
