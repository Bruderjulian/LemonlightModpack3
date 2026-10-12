import { defineConfig } from "vite";
import { minifyHtml } from "./tools/minify-html.mjs";
import { seo } from "./tools/seo.mjs";
import { SITE_URL } from "./tools/site-url.mjs";

export { SITE_URL };

/**
 * The site is one page with no framework. Vite is here for the dev server,
 * hashed asset filenames, minification and the JSON becoming a module import
 * instead of a runtime fetch.
 *
 * base stays "/" because the site is published at the domain root. If it ever
 * moves under a subpath, set it here rather than hardcoding paths in the page.
 */
export default defineConfig({
	base: "/",

	build: {
		// Deploy scripts expect website/dist, and the whole site is small enough
		// that splitting it up would only add requests.
		outDir: "dist",
		// Deliberately 0. The mod icons are reached through import.meta.glob,
		// so raising this would inline base64 for all ~170 of them into the JS
		// bundle and every visitor would download every icon to see the twelve
		// that are on screen. Separate lazy files are correct here.
		assetsInlineLimit: 0,
		reportCompressedSize: true,

		// Terser over esbuild: a few percent on a bundle that is mostly data and
		// dictionary strings, where mangle does not help but passes do.
		minify: "terser",
		terserOptions: {
			ecma: 2020,
			compress: { passes: 2, ecma: 2020 },
			mangle: { toplevel: false },
			format: { ecma: 2020, comments: false }
		},

		// LightningCSS understands color-mix(), oklab(), text-wrap and @supports,
		// and it reorders and merges declarations far more aggressively than
		// esbuild's CSS pass does.
		cssMinify: "lightningcss"
	},

	css: {
		lightningcss: {
			// Don't downlevel. Everything the stylesheet uses is baseline in the
			// browsers that run ES modules; asking for older targets would add
			// @supports fallback blocks for no reader.
			targets: { esmodules: true }
		}
	},

	plugins: [
		// canonical, Open Graph, Twitter, JSON-LD, robots.txt and sitemap.xml,
		// all computed from SITE_URL above.
		seo(SITE_URL, "dist"),

		{
			// Vite minifies the JS and the CSS but leaves index.html as written,
			// and the document was the largest uncompressed asset on the critical
			// path. `post` is what puts this after Vite has injected the hashed
			// <script> and <link> tags, so those are minified too.
			//
			// Phase 6 moves this out of the build hook: the prerender step
			// rewrites dist/index.html afterwards and calls minifyHtml itself.
			name: "zitrus:minify-html",
			enforce: "post",
			transformIndexHtml: {
				order: "post",
				handler: async (html) => await minifyHtml(html)
			}
		}
	],

	server: {
		port: 8791,
		strictPort: true
	},

	preview: {
		port: 8791,
		strictPort: true
	}
});
