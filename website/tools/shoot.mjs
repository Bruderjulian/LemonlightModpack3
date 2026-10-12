/**
 * Screenshots the homepage at exact CSS viewports, full page.
 *
 * Playwright sizes the layout viewport directly, which is what the old
 * Chrome --window-size flag failed to do.
 *
 * Run: pnpm --dir website run shoot -- [outDir] [url]
 */

import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { withSite, launchBrowser, openPage } from "./harness.mjs";

// Anchored to the site directory rather than process.cwd(): every other tool
// resolves its paths this way, and this one silently wrote its output
// somewhere else depending on where the command happened to be run from.
const siteDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = process.argv[2] || join(siteDir, "shots");
const URL_UNDER_TEST = process.argv[3];

const SHOTS = [
	{ name: "desktop-dark", width: 1440, height: 900, theme: "dark" },
	{ name: "desktop-light", width: 1440, height: 900, theme: "light" },
	{ name: "mobile", width: 390, height: 844, theme: "dark", mobile: true },
	{
		name: "mobile-light",
		width: 390,
		height: 844,
		theme: "light",
		mobile: true
	},
	// One shot per non-English locale, plus one with the picker open. Copy
	// length is the thing a screenshot catches that a box measurement does
	// not: a heading that wraps to four lines, a tab row that runs to three
	// rows, a wizard step that no longer reads as a list.
	{ name: "locale-de", width: 1440, height: 900, theme: "dark", locale: "de" },
	{ name: "locale-ru", width: 1440, height: 900, theme: "dark", locale: "ru" },
	{ name: "locale-zh", width: 1440, height: 900, theme: "dark", locale: "zh" },
	{
		name: "locale-ru-mobile",
		width: 390,
		height: 844,
		theme: "dark",
		mobile: true,
		locale: "ru"
	},
	{ name: "lang-menu", width: 1440, height: 900, theme: "dark", openMenu: true },
	{
		name: "lang-menu-light",
		width: 1440,
		height: 900,
		theme: "light",
		openMenu: true
	}
];

mkdirSync(OUT, { recursive: true });

await withSite(async (url) => {
	const browser = await launchBrowser();
	try {
		for (const shot of SHOTS) {
			const { context, page } = await openPage(browser, url, {
				width: shot.width,
				height: shot.height,
				mobile: Boolean(shot.mobile),
				theme: shot.theme,
				locale: shot.locale || "en"
			});

			// Trigger every reveal, otherwise lazy sections capture invisible.
			await page.evaluate(`document.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('is-in'));
			                     document.getElementById('p-bars').classList.add('is-in');
			                     document.querySelectorAll('.mod__icon[loading]').forEach(i => i.loading = 'eager');`);
			await page.waitForTimeout(900);

			const path = join(OUT, `${shot.name}.png`);
			// The picker shots are of the nav, not the whole page: it is a
			// popover, so a full-page capture would show it pinned to the top
			// of a very long scroll with nothing else in frame.
			if (shot.openMenu) {
				await page.evaluate(`document.getElementById('lang-btn').click(); true`);
				await page.waitForTimeout(150);
				await page.screenshot({
					path,
					clip: { x: 0, y: 0, width: shot.width, height: 260 }
				});
				console.log(`${shot.name}  nav  ${path}`);
				await context.close();
				continue;
			}
			await page.screenshot({ path, fullPage: true });

			const { width, height } = await page.evaluate(() => ({
				width: document.documentElement.scrollWidth,
				height: document.documentElement.scrollHeight
			}));
			console.log(`${shot.name}  ${width}x${height}  ${path}`);

			await context.close();
		}
	} finally {
		await browser.close();
	}
}, URL_UNDER_TEST);
