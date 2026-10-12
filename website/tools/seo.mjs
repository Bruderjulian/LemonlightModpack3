/**
 * Everything the page tells the outside world about itself, derived from
 * SITE_URL in vite.config.js.
 *
 * The point of deriving rather than hand-writing is that the repository used to
 * contain three different answers to "what is this page's address": an og:url
 * pointing at skywardmc.org/zitrus, a README insisting the site sits at the
 * domain root, and a base of "/" in the build. Only one can be true and there
 * was no way to tell which. Now there is one value, and everything else is
 * computed from it, so that contradiction cannot come back.
 *
 * JSON-LD is emitted from src/data/mods.json rather than written by hand, for
 * the same reason: a structured-data list that disagrees with the visible page
 * is worse than no structured data at all.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const siteDir = join(dirname(fileURLToPath(import.meta.url)), "..");

/** Locales shipped by the picker, and the og:locale tag each maps to. */
const LOCALES = [
	["en", "en_US"],
	["de", "de_DE"],
	["es", "es_ES"],
	["fr", "fr_FR"],
	["ru", "ru_RU"],
	["zh", "zh_CN"]
];

const OG_IMAGE = {
	path: "/og.png",
	width: 1200,
	height: 630,
	type: "image/png",
	alt: "Zitrus, a performance-first Fabric modpack for Minecraft. Fast by default."
};

const DESCRIPTION =
	"Rendering, memory, network and tick rate are tuned for you. " +
	"Zitrus is a performance-first Fabric modpack with quality of life already configured.";

function buildGraph(pageUrl, pack) {
	const latest = pack.versions.find((v) => v.minecraft === pack.latest) || pack.versions[0];

	// The curated list, not every installed file: libraries are not what a
	// reader searches for and they would swamp the list.
	const curated = pack.mods.filter((m) => !m.library);

	// pageUrl already ends in "/". Appending another one here is what produced
	// "https://skywardmc.org//#website", which is a different, broken URL.
	const at = (fragment) => `${pageUrl}#${fragment}`;

	return {
		"@context": "https://schema.org",
		"@graph": [
			{
				"@type": "WebSite",
				"@id": at("website"),
				url: pageUrl,
				name: "Zitrus",
				description: DESCRIPTION,
				inLanguage: LOCALES.map(([code]) => code)
			},
			{
				"@type": "SoftwareApplication",
				"@id": at("pack"),
				name: "Zitrus",
				description: DESCRIPTION,
				url: pageUrl,
				applicationCategory: "GameModification",
				operatingSystem: "Windows, macOS, Linux",
				softwareVersion: latest?.release ?? null,
				// A modpack is free and open, and saying so lets search surface
				// the price instead of leaving it unknown.
				offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
				author: { "@type": "Organization", name: "LemonlightMC" },
				downloadUrl: "https://modrinth.com/project/zitrus"
			},
			{
				"@type": "ItemList",
				"@id": at("mods"),
				name: "Mods in Zitrus",
				numberOfItems: curated.length,
				itemListOrder: "https://schema.org/ItemListOrderDescending",
				itemListElement: curated.map((m, i) => ({
					"@type": "ListItem",
					position: i + 1,
					item: {
						"@type": "SoftwareApplication",
						name: m.name,
						url: m.slug ? `https://modrinth.com/mod/${m.slug}` : undefined
					}
				}))
			}
		]
	};
}

/** Vite plugin. `siteUrl` and `outDir` are passed in from vite.config.js so
    there is exactly one source for both. */
export function seo(siteUrl, outDir = "dist") {
	const pack = JSON.parse(readFileSync(join(siteDir, "src", "data", "mods.json"), "utf8"));
	const url = `${siteUrl.replace(/\/$/, "")}/`;
	const image = `${url.replace(/\/$/, "")}${OG_IMAGE.path}`;

	return {
		name: "zitrus:seo",

		transformIndexHtml: {
			// Before Vite injects its own tags, so the head reads in the order
			// a person would expect: viewport, then what this page is, then the
			// assets.
			order: "pre",
			handler(html) {
				const tags = [
					{
						tag: "link",
						attrs: { rel: "canonical", href: url },
						injectTo: "head"
					},
					{
						tag: "meta",
						attrs: { property: "og:url", content: url },
						injectTo: "head"
					},
					{
						tag: "meta",
						attrs: { property: "og:site_name", content: "Zitrus" },
						injectTo: "head"
					},
					{
						tag: "meta",
						attrs: { property: "og:locale", content: "en_US" },
						injectTo: "head"
					},
					...LOCALES.filter(([code]) => code !== "en").map(([, locale]) => ({
						tag: "meta",
						attrs: { property: "og:locale:alternate", content: locale },
						injectTo: "head"
					})),
					{
						tag: "meta",
						attrs: { property: "og:image", content: image },
						injectTo: "head"
					},
					{
						tag: "meta",
						attrs: { property: "og:image:width", content: String(OG_IMAGE.width) },
						injectTo: "head"
					},
					{
						tag: "meta",
						attrs: { property: "og:image:height", content: String(OG_IMAGE.height) },
						injectTo: "head"
					},
					{
						tag: "meta",
						attrs: { property: "og:image:type", content: OG_IMAGE.type },
						injectTo: "head"
					},
					{
						tag: "meta",
						attrs: { property: "og:image:alt", content: OG_IMAGE.alt },
						injectTo: "head"
					},
					{
						tag: "meta",
						attrs: { name: "twitter:card", content: "summary_large_image" },
						injectTo: "head"
					},
					{
						tag: "meta",
						attrs: { name: "twitter:title", content: "Zitrus: a performance-first Fabric modpack" },
						injectTo: "head"
					},
					{
						tag: "meta",
						attrs: { name: "twitter:description", content: DESCRIPTION },
						injectTo: "head"
					},
					{
						tag: "meta",
						attrs: { name: "twitter:image", content: image },
						injectTo: "head"
					},
					{
						tag: "script",
						attrs: { type: "application/ld+json" },
						// Serialised here rather than in index.html so the item list
						// and the mod browser cannot disagree.
						children: JSON.stringify(buildGraph(url, pack)),
						injectTo: "head"
					}
				];
				// Returning both is the whole contract: returning `html` alone
				// silently drops every tag above.
				return { html, tags };
			}
		},

		/* After the directory is on disk, so the emitted files are part of the
		   same dist the deploy uploads. GitHub Pages serves these from the root. */
		closeBundle() {
			const target = join(siteDir, outDir);

			writeFileSync(
				join(target, "robots.txt"),
				[
					"# The whole site is one page. Nothing here is private and there",
					"# is nothing to disallow, so the file exists only to point at the",
					"# sitemap and to stop crawlers inventing URLs from the ?lang= and",
					"# ?group= filter parameters, which are the same document.",
					"User-agent: *",
					"Allow: /",
					"",
					"# Filter and language states are query parameters on one canonical URL.",
					"Disallow: /*?lang=",
					"Disallow: /*?group=",
					"Disallow: /*?sort=",
					"Disallow: /*?side=",
					"Disallow: /*?addons=",
					"Disallow: /*?q=",
					"",
					`Sitemap: ${url}sitemap.xml`,
					""
				].join("\n")
			);

			writeFileSync(
				join(target, "sitemap.xml"),
				[
					'<?xml version="1.0" encoding="UTF-8"?>',
					'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
					"\t<url>",
					`\t\t<loc>${url}</loc>`,
					// Not a lastmod: mods.json has no build timestamp it could be
					// derived from honestly, and a wrong lastmod is worse than none.
					`\t\t<changefreq>weekly</changefreq>`,
					`\t\t<priority>1.0</priority>`,
					"\t</url>",
					"</urlset>",
					""
				].join("\n")
			);
		}
	};
}
