/**
 * The one place the production URL is written down.
 *
 * Lives in its own module rather than in vite.config.js so the build config and
 * the checks can both read it without either importing the other: importing
 * vite.config.js would pull in Vite itself and run the whole plugin chain just
 * to read a string.
 *
 * The repository used to hold three different answers to what this page's
 * address is — an og:url pointing at skywardmc.org/zitrus, a README insisting
 * the site sits at the domain root, and a base of "/" in the build. Only one can
 * be true and nothing said which. Now there is one value, everything else is
 * derived from it, and check-seo.mjs fails if the built document disagrees.
 */

/** Domain root, no trailing path. The site is published at the root. */
export const SITE_URL = "https://skywardmc.org";

/** The canonical address of the page: SITE_URL with exactly one trailing slash. */
export const PAGE_URL = `${SITE_URL.replace(/\/$/, "")}/`;
