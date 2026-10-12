/**
 * Reports what the built site actually weighs, and fails if it grew.
 *
 * The site is deployed to GitHub Pages, which gzips text responses but sends
 * `cache-control: max-age=600` and does not serve Brotli or pre-compressed
 * siblings. So the number that matters is gzip, and the only lever left is
 * making the raw bytes smaller. That is what this measures.
 *
 * Two modes:
 *
 *   node tools/report-size.mjs           compare dist against the budgets
 *   node tools/report-size.mjs --write   rewrite the budgets from the current
 *                                        build, then report
 *
 * Budgets are flat "<what>.<unit>" keys in website/performance-budget.json.
 * They are ceilings, not targets: Phase 2 of the site work dropped the icon
 * total by an order of magnitude, and the budget then sits just above the new
 * number so an accidental icon re-export at full resolution fails loudly.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { gzipSync, brotliCompressSync, constants } from "node:zlib";
import { dirname, join, relative, extname } from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(siteDir, "dist");
const budgetPath = join(siteDir, "performance-budget.json");

	/* What the page actually ships. The share card is called out separately
	   because image.maxFile exists to catch a mod icon re-exported at source
	   resolution, and a 1200x630 card is supposed to be large — counting it
	   there would either trip that check forever or water the check down until
	   it stops catching anything. */
	const TYPES = {
		".html": "html",
		".css": "css",
		".js": "js",
		".mjs": "js",
		".webp": "image",
		".png": "image",
		".jpg": "image",
		".jpeg": "image",
		".avif": "image",
		".svg": "image",
		".ico": "image"
	};

	const isCard = (name) => /^(og|share)\.(png|jpe?g|webp)$/i.test(name);

	function walk(dir, out = []) {
		for (const entry of readdirSync(dir)) {
			const path = join(dir, entry);
			if (statSync(path).isDirectory()) walk(path, out);
			else out.push(path);
		}
		return out;
	}

	/** Walks dist and returns the totals the report and the budgets speak in. */
	function measure() {
		if (!existsSync(distDir)) {
			console.error("dist does not exist. Run the build first.");
			process.exit(1);
		}

		const files = walk(distDir).map((path) => {
			const buf = readFileSync(path);
			const name = relative(distDir, path).split("\\").join("/");
			const type = isCard(name) ? "card" : (TYPES[extname(path).toLowerCase()] ?? "other");
			return {
				name,
				type,
				raw: buf.length,
				// Level 9 and best compression, i.e. what a static host would use
				// on a precompressed asset. GitHub Pages is less aggressive than
				// this, so the real transfer is a little larger.
				gzip: gzipSync(buf, { level: 9 }).length,
				brotli: brotliCompressSync(buf, {
					params: {
						[constants.BROTLI_PARAM_QUALITY]: 11,
						[constants.BROTLI_PARAM_SIZE_HINT]: buf.length
					}
				}).length
			};
		});

	const totals = { raw: 0, gzip: 0, brotli: 0 };
	const byType = {};
	for (const f of files) {
		totals.raw += f.raw;
		totals.gzip += f.gzip;
		totals.brotli += f.brotli;
		const t = (byType[f.type] ??= { count: 0, raw: 0, gzip: 0, brotli: 0 });
		t.count++;
		t.raw += f.raw;
		t.gzip += f.gzip;
		t.brotli += f.brotli;
	}

	// The largest single mod icon, because "one icon re-exported at source
	// resolution" is the regression this file exists to catch, and it hides
	// inside a healthy-looking total.
	const images = files.filter((f) => f.type === "image");
	const largest = images.reduce((a, b) => (b.raw > (a?.raw ?? -1) ? b : a), null);

	const kb = (n) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} kB`);

	const measured = {
		"total.raw": totals.raw,
		"total.gzip": totals.gzip,
		"total.brotli": totals.brotli
	};
	for (const [type, t] of Object.entries(byType)) {
		measured[`${type}.raw`] = t.raw;
		measured[`${type}.gzip`] = t.gzip;
		measured[`${type}.count`] = t.count;
	}
	if (largest) measured["image.maxFile"] = largest.raw;

	console.log(`\ndist: ${files.length} files\n`);
	console.log("  type     count      raw        gzip      brotli");
	for (const [type, t] of Object.entries(byType).sort()) {
		console.log(
			`  ${type.padEnd(7)} ${String(t.count).padStart(5)}  ${kb(t.raw).padStart(9)}  ${kb(t.gzip).padStart(9)}  ${kb(t.brotli).padStart(9)}`
		);
	}
	console.log(
		`  ${"all".padEnd(7)} ${String(files.length).padStart(5)}  ${kb(totals.raw).padStart(9)}  ${kb(totals.gzip).padStart(9)}  ${kb(totals.brotli).padStart(9)}`
	);
	if (largest) {
		console.log(`\n  largest icon: ${kb(largest.raw)}  ${largest.name}`);
	}

	return { measured, budgets: budgetsFrom(measured) };
}

/* Headroom written into the budget. A budget that is the exact current number
   fails on the next legitimate change — one dictionary string, one new mod —
   which trains everyone to re-run --write and stops it meaning anything. A real
   regression is a multiple of these numbers, not a few percent. */
const HEADROOM = 1.2;
const ceil = (n) => Math.ceil((n ?? 0) * HEADROOM);

function budgetsFrom(measured) {
	const budget = {
		// What a first visit costs the critical path: the document, its
		// stylesheet and its script. Fonts are jsDelivr's and not counted.
		"critical.gzip": 0,
		// Text assets stay small enough to be worth minifying harder.
		"html.gzip": 0,
		"css.gzip": 0,
		"js.gzip": 0,
		// Mod icons dominate raw bytes but are lazy and already compressed, so
		// they are budgeted on raw size, not transfer size. maxFile is the one
		// that catches a single icon re-exported at source resolution.
		"image.raw": 0,
		"image.maxFile": 0,
		"card.raw": 0,
		"total.raw": 0,
		"total.gzip": 0
	};
	budget["critical.gzip"] = ceil(
		(measured["html.gzip"] ?? 0) + (measured["css.gzip"] ?? 0) + (measured["js.gzip"] ?? 0)
	);
	for (const key of Object.keys(budget)) {
		if (key !== "critical.gzip" && key in measured) budget[key] = ceil(measured[key]);
	}
	return budget;
}

const { measured, budgets } = measure();

if (process.argv.includes("--write")) {
	writeFileSync(budgetPath, JSON.stringify(budgets, null, "\t") + "\n");
	console.log(`\nwrote ${budgetPath}`);
	process.exit(0);
}

if (!existsSync(budgetPath)) {
	console.error(`\nno budget file at ${budgetPath}. Run with --write to create one.`);
	process.exit(1);
}

const saved = JSON.parse(readFileSync(budgetPath, "utf8"));
const kb = (n) => (n < 1024 ? `${n} B` : `${(n / 1024).toFixed(1)} kB`);
const over = [];

console.log("\nbudget            measured       limit");
for (const [key, limit] of Object.entries(saved)) {
	const now = measured[key];
	if (now === undefined) continue;
	const bad = now > limit;
	if (bad) over.push([key, now, limit]);
	console.log(
		`  ${bad ? "OVER" : "ok  "} ${key.padEnd(14)} ${kb(now).padStart(9)}  ${kb(limit).padStart(11)}`
	);
}

if (over.length) {
	console.log(`\n${over.length} budget(s) exceeded:`);
	for (const [key, now, limit] of over) {
		console.log(`  ${key}: ${kb(now)} over a ${kb(limit)} limit`);
	}
	process.exit(1);
}
console.log("\nall budgets pass");
