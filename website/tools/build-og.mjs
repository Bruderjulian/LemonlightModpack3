/**
 * Builds the 1200x630 share card that og:image and twitter:image point at.
 *
 * This replaces a TODO that said the card needed real brand art and so could
 * not be shipped yet. Rather than commit a placeholder that socials would
 * render badly, the card is composed from the site's own tokens and its own
 * webfont, so it is on-brand by construction and can be swapped for real
 * artwork later with nothing but this file changed.
 *
 * Rendered in the same Chromium the checks drive, against the *built*
 * stylesheet, so the tokens cannot drift from src/styles.css. Run after
 * `vite build`:
 *
 *   node tools/build-og.mjs
 *
 * PNG and JPEG, not WebP or AVIF: the social scrapers that matter still do not
 * reliably fetch anything else, and a card that renders blank is worse than
 * one that is a few kB too big.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const siteDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(siteDir, "dist");
const pack = JSON.parse(readFileSync(join(siteDir, "src", "data", "mods.json"), "utf8"));

if (!existsSync(distDir)) {
	console.error("dist does not exist. Run the build first.");
	process.exit(1);
}

const assetsDir = join(distDir, "assets");
const cssFile = readdirSync(assetsDir).find((f) => f.endsWith(".css"));
if (!cssFile) {
	console.error("no built stylesheet in dist/assets; cannot read the design tokens.");
	process.exit(1);
}
const css = readFileSync(join(assetsDir, cssFile), "utf8");

/* The same paths the header brand uses, lifted rather than duplicated as
   artwork. Colour is left to CSS so the card picks up the real accent token. */
const MARK = `<svg viewBox="0 -0.6 24 24" fill="none" aria-hidden="true">
	<circle cx="12" cy="13" r="8.5" stroke="var(--accent-display)" stroke-width="1.7" />
	<path d="M12 4.5v8.5M12 13 6.9 16.4M12 13l5.1 3.4" stroke="var(--accent-display)" stroke-width="1.7" />
	<path d="M12 4.5c1.6-1.6 3.6-2 4.8-1.9.2 1.3-.4 3.3-1.9 4.6" stroke="var(--accent-display)" stroke-width="1.7" stroke-linecap="round" />
</svg>`;

const stats = [
	{ n: pack.curated, l: "curated mods" },
	{ n: pack.versions.length, l: "Minecraft versions" },
	{ n: "Fabric", l: "loader, client & server" }
];

const page_html = `<!doctype html>
<html lang="en" data-theme="light">
<head>
<meta charset="utf-8" />
<style>${css}
/* Card frame. Everything below is composition; the colour, the font and the
   mark all come from the stylesheet above. */
* { box-sizing: border-box; margin: 0; }
body {
	width: 1200px; height: 630px; overflow: hidden;
	display: flex; flex-direction: column; justify-content: space-between;
	padding: 72px 80px 64px;
	position: relative;
}
.rule { position: absolute; inset: 0 0 auto 0; height: 14px; background: var(--accent); }
.brand { display: flex; align-items: center; gap: 20px; }
.brand svg { width: 76px; height: 76px; }
.brand b {
	font-family: var(--font-sans); font-size: 84px; font-weight: 620;
	letter-spacing: -0.045em; line-height: 1; color: var(--ink);
}
h1 {
	font-family: var(--font-sans); font-size: 82px; font-weight: 600;
	letter-spacing: -0.04em; line-height: 1.02; color: var(--ink);
	max-width: 14ch;
}
h1 em { font-style: normal; color: var(--accent-display); }
.stats { display: flex; gap: 16px; }
.stat {
	background: var(--tint); border: 1px solid var(--line);
	border-radius: var(--r-card); padding: 18px 30px; min-width: 232px;
}
.stat b {
	display: block; font-family: var(--font-mono); font-size: 36px;
	font-weight: 600; color: var(--ink); line-height: 1.15;
}
.stat span { font-size: 22px; color: var(--ink-2); }
</style>
</head>
<body>
	<div class="rule"></div>
	<div class="brand">${MARK}<b>Zitrus</b></div>
	<h1>Fast <em>by default.</em></h1>
	<div class="stats">
		${stats.map((s) => `<div class="stat"><b>${s.n}</b><span>${s.l}</span></div>`).join("\n\t\t")}
	</div>
</body>
</html>`;

const browser = await chromium.launch();
try {
	const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
	await page.setContent(page_html, { waitUntil: "load" });
	// The card uses the real webfont, so it is not finished painting until the
	// faces have settled. Screenshotting earlier bakes in the fallback metrics
	// and the line breaks shift.
	await page.evaluate(() => document.fonts.ready);
	await page.waitForTimeout(150);

	const png = await page.screenshot({ type: "png" });
	writeFileSync(join(distDir, "og.png"), png);

	const jpeg = await page.screenshot({ type: "jpeg", quality: 88 });
	writeFileSync(join(distDir, "og.jpg"), jpeg);

	console.log(
		`og card: og.png ${(png.length / 1024).toFixed(1)} kB, og.jpg ${(jpeg.length / 1024).toFixed(1)} kB`
	);
} finally {
	await browser.close();
}
