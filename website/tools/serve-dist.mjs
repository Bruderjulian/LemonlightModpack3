/**
 * Serves website/dist as plain static files.
 *
 * The checks normally run against the dev server, which never sees the built
 * output: no minified HTML, no hashed filenames, and above all no prerendered
 * mod list. The prerender step only exists in dist, so "does the built site
 * actually work" is a question about dist, and answering it needs dist served
 * over HTTP rather than read off disk.
 *
 *   node tools/serve-dist.mjs            -> http://127.0.0.1:8799
 *   node tools/serve-dist.mjs 8080       -> a specific port
 *   node tools/check.mjs -- http://127.0.0.1:8799/
 *
 * Port 8791 is Vite's and left alone on purpose: a dev server is usually
 * running there, and the checks used to fail with "port already in use" when
 * one was.
 */

import { readFileSync, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const distDir = join(siteDir, "dist");
const port = Number(process.argv[2]) || 8799;

if (!existsSync(distDir)) {
	console.error("dist does not exist. Run the build first.");
	process.exit(1);
}

const MIME = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".json": "application/json",
	".webp": "image/webp",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".svg": "image/svg+xml",
	".xml": "application/xml",
	".txt": "text/plain; charset=utf-8"
};

const server = createServer((req, res) => {
	const requested = decodeURIComponent(req.url.split("?")[0]);
	// normalize() collapses "..", and the startsWith guard is what actually
	// stops a request escaping dist.
	const target = normalize(join(distDir, requested));
	if (!target.startsWith(distDir)) {
		res.writeHead(403).end("forbidden");
		return;
	}

	let file = target;
	if (existsSync(file) && statSync(file).isDirectory()) file = join(file, "index.html");

	if (!existsSync(file)) {
		res.writeHead(404, { "content-type": "text/plain; charset=utf-8" }).end("not found");
		return;
	}

	res.writeHead(200, {
		"content-type": MIME[extname(file).toLowerCase()] ?? "application/octet-stream",
		// Matches what GitHub Pages actually sends, so a check that depends on
		// caching behaviour is testing the deployed conditions.
		"cache-control": "max-age=600"
	});
	res.end(readFileSync(file));
});

server.listen(port, "127.0.0.1", () => {
	console.log(`serving dist at http://127.0.0.1:${port}/`);
});
