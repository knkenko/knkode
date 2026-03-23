import type {
	ComponentType,
	CSSProperties,
	InputHTMLAttributes,
	MouseEvent,
	ReactNode,
} from "react";
import type { AgentStatus, PrInfo } from "../../shared/types";

// Base props for visual rendering
export interface BaseWorkspaceHeaderProps {
	name: string;
	isActive: boolean;
	isCollapsed: boolean;
	/** Number of panes in this workspace that have attention status. Badge shown when > 0. */
	attentionCount: number;
	/** Workspace-level CWD (majority vote across panes, focused pane breaks ties). */
	cwd: string | null;
	/** Workspace-level git branch (from first pane matching the winning CWD). */
	branch: string | null;
	/** Workspace-level PR info (from same pane as branch). */
	pr: PrInfo | null;
	isEditing: boolean;
	inputProps: InputHTMLAttributes<HTMLInputElement>;
	onClick: (e: MouseEvent) => void;
	onContextMenu: (e: MouseEvent) => void;
}

export interface BasePaneEntryProps {
	label: string;
	/** Terminal title (OSC 1/2). Shown as subtitle when agentStatus !== "idle". */
	title: string | null;
	agentStatus: AgentStatus;
	isFocused: boolean;
	onClick: () => void;
	onContextMenu: (e: MouseEvent) => void;
	paneId: string;
}

export interface CollapsedVariantProps {
	name: string;
	isActive: boolean;
	onClick: () => void;
}

/** CSS class tokens for workspace section wrappers. `base` is always applied; exactly one of `active`/`inactive` is appended. */
export interface WrapperTokens {
	base: string;
	active: string;
	inactive: string;
}

/** Tokens for collapsed workspace variant rendering. `button` is always applied; exactly one of `active`/`inactive` is appended. */
export interface CollapsedTokens {
	button: string;
	active: string;
	inactive: string;
	label: string;
	labelActive?: string;
	formatName?: (name: string) => string;
	style?: CSSProperties;
	decorator?: (isActive: boolean) => ReactNode;
}

export interface ThemeVariantConfig {
	wrapper: WrapperTokens;
	collapsed: CollapsedTokens;
	Header: ComponentType<BaseWorkspaceHeaderProps>;
	Entry: ComponentType<BasePaneEntryProps>;
}
