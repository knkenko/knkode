import { getVersion } from "@tauri-apps/api/app";
import { useCallback, useEffect, useState } from "react";
import type { UpdateActions, UpdateState } from "../hooks/useUpdateChecker";
import { SettingsSection } from "./SettingsSection";
import { UpdateStatusContent } from "./UpdateStatusContent";

const GITHUB_URL = "https://github.com/knkenko/knkode";

const BTN_LINK =
	"h-7 text-xs font-medium rounded bg-transparent border border-edge text-content-secondary cursor-pointer hover:text-content hover:bg-overlay focus-visible:ring-1 focus-visible:ring-accent focus-visible:outline-none transition-all duration-150 px-3";

interface AboutTabPanelProps {
	updateState: UpdateState;
	updateActions: UpdateActions;
	hidden?: boolean;
}

export function AboutTabPanel({ updateState, updateActions, hidden }: AboutTabPanelProps) {
	const [appVersion, setAppVersion] = useState<string | null>(null);
	const [linkError, setLinkError] = useState<string | null>(null);

	useEffect(() => {
		getVersion()
			.then(setAppVersion)
			.catch((err: unknown) => {
				console.error("[about] Failed to get app version:", err);
				setAppVersion(null);
			});
	}, []);

	const handleGitHubStar = useCallback(() => {
		setLinkError(null);
		window.api.openExternal(GITHUB_URL).catch((err: unknown) => {
			console.error("[about] Failed to open GitHub URL:", err);
			setLinkError(`Could not open link. Copy: ${GITHUB_URL}`);
		});
	}, []);

	return (
		<div
			id="settings-tabpanel-About"
			role="tabpanel"
			aria-labelledby="settings-tab-About"
			hidden={hidden}
			className="flex-1 min-h-0 px-6 py-6 overflow-y-auto overflow-x-hidden flex flex-col gap-8"
		>
			{/* App info */}
			<SettingsSection label="App">
				<div className="flex items-baseline gap-2">
					<span className="text-sm font-semibold text-content">knkode</span>
					{appVersion && <span className="text-xs text-content-muted">v{appVersion}</span>}
				</div>
				<p className="text-xs text-content-muted m-0">Terminal workspace manager</p>
			</SettingsSection>

			{/* Update section */}
			<SettingsSection label="Updates">
				<UpdateStatusContent state={updateState} actions={updateActions} variant="full" />
			</SettingsSection>

			{/* Links */}
			<SettingsSection label="Links">
				<div className="flex flex-col gap-2">
					<div className="flex gap-2">
						<button type="button" onClick={handleGitHubStar} className={BTN_LINK}>
							<span className="flex items-center gap-1.5">
								<svg
									width="14"
									height="14"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
									aria-hidden="true"
								>
									<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
								</svg>
								Star on GitHub
							</span>
						</button>
					</div>
					{linkError && <span className="text-[10px] text-danger">{linkError}</span>}
				</div>
			</SettingsSection>
		</div>
	);
}
