import { defineConfig } from "vite";

/**
 * The site is one page with no framework. Vite is here for the dev server,
 * hashed asset filenames and the JSON becoming a module import instead of a
 * runtime fetch.
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
		assetsInlineLimit: 0,
		reportCompressedSize: true
	},

	server: {
		port: 8791,
		strictPort: true
	},

	preview: {
		port: 8791,
		strictPort: true
	}
});
