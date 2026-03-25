import type { ComponentType } from "react";
import type { AgentKind } from "../shared/types";

interface IconProps {
	className?: string | undefined;
}

/** Anthropic sunburst mark — stylized asterisk with rounded rays. */
function ClaudeIcon({ className }: IconProps) {
	return (
		<svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
			<path d="M15.31 3.34 12.84 12l8.55-2.8a.47.47 0 0 0 .22-.72l-1.52-2.22a.47.47 0 0 0-.38-.2H15.7a.47.47 0 0 1-.39-.72ZM8.69 20.66 11.16 12l-8.55 2.8a.47.47 0 0 0-.22.72l1.52 2.22a.47.47 0 0 0 .38.2H8.3a.47.47 0 0 1 .39.72ZM20.66 15.31 12 12.84l2.8 8.55a.47.47 0 0 0 .72.22l2.22-1.52a.47.47 0 0 0 .2-.38V15.7a.47.47 0 0 1 .72-.39ZM3.34 8.69 12 11.16l-2.8-8.55a.47.47 0 0 0-.72-.22L6.26 3.9a.47.47 0 0 0-.2.38V8.3a.47.47 0 0 1-.72.39Z" />
		</svg>
	);
}

/** Gemini sparkle — four-pointed star. */
function GeminiIcon({ className }: IconProps) {
	return (
		<svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
			<path d="M12 2C12 2 13.5 7.5 16 10C18.5 12.5 22 12 22 12C22 12 18.5 13.5 16 16C13.5 18.5 12 22 12 22C12 22 10.5 18.5 8 16C5.5 13.5 2 12 2 12C2 12 5.5 10.5 8 8C10.5 5.5 12 2 12 2Z" />
		</svg>
	);
}

/** Codex terminal — angular bracket prompt. */
function CodexIcon({ className }: IconProps) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<polyline points="4 17 10 11 4 5" />
			<line x1="12" y1="19" x2="20" y2="19" />
		</svg>
	);
}

const AGENT_ICONS: Record<AgentKind, ComponentType<IconProps>> = {
	claude: ClaudeIcon,
	gemini: GeminiIcon,
	codex: CodexIcon,
};

export function AgentIcon({
	agent,
	className,
}: {
	agent: AgentKind;
	className?: string | undefined;
}) {
	const Icon = AGENT_ICONS[agent];
	return <Icon className={className} />;
}
