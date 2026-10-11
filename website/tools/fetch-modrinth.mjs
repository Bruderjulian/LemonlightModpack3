/**
 * One-off developer step: pulls project metadata from the Modrinth API for the
 * slugs listed in groups.json, writes website/tools/modrinth-cache.json and
 * downloads each icon into website/src/assets/img/.
 *
 * This is the only place the site talks to Modrinth. The generated page makes
 * no runtime requests, so the icons ship with the site.
 *
 * Run: node website/tools/fetch-modrinth.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const site = join(root, "website");
const groups = JSON.parse(readFileSync(join(site, "tools", "groups.json"), "utf8"));
const imgDir = join(site, "src", "assets", "img");

const slugs = [...new Set(Object.values(groups.mods).map((m) => m.slug).filter(Boolean))];
mkdirSync(imgDir, { recursive: true });

const projects = [];
const BATCH = 50;
for (let i = 0; i < slugs.length; i += BATCH) {
	const chunk = slugs.slice(i, i + BATCH);
	const url = `https://api.modrinth.com/v2/projects?ids=${JSON.stringify(chunk)
		.replace(/"/g, "%22")
		.replace(/\[|%5D/g, (m) => (m === "[" ? "[" : "]"))}`;
	const res = await fetch(url, { headers: { "User-Agent": "zitrus-site/0.1 (github.com/skywardmc)" } });
	if (!res.ok) throw new Error(`modrinth ${res.status} for batch ${i}`);
	projects.push(...(await res.json()));
	await new Promise((r) => setTimeout(r, 250));
}

const found = new Set(projects.map((p) => p.slug));
const missing = slugs.filter((s) => !found.has(s));
if (missing.length) console.warn(`not on Modrinth: ${missing.join(", ")}`);

let icons = 0;
for (const p of projects) {
	if (!p.icon_url) continue;
	const res = await fetch(p.icon_url, { headers: { "User-Agent": "zitrus-site/0.1" } });
	if (!res.ok) continue;
	const buf = Buffer.from(await res.arrayBuffer());
	if (buf.length < 300) continue; // Modrinth serves a placeholder for missing art
	writeFileSync(join(imgDir, `${p.slug}.png`), buf);
	icons++;
}

// Modrinth titles carry loader suffixes like "[EMF] Entity Model Features
// [Fabric & Forge]". Strip the bracketed parts for display; keep the leading
// tag, which is part of how these mods are known.
const displayTitle = (title) =>
	title
		.replace(/\s*[\[(][^\])]*[\])]\s*$/g, "")
		.replace(/\s+-\s*$/, "")
		.trim();

writeFileSync(
	join(site, "tools", "modrinth-cache.json"),
	JSON.stringify(
		projects.map((p) => ({
			slug: p.slug,
			title: p.title,
			displayTitle: displayTitle(p.title),
			description: p.description,
			categories: p.categories,
			icon_url: p.icon_url,
			// Popularity. The site sorts the mod list by downloads and uses
			// followers as the tiebreak, so these have to be in the cache:
			// the page never calls the API at runtime.
			downloads: p.downloads ?? 0,
			followers: p.followers ?? 0,
			// First release date. Cached but unused for now; it is what a
			// "newest" sort would key off if one is ever added.
			published: p.published ?? null
		})),
		null,
		"\t"
	) + "\n"
);

console.log(`cached ${projects.length} projects, wrote ${icons} icons`);
