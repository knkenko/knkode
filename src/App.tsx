import { useEffect, useRef } from "react";
import Terminal from "./components/Terminal";
import { useTerminalStore } from "./store/terminal";

export default function App() {
	const connected = useTerminalStore((s) => s.connected);
	const error = useTerminalStore((s) => s.error);
	const initedRef = useRef(false);

	useEffect(() => {
		if (initedRef.current) return;
		initedRef.current = true;

		const { createTerminal, subscribeToEvents, refreshGrid } = useTerminalStore.getState();
		let unsubscribe: (() => void) | undefined;

		// Subscribe before first refresh to avoid missing events during startup
		async function init() {
			await createTerminal();
			unsubscribe = await subscribeToEvents();
			await refreshGrid();
		}

		init().catch(console.error);

		return () => {
			unsubscribe?.();
			useTerminalStore.getState().destroyTerminal().catch(console.error);
		};
	}, []);

	return (
		<div className="flex h-screen w-screen flex-col bg-[#1d1f21]">
			{connected ? (
				<Terminal />
			) : (
				<div className="flex h-full items-center justify-center text-neutral-500">
					{error ?? "Terminal disconnected"}
				</div>
			)}
		</div>
	);
}
