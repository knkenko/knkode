import type { DropPosition } from '../shared/types'

export type DropZone = DropPosition | 'center'

export interface PaneDragPayload {
	paneId: string
	workspaceId: string
}

export const PANE_DRAG_MIME = 'application/x-knkode-pane'

/** Parse and validate a drag payload from untrusted JSON. Returns null on invalid input. */
export function parsePaneDragPayload(raw: string): PaneDragPayload | null {
	let parsed: unknown
	try {
		parsed = JSON.parse(raw)
	} catch {
		console.warn('[pane] Failed to parse drag payload:', raw)
		return null
	}
	if (
		typeof parsed !== 'object' ||
		parsed === null ||
		typeof (parsed as Record<string, unknown>).paneId !== 'string' ||
		typeof (parsed as Record<string, unknown>).workspaceId !== 'string'
	) {
		return null
	}
	return parsed as PaneDragPayload
}

// Inline styles (not Tailwind) — dynamic drag overlay highlights require computed CSS properties.
export const ZONE_STYLES: Record<DropZone, React.CSSProperties> = {
	center: { inset: 0, backgroundColor: 'var(--color-accent)', opacity: 0.12 },
	left: { inset: 0, right: '50%', backgroundColor: 'var(--color-accent)', opacity: 0.18 },
	right: { inset: 0, left: '50%', backgroundColor: 'var(--color-accent)', opacity: 0.18 },
	top: { inset: 0, bottom: '50%', backgroundColor: 'var(--color-accent)', opacity: 0.18 },
	bottom: { inset: 0, top: '50%', backgroundColor: 'var(--color-accent)', opacity: 0.18 },
}

/** Determine which drop zone the cursor is in based on position within the element.
 *  Center is inner 50% on each axis. Edges are outer 25%; left/right checked
 *  first so they claim corners over top/bottom. */
export function getDropZone(e: React.DragEvent, el: HTMLElement): DropZone {
	const rect = el.getBoundingClientRect()
	const x = (e.clientX - rect.left) / rect.width
	const y = (e.clientY - rect.top) / rect.height
	if (x < 0.25) return 'left'
	if (x > 0.75) return 'right'
	if (y < 0.25) return 'top'
	if (y > 0.75) return 'bottom'
	return 'center'
}
