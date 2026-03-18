import 'react'

declare module 'react' {
	interface CSSProperties {
		/** WebKit CSS property for frameless window drag regions. Applied by window chrome components. */
		WebkitAppRegion?: 'drag' | 'no-drag'
		/** macOS traffic-light spacing — reserved for frameless window layout. */
		'--spacing-traffic'?: string
	}
}
