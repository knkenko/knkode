import { useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { toPresetName } from "../data/theme-presets";
import { getPortalRoot } from "../lib/ui-constants";
import { AGENT_KINDS, type AgentKind, type AgentSession } from "../shared/types";
import { useStore } from "../store";
import { AgentIcon } from "./AgentIcons";
import { FOCUS_VIS } from "./pane-chrome/shared";
import { getSessionHistoryTokens } from "./sidebar-variants/ThemeRegistry";
import type { SessionHistoryTokens } from "./sidebar-variants/types";

const AGENT_LABELS: Record<AgentKind, string> = {
	claude: "Claude",
	gemini: "Gemini",
	codex: "Codex",
};

function formatRelativeTime(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime();
	if (!Number.isFinite(diff) || diff < 0) return "unknown";
	const seconds = Math.floor(diff / 1000);
	if (seconds < 60) return "just now";
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ago`;
}

/** Resolve the display name for a session: title > summary > "Untitled session". */
function sessionDisplayName(session: AgentSession): string {
	return session.title ?? session.summary ?? "Untitled session";
}

function SessionRow({
	session,
	paneId,
	onResume,
	tokens,
}: {
	session: AgentSession;
	paneId: string;
	onResume: (paneId: string, session: AgentSession, unsafe: boolean) => void;
	tokens: SessionHistoryTokens;
}) {
	const timeStr = formatRelativeTime((session.lastUpdated || null) ?? session.timestamp);
	const name = sessionDisplayName(session);

	return (
		<div className={`flex items-center gap-3 p-3 ${tokens.row}`} style={tokens.rowStyle}>
			<AgentIcon agent={session.agent} className="w-5 h-5 shrink-0 text-accent opacity-70" />
			<div className="flex-1 min-w-0">
				<p className="text-xs text-content truncate" title={name}>
					{name}
				</p>
				<span className="text-[10px] text-content-muted">{timeStr}</span>
			</div>
			<div className="flex items-center gap-1.5 shrink-0">
				<button
					type="button"
					className={`${tokens.resumeButton} ${FOCUS_VIS}`}
					style={tokens.resumeButtonStyle}
					onClick={() => onResume(paneId, session, false)}
				>
					{tokens.resumeLabel}
				</button>
				<button
					type="button"
					className={`${tokens.resumeButton} ${FOCUS_VIS} !text-danger hover:!bg-danger hover:!text-canvas`}
					style={tokens.resumeButtonStyle}
					onClick={() => onResume(paneId, session, true)}
					title="Resume without confirmation prompts"
				>
					unsafe
				</button>
			</div>
		</div>
	);
}

const FOCUSABLE_SELECTOR =
	'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function SessionHistoryModal() {
	const paneId = useStore((s) => s.sessionHistoryPaneId);
	const sessions = useStore((s) => s.agentSessions);
	const agentFilter = useStore((s) => s.agentFilter);
	const setAgentFilter = useStore((s) => s.setAgentFilter);
	const closeSessionHistory = useStore((s) => s.closeSessionHistory);
	const resumeSession = useStore((s) => s.resumeSession);
	const workspaces = useStore((s) => s.workspaces);
	const activeWorkspaceId = useStore((s) => s.appState.activeWorkspaceId);
	const modalRef = useRef<HTMLDivElement>(null);

	const preset = useMemo(() => {
		const ws = workspaces.find((w) => w.id === activeWorkspaceId);
		return toPresetName(ws?.theme.preset);
	}, [workspaces, activeWorkspaceId]);

	const tokens = useMemo(() => getSessionHistoryTokens(preset), [preset]);

	const filtered = useMemo(
		() => (agentFilter ? sessions.filter((s) => s.agent === agentFilter) : sessions),
		[sessions, agentFilter],
	);

	// Escape to close
	useEffect(() => {
		if (!paneId) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") closeSessionHistory();
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [paneId, closeSessionHistory]);

	// Focus trap — contain Tab/Shift+Tab within the dialog
	useEffect(() => {
		const dialog = modalRef.current;
		if (!paneId || !dialog) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key !== "Tab") return;
			const focusable = dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
			if (focusable.length === 0) return;
			// biome-ignore lint/style/noNonNullAssertion: length > 0 checked above
			const first = focusable[0]!;
			// biome-ignore lint/style/noNonNullAssertion: length > 0 checked above
			const last = focusable[focusable.length - 1]!;
			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault();
				last.focus();
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault();
				first.focus();
			}
		};
		dialog.addEventListener("keydown", handler);
		dialog.focus();
		return () => dialog.removeEventListener("keydown", handler);
	}, [paneId]);

	if (!paneId) return null;

	return createPortal(
		// biome-ignore lint/a11y/noStaticElementInteractions: Escape key handled via document listener above
		<div
			role="presentation"
			className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60"
			onClick={closeSessionHistory}
		>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation only, keyboard handled by overlay */}
			<div
				ref={modalRef}
				tabIndex={-1}
				className={`w-full max-w-[min(36rem,calc(100vw-2rem))] max-h-[70vh] flex flex-col overflow-hidden outline-none animate-panel-in ${tokens.modal}`}
				style={tokens.modalStyle}
				role="dialog"
				aria-modal="true"
				aria-label="Session History"
				onClick={(e) => e.stopPropagation()}
			>
				<div className={`flex items-center justify-between px-6 py-4 ${tokens.header}`}>
					<h2 className="text-sm font-semibold tracking-wide">Session History</h2>
					<button
						type="button"
						className={`text-content-muted hover:text-content text-sm cursor-pointer ${FOCUS_VIS}`}
						onClick={closeSessionHistory}
						aria-label="Close"
					>
						&#x2715;
					</button>
				</div>

				<div className="flex items-center gap-1 px-6 py-2">
					<button
						type="button"
						className={`${agentFilter === null ? tokens.filterTabActive : tokens.filterTab} ${FOCUS_VIS}`}
						onClick={() => setAgentFilter(null)}
					>
						All
					</button>
					{AGENT_KINDS.map((kind) => (
						<button
							key={kind}
							type="button"
							className={`${agentFilter === kind ? tokens.filterTabActive : tokens.filterTab} ${FOCUS_VIS}`}
							onClick={() => setAgentFilter(kind)}
						>
							{AGENT_LABELS[kind]}
						</button>
					))}
				</div>

				<div className="flex-1 overflow-y-auto p-3 flex flex-col gap-2">
					{filtered.length === 0 ? (
						<p className="text-xs text-content-muted text-center py-8">
							{sessions.length === 0
								? "No sessions found for this project"
								: "No sessions match the selected filter"}
						</p>
					) : (
						filtered.map((session) => (
							<SessionRow
								key={`${session.agent}-${session.id}`}
								session={session}
								paneId={paneId}
								onResume={resumeSession}
								tokens={tokens}
							/>
						))
					)}
				</div>
			</div>
		</div>,
		getPortalRoot(),
	);
}
