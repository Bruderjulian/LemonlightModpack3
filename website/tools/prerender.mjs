/**
 * Writes the default state of the page into dist/index.html.
 *
 * Everything a reader or a crawler actually cares about — the mod list, the
 * group chips, the hero numbers, the install wizard — is built by main.js at
 * runtime. A crawler that does not execute JavaScript sees a page with none of
 * it, and so does anyone whose script fails. This step closes that gap by
 * running the real page in a real browser, capturing the DOM the real code
 * produced, and writing it back into the document.
 *
 * The important property is that this is *not* a second implementation of the
 * render. There is no template here and no copy of the filtering logic. The
 * markup is captured from a live render of the shipped bundle, so it cannot
 * drift from what a browser would produce; if it did, main.js would adopt it on
 * load and immediately show something wrong.
 *
 * Adoption, on the other side, is one attribute. main.js stamps
 * data-prerender on #mod-list with a key describing the state it just rendered;
 * this tool copies that key verbatim. On load, if the query string describes the
 * same state, the first render is skipped and the markup already in the
 * document is used. Any parameter at all, ?lang=ru included, produces a
 * different key and the normal path runs.
 *
 * Runs after `vite build` and `build-og.mjs`:
 *
 *   node tools/prerender.mjs
 *
 * It also re-minifies the document, because the HTML minifier has to run after
 * the injection rather than before it. That is why tools/minify-html.mjs is
 * shared with vite.config.js instead of being a build hook of its own.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { minifyHtml } from "./minify-html.mjs";

const siteDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(siteDir, "dist");
const htmlPath = join(distDir, "index.html");

if (!existsSync(htmlPath)) {
	console.error("dist/index.html does not exist. Run the build first.");
	process.exit(1);
}

/* ---------- a static server for dist, on an ephemeral port ---------- */

const MIME = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json",
	".webp": "image/webp",
	".png": "image/png",
	".jpg": "image/jpeg",
	".svg": "image/svg+xml",
	".xml": "application/xml",
	".txt": "text/plain; charset=utf-8"
};

const server = createServer((req, res) => {
	const path = decodeURIComponent(req.url.split("?")[0]);
	const file = join(distDir, path === "/" ? "index.html" : path);
	if (!file.startsWith(distDir) || !existsSync(file)) {
		res.writeHead(404).end("not found");
		return;
	}
	res.writeHead(200, { "content-type": MIME[extname(file)] ?? "application/octet-stream" });
	res.end(readFileSync(file));
});

await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const port = server.address().port;
const url = `http://127.0.0.1:${port}/`;

/* ---------- capture the rendered default state ---------- */

const original = readFileSync(htmlPath, "utf8");

const browser = await chromium.launch();
let fragments;
try {
	const context = await browser.newContext({
		// English with no stored choice, which is what a first-time visitor has.
		// Anything else would prerender a locale that does not match the markup.
		locale: "en-US"
	});
	const page = await context.newPage();
	await page.goto(url, { waitUntil: "load" });
	// The list is built by a module script, so `load` can fire before the rows
	// exist. Waiting on a row is the honest signal that the page is ready.
	await page.waitForSelector(".mod", { timeout: 20000 });
	await page.evaluate(() => document.fonts.ready);
	// The group bars grow in over two frames; capturing before that would
	// freeze them at scaleX(0).
	await page.waitForFunction(() =>
		document.getElementById("p-bars")?.classList.contains("is-in")
	);

	fragments = await page.evaluate(() => {
		const inner = (sel) => document.querySelector(sel)?.innerHTML ?? "";
		const text = (sel) => document.querySelector(sel)?.textContent ?? "";
		return {
			tabs: inner("#tabs"),
			list: inner("#mod-list"),
			bars: inner("#p-bars"),
			versionsList: inner("#p-versions-list"),
			launchers: inner("#wiz-launchers"),
			versions: inner("#wiz-versions"),
			out: inner("#wiz-out"),
			// The state key is copied from the page rather than reconstructed
			// here. Two places agreeing on the format of this string is exactly
			// the bug this avoids.
			stateKey: document.getElementById("mod-list")?.dataset.prerender ?? "",
			pTotal: text("#p-total"),
			pCurated: text("#p-curated"),
			pVersions: text("#p-versions"),
			pVer: text("#p-ver"),
			footVer: text("#foot-ver")
		};
	});
	await context.close();
} catch (err) {
	await browser.close();
	server.close();
	console.error(`prerender: could not read the rendered page\n${err}`);
	process.exit(1);
}

if (!fragments.stateKey) {
	await browser.close();
	server.close();
	console.error("the page did not stamp data-prerender on #mod-list; is main.js up to date?");
	process.exit(1);
}
/* ---------- rebuild the document with those fragments in place ---------- */

// Script tags are pulled out before the surgery so nothing re-renders the very
// containers being captured, and put back afterwards. Anything not captured
// would otherwise be lost, and a document with no script is a dead site.
const headScripts = (original.match(/<head>[\s\S]*?<\/head>/)?.[0].match(/<script[\s\S]*?<\/script>/g) ?? []);
const bodyMatch = /<body>[\s\S]*?<\/body>/.exec(original);
const bodyScripts = bodyMatch?.[0].match(/<script[\s\S]*?<\/script>/g) ?? [];

// A canvas with no scripts to run. It has the same structure as the real
// document, so the surgery below lands on the same nodes.
const canvas = original.replace(/<script[\s\S]*?<\/script>/g, "");

const surgeryPage = await browser.newPage();
await surgeryPage.setContent(canvas, { waitUntil: "domcontentloaded" });

const stitched = await surgeryPage.evaluate((f) => {
	const set = (sel, html) => {
		const el = document.querySelector(sel);
		if (el) el.innerHTML = html;
	};

	set("#tabs", f.tabs);
	set("#mod-list", f.list);
	set("#p-bars", f.bars);
	set("#p-versions-list", f.versionsList);
	set("#wiz-launchers", f.launchers);
	set("#wiz-versions", f.versions);
	set("#wiz-out", f.out);

	// The bars are hidden by scaleX(0) until .is-in lands, and nothing in the
	// document adds it on its own. Prerendered, they have to arrive already
	// grown or they render as four empty tracks.
	document.getElementById("p-bars")?.classList.add("is-in");

	for (const [sel, value] of [
		["#p-total", f.pTotal],
		["#p-curated", f.pCurated],
		["#p-versions", f.pVersions],
		["#p-ver", f.pVer],
		["#foot-ver", f.footVer]
	]) {
		const el = document.querySelector(sel);
		if (el && value) el.textContent = value;
	}

	/* Drop the load-time row cascade. Those rows were never absent from the
	   document, so animating them in on load is pure cost.
	   Done through the DOM rather than by rewriting the HTML string: an earlier
	   version regexed over the markup and produced class="mod " "="" , which
	   html-minifier then correctly refused to parse. Removing a class or a
	   custom property cannot corrupt the surrounding syntax the way a string
	   substitution can. */
	const list = document.getElementById("mod-list");
	if (list) {
		for (const el of list.querySelectorAll(".mod--enter")) el.classList.remove("mod--enter");
		for (const el of list.querySelectorAll("[style*='--i']")) {
			el.style.removeProperty("--i");
			// An emptied style attribute is left behind otherwise, and it is
			// noise in the served document.
			if (!el.getAttribute("style")) el.removeAttribute("style");
		}
		list.dataset.prerender = f.stateKey;
	}

	return document.documentElement.outerHTML;
}, fragments);

await surgeryPage.close();
await browser.close();
server.close();

// document.documentElement.outerHTML does not include the doctype, and a
// document without one is in quirks mode: every box model and every width
// calculation changes. It has to be put back by hand.
const withScripts = `<!DOCTYPE html>${stitched}`
	.replace("</head>", `${headScripts.join("")}</head>`)
	.replace("</body>", `${bodyScripts.join("")}</body>`);

const final = await minifyHtml(withScripts);
writeFileSync(htmlPath, final);

const rows = (final.match(/class="mod[ "]/g) || []).length;
console.log(
	`prerendered: ${rows} mod rows, ${(final.match(/class="tab"/g) || []).length} group chips, ` +
		`wizard ${(final.match(/class="pick pick--launcher"/g) || []).length} launchers -> ` +
		`index.html ${(final.length / 1024).toFixed(1)} kB`
);
console.log(`state key: ${fragments.stateKey}`);
