import { useCallback, useRef, useState } from "react";

interface UseDragReorderOptions {
	onReorder: (fromIndex: number, toIndex: number) => void;
}

export function useDragReorder({ onReorder }: UseDragReorderOptions) {
	const [dragFromIndex, setDragFromIndex] = useState<number | null>(null);
	const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
	const dragFromRef = useRef<number | null>(null);

	const resetDragState = useCallback(() => {
		setDragFromIndex(null);
		setDragOverIndex(null);
		dragFromRef.current = null;
	}, []);

	const handleDragStart = useCallback(
		(e: React.DragEvent, index: number) => {
			e.dataTransfer.effectAllowed = "move";
			e.dataTransfer.setData("text/plain", "");
			setDragFromIndex(index);
			dragFromRef.current = index;
		},
		[],
	);

	const handleDragOver = useCallback((e: React.DragEvent, index: number) => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
		setDragOverIndex((prev) => (prev === index ? prev : index));
	}, []);

	const handleDrop = useCallback(
		(index: number) => {
			const from = dragFromRef.current;
			if (from !== null && from !== index) {
				onReorder(from, index);
			}
			resetDragState();
		},
		[onReorder, resetDragState],
	);

	return {
		dragFromIndex,
		dragOverIndex,
		resetDragState,
		handleDragStart,
		handleDragOver,
		handleDrop,
	};
}
