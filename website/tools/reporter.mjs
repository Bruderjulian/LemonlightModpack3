/**
 * Shared assertion recorder, so every check reports the same way.
 *
 * Its own module rather than part of harness.mjs because harness.mjs imports
 * Vite and Playwright at the top level. check-seo.mjs runs against files on
 * disk and needs no browser, and importing the harness to borrow a forty-line
 * printer would make a one-second check pay for a browser launch it never
 * makes. harness.mjs re-exports this, so the other checks are unaffected.
 */

export function reporter() {
	const results = [];

	return {
		check(name, pass, detail = "") {
			results.push({ name, pass: Boolean(pass), detail: String(detail) });
		},
		finish() {
			const failed = results.filter((r) => !r.pass);
			for (const r of results) {
				const mark = r.pass ? "PASS" : "FAIL";
				// Failures are the whole reason this line exists, so they get
				// room; passing checks stay short.
				const limit = r.pass ? 100 : 400;
				const tail = r.detail ? `  (${r.detail.slice(0, limit)})` : "";
				console.log(`${mark}  ${r.name}${tail}`);
			}
			const summary = failed.length
				? `\n${failed.length} of ${results.length} checks failing`
				: `\nall ${results.length} checks pass`;
			console.log(summary);
			return failed.length;
		}
	};
}
