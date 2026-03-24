import type { ThemePresetName } from "../data/theme-presets";
import { useWorkspaceGitInfo } from "../hooks/useWorkspaceGitInfo";
import { WorkspaceGitInfoVariant } from "./sidebar-variants/ThemeRegistry";

interface Props {
	workspaceId: string;
	preset: ThemePresetName;
}

export function SidebarWorkspaceGitInfo({ workspaceId, preset }: Props) {
	const gitInfo = useWorkspaceGitInfo(workspaceId);

	return <WorkspaceGitInfoVariant preset={preset} branch={gitInfo.branch} pr={gitInfo.pr} />;
}
