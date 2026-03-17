import { useEffect, useRef } from "react";
import SplitPaneLayout from "./components/SplitPaneLayout";
import TabBar from "./components/TabBar";
import { useWorkspaceStore } from "./store/workspace";

export default function App() {
	const initedRef = useRef(false);

	useEffect(() => {
		if (initedRef.current) return;
		initedRef.current = true;

		const store = useWorkspaceStore.getState();
		let unsubscribe: (() => void) | undefined;

		async function init() {
			const workspaceId = store.createWorkspace();
			// Subscribe before initializing panes to avoid missing terminal output events
			unsubscribe = await store.subscribeToEvents();
			await store.initWorkspace(workspaceId);
		}

		init().catch(console.error);

		return () => {
			unsubscribe?.();
			useWorkspaceStore.getState().destroyAllTerminals();
		};
	}, []);

	return (
		<div className="flex h-screen w-screen flex-col bg-[#1d1f21]">
			<TabBar />
			<div className="min-h-0 flex-1">
				<ActiveWorkspace />
			</div>
		</div>
	);
}

function ActiveWorkspace() {
	const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId);
	const tree = useWorkspaceStore((s) =>
		activeWorkspaceId ? (s.workspaces[activeWorkspaceId]?.layout.tree ?? null) : null,
	);

	if (!activeWorkspaceId || !tree) {
		return (
			<div className="flex h-full items-center justify-center text-neutral-500">No workspace</div>
		);
	}

	return <SplitPaneLayout workspaceId={activeWorkspaceId} tree={tree} />;
}
