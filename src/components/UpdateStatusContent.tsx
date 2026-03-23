import type { UpdateActions, UpdateState } from "../hooks/useUpdateChecker";

type Variant = "compact" | "full";

const BTN_STYLES: Record<Variant, { primary: string; secondary: string }> = {
	compact: {
		primary:
			"h-6 text-[10px] font-medium rounded bg-accent text-white border-none cursor-pointer hover:brightness-110 focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none transition-all duration-150",
		secondary:
			"h-6 text-[10px] font-medium rounded bg-transparent text-content-muted border border-edge cursor-pointer hover:text-content hover:bg-overlay focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none transition-all duration-150",
	},
	full: {
		primary:
			"h-7 text-xs font-medium rounded bg-accent text-white border-none cursor-pointer hover:brightness-110 focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none transition-all duration-150 px-3",
		secondary:
			"h-7 text-xs font-medium rounded bg-transparent text-content-secondary border border-edge cursor-pointer hover:text-content hover:bg-overlay focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none transition-all duration-150 px-3",
	},
};

const TEXT: Record<Variant, { base: string; muted: string; danger: string }> = {
	compact: {
		base: "text-[11px] text-content font-medium m-0",
		muted: "text-[11px] text-content-muted m-0",
		danger: "text-[11px] text-danger m-0",
	},
	full: {
		base: "text-xs text-content m-0",
		muted: "text-xs text-content-muted m-0",
		danger: "text-xs text-danger m-0",
	},
};

interface UpdateStatusContentProps {
	state: UpdateState;
	actions: UpdateActions;
	variant: Variant;
}

export function UpdateStatusContent({ state, actions, variant }: UpdateStatusContentProps) {
	const btn = BTN_STYLES[variant];
	const text = TEXT[variant];
	const { status } = state;

	switch (status) {
		case "idle":
			// Only the full variant shows an idle check button
			if (variant !== "full") return null;
			return (
				<button type="button" onClick={actions.checkForUpdate} className={btn.secondary}>
					Check for Updates
				</button>
			);

		case "checking":
			if (variant !== "full") return null;
			return (
				<button
					type="button"
					disabled
					className={`${btn.secondary} opacity-60 cursor-wait disabled:pointer-events-none`}
				>
					Checking...
				</button>
			);

		case "up_to_date":
			return <span className={text.muted}>You're up to date.</span>;

		case "available":
			return (
				<>
					<p className={`${text.base} mb-1.5`}>
						New version available
						<span className="text-accent ml-1">v{state.version}</span>
					</p>
					<div className="flex gap-1.5">
						<button
							type="button"
							onClick={actions.installUpdate}
							className={`flex-1 ${btn.primary}`}
						>
							Install
						</button>
						{variant === "compact" && (
							<button type="button" onClick={actions.dismiss} className={`flex-1 ${btn.secondary}`}>
								Later
							</button>
						)}
					</div>
				</>
			);

		case "downloading": {
			const pct = Math.min(100, Math.round(state.progress * 100));
			return (
				<>
					<p className={`${text.muted} mb-1.5`}>Downloading v{state.version}...</p>
					<div
						className="h-1.5 rounded-full bg-surface overflow-hidden"
						role="progressbar"
						aria-valuenow={pct}
						aria-valuemin={0}
						aria-valuemax={100}
						aria-label={`Downloading update: ${pct}%`}
					>
						<div
							className="h-full rounded-full bg-accent transition-all duration-300"
							style={{ width: `${pct}%` }}
						/>
					</div>
				</>
			);
		}

		case "ready":
			return (
				<>
					<p className={`${text.base} mb-1.5`}>
						{variant === "full" ? "Update installed." : "Ready to restart"}
					</p>
					<button
						type="button"
						onClick={actions.restartApp}
						className={`${variant === "compact" ? "w-full" : ""} ${btn.primary}`}
					>
						Restart Now
					</button>
				</>
			);

		case "error":
			return (
				<>
					<p className={`${text.danger} mb-1.5`}>{state.error ?? "Update check failed"}</p>
					<div className="flex gap-1.5">
						<button
							type="button"
							onClick={actions.checkForUpdate}
							className={`flex-1 ${btn.secondary}`}
						>
							Retry
						</button>
						{variant === "compact" && (
							<button type="button" onClick={actions.dismiss} className={`flex-1 ${btn.secondary}`}>
								Dismiss
							</button>
						)}
					</div>
				</>
			);

		default: {
			const _exhaustive: never = status;
			return _exhaustive;
		}
	}
}
