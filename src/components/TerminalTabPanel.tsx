import {
	CURSOR_STYLES,
	type CursorStyle,
	EFFECT_LEVELS,
	type EffectLevel,
	MAX_FONT_SIZE,
	MAX_LINE_HEIGHT,
	MAX_SCROLLBACK,
	MIN_FONT_SIZE,
	MIN_LINE_HEIGHT,
	MIN_SCROLLBACK,
	isCursorStyle,
} from '../shared/types'
import { THEME_PRESETS, type ThemePreset } from '../data/theme-presets'
import { hexToRgba } from '../utils/colors'
import { FontPicker } from './FontPicker'
import { SegmentedButton } from './SegmentedButton'
import { SettingsSection } from './SettingsSection'

export type EffectCategory = 'dim' | 'opacity' | 'gradient' | 'glow' | 'scanline' | 'noise'

const EFFECT_ENTRIES: readonly { category: EffectCategory; label: string }[] = [
	{ category: 'dim', label: 'Dim unfocused' },
	{ category: 'opacity', label: 'Opacity' },
	{ category: 'gradient', label: 'Gradient' },
	{ category: 'glow', label: 'Glow' },
	{ category: 'scanline', label: 'Scanlines' },
	{ category: 'noise', label: 'Noise' },
]

interface TerminalTabPanelProps {
	selectedPreset: string
	onPresetChange: (name: string) => void
	fontFamily: string
	onFontFamilyChange: (family: string) => void
	fontSize: number
	onFontSizeChange: (value: number) => void
	lineHeight: number
	onLineHeightChange: (value: number) => void
	cursorStyle: CursorStyle
	onCursorStyleChange: (style: CursorStyle) => void
	scrollback: number
	onScrollbackChange: (value: number) => void
	effects: Record<EffectCategory, EffectLevel>
	onEffectChange: (category: EffectCategory, level: EffectLevel) => void
	hidden: boolean
}

export function TerminalTabPanel({
	selectedPreset,
	onPresetChange,
	fontFamily,
	onFontFamilyChange,
	fontSize,
	onFontSizeChange,
	lineHeight,
	onLineHeightChange,
	cursorStyle,
	onCursorStyleChange,
	scrollback,
	onScrollbackChange,
	effects,
	onEffectChange,
	hidden,
}: TerminalTabPanelProps) {
	return (
		<div
			id="settings-tabpanel-Terminal"
			role="tabpanel"
			aria-labelledby="settings-tab-Terminal"
			hidden={hidden}
			className="flex-1 min-h-0 px-6 py-6 overflow-y-auto overflow-x-hidden flex flex-col gap-8"
		>
			{/* Theme */}
			<SettingsSection label="Theme" gap={16}>
				<div
					className="grid grid-cols-4 gap-1.5"
					role="radiogroup"
					aria-label="Theme presets"
					onKeyDown={(e) => {
						if (
							e.key !== 'ArrowRight' &&
							e.key !== 'ArrowLeft' &&
							e.key !== 'ArrowDown' &&
							e.key !== 'ArrowUp'
						)
							return
						e.preventDefault()
						const idx = THEME_PRESETS.findIndex((p) => p.name === selectedPreset)
						const cols = 4
						let next = idx
						if (e.key === 'ArrowRight') next = (idx + 1) % THEME_PRESETS.length
						else if (e.key === 'ArrowLeft')
							next = (idx - 1 + THEME_PRESETS.length) % THEME_PRESETS.length
						else if (e.key === 'ArrowDown') next = Math.min(idx + cols, THEME_PRESETS.length - 1)
						else if (e.key === 'ArrowUp') next = Math.max(idx - cols, 0)
						onPresetChange(THEME_PRESETS[next]!.name)
						document.getElementById(`theme-preset-${next}`)?.focus()
					}}
				>
					{(THEME_PRESETS as readonly ThemePreset[]).map((preset, index) => {
						const isActive = selectedPreset === preset.name
						return (
							<button
								type="button"
								id={`theme-preset-${index}`}
								key={preset.name}
								onClick={() => onPresetChange(preset.name)}
								role="radio"
								aria-checked={isActive}
								tabIndex={isActive ? 0 : -1}
								className={`py-1.5 px-1 rounded-md cursor-pointer border text-center focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none ${
									isActive
										? 'border-accent ring-1 ring-accent'
										: 'border-transparent hover:border-content-muted'
								}`}
								title={preset.name}
								aria-label={preset.name}
								style={{
									background: preset.background,
									color: preset.foreground,
									boxShadow:
										isActive && preset.glow ? `0 0 8px ${hexToRgba(preset.glow, 0.25)}` : undefined,
								}}
							>
								<span className="text-[11px] font-medium leading-tight block truncate">
									{preset.name}
								</span>
							</button>
						)
					})}
				</div>
			</SettingsSection>

			{/* Font */}
			<SettingsSection label="Font" gap={12}>
				<FontPicker value={fontFamily} onChange={onFontFamilyChange} />
			</SettingsSection>

			{/* Display */}
			<SettingsSection label="Display" gap={8}>
				<div className="flex items-center gap-3">
					<span className="text-xs text-content-secondary w-20 shrink-0">Size</span>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() => onFontSizeChange(Math.max(MIN_FONT_SIZE, fontSize - 1))}
							aria-label="Decrease font size"
							className="stepper-btn"
						>
							-
						</button>
						<span className="text-xs text-content tabular-nums w-5 text-center">{fontSize}</span>
						<button
							type="button"
							onClick={() => onFontSizeChange(Math.min(MAX_FONT_SIZE, fontSize + 1))}
							aria-label="Increase font size"
							className="stepper-btn"
						>
							+
						</button>
					</div>
				</div>

				<div className="flex items-center gap-3">
					<span className="text-xs text-content-secondary w-20 shrink-0">Line height</span>
					<div className="flex items-center gap-2">
						<button
							type="button"
							onClick={() =>
								onLineHeightChange(Math.max(MIN_LINE_HEIGHT, +(lineHeight - 0.1).toFixed(1)))
							}
							aria-label="Decrease line height"
							className="stepper-btn"
						>
							-
						</button>
						<span className="text-xs text-content tabular-nums w-5 text-center">
							{lineHeight.toFixed(1)}
						</span>
						<button
							type="button"
							onClick={() =>
								onLineHeightChange(Math.min(MAX_LINE_HEIGHT, +(lineHeight + 0.1).toFixed(1)))
							}
							aria-label="Increase line height"
							className="stepper-btn"
						>
							+
						</button>
					</div>
				</div>

				<label className="flex items-center gap-3">
					<span className="text-xs text-content-secondary w-20 shrink-0">Cursor</span>
					<select
						value={cursorStyle}
						onChange={(e) => {
							if (isCursorStyle(e.target.value)) onCursorStyleChange(e.target.value)
						}}
						className="settings-input w-32"
					>
						{CURSOR_STYLES.map((s) => (
							<option key={s} value={s}>
								{s[0]!.toUpperCase() + s.slice(1)}
							</option>
						))}
					</select>
				</label>

				<label className="flex items-center gap-3">
					<span className="text-xs text-content-secondary w-20 shrink-0">Scrollback</span>
					<input
						type="number"
						min={MIN_SCROLLBACK}
						max={MAX_SCROLLBACK}
						step={500}
						value={scrollback}
						onChange={(e) => {
							const n = Number(e.target.value)
							if (!Number.isFinite(n)) return
							onScrollbackChange(Math.max(MIN_SCROLLBACK, Math.min(MAX_SCROLLBACK, n)))
						}}
						className="settings-input w-24"
					/>
					<span className="text-[11px] text-content-muted">lines</span>
				</label>

				{EFFECT_ENTRIES.map(({ category, label }) => (
					<SegmentedButton
						key={category}
						options={EFFECT_LEVELS}
						value={effects[category]}
						onChange={(level) => onEffectChange(category, level)}
						label={label}
					/>
				))}
			</SettingsSection>
		</div>
	)
}
