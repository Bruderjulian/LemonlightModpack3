/**
 * Checks the built document, not the running page.
 *
 * Everything here is a claim about what a crawler sees in dist/index.html, so
 * it is asserted against the bytes on disk rather than against a live DOM. A
 * head tag that is correct in index.html and wrong in dist is the failure mode
 * worth catching: HTML minification, plugin injection order and a stale dist all
 * can produce exactly that, and none of them break the page visibly.
 *
 * No browser needed, so this runs in about a second next to the other checks.
 *
 * Run: node tools/check-seo.mjs
 */

import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { reporter } from "./reporter.mjs";
import { SITE_URL, PAGE_URL } from "./site-url.mjs";

const siteDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(siteDir, "dist");
const htmlPath = join(distDir, "index.html");

if (!existsSync(htmlPath)) {
	console.error("dist/index.html does not exist. Run the build first.");
	process.exit(1);
}

const html = readFileSync(htmlPath, "utf8");
const head = html.slice(0, html.indexOf("</head>"));
const pack = JSON.parse(readFileSync(join(siteDir, "src", "data", "mods.json"), "utf8"));
const r = reporter();

/** Returns the full text of the first <tag> whose `name` attribute equals `value`. */
const tagWhere = (tag, name, value) => {
	const re = new RegExp(`<${tag}\\b[^>]*\\b${name}=["']${value}["'][^>]*>`, "i");
	const m = re.exec(head);
	return m ? m[0] : null;
};

/** Reads one attribute out of an already-matched tag string. */
const value = (tag, name) => {
	if (!tag) return null;
	const m = new RegExp(`\\b${name}=["']([^"']*)["']`).exec(tag);
	return m ? m[1] : null;
};

const meta = (attrName, attrValue) => value(tagWhere("meta", attrName, attrValue), "content");
const canonical = () => value(tagWhere("link", "rel", "canonical"), "href");

r.check(
	"canonical points at the configured page",
	canonical() === PAGE_URL,
	`got ${canonical()}, want ${PAGE_URL}`
);

r.check(
	"og:url matches canonical",
	meta("property", "og:url") === PAGE_URL,
	`got ${meta("property", "og:url")}`
);

r.check(
	"og:title and og:description are present",
	Boolean(meta("property", "og:title") && meta("property", "og:description"))
);

r.check(
	"og:locale and every alternate are declared",
	meta("property", "og:locale") === "en_US" &&
		(head.match(/property="og:locale:alternate"/g) || []).length === 5,
	`locale=${meta("property", "og:locale")}, ` +
		`alternates=${(head.match(/property="og:locale:alternate"/g) || []).length} (want 5)`
);

r.check(
	"og:image is absolute and points at the built card",
	meta("property", "og:image") === `${SITE_URL}/og.png`,
	`got ${meta("property", "og:image")}`
);

r.check(
	"og:image dimensions match what was actually built",
	meta("property", "og:image:width") === "1200" &&
		meta("property", "og:image:height") === "630",
	`${meta("property", "og:image:width")}x${meta("property", "og:image:height")}`
);

r.check(
	"twitter card is a large image and points at the same file",
	meta("name", "twitter:card") === "summary_large_image" &&
		meta("name", "twitter:image") === `${SITE_URL}/og.png`,
	`card=${meta("name", "twitter:card")}`
);

// The card is referenced by absolute URL, so it has to exist and be the size
// the metadata claims, or every share preview is a broken image.
const ogPath = join(distDir, "og.png");
if (existsSync(ogPath)) {
	const meta = await sharp(ogPath).metadata();
	r.check(
		"the share card on disk is a 1200x630 png",
		meta.width === 1200 && meta.height === 630 && meta.format === "png",
		`${meta.format} ${meta.width}x${meta.height}`
	);
} else {
	r.check("the share card on disk is a 1200x630 png", false, "dist/og.png is missing");
}

/* ---------- JSON-LD ---------- */

const ld = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(head);
if (!ld) {
	r.check("JSON-LD block is present and parses", false, "no ld+json script in dist/index.html");
} else {
	let graph = null;
	try {
		graph = JSON.parse(ld[1])["@graph"];
	} catch (e) {
		r.check("JSON-LD block is present and parses", false, String(e));
	}
	if (graph) {
		r.check("JSON-LD block is present and parses", true, `${ld[1].length} bytes`);

		const types = graph.map((n) => n["@type"]);
		r.check(
			"JSON-LD declares WebSite, SoftwareApplication and ItemList",
			["WebSite", "SoftwareApplication", "ItemList"].every((t) => types.includes(t)),
			types.join(", ")
		);

		// A double slash here reads as a different URL, and it is exactly the
		// bug that appeared when the page URL was joined twice.
		const ids = graph.map((n) => n["@id"]).filter(Boolean);
		r.check(
			"no JSON-LD id contains a doubled slash",
			ids.every((id) => !id.includes("//", id.indexOf("://") + 2)),
			ids.join(" ")
		);

		const list = graph.find((n) => n["@type"] === "ItemList");
		const curated = pack.mods.filter((m) => !m.library);
		const names = (list?.itemListElement || []).map((e) => e.item.name);
		r.check(
			"the JSON-LD item list matches the pack, not a hand-kept copy",
			list?.numberOfItems === curated.length &&
				names.length === curated.length &&
				curated.every((m) => names.includes(m.name)),
			`claims ${list?.numberOfItems}, pack has ${curated.length}`
		);

		const slugs = (list?.itemListElement || []).map((e) => e.item.url);
		// Modrinth slugs are not strictly alphanumeric: "put-a-plug-in-it!"
		// and "reese's-sodium-options" are both real. The assertion is that the
		// URL is a single well-formed path segment under /mod/, not that the
		// slug matches some shape I invented.
		const badSlug = slugs.find((u) => {
			if (!u) return false;
			const m = /^https:\/\/modrinth\.com\/mod\/([^/?#]+)$/.exec(u);
			return !m || m[1] !== decodeURIComponent(m[1]);
		});
		r.check(
			"every JSON-LD mod with a slug links to its Modrinth project",
			!badSlug,
			badSlug || `${slugs.filter(Boolean).length} linked`
		);
	}
}

/* ---------- robots.txt and sitemap.xml ---------- */

const robotsPath = join(distDir, "robots.txt");
if (existsSync(robotsPath)) {
	const robots = readFileSync(robotsPath, "utf8");
	r.check(
		"robots.txt allows the site and points at the sitemap",
		/^User-agent: \*$/m.test(robots) &&
			/^Allow: \/$/m.test(robots) &&
			robots.includes(`Sitemap: ${PAGE_URL}sitemap.xml`)
	);
	// A blanket Disallow is the classic way to ship a robots.txt that quietly
	// removes the whole site from search.
	r.check(
		"robots.txt does not block the root",
		!/^Disallow: \/$/m.test(robots)
	);
} else {
	r.check("robots.txt allows the site and points at the sitemap", false, "dist/robots.txt missing");
}

const sitemapPath = join(distDir, "sitemap.xml");
if (existsSync(sitemapPath)) {
	const sitemap = readFileSync(sitemapPath, "utf8");
	const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
	r.check(
		"sitemap.xml lists exactly the canonical page",
		locs.length === 1 && locs[0] === PAGE_URL,
		locs.join(" ") || "no <loc>"
	);
} else {
	r.check("sitemap.xml lists exactly the canonical page", false, "dist/sitemap.xml missing");
}

/* ---------- Icons ---------- */

const assetsDir = join(distDir, "assets");
const files = readdirSync(assetsDir);
const webps = files.filter((f) => f.endsWith(".webp"));

// The bug that made this check worth writing: Modrinth answers in WebP, the
// fetcher wrote it to <slug>.png, and 84 "PNGs" were served as image/png.
const pngs = files.filter((f) => f.endsWith(".png"));
r.check(
	"no mislabelled png icons in dist",
	pngs.length === 0,
	pngs.slice(0, 3).join(", ")
);

const bySlug = new Map();
for (const f of webps) {
	const m = /^(.+)-(\d+)-[A-Za-z0-9_-]+\.webp$/.exec(f);
	if (!m) continue;
	const slug = m[1];
	// Not `bySlug.set(slug, x).set(...)`: set returns the map it was called on,
	// so that chains onto bySlug and files the widths under numeric keys.
	if (!bySlug.has(slug)) bySlug.set(slug, new Map());
	bySlug.get(slug).set(Number(m[2]), f);
}
r.check(
	"every icon exists at both 1x and 2x",
	bySlug.size > 0 && [...bySlug.values()].every((sizes) => sizes.has(34) && sizes.has(68)),
	`${bySlug.size} slugs`
);

// Reading the real dimensions is the only way to know the build actually
// resized rather than merely renamed.
const sample = [...bySlug.entries()].slice(0, 12);
const badDims = [];
for (const [, sizes] of sample) {
	for (const [want, file] of sizes) {
		const meta = await sharp(join(assetsDir, file)).metadata();
		if (meta.format !== "webp" || meta.width !== want) {
			badDims.push(`${file}: ${meta.format} ${meta.width}x${meta.height}, want webp ${want}`);
		}
	}
}
r.check(
	"icons are real webp at their advertised width",
	badDims.length === 0,
	badDims.slice(0, 3).join("; ")
);

const iconBytes = webps.reduce((sum, f) => sum + statSync(join(assetsDir, f)).size, 0);
r.check(
	"icons stay inside their byte budget",
	iconBytes < 220 * 1024,
	`${(iconBytes / 1024).toFixed(1)} kB across ${webps.length} files`
);

/* ---------- Prerendered content ---------- */

// The mod list, the group bars and the wizard are built by main.js. If they are
// not in dist/index.html, a crawler that does not run JavaScript sees a page
// with no mods on it. These assertions are the whole reason Phase 6 exists.
const body = html.slice(html.indexOf("<body"));
r.check(
	"the mod list is in the served HTML, not only built at runtime",
	(body.match(/class="mod[ "]/g) || []).length >= 12,
	`${(body.match(/class="mod[ "]/g) || []).length} prerendered rows (want >= 12)`
);

r.check(
	"the group filter chips are in the served HTML",
	(body.match(/class="tab"/g) || []).length >= 4,
	`${(body.match(/class="tab"/g) || []).length} chips`
);

r.check(
	"the hero panel carries real numbers, not the -- placeholders",
	body.includes(String(pack.total)) &&
		body.includes(String(pack.curated)) &&
		!/id="p-total">--</.test(body),
	"panel still shows placeholders"
);

r.check(
	"the install wizard is in the served HTML",
	body.includes('id="wiz-launchers"') &&
		body.includes('id="wiz-versions"') &&
		(body.match(/class="pick pick--launcher"/g) || []).length === 4
);

r.check(
	"prerendered rows do not carry the load-time enter animation",
	!body.includes("mod--enter"),
	body.includes("mod--enter") ? "mod--enter leaked into the prerendered markup" : "none present"
);

r.check(
	"the document is minified",
	html.indexOf("\n") === -1,
	`${html.length} bytes, ${(html.match(/\n/g) || []).length} newlines`
);

process.exit(r.finish());
