import { useEffect, useRef } from "react";
import { modKey } from "../utils/platform";

interface HotkeyPanelProps {
	onClose: () => void;
}

interface Shortcut {
	keys: string;
	description: string;
}

const SECTIONS: { label: string; shortcuts: Shortcut[] }[] = [
	{
		label: "Workspaces",
		shortcuts: [
			{ keys: `${modKey}+T`, description: "New workspace" },
			{ keys: `${modKey}+Shift+[`, description: "Previous workspace tab" },
			{ keys: `${modKey}+Shift+]`, description: "Next workspace tab" },
			{ keys: `${modKey}+Shift+W`, description: "Close workspace tab" },
			{ keys: `${modKey}+,`, description: "Workspace settings" },
		],
	},
	{
		label: "Panes",
		shortcuts: [
			{ keys: `${modKey}+D`, description: "Split pane side-by-side" },
			{ keys: `${modKey}+Shift+D`, description: "Split pane stacked" },
			{ keys: `${modKey}+W`, description: "Close pane" },
			{ keys: `${modKey}+Alt+Left/Right`, description: "Focus prev/next pane" },
			{ keys: `${modKey}+1\u20139`, description: "Focus pane by number" },
		],
	},
	{
		label: "Terminal",
		shortcuts: [
			{ keys: `${modKey}+C`, description: "Copy selection / SIGINT" },
			{ keys: `${modKey}+V`, description: "Paste" },
			{ keys: `${modKey}+Up`, description: "Scroll to top" },
			{ keys: `${modKey}+Down`, description: "Scroll to bottom" },
			{ keys: `${modKey}+=`, description: "Zoom in" },
			{ keys: `${modKey}+\u2013`, description: "Zoom out" },
			{ keys: `${modKey}+0`, description: "Reset zoom" },
			{ keys: `${modKey}+Scroll`, description: "Zoom in/out" },
		],
	},
	{
		label: "Navigation",
		shortcuts: [
			{ keys: "Alt+Left", description: "Jump to previous word" },
			{ keys: "Alt+Right", description: "Jump to next word" },
			{ keys: "Alt+Backspace", description: "Delete previous word" },
		],
	},
	{
		label: "Selection",
		shortcuts: [
			{ keys: "Shift+Left/Right", description: "Select by character" },
			{ keys: "Alt+Shift+Left/Right", description: "Select by word" },
			{ keys: "Double-click", description: "Select word" },
			{ keys: "Triple-click", description: "Select line" },
			{ keys: "Shift+Click", description: "Extend selection" },
		],
	},
];

export function HotkeyPanel({ onClose }: HotkeyPanelProps) {
	const dialogRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [onClose]);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: Escape key handled via document listener above
		<div
			role="presentation"
			className="fixed inset-0 bg-black/60 flex items-center justify-center z-[200]"
			onClick={onClose}
		>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation only, keyboard handled by overlay */}
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-label="Keyboard Shortcuts"
				className="bg-canvas/80 backdrop-blur-2xl border border-edge/50 rounded-md w-[480px] max-w-[calc(100vw-2rem)] max-h-[85vh] flex flex-col shadow-panel animate-panel-in"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between px-6 py-4 border-b border-edge/50">
					<h2 className="text-sm font-semibold tracking-wide">Keyboard Shortcuts</h2>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="bg-transparent border-none text-content-muted cursor-pointer text-sm hover:text-content focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none"
					>
						&#x2715;
					</button>
				</div>

				<div className="flex-1 min-h-0 px-6 py-4 overflow-y-auto flex flex-col gap-5">
					{SECTIONS.map((section) => (
						<div key={section.label}>
							<h3 className="text-[10px] uppercase tracking-widest text-content-muted font-semibold mb-2">
								{section.label}
							</h3>
							<div className="flex flex-col gap-1">
								{section.shortcuts.map((s) => (
									<div key={s.keys} className="flex items-center justify-between py-0.5">
										<span className="text-xs text-content-secondary">{s.description}</span>
										<kbd className="text-[10px] font-mono text-content-muted bg-sunken border border-edge rounded px-1.5 py-0.5 ml-4 shrink-0">
											{s.keys}
										</kbd>
									</div>
								))}
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	);
}
