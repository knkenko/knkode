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
	/** Shortened CWD path for the workspace (displayed inline after name). */
	cwd: string | null;
	isActive: boolean;
	isCollapsed: boolean;
	/** Number of panes in this workspace that have attention status. Badge shown when > 0. */
	attentionCount: number;
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

export interface BaseWorkspaceGitInfoProps {
	branch: string | null;
	pr: PrInfo | null;
}

/** Styling tokens for the themed "Add Pane" button rendered below subgroup entries.
 *  The shared `AddPaneButton` component in ThemeRegistry renders a button from these tokens. */
export interface AddPaneButtonTokens {
	className: string;
	style?: CSSProperties;
	label: string;
}

/** Position of a pane within its subgroup's bracket connector.
 *  `solo` when the subgroup contains exactly one pane (short centered bar). */
export type BracketPosition = "first" | "middle" | "last" | "solo";

/** CSS color strings for subgroup bracket connectors. */
export interface BracketColors {
	active: string;
	inactive: string;
}

/** Styling tokens for the themed session history modal.
 *  The shared `SessionHistoryModal` component renders all elements from these tokens,
 *  following the same pattern as `AddPaneButtonTokens`. */
export interface SessionHistoryTokens {
	/** Modal panel className (bg, border, shadow, radius, effects). */
	modal: string;
	modalStyle?: CSSProperties;
	/** Header bar className. */
	header: string;
	/** Session row className (card appearance). */
	row: string;
	rowStyle?: CSSProperties;
	/** Resume button className. */
	resumeButton: string;
	resumeButtonStyle?: CSSProperties;
	/** Themed label text for the resume button (e.g. "Resume", "> RESUME", "[ RESUME ]"). */
	resumeLabel: string;
	/** Inactive filter tab className. */
	filterTab: string;
	/** Active filter tab className. */
	filterTabActive: string;
}

export interface ThemeVariantConfig {
	wrapper: WrapperTokens;
	collapsed: CollapsedTokens;
	bracket: BracketColors;
	Header: ComponentType<BaseWorkspaceHeaderProps>;
	Entry: ComponentType<BasePaneEntryProps>;
	GitInfo: ComponentType<BaseWorkspaceGitInfoProps>;
	addPaneButton: AddPaneButtonTokens;
	sessionHistory: SessionHistoryTokens;
}
