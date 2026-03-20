import type { PaneConfig, PrInfo } from "../shared/types";

interface SidebarPaneEntryProps {
	paneId: string;
	config: PaneConfig;
	branch: string | null;
	pr: PrInfo | null;
	isFocused: boolean;
	homeDir: string;
	onClick: () => void;
}

export function SidebarPaneEntry({
	config,
	branch,
	pr,
	isFocused,
	homeDir,
	onClick,
}: SidebarPaneEntryProps) {
	const shortCwd = config.cwd.startsWith(homeDir)
		? `~${config.cwd.slice(homeDir.length)}`
		: config.cwd;

	return (
		<button
			type="button"
			onClick={onClick}
			className={`flex flex-col gap-0.5 w-full text-left px-3 py-1 ml-4 border-none cursor-pointer rounded-sm transition-colors duration-200 ${
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
				{branch && (
					<span className="text-[10px] text-accent truncate max-w-[80px] shrink-0">
						{branch}
					</span>
				)}
				{pr && (
					<span className="text-[10px] text-accent font-medium shrink-0">
						#{pr.number}
					</span>
				)}
			</div>

			{/* Row 2: CWD */}
			<span className="text-[9px] text-content-muted truncate">
				{shortCwd}
			</span>
		</button>
	);
}
