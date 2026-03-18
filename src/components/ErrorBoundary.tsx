import { Component, type ErrorInfo, type ReactNode } from 'react'

interface ErrorBoundaryProps {
	children: ReactNode
}

interface ErrorBoundaryState {
	error: Error | null
}

/** Catches render errors within a single workspace's pane area so that a crash
 *  in one workspace does not take down the entire application. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	state: ErrorBoundaryState = { error: null }

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { error }
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error('[ErrorBoundary]', error, info.componentStack)
	}

	handleRetry = () => {
		this.setState({ error: null })
	}

	handleReload = () => {
		window.location.reload()
	}

	render() {
		if (this.state.error) {
			const message = this.state.error.message ?? 'An unexpected error occurred.'
			return (
				<div role="alert" className="flex flex-col items-center justify-center h-full gap-4 p-8">
					<p className="text-danger text-sm font-semibold">Something went wrong</p>
					<p className="text-content-muted text-xs max-w-md text-center break-words">
						{message.length > 500 ? `${message.slice(0, 500)}...` : message}
					</p>
					<div className="flex gap-2">
						<button
							type="button"
							onClick={this.handleRetry}
							// biome-ignore lint/a11y/noAutofocus: intentional — focus recovery after error boundary triggers
							autoFocus
							className="bg-sunken border border-edge text-content text-xs py-1.5 px-4 rounded-sm cursor-pointer hover:bg-overlay focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none"
						>
							Try Again
						</button>
						<button
							type="button"
							onClick={this.handleReload}
							className="bg-sunken border border-edge text-content-muted text-xs py-1.5 px-4 rounded-sm cursor-pointer hover:bg-overlay focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none"
						>
							Reload
						</button>
					</div>
				</div>
			)
		}
		return this.props.children
	}
}
