import type { UpdateActions, UpdateState } from "../hooks/useUpdateChecker";
import { UpdateStatusContent } from "./UpdateStatusContent";

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
			<UpdateStatusContent state={state} actions={actions} variant="compact" />
		</div>
	);
}
