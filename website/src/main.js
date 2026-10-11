/**
 * Zitrus homepage behaviour. No framework, no runtime dependencies.
 * Sections: theme, mobile drawer, sticky nav, scroll spy, scroll reveal,
 * clipboard, mod browser (tabs, search, show more), hero panel and install
 * wizard. The pack metadata is a build-time import, shared by all three.
 */

import packData from "./data/mods.json";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const capitalise = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/* Mod icons are hashed and served by Vite, so the generated JSON only records
   the file name and this map turns it back into a built URL. */
const icons = import.meta.glob("./assets/img/*.png", {
	eager: true,
	query: "?url",
	import: "default"
});
const iconUrl = (file) => icons[`./assets/img/${file}`] || null;

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

/* ---------- Mobile drawer ---------------------------------------------- */
(function drawer() {
	const burger = $("#burger");
	const panel = $("#drawer");
	if (!burger || !panel) return;

	const set = (open) => {
		panel.dataset.open = String(open);
		burger.setAttribute("aria-expanded", String(open));
		burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
	};

	burger.addEventListener("click", () => set(panel.dataset.open !== "true"));

	panel.addEventListener("click", (e) => {
		if (e.target.closest("a")) set(false);
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
	if (label) label.textContent = "Copied";
	clearTimeout(btn._t);
	btn._t = setTimeout(() => {
		btn.dataset.done = "false";
		if (label) label.textContent = "Copy";
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
	return select;
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

	// Entry count for the whole browser: mods that are not somebody's addon.
	// The pack still installs all of them, so the mod count stays separate.
	const allEntries = data.mods.filter((m) => !m.parent).length;

	// Row index the next render should animate from. null means "no animation",
	// which is what a filter change wants: the rows that stay are not new.
	let animateFrom = 0;

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
		tag.textContent = mod.side === "both" ? "Client & Server" : capitalise(mod.side);
		tag.title =
			mod.side === "client"
				? "Client only, not installed on servers"
				: mod.side === "server"
					? "Server only, not installed on clients"
					: "Installed on clients and servers";
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
			empty.innerHTML =
				`<p>No mods match <code>${query.replace(/[<>&]/g, "")}</code>.</p>
				 <p style="margin-top:10px"><button class="btn btn--ghost btn--sm" id="empty-reset">Clear the search</button></p>`;
			list.append(empty);
			$("#empty-reset", empty).addEventListener("click", () => {
				query = "";
				searchEl.value = "";
				expanded = false;
				sync();
			});
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
				count.textContent = `+ ${addons.length} addon${addons.length === 1 ? "" : "s"}`;
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
		moreLabel.textContent = expanded ? "Show fewer" : `Show all ${entries} mods`;
	}

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
		renderMods(rows.slice(0, visible), from ?? undefined);

		// The count reflects what is on screen: the filters are part of the
		// scope, so reporting the unfiltered group total would be a lie.
		const scoped = foldAddons(pool).length;
		const count = hideAddons ? pool.length : scoped;
		countEl.textContent = q
			? `Showing ${entries} of ${count}`
			: `${count} mod${count === 1 ? "" : "s"}`;
		if (sidesEl) sidesEl.textContent = "";

		paintMore(entries);
		wrapEl.dataset.filled = String(Boolean(q));

		const next = new URLSearchParams();
		if (group !== "all") next.set("group", group);
		if (query.trim()) next.set("q", query.trim());
		if (sort !== "downloads") next.set("sort", sort);
		if (env !== "both") next.set("side", env);
		if (hideAddons) next.set("addons", "hide");
		const qs = next.toString();
		history.replaceState(null, "", qs ? `?${qs}${location.hash}` : `${location.pathname}${location.hash}`);

		$$(".tab", tabsEl).forEach((t) =>
			t.setAttribute("aria-selected", String(t.dataset.group === group))
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

	// Tabs
	const groups = [{ key: "all", title: "All", count: data.curated }].concat(
		data.groups.map((g) => ({ key: g.key, title: g.title, count: g.count }))
	);
	tabsEl.textContent = "";
	for (const g of groups) {
		const b = document.createElement("button");
		b.className = "tab";
		b.type = "button";
		b.role = "tab";
		b.dataset.group = g.key;
		b.setAttribute("aria-selected", "false");
		b.innerHTML = `${g.title}<span class="tab__c">${g.count}</span>`;
		b.addEventListener("click", () => {
			if (group === g.key) return;
			group = g.key;
			expanded = false;
			sync();
		});
		tabsEl.append(b);
	}

	let t;
	searchEl.addEventListener("input", () => {
		clearTimeout(t);
		t = setTimeout(() => {
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
	sync();

	// Wire up the hero panel with the same source of truth.
	$("#p-total").textContent = data.total;
	$("#p-curated").textContent = data.curated;
	$("#p-versions").textContent = data.versions.length;
	$("#p-ver").textContent = `${data.latest} · latest`;

	const max = Math.max(...data.groups.map((g) => g.count));
	const barsEl = $("#p-bars");
	barsEl.innerHTML = data.groups
		.map(
			(g, i) => `<button class="bar" type="button" data-group="${g.key}" aria-pressed="false"
				aria-label="Show the ${g.title} mods">
				<div class="bar__top"><span>${g.title}</span><span class="bar__n">${g.count}</span></div>
				<div class="bar__track"><span class="bar__fill" style="--w:${(g.count / max) * 100}%;--d:${i * 90}ms"></span></div>
			</button>`
		)
		.join("");
	// Let the first frame paint the empty track before the bars grow.
	requestAnimationFrame(() => requestAnimationFrame(() => barsEl.classList.add("is-in")));

	// The bars are the second door into the browser: they set the same filter.
	barsEl.addEventListener("click", (e) => {
		const bar = e.target.closest(".bar");
		if (!bar) return;
		group = bar.dataset.group;
		expanded = false;
		sync();
		document.getElementById("mods").scrollIntoView({ block: "start" });
	});

	$("#p-versions-list").innerHTML = data.versions
		.map(
			(v) =>
				`<span class="chip chip--ver">${v.minecraft}${
					v.minecraft === data.latest ? ' <span style="color:var(--accent-text)">*</span>' : ""
				}</span>`
		)
		.join("");

	$("#foot-ver").textContent = `${data.latest} · ${data.versions.length} versions · ${data.total} mods`;
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

	const LAUNCHERS = [
		{
			key: "modrinth-app",
			name: "Modrinth App",
			tag: "mrpack",
			out: (v) => ({
				head: "Modrinth App",
				steps: [
					"Install the app and sign in to your account.",
					"Press the button below to open Zitrus, then press Install.",
					`Keep ${v.minecraft} selected in the version dropdown to get this exact build.`,
					"Launch it from your profile. Nothing else to configure."
				],
				acts: [
					{
						label: "Open in Modrinth App",
						href: `modrinth://open?url=${encodeURIComponent(MODRINTH)}`
					},
					{ label: "Project page", href: MODRINTH, ghost: true }
				]
			})
		},
		{
			key: "prism",
			name: "Prism Launcher",
			tag: "Modrinth",
			out: (v) => ({
				head: "Prism Launcher",
				steps: [
					"Open Add Instance in Prism Launcher.",
					"Switch the source to Modrinth and search for Zitrus.",
					`Create the instance for ${v.minecraft}.`,
					"Set your Java version and memory, then launch."
				],
				acts: [{ label: "Open on Modrinth", href: MODRINTH }]
			})
		},
		{
			key: "curseforge",
			name: "CurseForge app",
			tag: "curseforge",
			out: (v) => ({
				head: "CurseForge app",
				steps: [
					"Open Minecraft in the CurseForge app.",
					"Choose Install a modpack and search for Zitrus.",
					`Pick ${v.minecraft}, then let the app install it.`,
					"Every dependency is downloaded into a new profile for you."
				],
				acts: [{ label: "Open on CurseForge", href: CURSEFORGE }]
			})
		},
		{
			key: "standalone",
			name: "Standalone",
			tag: "packwiz",
			out: (v) => ({
				head: "Standalone, packwiz",
				steps: [
					"Download packwiz-installer-bootstrap and put the jar in your instance folder.",
					"Run the command below once. It writes the profile and fetches the mods.",
					`Point it at the ${v.minecraft} build with the path above.`,
					"Start Minecraft afterwards as usual."
				],
				code: `java -jar packwiz-installer-bootstrap.jar -g https://raw.githack.com/Bruderjulian/LemonlightModpack3/dist/versions/fabric/${v.minecraft}/pack.toml`,
				acts: [{ label: "Bootstrap releases", href: PACKWIZ, ghost: true }]
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
		const pack = v.loader ? `${v.minecraft} ${capitalise(v.loader)}` : v.minecraft;
		const parts = [spec.head, pack];
		if (v.release) parts.push(`v${v.release}`);
		forEl.textContent = parts.join(" \u00b7 ");
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
					<span class="code__label">Pre-launch command</span>
					<button class="copy" type="button" data-copy="${spec.code.replace(/"/g, "&quot;")}">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true">
							<rect x="9" y="9" width="11" height="11" rx="2" />
							<path d="M5 15V5a2 2 0 0 1 2-2h8" />
						</svg>
						<span>Copy</span>
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
	}

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

	wireRadioGroup(launchersEl, (el) => {
		launcher = LAUNCHERS.find((l) => l.key === el.dataset.key) || launcher;
		paintOut();
	});

	version = data.versions.find((v) => v.minecraft === data.latest) || data.versions[0];
	paintVersions();
	paintOut();

	wireRadioGroup(versionsEl, (el) => {
		version = data.versions.find((v) => v.minecraft === el.dataset.mc) || version;
		paintOut();
	});
})();
