/**
 * Normalises the mod icons into what the page should actually be shipping.
 *
 * Why this exists: tools/fetch-modrinth.mjs writes whatever Modrinth's CDN
 * hands back, under a .png name. As of this writing that is *lossless WebP* at
 * 96x96, which means 84 files totalling ~716 kB for images the browser paints
 * at 34 CSS px. They are already compressed, so gzip does nothing for them, and
 * GitHub Pages serves them as Content-Type: image/png because that is what the
 * extension says. They were 83% of the site's bytes and 0% of the gzip win.
 *
 * This decodes each one, resizes to the two widths the page can render at, and
 * re-encodes as lossy WebP. The result is roughly a tenth of the bytes, served
 * with the right Content-Type, at a size that is not wasted.
 *
 * Run as part of `pnpm run build`, before Vite:
 *
 *   node tools/build-icons.mjs
 *
 * Idempotent, and safe to run on its own. A file is a source if its name is
 * not `<slug>-<width>.webp`, which is what the output is named, so re-running
 * never re-processes an icon that is already an icon. Sources are deleted once
 * both widths exist, which is why the repo ends up holding only the small
 * WebPs and a fresh clone still builds.
 */

import { readdirSync, readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const siteDir = join(fileURLToPath(import.meta.url), "..", "..");
const imgDir = join(siteDir, "src", "assets", "img");

/* 34px is the .mod__icon render box. 68 is the 2x that every phone and most
   desktops actually ask for; nothing here renders larger. */
const WIDTHS = [34, 68];

/* q82 is where a 96px source stops looking like a source. These are small flat
   logo marks and some pixel art; the ringing lossless WebP avoids is not
   visible at 34px, and dropping to q75 saves about 15% more for no reason. */
const QUALITY = 82;
const EFFORT = 6;

/** `<slug>-68.webp` is generated. Everything else in the directory is a source. */
const isGenerated = (name) => /^.+-\d+\.webp$/.test(name);

const sources = readdirSync(imgDir)
	.filter((name) => !isGenerated(name))
	.filter((name) => !name.startsWith("."));

if (!sources.length) {
	console.log("no icon sources to process; already normalised");
	process.exit(0);
}

const kb = (n) => (n / 1024).toFixed(1);
let before = 0;
let after = 0;

for (const name of sources) {
	const slug = name.replace(/\.[^.]+$/, "");
	const src = join(imgDir, name);
	const buf = readFileSync(src);
	before += buf.length;

	// sharp reads the real format out of the bytes, not the extension, so a
	// WebP under a .png name decodes correctly. That is the bug being fixed.
	const image = sharp(buf, { failOn: "none" }).ensureAlpha();

	for (const width of WIDTHS) {
		const out = await image
			.clone()
			.resize({ width, fit: "inside", withoutEnlargement: false })
			.webp({ quality: QUALITY, effort: EFFORT })
			.toBuffer();
		writeFileSync(join(imgDir, `${slug}-${width}.webp`), out);
		after += out.length;
	}

	unlinkSync(src);
}

/* The old 83-file build carried xaeros-maps-multiplayer-plus and
   xaeros-world-map as byte-identical files, so Vite emitted them once. Say so
   rather than letting the number look like something is missing. */
const remaining = readdirSync(imgDir).filter((f) => extname(f) === ".webp");

console.log(
	`icons: ${sources.length} sources -> ${remaining.length} webp  ` +
		`(${kb(before)} kB -> ${kb(after)} kB, ${((1 - after / before) * 100).toFixed(1)}% smaller)`
);

for (const width of WIDTHS) {
	const sizes = remaining
		.filter((f) => f.endsWith(`-${width}.webp`))
		.map((f) => existsSync(join(imgDir, f)) && readFileSync(join(imgDir, f)).length)
		.filter(Boolean);
	if (!sizes.length) continue;
	const total = sizes.reduce((a, b) => a + b, 0);
	console.log(
		`  ${width}px: ${sizes.length} files, ${kb(total)} kB total, ` +
			`largest ${kb(Math.max(...sizes))} kB`
	);
}
