/**
 * Zitrus homepage behaviour. No dependencies, no build step.
 * Sections: theme, mobile drawer, sticky nav, scroll reveal, copy buttons,
 * hero panel, and the mod browser (tabs + search, filter state in the URL).
 */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

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
$$("[data-copy]").forEach((btn) => {
	const label = $("span", btn);
	btn.addEventListener("click", async () => {
		try {
			await navigator.clipboard.writeText(btn.dataset.copy);
		} catch {
			// Clipboard API needs a secure context; fall back to a selection.
			const ta = document.createElement("textarea");
			ta.value = btn.dataset.copy;
			ta.style.cssText = "position:fixed;opacity:0";
			document.body.append(ta);
			ta.select();
			document.execCommand("copy");
			ta.remove();
		}
		btn.dataset.done = "true";
		if (label) label.textContent = "Copied";
		setTimeout(() => {
			btn.dataset.done = "false";
			if (label) label.textContent = "Copy";
		}, 1600);
	});
});

/* ---------- Mod browser ------------------------------------------------ */
const browser = (async function modBrowser() {
	const list = $("#mod-list");
	const tabsEl = $("#tabs");
	const countEl = $("#browser-count");
	const sidesEl = $("#browser-sides");
	const searchEl = $("#search");
	const clearEl = $("#search-clear");
	const wrapEl = $("#search-wrap");
	if (!list) return null;

	const params = new URLSearchParams(location.search);
	let data;
	let group = params.get("group") || "all";
	let query = params.get("q") || "";

	function skeleton() {
		list.innerHTML = Array.from({ length: 8 })
			.map(
				() =>
					`<div class="mod" aria-hidden="true">
						<div class="mod__icon"></div>
						<div class="mod__body">
							<div style="height:13px;width:52%;border-radius:4px;background:var(--surface-2)"></div>
							<div style="height:11px;width:82%;margin-top:8px;border-radius:4px;background:var(--surface-2)"></div>
						</div>
					</div>`
			)
			.join("");
	}
	skeleton();

	function monogram(name) {
		const el = document.createElement("div");
		el.className = "mod__icon";
		el.textContent = name.trim()[0]?.toUpperCase() || "?";
		el.style.cssText =
			"display:grid;place-items:center;font-family:var(--font-mono);font-size:14px;color:var(--ink-3)";
		return el;
	}

	function renderMods(mods) {
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
				sync();
			});
			return;
		}

		const frag = document.createDocumentFragment();
		for (const mod of mods) {
			const row = document.createElement("div");
			row.className = "mod";
			row.setAttribute("role", "listitem");

			if (mod.icon) {
				const img = document.createElement("img");
				img.className = "mod__icon";
				img.src = mod.icon;
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

	function sync() {
		const q = query.trim().toLowerCase();
		const inGroup = data.mods.filter((m) => group === "all" || m.group === group);
		const shown = q
			? inGroup.filter(
					(m) =>
						m.name.toLowerCase().includes(q) ||
						(m.blurb || "").toLowerCase().includes(q) ||
						(m.slug || "").toLowerCase().includes(q)
				)
			: inGroup;

		renderMods(shown);

		const total = group === "all" ? data.curated : inGroup.length;
		countEl.textContent = q
			? `Showing ${shown.length} of ${total}`
			: `${total} mod${total === 1 ? "" : "s"}`;
		if (sidesEl) sidesEl.textContent = q ? "" : `of ${data.curated} curated`;

		wrapEl.dataset.filled = String(Boolean(q));

		const next = new URLSearchParams();
		if (group !== "all") next.set("group", group);
		if (query.trim()) next.set("q", query.trim());
		const qs = next.toString();
		history.replaceState(null, "", qs ? `?${qs}${location.hash}` : `${location.pathname}${location.hash}`);

		$$(".tab", tabsEl).forEach((t) =>
			t.setAttribute("aria-selected", String(t.dataset.group === group))
		);
	}

	try {
		data = await (await fetch("./assets/data/mods.json")).json();
	} catch {
		countEl.textContent = "Mod list unavailable";
		list.innerHTML =
			'<div class="empty"><p>The mod list could not be loaded.</p><p style="margin-top:10px">The full list is on the <a href="https://github.com/Bruderjulian/LemonlightModpack3#-whats-in-the-box" style="color:var(--accent-text)">README</a>.</p></div>';
		return null;
	}

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
			group = g.key;
			sync();
		});
		tabsEl.append(b);
	}

	let t;
	searchEl.addEventListener("input", () => {
		clearTimeout(t);
		t = setTimeout(() => {
			query = searchEl.value;
			sync();
		}, 90);
	});
	clearEl.addEventListener("click", () => {
		searchEl.value = "";
		query = "";
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
			(g, i) => `<div class="bar">
				<div class="bar__top"><span>${g.title}</span><span class="bar__n">${g.count}</span></div>
				<div class="bar__track"><span class="bar__fill" style="--w:${(g.count / max) * 100}%;--d:${i * 90}ms"></span></div>
			</div>`
		)
		.join("");
	// Let the first frame paint the empty track before the bars grow.
	requestAnimationFrame(() => requestAnimationFrame(() => barsEl.classList.add("is-in")));

	$("#p-versions-list").innerHTML = data.versions
		.map(
			(v) =>
				`<span class="chip chip--ver">${v.minecraft}${
					v.minecraft === data.latest ? ' <span style="color:var(--accent-text)">*</span>' : ""
				}</span>`
		)
		.join("");

	$("#foot-ver").textContent = `${data.latest} · ${data.versions.length} versions · ${data.total} mods`;
	return { sync };
})();
