import "react";

declare module "react" {
	interface CSSProperties {
		/** WebKit CSS property for frameless window drag regions. Applied by window chrome components. */
		WebkitAppRegion?: "drag" | "no-drag";
		/** macOS traffic-light spacing — left padding for window controls. */
		"--spacing-traffic"?: string;
		/** Windows caption-button spacing — right padding for minimize/maximize/close. */
		"--spacing-caption"?: string;
	}
}
