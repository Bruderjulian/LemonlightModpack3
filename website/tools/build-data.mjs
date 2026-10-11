/**
 * Generates website/src/data/mods.json from the real pack metadata.
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
const site = join(root, "website");
const outDir = join(site, "src", "data");
const groups = JSON.parse(readFileSync(join(site, "tools", "groups.json"), "utf8"));

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

/* The pack version is a semver with build metadata:
   "1.1.0+mc26.3.fabric" -> release 1.1.0, Minecraft 26.3, loader fabric.
   The site shows all three, so they are split here rather than parsed in the
   page. The Minecraft version still comes from the directory name, which is
   the authority; the one in the metadata is only a cross-check. */
function parsePackVersion(raw) {
	const text = String(raw || "");
	const plus = text.indexOf("+");
	const release = plus === -1 ? text : text.slice(0, plus);
	const meta = plus === -1 ? "" : text.slice(plus + 1);
	const parts = /^mc([\d.]+)\.([a-z]+)$/.exec(meta);
	return {
		release: release || null,
		loader: parts ? parts[2] : null,
		// Kept so a mismatch between folder and metadata is visible, not silent.
		metaMinecraft: parts ? parts[1] : null
	};
}

// Minecraft versions do not sort as text: 1.21.11 is newer than 1.21.1, and
// 26.x is newer than 1.x. Compare segment by segment, as numbers.
const mcKey = (mc) => String(mc).split(/[.-]/).map(Number);
const byMinecraft = (a, b) => {
	const ka = mcKey(a.minecraft);
	const kb = mcKey(b.minecraft);
	for (let i = 0; i < Math.max(ka.length, kb.length); i++) {
		const d = (ka[i] || 0) - (kb[i] || 0);
		if (d) return d;
	}
	return 0;
};

const versions = [];
for (const mc of readdirSync(versionsDir)) {
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

	const packVersion = parsePackVersion(pack.version);
	if (packVersion.metaMinecraft && packVersion.metaMinecraft !== mc) {
		console.warn(
			`${mc}/pack.toml says +mc${packVersion.metaMinecraft}; the folder wins`
		);
	}

	versions.push({
		minecraft: mc,
		release: packVersion.release,
		loader: packVersion.loader,
		packVersion: pack.version || null,
		fabric: pack.fabric || null,
		total: mods.length,
		counts,
		mods
	});
}

versions.sort(byMinecraft);
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
		// Bare file name of the 2x icon. Vite owns the URL: main.js maps this
		// through an import.meta.glob so the built path carries the content
		// hash. build-icons.mjs is what produces these; if it has not run yet
		// the lookup misses and the row falls back to its monogram.
		icon: project ? `${project.slug}.webp` : null,
		// Popularity, straight from Modrinth. The browser sorts on these.
		downloads: project?.downloads ?? 0,
		followers: project?.followers ?? 0,
		library: libraries.has(mod.file)
	};
};

// Enrichment comes from a cache the fetch step writes, so builds stay offline
// and reproducible and the page never calls the Modrinth API at runtime.
let projectsBySlug = new Map();
try {
	const cache = JSON.parse(readFileSync(join(site, "tools", "modrinth-cache.json"), "utf8"));
	projectsBySlug = new Map(cache.map((p) => [p.slug, p]));
} catch {
	console.warn("no modrinth-cache.json, slugs and blurbs will be sparse");
}

// Default order: most downloaded first, with followers as the tiebreak and
// the name after that so the order is always deterministic. The page re-sorts
// per group and for search, so this is only the shipped default.
const byPopularity = (a, b) =>
	b.downloads - a.downloads || b.followers - a.followers || a.name.localeCompare(b.name);

const curated = latest.mods.map(enrich).filter((m) => !m.library).sort(byPopularity);

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
			generated: "pnpm --dir website run data",
			latest: latest.minecraft,
			total: latest.total,
			counts: latest.counts,
			curated: curated.length,
			// Newest Minecraft first, so the wizard's default choice is the
			// first card rather than the last one in the row.
			versions: [...versions]
				.sort((a, b) => byMinecraft(b, a))
				.map(({ minecraft, release, loader, total, counts }) => ({
					minecraft,
					release,
					loader,
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
