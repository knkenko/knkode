import { useCallback, useState } from "react";
import { useDragReorder } from "../hooks/useDragReorder";
import { useStore } from "../store";
import { SettingsSection } from "./SettingsSection";

export function SnippetsSection() {
	const snippets = useStore((s) => s.snippets);
	const addSnippet = useStore((s) => s.addSnippet);
	const updateSnippet = useStore((s) => s.updateSnippet);
	const removeSnippet = useStore((s) => s.removeSnippet);
	const reorderSnippets = useStore((s) => s.reorderSnippets);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editName, setEditName] = useState("");
	const [editCommand, setEditCommand] = useState("");
	const [isAdding, setIsAdding] = useState(false);
	const [newName, setNewName] = useState("");
	const [newCommand, setNewCommand] = useState("");
	const [liveMessage, setLiveMessage] = useState("");

	const { dragFromIndex, dragOverIndex, resetDragState, handleDragStart, handleDragOver, handleDrop } =
		useDragReorder({
			onReorder: useCallback(
				(from: number, to: number) => {
					reorderSnippets(from, to);
					const name = snippets[from]?.name ?? "Snippet";
					setLiveMessage(`Moved ${name} to position ${to + 1}`);
				},
				[reorderSnippets, snippets],
			),
		});

	const startEdit = useCallback(
		(id: string) => {
			const s = snippets.find((sn) => sn.id === id);
			if (!s) return;
			setEditingId(id);
			setEditName(s.name);
			setEditCommand(s.command);
		},
		[snippets],
	);

	const commitEdit = useCallback(() => {
		if (!editingId) return;
		if (editName.trim() && editCommand.trim()) {
			updateSnippet(editingId, { name: editName.trim(), command: editCommand.trim() });
			setEditingId(null);
		}
	}, [editingId, editName, editCommand, updateSnippet]);

	const commitAdd = useCallback(() => {
		if (newName.trim() && newCommand.trim()) {
			addSnippet(newName.trim(), newCommand.trim());
			setNewName("");
			setNewCommand("");
			setIsAdding(false);
		}
	}, [newName, newCommand, addSnippet]);

	const handleKeyboardReorder = useCallback(
		(e: React.KeyboardEvent, index: number) => {
			if (!e.altKey) return;
			if (e.key === "ArrowUp" && index > 0) {
				e.preventDefault();
				reorderSnippets(index, index - 1);
				const name = snippets[index]?.name ?? "Snippet";
				setLiveMessage(`Moved ${name} to position ${index}`);
			} else if (e.key === "ArrowDown" && index < snippets.length - 1) {
				e.preventDefault();
				reorderSnippets(index, index + 1);
				const name = snippets[index]?.name ?? "Snippet";
				setLiveMessage(`Moved ${name} to position ${index + 2}`);
			}
		},
		[reorderSnippets, snippets],
	);

	return (
		<SettingsSection label="Commands" gap={8}>
			<span className="text-[10px] text-content-muted -mt-1 mb-1">
				Global snippets — available from the &gt;_ icon on any pane
			</span>
			{snippets.length === 0 && !isAdding && (
				<span className="text-[11px] text-content-muted italic">No snippets yet</span>
			)}
			{snippets.map((snippet, index) => {
				const isDropTarget =
					dragOverIndex === index && dragFromIndex !== null && dragFromIndex !== index;
				const isDragSource = dragFromIndex === index;
				const isEditing = editingId === snippet.id;
				const showHandle = !isEditing && snippets.length > 1;

				return (
					<div
						key={snippet.id}
						draggable={!isEditing}
						onDragStart={(e) => handleDragStart(e, index)}
						onDragOver={(e) => handleDragOver(e, index)}
						onDrop={() => handleDrop(index)}
						onDragEnd={resetDragState}
						aria-roledescription="reorderable snippet"
						className={`flex items-center gap-1.5 rounded-sm transition-colors ${isDropTarget ? "bg-accent/10" : ""} ${isDragSource ? "opacity-40" : ""}`}
					>
						{isEditing ? (
							<>
								<input
									value={editName}
									onChange={(e) => setEditName(e.target.value)}
									className="settings-input flex-1 min-w-0"
									placeholder="Name"
									aria-label="Snippet name"
									// biome-ignore lint/a11y/noAutofocus: intentional focus for inline edit
									autoFocus
									onKeyDown={(e) => {
										if (e.key === "Enter") commitEdit();
										if (e.key === "Escape") setEditingId(null);
									}}
								/>
								<input
									value={editCommand}
									onChange={(e) => setEditCommand(e.target.value)}
									className="settings-input flex-[2] min-w-0"
									placeholder="Command"
									aria-label="Snippet command"
									onKeyDown={(e) => {
										if (e.key === "Enter") commitEdit();
										if (e.key === "Escape") setEditingId(null);
									}}
								/>
								<button
									type="button"
									onClick={commitEdit}
									className="btn-ghost text-accent hover:brightness-125"
								>
									Save
								</button>
							</>
						) : (
							<>
								{showHandle ? (
									<button
										type="button"
										className="bg-transparent border-none text-content-muted cursor-grab active:cursor-grabbing select-none shrink-0 text-xs p-0 focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none rounded-sm"
										aria-label={`Reorder ${snippet.name}, item ${index + 1} of ${snippets.length}. Use Alt+Arrow keys`}
										onKeyDown={(e) => handleKeyboardReorder(e, index)}
									>
										&#x2817;
									</button>
								) : (
									<span className="w-3 shrink-0" />
								)}
								<span className="text-xs text-content font-medium w-24 truncate shrink-0">
									{snippet.name}
								</span>
								<span className="text-[11px] text-content-muted flex-1 truncate font-mono">
									{snippet.command}
								</span>
								<button
									type="button"
									onClick={() => startEdit(snippet.id)}
									className="btn-ghost text-content-muted hover:text-content"
									aria-label={`Edit ${snippet.name}`}
								>
									Edit
								</button>
								<button
									type="button"
									onClick={() => {
										if (window.confirm(`Delete snippet "${snippet.name}"?`))
											removeSnippet(snippet.id);
									}}
									className="btn-ghost text-danger hover:brightness-125"
									aria-label={`Delete ${snippet.name}`}
								>
									Del
								</button>
							</>
						)}
					</div>
				);
			})}
			<span className="sr-only" aria-live="polite">
				{liveMessage}
			</span>
			{isAdding ? (
				<div className="flex items-center gap-1.5">
					<input
						value={newName}
						onChange={(e) => setNewName(e.target.value)}
						className="settings-input flex-1 min-w-0"
						placeholder="Name (e.g. Claude)"
						aria-label="New snippet name"
						// biome-ignore lint/a11y/noAutofocus: intentional focus for new snippet
						autoFocus
						onKeyDown={(e) => {
							if (e.key === "Enter") commitAdd();
							if (e.key === "Escape") setIsAdding(false);
						}}
					/>
					<input
						value={newCommand}
						onChange={(e) => setNewCommand(e.target.value)}
						className="settings-input flex-[2] min-w-0"
						placeholder="Command (e.g. claude --dangerously-skip-permissions)"
						aria-label="New snippet command"
						onKeyDown={(e) => {
							if (e.key === "Enter") commitAdd();
							if (e.key === "Escape") setIsAdding(false);
						}}
					/>
					<button
						type="button"
						onClick={commitAdd}
						className="btn-ghost text-accent hover:brightness-125"
					>
						Add
					</button>
				</div>
			) : (
				<button
					type="button"
					onClick={() => setIsAdding(true)}
					className="bg-transparent border border-edge text-content-secondary cursor-pointer text-xs py-1 px-3 rounded-sm hover:text-content hover:border-content-muted focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none self-start"
				>
					+ Add Snippet
				</button>
			)}
		</SettingsSection>
	);
}
