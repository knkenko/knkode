import type { UpdateActions, UpdateState } from "../hooks/useUpdateChecker";

interface UpdateBannerProps {
	state: UpdateState;
	actions: UpdateActions;
}

export function UpdateBanner({ state, actions }: UpdateBannerProps) {
	if (
		state.dismissed ||
		(state.status !== "available" && state.status !== "downloading" && state.status !== "ready")
	) {
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
							className="flex-1 h-6 text-[10px] font-medium rounded bg-accent text-white border-none cursor-pointer hover:brightness-110 transition-all duration-150"
						>
							Install
						</button>
						<button
							type="button"
							onClick={actions.dismiss}
							className="flex-1 h-6 text-[10px] font-medium rounded bg-transparent text-content-muted border border-edge cursor-pointer hover:text-content hover:bg-overlay transition-all duration-150"
						>
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
					<button
						type="button"
						onClick={actions.installUpdate}
						className="w-full h-6 text-[10px] font-medium rounded bg-accent text-white border-none cursor-pointer hover:brightness-110 transition-all duration-150"
					>
						Restart now
					</button>
				</>
			)}
		</div>
	);
}
