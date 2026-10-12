/**
 * One HTML minifier, shared by the two places that need it.
 *
 * Vite minifies JS and CSS on its own but leaves index.html formatted, which
 * is why the document on the critical path was the largest uncompressed asset
 * on the site. It runs here instead of in a Vite hook because Phase 6 injects
 * the prerendered mod list into dist/index.html *after* `vite build` has
 * finished: that injection has to be minified too, and minifying twice would
 * mean parsing the document twice for no reason.
 *
 * The option list is deliberately narrow. Each entry below is one that was
 * either needed for the byte win or deliberately switched off:
 *
 *   removeEmptyAttributes: false
 *     The prerendered mod icons carry `alt=""`. That empty value is the whole
 *     point of it: it marks the image as decorative so a screen reader skips
 *     it instead of reading a filename. Dropping the attribute would be a real
 *     accessibility regression for a handful of bytes.
 *
 *   decodeEntities: false
 *     Would rewrite `Client &amp; Server` to a bare `&`, which is legal but
 *     sits exactly on the edge of what a parser will guess at.
 *
 *   sortAttributes / sortClassName: off
 *     Pure churn. They make rebuilds noisy to review for no runtime gain.
 *
 *   removeAttributeQuotes: false
 *     Saves a few hundred bytes and turns the head into `<meta property=og:url
 *     content=https://skywardmc.org/>`. That parses, but a crawler bug is a far
 *     more expensive outcome than 300 bytes, and the document is not where the
 *     weight is anyway.
 */

import { minify } from "html-minifier-terser";

const OPTIONS = {
	collapseWhitespace: true,
	// Whitespace between inline elements is significant enough that collapsing
	// it can leave two words glued together. Costs a little, removes a class
	// of silent breakage, and keeps <pre> safe if prerendering ever emits one.
	conservativeCollapse: true,
	removeComments: true,
	removeRedundantAttributes: true,
	removeScriptTypeAttributes: true,
	removeStyleLinkTypeAttributes: true,
	removeOptionalTags: true,
	removeEmptyAttributes: false,
	removeAttributeQuotes: false,
	useShortDoctype: true,
	minifyCSS: true,
	minifyJS: true,
	// LightningCSS already ran over the stylesheet by the time this sees it;
	// minifyCSS on top is only for inline <style>, and it must not be the
	// thing that decides the output.
	keepClosingSlash: false,
	sortAttributes: false,
	sortClassName: false
};

/** Minifies a full HTML document. Throws if the document does not parse. */
export async function minifyHtml(html) {
	return minify(html, OPTIONS);
}
