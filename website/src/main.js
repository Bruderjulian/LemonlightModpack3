/**
 * Zitrus homepage behaviour. No framework, no runtime dependencies.
 * Sections: theme, mobile drawer, sticky nav, scroll spy, scroll reveal,
 * clipboard, mod browser (tabs, search, show more), hero panel and install
 * wizard. The pack metadata is a build-time import, shared by all three.
 */

import packData from "./data/mods.json";

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

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
	const io = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (!entry.isIntersecting) continue;
				for (const a of links) a.removeAttribute("aria-current");
				targets.get(entry.target).setAttribute("aria-current", "true");
			}
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
   keys move inside it. That is the expected pattern for role="radiogroup". */
function wireRadioGroup(root, onSelect) {
	if (!root) return;

	const paint = () => {
		for (const el of $$(".pick", root)) {
			const on = el.getAttribute("aria-checked") === "true";
			el.tabIndex = on ? 0 : -1;
		}
	};

	const select = (el, focus) => {
		for (const other of $$(".pick", root)) {
			other.setAttribute("aria-checked", String(other === el));
		}
		paint();
		if (focus) el.focus();
		onSelect(el);
	};

	root.addEventListener("click", (e) => {
		const el = e.target.closest(".pick");
		if (el) select(el, false);
	});

	root.addEventListener("keydown", (e) => {
		const picks = $$(".pick", root);
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
	const moreCount = $("#more-count");
	if (!list) return null;

	// How many rows fit before the list asks permission to grow.
	const PAGE = 12;

	const params = new URLSearchParams(location.search);
	const data = packData;
	let group = params.get("group") || "all";
	let query = params.get("q") || "";
	let expanded = false;
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

	function renderMods(mods, animateFrom) {
		list.textContent = "";
		if (!mods.length) {
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
		for (const [i, mod] of mods.entries()) {
			const row = document.createElement("div");
			row.className = "mod";
			row.setAttribute("role", "listitem");
			// Only the rows that just appeared animate, so re-filtering the list
			// does not replay the cascade on rows that never moved.
			if (animateFrom !== undefined && i >= animateFrom) {
				row.classList.add("mod--enter");
				row.style.setProperty("--i", Math.min(i - animateFrom, 14));
			}

			const src = mod.icon && iconUrl(mod.icon);
			if (src) {
				const img = document.createElement("img");
				img.className = "mod__icon";
				img.src = src;
				img.alt = "";
				img.loading = "lazy";
				img.decoding = "async";
				img.width = 34;
				img.height = 34;
				img.addEventListener("error", () => img.replaceWith(monogram(mod.name)), {
					once: true
				});
				row.append(img);
			} else {
				row.append(monogram(mod.name));
			}

			const body = document.createElement("div");
			body.className = "mod__body";

			const name = document.createElement("div");
			name.className = "mod__name";
			const a = document.createElement("a");
			a.href = `https://modrinth.com/mod/${encodeURIComponent(mod.slug)}`;
			a.target = "_blank";
			a.rel = "noopener noreferrer";
			a.textContent = mod.name;
			name.append(a);

			if (mod.side !== "both") {
				const tag = document.createElement("span");
				tag.className = "mod__side";
				tag.dataset.side = mod.side;
				tag.textContent = mod.side;
				tag.title =
					mod.side === "client"
						? "Client only, not installed on servers"
						: "Server only";
				name.append(tag);
			}
			body.append(name);

			if (mod.blurb) {
				const desc = document.createElement("p");
				desc.className = "mod__desc";
				desc.textContent = mod.blurb;
				body.append(desc);
			}
			row.append(body);
			frag.append(row);
		}
		list.append(frag);
	}

	function paintMore(shown, visible) {
		const q = Boolean(query.trim());
		// A search is deliberate: show every hit rather than hiding rows behind
		// a button. Without a search, the button exists only if there is a tail.
		const needed = !q && shown.length > PAGE;
		moreEl.hidden = !needed;
		if (!needed) return;

		moreBtn.setAttribute("aria-expanded", String(expanded));
		moreLabel.textContent = expanded ? "Show fewer" : `Show all ${shown.length} mods`;
		moreCount.textContent = expanded ? "" : `Showing ${visible} of ${shown.length}`;
	}

	function sync() {
		const q = query.trim().toLowerCase();
		const inGroup = data.mods.filter((m) => group === "all" || m.group === group);
		const hits = q
			? inGroup.filter(
					(m) =>
						m.name.toLowerCase().includes(q) ||
						(m.blurb || "").toLowerCase().includes(q) ||
						(m.slug || "").toLowerCase().includes(q)
				)
			: inGroup;

		const visible = !q && !expanded ? Math.min(PAGE, hits.length) : hits.length;
		const from = animateFrom;
		animateFrom = null;
		renderMods(hits.slice(0, visible), from ?? undefined);

		const total = group === "all" ? data.curated : inGroup.length;
		countEl.textContent = q
			? `Showing ${hits.length} of ${total}`
			: `${total} mod${total === 1 ? "" : "s"}`;
		// Only worth saying when a group is selected, since "87 mods" and
		// "of 87 curated" next to each other say the same thing twice.
		if (sidesEl) sidesEl.textContent = q || group === "all" ? "" : `of ${data.curated} curated`;

		paintMore(hits, visible);
		wrapEl.dataset.filled = String(Boolean(q));

		const next = new URLSearchParams();
		if (group !== "all") next.set("group", group);
		if (query.trim()) next.set("q", query.trim());
		const qs = next.toString();
		history.replaceState(null, "", qs ? `?${qs}${location.hash}` : `${location.pathname}${location.hash}`);

		$$(".tab", tabsEl).forEach((t) =>
			t.setAttribute("aria-selected", String(t.dataset.group === group))
		);
		for (const bar of $$(".bar")) {
			bar.setAttribute("aria-pressed", String(bar.dataset.group === group));
		}
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
			desc: "Keeps the pack updated on its own. New versions land in your profile without you touching a file.",
			out: (v) => ({
				head: "Modrinth App",
				body: `Install the app and sign in, then open Zitrus from the button below and press Install. Choose ${v.minecraft} in the version dropdown to land on this exact build.`,
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
			desc: "Installs the pack as an instance and keeps Java, memory and rendering settings under your control.",
			out: (v) => ({
				head: "Prism Launcher",
				body: `In Prism, open Add Instance, switch the source to Modrinth and search for Zitrus. Create the instance for ${v.minecraft}, then set your Java version and memory before the first launch.`,
				acts: [{ label: "Open on Modrinth", href: MODRINTH }]
			})
		},
		{
			key: "curseforge",
			name: "CurseForge app",
			tag: "curseforge",
			desc: "Installs the pack from CurseForge, next to the rest of your modpacks, with dependency handling included.",
			out: (v) => ({
				head: "CurseForge app",
				body: `In the CurseForge app, open Minecraft, then Install a modpack and search for Zitrus. Pick ${v.minecraft}; the app downloads the pack and every dependency into a new profile.`,
				acts: [{ label: "Open on CurseForge", href: CURSEFORGE }]
			})
		},
		{
			key: "standalone",
			name: "Standalone",
			tag: "packwiz",
			desc: "No launcher. One command writes the profile, then you start Minecraft yourself.",
			out: (v) => ({
				head: "Standalone, packwiz",
				body: `Download packwiz-installer-bootstrap and put the jar in your instance folder. Run this once for ${v.minecraft}: it writes the profile and downloads the mods. Start Minecraft afterwards as usual.`,
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
		forEl.textContent = `${spec.head} · ${v.minecraft}`;
		head.append(forEl);

		const body = document.createElement("div");
		body.className = "wiz-out__body";

		const p = document.createElement("p");
		p.textContent = spec.body;
		body.append(p);

		const meta = document.createElement("p");
		meta.className = "wiz-out__meta";
		meta.textContent = `${v.packVersion} · ${v.total} mods installed`;
		body.append(meta);

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
				 <span class="v__n">${v.minecraft}</span>
				 <span class="v__c">${v.total} mods</span>`;
			versionsEl.append(b);
		}
	}

	for (const l of LAUNCHERS) {
		const b = document.createElement("button");
		b.className = "pick";
		b.type = "button";
		b.role = "radio";
		b.dataset.key = l.key;
		b.setAttribute("aria-checked", String(l === launcher));
		b.innerHTML =
			`<span class="pick__mark"></span>
			 <span class="pick__body">
				<span class="pick__name">${l.name}<span class="pick__tag">${l.tag}</span></span>
				<span class="pick__desc">${l.desc}</span>
			 </span>`;
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
