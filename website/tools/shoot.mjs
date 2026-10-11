/**
 * Screenshots the homepage at exact CSS viewports, full page.
 *
 * Playwright sizes the layout viewport directly, which is what the old
 * Chrome --window-size flag failed to do.
 *
 * Run: pnpm --dir website run shoot -- [outDir] [url]
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { withSite, launchBrowser, openPage } from "./harness.mjs";

const OUT = process.argv[2] || join(process.cwd(), "shots");
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
				theme: shot.theme
			});

			// Trigger every reveal, otherwise lazy sections capture invisible.
			await page.evaluate(`document.querySelectorAll('[data-reveal]').forEach(e => e.classList.add('is-in'));
			                     document.getElementById('p-bars').classList.add('is-in');
			                     document.querySelectorAll('.mod__icon[loading]').forEach(i => i.loading = 'eager');`);
			await page.waitForTimeout(900);

			const path = join(OUT, `${shot.name}.png`);
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
