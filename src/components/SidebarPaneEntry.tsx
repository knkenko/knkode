import type { PaneConfig } from "../shared/types";
import { useStore } from "../store";
import { shortenPath } from "../utils/path";

interface SidebarPaneEntryProps {
	paneId: string;
	config: PaneConfig;
	isFocused: boolean;
	onClick: () => void;
}

export function SidebarPaneEntry({ paneId, config, isFocused, onClick }: SidebarPaneEntryProps) {
	const branch = useStore((s) => s.paneBranches[paneId] ?? null);
	const pr = useStore((s) => s.panePrs[paneId] ?? null);
	const homeDir = useStore((s) => s.homeDir);

	const shortCwd = shortenPath(config.cwd, homeDir);

	return (
		<button
			type="button"
			onClick={onClick}
			data-pane-id={paneId}
			className={`flex flex-col gap-0.5 w-full text-left pl-7 pr-3 py-1 border-none cursor-pointer rounded-sm transition-colors duration-200 ${
				isFocused
					? "bg-overlay text-content"
					: "bg-transparent text-content-muted hover:bg-overlay/50 hover:text-content-secondary"
			}`}
		>
			{/* Row 1: pane label + branch + PR */}
			<div className="flex items-center gap-1.5 min-w-0">
				<span className={`text-[11px] truncate ${isFocused ? "font-medium" : ""}`}>
					{config.label}
				</span>
				{branch && <span className="text-[10px] text-accent truncate max-w-[80px]">{branch}</span>}
				{pr && <span className="text-[10px] text-accent font-medium shrink-0">#{pr.number}</span>}
			</div>

			{/* Row 2: CWD */}
			<span className="text-[9px] text-content-muted truncate">{shortCwd}</span>
		</button>
	);
}
