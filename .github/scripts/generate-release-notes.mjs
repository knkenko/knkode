#!/usr/bin/env node
// Generates human-readable release notes from conventional commits between two tags.
//
// Expected env vars:
//   RELEASE_TAG — current git tag (e.g. "v2.1.1")
//
// Writes release-notes.md to CWD.

import { execSync } from "child_process";
import { writeFileSync } from "fs";

const tag = process.env.RELEASE_TAG;
if (!tag) {
	console.error("ERROR: RELEASE_TAG environment variable is required");
	process.exit(1);
}

// Find the previous tag
const allTags = execSync("git tag --sort=-version:refname", { encoding: "utf8" })
	.trim()
	.split("\n")
	.filter(Boolean);

const currentIdx = allTags.indexOf(tag);
const prevTag = currentIdx >= 0 && currentIdx + 1 < allTags.length
	? allTags[currentIdx + 1]
	: null;

const range = prevTag ? `${prevTag}..${tag}` : tag;
const rawLog = execSync(`git log ${range} --pretty=format:"%s" --no-merges`, {
	encoding: "utf8",
}).trim();

if (!rawLog) {
	writeFileSync("release-notes.md", "No changes in this release.\n");
	process.exit(0);
}

// Parse conventional commits into categories
const categories = {
	feat: { title: "Features", items: [] },
	fix: { title: "Bug Fixes", items: [] },
	perf: { title: "Performance", items: [] },
	refactor: { title: "Improvements", items: [] },
};
const other = [];

for (const line of rawLog.split("\n")) {
	const match = line.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);
	if (match) {
		const [, type, scope, description] = match;
		const text = scope ? `**${scope}**: ${description}` : description;
		if (categories[type]) {
			categories[type].items.push(text);
		} else if (type !== "chore" && type !== "docs" && type !== "ci" && type !== "test") {
			other.push(text);
		}
	}
}

// Build markdown
const sections = [];
for (const cat of Object.values(categories)) {
	if (cat.items.length > 0) {
		sections.push(`### ${cat.title}\n${cat.items.map((i) => `- ${i}`).join("\n")}`);
	}
}
if (other.length > 0) {
	sections.push(`### Other\n${other.map((i) => `- ${i}`).join("\n")}`);
}

const notes = sections.length > 0
	? sections.join("\n\n")
	: "Maintenance release — internal improvements and dependency updates.";

writeFileSync("release-notes.md", `${notes}\n`);
console.log("Generated release-notes.md");
