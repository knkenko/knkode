import { useCallback, useRef, useState } from 'react'
import {
	type DropZone,
	PANE_DRAG_MIME,
	type PaneDragPayload,
	getDropZone,
	parsePaneDragPayload,
} from '../lib/pane-drag-utils'
import { useStore } from '../store'

const MOUSE_BUTTON_RIGHT = 2

interface UsePaneDragDropOptions {
	paneId: string
	workspaceId: string
	onFocus: (paneId: string) => void
}

export function usePaneDragDrop({ paneId, workspaceId, onFocus }: UsePaneDragDropOptions) {
	const [isDragging, setIsDragging] = useState(false)
	const [dropZone, setDropZone] = useState<DropZone | null>(null)
	// Counter to distinguish real drag-leave from child-element bubbling
	const dragCounterRef = useRef(0)
	const dropZoneRef = useRef<DropZone | null>(null)
	const outerRef = useRef<HTMLDivElement>(null)
	const lastMouseButtonRef = useRef(0)

	const swapPanes = useStore((s) => s.swapPanes)
	const movePaneToPosition = useStore((s) => s.movePaneToPosition)

	const handleHeaderMouseDown = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			lastMouseButtonRef.current = e.button
			onFocus(paneId)
		},
		[paneId, onFocus],
	)

	const handleDragStart = useCallback(
		(e: React.DragEvent) => {
			// Suppress drag on right-click — context menu handles that gesture
			if (lastMouseButtonRef.current === MOUSE_BUTTON_RIGHT) {
				e.preventDefault()
				return
			}
			e.dataTransfer.effectAllowed = 'move'
			e.dataTransfer.setData(
				PANE_DRAG_MIME,
				JSON.stringify({ paneId, workspaceId } satisfies PaneDragPayload),
			)
			setIsDragging(true)
		},
		[paneId, workspaceId],
	)

	const handleDragEnd = useCallback(() => {
		setIsDragging(false)
		dragCounterRef.current = 0
		lastMouseButtonRef.current = 0
	}, [])

	const handlePaneDragOver = useCallback((e: React.DragEvent) => {
		if (!e.dataTransfer.types.includes(PANE_DRAG_MIME)) return
		e.preventDefault()
		e.dataTransfer.dropEffect = 'move'
		const el = outerRef.current
		if (el) {
			const zone = getDropZone(e, el)
			if (zone !== dropZoneRef.current) {
				dropZoneRef.current = zone
				setDropZone(zone)
			}
		}
	}, [])

	const handlePaneDragEnter = useCallback((e: React.DragEvent) => {
		if (e.dataTransfer.types.includes(PANE_DRAG_MIME)) {
			dragCounterRef.current++
		}
	}, [])

	const handlePaneDragLeave = useCallback((e: React.DragEvent) => {
		if (!e.dataTransfer.types.includes(PANE_DRAG_MIME)) return
		dragCounterRef.current--
		if (dragCounterRef.current === 0) {
			dropZoneRef.current = null
			setDropZone(null)
		}
	}, [])

	const handlePaneDrop = useCallback(
		(e: React.DragEvent) => {
			e.preventDefault()
			dragCounterRef.current = 0
			dropZoneRef.current = null
			setDropZone(null)
			const el = outerRef.current
			const zone = el ? getDropZone(e, el) : null
			const raw = e.dataTransfer.getData(PANE_DRAG_MIME)
			if (!raw) return
			const data = parsePaneDragPayload(raw)
			if (!data) return
			if (data.workspaceId !== workspaceId || data.paneId === paneId) return
			if (zone === 'center' || !zone) {
				swapPanes(workspaceId, data.paneId, paneId)
			} else {
				movePaneToPosition(workspaceId, data.paneId, paneId, zone)
			}
		},
		[paneId, workspaceId, swapPanes, movePaneToPosition],
	)

	return {
		isDragging,
		dropZone,
		outerRef,
		handleHeaderMouseDown,
		handleDragStart,
		handleDragEnd,
		handlePaneDragOver,
		handlePaneDragEnter,
		handlePaneDragLeave,
		handlePaneDrop,
	}
}
