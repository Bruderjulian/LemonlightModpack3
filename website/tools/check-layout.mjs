/**
 * Layout check: loads the homepage at several widths and reports any element
 * whose box escapes the viewport, plus a few page metrics.
 *
 * Run: pnpm --dir website run check:layout -- [url]
 */

import { withSite, launchBrowser, openPage } from "./harness.mjs";

const WIDTHS = [360, 390, 768, 1024, 1280, 1440];

const PROBE = `(() => {
	const vw = document.documentElement.clientWidth;
	const scrolls = (el) => {
		const ox = getComputedStyle(el).overflowX;
		return ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip';
	};
	// overflow:hidden clips without a scrollbar. Content that runs past such
	// an ancestor's box is cut off, which is a bug, not a scroll affordance.
	const clips = (el) => {
		const ox = getComputedStyle(el).overflowX;
		return ox === 'hidden' || ox === 'clip';
	};
	const over = [];
	const clipped = [];
	for (const el of document.querySelectorAll('body *')) {
		const r = el.getBoundingClientRect();
		if (r.width === 0 && r.height === 0) continue;
		if (getComputedStyle(el).position === 'fixed') continue;
		if (r.right > vw + 1 || r.left < -1) {
			// An element that lives inside its own scroll container is fine.
			let a = el.parentElement, inScroller = false;
			while (a && a !== document.body) { if (scrolls(a)) { inScroller = true; break; } a = a.parentElement; }
			if (!inScroller) {
				over.push(el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0]
					+ ' [L' + Math.round(r.left) + ' R' + Math.round(r.right) + ']');
			}
		}
		// Cut off by a clipping ancestor even if it stays inside the viewport.
		let a = el.parentElement;
		while (a && a !== document.body) {
			if (clips(a)) {
				const c = a.getBoundingClientRect();
				if (r.right > c.right + 1 || r.left < c.left - 1) {
					clipped.push(el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0]
						+ ' [L' + Math.round(r.left) + ' R' + Math.round(r.right)
						+ ' clip ' + Math.round(c.left) + '-' + Math.round(c.right) + ']');
				}
				break;
			}
			a = a.parentElement;
		}
	}
	const nav = document.querySelector('.nav__in');
	// A button whose text wraps is a layout bug at that width even though the
	// box technically stays inside the viewport.
	const wrapping = [...document.querySelectorAll('.btn')]
		.filter(b => b.scrollHeight > b.clientHeight + 1)
		.map(b => b.textContent.trim());
	return {
		vw,
		scrollW: document.documentElement.scrollWidth,
		overflow: [...new Set(over)].slice(0, 12),
		clipped: [...new Set(clipped)].slice(0, 12),
		navH: Math.round(nav ? nav.getBoundingClientRect().height : 0),
		mods: document.querySelectorAll('.mod').length,
		count: document.getElementById('browser-count')?.textContent,
		total: document.getElementById('p-total')?.textContent,
		wrapping
	};
})()`;

let failures = 0;

await withSite(async (url) => {
	const browser = await launchBrowser();
	try {
		for (const width of WIDTHS) {
			// A fresh context per width, because isMobile and the viewport are
			// fixed at context creation in Playwright.
			const { context, page } = await openPage(browser, url, {
				width,
				height: 900,
				mobile: width < 768
			});

			const r = await page.evaluate(PROBE);
			const bad =
				r.scrollW > r.vw + 1 ||
				r.overflow.length ||
				r.clipped.length ||
				r.wrapping.length;
			if (bad) failures++;

			console.log(
				`${String(width).padStart(4)}px  scrollW=${String(r.scrollW).padStart(4)}  ` +
					`mods=${String(r.mods).padStart(2)}  nav=${r.navH}  ${r.count || ""}  ` +
					(bad
						? `PROBLEM: ${[...r.overflow, ...r.clipped, ...r.wrapping].join(" | ")}`
						: "ok")
			);

			await context.close();
		}
	} finally {
		await browser.close();
	}
}, process.argv[2]);

console.log(
	failures ? `\n${failures} layout problem(s)` : "\nlayout clean at all widths"
);
process.exit(failures ? 1 : 0);
