// Tauri-recommended Vite config — see https://v2.tauri.app/start/frontend/vite/
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;
const isDebug = !!process.env.TAURI_ENV_DEBUG;

export default defineConfig({
	clearScreen: false,
	plugins: [react(), tailwindcss()],
	server: {
		port: 5179,
		strictPort: true,
		host: host ?? false,
		hmr: host
			? {
					protocol: "ws",
					host,
					port: 1421,
				}
			: undefined,
		watch: {
			ignored: ["**/src-tauri/**"],
		},
	},
	envPrefix: ["VITE_", "TAURI_ENV_*"],
	build: {
		target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari15",
		minify: isDebug ? false : "esbuild",
		sourcemap: isDebug,
	},
	test: {
		environment: "jsdom",
	},
});
