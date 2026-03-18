interface SettingsSectionProps {
	label: string;
	gap?: number;
	children: React.ReactNode;
}

export function SettingsSection({ label, gap = 12, children }: SettingsSectionProps) {
	return (
		<div className="grid grid-cols-[110px_1fr] items-start gap-x-4 gap-y-4">
			<div className="pt-1.5">
				<span className="section-label">{label}</span>
			</div>
			<div className="flex flex-col min-w-0" style={{ gap }}>
				{children}
			</div>
		</div>
	);
}
