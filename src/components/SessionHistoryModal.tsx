import { useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { getPortalRoot } from "../lib/ui-constants";
import { AGENT_KINDS, type AgentKind, type AgentSession } from "../shared/types";
import { useStore } from "../store";

const AGENT_LABELS: Record<AgentKind, string> = {
	claude: "Claude",
	gemini: "Gemini",
	codex: "Codex",
};

const TRUNCATE_ID_LENGTH = 8;

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

function truncateId(id: string): string {
	return id.length > TRUNCATE_ID_LENGTH ? id.slice(0, TRUNCATE_ID_LENGTH) : id;
}

const FOCUS_RING = "focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none";

function SessionRow({
	session,
	paneId,
	onResume,
}: {
	session: AgentSession;
	paneId: string;
	onResume: (paneId: string, session: AgentSession, unsafe: boolean) => void;
}) {
	return (
		<div className="flex flex-col gap-1.5 p-3 rounded-md bg-canvas border border-edge hover:border-accent/40 transition-colors">
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2 min-w-0">
					<span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-overlay text-accent">
						{AGENT_LABELS[session.agent]}
					</span>
					<span className="text-[11px] text-content-muted shrink-0">
						{formatRelativeTime(session.timestamp)}
					</span>
				</div>
				<div className="flex items-center gap-1.5 shrink-0">
					<button
						type="button"
						className={`text-[11px] px-2 py-1 rounded bg-overlay text-content hover:bg-accent hover:text-canvas transition-colors cursor-pointer ${FOCUS_RING}`}
						onClick={() => onResume(paneId, session, false)}
					>
						Resume
					</button>
					<button
						type="button"
						className={`text-[11px] px-2 py-1 rounded bg-overlay text-danger hover:bg-danger hover:text-canvas transition-colors cursor-pointer ${FOCUS_RING}`}
						onClick={() => onResume(paneId, session, true)}
						title="Resume without confirmation prompts"
					>
						Unsafe
					</button>
				</div>
			</div>
			{session.summary && (
				<p className="text-xs text-content truncate">{session.summary}</p>
			)}
			<div className="flex items-center gap-3 text-[10px] text-content-muted">
				<span className="font-mono">{truncateId(session.id)}</span>
				{session.branch && (
					<span className="truncate max-w-48" title={session.branch}>
						{session.branch}
					</span>
				)}
			</div>
		</div>
	);
}

export function SessionHistoryModal() {
	const paneId = useStore((s) => s.sessionHistoryPaneId);
	const sessions = useStore((s) => s.agentSessions);
	const agentFilter = useStore((s) => s.agentFilter);
	const setAgentFilter = useStore((s) => s.setAgentFilter);
	const closeSessionHistory = useStore((s) => s.closeSessionHistory);
	const resumeSession = useStore((s) => s.resumeSession);
	const modalRef = useRef<HTMLDivElement>(null);

	const filtered = useMemo(
		() => (agentFilter ? sessions.filter((s) => s.agent === agentFilter) : sessions),
		[sessions, agentFilter],
	);

	useEffect(() => {
		if (!paneId) return;
		const handler = (e: KeyboardEvent) => {
			if (e.key === "Escape") closeSessionHistory();
		};
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [paneId, closeSessionHistory]);

	// Focus modal on open so keyboard events (Escape) are captured
	useEffect(() => {
		if (paneId && modalRef.current) {
			modalRef.current.focus();
		}
	}, [paneId]);

	if (!paneId) return null;

	return createPortal(
		// biome-ignore lint/a11y/useKeyWithClickEvents: Escape key handled via document listener above
		<div
			role="presentation"
			className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60"
			onClick={closeSessionHistory}
		>
			{/* biome-ignore lint/a11y/useKeyWithClickEvents: stopPropagation only, keyboard handled by overlay */}
			<div
				ref={modalRef}
				tabIndex={-1}
				className="w-full max-w-xl max-w-[calc(100vw-2rem)] max-h-[70vh] flex flex-col bg-canvas/80 backdrop-blur-2xl border border-edge/50 rounded-md shadow-panel animate-panel-in overflow-hidden outline-none"
				role="dialog"
				aria-modal="true"
				aria-label="Session History"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex items-center justify-between px-6 py-4 border-b border-edge">
					<h2 className="text-sm font-semibold tracking-wide text-content">Session History</h2>
					<button
						type="button"
						className={`text-content-muted hover:text-content text-sm cursor-pointer ${FOCUS_RING}`}
						onClick={closeSessionHistory}
						aria-label="Close"
					>
						&#x2715;
					</button>
				</div>

				<div className="flex items-center gap-1 px-6 py-2 border-b border-edge">
					<FilterTab
						label="All"
						active={agentFilter === null}
						onClick={() => setAgentFilter(null)}
					/>
					{AGENT_KINDS.map((kind) => (
						<FilterTab
							key={kind}
							label={AGENT_LABELS[kind]}
							active={agentFilter === kind}
							onClick={() => setAgentFilter(kind)}
						/>
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
							/>
						))
					)}
				</div>
			</div>
		</div>,
		getPortalRoot(),
	);
}

function FilterTab({
	label,
	active,
	onClick,
}: {
	label: string;
	active: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			className={`text-[11px] px-2.5 py-1 rounded cursor-pointer transition-colors ${FOCUS_RING} ${
				active
					? "bg-accent text-canvas"
					: "bg-overlay text-content-muted hover:text-content"
			}`}
			onClick={onClick}
		>
			{label}
		</button>
	);
}
