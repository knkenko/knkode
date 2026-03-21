import { useCallback } from "react";
import { type ThemePresetName, toPresetName } from "../data/theme-presets";
import { useContextMenu } from "../hooks/useContextMenu";
import { PANE_RENAME_EVENT, type PaneConfig } from "../shared/types";
import { useStore } from "../store";
import { shortenPath } from "../utils/path";
import { PaneContextMenu } from "./PaneContextMenu";
import { PaneEntryVariant } from "./sidebar-variants/ThemeRegistry";

interface SidebarPaneEntryProps {
	paneId: string;
	workspaceId: string;
	workspacePreset?: ThemePresetName | undefined;
	config: PaneConfig;
	isFocused: boolean;
	canClose: boolean;
	onClick: () => void;
	onClose?: () => void;
}

export function SidebarPaneEntry({
	paneId,
	workspaceId,
	workspacePreset,
	config,
	isFocused,
	canClose,
	onClick,
	onClose,
}: SidebarPaneEntryProps) {
	const branch = useStore((s) => s.paneBranches[paneId] ?? null);
	const pr = useStore((s) => s.panePrs[paneId] ?? null);
	const agentStatus = useStore((s) => s.paneAgentStatuses[paneId] ?? "idle");
	const homeDir = useStore((s) => s.homeDir);
	const splitPane = useStore((s) => s.splitPane);
	const updatePaneConfig = useStore((s) => s.updatePaneConfig);

	const shortCwd = shortenPath(config.cwd, homeDir);
	const preset = toPresetName(config.themeOverride?.preset ?? workspacePreset);

	const ctx = useContextMenu();

	const handleRename = useCallback(() => {
		window.dispatchEvent(new CustomEvent(PANE_RENAME_EVENT, { detail: { paneId } }));
	}, [paneId]);

	return (
		<>
			<PaneEntryVariant
				preset={preset}
				paneId={paneId}
				label={config.label}
				cwd={shortCwd}
				branch={branch}
				pr={pr}
				agentStatus={agentStatus}
				isFocused={isFocused}
				onClick={onClick}
				onContextMenu={ctx.open}
			/>

			{ctx.isOpen && (
				<PaneContextMenu
					paneId={paneId}
					workspaceId={workspaceId}
					config={config}
					canClose={canClose}
					anchorPos={ctx.position}
					onUpdateConfig={(updates) => updatePaneConfig(workspaceId, paneId, updates)}
					// iTerm2 convention: "Split Vertical" = vertical divider = horizontal (side-by-side) layout
					onSplitVertical={() => splitPane(workspaceId, paneId, "horizontal")}
					onSplitHorizontal={() => splitPane(workspaceId, paneId, "vertical")}
					onClose={() => onClose?.()}
					onRename={handleRename}
					onFocus={onClick}
					onDismiss={ctx.close}
				/>
			)}
		</>
	);
}
