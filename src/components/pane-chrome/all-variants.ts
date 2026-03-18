/**
 * Side-effect imports — each file calls registerVariant() at module scope.
 * When adding a new variant: create the file, add its import here,
 * and add its name to _VARIANT_COMPLETENESS below.
 */
import "./AmberVariant";
import "./ArcticVariant";
import "./CatppuccinVariant";
import "./CyberpunkVariant";
import "./DefaultDarkVariant";
import "./DraculaVariant";
import "./EverforestVariant";
import "./GruvboxVariant";
import "./MatrixVariant";
import "./MonokaiVariant";
import "./NordVariant";
import "./OceanVariant";
import "./SolanaVariant";
import "./SunsetVariant";
import "./TokyoNightVariant";
import "./VaporwaveVariant";

import type { ThemePresetName } from "../../data/theme-presets";

/** Compile-time completeness check: if a preset is added to THEME_PRESETS
 *  without a corresponding entry here, TypeScript will report a missing property. */
const _VARIANT_COMPLETENESS: Record<ThemePresetName, true> = {
	"Default Dark": true,
	Dracula: true,
	"Tokyo Night": true,
	Nord: true,
	Catppuccin: true,
	Gruvbox: true,
	Monokai: true,
	Everforest: true,
	Matrix: true,
	Cyberpunk: true,
	Solana: true,
	Amber: true,
	Vaporwave: true,
	Ocean: true,
	Sunset: true,
	Arctic: true,
};
void _VARIANT_COMPLETENESS;
