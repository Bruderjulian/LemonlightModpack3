/**
 * Runs every check in sequence and reports one verdict. Each browser check
 * starts its own dev server and browser, so they stay independent and can
 * still be run individually.
 *
 * Run: pnpm --dir website run check -- [url]
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const toolsDir = dirname(fileURLToPath(import.meta.url));
const url = process.argv[2];

/* check-seo.mjs reads dist/ off disk rather than loading a page, so a URL
   argument does not apply to it. It runs first because the other four all load
   the built document, and a broken head tag should not send four checks off to
   open a page that is already known to be wrong. */
const DISK_CHECKS = ["check-seo.mjs"];

const BROWSER_CHECKS = [
	"check-layout.mjs",
	"check-interactions.mjs",
	"check-contrast.mjs",
	"check-localised-layout.mjs",
	"check-i18n.mjs"
];

const CHECKS = [...DISK_CHECKS, ...BROWSER_CHECKS];

const run = (script) =>
	new Promise((resolve) => {
		const child = spawn(
			process.execPath,
			[join(toolsDir, script), ...(url && !DISK_CHECKS.includes(script) ? [url] : [])],
			{
				stdio: "inherit"
			}
		);
		child.on("close", (code) => resolve(code ?? 1));
	});

let failed = 0;
for (const script of CHECKS) {
	console.log(`\n=== ${script} ===`);
	if (await run(script)) failed++;
}

console.log(
	failed
		? `\n${failed} of ${CHECKS.length} check groups failing`
		: "\nall checks pass"
);
process.exit(failed ? 1 : 0);
