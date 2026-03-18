import { useCallback, useEffect, useState } from "react";
import { isMac } from "../utils/platform";
import { isValidCwd } from "../utils/validation";

interface CwdInputProps {
	value: string;
	homeDir: string;
	onChange: (resolved: string) => void;
	"aria-label": string;
}

export function CwdInput({ value, homeDir, onChange, "aria-label": ariaLabel }: CwdInputProps) {
	const [local, setLocal] = useState(value);
	const [invalid, setInvalid] = useState(false);

	// Sync local state when store value changes externally
	useEffect(() => {
		setLocal(value);
		setInvalid(false);
	}, [value]);

	const commit = useCallback(() => {
		let trimmed = local.trim();
		// Resolve tilde to absolute path before validation
		if (trimmed === "~") trimmed = homeDir;
		else if (trimmed.startsWith("~/")) trimmed = `${homeDir}${trimmed.slice(1)}`;

		if (isValidCwd(trimmed)) {
			if (trimmed !== value) onChange(trimmed);
			setLocal(trimmed);
			setInvalid(false);
		} else {
			setInvalid(true);
		}
	}, [local, homeDir, value, onChange]);

	return (
		<div className="flex flex-col flex-[2] min-w-0 gap-0.5">
			<input
				value={local}
				onChange={(e) => {
					setLocal(e.target.value);
					setInvalid(false);
				}}
				onBlur={commit}
				onKeyDown={(e) => {
					if (e.key === "Enter") {
						e.currentTarget.blur();
					}
					if (e.key === "Escape") {
						e.stopPropagation();
						setLocal(value);
						setInvalid(false);
					}
				}}
				className={`settings-input w-full ${invalid ? "!border-danger" : ""}`}
				placeholder="Working directory"
				aria-label={ariaLabel}
				aria-invalid={invalid}
			/>
			{invalid && (
				<span className="text-danger text-[10px]">
					{isMac ? "Path must start with / or ~" : "Path must be absolute (e.g. C:\\)"}
				</span>
			)}
		</div>
	);
}
