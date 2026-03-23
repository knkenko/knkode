import type { ThemePresetName } from "../data/theme-presets";
import { useWorkspaceGitInfo } from "../hooks/useWorkspaceGitInfo";
import { useStore } from "../store";
import { shortenPath } from "../utils/path";

interface Props {
	workspaceId: string;
	preset: ThemePresetName;
}

export function SidebarWorkspaceGitInfo({ workspaceId }: Props) {
	const homeDir = useStore((s) => s.homeDir);
	const gitInfo = useWorkspaceGitInfo(workspaceId);
	const shortCwd = gitInfo.cwd ? shortenPath(gitInfo.cwd, homeDir) : null;

	if (!shortCwd && !gitInfo.branch && !gitInfo.pr) return null;

	return (
		<div className="px-2.5 pb-2 pt-0.5">
			<div className="flex flex-col gap-1.5 px-2.5 py-2 rounded-md bg-black/20 shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)] border border-white/5 backdrop-blur-sm">
				{shortCwd && (
					<div 
						className="text-[10px] text-white/60 truncate font-mono tracking-tight" 
						title={gitInfo.cwd!}
					>
						{shortCwd}
					</div>
				)}
				{(gitInfo.branch || gitInfo.pr) && (
					<div className="flex items-center justify-between gap-2">
						{gitInfo.branch && (
							<div className="flex items-center gap-1.5 min-w-0">
								<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className="text-white/40 shrink-0">
									<path d="M11.5 3a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM9 5.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0zM4.5 8a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM2 10.5a1.5 1.5 0 1 1 3 0 1.5 1.5 0 0 1-3 0z" />
									<path d="M4.5 7.5A2.5 2.5 0 0 1 7 5h1V4H7A3.5 3.5 0 0 0 3.5 7.5v2h1v-2z" />
								</svg>
								<span className="text-[10px] font-medium text-white/80 truncate tracking-wide">{gitInfo.branch}</span>
							</div>
						)}
						{gitInfo.pr && (
							<div className="text-[9px] font-bold px-1.5 py-0.5 rounded-[4px] bg-white/10 text-white/90 shrink-0">
								#{gitInfo.pr.number}
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
