/**
 * Screenshots the homepage at exact CSS viewports through the DevTools
 * protocol. Chrome's --window-size flag does not reliably set the layout
 * viewport, which produces misleadingly cropped captures.
 *
 * Run: node website/tools/shoot.mjs [outDir] [url]
 */

import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME =
	process.env.CHROME_PATH ||
	"C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const OUT = process.argv[2] || process.env.TEMP;
const URL_UNDER_TEST = process.argv[3] || "http://localhost:8791/";
const PORT = 9335;

const SHOTS = [
	{ name: "desktop-dark", width: 1440, height: 900, theme: "dark", full: true },
	{ name: "desktop-light", width: 1440, height: 900, theme: "light", full: true },
	{ name: "mobile", width: 390, height: 844, theme: "dark", full: true },
	{ name: "mobile-light", width: 390, height: 844, theme: "light", full: true }
];

mkdirSync(OUT, { recursive: true });

const chrome = spawn(CHROME, [
	"--headless",
	"--disable-gpu",
	"--hide-scrollbars",
	`--remote-debugging-port=${PORT}`,
	"--user-data-dir=" + process.env.TEMP + "\\zitrus-shoot",
	"about:blank"
]);

async function firstTarget() {
	for (let i = 0; i < 40; i++) {
		try {
			const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
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

// Polling readyState beats waiting on Page.loadEventFired: the event can land
// before the waiter is registered, and the page is small enough that this
// costs nothing.
const waitForReady = async (timeoutMs = 15000) => {
	const started = Date.now();
	while (Date.now() - started < timeoutMs) {
		const r = await send("Runtime.evaluate", {
			expression: "document.readyState + '|' + location.href",
			returnByValue: true
		});
		const v = r.result?.result?.value || "";
		if (v.startsWith("complete")) return v;
		await sleep(120);
	}
	throw new Error("page never reached readyState=complete");
};

await send("Page.enable");
await send("Runtime.enable");

for (const shot of SHOTS) {
	await send("Emulation.setDeviceMetricsOverride", {
		width: shot.width,
		height: shot.height,
		deviceScaleFactor: 1,
		mobile: shot.width < 768
	});
	// Pin the theme before the page's own script reads storage.
	await send("Page.addScriptToEvaluateOnNewDocument", {
		source: `try{localStorage.setItem('zitrus-theme','${shot.theme}')}catch(e){}`
	});

	const ready = waitForReady();
	await send("Page.navigate", { url: URL_UNDER_TEST });
	await ready;
	await sleep(1200);

	// Trigger every reveal, otherwise lazy sections capture invisible.
	await send("Runtime.evaluate", {
		expression: `document.querySelectorAll('[data-reveal]').forEach(e=>e.classList.add('is-in'));
		             document.getElementById('p-bars').classList.add('is-in');
		             document.querySelectorAll('.mod__icon[loading]').forEach(i=>i.loading='eager');`
	});
	await sleep(900);

	const metrics = await send("Page.getLayoutMetrics");
	const content = metrics.result?.cssContentSize || metrics.result?.contentSize;
	const h = Math.min(Math.ceil(content.height), 12000);
	const res = await send("Page.captureScreenshot", {
		format: "png",
		captureBeyondViewport: true,
		clip: { x: 0, y: 0, width: shot.width, height: h, scale: 1 }
	});
	const path = join(OUT, `${shot.name}.png`);
	writeFileSync(path, Buffer.from(res.result.data, "base64"));
	console.log(`${shot.name}  ${shot.width}x${h}  ${path}`);
}

ws.close();
chrome.kill();
