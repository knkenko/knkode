import type { AgentStatus } from "../../shared/types";

/** Pulsing red dot indicating a pane/workspace needs attention.
 *  Accepts size class (default "h-2.5 w-2.5") and optional extra className for positioning. */
export function AttentionDot({
	size = "h-2.5 w-2.5",
	className,
}: {
	size?: string;
	className?: string;
}) {
	return (
		<span
			role="status"
			aria-label="Needs attention"
			className={`relative flex ${size} shrink-0 ${className ?? ""}`}
		>
			<span className="animate-ping motion-reduce:animate-none absolute inline-flex h-full w-full rounded-full bg-danger opacity-75" />
			<span className={`relative inline-flex rounded-full ${size} bg-danger`} />
		</span>
	);
}

/** Shared agent status indicator for sidebar pane entries.
 *  Returns null for "idle" — only renders a visual for active states.
 *  Gruvbox gets a block cursor; all others get a spinner or ping dot. */
export function AgentStatusIndicator({
	status,
	gruvbox,
}: {
	status: AgentStatus;
	gruvbox?: boolean;
}) {
	if (status === "idle") return null;

	if (status === "active") {
		if (gruvbox) return <span className="w-2 h-3 bg-[#fe8019] animate-pulse motion-reduce:animate-none shrink-0" />;
		return (
			<svg
				className="animate-spin motion-reduce:animate-none h-3 w-3 text-accent shrink-0"
				xmlns="http://www.w3.org/2000/svg"
				fill="none"
				viewBox="0 0 24 24"
			>
				<circle
					className="opacity-25"
					cx="12"
					cy="12"
					r="10"
					stroke="currentColor"
					strokeWidth="4"
				/>
				<path
					className="opacity-75"
					fill="currentColor"
					d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
				/>
			</svg>
		);
	}

	// attention — exhaustive: only "attention" reaches here
	const _exhaustive: "attention" = status;
	void _exhaustive;
	return <AttentionDot />;
}
