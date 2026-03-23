import { useMemo } from "react";
import type { PaneConfig, PrInfo } from "../shared/types";
import { useStore } from "../store";
import { majorityOrFocused } from "../utils/workspace";

/** Workspace-level git state derived from per-pane data.
 *  Invariants:
 *  - When cwd is null, branch and pr are guaranteed null.
 *  - When pr is non-null, branch is guaranteed non-null. */
export interface WorkspaceGitInfo {
	/** Workspace-level CWD (majority vote, focused pane breaks ties). */
	readonly cwd: string | null;
	/** Git branch from the first pane matching the winning CWD that has branch data. */
	readonly branch: string | null;
	/** PR info from the same pane that provided branch. */
	readonly pr: PrInfo | null;
}

/**
 * Derive workspace-level CWD, branch, and PR from per-pane data.
 * Uses majority vote on raw CWD paths, focused pane breaks ties.
 * Branch and PR come from the first pane that matches the winning CWD
 * and has non-null branch info.
 */
export function useWorkspaceGitInfo(workspaceId: string): WorkspaceGitInfo {
	// Select only the panes record — referentially stable when unrelated workspaces change.
	const panes = useStore(
		(s) => s.workspaces.find((w) => w.id === workspaceId)?.panes ?? null,
	) as Record<string, PaneConfig> | null;
	const focusedPaneId = useStore((s) => s.focusedPaneId);
	const paneBranches = useStore((s) => s.paneBranches);
	const panePrs = useStore((s) => s.panePrs);

	return useMemo(() => {
		if (!panes) return { cwd: null, branch: null, pr: null };

		const paneIds = Object.keys(panes);
		if (paneIds.length === 0) return { cwd: null, branch: null, pr: null };

		// Build paneId → CWD map from workspace pane configs
		const paneCwds: Record<string, string | null> = {};
		for (const pid of paneIds) {
			paneCwds[pid] = panes[pid]?.cwd ?? null;
		}

		const winningCwd = majorityOrFocused(paneCwds, focusedPaneId);
		if (!winningCwd) return { cwd: null, branch: null, pr: null };

		// Find branch and PR from the first pane matching the winning CWD.
		// Prefer the pane that has branch info; capture first PR as fallback.
		let branch: string | null = null;
		let pr: PrInfo | null = null;
		let firstPr: PrInfo | null = null;
		for (const pid of paneIds) {
			if (paneCwds[pid] !== winningCwd) continue;
			// Capture the first PR we see from any matching pane
			if (firstPr == null) firstPr = panePrs[pid] ?? null;
			const b = paneBranches[pid];
			if (b != null) {
				branch = b;
				pr = panePrs[pid] ?? null;
				break;
			}
		}

		// If no matching pane had branch info, use the first PR we found (if any).
		// This handles the edge case where PR data arrives before branch detection.
		if (branch == null) pr = firstPr;

		return { cwd: winningCwd, branch, pr };
	}, [panes, focusedPaneId, paneBranches, panePrs]);
}
