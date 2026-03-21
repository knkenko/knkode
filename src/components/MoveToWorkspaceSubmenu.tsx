import type { Workspace } from "../shared/types";

interface MoveToWorkspaceSubmenuProps {
	workspaces: Workspace[];
	onMove: (wsId: string) => void;
}

export function MoveToWorkspaceSubmenu({ workspaces, onMove }: MoveToWorkspaceSubmenuProps) {
	return (
		<div className="flex flex-col gap-0.5 px-1 py-1">
			{workspaces.map((ws) => (
				<button
					type="button"
					key={ws.id}
					className="ctx-item flex items-center gap-2"
					onClick={(e) => {
						e.stopPropagation();
						onMove(ws.id);
					}}
				>
					<span className="truncate">{ws.name}</span>
				</button>
			))}
		</div>
	);
}
