import type { AgentKind, AgentSession } from "../shared/types";

const SAFE_SESSION_ID = /^[a-zA-Z0-9_-]+$/;

/** Build the CLI command to resume an agent session. */
function buildResumeCommand(session: AgentSession, unsafe: boolean): string {
	if (!SAFE_SESSION_ID.test(session.id)) {
		throw new Error(`Invalid session ID: ${session.id}`);
	}
	switch (session.agent) {
		case "claude":
			return unsafe
				? `claude --resume ${session.id} --permission-mode bypassPermissions`
				: `claude --resume ${session.id}`;
		case "gemini":
			return `gemini --resume ${session.id}`;
		case "codex":
			return unsafe ? `codex resume ${session.id} --full-auto` : `codex resume ${session.id}`;
		default: {
			const _exhaustive: never = session.agent;
			throw new Error(`Unknown agent kind: ${_exhaustive}`);
		}
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
	_get: () => SessionHistoryState,
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
			set({ sessionHistoryPaneId: paneId, agentSessions: [], agentFilter: null });
		},

		closeSessionHistory: () => {
			set({ sessionHistoryPaneId: null, agentFilter: null, agentSessions: [] });
		},

		resumeSession: async (paneId: string, session: AgentSession, unsafe: boolean) => {
			try {
				const command = buildResumeCommand(session, unsafe);
				await window.api.writePty(paneId, `${command}\r`);
				set({ sessionHistoryPaneId: null, agentFilter: null });
			} catch (err) {
				console.error(`[store] Failed to resume session in pane ${paneId}:`, err);
			}
		},
	};
}
