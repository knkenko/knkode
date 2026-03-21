import type { LayoutPreset, PaneConfig, PaneTheme } from "../shared/types";
import { CwdInput } from "./CwdInput";
import { LayoutPicker } from "./LayoutPicker";
import { SegmentedButton } from "./SegmentedButton";
import { SettingsSection } from "./SettingsSection";
import { SnippetsSection } from "./SnippetsSection";

type StatusBarPosition = NonNullable<PaneTheme["statusBarPosition"]>;
const STATUS_BAR_POSITIONS = ["top", "bottom"] as const satisfies readonly [
	StatusBarPosition,
	...StatusBarPosition[],
];

interface WorkspaceTabPanelProps {
	panes: Record<string, PaneConfig>;
	name: string;
	onNameChange: (name: string) => void;
	homeDir: string;
	currentPreset: LayoutPreset | null;
	onLayoutChange: (preset: LayoutPreset) => void;
	statusBarPosition: StatusBarPosition;
	onStatusBarPositionChange: (pos: StatusBarPosition) => void;
	onPaneUpdate: (paneId: string, updates: Partial<PaneConfig>) => void;
	hidden?: boolean;
}

export function WorkspaceTabPanel({
	panes,
	name,
	onNameChange,
	homeDir,
	currentPreset,
	onLayoutChange,
	statusBarPosition,
	onStatusBarPositionChange,
	onPaneUpdate,
	hidden,
}: WorkspaceTabPanelProps) {
	return (
		<div
			id="settings-tabpanel-Workspace"
			role="tabpanel"
			aria-labelledby="settings-tab-Workspace"
			hidden={hidden}
			className="flex-1 min-h-0 px-6 py-6 overflow-y-auto overflow-x-hidden flex flex-col gap-8"
		>
			{/* General */}
			<SettingsSection label="General">
				<label className="flex items-center gap-3">
					<span className="text-xs text-content-secondary w-16 shrink-0">Name</span>
					<input
						value={name}
						onChange={(e) => onNameChange(e.target.value)}
						maxLength={128}
						className="settings-input flex-1 min-w-0"
					/>
				</label>
			</SettingsSection>
			{/* Panes */}
			<SettingsSection label="Panes" gap={8}>
				{Object.entries(panes).map(([paneId, pane]) => (
					<div key={paneId} className="flex gap-1.5">
						<input
							value={pane.label}
							onChange={(e) => onPaneUpdate(paneId, { label: e.target.value })}
							maxLength={64}
							className="settings-input w-24 shrink-0"
							placeholder="Label"
							aria-label={`Pane ${pane.label} label`}
						/>
						<CwdInput
							value={pane.cwd}
							homeDir={homeDir}
							onChange={(cwd) => onPaneUpdate(paneId, { cwd })}
							aria-label={`Pane ${pane.label} working directory`}
						/>
						<input
							value={pane.startupCommand || ""}
							onChange={(e) =>
								onPaneUpdate(paneId, {
									startupCommand: e.target.value || null,
								})
							}
							maxLength={1024}
							className="settings-input flex-[2] min-w-0"
							placeholder="Startup command"
							aria-label={`Pane ${pane.label} startup command`}
						/>
					</div>
				))}
			</SettingsSection>
			{/* Layout */}
			<LayoutPicker current={currentPreset} onSelect={onLayoutChange} />
			{/* Status Bar Position */}
			<SegmentedButton
				options={STATUS_BAR_POSITIONS}
				value={statusBarPosition}
				onChange={onStatusBarPositionChange}
				label="Status bar"
			/>
			{/* Snippets */}
			<SnippetsSection />
		</div>
	);
}
