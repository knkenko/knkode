import type { LayoutPreset } from "../shared/types";
import { SettingsSection } from "./SettingsSection";

interface LayoutPickerProps {
	current: LayoutPreset | null;
	onSelect: (preset: LayoutPreset) => void;
}

function LayoutIcon({ children }: { children: React.ReactNode }) {
	return (
		<svg
			viewBox="0 0 32 24"
			className="w-8 h-6 stroke-current fill-none"
			strokeWidth={1.5}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			{children}
		</svg>
	);
}

const PRESETS: { value: LayoutPreset; label: string; icon: React.ReactNode }[] = [
	{
		value: "single",
		label: "Single",
		icon: (
			<LayoutIcon>
				<rect x="2" y="2" width="28" height="20" />
			</LayoutIcon>
		),
	},
	{
		value: "2-column",
		label: "2 Columns",
		icon: (
			<LayoutIcon>
				<rect x="2" y="2" width="13" height="20" />
				<rect x="17" y="2" width="13" height="20" />
			</LayoutIcon>
		),
	},
	{
		value: "2-row",
		label: "2 Rows",
		icon: (
			<LayoutIcon>
				<rect x="2" y="2" width="28" height="9" />
				<rect x="2" y="13" width="28" height="9" />
			</LayoutIcon>
		),
	},
	{
		value: "3-panel-l",
		label: "3 Panel L",
		icon: (
			<LayoutIcon>
				<rect x="2" y="2" width="13" height="20" />
				<rect x="17" y="2" width="13" height="9" />
				<rect x="17" y="13" width="13" height="9" />
			</LayoutIcon>
		),
	},
	{
		value: "3-panel-t",
		label: "3 Panel T",
		icon: (
			<LayoutIcon>
				<rect x="2" y="2" width="28" height="9" />
				<rect x="2" y="13" width="13" height="9" />
				<rect x="17" y="13" width="13" height="9" />
			</LayoutIcon>
		),
	},
	{
		value: "2x2-grid",
		label: "2x2 Grid",
		icon: (
			<LayoutIcon>
				<rect x="2" y="2" width="13" height="9" />
				<rect x="17" y="2" width="13" height="9" />
				<rect x="2" y="13" width="13" height="9" />
				<rect x="17" y="13" width="13" height="9" />
			</LayoutIcon>
		),
	},
];

export function LayoutPicker({ current, onSelect }: LayoutPickerProps) {
	return (
		<SettingsSection label="Layout">
			<div className="grid grid-cols-3 gap-1.5">
				{PRESETS.map((p) => (
					<button
						type="button"
						key={p.value}
						onClick={() => onSelect(p.value)}
						className={`flex flex-col items-center gap-1 py-2.5 px-2 border rounded-md cursor-pointer text-content ${
							current === p.value
								? "border-accent bg-accent/15"
								: "border-edge bg-sunken hover:border-content-muted"
						}`}
						title={p.label}
						aria-label={p.label}
					>
						{p.icon}
						<span className="text-[10px] text-content-muted">{p.label}</span>
					</button>
				))}
			</div>
		</SettingsSection>
	);
}
