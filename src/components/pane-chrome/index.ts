import { DefaultVariant } from "./DefaultVariant";
import type { FrameProps, PaneVariant, ScrollButtonProps } from "./types";

export type { VariantTheme } from "./types";
export type { FrameProps, PaneVariant, ScrollButtonProps };

/** Maps preset name to variant. Populated at startup via side-effect imports in all-variants.ts. */
const VARIANT_REGISTRY = new Map<string, PaneVariant>();

/** Register a named variant. Called at module scope by each variant file. */
export function registerVariant(name: string, variant: PaneVariant): void {
	if (VARIANT_REGISTRY.has(name)) {
		console.warn(`[pane-chrome] overwriting existing variant registration: "${name}"`);
	}
	VARIANT_REGISTRY.set(name, variant);
}

/** Look up the variant for a preset name, falling back to DefaultVariant. */
export function getVariant(presetName: string | undefined): PaneVariant {
	if (presetName) {
		const variant = VARIANT_REGISTRY.get(presetName);
		if (variant) return variant;
		console.warn(`[pane-chrome] no variant registered for preset "${presetName}", using default`);
	}
	return DefaultVariant;
}
