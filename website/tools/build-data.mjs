/**
 * Generates website/assets/data/mods.json from the real pack metadata.
 *
 * Source of truth is versions/<loader>/<mc>/mods/*.pw.toml, which packwiz
 * reads at export time. Each file declares the mod name, side and Modrinth
 * id. Group and blurb come from groups.json, which is hand maintained.
 *
 * Run: node website/tools/build-data.mjs
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const versionsDir = join(root, "versions", "fabric");
const outDir = join(root, "website", "assets", "data");
const groups = JSON.parse(readFileSync(join(root, "website", "tools", "groups.json"), "utf8"));

/** Parses `key = value` pairs out of one packwiz per-mod file. */
function readPwToml(path) {
	const text = readFileSync(path, "utf8");
	const out = {};
	for (const line of text.split("\n")) {
		const match = /^([a-z-]+)\s*=\s*"(.*)"\s*$/.exec(line);
		if (match) out[match[1]] = match[2];
	}
	return out;
}

function readPackToml(path) {
	const text = readFileSync(path, "utf8");
	const out = {};
	for (const line of text.split("\n")) {
		const match = /^([a-z-]+)\s*=\s*"(.*)"\s*$/.exec(line);
		if (match) out[match[1]] = match[2];
	}
	return out;
}

const versions = [];
for (const mc of readdirSync(versionsDir).sort()) {
	const dir = join(versionsDir, mc);
	let packFiles;
	try {
		packFiles = readdirSync(join(dir, "mods")).filter((f) => f.endsWith(".pw.toml"));
	} catch {
		continue;
	}

	const pack = readPackToml(join(dir, "pack.toml"));
	const mods = packFiles.map((file) => {
		const meta = readPwToml(join(dir, "mods", file));
		return {
			id: meta["mod-id"] || null,
			name: meta.name || basename(file, ".pw.toml"),
			side: meta.side || "both",
			file: basename(file, ".pw.toml")
		};
	});

	const counts = mods.reduce((acc, m) => {
		acc[m.side] = (acc[m.side] || 0) + 1;
		return acc;
	}, {});

	versions.push({
		minecraft: mc,
		packVersion: pack.version || null,
		fabric: pack.fabric || null,
		total: mods.length,
		counts,
		mods
	});
}

const latest = versions[versions.length - 1];

// Library/dependency slugs ship only to satisfy a parent mod. specs/mod-list.md
// hides them from the site.
const libraries = new Set(groups.libraries);

const enrich = (mod) => {
	const g = groups.mods[mod.file];
	const project = g?.slug ? projectsBySlug.get(g.slug) : null;
	return {
		...mod,
		// Modrinth titles carry "[Fabric & Forge]" style suffixes; use the
		// cleaned display title when the cache has one.
		name: project?.displayTitle || mod.name,
		group: g?.group ?? null,
		parent: g?.parent ?? null,
		blurb: project?.description ?? g?.blurb ?? null,
		slug: project?.slug ?? g?.slug ?? null,
		icon: project ? `/assets/img/${project.slug}.png` : null,
		library: libraries.has(mod.file)
	};
};

// Enrichment comes from a cache the fetch step writes, so builds stay offline
// and reproducible and the page never calls the Modrinth API at runtime.
let projectsBySlug = new Map();
try {
	const cache = JSON.parse(readFileSync(join(root, "website", "tools", "modrinth-cache.json"), "utf8"));
	projectsBySlug = new Map(cache.map((p) => [p.slug, p]));
} catch {
	console.warn("no modrinth-cache.json, slugs and blurbs will be sparse");
}

const curated = latest.mods
	.map(enrich)
	.filter((m) => !m.library)
	.sort((a, b) => a.name.localeCompare(b.name));

const groupTotals = groups.order.map((key) => ({
	key,
	title: groups.titles[key],
	blurb: groups.blurbs[key],
	count: curated.filter((m) => m.group === key).length
}));

const ungrouped = curated.filter((m) => !m.group).map((m) => m.file);
if (ungrouped.length) {
	console.error(`ungrouped mods (add a group or mark as library):\n  ${ungrouped.join("\n  ")}`);
	process.exitCode = 1;
}

mkdirSync(outDir, { recursive: true });
writeFileSync(
	join(outDir, "mods.json"),
	JSON.stringify(
		{
			generated: "node website/tools/build-data.mjs",
			latest: latest.minecraft,
			total: latest.total,
			counts: latest.counts,
			curated: curated.length,
			versions: versions.map(({ minecraft, packVersion, total, counts }) => ({
				minecraft,
				packVersion,
				total,
				counts
			})),
			groups: groupTotals,
			mods: curated
		},
		null,
		"\t"
	) + "\n"
);

console.log(
	`wrote ${curated.length} curated mods (${latest.total} installed) for ${latest.minecraft}; groups: ` +
		groupTotals.map((g) => `${g.key}=${g.count}`).join(" ")
);
