/**
 * Layout under translation. English is the shortest locale; German, Russian and
 * Spanish are not. A page that fits at 360px in English can overflow in
 * Russian, and check-layout.mjs only ever sees English.
 *
 * So this runs the same overflow probe as check-layout.mjs, in every locale,
 * at the narrowest widths, with the mod list expanded so the longest mod names
 * and the longest toolbar labels are on screen.
 *
 * Run: pnpm --dir website run check:layout-i18n -- [url]
 */

import { withSite, launchBrowser, openPage, reporter } from "./harness.mjs";

const { check, finish } = reporter();

const WIDTHS = [360, 390, 768];

/* Same probe as check-layout, minus the metrics that only mean something in
   English. The wrapping check is the interesting one: a button whose text
 * wraps is a layout bug even when the box stays inside the viewport. */
const PROBE = `(() => {
	const vw = document.documentElement.clientWidth;
	const scrolls = (el) => {
		const ox = getComputedStyle(el).overflowX;
		return ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip';
	};
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
			let a = el.parentElement, inScroller = false;
			while (a && a !== document.body) { if (scrolls(a)) { inScroller = true; break; } a = a.parentElement; }
			if (!inScroller) {
				over.push(el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0]
					+ ' [L' + Math.round(r.left) + ' R' + Math.round(r.right) + ']');
			}
		}
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
	// The two controls that carry the most copy: the "show all" button and
	// the mod browser toolbar.
	const wrap = (sel) => {
		const el = document.querySelector(sel);
		return el ? el.scrollHeight > el.clientHeight + 1 : false;
	};
	// The language popover has to fit the viewport too, and it is the one
	// element whose anchor moves: it hangs off the trigger, and the trigger is
	// the last control in the bar on desktop but the first of three on a
	// phone, so the edge it should grow from is not the same at both.
	const menu = document.getElementById('lang-menu');
	let menuBox = null;
	if (menu && !menu.hidden) {
		const m = menu.getBoundingClientRect();
		menuBox = {
			left: Math.round(m.left),
			right: Math.round(m.right),
			fits: m.left >= -1 && m.right <= vw + 1
		};
	}
	return {
		vw,
		scrollW: document.documentElement.scrollWidth,
		overflow: [...new Set(over)].slice(0, 10),
		clipped: [...new Set(clipped)].slice(0, 10),
		moreWraps: wrap('#more-toggle'),
		// The environment filter is the other control that carries real copy,
		// and unlike the show-all button it is allowed to wrap: three options on
		// one line is the design, so two lines at 360px is not a defect. What
		// must not happen is a label clipped mid-word, which the overflow probe
		// above already covers. Reported for the record rather than asserted.
		segWraps: wrap('.seg'),
		menuBox,
		tabsTall: Math.round(document.querySelector('.tabs').getBoundingClientRect().height)
	};
})()`;

const LOCALES = ["en", "de", "es", "fr", "ru", "zh"];

await withSite(async (url) => {
	const browser = await launchBrowser();
	try {
		for (const locale of LOCALES) {
			for (const width of WIDTHS) {
				const { context, page } = await openPage(browser, url, {
					width,
					height: 900,
					mobile: width < 768,
					locale
				});

				// Expand the list and switch to a group with a long name, so
				// the widest possible toolbar and row content are rendered.
				await page.evaluate(() => {
					document.querySelector('.tab[data-group="qol"]').click();
					const more = document.getElementById("more-toggle");
					if (more.getAttribute("aria-expanded") === "false") more.click();
					// Open the picker too: it is absolutely positioned, so the
					// overflow probe skips it as a fixed element's neighbour and
					// it has to be measured while it is actually on screen.
					document.getElementById("lang-btn").click();
					return true;
				});
				await page.waitForTimeout(350);

				const r = await page.evaluate(PROBE);
				const bad =
					r.scrollW > r.vw + 1 || r.overflow.length || r.clipped.length;
				check(
					`${locale} @ ${width}px holds`,
					!bad,
					bad ? [...r.overflow, ...r.clipped].join(" | ") : `scrollW=${r.scrollW}`
				);
				// The show-all button holds a whole sentence in some locales
				// ("Show all 75 mods"), so a two-line wrap there is a bug.
				check(
					`${locale} @ ${width}px show-all button does not wrap`,
					!r.moreWraps,
					r.moreWraps ? "wrapped" : ""
				);
				check(
					`${locale} @ ${width}px language menu fits the viewport`,
					r.menuBox?.fits === true,
					r.menuBox ? `L${r.menuBox.left} R${r.menuBox.right} vw${r.vw}` : "menu closed"
				);
				// Measured, not asserted: segWraps is allowed to be true (the
				// filter wraps by design at phone widths) and tabsTall grows with
				// translated group names. Logged so a jump in either is visible in
				// the diff of two runs rather than silently different.
				console.log(
					`      ${locale} @ ${width}px  tabs=${r.tabsTall}px  seg=${r.segWraps ? "wrapped" : "one line"}`
				);

				await context.close();
			}
		}
	} finally {
		await browser.close();
	}
}, process.argv[2]);

process.exit(finish() ? 1 : 0);