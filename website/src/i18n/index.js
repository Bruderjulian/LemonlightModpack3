/**
 * Tiny i18n layer. No framework, no runtime fetch: the dictionaries are
 * static ES modules, so they bundle with main.js and the page keeps making no
 * network calls beyond the two font files.
 *
 * Three ways to mark up a translatable string in index.html:
 *
 *   data-i18n="key"                  -> textContent
 *   data-i18n-html="key"             -> innerHTML, for inline emphasis only
 *   data-i18n-attr="aria-label:key"  -> attributes, several separated by ";"
 *
 * Plural messages are objects keyed by CLDR category rather than "one/other",
 * because Russian needs one/few/many and a hand-rolled one/other pair would
 * get it wrong:
 *
 *   browser.addons: { one: "+ {n} addon", other: "+ {n} addons" }
 *
 * The chosen locale lives in localStorage, like the theme. ?lang= in the URL
 * wins over everything and is written on an explicit choice, so a link can
 * pin a language. Before that, navigator.languages decides.
 */

import en from "./locales/en.js";
import de from "./locales/de.js";
import es from "./locales/es.js";
import fr from "./locales/fr.js";
import ru from "./locales/ru.js";
import zh from "./locales/zh.js";

const DICTIONARIES = { en, de, es, fr, ru, zh };

export const DEFAULT_LOCALE = "en";

/* The picker shows each language in its own name, with the English name as a
   quieter qualifier for anyone who does not read that script. Native names
   are what a reader scans for. English needs no qualifier: its native and
   English names are the same word, and printing both is noise. */
export const LOCALES = [
	{ code: "en", native: "English", english: "English" },
	{ code: "de", native: "Deutsch", english: "German" },
	{ code: "es", native: "Español", english: "Spanish" },
	{ code: "fr", native: "Français", english: "French" },
	{ code: "ru", native: "Русский", english: "Russian" },
	{ code: "zh", native: "简体中文", english: "Chinese (Simplified)" }
];

const STORAGE_KEY = "zitrus-lang";
const listeners = new Set();

let locale = DEFAULT_LOCALE;
const pluralRules = new Map();

/** Plural rules per locale, built once. */
function rulesFor(code) {
	if (!pluralRules.has(code)) {
		pluralRules.set(code, new Intl.PluralRules(code));
	}
	return pluralRules.get(code);
}

/** Whether a code is one we ship. Object.hasOwn, not a truthiness test: the
    dictionary is a plain object, so "constructor" and "toString" are inherited
    and truthy. Accepting one of those as a locale hands it to
    Intl.PluralRules, which throws on it and takes the page down with it. */
const shipped = (code) => Object.hasOwn(DICTIONARIES, code);

/** Resolves a locale tag such as "de-AT" or "zh-Hans-CN" to a shipped code. */
function normalise(tag) {
	const raw = String(tag || "").trim().toLowerCase().replace(/_/g, "-");
	if (!raw) return null;
	if (shipped(raw)) return raw;
	// A region is never a reason to miss: pt-BR reads fine as pt, zh-Hant-CN
	// as zh. Only the primary subtag matters here.
	const base = raw.split("-")[0];
	return shipped(base) ? base : null;
}

/** Reads the ?lang= parameter without disturbing the other filters. */
function fromQuery() {
	try {
		return normalise(new URLSearchParams(location.search).get("lang"));
	} catch {
		return null;
	}
}

function fromStorage() {
	try {
		return normalise(localStorage.getItem(STORAGE_KEY));
	} catch {
		return null;
	}
}

function fromBrowser() {
	const tags = navigator.languages?.length ? navigator.languages : [navigator.language];
	for (const tag of tags) {
		const hit = normalise(tag);
		if (hit) return hit;
	}
	return null;
}

/** Query string wins, then the reader's own choice, then the browser. */
export function detectLocale() {
	return fromQuery() ?? fromStorage() ?? fromBrowser() ?? DEFAULT_LOCALE;
}

export const getLocale = () => locale;

/**
 * Translates a key for the active locale.
 *
 * Placeholders are {name} and are filled from `vars`. A missing key returns
 * the key itself rather than an empty string: a blank label is invisible in a
 * screenshot, a stray key is not. `fallback` is for data-driven labels, where
 * English already exists in the generated JSON.
 */
export function t(key, vars = {}, fallback) {
	const dict = DICTIONARIES[locale] || DICTIONARIES[DEFAULT_LOCALE];
	let entry = dict[key];
	if (entry === undefined) entry = DICTIONARIES[DEFAULT_LOCALE][key];
	if (entry === undefined) return fallback ?? key;

	if (entry && typeof entry === "object") {
		// A plural message. The count is "n" by convention; category fallbacks
		// walk few -> many -> other so a locale only needs the forms it uses.
		const count = Number(vars.n ?? 0);
		const cat = rulesFor(locale).select(count);
		entry = entry[cat] ?? entry.other ?? entry.many ?? entry.one;
	}

	const filled = { ...vars };
	for (const [name, value] of Object.entries(filled)) {
		if (value === undefined || value === null) delete filled[name];
	}

	return String(entry).replace(/\{(\w+)\}/g, (match, name) =>
		name in filled ? String(filled[name]) : match
	);
}

/** Subscribes to locale changes. Returns an unsubscribe function. */
export const onLocaleChange = (fn) => {
	listeners.add(fn);
	return () => listeners.delete(fn);
};

const ATTR_PAIRS = /([a-z-]+):([\w.]+)/g;

/**
 * Walks the marked-up nodes and writes the active locale into them. Runs on
 * load and again on every change, which is why nothing caches a translated
 * string in a variable.
 */
export function applyTranslations(root = document) {
	for (const el of root.querySelectorAll("[data-i18n]")) {
		el.textContent = t(el.dataset.i18n);
	}
	for (const el of root.querySelectorAll("[data-i18n-html]")) {
		// Trusted authored copy, not user input. The only markup used in these
		// messages is <em>.
		el.innerHTML = t(el.dataset.i18nHtml);
	}
	for (const el of root.querySelectorAll("[data-i18n-attr]")) {
		for (const [, attr, key] of el.dataset.i18nAttr.matchAll(ATTR_PAIRS)) {
			el.setAttribute(attr, t(key));
		}
	}
}

/** The document-level strings that are not inside a marked-up element. */
function applyDocument() {
	const root = document.documentElement;
	root.lang = locale;
	// Every shipped language is left to right. Kept explicit so adding an RTL
	// one later is a data change rather than a layout surprise.
	root.dir = "ltr";

	document.title = t("meta.title");
	// og: and twitter: carry the same three strings, so they move together. A
	// shared preview that reads "Zitrus" and nothing else is worse than one
	// that is at least consistent with the page.
	for (const [selector, key] of [
		['meta[name="description"]', "meta.description"],
		['meta[property="og:title"]', "meta.title"],
		['meta[property="og:description"]', "meta.ogDescription"],
		['meta[name="twitter:title"]', "meta.title"],
		['meta[name="twitter:description"]', "meta.ogDescription"]
	]) {
		const el = document.querySelector(selector);
		if (el) el.setAttribute("content", t(key));
	}
}

/**
 * Switches language, persists the choice and mirrors it into ?lang= so the
 * URL can be shared. Pass `silent` while bootstrapping: the first apply is
 * not a change the listeners need to hear about, and re-rendering the whole
 * mod browser twice on load is wasted work.
 */
export function setLocale(code, { persist = true, silent = false, mirror = true } = {}) {
	const next = normalise(code) || DEFAULT_LOCALE;
	const changed = next !== locale;
	locale = next;

	if (persist) {
		try {
			localStorage.setItem(STORAGE_KEY, next);
		} catch {}
	}
	if (mirror) {
		const params = new URLSearchParams(location.search);
		if (params.get("lang") === next) {
			// Already right; leave history alone so no entry is added.
		} else {
			params.set("lang", next);
			history.replaceState(null, "", `${location.pathname}?${params}${location.hash}`);
		}
	}

	applyDocument();
	applyTranslations();
	if (!silent) for (const fn of listeners) fn(locale);
	return locale;
}

/**
 * Boots the locale before first paint. The dictionaries are already in the
 * bundle, so this is synchronous and the page never renders English first.
 */
export function initI18n() {
	locale = detectLocale();
	applyDocument();
	applyTranslations();
	return locale;
}