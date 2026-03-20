import type { AgentStatus } from "../../shared/types";

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

	if (status === "in_progress") {
		if (gruvbox)
			return <span className="w-2 h-3 bg-[#fe8019] animate-pulse shrink-0" />;
		return (
			<svg
				className="animate-spin h-3 w-3 text-[#6c63ff] shrink-0"
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

	// input_required
	return (
		<span className="relative flex h-2.5 w-2.5 shrink-0">
			<span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#e74c3c] opacity-75" />
			<span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#e74c3c]" />
		</span>
	);
}
