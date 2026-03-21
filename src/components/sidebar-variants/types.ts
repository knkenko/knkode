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
	paneCount: number;
	isEditing: boolean;
	inputProps: InputHTMLAttributes<HTMLInputElement>;
	onClick: (e: MouseEvent) => void;
	onContextMenu: (e: MouseEvent) => void;
}

export interface BasePaneEntryProps {
	label: string;
	cwd: string;
	branch: string | null;
	pr: PrInfo | null;
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
