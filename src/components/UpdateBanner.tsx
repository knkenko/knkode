import type { UpdateActions, UpdateState } from "../hooks/useUpdateChecker";

const BTN_PRIMARY =
	"h-6 text-[10px] font-medium rounded bg-accent text-white border-none cursor-pointer hover:brightness-110 focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none transition-all duration-150";
const BTN_SECONDARY =
	"h-6 text-[10px] font-medium rounded bg-transparent text-content-muted border border-edge cursor-pointer hover:text-content hover:bg-overlay focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none transition-all duration-150";

const VISIBLE_STATUSES = new Set(["available", "downloading", "ready", "error", "up_to_date"]);

interface UpdateBannerProps {
	state: UpdateState;
	actions: UpdateActions;
}

export function UpdateBanner({ state, actions }: UpdateBannerProps) {
	if (state.dismissed || !VISIBLE_STATUSES.has(state.status)) {
		return null;
	}

	return (
		<div className="shrink-0 mx-1.5 mb-1 rounded-md bg-accent/10 border border-accent/20 p-2 no-drag">
			{state.status === "available" && (
				<>
					<p className="text-[11px] text-content font-medium m-0 mb-1.5">
						New version available
						<span className="text-accent ml-1">v{state.version}</span>
					</p>
					<div className="flex gap-1.5">
						<button
							type="button"
							onClick={actions.installUpdate}
							className={`flex-1 ${BTN_PRIMARY}`}
						>
							Install
						</button>
						<button type="button" onClick={actions.dismiss} className={`flex-1 ${BTN_SECONDARY}`}>
							Later
						</button>
					</div>
				</>
			)}

			{state.status === "downloading" && (
				<>
					<p className="text-[11px] text-content-muted m-0 mb-1.5">Downloading v{state.version}…</p>
					<div className="h-1.5 rounded-full bg-surface overflow-hidden">
						<div
							className="h-full rounded-full bg-accent transition-all duration-300"
							style={{ width: `${Math.round(state.progress * 100)}%` }}
						/>
					</div>
				</>
			)}

			{state.status === "ready" && (
				<>
					<p className="text-[11px] text-content m-0 mb-1.5">Ready to restart</p>
					<button type="button" onClick={actions.restartApp} className={`w-full ${BTN_PRIMARY}`}>
						Restart now
					</button>
				</>
			)}

			{state.status === "up_to_date" && (
				<p className="text-[11px] text-content-muted m-0">You're up to date</p>
			)}

			{state.status === "error" && (
				<>
					<p className="text-[11px] text-danger m-0 mb-1.5">
						{state.error ?? "Update check failed"}
					</p>
					<div className="flex gap-1.5">
						<button
							type="button"
							onClick={actions.checkForUpdate}
							className={`flex-1 ${BTN_SECONDARY}`}
						>
							Retry
						</button>
						<button type="button" onClick={actions.dismiss} className={`flex-1 ${BTN_SECONDARY}`}>
							Dismiss
						</button>
					</div>
				</>
			)}
		</div>
	);
}
