import { useCallback, useEffect, useRef, useState } from 'react'

export function useInlineEdit(currentValue: string, onSubmit: (value: string) => void) {
	const [isEditing, setIsEditing] = useState(false)
	const [editValue, setEditValue] = useState(currentValue)
	const inputRef = useRef<HTMLInputElement>(null)

	const handleSubmit = useCallback(() => {
		const trimmed = editValue.trim()
		if (trimmed && trimmed !== currentValue) {
			onSubmit(trimmed)
		}
		setIsEditing(false)
	}, [editValue, currentValue, onSubmit])

	const startEditing = useCallback(() => {
		setEditValue(currentValue)
		setIsEditing(true)
	}, [currentValue])

	useEffect(() => {
		if (isEditing && inputRef.current) {
			inputRef.current.focus()
			inputRef.current.select()
		}
	}, [isEditing])

	const inputProps = {
		ref: inputRef,
		value: editValue,
		onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEditValue(e.target.value),
		onBlur: handleSubmit,
		onKeyDown: (e: React.KeyboardEvent) => {
			if (e.key === 'Enter') handleSubmit()
			if (e.key === 'Escape') setIsEditing(false)
		},
	}

	return { isEditing, editValue, startEditing, inputProps }
}
