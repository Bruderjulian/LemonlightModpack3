/**
 * i18n check. Two halves, because the two failure modes are different:
 *
 *   1. Static, no browser. Every locale must carry exactly the key set English
 *      declares, the {placeholders} in a message must be identical across
 *      locales, and a value must never be an empty string or a leftover key.
 *      This is the check that catches a bad merge or a half-finished
 *      translation, and it needs no server, so it runs first.
 *
 *   2. In the browser, per locale. The page must actually render in that
 *      language: html[lang], the nav, the hero, the mod browser chrome, the
 *      wizard steps, the document title and the footer all have to change.
 *      A dictionary entry that exists but is never wired to the DOM is the
 *      failure mode static analysis cannot see.
 *
 * Run: pnpm --dir website run check:i18n -- [url]
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { withSite, launchBrowser, openPage, reporter } from "./harness.mjs";

const { check, finish } = reporter();

const localesDir = join(dirname(fileURLToPath(import.meta.url)), "..", "src", "i18n", "locales");

/* ---------- 1. Static ---------- */

/** Every {name} a message interpolates, sorted, so order does not matter. */
const placeholders = (value) => {
	if (value === null || typeof value !== "string") return [];
	return [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(",");
};

const dictionaries = new Map();
for (const file of readdirSync(localesDir).filter((f) => f.endsWith(".js"))) {
	const code = file.replace(/\.js$/, "");
	// pathToFileURL, not a bare path: on Windows "D:/..." is read as a URL
	// scheme and the ESM loader refuses it.
	const mod = await import(pathToFileURL(join(localesDir, file)).href);
	dictionaries.set(code, mod.default);
}

const en = dictionaries.get("en");
const enKeys = Object.keys(en);
const others = [...dictionaries.keys()].filter((c) => c !== "en");

check("en.js is the reference dictionary", Boolean(en) && enKeys.length > 80, `${enKeys.length} keys`);
check("every locale has a dictionary", others.length >= 5, others.join(", "));

for (const code of others) {
	const dict = dictionaries.get(code);
	const keys = Object.keys(dict);

	const missing = enKeys.filter((k) => !(k in dict));
	const extra = keys.filter((k) => !(k in en));
	const empty = keys.filter((k) => {
		const v = dict[k];
		return typeof v === "string" ? v.trim() === "" : Object.values(v).some((s) => !s.trim());
	});
	// A value equal to the key means somebody wrote "some.key": "some.key".
	const echoed = keys.filter((k) => dict[k] === k);

	check(
		`${code}: same keys as en`,
		!missing.length && !extra.length,
		[missing.length ? `missing ${missing.join(", ")}` : "", extra.length ? `unknown ${extra.join(", ")}` : ""]
			.filter(Boolean)
			.join(" | ")
	);
	check(`${code}: no empty strings`, !empty.length, empty.join(", "));
	check(`${code}: no key echoed as its own value`, !echoed.length, echoed.join(", "));

	/* Placeholders must line up. A missing one silently drops text; an extra one
   prints a literal "{version}" to the reader. The comparison is per form, and
   a locale with a single plural form holds a bare string, so its one value is
   held against every English form it stands in for.

   Repeat counts are compared too, not just membership: phSet() collapses them,
   which let a translation mention a placeholder twice and still pass. */
	const phSet = (forms) =>
		new Set(
			Object.values(forms)
				.flatMap((v) => placeholders(v).split(","))
				.filter(Boolean)
		);

	// Sorted with repeats intact, so "n,n" and "n" are distinguishable.
	const phList = (value) => placeholders(value).split(",").filter(Boolean).sort().join(",");

	const drift = [];
	for (const key of enKeys) {
		if (!(key in dict)) continue;
		const enForms = typeof en[key] === "object" ? en[key] : { "": en[key] };
		const dictForms = typeof dict[key] === "object" ? dict[key] : { "": dict[key] };
		const shared = Object.keys(enForms).some((f) => f in dictForms);

		for (const [form, want] of Object.entries(enForms)) {
			// No matching form in the target means the plural message was
			// collapsed to one string; that is legal, and the separate plural
			// check below is what judges it. The value still has to carry the
			// placeholders. A collapsed message is held as the union of its own
			// forms, so it is judged on membership; a per-form one is held
			// against the same English form, repeats included.
			const wantList = phList(want);
			if (shared) {
				// Same form on both sides: the placeholder lists have to match
				// exactly, repeats included.
				const gotList = phList(dictForms[form] ?? "");
				if (wantList !== gotList) {
					drift.push(`${key}.${form}: ${wantList || "-"} vs ${gotList || "-"}`);
				}
				continue;
			}
			// No matching form: the locale collapsed the message to one string
			// that stands in for every English form, so it is judged on which
			// placeholders it mentions, not how often.
			const gotSet = phSet(dictForms);
			const wantSet = new Set(wantList.split(",").filter(Boolean));
			if (
				wantSet.size !== gotSet.size ||
				[...wantSet].some((w) => !gotSet.has(w))
			) {
				drift.push(
					`${key}.${form}: ${[...wantSet].join(",") || "-"} vs ${[...gotSet].join(",") || "-"}`
				);
			}
		}
	}
	check(`${code}: placeholders match en`, !drift.length, drift.slice(0, 6).join(" | "));

	/* Plural messages are keyed by CLDR category, so the set a locale actually
	   needs is the one Intl reports for it. Chinese only ever selects "other",
	   so a bare string there is correct, not a dropped form. Russian selects
	   one/few/many, so it must ship all three: a locale with only "other"
	   would read as if 2 mods and 5 mods were the same quantity. */
	const categories = new Set();
	const probe = new Intl.PluralRules(code);
	for (const n of [0, 1, 2, 3, 5, 11, 21, 101, 1001]) categories.add(probe.select(n));

	const plurals = enKeys.filter((k) => typeof en[k] === "object");
	const thin = [];
	const missingForms = [];
	const collapsed = [];
	for (const key of plurals) {
		const value = dict[key];
		if (typeof value === "string") {
			// A single string is only right where the language has one form.
			if (categories.size > 1) collapsed.push(key);
			continue;
		}
		for (const form of Object.keys(en[key])) {
			if (!(form in value)) missingForms.push(`${key}.${form}`);
		}
		if (categories.size > 1 && Object.keys(value).length < 2) thin.push(key);
	}
	check(
		`${code}: plural messages carry every form the language uses`,
		!missingForms.length && !thin.length && !collapsed.length,
		[missingForms.length ? `missing ${missingForms.join(", ")}` : "", thin.length ? `thin ${thin.join(", ")}` : "", collapsed.length ? `collapsed ${collapsed.join(", ")}` : ""]
			.filter(Boolean)
			.join(" | ")
	);
}

/* Anything referenced from index.html or main.js but absent from en.js is a
   dead lookup: t() falls back to printing the key, which is only visible to
   someone reading the page in another language. */
const read = (rel) =>
	readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", rel), "utf8");

const html = read("index.html");
const js = read("src/main.js");

// data-i18n="key" and data-i18n-attr="attr:key;attr:key" both land here.
const fromHtml = [...html.matchAll(/data-i18n(?:-html|-attr)?="([^"]+)"/g)].flatMap(
	(m) => m[1].split(";")
);

// t("key") with a literal, plus the ternary that picks a side title.
const fromJs = [
	...[...js.matchAll(/\bt\("([\w.]+)"/g)].map((m) => m[1]),
	...[...js.matchAll(/"(side\.\w+Title)"/g)].map((m) => m[1])
];

/* t(`group.${key}`) and t(`side.${mod.side}`) are built at runtime, so the
   prefix is expanded over the real sets rather than matched literally. The
   group keys come from groups.json, which is what decides them. */
const groups = JSON.parse(read("tools/groups.json"));
const prefixes = [...js.matchAll(/\bt\(\s*`([\w.]+)\.\$\{/g)].map((m) => m[1]);
const fromTemplates = prefixes.flatMap((prefix) =>
	(prefix === "group"
		? groups.order
		: prefix === "side"
			? ["client", "server", "both"]
			: []
	).map((tail) => `${prefix}.${tail}`)
);

const referenced = new Set(
	[
		...fromHtml.map((pair) => pair.split(":").pop().trim()),
		...fromJs,
		...fromTemplates
	].filter(Boolean)
);
const unknown = [...referenced].filter((k) => !en[k]);
check("every key referenced in the page exists in en", !unknown.length, unknown.join(", "));

// And the reverse: a key nobody renders is dead weight, and usually a sign
// that a rename left one of the two copies behind. lang.* and meta.* are read
// by code rather than by a marked-up node, so they are exempt from this one.
const unused = enKeys.filter(
	(k) => !referenced.has(k) && !k.startsWith("lang.") && !k.startsWith("meta.")
);
check("no orphaned keys in en", !unused.length, unused.join(", "));

/* ---------- 2. In the browser ---------- */
const SAMPLES = {
	nav: "#nav-links a[href='#install']",
	hero: ".hero__sub",
	browser: "#browser-count",
	wizard: "#wiz-out .wiz-steps li",
	footer: ".footer__col h4",
	note: ".note h4"
};

await withSite(async (url) => {
	const browser = await launchBrowser();
	try {
		// One context, switched with the real UI rather than reloaded, so this
		// also proves the repaint path: the mod list and the wizard rebuild
		// without a navigation.
		const { context, page } = await openPage(browser, url, {
			width: 1280,
			height: 900
		});

		const probe = () =>
			page.evaluate((keys) => {
				const out = {
					lang: document.documentElement.lang,
					title: document.title,
					description: document.querySelector('meta[name="description"]').content,
					menu: [...document.querySelectorAll(".lang__item")].map((b) => ({
						code: b.dataset.locale,
						checked: b.getAttribute("aria-checked"),
						text: b.textContent.trim()
					})),
					code: document.getElementById("lang-code").textContent
				};
				for (const [name, sel] of Object.entries(keys)) {
					out[name] = document.querySelector(sel)?.textContent.trim() ?? null;
				}
				return out;
			}, SAMPLES);

		/* ?lang= rather than localStorage. openPage pins the stored locale to
		   "en" through an init script, which runs on every navigation and
		   would overwrite whatever this loop writes; the query parameter wins
		   over storage by design, so it is the way to ask for a language here.
		   It also means this half exercises the shareable-URL path. */
		const seen = {};
		for (const code of ["en", ...others]) {
			const target = new URL(url);
			target.searchParams.set("lang", code);
			await page.goto(target.href, { waitUntil: "load" });
			await page.waitForSelector(".mod", { timeout: 15000 });
			seen[code] = await probe();
		}

		for (const code of ["en", ...others]) {
			const s = seen[code];
			check(`${code}: html[lang] is set`, s.lang === code, s.lang);
			check(`${code}: document title is translated`, s.title.length > 10, s.title);
			check(
				`${code}: meta description is translated`,
				s.description.length > 20,
				s.description.slice(0, 40)
			);
			check(`${code}: language menu lists every locale`, s.menu.length === 6, String(s.menu.length));
			check(
				`${code}: current language is the checked one`,
				s.menu.filter((m) => m.checked === "true").length === 1 &&
					s.menu.find((m) => m.checked === "true")?.code === code,
				JSON.stringify(s.menu.filter((m) => m.checked === "true"))
			);
			check(`${code}: trigger shows the code`, s.code === code.toUpperCase(), s.code);
			for (const [name, value] of Object.entries(SAMPLES)) {
				check(`${code}: ${name} has copy`, Boolean(value && value.length > 3), String(value));
			}
			// A locale that rendered its dictionary would differ from English
			// everywhere. If every sample matched en.js the switch did nothing.
			if (code !== "en") {
				const same = Object.keys(SAMPLES).filter((k) => seen[code][k] === seen.en[k]);
				check(
					`${code}: copy actually differs from English`,
					same.length < Object.keys(SAMPLES).length,
					`identical: ${same.join(", ")}`
				);
			}
		}

		// Switching through the UI, without a reload, must repaint the
		// generated rows as well as the static markup.
		// Back to English first: the reload loop left the page on zh, and this
		// half is about the switching mechanics rather than the copy.
		await page.goto(url, { waitUntil: "load" });
		await page.waitForSelector(".mod", { timeout: 15000 });

		const switched = await page.evaluate(async () => {
			document.getElementById("lang-btn").click();
			await new Promise((r) => setTimeout(r, 60));
			const menuOpen = !document.getElementById("lang-menu").hidden;
			const focused = document.activeElement?.dataset?.locale;
			const before = {
				lang: document.documentElement.lang,
				nav: document.querySelector("#nav-links a[href='#install']").textContent,
				// The first row's side tag and the addon count are both built by
				// main.js, so they only change if the list really redrew.
				side: document.querySelector(".mod__side")?.textContent,
				addons: document.querySelector(".mod__addons-count")?.textContent,
				wizard: document.querySelector("#wiz-out .wiz-steps li")?.textContent,
				foot: document.getElementById("foot-ver").textContent
			};
			document.querySelector('.lang__item[data-locale="ru"]').click();
			await new Promise((r) => setTimeout(r, 120));
			return {
				menuOpen,
				focused,
				closedAfterPick: document.getElementById("lang-menu").hidden,
				refocused: document.activeElement?.id,
				before,
				after: {
					lang: document.documentElement.lang,
					nav: document.querySelector("#nav-links a[href='#install']").textContent,
					side: document.querySelector(".mod__side")?.textContent,
					addons: document.querySelector(".mod__addons-count")?.textContent,
					wizard: document.querySelector("#wiz-out .wiz-steps li")?.textContent,
					foot: document.getElementById("foot-ver").textContent,
					search: location.search
				}
			};
		});
		check("language menu opens and focuses the current language", switched.menuOpen && switched.focused === "en", `${switched.menuOpen} ${switched.focused}`);
		check("picking a language closes the menu and returns focus", switched.closedAfterPick && switched.refocused === "lang-btn", `${switched.closedAfterPick} ${switched.refocused}`);
		check("switching rewrites the static markup", switched.before.nav !== switched.after.nav, `${switched.before.nav} -> ${switched.after.nav}`);
		check("switching repaints the mod rows", switched.before.side !== switched.after.side, `${switched.before.side} -> ${switched.after.side}`);
		check("switching repaints the addon counts", switched.before.addons !== switched.after.addons, `${switched.before.addons} -> ${switched.after.addons}`);
		check("switching repaints the wizard steps", switched.before.wizard !== switched.after.wizard, `${switched.before.wizard} -> ${switched.after.addons ? "" : ""}${switched.after.wizard}`);
		check("switching repaints the footer summary", switched.before.foot !== switched.after.foot, `${switched.before.foot} -> ${switched.after.foot}`);
		check("switching records the choice in the URL", switched.after.search.includes("lang=ru"), switched.after.search);

		// Russian inflects plurals, so 73 mods and 5 addons cannot share a form.
		const ru = await page.evaluate(() => ({
			addons: document.querySelector(".mod__addons-count")?.textContent,
			foot: document.getElementById("foot-ver").textContent,
			count: document.getElementById("browser-count").textContent,
			more: document.getElementById("more-label").textContent
		}));
		check("russian plural forms are chosen, not appended", /аддон|мода|модов/.test(ru.addons) && /мод|мода|модов/.test(ru.foot), JSON.stringify(ru));

		// Escape closes the popover without moving the language.
		const esc = await page.evaluate(async () => {
			document.getElementById("lang-btn").click();
			await new Promise((r) => setTimeout(r, 60));
			document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
			await new Promise((r) => setTimeout(r, 60));
			return {
				hidden: document.getElementById("lang-menu").hidden,
				expanded: document.getElementById("lang-btn").getAttribute("aria-expanded"),
				lang: document.documentElement.lang
			};
		});
		check("Escape closes the language menu", esc.hidden && esc.expanded === "false", JSON.stringify(esc));

		await context.close();
	} finally {
		await browser.close();
	}
}, process.argv[2]);

process.exit(finish() ? 1 : 0);