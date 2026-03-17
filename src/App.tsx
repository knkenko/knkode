import { useEffect } from "react";
import Terminal from "./components/Terminal";
import { useTerminalStore } from "./store/terminal";

export default function App() {
	const createTerminal = useTerminalStore((s) => s.createTerminal);
	const destroyTerminal = useTerminalStore((s) => s.destroyTerminal);
	const subscribeToEvents = useTerminalStore((s) => s.subscribeToEvents);
	const refreshGrid = useTerminalStore((s) => s.refreshGrid);
	const connected = useTerminalStore((s) => s.connected);

	useEffect(() => {
		let unsubscribe: (() => void) | undefined;

		async function init() {
			await createTerminal();
			unsubscribe = await subscribeToEvents();
			await refreshGrid();
		}

		init();

		return () => {
			unsubscribe?.();
			destroyTerminal();
		};
	}, [createTerminal, destroyTerminal, subscribeToEvents, refreshGrid]);

	return (
		<div className="flex h-screen w-screen flex-col bg-[#1d1f21]">
			{connected ? (
				<Terminal />
			) : (
				<div className="flex h-full items-center justify-center text-neutral-500">
					Terminal disconnected
				</div>
			)}
		</div>
	);
}
