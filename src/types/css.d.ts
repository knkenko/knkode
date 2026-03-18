import 'react'

declare module 'react' {
	interface CSSProperties {
		/** Tauri/WebKit CSS property for frameless window drag regions */
		WebkitAppRegion?: 'drag' | 'no-drag'
		/** macOS traffic-light spacing — set at root in App.tsx */
		'--spacing-traffic'?: string
	}
}
