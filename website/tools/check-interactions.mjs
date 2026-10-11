/**
 * Interaction smoke test for the homepage: theme toggle, group tabs, search,
 * URL filter state, the empty state, show more/less, hero bars, the install
 * wizard, the scroll spy, copy buttons and the mobile drawer.
 *
 * Run: pnpm --dir website run check:interactions -- [url]
 */

import { withSite, launchBrowser, openPage, reporter } from "./harness.mjs";

const { check, finish } = reporter();

await withSite(async (url) => {
	const browser = await launchBrowser();
	try {
		const { context, page } = await openPage(browser, url, {
			width: 1280,
			height: 900
		});
		const evalJs = (expression) => page.evaluate(expression);

		// Tabs
		const tabTest = await evalJs(`(async () => {
			const out = [];
			for (const t of document.querySelectorAll('.tab')) {
				t.click();
				await new Promise(r => setTimeout(r, 60));
				out.push({
					group: t.dataset.group,
					rows: document.querySelectorAll('.mod').length,
					selected: t.getAttribute('aria-selected'),
					count: document.getElementById('browser-count').textContent,
					search: location.search
				});
			}
			return out;
		})()`);
		check(
			"group tabs filter the list",
			tabTest.length === 5 &&
				tabTest.every((t) => t.selected === "true") &&
				tabTest.find((t) => t.group === "visuals").rows === 11 &&
				tabTest.find((t) => t.group === "tweaks").rows === 8 &&
				tabTest[0].rows === 12,
			JSON.stringify(tabTest.map((t) => `${t.group}:${t.rows}`))
		);
		check(
			"filter state lands in the URL",
			tabTest.find((t) => t.group === "performance").search ===
				"?group=performance",
			tabTest.find((t) => t.group === "performance").search
		);

		// Search
		const searchTest = await evalJs(`(async () => {
			const inp = document.getElementById('search');
			const wait = () => new Promise(r => setTimeout(r, 180));
			document.querySelector('.tab[data-group="all"]').click();
			await wait();
			inp.value = 'sodium';
			inp.dispatchEvent(new Event('input', {bubbles:true}));
			await wait();
			const hit = {
				rows: document.querySelectorAll('.mod').length,
				names: [...document.querySelectorAll('.mod__name a')].map(a => a.textContent),
				count: document.getElementById('browser-count').textContent,
				clearVisible: document.getElementById('search-wrap').dataset.filled
			};
			inp.value = 'zzzznotamod';
			inp.dispatchEvent(new Event('input', {bubbles:true}));
			await wait();
			const empty = {
				rows: document.querySelectorAll('.mod').length,
				hasEmpty: !!document.querySelector('.empty'),
				text: document.querySelector('.empty')?.textContent.trim().slice(0, 60)
			};
			document.getElementById('empty-reset')?.click();
			await wait();
			const after = {
				rows: document.querySelectorAll('.mod').length,
				inp: inp.value,
				url: location.search
			};
			return { hit, empty, after };
		})()`);
		check(
			"search matches names and blurbs",
			searchTest.hit.rows > 0 &&
				searchTest.hit.names.some((n) => /sodium/i.test(n)),
			JSON.stringify(searchTest.hit.names)
		);
		check(
			"search count reports showing X of Y",
			/Showing \d+ of \d+/.test(searchTest.hit.count),
			searchTest.hit.count
		);
		check(
			"empty state composes and recovers",
			searchTest.empty.rows === 0 &&
				searchTest.empty.hasEmpty &&
				searchTest.after.rows === 12 &&
				searchTest.after.inp === "",
			JSON.stringify(searchTest.empty)
		);
		check(
			"clearing search resets the URL",
			searchTest.after.url === "",
			searchTest.after.url
		);

		// Show more / show less
		const moreTest = await evalJs(`(async () => {
			const wait = (ms = 140) => new Promise(r => setTimeout(r, ms));
			document.querySelector('.tab[data-group="all"]').click();
			await wait();
			const btn = document.getElementById('more-toggle');
			const more = document.getElementById('browser-more');
			const snap = () => ({
				rows: document.querySelectorAll('.mod').length,
				hidden: more.hidden,
				expanded: btn.getAttribute('aria-expanded'),
				label: document.getElementById('more-label').textContent,
				count: document.getElementById('more-count').textContent
			});
			const before = snap();
			btn.click();
			await wait(260);
			const open = snap();
			btn.click();
			await wait(260);
			const closed = snap();

			// A search shows every hit, so the button has nothing to do.
			const inp = document.getElementById('search');
			inp.value = 'sodium';
			inp.dispatchEvent(new Event('input', {bubbles: true}));
			await wait();
			const searching = { rows: document.querySelectorAll('.mod').length, hidden: more.hidden };
			document.getElementById('search-clear').click();
			await wait();

			// A group that already fits needs no button.
			document.querySelector('.tab[data-group="tweaks"]').click();
			await wait();
			const small = { rows: document.querySelectorAll('.mod').length, hidden: more.hidden };
			document.querySelector('.tab[data-group="all"]').click();
			await wait();
			return { before, open, closed, searching, small };
		})()`);
		check(
			"show more reveals the full list and show less puts it back",
			moreTest.before.rows === 12 &&
				moreTest.before.hidden === false &&
				moreTest.before.expanded === "false" &&
				moreTest.before.label === "Show all 87 mods" &&
				moreTest.open.rows === 87 &&
				moreTest.open.expanded === "true" &&
				moreTest.open.label === "Show fewer" &&
				moreTest.closed.rows === 12 &&
				moreTest.closed.expanded === "false",
			JSON.stringify(moreTest)
		);
		check(
			"show more stays out of the way when everything already fits",
			moreTest.searching.hidden === true &&
				moreTest.searching.rows > 0 &&
				moreTest.small.hidden === true &&
				moreTest.small.rows === 8,
			JSON.stringify({ searching: moreTest.searching, small: moreTest.small })
		);

		// Hero group bars drive the same filter as the tabs
		const barTest = await evalJs(`(async () => {
			const wait = () => new Promise(r => setTimeout(r, 160));
			const bar = document.querySelector('.bar[data-group="visuals"]');
			bar.click();
			await wait();
			return {
				rows: document.querySelectorAll('.mod').length,
				tab: document.querySelector('.tab[data-group="visuals"]').getAttribute('aria-selected'),
				pressed: bar.getAttribute('aria-pressed'),
				url: location.search
			};
		})()`);
		check(
			"hero group bars filter the mod list",
			barTest.rows === 11 &&
				barTest.tab === "true" &&
				barTest.pressed === "true" &&
				barTest.url === "?group=visuals",
			JSON.stringify(barTest)
		);

		// Install wizard
		const wizardTest = await evalJs(`(async () => {
			const wait = () => new Promise(r => setTimeout(r, 160));
			const out = () => document.getElementById('wiz-out').textContent.replace(/\\s+/g, ' ').trim();
			const cmd = () => document.querySelector('#wiz-out [data-copy]')?.dataset.copy || '';
			const launchers = [...document.querySelectorAll('#wiz-launchers .pick')];
			const versions = [...document.querySelectorAll('#wiz-versions .pick')];
			const first = out().slice(0, 90);

			launchers[3].click();
			await wait();
			const standalone = cmd();

			versions[1].click();
			await wait();
			const picked = cmd();

			// Arrow keys move inside the group instead of tabbing through every option.
			versions[1].focus();
			versions[1].dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}));
			await wait();
			const viaKey = {
				idx: [...document.querySelectorAll('#wiz-versions .pick')]
					.findIndex(p => p.getAttribute('aria-checked') === 'true'),
				cmd: cmd(),
				tabIndex: document.querySelector('#wiz-versions [aria-checked="true"]').tabIndex,
				otherTabIndex: document.querySelectorAll('#wiz-versions .pick')[0].tabIndex
			};
			return { first, standalone, picked, viaKey, counts: launchers.length + '/' + versions.length };
		})()`);
		check(
			"wizard opens on the latest version with a real result",
			/^Modrinth App \S+ 26\.3/.test(wizardTest.first) &&
				wizardTest.counts === "4/6",
			wizardTest.first
		);
		check(
			"picking a launcher and version rewrites the install",
			/26\.3\/pack\.toml/.test(wizardTest.standalone) &&
				/1\.21\.1\/pack\.toml/.test(wizardTest.picked),
			`${wizardTest.standalone} | ${wizardTest.picked}`
		);
		check(
			"wizard groups use arrow keys and one tab stop",
			wizardTest.viaKey.idx === 2 &&
				/1\.21\.11\/pack\.toml/.test(wizardTest.viaKey.cmd) &&
				wizardTest.viaKey.tabIndex === 0 &&
				wizardTest.viaKey.otherTabIndex === -1,
			JSON.stringify(wizardTest.viaKey)
		);

		// Copy button
		const copyTest = await evalJs(`(async () => {
			const btn = document.querySelector('[data-copy]');
			btn.click();
			await new Promise(r => setTimeout(r, 120));
			const label = btn.querySelector('span').textContent;
			const done = btn.dataset.done;
			return { label, done, payload: btn.dataset.copy };
		})()`);
		check(
			"copy button gives feedback",
			copyTest.label === "Copied" && copyTest.done === "true",
			copyTest.label
		);

		// Theme toggle
		const themeTest = await evalJs(`(async () => {
			const root = document.documentElement;
			const before = getComputedStyle(root).getPropertyValue('--bg').trim();
			document.getElementById('theme').click();
			await new Promise(r => setTimeout(r, 120));
			const after = getComputedStyle(root).getPropertyValue('--bg').trim();
			const stored = localStorage.getItem('zitrus-theme');
			const attr = root.dataset.theme;
			document.getElementById('theme').click();
			await new Promise(r => setTimeout(r, 120));
			return { before, after, stored, attr, restored: getComputedStyle(root).getPropertyValue('--bg').trim() };
		})()`);
		check(
			"theme toggle flips and persists",
			themeTest.before !== themeTest.after &&
				themeTest.stored === themeTest.attr &&
				themeTest.restored === themeTest.before,
			JSON.stringify(themeTest)
		);

		// Reveal + bars + scroll spy
		const motionTest = await evalJs(`(async () => {
			document.getElementById('mods').scrollIntoView();
			await new Promise(r => setTimeout(r, 900));
			const onMods = document.querySelector('#nav-links a[href="#mods"]').getAttribute('aria-current');
			document.getElementById('install').scrollIntoView();
			await new Promise(r => setTimeout(r, 900));
			const onInstall = document.querySelector('#nav-links a[href="#install"]').getAttribute('aria-current');
			return {
				revealed: document.querySelectorAll('[data-reveal].is-in').length,
				bars: document.getElementById('p-bars').classList.contains('is-in'),
				onMods,
				onInstall,
				active: document.querySelectorAll('#nav-links a[aria-current]').length
			};
		})()`);
		check(
			"scroll reveal fires",
			motionTest.revealed > 0,
			`${motionTest.revealed} revealed`
		);
		check(
			"hero bars animate in",
			motionTest.bars === true,
			String(motionTest.bars)
		);
		check(
			"scroll spy marks the section in view",
			motionTest.onMods === "true" &&
				motionTest.onInstall === "true" &&
				motionTest.active === 1,
			JSON.stringify({
				onMods: motionTest.onMods,
				onInstall: motionTest.onInstall
			})
		);

		await context.close();

		// Mobile drawer
		const mobile = await openPage(browser, url, {
			width: 390,
			height: 844,
			mobile: true
		});
		const drawerTest = await mobile.page.evaluate(`(async () => {
			const d = document.getElementById('drawer');
			const b = document.getElementById('burger');
			const closed = getComputedStyle(d).display;
			b.click();
			await new Promise(r => setTimeout(r, 80));
			const open = getComputedStyle(d).display;
			const burgerVisible = getComputedStyle(b).display !== 'none';
			document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}));
			await new Promise(r => setTimeout(r, 80));
			return {
				closed,
				open,
				burgerVisible,
				afterEsc: getComputedStyle(d).display,
				expanded: b.getAttribute('aria-expanded')
			};
		})()`);
		check(
			"drawer hidden on desktop, opens on mobile, closes on Escape",
			drawerTest.closed === "none" &&
				drawerTest.open === "block" &&
				drawerTest.burgerVisible &&
				drawerTest.afterEsc === "none",
			JSON.stringify(drawerTest)
		);
		await mobile.context.close();
	} finally {
		await browser.close();
	}
}, process.argv[2]);

process.exit(finish() ? 1 : 0);
