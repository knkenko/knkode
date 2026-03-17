/// <reference types="vite/client" />

// Top-level import converts this .d.ts into a module, requiring `declare global`.
// This is intentional — it lets us reference KnkodeApi by import rather than inline.
import type { KnkodeApi } from "./shared/types";

declare global {
	interface Window {
		readonly api: KnkodeApi;
	}
}
