/**
 * Contrast audit. Walks the rendered page, checks every visible text node
 * against its effective background, and reports anything under WCAG AA
 * (4.5:1 body, 3:1 for text at 24px or larger, or 18.66px bold).
 *
 * Run: pnpm --dir website run check:contrast -- [url]
 */

import { withSite, launchBrowser, openPage } from "./harness.mjs";

const AUDIT = `(() => {
	// getComputedStyle can return color(srgb ...) or oklab(...) for color-mix
	// backgrounds. Anything that is not plain rgb()/rgba() cannot be composited
	// here, so keep walking up to the first ancestor we can resolve.
	const parse = (c) => {
		if (!/^rgba?\\(/.test(c)) return null;
		return (c.match(/[\\d.]+/g) || ['0', '0', '0']).map(Number);
	};
	const alpha = (c) => (c.length > 3 ? c[3] : 1);
	const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
	const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
	const ratio = (a, b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); };
	const over = (fg, bg) => { const a = alpha(fg); return fg.slice(0, 3).map((c, i) => c * a + bg[i] * (1 - a)); };

	const bgOf = (el) => {
		let node = el;
		while (node && node !== document.documentElement) {
			const c = parse(getComputedStyle(node).backgroundColor);
			if (c && alpha(c) > 0.5) return c;
			node = node.parentElement;
		}
		const b = parse(getComputedStyle(document.body).backgroundColor);
		return b && alpha(b) > 0.5 ? b : [12, 14, 10, 1];
	};

	const fails = [];
	const seen = new Set();
	for (const el of document.querySelectorAll('body *')) {
		const direct = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1);
		if (!direct) continue;
		const r = el.getBoundingClientRect();
		if (r.width < 2 || r.height < 2) continue;
		const cs = getComputedStyle(el);
		if (cs.visibility === 'hidden' || Number(cs.opacity) === 0) continue;
		const fgRaw = parse(cs.color);
		if (!fgRaw) continue;
		const bg = bgOf(el);
		const fg = over(fgRaw, bg.slice(0, 3));
		const size = parseFloat(cs.fontSize);
		const weight = parseInt(cs.fontWeight, 10) || 400;
		const large = size >= 24 || (size >= 18.66 && weight >= 700);
		const need = large ? 3 : 4.5;
		const got = ratio(fg, bg.slice(0, 3));
		if (got < need) {
			const key = el.tagName + '.' + el.className + cs.color;
			if (seen.has(key)) continue;
			seen.add(key);
			fails.push({
				sel: el.tagName.toLowerCase() + '.' + String(el.className).split(' ').filter(Boolean).join('.'),
				text: el.textContent.trim().slice(0, 40),
				color: cs.color, bg: 'rgb(' + bg.slice(0,3).map(Math.round).join(',') + ')',
				size, weight, ratio: Math.round(got * 100) / 100, need
			});
		}
	}
	return fails;
})()`;

let bad = 0;

await withSite(async (url) => {
	const browser = await launchBrowser();
	try {
		for (const theme of ["dark", "light"]) {
			const { context, page } = await openPage(browser, url, {
				width: 1280,
				height: 900,
				theme
			});

			// Cover every tab group and the empty state too.
			await page.evaluate(
				`document.querySelectorAll('.tab').forEach(t => t.click()); true`
			);
			await page.waitForTimeout(300);
			await page.evaluate(
				`(() => { const i = document.getElementById('search'); i.value = 'sodium'; i.dispatchEvent(new Event('input', {bubbles:true})); return true; })()`
			);
			await page.waitForTimeout(300);
			await page.evaluate(
				`(() => { const i = document.getElementById('search'); i.value = ''; i.dispatchEvent(new Event('input', {bubbles:true})); i.blur(); return true; })()`
			);
			await page.waitForTimeout(400);

			// Walk every wizard branch, which ends on the one with a command block,
			// plus one older version, so the copy button and its label get audited.
			await page.evaluate(
				`document.querySelectorAll('#wiz-launchers .pick').forEach(b => b.click()); true`
			);
			await page.evaluate(
				`(() => { const v = document.querySelectorAll('#wiz-versions .pick')[1]; v.click(); return true; })()`
			);
			await page.waitForTimeout(400);

			const fails = await page.evaluate(AUDIT);
			console.log(`\n--- ${theme} ---`);
			if (!fails.length) console.log("all text passes WCAG AA");
			for (const f of fails) {
				bad++;
				console.log(
					`  ${f.ratio}:1 (needs ${f.need})  ${f.sel}  ${f.size}px/${f.weight}  ${f.color} on ${f.bg}  "${f.text}"`
				);
			}

			await context.close();
		}
	} finally {
		await browser.close();
	}
}, process.argv[2]);

console.log(
	bad ? `\n${bad} contrast failure(s)` : "\ncontrast clean in both themes"
);
process.exit(bad ? 1 : 0);
