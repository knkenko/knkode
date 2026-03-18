import { useCallback, useRef, useState } from 'react'
import type { Workspace } from '../shared/types'
import { useClickOutside } from '../hooks/useClickOutside'
import { useInlineEdit } from '../hooks/useInlineEdit'

const INACTIVE_TAB_STYLE: React.CSSProperties = { borderLeft: '3px solid transparent' }

interface TabProps {
	workspace: Workspace
	isActive: boolean
	index: number
	/** Number of panes in this workspace. Always >= 1. Badge shown when > 1. */
	paneCount: number
	onActivate: (id: string) => void
	onClose: (id: string) => void
	onRename: (id: string, name: string) => void
	onChangeColor: (id: string, color: string) => void
	onDuplicate: (id: string) => void
	onDragStart: (index: number) => void
	onDragOver: (e: React.DragEvent, index: number) => void
	onDrop: (index: number) => void
	onDragEnd: () => void
	isDragOver: boolean
	isDragging: boolean
	colors: readonly string[]
}

export function Tab({
	workspace,
	isActive,
	index,
	paneCount,
	onActivate,
	onClose,
	onRename,
	onChangeColor,
	onDuplicate,
	onDragStart,
	onDragOver,
	onDrop,
	onDragEnd,
	isDragOver,
	isDragging,
	colors,
}: TabProps) {
	const [showContext, setShowContext] = useState(false)
	const [showColorPicker, setShowColorPicker] = useState(false)
	const contextRef = useRef<HTMLDivElement>(null)

	const { isEditing, inputProps, startEditing } = useInlineEdit(workspace.name, (name) =>
		onRename(workspace.id, name),
	)

	const handleContextMenu = useCallback((e: React.MouseEvent) => {
		e.preventDefault()
		setShowContext(true)
	}, [])

	const closeContext = useCallback(() => {
		setShowContext(false)
		setShowColorPicker(false)
	}, [])

	useClickOutside(contextRef, closeContext, showContext)

	const tabStyle: React.CSSProperties = isActive
		? {
				borderLeft: `3px solid ${workspace.color}`,
				background: `color-mix(in srgb, ${workspace.color} 8%, var(--color-overlay-active))`,
			}
		: INACTIVE_TAB_STYLE

	const bgClass = isActive ? '' : 'bg-overlay hover:bg-overlay-hover'
	const dragOverClass = isDragOver ? 'shadow-[inset_2px_0_0_var(--color-accent)]' : ''
	const draggingClass = isDragging ? 'opacity-40' : ''
	const closeVisibility = isActive
		? 'opacity-100'
		: 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100'

	return (
		<div
			role="tab"
			tabIndex={isActive ? 0 : -1}
			aria-selected={isActive}
			aria-roledescription="draggable tab"
			data-workspace-id={workspace.id}
			draggable={!isEditing}
			onClick={() => onActivate(workspace.id)}
			onKeyDown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault()
					onActivate(workspace.id)
				}
				if (
					e.key === 'ArrowRight' ||
					e.key === 'ArrowLeft' ||
					e.key === 'Home' ||
					e.key === 'End'
				) {
					e.preventDefault()
					const tabs = e.currentTarget
						.closest('[role="tablist"]')
						?.querySelectorAll<HTMLElement>('[role="tab"]')
					if (!tabs) return
					const count = tabs.length
					let target = index
					if (e.key === 'ArrowRight') target = (index + 1) % count
					else if (e.key === 'ArrowLeft') target = (index - 1 + count) % count
					else if (e.key === 'Home') target = 0
					else if (e.key === 'End') target = count - 1
					tabs[target]?.focus()
					// Dispatch activation directly instead of synthetic .click()
					const wsId = tabs[target]?.dataset.workspaceId
					if (wsId) onActivate(wsId)
				}
			}}
			onContextMenu={handleContextMenu}
			onDragStart={(e) => {
				e.dataTransfer.effectAllowed = 'move'
				e.dataTransfer.setData('text/plain', workspace.id)
				onDragStart(index)
			}}
			onDragOver={(e) => onDragOver(e, index)}
			onDrop={() => onDrop(index)}
			onDragEnd={onDragEnd}
			className={`group flex items-center gap-2 px-3 h-tab cursor-pointer rounded-t-md select-none relative transition-colors duration-300 ease-[var(--ease-mechanical)] flex-[0_1_200px] min-w-[100px] max-w-[240px] ${bgClass} ${dragOverClass} ${draggingClass}`}
			style={tabStyle}
		>
			{/* Color indicator dot */}
			<span
				aria-hidden="true"
				className="w-2.5 h-2.5 rounded-full shrink-0"
				style={{ background: workspace.color }}
			/>

			{/* Tab name */}
			{isEditing ? (
				<input
					{...inputProps}
					onClick={(e) => e.stopPropagation()}
					className="bg-elevated border border-accent rounded-sm text-content text-xs py-px px-1 outline-none flex-1 min-w-0"
				/>
			) : (
				<span
					className={`text-xs whitespace-nowrap overflow-hidden text-ellipsis flex-1 min-w-0 ${
						isActive ? 'text-content font-medium' : 'text-content-secondary'
					}`}
				>
					{workspace.name}
				</span>
			)}

			{/* Pane count badge */}
			{paneCount > 1 && (
				<span
					aria-label={`${paneCount} panes`}
					className="text-[9px] leading-none font-medium px-1.5 py-0.5 rounded-full shrink-0"
					style={{
						background: `color-mix(in srgb, ${workspace.color} 20%, transparent)`,
						color: workspace.color,
					}}
				>
					{paneCount}
				</span>
			)}

			{/* Close button — always visible on active, visible on hover for inactive */}
			<button
				type="button"
				onClick={(e) => {
					e.stopPropagation()
					onClose(workspace.id)
				}}
				aria-label={`Close ${workspace.name}`}
				className={`bg-transparent border-none text-content-muted cursor-pointer p-0.5 rounded-sm shrink-0 hover:text-content hover:bg-overlay focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none transition-all duration-200 ${closeVisibility}`}
			>
				<svg
					width="12"
					height="12"
					viewBox="0 0 12 12"
					fill="none"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					aria-hidden="true"
				>
					<path d="M3 3l6 6M9 3l-6 6" />
				</svg>
			</button>

			{/* Context menu */}
			{showContext && (
				<div
					ref={contextRef}
					className="ctx-menu top-tab left-0"
					onKeyDown={(e) => {
						if (e.key === 'Escape') closeContext()
					}}
				>
					<button
						type="button"
						className="ctx-item"
						onClick={(e) => {
							e.stopPropagation()
							startEditing()
							closeContext()
						}}
					>
						Rename
					</button>
					<button
						type="button"
						className="ctx-item"
						onClick={(e) => {
							e.stopPropagation()
							setShowColorPicker((v) => !v)
						}}
					>
						Change Color
					</button>
					{showColorPicker && (
						<div className="flex flex-wrap gap-1 px-3 py-1 pb-2">
							{colors.map((c) => (
								<button
									type="button"
									key={c}
									aria-label={`Color ${c}`}
									className={`size-4.5 rounded-full border-none cursor-pointer p-0 ${
										c === workspace.color ? 'outline-2 outline-content outline-offset-1' : ''
									}`}
									style={{ background: c }}
									onClick={(e) => {
										e.stopPropagation()
										onChangeColor(workspace.id, c)
										closeContext()
									}}
								/>
							))}
						</div>
					)}
					<button
						type="button"
						className="ctx-item"
						onClick={(e) => {
							e.stopPropagation()
							onDuplicate(workspace.id)
							closeContext()
						}}
					>
						Duplicate
					</button>
					<div className="ctx-separator" />
					<button
						type="button"
						className="ctx-item text-danger"
						onClick={(e) => {
							e.stopPropagation()
							onClose(workspace.id)
							closeContext()
						}}
					>
						Close Tab
					</button>
				</div>
			)}
		</div>
	)
}
