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
					pressed: t.getAttribute('aria-pressed'),
					count: document.getElementById('browser-count').textContent,
					search: location.search
				});
			}
			return out;
		})()`);
		check(
			"group tabs filter the list",
			tabTest.length === 5 &&
				tabTest.every((t) => t.pressed === "true") &&
				tabTest.find((t) => t.group === "visuals").rows === 10 &&
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

		// The icons themselves. A monogram fallback is indistinguishable from a
		// deliberate choice in a screenshot and in the DOM, so a completely
		// broken icon path passed the whole suite: every row still had its name,
		// side tag and blurb. naturalWidth is the only thing that tells the two
		// apart — it is non-zero only for an image the browser really decoded.
		const iconTest = await evalJs(`(async () => {
			const rows = [...document.querySelectorAll('.mod')];
			await Promise.all(rows.map(r => {
				const i = r.querySelector('.mod__icon');
				if (!i || i.tagName !== 'IMG') return null;
				i.loading = 'eager';
				if (i.complete) return null;
				return new Promise(done => {
					i.addEventListener('load', done, {once: true});
					i.addEventListener('error', done, {once: true});
				});
			}));
			return rows.map(r => {
				const i = r.querySelector('.mod__icon');
				const isImg = Boolean(i && i.tagName === 'IMG');
				return {
					name: r.querySelector('.mod__name a')?.textContent || '?',
					intendsIcon: r.dataset.icon !== 'none',
					isImg,
					decoded: isImg && i.naturalWidth > 0,
					src: (isImg && (i.currentSrc || i.src || '') || 'no-img').split('/').pop()
				};
			});
		})()`);
		// Two failure modes: a row that is meant to have an icon but did not
		// decode (the broken-path bug this check exists for), and an icon-less
		// row that points at an image anyway. A mod with no icon upstream — its
		// Modrinth entry has no icon_url, as BadOptimizations does — renders a
		// monogram on purpose and is exempt.
		const badIcons = iconTest.filter((i) => (i.intendsIcon ? !i.decoded : i.isImg));
		check(
			"every icon a row claims decodes; icon-less rows monogram",
			badIcons.length === 0,
			badIcons.length
				? `${badIcons.length} of ${iconTest.length} wrong, e.g. ${badIcons[0].name} (${badIcons[0].src})`
				: `${iconTest.length} rows, ${iconTest.filter((i) => i.intendsIcon).length} decoded, ` +
					`${iconTest.filter((i) => !i.intendsIcon).length} monogram`
		);

		// And the 1x candidate has to exist. If only the 2x is in the srcset the
		// browser still renders correctly, so nothing above would notice, but a
		// 1x phone goes on downloading pixels it will never paint.
		const srcsetTest = await evalJs(`(() => {
			const i = document.querySelector('.mod__icon[srcset]');
			if (!i) return {found: false};
			const set = i.srcset.split(',').map(s => s.trim());
			return {
				found: true,
				candidates: set.length,
				sizes: i.sizes,
				has1x: set.some(s => /\\s1x$/.test(s)),
				has2x: set.some(s => /\\s2x$/.test(s))
			};
		})()`);
		check(
			"icons offer a 1x candidate and declare their real size",
			srcsetTest.found === true &&
				srcsetTest.has1x === true &&
				srcsetTest.has2x === true &&
				srcsetTest.sizes === "34px",
			JSON.stringify(srcsetTest)
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
				// The stray "Showing X of Y" was removed; the button is the
				// only thing left in that row.
				strays: document.querySelectorAll('#browser-more > *:not(button)').length,
				centered: (() => {
					const row = more.getBoundingClientRect();
					const b = btn.getBoundingClientRect();
					return Math.abs(row.left + row.width / 2 - (b.left + b.width / 2)) < 1.5;
				})()
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
				moreTest.before.label === "Show all 73 mods" &&
				moreTest.open.rows === 73 &&
				moreTest.open.expanded === "true" &&
				moreTest.open.label === "Show fewer" &&
				moreTest.closed.rows === 12 &&
				moreTest.closed.expanded === "false" &&
				moreTest.before.strays === 0 &&
				moreTest.before.centered,
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
				chip: document.querySelector('.tab[data-group="visuals"]').getAttribute('aria-pressed'),
				pressed: bar.getAttribute('aria-pressed'),
				url: location.search
			};
		})()`);
		check(
			"hero group bars filter the mod list",
			barTest.rows === 10 &&
				barTest.chip === "true" &&
				barTest.pressed === "true" &&
				barTest.url === "?group=visuals",
			JSON.stringify(barTest)
		);

		// Environment and addon filters
	const filterTest = await evalJs(`(async () => {
		const wait = (ms = 220) => new Promise(r => setTimeout(r, ms));
		const count = () => document.getElementById('browser-count').textContent;
		const sideTags = () => [...document.querySelectorAll('.mod__side')].map(t => t.dataset.side);
		const click = async (sel) => { document.querySelector(sel).click(); await wait(); };

		// The hero-bar test above leaves the group on visuals; start from All so
		// these assertions are about the environment filter and nothing else.
		await click('.tab[data-group="all"]');

		// Every row is tagged, whichever side it runs on.
		const tagged = [...document.querySelectorAll('.mod:not([data-orphan]) .mod__name > .mod__side')];
		const base = {
			count: count(),
			url: location.search,
			chips: document.querySelectorAll('.mod__addons li').length,
			rows: document.querySelectorAll('.mod').length,
			tagged: tagged.length,
			labels: [...new Set(tagged.map(t => t.textContent))].sort()
		};

		// Client means client or both, so a both-side mod stays visible.
		await click('.seg__btn[data-env="client"]');
		const client = {
			count: count(),
			url: location.search,
			rows: document.querySelectorAll('.mod').length,
			tags: [...new Set(sideTags())].sort(),
			checked: document.querySelector('.seg__btn[data-env="client"]').getAttribute('aria-checked')
		};

		await click('.seg__btn[data-env="server"]');
		const server = { count: count(), tags: [...new Set(sideTags())].sort(), url: location.search };

		// Arrow keys move between the three options.
		document.querySelector('.seg__btn[data-env="server"]').focus();
		document.querySelector('.seg__btn[data-env="server"]')
			.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowRight', bubbles: true}));
		await wait();
		const viaKey = {
			env: document.querySelector('#env-filter [aria-checked="true"]').dataset.env,
			tabIndex: document.querySelector('#env-filter [aria-checked="true"]').tabIndex,
			otherTabIndex: document.querySelector('.seg__btn[data-env="client"]').tabIndex
		};

		await click('.seg__btn[data-env="both"]');
		await click('.toggle[data-addons]');
		const noAddons = {
			count: count(),
			chips: document.querySelectorAll('.mod__addons li').length,
			url: location.search,
			pressed: document.querySelector('.toggle[data-addons]').getAttribute('aria-pressed')
		};

		await click('.toggle[data-addons]');
		const restored = {
			count: count(),
			chips: document.querySelectorAll('.mod__addons li').length,
			url: location.search
		};
		return { base, client, server, viaKey, noAddons, restored };
	})()`);
	check(
		"every mod row carries a side tag",
		filterTest.base.tagged === filterTest.base.rows &&
			filterTest.base.labels.length === 2 &&
			filterTest.base.labels.includes("Client & Server"),
		JSON.stringify({ rows: filterTest.base.rows, tagged: filterTest.base.tagged, labels: filterTest.base.labels })
	);
	check(
		"environment filter picks one environment and keeps both-side mods",
		filterTest.client.count === "70 mods" &&
			filterTest.client.url === "?side=client" &&
			filterTest.client.checked === "true" &&
			filterTest.client.tags.length === 2 &&
			filterTest.client.tags.includes("client") &&
			filterTest.client.tags.includes("both") &&
			!filterTest.client.tags.includes("server"),
		JSON.stringify(filterTest.client)
	);
	check(
		"server filter drops the client-only mods",
		filterTest.server.count === "67 mods" &&
			// Only the first page renders, so this checks what must be gone
			// rather than what must be there.
			!filterTest.server.tags.includes("client") &&
			filterTest.server.tags.includes("both"),
		JSON.stringify(filterTest.server)
	);
	check(
		"environment filter is a single-choice group with arrow keys",
		filterTest.viaKey.env === "both" &&
			filterTest.viaKey.tabIndex === 0 &&
			filterTest.viaKey.otherTabIndex === -1,
		JSON.stringify(filterTest.viaKey)
	);
	check(
		"hide addons strips the addon chips and back again",
		filterTest.noAddons.chips === 0 &&
			filterTest.noAddons.pressed === "true" &&
			filterTest.noAddons.url === "?addons=hide" &&
			filterTest.base.chips > 0 &&
			filterTest.restored.chips === filterTest.base.chips &&
			filterTest.restored.url === "",
		JSON.stringify({ base: filterTest.base.chips, noAddons: filterTest.noAddons, restored: filterTest.restored })
	);

	// Ordering: downloads by default, relevance on request
	const sortTest = await evalJs(`(async () => {
		const wait = (ms = 160) => new Promise(r => setTimeout(r, ms));
		const reads = () => [...document.querySelectorAll('.mod')].map(r => +r.dataset.downloads);
		const groups = () => [...document.querySelectorAll('.mod')].map(r => r.dataset.group);

		document.querySelector('.tab[data-group="all"]').click();
		await wait();
		const downloads = reads();
		const desc = downloads.every((d, i) => i === 0 || downloads[i - 1] >= d);

		// Relevance is the pack's own group order, so the first card is a
		// performance mod and no group ever reappears after a different one.
		document.querySelector('.sort__btn[data-sort="relevance"]').click();
		await wait();
		// Expand, otherwise the first page is all performance and proves nothing.
		if (document.getElementById('more-toggle').getAttribute('aria-expanded') === 'false') {
			document.getElementById('more-toggle').click();
			await wait(280);
		}
		const rel = groups();
		// Each group must appear in one unbroken run: no performance, visuals,
		// then performance again.
		const firstOfKind = (() => {
			const runs = rel.filter((g, i) => i === 0 || g !== rel[i - 1]);
			return runs.length === new Set(runs).size;
		})();
		const perfFirst = document.querySelector('.sort__btn[data-sort="relevance"]').getAttribute('aria-pressed');

		document.querySelector('.sort__btn[data-sort="downloads"]').click();
		await wait();
		// Back on downloads: descending again, and collapsed to the first page.
		const stillDesc = reads().every((d, i, a) => i === 0 || a[i - 1] >= d);
		return {
			rows: downloads.length,
			desc,
			relevanceGroups: [...new Set(rel)].join(','),
			relevanceRows: rel.length,
			firstOfKind,
			perfFirst,
			stillDesc,
			pressed: document.querySelector('.sort__btn[data-sort="downloads"]').getAttribute('aria-pressed'),
			url: location.search
		};
	})()`);
	check(
		"mod list orders by downloads, then by relevance",
		sortTest.rows === 12 &&
			sortTest.desc &&
			sortTest.relevanceRows === 73 &&
			sortTest.relevanceGroups === "performance,visuals,qol,tweaks" &&
			sortTest.firstOfKind &&
			sortTest.stillDesc &&
			sortTest.perfFirst === "true" &&
			sortTest.pressed === "true" &&
			sortTest.url === "",
		JSON.stringify(sortTest)
	);

	// Addons fold into their parent row instead of getting one of their own
	const addonTest = await evalJs(`(async () => {
		const wait = (ms = 200) => new Promise(r => setTimeout(r, ms));
		document.querySelector('.tab[data-group="all"]').click();
		document.getElementById('more-toggle').click();
		await wait(320);
		const rows = [...document.querySelectorAll('.mod')];
		const sodium = rows.find(r => r.querySelector('.mod__name a')?.textContent === 'Sodium');
		const tagged = rows.filter(r => r.dataset.addons);
		const chips = sodium ? [...sodium.querySelectorAll('.mod__addons li a')].map(a => a.textContent) : [];
		const allChips = [...document.querySelectorAll('.mod__addons li a')].map(a => a.textContent);
		// The count has to live in the title line, not on a line of its own.
		const label = sodium?.querySelector('.mod__name .mod__addons-count')?.textContent;
		const standaloneCounts = rows.filter(r => !r.querySelector('.mod__name .mod__addons-count') && r.querySelector('.mod__addons-count')).length;
		const titleLine = sodium ? [...sodium.querySelectorAll('.mod__name > *')].map(n => n.textContent) : [];
		// An addon must never also appear as a row of its own.
		const names = rows.map(r => r.querySelector('.mod__name a')?.textContent);
		const dupes = chips.filter(c => names.includes(c));
		// The orphaned case: a search that hits an addon but not its parent.
		document.getElementById('more-toggle').click();
		await wait(260);
		const inp = document.getElementById('search');
		inp.value = 'Sodium Shadowy';
		inp.dispatchEvent(new Event('input', {bubbles: true}));
		await wait(260);
		const orphan = [...document.querySelectorAll('.mod')].map(r => ({
			name: r.querySelector('.mod__name a')?.textContent,
			orphan: r.dataset.orphan === 'true'
		}));
		document.getElementById('search-clear').click();
		await wait();
		return { rows: rows.length, parents: tagged.length, chips, allChips, label, standaloneCounts, titleLine, dupes, orphan, count: document.getElementById('browser-count').textContent };
	})()`);
	check(
		"addons fold into their parent row",
		addonTest.rows === 73 &&
			addonTest.parents === 3 &&
			addonTest.allChips.length === 10 &&
			addonTest.chips.length === 4 &&
			addonTest.label === "+ 4 addons" &&
			addonTest.standaloneCounts === 0 &&
			// Tags carry their display case now that every row has one.
			addonTest.titleLine.join(" ") === "Sodium + 4 addons Client" &&
			addonTest.dupes.length === 0 &&
			addonTest.chips.includes("Reese's Sodium Options"),
		JSON.stringify({ rows: addonTest.rows, parents: addonTest.parents, chips: addonTest.chips, allChips: addonTest.allChips.length, label: addonTest.label, titleLine: addonTest.titleLine, standaloneCounts: addonTest.standaloneCounts })
	);
	check(
		"an addon keeps a row when its parent is filtered out",
		addonTest.orphan.length === 1 &&
			addonTest.orphan[0].orphan === true &&
			addonTest.orphan[0].name === "Sodium Shadowy Path Blocks",
		JSON.stringify(addonTest.orphan)
	);

		// Install wizard
		const wizardTest = await evalJs(`(async () => {
			const wait = () => new Promise(r => setTimeout(r, 160));
			const out = () => document.getElementById('wiz-out').textContent.replace(/\\s+/g, ' ').trim();
			const cmd = () => document.querySelector('#wiz-out [data-copy]')?.dataset.copy || '';
			const launchers = [...document.querySelectorAll('#wiz-launchers .pick')];
			const versions = [...document.querySelectorAll('#wiz-versions .pick')];
			const versionOrder = versions.map(v => v.dataset.mc);
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
			// Arrow Left from the newest has to wrap, or it is a dead end.
		versions[0].focus();
		versions[0].dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowLeft', bubbles: true}));
		await wait();
		const wrapped = cmd();
		return { first, standalone, picked, viaKey, wrapped, versionOrder, counts: launchers.length + '/' + versions.length };
		})()`);
		check(
			"wizard versions run newest to oldest",
			wizardTest.versionOrder.join(",") === "26.3,26.2,26.1.2,1.21.11,1.21.1,1.20.1",
			wizardTest.versionOrder.join(",")
		);
		check(
			"wizard header names launcher, pack and release",
			/^Modrinth App \S+ 26\.3 Fabric \S+ v1\.1\.0/.test(wizardTest.first) &&
				wizardTest.counts === "4/6",
			wizardTest.first
		);
		check(
			"picking a launcher and version rewrites the install",
			/26\.3\/pack\.toml/.test(wizardTest.standalone) &&
				/26\.2\/pack\.toml/.test(wizardTest.picked),
			`${wizardTest.standalone} | ${wizardTest.picked}`
		);
		check(
			"wizard groups use arrow keys and one tab stop",
			wizardTest.viaKey.idx === 2 &&
				/26\.1\.2\/pack\.toml/.test(wizardTest.viaKey.cmd) &&
				wizardTest.viaKey.tabIndex === 0 &&
				wizardTest.viaKey.otherTabIndex === -1 &&
				/1\.20\.1\/pack\.toml/.test(wizardTest.wrapped),
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
			const wait = (ms) => new Promise(r => setTimeout(r, ms));
			const current = () =>
				document.querySelector('#nav-links a[aria-current]')?.textContent || 'none';

			document.getElementById('mods').scrollIntoView();
			await wait(900);
			const onMods = current();
			document.getElementById('install').scrollIntoView();
			await wait(900);
			const onInstall = current();

			// Jumping back up used to leave the highlight on the section above,
			// because the observer only reacted to entries entering the band.
			document.querySelector('#nav-links a[href="#mods"]').click();
			await wait(1500);
			const afterJumpUp = current();

			// And scrolling above the first section used to leave it stuck on Mods.
			window.scrollTo(0, 0);
			await wait(900);
			const afterTop = current();

			return {
				revealed: document.querySelectorAll('[data-reveal].is-in').length,
				bars: document.getElementById('p-bars').classList.contains('is-in'),
				onMods,
				onInstall,
				afterJumpUp,
				afterTop,
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
			"scroll spy tracks both directions and clears above the first section",
			motionTest.onMods === "Mods" &&
				motionTest.onInstall === "Install" &&
				motionTest.afterJumpUp === "Mods" &&
				motionTest.afterTop === "none" &&
				motionTest.active === 0,
			JSON.stringify({
				onMods: motionTest.onMods,
				onInstall: motionTest.onInstall,
				afterJumpUp: motionTest.afterJumpUp,
				afterTop: motionTest.afterTop
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
