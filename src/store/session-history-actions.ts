import type { AgentKind, AgentSession } from "../shared/types";

/** Build the CLI command to resume an agent session. */
function buildResumeCommand(session: AgentSession, unsafe: boolean): string {
	switch (session.agent) {
		case "claude":
			return unsafe
				? `claude --resume ${session.id} --permission-mode bypassPermissions`
				: `claude --resume ${session.id}`;
		case "gemini":
			return unsafe
				? `gemini --resume ${session.id} --yolo`
				: `gemini --resume ${session.id}`;
		case "codex":
			return unsafe
				? `codex resume ${session.id} --full-auto`
				: `codex resume ${session.id}`;
	}
}

export interface SessionHistoryState {
	agentSessions: AgentSession[];
	agentFilter: AgentKind | null;
	/** Non-null when the modal is open — stores the pane ID that triggered it. */
	sessionHistoryPaneId: string | null;
}

export function createSessionHistorySlice(
	set: (partial: Partial<SessionHistoryState>) => void,
	get: () => SessionHistoryState,
) {
	return {
		agentSessions: [] as AgentSession[],
		agentFilter: null as AgentKind | null,
		sessionHistoryPaneId: null as string | null,

		fetchAgentSessions: async (projectCwd: string) => {
			try {
				const sessions = await window.api.listAgentSessions(projectCwd);
				set({ agentSessions: sessions });
			} catch (err) {
				console.error("[store] Failed to fetch agent sessions:", err);
				set({ agentSessions: [] });
			}
		},

		setAgentFilter: (filter: AgentKind | null) => {
			set({ agentFilter: filter });
		},

		openSessionHistory: (paneId: string) => {
			set({ sessionHistoryPaneId: paneId });
		},

		closeSessionHistory: () => {
			set({ sessionHistoryPaneId: null });
		},

		resumeSession: (paneId: string, session: AgentSession, unsafe: boolean) => {
			const command = buildResumeCommand(session, unsafe);
			window.api.writePty(paneId, `${command}\r`).catch((err) => {
				console.error(`[store] Failed to resume session in pane ${paneId}:`, err);
			});
			set({ sessionHistoryPaneId: null });
		},
	};
}
