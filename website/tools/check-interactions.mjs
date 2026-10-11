/**
 * Interaction smoke test for the homepage: theme toggle, group tabs, search,
 * URL filter state, the empty state, mobile drawer and copy buttons.
 *
 * Run: node website/tools/check-interactions.mjs  (needs the dev server up)
 */

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME =
	process.env.CHROME_PATH ||
	"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL_UNDER_TEST = process.argv[2] || "http://localhost:8791/";
const PORT = 9334;

const chrome = spawn(CHROME, [
	"--headless",
	"--disable-gpu",
	`--remote-debugging-port=${PORT}`,
	"--user-data-dir=" + process.env.TEMP + "\\zitrus-cdp2",
	"about:blank"
]);

async function firstTarget() {
	for (let i = 0; i < 40; i++) {
		try {
			const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
			const list = await res.json();
			if (list.length) return list[0];
		} catch {}
		await sleep(250);
	}
	throw new Error("chrome never came up");
}

const ws = new WebSocket((await firstTarget()).webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let id = 0;
const pending = new Map();
const events = new Map();
ws.onmessage = (e) => {
	const m = JSON.parse(e.data);
	if (m.id && pending.has(m.id)) {
		pending.get(m.id)(m);
		pending.delete(m.id);
	} else if (m.method && events.has(m.method)) {
		events.get(m.method)();
		events.delete(m.method);
	}
};
const send = (method, params = {}) =>
	new Promise((res) => {
		const n = ++id;
		pending.set(n, res);
		ws.send(JSON.stringify({ id: n, method, params }));
	});
const once = (method, ms = 15000) =>
	new Promise((res, rej) => {
		const t = setTimeout(() => rej(new Error(`timeout ${method}`)), ms);
		events.set(method, () => {
			clearTimeout(t);
			res();
		});
	});

await send("Page.enable");
await send("Runtime.enable");
await send("Emulation.setDeviceMetricsOverride", {
	width: 1280,
	height: 900,
	deviceScaleFactor: 1,
	mobile: false
});
// Register the waiter before navigating, otherwise the event can land first.
const loaded = once("Page.loadEventFired");
await send("Page.navigate", { url: URL_UNDER_TEST });
await loaded;
await sleep(700);

const evalJs = async (expression) => {
	const r = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
	if (r.result?.exceptionDetails) {
		throw new Error(r.result.exceptionDetails.exception?.description || "eval failed");
	}
	return r.result.result.value;
};

const results = [];
const check = (name, pass, detail = "") =>
	results.push({ name, pass: pass ? "PASS" : "FAIL", detail });

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
		tabTest[0].rows === 87,
	JSON.stringify(tabTest.map((t) => `${t.group}:${t.rows}`))
);
check(
	"filter state lands in the URL",
	tabTest.find((t) => t.group === "performance").search === "?group=performance",
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
	searchTest.hit.rows > 0 && searchTest.hit.names.some((n) => /sodium/i.test(n)),
	JSON.stringify(searchTest.hit.names)
);
check(
	"search count reports showing X of Y",
	/Showing \d+ of \d+/.test(searchTest.hit.count),
	searchTest.hit.count
);
check(
	"empty state composes and recovers",
	searchTest.empty.rows === 0 && searchTest.empty.hasEmpty && searchTest.after.rows === 87 && searchTest.after.inp === "",
	JSON.stringify(searchTest.empty)
);
check(
	"clearing search resets the URL",
	searchTest.after.url === "",
	searchTest.after.url
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
check("copy button gives feedback", copyTest.label === "Copied" && copyTest.done === "true", copyTest.label);

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
	themeTest.before !== themeTest.after && themeTest.stored === themeTest.attr && themeTest.restored === themeTest.before,
	JSON.stringify(themeTest)
);

// Reveal + bars
const motionTest = await evalJs(`(async () => {
	document.getElementById('mods').scrollIntoView();
	await new Promise(r => setTimeout(r, 900));
	return {
		revealed: document.querySelectorAll('[data-reveal].is-in').length,
		bars: document.getElementById('p-bars').classList.contains('is-in')
	};
})()`);
check("scroll reveal fires", motionTest.revealed > 0, `${motionTest.revealed} revealed`);
check("hero bars animate in", motionTest.bars === true, String(motionTest.bars));

// Mobile drawer
await send("Emulation.setDeviceMetricsOverride", {
	width: 390,
	height: 844,
	deviceScaleFactor: 2,
	mobile: true
});
// Register the waiter before navigating, otherwise the event can land first.
const loaded2 = once("Page.loadEventFired");
await send("Page.navigate", { url: URL_UNDER_TEST });
await loaded2;
await sleep(700);
const drawerTest = await evalJs(`(async () => {
	const d = document.getElementById('drawer');
	const b = document.getElementById('burger');
	const closed = getComputedStyle(d).display;
	b.click();
	await new Promise(r => setTimeout(r, 80));
	const open = getComputedStyle(d).display;
	const burgerVisible = getComputedStyle(b).display !== 'none';
	document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'}));
	await new Promise(r => setTimeout(r, 80));
	return { closed, open, burgerVisible, afterEsc: getComputedStyle(d).display, expanded: b.getAttribute('aria-expanded') };
})()`);
check(
	"drawer hidden on desktop, opens on mobile, closes on Escape",
	drawerTest.closed === "none" && drawerTest.open === "block" && drawerTest.burgerVisible && drawerTest.afterEsc === "none",
	JSON.stringify(drawerTest)
);

const failed = results.filter((r) => r.pass === "FAIL");
for (const r of results) {
	console.log(`${r.pass}  ${r.name}${r.detail ? "  (" + r.detail.slice(0, 90) + ")" : ""}`);
}
console.log(failed.length ? `\n${failed.length} failing` : `\nall ${results.length} interactions pass`);

ws.close();
chrome.kill();
process.exit(failed.length ? 1 : 0);
