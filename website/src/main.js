/**
 * Zitrus homepage behaviour. No framework, no runtime dependencies.
 * Sections: i18n, theme, language picker, mobile drawer, sticky nav, scroll
 * spy, scroll reveal, clipboard, mod browser (tabs, search, show more), hero
 * panel and install wizard. The pack metadata is a build-time import, shared
 * by all three.
 *
 * Nothing caches a translated string. Every label goes through t() at paint
 * time, so the repaint list at the bottom is all a language change needs: the
 * browser re-renders its rows, the wizard rebuilds its steps, and the static
 * markup was already rewritten by applyTranslations().
 */

import packData from "./data/mods.json";
import { initI18n, setLocale, getLocale, onLocaleChange, t, LOCALES } from "./i18n/index.js";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* Mod icons are hashed and served by Vite, so the generated JSON only records
   the file name and this map turns it back into a built URL.

   build-icons.mjs writes two widths per icon, `<slug>-34.webp` and
   `<slug>-68.webp`, and the JSON records the 2x one. The 1x is derived rather
   than stored: it is always the same name with a different suffix, and holding
   both in the data would mean every mod carries a second field that only
   exists to spell out a filename pattern. */
const icons = import.meta.glob("./assets/img/*.webp", {
	eager: true,
	query: "?url",
	import: "default"
});
const iconUrl = (file) => icons[`./assets/img/${file}`] || null;
// The 1x name from the 2x one, matching how build-icons.mjs names them:
// sodium-68.webp -> sodium-34.webp. Replaces the trailing width, not the whole
// extension, so an unqualified name cannot silently produce sodium-68-34.webp.
const iconAt = (file, width) => iconUrl(file.replace(/-\d+\.webp$/, `-${width}.webp`));

/* ---------- i18n -------------------------------------------------------- */
/* Runs first, before any module paints, so the page never flashes English on
   the way to another language. The dictionaries are bundled, so this is
   synchronous and costs nothing at runtime. */
initI18n();

/* Anything that builds DOM from data has to redraw when the language changes.
   Collected here rather than inside each section so the order stays
   deterministic and the list is readable in one place. */
const repaints = [];
const repaint = (fn) => {
	repaints.push(fn);
	return fn;
};
onLocaleChange(() => {
	for (const fn of repaints) fn();
});

/* ---------- Theme ------------------------------------------------------ */
(function theme() {
	const btn = $("#theme");
	const root = document.documentElement;
	if (!btn) return;

	const systemDark = window.matchMedia("(prefers-color-scheme: dark)");
	const current = () =>
		root.dataset.theme || (systemDark.matches ? "dark" : "light");

	btn.addEventListener("click", () => {
		const next = current() === "dark" ? "light" : "dark";
		root.dataset.theme = next;
		try {
			localStorage.setItem("zitrus-theme", next);
		} catch {}
	});
})();

/* ---------- Language picker -------------------------------------------- */
/* One popover in the bar, built from LOCALES, open at every viewport width.
   Not duplicated into the mobile drawer: the bar keeps the burger and the
   theme toggle on a phone, so the picker is already reachable there. */
(function languagePicker() {
	const btn = $("#lang-btn");
	const menu = $("#lang-menu");
	const code = $("#lang-code");
	if (!btn || !menu) return;

	const entryFor = (l) => LOCALES.find((x) => x.code === l) || LOCALES[0];

	/* The trigger shows the code, not the name: at 36px in the bar, anything
	   longer than two letters would push the social marks out. The full name
	   is in the aria-label for anyone who cannot see the glyph. */
	const paintBtn = () => {
		const here = entryFor(getLocale());
		code.textContent = here.code.toUpperCase();
		btn.setAttribute("aria-label", t("lang.current", { language: here.native }));
	};

	menu.textContent = "";
	for (const l of LOCALES) {
		const b = document.createElement("button");
		b.className = "lang__item";
		b.type = "button";
		b.role = "menuitemradio";
		b.dataset.locale = l.code;
		b.setAttribute("aria-checked", "false");
		// The native name leads: it is the row of text a reader scans for their
		// own language. The English name is a quieter qualifier for anyone who
		// does not read that script. English drops it, since both are "English".
		b.innerHTML =
			`<span class="lang__item-native">${l.native}</span>` +
			(l.native === l.english
				? ""
				: `<span class="lang__item-en">${l.english}</span>`);
		b.addEventListener("click", () => {
			setLocale(l.code);
			close();
			btn.focus();
		});
		menu.append(b);
	}

	const paintMenu = () => {
		for (const item of $$(".lang__item", menu)) {
			item.setAttribute("aria-checked", String(item.dataset.locale === getLocale()));
		}
		paintBtn();
	};

	const open = () => {
		menu.hidden = false;
		btn.setAttribute("aria-expanded", "true");
		// Focus the current language, so Enter on a fresh open confirms
		// rather than jumping to the top of the list.
		const here = $('[aria-checked="true"]', menu);
		if (here) here.focus();
	};
	const close = () => {
		menu.hidden = true;
		btn.setAttribute("aria-expanded", "false");
	};

	btn.addEventListener("click", () => (menu.hidden ? open() : close()));

	document.addEventListener("click", (e) => {
		if (menu.hidden) return;
		if (!e.target.closest(".lang")) close();
	});

	menu.addEventListener("keydown", (e) => {
		const items = $$(".lang__item", menu);
		const i = items.indexOf(document.activeElement);
		if (i < 0) return;
		let next = -1;
		if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (i + 1) % items.length;
		else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (i - 1 + items.length) % items.length;
		else if (e.key === "Home") next = 0;
		else if (e.key === "End") next = items.length - 1;
		else if (e.key === "Tab") {
			// The menu is a popover, not a trap: Tab out closes it rather than
			// cycling the six languages forever.
			close();
			return;
		}
		if (next < 0) return;
		e.preventDefault();
		items[next].focus();
	});

	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && !menu.hidden) {
			close();
			btn.focus();
		}
	});

	// A rotation off the right edge is the same as a click outside, and the
	// popover is absolutely positioned, so it does not move when the bar does.
	window.matchMedia("(max-width: 860px)").addEventListener("change", (m) => {
		if (m.matches) close();
	});

	repaint(paintMenu);
	paintMenu();
})();

/* ---------- Mobile drawer ---------------------------------------------- */
(function drawer() {
	const burger = $("#burger");
	const panel = $("#drawer");
	if (!burger || !panel) return;

	const set = (open) => {
		panel.dataset.open = String(open);
		burger.setAttribute("aria-expanded", String(open));
		burger.setAttribute("aria-label", open ? t("a11y.closeMenu") : t("a11y.openMenu"));
		// Opening a disclosure that sits right under the bar and leaving focus
		// on the button means the next Tab walks the reader past their own open
		// menu into the page below it. Moving focus in on open and handing it
		// back on close is the whole of the interaction; it is not a modal, so
		// there is no trap and no aria-modal.
		if (open) $("a", panel)?.focus();
	};

	const toggle = () => {
		const open = panel.dataset.open !== "true";
		set(open);
		// Closing by click or by link has to return focus, or it lands on <body>
		// and the reader loses their place in the bar.
		if (!open) burger.focus();
	};

	burger.addEventListener("click", toggle);

	panel.addEventListener("click", (e) => {
		if (e.target.closest("a")) toggle();
	});

	document.addEventListener("keydown", (e) => {
		if (e.key === "Escape" && panel.dataset.open === "true") {
			set(false);
			burger.focus();
		}
	});

	// Reset when the layout goes back to the desktop nav.
	window.matchMedia("(min-width: 861px)").addEventListener("change", (m) => {
		if (m.matches) set(false);
	});

	// A language change only has to relabel the trigger. It must not go through
	// set(), because the drawer may well be open and set(true) would pull focus
	// back into it mid-sentence, throwing a screen reader back to the top of the
	// menu it was already reading.
	repaint(() =>
		burger.setAttribute(
			"aria-label",
			panel.dataset.open === "true" ? t("a11y.closeMenu") : t("a11y.openMenu")
		)
	);
})();

/* ---------- Sticky nav border ----------------------------------------- */
(function stuckNav() {
	const nav = $("#nav");
	const hero = $(".hero");
	if (!nav || !hero) return;

	// Observe rather than scroll-listening, so there is no per-frame work.
	new IntersectionObserver(
		([entry]) => {
			nav.dataset.stuck = String(!entry.isIntersecting);
		},
		{ rootMargin: `-${nav.offsetHeight}px 0px 0px 0px` }
	).observe(hero);
})();

/* ---------- Scroll spy ------------------------------------------------- */
(function scrollSpy() {
	const links = $$("#nav-links a[href^='#']");
	if (!links.length) return;

	const targets = new Map();
	for (const a of links) {
		const el = document.getElementById(decodeURIComponent(a.hash.slice(1)));
		if (el) targets.set(el, a);
	}
	if (!targets.size) return;

	const nav = $("#nav");
	// Track every entry, not just the ones that are entering. Reacting only
	// to "is intersecting" left the highlight stuck on the section above after
	// a jump back up, and never cleared it when scrolling above the first
	// section.
	const inBand = new Set();
	const paint = () => {
		// The last section in document order wins, so a short section cannot
		// steal the highlight from the one the reader is actually in.
		let current = null;
		for (const el of targets.keys()) if (inBand.has(el)) current = el;
		for (const a of links) a.removeAttribute("aria-current");
		if (current) targets.get(current).setAttribute("aria-current", "true");
	};

	const io = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) inBand.add(entry.target);
				else inBand.delete(entry.target);
			}
			paint();
		},
		// Only the top slice of the viewport decides, so the highlight changes
		// when a section reaches the nav rather than when it merely appears.
		{ rootMargin: `-${nav.offsetHeight + 8}px 0px -60% 0px` }
	);
	for (const el of targets.keys()) io.observe(el);
})();

/* ---------- Scroll reveal --------------------------------------------- */
(function reveal() {
	const targets = $$("[data-reveal]");
	if (!targets.length) return;

	// With reduced motion requested, CSS never hides these, so nothing to do.
	if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;

	const io = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				entry.target.classList.add("is-in");
				io.unobserve(entry.target);
			}
		},
		{ rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
	);

	for (const el of targets) io.observe(el);
})();

/* ---------- Copy to clipboard ----------------------------------------- */
/* Delegated, because the wizard renders its command blocks after load. */
document.addEventListener("click", async (e) => {
	const btn = e.target.closest("[data-copy]");
	if (!btn) return;
	e.preventDefault();

	const text = btn.dataset.copy;
	try {
		await navigator.clipboard.writeText(text);
	} catch {
		// Clipboard API needs a secure context; fall back to a selection.
		const ta = document.createElement("textarea");
		ta.value = text;
		ta.style.cssText = "position:fixed;opacity:0";
		document.body.append(ta);
		ta.select();
		document.execCommand("copy");
		ta.remove();
	}

	const label = $("span", btn);
	btn.dataset.done = "true";
	if (label) label.textContent = t("wizard.copied");
	clearTimeout(btn._t);
	btn._t = setTimeout(() => {
		btn.dataset.done = "false";
		// The block is re-rendered on every wizard change, so re-reading the
		// label is enough to undo a language switch that landed mid-timeout.
		if (label) label.textContent = t("wizard.copy");
	}, 1600);
});

/* ---------- Radio group behaviour (wizard) ---------------------------- */
/* One roving tabindex per group, so Tab reaches the group once and the arrow
   keys move inside it. That is the expected pattern for role="radiogroup".
   The selector is a parameter because the wizard and the browser filter use
   different class names for the options. */
function wireRadioGroup(root, onSelect, itemSel = ".pick") {
	if (!root) return;

	const items = () => $$(itemSel, root);

	/* Exported as `paint` because a group whose options are rebuilt from data
	   has to re-apply the roving tabindex afterwards. paintVersions() replaces
	   every button in the group on a language change, and a freshly created
	   button has no tabindex, so it defaults to 0 and the group silently grew
	   one tab stop per option. */
	const paint = () => {
		for (const el of items()) {
			const on = el.getAttribute("aria-checked") === "true";
			el.tabIndex = on ? 0 : -1;
		}
	};

	const select = (el, focus) => {
		for (const other of items()) {
			other.setAttribute("aria-checked", String(other === el));
		}
		paint();
		if (focus) el.focus();
		onSelect(el);
	};

	root.addEventListener("click", (e) => {
		const el = e.target.closest(itemSel);
		if (el) select(el, false);
	});

	root.addEventListener("keydown", (e) => {
		const picks = items();
		const i = picks.indexOf(document.activeElement);
		if (i < 0) return;
		let next = -1;
		if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (i + 1) % picks.length;
		else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (i - 1 + picks.length) % picks.length;
		else if (e.key === "Home") next = 0;
		else if (e.key === "End") next = picks.length - 1;
		if (next < 0) return;
		e.preventDefault();
		select(picks[next], true);
	});

	paint();
	return { select, paint };
}

/* ---------- Mod browser ------------------------------------------------ */
const browser = (function modBrowser() {
	const list = $("#mod-list");
	const tabsEl = $("#tabs");
	const countEl = $("#browser-count");
	const sidesEl = $("#browser-sides");
	const searchEl = $("#search");
	const clearEl = $("#search-clear");
	const wrapEl = $("#search-wrap");
	const moreEl = $("#browser-more");
	const moreBtn = $("#more-toggle");
	const moreLabel = $("#more-label");
	if (!list) return null;

	// How many rows fit before the list asks permission to grow.
	const PAGE = 12;

	const params = new URLSearchParams(location.search);
	const data = packData;
	let group = params.get("group") || "all";
	let query = params.get("q") || "";
	let sort = params.get("sort") === "relevance" ? "relevance" : "downloads";
	// Environment is one choice, not three toggles. "Client" and "Server"
	// each include the both-side mods, because a both-side mod does install
	// on that side; "Client & Server" is the whole list and the default.
	const envParam = params.get("side");
	let env = envParam === "client" || envParam === "server" ? envParam : "both";
	let hideAddons = params.get("addons") === "hide";
	let expanded = false;

	/* Adoption of the prerendered default state.
	   tools/prerender.mjs builds this page in a real browser, captures the
	   markup main.js produced and writes it back into dist/index.html, so a
	   crawler that never runs JavaScript still sees the mod list, the group
	   chips, the hero numbers and the wizard. On load, if the state described by
	   the query string is exactly the state that was captured, the first render
	   is skipped and the markup already in the document is adopted as-is.

	   The key is written by the page and read back by the build, never built by
	   hand in two places: prerender.mjs copies whatever this function stamped,
	   so the two cannot drift into disagreeing about what "the default" means.
	   Any query parameter at all, ?lang=ru included, produces a different key and
	   the normal render runs. */
	const stateKey = () => [group, query, sort, env, hideAddons, expanded, getLocale()].join("|");
	let adoptPrerender = list.dataset.prerender === stateKey();

	/* Two orders, both off real Modrinth numbers and the pack's own grouping.
	   Neither invents a score: "downloads" is what most people pull, and
	   "relevance" is the pack's answer to which mods matter, most used first. */
	// Group index as declared in groups.json, which is the pack's own priority:
// performance first, tweaks last.
	const rank = new Map(data.groups.map((g, i) => [g.key, i]));
	const byDownloads = (a, b) =>
		b.downloads - a.downloads || b.followers - a.followers || a.name.localeCompare(b.name);
	const byRelevance = (a, b) =>
		(rank.get(a.group) ?? 99) - (rank.get(b.group) ?? 99) || byDownloads(a, b);
	const SORTERS = { downloads: byDownloads, relevance: byRelevance };

	// Row index the next render should animate from. null means "no animation",
	// which is what a filter change wants: the rows that stay are not new.
	let animateFrom = 0;

	/* Group names are translated; the English title in the generated JSON is
	   the fallback, so a group added to groups.json without a dictionary entry
	   still shows its own name instead of a raw key. */
	const groupTitle = (key, fallback) => t(`group.${key}`, {}, fallback ?? key);

	function monogram(name) {
		const el = document.createElement("div");
		el.className = "mod__icon";
		el.textContent = name.trim()[0]?.toUpperCase() || "?";
		el.style.cssText =
			"display:grid;place-items:center;font-family:var(--font-mono);font-size:14px;color:var(--ink-3)";
		return el;
	}

	function icon(mod, size = 34) {
		const src = mod.icon && iconUrl(mod.icon);
		if (!src) return monogram(mod.name);
		const img = document.createElement("img");
		img.className = "mod__icon";
		img.src = src;
		img.alt = "";
		img.loading = "lazy";
		img.decoding = "async";
		img.width = size;
		img.height = size;
		// The row paints the icon at a fixed 34px, so the browser can pick the
		// 1x file on a phone instead of downloading 2x pixels nobody sees.
		// Without sizes="34px" a srcset is measured against the viewport and
		// always resolves to the largest candidate.
		const one = mod.icon && iconAt(mod.icon, 34);
		if (one) {
			img.sizes = `${size}px`;
			img.srcset = `${one} 1x, ${src} 2x`;
		}
		img.addEventListener("error", () => img.replaceWith(monogram(mod.name)), {
			once: true
		});
		return img;
	}

	function modLink(mod, text = mod.name) {
		const a = document.createElement("a");
		a.href = `https://modrinth.com/mod/${encodeURIComponent(mod.slug)}`;
		a.target = "_blank";
		a.rel = "noopener noreferrer";
		a.textContent = text;
		return a;
	}

	function sideTag(mod) {
		const tag = document.createElement("span");
		tag.className = "mod__side";
		tag.dataset.side = mod.side;
		// Every mod gets a tag now, so "works in both places" is stated rather
		// than inferred from the absence of a badge.
		tag.textContent = t(`side.${mod.side}`);
		tag.title = t(
			mod.side === "client"
				? "side.clientTitle"
				: mod.side === "server"
					? "side.serverTitle"
					: "side.bothTitle"
		);
		return tag;
	}

	/* Addons fold into their parent instead of getting a row of their own:
	   "Sodium" with four addons listed under it is one entry, which is how the
	   README counts them too. An addon whose parent is filtered out still needs
	   a home, so it is promoted to a row of its own rather than vanishing. */
	function foldAddons(mods) {
		const rows = [];
		const index = new Map();

		for (const mod of mods) {
			const parent = mod.parent ? index.get(mod.parent) : null;
			if (parent) {
				parent.addons.push(mod);
				continue;
			}
			const row = { mod, addons: [], orphan: Boolean(mod.parent) };
			rows.push(row);
			// The parent claims its addons, whether or not the addon itself
			// made the cut, so a later filter can never lose one.
			if (!mod.parent) index.set(mod.file, row);
		}
		for (const row of rows) row.addons.sort((a, b) => b.downloads - a.downloads);
		return rows;
	}

	function renderMods(rows, animateFrom) {
		list.textContent = "";
		if (!rows.length) {
			const empty = document.createElement("div");
			empty.className = "empty";
			// The query goes in a <code> so it reads as the literal thing that
			// was typed. It is built as a text node, never as markup: it comes
			// from the URL and the search box, and the empty-state check drives
			// both. The sentence is split on the placeholder rather than
			// concatenated, because where the query lands in the sentence is a
			// translation decision.
			//
			// Every occurrence is substituted, not just the first. Taking only
			// the first two segments assumed the message mentions the query once;
			// a translation that mentions it twice lost everything after the
			// second placeholder.
			const lead = document.createElement("p");
			const segments = t("mods.noMatch", { query: "\u0000" }).split("\u0000");
			for (const [i, segment] of segments.entries()) {
				if (i) {
					const q = document.createElement("code");
					q.textContent = query.replace(/[<>&]/g, "");
					lead.append(q);
				}
				lead.append(document.createTextNode(segment));
			}
			const btn = document.createElement("button");
			btn.className = "btn btn--ghost btn--sm";
			btn.type = "button";
			btn.id = "empty-reset";
			btn.textContent = t("mods.clearTheSearch");
			const actions = document.createElement("p");
			actions.style.marginTop = "10px";
			actions.append(btn);
			empty.append(lead, actions);
			btn.addEventListener("click", () => {
				query = "";
				searchEl.value = "";
				expanded = false;
				sync();
			});
			list.append(empty);
			return;
		}

		const frag = document.createDocumentFragment();
		for (const [i, { mod, addons, orphan }] of rows.entries()) {
			const row = document.createElement("div");
			row.className = "mod";
			row.setAttribute("role", "listitem");
			// Carrying the sort key on the row keeps the displayed order
			// checkable from the DOM.
			row.dataset.downloads = mod.downloads;
			row.dataset.group = mod.group || "";
			if (addons.length) {
				row.dataset.addons = addons.map((a) => a.name).join("|");
			}
			if (orphan) row.dataset.orphan = "true";
			// Only the rows that just appeared animate, so re-filtering the list
			// does not replay the cascade on rows that never moved.
			if (animateFrom !== undefined && i >= animateFrom) {
				row.classList.add("mod--enter");
				row.style.setProperty("--i", Math.min(i - animateFrom, 14));
			}

			row.append(icon(mod));

			const body = document.createElement("div");
			body.className = "mod__body";

			const name = document.createElement("div");
			name.className = "mod__name";
			name.append(modLink(mod));
			// The addon count belongs with the title, not on a line of its own:
			// "Sodium + 4 addons" is one claim about one mod.
			if (addons.length) {
				const count = document.createElement("span");
				count.className = "mod__addons-count";
				count.textContent = t("mods.addonsCount", { n: addons.length });
				name.append(count);
			}
			name.append(sideTag(mod));
			body.append(name);

			if (mod.blurb) {
				const desc = document.createElement("p");
				desc.className = "mod__desc";
				desc.textContent = mod.blurb;
				body.append(desc);
			}

			// Addons read as one row with the parent, not as extra rows.
			if (addons.length) {
				const list = document.createElement("ul");
				list.className = "mod__addons";
				for (const addon of addons) {
					const li = document.createElement("li");
					li.append(modLink(addon));
					li.append(sideTag(addon));
					list.append(li);
				}
				body.append(list);
			}

			row.append(body);
			frag.append(row);
		}
		list.append(frag);
	}

	function paintMore(entries) {
		const q = Boolean(query.trim());
		// A search is deliberate: show every hit rather than hiding rows behind
		// a button. Without a search, the button exists only if there is a tail.
		const needed = !q && entries > PAGE;
		moreEl.hidden = !needed;
		if (!needed) return;

		moreBtn.setAttribute("aria-expanded", String(expanded));
		moreLabel.textContent = expanded
			? t("mods.showFewer")
			: t("mods.showAllCount", { n: entries });
	}

	/* The language is part of the URL state, so a language change has to
	   survive every filter change afterwards and vice versa. sync() reads it
	   back off the live query string rather than a module variable. */
	const carryLang = (next) => {
		const current = new URLSearchParams(location.search).get("lang");
		if (current) next.set("lang", current);
	};

	function sync() {
		const q = query.trim().toLowerCase();
		// Group, then side, then addons: each narrows the pool before the
		// text search and the sort see it. Mods without a recognised side are
		// kept so a new pack entry is never silently filtered away.
		let pool = data.mods.filter((m) => group === "all" || m.group === group);
		if (env !== "both") pool = pool.filter((m) => m.side === env || m.side === "both");
		if (hideAddons) pool = pool.filter((m) => !m.parent);

		// filter() returns a fresh array, so sorting it in place is safe.
		const hits = (q
			? pool.filter(
					(m) =>
						m.name.toLowerCase().includes(q) ||
						(m.blurb || "").toLowerCase().includes(q) ||
						(m.slug || "").toLowerCase().includes(q)
				)
			: pool
		).sort(SORTERS[sort]);

		// Pagination counts entries, not mods: an addon rides along with its
		// parent, so the page cannot promise 12 rows and then render 10.
		const rows = foldAddons(hits);
		const entries = rows.length;
		const visible = !q && !expanded ? Math.min(PAGE, entries) : entries;
		const from = animateFrom;
		animateFrom = null;
		if (adoptPrerender) {
			// The rows are already in the document, produced by this same code
			// in the prerender browser. Everything else in sync() is an
			// idempotent update of existing nodes — counts, aria state, the URL
			// — so it can still run and will land on the same values.
			adoptPrerender = false;
		} else {
			renderMods(rows.slice(0, visible), from ?? undefined);
		}
		// Stamp the state this element currently shows. prerender.mjs reads this
		// straight back out of the rendered page, so the build copies the real
		// key rather than guessing at the format.
		list.dataset.prerender = stateKey();

		// The count reflects what is on screen: the filters are part of the
		// scope, so reporting the unfiltered group total would be a lie.
		const scoped = foldAddons(pool).length;
		const count = hideAddons ? pool.length : scoped;
		countEl.textContent = q
			? t("mods.showing", { shown: entries, total: count })
			: t("mods.count", { n: count });
		if (sidesEl) sidesEl.textContent = "";

		paintMore(entries);
		wrapEl.dataset.filled = String(Boolean(q));

		const next = new URLSearchParams();
		if (group !== "all") next.set("group", group);
		if (query.trim()) next.set("q", query.trim());
		if (sort !== "downloads") next.set("sort", sort);
		if (env !== "both") next.set("side", env);
		if (hideAddons) next.set("addons", "hide");
		carryLang(next);
		const qs = next.toString();
		history.replaceState(null, "", qs ? `?${qs}${location.hash}` : `${location.pathname}${location.hash}`);

		$$(".tab", tabsEl).forEach((t) =>
			t.setAttribute("aria-pressed", String(t.dataset.group === group))
		);
		for (const bar of $$(".bar")) {
			bar.setAttribute("aria-pressed", String(bar.dataset.group === group));
		}
		for (const btn of $$(".sort__btn")) {
			btn.setAttribute("aria-pressed", String(btn.dataset.sort === sort));
		}
		for (const btn of $$(".seg__btn")) {
			btn.setAttribute("aria-checked", String(btn.dataset.env === env));
		}
		const addonsBtn = $(".toggle[data-addons]");
		if (addonsBtn) addonsBtn.setAttribute("aria-pressed", String(hideAddons));
	}

	moreBtn.addEventListener("click", () => {
		const before = list.querySelectorAll(".mod").length;
		expanded = !expanded;
		// Growing animates the new tail; shrinking needs no animation.
		animateFrom = expanded ? before : null;
		sync();
		if (!expanded) {
			// Collapsing can leave the viewport below the list, so pull it back.
			if (list.getBoundingClientRect().top < 0) {
				list.scrollIntoView({ block: "start" });
			}
		}
	});

	function paintTabs() {
		const groups = [{ key: "all", count: data.curated }].concat(
			data.groups.map((g) => ({ key: g.key, count: g.count }))
		);
		// Rebuilt rather than relabelled, because a filter chip is a title plus
		// a count in two spans and both are language dependent.
		const keepFocus = tabsEl.contains(document.activeElement);
		tabsEl.textContent = "";
		for (const g of groups) {
			const b = document.createElement("button");
			b.className = "tab";
			b.type = "button";
			// No role="tab". These filter one shared list underneath rather than
			// swapping panels, so there is no tabpanel to point aria-controls at
			// and no tab semantics to honour. The container is role="group" and
			// the state is aria-pressed, which is what it actually is.
			b.dataset.group = g.key;
			// Stamped here rather than left entirely to sync(): the focus restore
			// at the end of this function looks the selected chip up by this
			// attribute, and sync() only runs after paintTabs() has returned.
			// Rebuilding every chip as unselected and then searching for the
			// selected one found nothing, so a language change dropped focus to
			// <body> rather than holding it on the chip.
			b.setAttribute("aria-pressed", String(g.key === group));
			const title = document.createElement("span");
			title.className = "tab__t";
			title.textContent = g.key === "all" ? t("mods.tabAll") : groupTitle(g.key, g.title);
			const count = document.createElement("span");
			count.className = "tab__c";
			count.textContent = g.count;
			b.append(title, count);
			tabsEl.append(b);
		}
		if (keepFocus) $('[aria-pressed="true"]', tabsEl)?.focus();
	}

	/* One delegated listener rather than a closure per chip.
	   paintTabs() is skipped entirely when the prerendered chips are adopted, so
	   a per-chip listener would leave five dead buttons in the document: they
	   looked right and did nothing. Delegating means the wiring belongs to the
	   container, which always exists, and a language repaint no longer builds
	   five new listeners to throw the old five away. */
	tabsEl.addEventListener("click", (e) => {
		const chip = e.target.closest(".tab");
		if (!chip || chip.dataset.group === group) return;
		group = chip.dataset.group;
		expanded = false;
		sync();
	});

	// Not named "t": the translator is imported as t() and a module-scope
	// import is shadowed by a block-scoped let anywhere in the same function.
	let searchTimer;
	searchEl.addEventListener("input", () => {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			query = searchEl.value;
			expanded = false;
			sync();
		}, 90);
	});
	clearEl.addEventListener("click", () => {
		searchEl.value = "";
		query = "";
		expanded = false;
		sync();
		searchEl.focus();
	});

	// Order control. Same treatment as the tabs: a mode button per order.
	$$(".sort__btn").forEach((b) => {
		b.addEventListener("click", () => {
			if (sort === b.dataset.sort) return;
			sort = b.dataset.sort;
			expanded = false;
			sync();
		});
	});

	// Environment is one choice of three, so it is a radiogroup: Tab reaches
	// it once and the arrow keys move between the options. The addons toggle
	// is a separate control, not a fourth option in the same group.
	wireRadioGroup($("#env-filter"), (el) => {
		env = el.dataset.env;
		expanded = false;
		sync();
	}, ".seg__btn");

	const addonsBtn = $(".toggle[data-addons]");
	if (addonsBtn) {
		addonsBtn.addEventListener("click", () => {
			hideAddons = !hideAddons;
			expanded = false;
			sync();
		});
	}

	if (query) searchEl.value = query;

	/* ---------- Hero panel ---------- */
	/* Also repainted on a language change: the group names and the "latest"
	   suffix are both translated, and the bars are buttons carrying an
	   aria-label, which a screen reader reads before the visible text. */
	function paintPanel() {
		$("#p-total").textContent = data.total;
		$("#p-curated").textContent = data.curated;
		$("#p-versions").textContent = data.versions.length;
		$("#p-ver").textContent = t("panel.latestSuffix", { version: data.latest });

		const max = Math.max(...data.groups.map((g) => g.count));
		const barsEl = $("#p-bars");
		const wasIn = barsEl.classList.contains("is-in");
		barsEl.innerHTML = data.groups
			.map(
				(g, i) => `<button class="bar" type="button" data-group="${g.key}" aria-pressed="false"
				aria-label="${t("panel.showGroup", { group: groupTitle(g.key, g.title) }).replace(/"/g, "&quot;")}">
				<div class="bar__top"><span>${groupTitle(g.key, g.title)}</span><span class="bar__n">${g.count}</span></div>
				<div class="bar__track"><span class="bar__fill" style="--w:${(g.count / max) * 100}%;--d:${i * 90}ms"></span></div>
			</button>`
			)
			.join("");
		// Let the first frame paint the empty track before the bars grow. On a
		// repaint the bars are already in, so they stay in.
		if (wasIn) barsEl.classList.add("is-in");
		else requestAnimationFrame(() => requestAnimationFrame(() => barsEl.classList.add("is-in")));

		$("#p-versions-list").innerHTML = data.versions
			.map(
				(v) =>
					`<span class="chip chip--ver">${v.minecraft}${
						v.minecraft === data.latest ? ' <span style="color:var(--accent-text)">*</span>' : ""
					}</span>`
			)
			.join("");

		// Two different nouns, so two different plurals. "6 versions · 106
		// mods" is not one number with two labels.
		$("#foot-ver").textContent = t("footer.summary", {
			version: data.latest,
			versions: t("mods.versionCount", { n: data.versions.length }),
			mods: t("mods.count", { n: data.total })
		});
	}

	// The bars are the second door into the browser: they set the same filter.
	$("#p-bars").addEventListener("click", (e) => {
		const bar = e.target.closest(".bar");
		if (!bar) return;
		group = bar.dataset.group;
		expanded = false;
		sync();
		document.getElementById("mods").scrollIntoView({ block: "start" });
	});

	repaint(() => {
		paintTabs();
		paintPanel();
		sync();
	});

	// The startup render. paintTabs() and paintPanel() rebuild their containers
	// wholesale, so they are skipped when the prerendered markup is being
	// adopted; sync() runs either way and is what flips adoptPrerender off.
	if (!adoptPrerender) {
		paintTabs();
		paintPanel();
	}
	sync();

	return { sync, setGroup: (g) => { group = g; sync(); } };
})();

/* ---------- Install wizard -------------------------------------------- */
(function wizard() {
	const launchersEl = $("#wiz-launchers");
	const versionsEl = $("#wiz-versions");
	const outEl = $("#wiz-out");
	if (!launchersEl || !versionsEl || !outEl) return;

	const MODRINTH = "https://modrinth.com/project/zitrus";
	// TODO: confirm the CurseForge slug when the project is published there.
	const CURSEFORGE = "https://www.curseforge.com/minecraft/modpacks/zitrus";
	const PACKWIZ = "https://github.com/packwiz/packwiz-installer-bootstrap/releases";

	/* Each launcher is a key prefix rather than a set of finished strings, so
	   one dictionary entry carries the name, the four steps and the action
	   labels. out() is called on every repaint, which is what makes a language
	   change reach the steps. */
	const LAUNCHERS = [
		{
			key: "modrinth-app",
			name: "Modrinth App",
			tag: "mrpack",
			out: (v) => ({
				head: t("wizard.modrinth.name"),
				steps: [
					t("wizard.modrinth.step1"),
					t("wizard.modrinth.step2"),
					t("wizard.modrinth.step3", { version: v.minecraft }),
					t("wizard.modrinth.step4")
				],
				acts: [
					{
						label: t("wizard.modrinth.open"),
						href: `modrinth://open?url=${encodeURIComponent(MODRINTH)}`
					},
					{ label: t("wizard.modrinth.project"), href: MODRINTH, ghost: true }
				]
			})
		},
		{
			key: "prism",
			name: "Prism Launcher",
			tag: "Modrinth",
			out: (v) => ({
				head: t("wizard.prism.name"),
				steps: [
					t("wizard.prism.step1"),
					t("wizard.prism.step2"),
					t("wizard.prism.step3", { version: v.minecraft }),
					t("wizard.prism.step4")
				],
				acts: [{ label: t("wizard.prism.open"), href: MODRINTH }]
			})
		},
		{
			key: "curseforge",
			name: "CurseForge app",
			tag: "curseforge",
			out: (v) => ({
				head: t("wizard.curseforge.name"),
				steps: [
					t("wizard.curseforge.step1"),
					t("wizard.curseforge.step2"),
					t("wizard.curseforge.step3", { version: v.minecraft }),
					t("wizard.curseforge.step4")
				],
				acts: [{ label: t("wizard.curseforge.open"), href: CURSEFORGE }]
			})
		},
		{
			key: "standalone",
			name: "Standalone",
			tag: "packwiz",
			out: (v) => ({
				head: t("wizard.standalone.name"),
				steps: [
					t("wizard.standalone.step1"),
					t("wizard.standalone.step2"),
					t("wizard.standalone.step3", { version: v.minecraft }),
					t("wizard.standalone.step4")
				],
				code: `java -jar packwiz-installer-bootstrap.jar -g https://raw.githack.com/Bruderjulian/LemonlightModpack3/dist/versions/fabric/${v.minecraft}/pack.toml`,
				acts: [{ label: t("wizard.standalone.releases"), href: PACKWIZ, ghost: true }]
			})
		}
	];

	let launcher = LAUNCHERS[0];
	let version = null;
	const data = packData;

	function paintOut() {
		const v = version;
		const spec = launcher.out(v);
		outEl.textContent = "";

		const head = document.createElement("div");
		head.className = "wiz-out__head";
		const forEl = document.createElement("span");
		forEl.className = "wiz-out__for";
		// Launcher, then the pack it installs, then the release. All four
		// describe the same install, so they read as one line rather than a
		// header plus a footnote. The raw pack version string is gone: it only
		// repeated the Minecraft version and the loader.
		// Fabric is a product name, not copy, so it stays in its own script
		// and casing rather than entering the dictionaries.
		const pack = v.loader ? `${v.minecraft} ${capitalise(v.loader)}` : v.minecraft;
		const parts = [spec.head, pack];
		if (v.release) parts.push(`v${v.release}`);
		forEl.textContent = parts.join(" · ");
		head.append(forEl);

		const body = document.createElement("div");
		body.className = "wiz-out__body";

		// One action per line reads faster than the paragraph it replaces, and
		// survives a screen reader as an actual list.
		const steps = document.createElement("ol");
		steps.className = "wiz-steps";
		for (const text of spec.steps) {
			const li = document.createElement("li");
			li.textContent = text;
			steps.append(li);
		}
		body.append(steps);

		if (spec.code) {
			const code = document.createElement("div");
			code.className = "code";
			code.innerHTML =
				`<div class="code__head">
					<span class="code__label">${t("wizard.prelaunch")}</span>
					<button class="copy" type="button" data-copy="${spec.code.replace(/"/g, "&quot;")}">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
							<rect x="9" y="9" width="11" height="11" rx="2" />
							<path d="M5 15V5a2 2 0 0 1 2-2h8" />
						</svg>
						<span>${t("wizard.copy")}</span>
					</button>
				</div>
				<pre><code>${spec.code.replace(/&/g, "&amp;").replace(/</g, "&lt;")}</code></pre>`;
			body.append(code);
		}

		const acts = document.createElement("div");
		acts.className = "wiz-out__acts";
		for (const a of spec.acts) {
			const link = document.createElement("a");
			link.className = `btn ${a.ghost ? "btn--ghost" : "btn--primary"}`;
			link.href = a.href;
			if (!a.href.startsWith("http")) link.rel = "noopener";
			link.textContent = a.label;
			acts.append(link);
		}
		body.append(acts);

		outEl.append(head, body);
	}

	function paintVersions() {
		// A rebuild drops the focused option on the floor along with everything
		// else, so a language change would throw a keyboard user out of the
		// group. Remember that the group had focus and hand it back afterwards.
		const keepFocus = versionsEl.contains(document.activeElement);
		versionsEl.textContent = "";
		// data.versions arrives newest first, so the default choice is the
		// first card and arrow keys walk backwards through the pack's history.
		for (const v of data.versions) {
			const b = document.createElement("button");
			b.className = "pick pick--ver";
			b.type = "button";
			b.role = "radio";
			b.dataset.mc = v.minecraft;
			b.dataset.latest = String(v.minecraft === data.latest);
			b.setAttribute("aria-checked", String(v.minecraft === version.minecraft));
			b.innerHTML =
				`<span class="pick__mark"></span>
				 <span class="v__n">${v.minecraft}</span>`;
			versionsEl.append(b);
		}
		// The roving tabindex lives on the elements this function just replaced.
		versions?.paint();
		if (keepFocus) $('[aria-checked="true"]', versionsEl)?.focus();
	}

	/* The launcher names are proper nouns from their own vendors, so they stay
	   in Latin script and out of the dictionaries. The card is rebuilt because
	   the aria-label on the group is translated.

	   Cleared before rebuilding, which looks redundant next to paintVersions()
	   but is the whole point. The prerendered document already holds these four
	   buttons, and appending to that left eight launchers in the DOM: four of
	   them unreachable in practice, in every accessibility tree and every
	   screenshot. Anything that builds into a container the build may have
	   already filled has to empty it first. */
	function paintLaunchers() {
		const keepFocus = launchersEl.contains(document.activeElement);
		launchersEl.setAttribute("aria-label", t("install.chooseLauncher"));
		launchersEl.textContent = "";
		for (const l of LAUNCHERS) {
			const b = document.createElement("button");
			b.className = "pick pick--launcher";
			b.type = "button";
			b.role = "radio";
			b.dataset.key = l.key;
			b.setAttribute("aria-checked", String(l === launcher));
			b.innerHTML =
				`<span class="pick__mark"></span>
				 <span class="pick__name">${l.name}<span class="pick__tag">${l.tag}</span></span>`;
			launchersEl.append(b);
		}
		launchers?.paint();
		if (keepFocus) $('[aria-checked="true"]', launchersEl)?.focus();
	}

	version = data.versions.find((v) => v.minecraft === data.latest) || data.versions[0];

	const launchers = wireRadioGroup(launchersEl, (el) => {
		launcher = LAUNCHERS.find((l) => l.key === el.dataset.key) || launcher;
		paintOut();
	});

	// Wired before the first paintVersions() so the options that call paints
	// them, and paintVersions() hands the roving tabindex back afterwards.
	const versions = wireRadioGroup(versionsEl, (el) => {
		version = data.versions.find((v) => v.minecraft === el.dataset.mc) || version;
		paintOut();
	});

	paintLaunchers();
	paintVersions();
	paintOut();

	repaint(() => {
		paintLaunchers();
		paintVersions();
		paintOut();
	});
})();