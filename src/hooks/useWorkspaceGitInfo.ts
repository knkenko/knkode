import { useMemo } from "react";
import type { PrInfo } from "../shared/types";
import { useStore } from "../store";
import { majorityOrFocused } from "../utils/workspace";

export interface WorkspaceGitInfo {
	/** Workspace-level CWD (majority vote, focused pane breaks ties). */
	readonly cwd: string | null;
	/** Git branch from the pane that has the winning CWD. */
	readonly branch: string | null;
	/** PR info from the pane that has the winning CWD. */
	readonly pr: PrInfo | null;
}

/**
 * Derive workspace-level CWD, branch, and PR from per-pane data.
 * Uses majority vote on raw CWD paths, focused pane breaks ties.
 * Branch and PR come from the first pane that matches the winning CWD.
 */
export function useWorkspaceGitInfo(workspaceId: string): WorkspaceGitInfo {
	const workspace = useStore((s) => s.workspaces.find((w) => w.id === workspaceId));
	const focusedPaneId = useStore((s) => s.focusedPaneId);
	const paneBranches = useStore((s) => s.paneBranches);
	const panePrs = useStore((s) => s.panePrs);

	return useMemo(() => {
		if (!workspace) return { cwd: null, branch: null, pr: null };

		const paneIds = Object.keys(workspace.panes);
		if (paneIds.length === 0) return { cwd: null, branch: null, pr: null };

		// Build paneId → CWD map from workspace pane configs
		const paneCwds: Record<string, string | null> = {};
		for (const pid of paneIds) {
			paneCwds[pid] = workspace.panes[pid]?.cwd ?? null;
		}

		const winningCwd = majorityOrFocused(paneCwds, paneIds, focusedPaneId);
		if (!winningCwd) return { cwd: null, branch: null, pr: null };

		// Find branch and PR from the first pane that has the winning CWD
		let branch: string | null = null;
		let pr: PrInfo | null = null;
		for (const pid of paneIds) {
			if (paneCwds[pid] === winningCwd) {
				const b = paneBranches[pid];
				if (b != null) {
					branch = b;
					pr = panePrs[pid] ?? null;
					break;
				}
			}
		}

		// If no pane with the winning CWD has branch info, try any pane
		if (branch == null) {
			for (const pid of paneIds) {
				if (paneCwds[pid] === winningCwd) {
					pr = panePrs[pid] ?? null;
					break;
				}
			}
		}

		return { cwd: winningCwd, branch, pr };
	}, [workspace, focusedPaneId, paneBranches, panePrs]);
}
