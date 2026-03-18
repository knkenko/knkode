import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { api } from "./lib/tauri-api";
import "./components/pane-chrome/all-variants";
import "./styles.css";

// One-time global assignment for v1-compatible components that reference window.api
(window as { api: typeof api }).api = api;

const root = document.getElementById("root");
if (!root) throw new Error("Missing #root element in index.html");

createRoot(root).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
