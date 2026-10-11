/**
 * Layout check: loads the homepage at several widths in headless Chrome and
 * reports any element whose box escapes the viewport, plus a few page metrics.
 *
 * Run: node website/tools/check-layout.mjs
 */

import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME =
	process.env.CHROME_PATH ||
	"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const URL_UNDER_TEST = process.argv[2] || "http://localhost:8791/";
const WIDTHS = [360, 390, 768, 1024, 1280, 1440];
const PORT = 9333;

const chrome = spawn(CHROME, [
	"--headless",
	"--disable-gpu",
	"--hide-scrollbars",
	`--remote-debugging-port=${PORT}`,
	"--user-data-dir=" + process.env.TEMP + "\\zitrus-cdp",
	"about:blank"
]);

async function targets() {
	for (let i = 0; i < 40; i++) {
		try {
			const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
			const list = await res.json();
			if (list.length) return list;
		} catch {}
		await sleep(250);
	}
	throw new Error("chrome never came up");
}

const list = await targets();
const ws = new WebSocket(list[0].webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));

let id = 0;
const pending = new Map();
const events = new Map();
ws.onmessage = (e) => {
	const msg = JSON.parse(e.data);
	if (msg.id && pending.has(msg.id)) {
		pending.get(msg.id)(msg);
		pending.delete(msg.id);
	} else if (msg.method && events.has(msg.method)) {
		events.get(msg.method)();
		events.delete(msg.method);
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
		const timer = setTimeout(() => rej(new Error(`timeout waiting ${method}`)), ms);
		events.set(method, () => {
			clearTimeout(timer);
			res();
		});
	});

await send("Page.enable");
await send("Runtime.enable");

const evaluate = async (expr) => {
	const r = await send("Runtime.evaluate", {
		expression: expr,
		returnByValue: true,
		awaitPromise: true
	});
	if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails));
	return r.result.result.value;
};

const PROBE = `(async () => {
	await document.fonts.ready;
	await new Promise(r => setTimeout(r, 600));
	const vw = document.documentElement.clientWidth;
	const scrolls = (el) => {
		const ox = getComputedStyle(el).overflowX;
		return ox === 'auto' || ox === 'scroll' || ox === 'hidden' || ox === 'clip';
	};
	const over = [];
	for (const el of document.querySelectorAll('body *')) {
		const r = el.getBoundingClientRect();
		if (r.width === 0 && r.height === 0) continue;
		if (r.right <= vw + 1 && r.left >= -1) continue;
		if (getComputedStyle(el).position === 'fixed') continue;
		// An element that lives inside its own scroll container is fine.
		let a = el.parentElement, inScroller = false;
		while (a && a !== document.body) { if (scrolls(a)) { inScroller = true; break; } a = a.parentElement; }
		if (inScroller) continue;
		over.push(el.tagName.toLowerCase() + '.' + String(el.className).split(' ')[0]
			+ ' [L' + Math.round(r.left) + ' R' + Math.round(r.right) + ']');
	}
	const nav = document.querySelector('.nav__in');
	const wrapping = [...document.querySelectorAll('.btn')]
		.filter(b => b.scrollHeight > b.clientHeight + 1)
		.map(b => b.textContent.trim());
	return {
		vw,
		scrollW: document.documentElement.scrollWidth,
		overflow: [...new Set(over)].slice(0, 12),
		navH: Math.round(nav ? nav.getBoundingClientRect().height : 0),
		mods: document.querySelectorAll('.mod').length,
		count: document.getElementById('browser-count')?.textContent,
		total: document.getElementById('p-total')?.textContent,
		wrapping
	};
})()`;

let failures = 0;
for (const w of WIDTHS) {
	await send("Emulation.setDeviceMetricsOverride", {
		width: w,
		height: 900,
		deviceScaleFactor: 1,
		mobile: w < 768
	});
	await send("Page.navigate", { url: URL_UNDER_TEST });
	await once("Page.loadEventFired");
	await sleep(400);
	const r = await evaluate(PROBE);
	const bad = r.scrollW > r.vw + 1 || r.overflow.length || r.wrapping.length;
	if (bad) failures++;
	console.log(
		`${String(w).padStart(4)}px  scrollW=${String(r.scrollW).padStart(4)}  mods=${String(r.mods).padStart(2)}  ` +
			`nav=${r.navH}  ${r.count || ""}  ${bad ? "PROBLEM: " + [...r.overflow, ...r.wrapping].join(" | ") : "ok"}`
	);
}

console.log(failures ? `\n${failures} layout problem(s)` : "\nlayout clean at all widths");
ws.close();
chrome.kill();
process.exit(failures ? 1 : 0);
