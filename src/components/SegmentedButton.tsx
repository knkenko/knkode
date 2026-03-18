interface SegmentedButtonProps<T extends string> {
	options: readonly [T, ...T[]];
	value: T;
	onChange: (value: T) => void;
	label: string;
}

export function SegmentedButton<T extends string>({
	options,
	value,
	onChange,
	label,
}: SegmentedButtonProps<T>) {
	return (
		<div className="flex items-center gap-3">
			<span className="text-xs text-content-secondary w-20 shrink-0">{label}</span>
			<div
				className="flex rounded-sm overflow-hidden border border-edge"
				role="radiogroup"
				aria-label={label}
				onKeyDown={(e) => {
					if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
					e.preventDefault();
					const idx = options.indexOf(value);
					const next =
						e.key === "ArrowRight"
							? options[(idx + 1) % options.length]!
							: options[(idx - 1 + options.length) % options.length]!;
					onChange(next);
					const el = e.currentTarget.querySelector(`[data-value="${CSS.escape(next)}"]`);
					if (el instanceof HTMLElement) el.focus();
				}}
			>
				{options.map((option) => (
					<button
						key={option}
						type="button"
						role="radio"
						aria-checked={value === option}
						tabIndex={value === option ? 0 : -1}
						data-value={option}
						onClick={() => onChange(option)}
						className={`text-[11px] px-2.5 py-1 cursor-pointer border-none transition-colors ${
							value === option
								? "bg-accent/20 text-accent font-medium"
								: "bg-transparent text-content-muted hover:text-content-secondary"
						}`}
					>
						{option.charAt(0).toUpperCase() + option.slice(1)}
					</button>
				))}
			</div>
		</div>
	);
}
