/**
 * Shared browser harness for the checks. Every tool drives the same bundled
 * Chromium through Playwright instead of shelling out to a system Chrome, so
 * the checks behave the same on Windows, Linux and CI.
 *
 * Also owns the dev server, so no tool needs a terminal window open next to it.
 */

import { createServer } from "vite";
import { chromium } from "playwright";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const siteDir = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Starts the Vite dev server unless a URL is passed in, runs `body` against it
 * and always tears the server down again.
 *
 * Passing a URL (for example to check a deployed build) skips the server and
 * points the browser at that instead.
 */
export async function withSite(body, url) {
	if (url) return body(url);

	const server = await createServer({ root: siteDir, logLevel: "warn" });
	await server.listen();
	const address = server.resolvedUrls?.local?.[0];
	if (!address) {
		await server.close();
		throw new Error("vite did not report a local url");
	}
	try {
		return await body(address);
	} finally {
		await server.close();
	}
}

/** Launches Chromium once. The caller closes it. */
export const launchBrowser = () =>
	chromium.launch({
		// Headless Chromium composites and rasterises on the CPU, which is
		// what these checks want: no GPU is needed to measure layout.
		args: ["--disable-gpu", "--hide-scrollbars", "--font-render-hinting=none"]
	});

/**
 * Opens the page and waits until the mod list has actually rendered.
 *
 * The list is built by a module script, so `load` can fire before the rows
 * exist. Waiting on the first row is the honest signal that the page is ready.
 */
export async function openPage(
	browser,
	url,
	{ width = 1280, height = 900, mobile = false, theme, locale = "en" } = {}
) {
	const context = await browser.newContext({
		viewport: { width, height },
		deviceScaleFactor: 1,
		// isMobile flips touch and meta-viewport handling, which is what actually
		// distinguishes the mobile layout from a narrow desktop one.
		isMobile: mobile,
		hasTouch: mobile,
		// The page honours navigator.languages, so without this the checks
		// would assert English against whatever the CI machine is set to.
		locale,
		// Same reasoning for Accept-Language, which is what a browser sends
		// ahead of the in-page match.
		extraHTTPHeaders: { "Accept-Language": `${locale},en;q=0.9` }
	});

	// Pin the theme before any page script reads it from storage.
	if (theme) {
		await context.addInitScript((t) => {
			try {
				localStorage.setItem("zitrus-theme", t);
			} catch {}
		}, theme);
	}

	// Same for the language. The checks assert English copy, so the locale is
	// pinned rather than discovered; check-i18n.mjs is where the other five
	// dictionaries get exercised.
	await context.addInitScript((l) => {
		try {
			localStorage.setItem("zitrus-lang", l);
		} catch {}
	}, locale);

	const page = await context.newPage();
	await page.goto(url, { waitUntil: "load" });
	await page.waitForSelector(".mod", { timeout: 15000 });
	await page.evaluate(() => document.fonts.ready);
	return { context, page };
}

/** Small assertion recorder, so every tool reports the same way. */
export function reporter() {
	const results = [];

	return {
		check(name, pass, detail = "") {
			results.push({ name, pass: Boolean(pass), detail: String(detail) });
		},
		finish() {
			const failed = results.filter((r) => !r.pass);
			for (const r of results) {
				const mark = r.pass ? "PASS" : "FAIL";
				// Failures are the whole reason this line exists, so they get
				// room; passing checks stay short.
				const limit = r.pass ? 100 : 400;
				const tail = r.detail ? `  (${r.detail.slice(0, limit)})` : "";
				console.log(`${mark}  ${r.name}${tail}`);
			}
			const summary = failed.length
				? `\n${failed.length} of ${results.length} checks failing`
				: `\nall ${results.length} checks pass`;
			console.log(summary);
			return failed.length;
		}
	};
}
