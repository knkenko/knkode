import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { PaneTheme } from '../shared/types'
import { useClickOutside } from '../hooks/useClickOutside'
import { VIEWPORT_MARGIN, getPortalRoot } from '../lib/ui-constants'
import { useStore } from '../store'

interface SnippetDropdownProps {
	paneId: string
	statusBarPosition: NonNullable<PaneTheme['statusBarPosition']>
	className?: string | undefined
	style?: React.CSSProperties | undefined
	children?: React.ReactNode
}

export function SnippetDropdown({
	paneId,
	statusBarPosition,
	className,
	style,
	children,
}: SnippetDropdownProps) {
	const [open, setOpen] = useState(false)
	const ref = useRef<HTMLDivElement>(null)
	const menuRef = useRef<HTMLDivElement>(null)
	const [menuPos, setMenuPos] = useState<{ right: number; top: number } | null>(null)
	const snippets = useStore((s) => s.snippets)
	const runSnippet = useStore((s) => s.runSnippet)
	const setFocusedPane = useStore((s) => s.setFocusedPane)

	useClickOutside(ref, () => setOpen(false), open, menuRef)

	// Position portal menu relative to trigger, clamped to viewport
	useLayoutEffect(() => {
		if (!open || !ref.current) return
		const position = () => {
			const trigger = ref.current
			if (!trigger) return
			const rect = trigger.getBoundingClientRect()
			const menuHeight = menuRef.current?.getBoundingClientRect().height ?? 0
			const right = Math.max(VIEWPORT_MARGIN, window.innerWidth - rect.right)
			const top =
				statusBarPosition === 'bottom'
					? Math.max(VIEWPORT_MARGIN, rect.top - menuHeight)
					: Math.min(rect.bottom, window.innerHeight - menuHeight - VIEWPORT_MARGIN)
			setMenuPos({ right, top })
		}
		position()
		window.addEventListener('resize', position)
		return () => window.removeEventListener('resize', position)
	}, [open, statusBarPosition])

	// Escape to close + arrow-key navigation for menu items
	useEffect(() => {
		if (!open) return
		const menu = menuRef.current
		if (!menu) return
		const firstItem = menu.querySelector<HTMLButtonElement>('[role="menuitem"]')
		firstItem?.focus()
		const handler = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				setOpen(false)
				return
			}
			if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
				e.preventDefault()
				const items = Array.from(menu.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
				const idx = items.indexOf(document.activeElement as HTMLButtonElement)
				let next: number
				if (e.key === 'ArrowDown') {
					next = idx < items.length - 1 ? idx + 1 : 0
				} else {
					next = idx > 0 ? idx - 1 : items.length - 1
				}
				items[next]?.focus()
			}
		}
		document.addEventListener('keydown', handler)
		return () => document.removeEventListener('keydown', handler)
	}, [open])

	if (snippets.length === 0) return null

	return (
		<div ref={ref}>
			<button
				type="button"
				onClick={() => setOpen((o) => !o)}
				title="Quick commands"
				aria-label="Quick commands"
				aria-expanded={open}
				aria-haspopup="true"
				className={className}
				style={style}
			>
				{children ?? '>_'}
			</button>
			{open &&
				createPortal(
					<div
						ref={menuRef}
						role="menu"
						className="ctx-menu"
						style={{
							position: 'fixed',
							right: menuPos?.right ?? 0,
							top: menuPos?.top ?? 0,
							left: 'auto',
							visibility: menuPos ? 'visible' : 'hidden',
						}}
					>
						{snippets.map((snippet) => (
							<button
								type="button"
								key={snippet.id}
								role="menuitem"
								className="ctx-item flex items-center gap-2"
								onClick={() => {
									runSnippet(snippet.id, paneId)
									setOpen(false)
									setFocusedPane(paneId)
								}}
							>
								<span className="text-accent">&gt;</span>
								<span className="truncate">{snippet.name}</span>
							</button>
						))}
					</div>,
					getPortalRoot(),
				)}
		</div>
	)
}
