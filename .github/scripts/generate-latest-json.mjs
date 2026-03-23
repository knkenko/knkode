#!/usr/bin/env node
// Generates latest.json for tauri-plugin-updater.
// Tauri v2 updater manifest format: https://v2.tauri.app/plugin/updater/
//
// Expected env vars:
//   RELEASE_TAG — git tag (e.g. "v2.0.3")
//   REPO_URL    — full repo URL (e.g. "https://github.com/knkenko/knkode")

import { readdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const tag = process.env.RELEASE_TAG;
const repoUrl = process.env.REPO_URL;

if (!tag) {
	console.error("ERROR: RELEASE_TAG environment variable is required");
	process.exit(1);
}
if (!repoUrl) {
	console.error("ERROR: REPO_URL environment variable is required");
	process.exit(1);
}

const dir = "release-files";
const files = readdirSync(dir);
const platforms = {};

// macOS — universal binary contains both arm64 and x86_64 slices,
// so both platform keys point to the same artifact and signature.
const macSig = files.find((f) => f.endsWith(".app.tar.gz.sig"));
const macBundle = files.find(
	(f) => f.endsWith(".app.tar.gz") && !f.endsWith(".sig"),
);
if (macSig && macBundle) {
	const sig = readFileSync(join(dir, macSig), "utf8").trim();
	const url = `${repoUrl}/releases/download/${tag}/${macBundle}`;
	platforms["darwin-aarch64"] = { signature: sig, url };
	platforms["darwin-x86_64"] = { signature: sig, url };
}

// Windows — NSIS installer bundle (.nsis.zip is the updater-compatible format)
const winSig = files.find((f) => f.endsWith(".nsis.zip.sig"));
const winBundle = files.find(
	(f) => f.endsWith(".nsis.zip") && !f.endsWith(".sig"),
);
if (winSig && winBundle) {
	const sig = readFileSync(join(dir, winSig), "utf8").trim();
	const url = `${repoUrl}/releases/download/${tag}/${winBundle}`;
	platforms["windows-x86_64"] = { signature: sig, url };
}

if (Object.keys(platforms).length === 0) {
	console.error(
		"ERROR: No updater artifacts found. Check that TAURI_SIGNING_PRIVATE_KEY is configured " +
			"and createUpdaterArtifacts is enabled in tauri.conf.json.",
	);
	process.exit(1);
}

// Release notes are provided by the GitHub Release body, not this manifest
const latest = {
	version: tag,
	notes: "",
	pub_date: new Date().toISOString(),
	platforms,
};

writeFileSync(join(dir, "latest.json"), JSON.stringify(latest, null, 2));
console.log(
	"Generated latest.json with platforms:",
	Object.keys(platforms).join(", "),
);
