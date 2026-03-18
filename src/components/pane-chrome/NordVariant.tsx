import { createAndRegisterVariant } from "./createVariant";

createAndRegisterVariant("Nord", {
	statusBar: {
		height: 28,
		className: "gap-3 px-3 text-[11px] tracking-wide",
		style: (theme, isFocused) => ({
			color: theme.foreground,
			borderBottom: `1px solid ${isFocused ? `${theme.accent}55` : `${theme.foreground}15`}`,
		}),
		editInput: {
			className: "border tracking-wide text-[11px] py-px px-1 w-20",
			style: (theme) => ({ borderColor: theme.accent, color: theme.foreground }),
		},
		label: { className: "" },
		cwd: { className: "opacity-40 text-[10px]" },
		branch: {
			className: "text-[10px] px-2 py-px rounded-sm",
			style: (theme) => ({ backgroundColor: `${theme.accent}0d`, color: theme.accent }),
		},
		pr: {
			className: "text-[10px] px-0.5 leading-none opacity-30 hover:opacity-70",
			style: (theme) => ({ color: theme.accent, backgroundColor: "transparent" }),
		},
		action: {
			className: "text-[11px] px-0.5 opacity-30 hover:opacity-70",
			style: (theme) => ({ color: theme.foreground }),
		},
		snippet: { label: ">_" },
	},
	scrollButton: {
		className:
			"bottom-3 left-1/3 right-1/3 h-7 text-[10px] tracking-wide opacity-60 hover:opacity-100",
		style: (theme) => ({ color: theme.foreground, backgroundColor: "transparent", border: "none" }),
		text: "↓ scroll to bottom",
	},
});
