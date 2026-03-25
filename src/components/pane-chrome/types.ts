import type { RefObject } from "react";
import type { AgentStatus, PrInfo } from "../../shared/types";

/** Runtime theme colors available to every variant. Constructed by buildVariantTheme(). */
export interface VariantTheme {
	background: string;
	foreground: string;
	accent: string;
	glow?: string | undefined;
	statusBarPosition: "top" | "bottom";
}

/** Header-related props shared by all variant Frames. Extended by FrameProps. */
export interface StatusBarProps {
	label: string;
	cwd: string;
	branch: string | null;
	/** PR associated with the current branch, or null if no open PR. */
	pr: PrInfo | null;
	/** Open a URL in the user's default browser. */
	onOpenExternal: (url: string) => void;
	isFocused: boolean;
	canClose: boolean;
	theme: VariantTheme;
	onSplitVertical: () => void;
	onSplitHorizontal: () => void;
	onClose: () => void;
	onDoubleClickLabel: () => void;
	isEditing: boolean;
	editInputProps: {
		ref: RefObject<HTMLInputElement | null>;
		value: string;
		onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
		onBlur: () => void;
		onKeyDown: (e: React.KeyboardEvent) => void;
	};
	SnippetTrigger: React.ComponentType<{
		className?: string;
		style?: React.CSSProperties;
		children?: React.ReactNode;
	}>;
	SessionHistoryTrigger: React.ComponentType<{
		className?: string;
		style?: React.CSSProperties;
		children?: React.ReactNode;
	}>;
	shortcuts: { splitV: string; splitH: string; close: string };
}

/** Props passed to every Frame variant component. */
export interface FrameProps extends StatusBarProps {
	children: React.ReactNode;
	headerProps: React.HTMLAttributes<HTMLDivElement>;
	contextMenu: React.ReactNode;
	/** Current agent activity state for this pane. */
	agentStatus: AgentStatus;
}

/** Props passed to every ScrollButton variant component. */
export interface ScrollButtonProps {
	onClick: () => void;
	theme: VariantTheme;
}

/** A complete pane chrome variant — one Frame + one ScrollButton. */
export interface PaneVariant {
	Frame: React.FC<FrameProps>;
	ScrollButton: React.FC<ScrollButtonProps>;
}
