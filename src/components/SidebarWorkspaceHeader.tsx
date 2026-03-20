import type { Workspace } from "../shared/types";

interface SidebarWorkspaceHeaderProps {
	workspace: Workspace;
	isActive: boolean;
	isCollapsed: boolean;
	onToggleCollapse: () => void;
	onActivate: () => void;
}

export function SidebarWorkspaceHeader({
	workspace,
	isActive,
	isCollapsed,
	onToggleCollapse,
	onActivate,
}: SidebarWorkspaceHeaderProps) {
	const paneCount = Object.keys(workspace.panes).length;

	return (
		<button
			type="button"
			onClick={(e) => {
				// Shift+click activates the workspace without toggling collapse
				if (e.shiftKey) {
					onActivate();
				} else {
					onToggleCollapse();
				}
			}}
			className={`flex items-center gap-2 w-full px-3 py-1.5 text-left cursor-pointer border-none rounded-sm transition-colors duration-200 ${
				isActive
					? "bg-overlay-active text-content"
					: "bg-transparent text-content-secondary hover:bg-overlay hover:text-content"
			}`}
			style={isActive ? { borderLeft: `3px solid ${workspace.color}` } : { borderLeft: "3px solid transparent" }}
		>
			{/* Collapse chevron */}
			<svg
				width="10"
				height="10"
				viewBox="0 0 10 10"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.5"
				strokeLinecap="round"
				strokeLinejoin="round"
				aria-hidden="true"
				className={`shrink-0 transition-transform duration-200 text-content-muted ${
					isCollapsed ? "-rotate-90" : ""
				}`}
			>
				<path d="M2.5 3.5L5 6.5L7.5 3.5" />
			</svg>

			{/* Color dot */}
			<span
				aria-hidden="true"
				className="w-2 h-2 rounded-full shrink-0"
				style={{ background: workspace.color }}
			/>

			{/* Workspace name */}
			<span className="text-[11px] font-medium truncate flex-1 min-w-0">
				{workspace.name}
			</span>

			{/* Pane count badge */}
			{paneCount > 1 && (
				<span
					className="text-[9px] leading-none font-medium px-1 py-0.5 rounded-full shrink-0"
					style={{
						background: `color-mix(in srgb, ${workspace.color} 20%, transparent)`,
						color: workspace.color,
					}}
				>
					{paneCount}
				</span>
			)}
		</button>
	);
}
