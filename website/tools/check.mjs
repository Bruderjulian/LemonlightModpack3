/**
 * Runs all five checks in sequence and reports one verdict. Each check
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

const CHECKS = [
	"check-layout.mjs",
	"check-interactions.mjs",
	"check-contrast.mjs",
	"check-localised-layout.mjs",
	"check-i18n.mjs"
];

const run = (script) =>
	new Promise((resolve) => {
		const child = spawn(
			process.execPath,
			[join(toolsDir, script), ...(url ? [url] : [])],
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
