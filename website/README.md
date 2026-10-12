# Zitrus website

Homepage for Zitrus. One page, no framework. Vite handles the dev server, the
asset pipeline, minification and the production build; there is no runtime
dependency.

```sh
pnpm --dir website install       # once
pnpm --dir website run dev       # http://localhost:8791
pnpm --dir website run build     # -> website/dist
```

`pnpm run build` is four steps and they are ordered, not interchangeable:

```
build-icons   decode, resize and re-encode every mod icon, then delete the sources
vite build    bundle, minify JS/CSS/HTML, emit robots.txt and sitemap.xml
build-og      compose the 1200x630 share card from the built stylesheet
prerender     render the page in Chromium and write the result into index.html
```

The last three need a browser, because they use the same Chromium the checks
do:

```sh
pnpm --dir website exec playwright install chromium
```

`website/dist` is the deployable artifact. It has to sit at the domain root,
because Vite's `base` is `/`. To publish under a subpath, change `base` in
`vite.config.js` rather than editing paths in the page.

## Layout

```
website/
  index.html        page markup, unchanged apart from the entry tags
  src/
    main.js         all behaviour
    i18n/
      index.js      locale detection, t(), DOM application
      locales/      one dictionary per language
    styles.css      all styling
    data/mods.json  generated, git tracked
    assets/img/     mod icons, generated webp at 34px and 68px
  public/
    .nojekyll       so GitHub Pages does not run Jekyll over the build
  tools/            data build, image pipeline, prerender and browser checks
```

`mods.json` is imported as a module, so it is bundled into the JS instead of
fetched at runtime. The page makes no network calls beyond the two font files,
so it works offline and cannot break because someone changed an API.

Mod icons go through Vite's asset pipeline: `mods.json` records a bare file
name and `main.js` maps it through `import.meta.glob`, so the built URLs carry
a content hash.

## Hosting: GitHub Pages

The build is tuned for this host, and the platform's limits shaped several
decisions that are otherwise hard to justify. Probed against live GitHub Pages
responses rather than assumed:

| Behaviour | Consequence here |
|---|---|
| gzips text responses itself | No `.gz` or `.br` files are emitted. Pages ignores pre-compressed siblings, so they would be dead weight in the repository and would download as separate files. |
| sends `cache-control: max-age=600` | Cache headers cannot be configured at all. Hashed asset names are the only lever, which is why the 10-minute revalidation cost is paid on bytes rather than on round trips. |
| no Brotli | The gzip numbers in `performance-budget.json` are the ones that matter. Brotli is measured too, but only as a preview of what a CDN would do. |
| serves `Content-Type` by extension | Why the icons are real WebP under a `.webp` name. See below. |

**Immutable caching is not available on this host.** If it is wanted, put a CDN
in front: a Cloudflare proxy in front of the Pages domain would give
`cache-control: public, max-age=31536000, immutable` on `/assets/*`, Brotli and
HTTP/3, with no change to the build.

`tools/serve-dist.mjs` serves `dist` with `cache-control: max-age=600`, the
same header Pages sends, so a check that depends on caching behaves the same
locally as it will in production.

## One URL

`SITE_URL` in `tools/site-url.mjs` is the only place the production address is
written down. `canonical`, `og:url`, `og:image`, `robots.txt` and `sitemap.xml`
are all derived from it.

This exists because the repository used to hold three different answers to
"what is this page's address": an `og:url` pointing at `skywardmc.org/zitrus`,
a README insisting the site sits at the domain root, and a `base` of `/` in the
build. Only one can be true and nothing said which. `check-seo.mjs` now fails
if the built document disagrees with the one value.

## Weight

`tools/report-size.mjs` prints what the build actually weighs and fails if it
grew past `performance-budget.json`. `--write` rewrites the budgets, with 20%
headroom, so an ordinary change does not trip it and a real regression does.

| | before | after |
|---|---|---|
| mod icons | 716 kB | 150 kB |
| `index.html` | 26 kB | 51 kB |
| JS | 103 kB | 108 kB |
| total | 868 kB | 410 kB |

The icons were 83% of the site and none of the gzip win, because they were not
images at all. `fetch-modrinth.mjs` wrote whatever the CDN returned to
`<slug>.png`, and Modrinth answers in **lossless WebP at 96x96**, for images
the page paints at 34 CSS px. Already compressed, so gzip did nothing for them,
and GitHub Pages served them as `image/png` because of the extension.

`build-icons.mjs` now decodes them with sharp, resizes to 34px and 68px and
re-encodes as lossy WebP, deleting the sources. `fetch-modrinth.mjs` takes the
extension from the response's content type so that cannot recur, and reports
anything left in the directory that the icon build has not seen.

`assetsInlineLimit` stays at **0** on purpose. The icons are reached through
`import.meta.glob(..., { eager: true })`, so raising it would inline base64 for
all 166 of them into the JS bundle, and every visitor would download every icon
to see the twelve that are on screen.

The JS grew by 5 kB and the HTML by 25 kB, both deliberately. The JS growth is
166 hashed URL strings, about 1.2 kB gzipped, paid on every page load in
exchange for 566 kB of images. The HTML growth is the prerender plus the
JSON-LD, and it is what a crawler now reads.

## Minification

Vite minifies JS and CSS on its own but leaves `index.html` exactly as written,
which made the document the largest uncompressed asset on the critical path.
All three are handled:

- `terser` for JS, `passes: 2`. Worth about 3% here; the bundle is mostly data
  and dictionary strings, which minify poorly however they are treated.
- `lightningcss` for CSS. Being honest about it: on this stylesheet it beats
  esbuild by 0.5%, because esbuild had already produced a terse file and there
  is little left to merge. It is kept for correctness on `color-mix()` and
  `@supports`, not for the bytes.
- `html-minifier-terser` via `tools/minify-html.mjs`.

Two options are off on purpose. `removeEmptyAttributes` is off because the
prerendered icons carry `alt=""`, and that empty value is precisely what marks
them decorative; dropping the attribute would be a real accessibility
regression. `removeAttributeQuotes` is off because it turns the head into
`<meta property=og:url content=https://skywardmc.org/>`, which parses, but a
crawler bug is a more expensive outcome than 300 bytes.

HTML minification runs at the end of `tools/prerender.mjs` rather than as a
Vite hook, because the prerender rewrites `index.html` after the build and that
result has to be minified too. Hence `minify-html.mjs` is a shared module.

## Prerendering

Everything worth reading or searching for is built by `main.js` at runtime: the
mod list, the group chips, the hero numbers, the install wizard. A crawler that
does not execute JavaScript sees none of it.

`tools/prerender.mjs` closes that gap by running the real page in the real
Chromium, capturing the DOM the real code produced, and writing it back into
`dist/index.html`. It is **not** a second implementation: there is no template
in it and no copy of the filtering logic. The markup comes from a live render
of the shipped bundle, so it cannot drift from what a browser produces.

Adoption on the other side is one attribute. `main.js` stamps `data-prerender`
on `#mod-list` with a key describing the state it just rendered —
`all||downloads|both|false|false|en`. The build copies that key verbatim rather
than reconstructing the string, because two places agreeing on its format is
exactly the bug that avoids. On load, if the query string describes the same
state, the first render is skipped and the markup in the document is adopted.
Any parameter at all, `?lang=ru` included, produces a different key and the
normal path runs.

Three things changed as a side effect, all wanted:

- `applyTranslations()` no longer rewrites English text on load.
- The load-time row cascade is gone. Those rows were never absent from the
  document, so animating them in was pure cost.
- `#wiz-out` is an `aria-live` region that used to announce the whole install
  result before the reader had asked for anything. Prerendered content is in
  the parsed HTML, so the region is never *changed* on load and stays quiet.

Two bugs only exist in the built output, and both were caught by running the
checks against `dist` rather than the dev server:

- `paintTabs()` both built the filter chips and attached a click handler to
  each one. Skipping it left five chips that looked right and did nothing.
- The wizard *appended* its four launcher buttons to the four already in the
  prerendered HTML, so the group held eight. Anything that builds into a
  container the build may already have filled has to empty it first.

## SEO

`tools/seo.mjs` is a Vite plugin that injects the head tags and writes
`robots.txt` and `sitemap.xml` at `closeBundle`.

- `canonical` and `og:url`, both from `SITE_URL`.
- `og:site_name`, `og:locale`, and an `og:locale:alternate` for each of the
  other five languages.
- The full `og:image` set with dimensions, type and alt text.
- `twitter:card = summary_large_image` with title, description and image. A
  language switch rewrites the Twitter pair alongside the Open Graph one.
- JSON-LD as a `WebSite` + `SoftwareApplication` + `ItemList` graph, serialised
  from `mods.json` so the structured data and the visible list cannot disagree.
  It lists the 87 curated mods and omits libraries, which are not what anyone
  searches for.

`tools/build-og.mjs` replaces the TODO that said the share card needed real
brand art and so could not ship yet. It composes a 1200x630 card in the same
Chromium, against the *built* stylesheet, so it is on-brand by construction and
cannot drift from `src/styles.css`. PNG and JPEG, because the social scrapers
that matter still do not reliably fetch anything else. Swapping in real artwork
later is a file replacement with no code change.

## Languages

Six ship today: English, German, Spanish, French, Russian and Simplified
Chinese. The mechanism is about 150 lines in `src/i18n/index.js`, and adding a
seventh is two steps: drop `src/i18n/locales/xx.js` in, add one line to
`LOCALES`. Nothing else changes.

Dictionaries are static ES modules imported by `src/i18n/index.js`, so they
bundle with the JS. There is no runtime fetch and no lazy chunk: switching
language is synchronous, which is why the page can be correct on its first
paint instead of flashing English on the way to Russian.

Markup in `index.html` says what is translatable:

```html
<h2 data-i18n="mods.heading">Everything in the box.</h2>
<h1 data-i18n-html="hero.title">Fast <em>by default.</em></h1>
<input data-i18n-attr="placeholder:mods.searchPlaceholder" />
<nav data-i18n-attr="aria-label:a11y.sections" />
```

`data-i18n-html` is for inline emphasis only. It is trusted authored copy, not
user input; the only markup any message uses is `<em>`. Text that has to sit
around a link is split into `before` / `link` / `after` keys instead, so the
`<a href>` stays in the HTML rather than inside a translation.

**No string is cached.** Every label goes through `t()` at paint time, so a
language change is one event: `applyTranslations()` rewrites the marked-up
nodes, and a list of repaint callbacks rebuilds the mod list, the group bars,
the group filters and the wizard. The reason is the wizard specifically. Its four
launchers each have four translated steps, and those steps are produced by a
function rather than sitting in the markup, so a repaint list is the only thing
that can reach them without a reload.

### Plural messages

Plurals are keyed by CLDR category, not by `one`/`other`, because Russian needs
`one`/`few`/`many` and a hand-rolled pair gets it wrong:

```js
"mods.addonsCount": {
	one: "+ {n} addon",
	few: "+ {n} аддона",
	many: "+ {n} аддонов",
	other: "+ {n} аддона"
}
```

`Intl.PluralRules` picks the form, and a locale that only selects one category
(simplified Chinese) may hold a bare string instead. `check-i18n.mjs` knows
which languages those are, from `Intl` itself rather than a hand-kept list.

Nouns that differ by count are separate keys, not one sentence: the footer
reads "6 версий · 106 модов", which needs `mods.versionCount` and `mods.count`
rather than a single `{versions} versions · {mods} mods`.

### What is not translated

Mod names, mod blurbs and group blurbs are data, not copy, and stay in English
for every locale. Translating 87 blurbs by hand would be worse than leaving the
source language: a mistranslated mod description is a support ticket, whereas
an English one is recognisably the mod author's own words. Product names are
in the same category — Fabric, Prism Launcher, CurseForge and packwiz stay in
Latin script.

### Choosing a language

`?lang=` in the URL wins, then `localStorage` (the key is `zitrus-lang`, and it
works exactly like `zitrus-theme` already did), then `navigator.languages`.
Region subtags are dropped, so `pt-BR` reads as `pt` and a reader never misses
because their browser said `de-AT`. An explicit choice is mirrored into `?lang=`
so the link can be shared.

The browser filter state and the language share one query string, so `sync()`
carries `lang` across every filter change rather than clobbering it.

The picker is a popover, not a `<select>`: native selects cannot be styled to
match the rest of the chrome and look default-ish on some platforms. It stays
in the bar at every width rather than being duplicated into the mobile drawer,
because the bar keeps the burger and the theme toggle on a phone anyway, and
two copies of a switcher would have to be kept in sync.

### Adding a key

1. Add it to `src/i18n/locales/en.js`. That file is the source of truth.
2. Mark up the node in `index.html`, or call `t()` in `main.js`.
3. `pnpm --dir website run check:i18n` — it fails on a key the page references
   but English does not define, and on a key English defines that nothing
   renders.

## Where the numbers come from

Nothing on the page is typed by hand. `versions/fabric/<mc>/mods/*.pw.toml`
is the source of truth: packwiz reads those files at export time, and each
one declares the mod's name, its `side` (client / server / both) and its
Modrinth id.

```
versions/fabric/26.3/mods/*.pw.toml
        |
        |  build-data.mjs  (+ modrinth-cache.json for slug, blurb, icon)
        v
website/src/data/mods.json   ---->  hero panel, group bars, mod browser, wizard
```

- `tools/groups.json` is the one hand-maintained file: which group each mod
  belongs to, which mods are addons of a parent, and which entries are
  libraries that should stay hidden.
- A new mod with no group fails the build rather than silently disappearing.

The counts are therefore the pack's real counts. For 26.3 that is 106
installed files, of which 87 are curated mods and 19 are libraries.

The mod browser has two orders, both off real numbers rather than a hand-tuned
score:

- **Downloads** (default) sorts by Modrinth's download count, with followers
  as the tiebreak and the name after that, so the order is deterministic.
- **Relevance** is the pack's own priority: the group order declared in
  `groups.json` (performance, visuals, quality of life, tweaks), most used
  first inside each group.

Both sort keys come from the Modrinth bulk response, which already carries
`downloads` and `followers`, so caching them costs no extra API calls. The
choice persists in the URL as `?sort=relevance`. `build-data.mjs` sorts by
downloads so the shipped JSON is already in display order.

Supported Minecraft versions are emitted newest first, because the wizard's
default is the latest and it should be the first card rather than the last.
They are compared segment by segment as numbers, not as text: `1.21.11` is
newer than `1.21.1`, and `26.x` is newer than `1.x`.

The wizard's result header is one line, `Modrinth App · 26.3 Fabric · v1.1.0`,
built from the pack version in `pack.toml`. That field is a semver with build
metadata (`1.1.0+mc26.3.fabric`), so `build-data.mjs` splits it into `release`
and `loader` and ships those two fields instead of the raw string. The raw
string used to sit on its own line under the steps and repeated the Minecraft
version and loader that the header already shows. The folder name stays the
authority for the Minecraft version; the build warns if the two disagree.

## Contrast

Both themes are held to measured ratios on `--bg`, not just to "it passes
AA". Light: ink 15.9:1, ink-2 9.9:1, ink-3 7.8:1, accent-text 8.1:1. Dark:
ink-2 8.6:1, ink-3 6.2:1.

`ink-3` carries the 10 to 13px labels, so it is well above the AA floor of
4.5:1. On `--surface-2` everything loses about half a point, which still
leaves the smallest text at 7.3:1.

There are two accent tokens, which is the whole trick. `accent-text` is the
dark olive for small text, links and tags. `accent-display` is the brighter
citron, used only for type at 23px and up, where contrast law asks for 3:1
and the colour can stay loud. Dark mode sets both to the same citron, since
light-on-dark has contrast to spare.

## Tints

`--tint` and `--tint-deep` are a whisper of citron over the base, used so a
section reads as its own zone without becoming a second brand colour. The
surfaces were only 5% apart in luminance, which left the hero panel, the
browser and the wizard blocks looking like the same white card.

| Area | Token |
|---|---|
| Foundation band, hero panel head, browser toolbar, show-more row | `--tint` |
| Wizard result card body | `--tint` |
| Wizard result header, code blocks | `--tint-deep` |

The band previously shared `surface-2` with the browser toolbar, so a
statement section and a piece of UI chrome rendered identically. The wizard
result card is the deepest tint because it is the one place the page asks for
a click. Light ink-3 holds 7.5:1 on `--tint` and 9:1 on `--tint-deep`; dark
holds 5.7:1 and 6.3:1, which is above its own 5.6:1 baseline.

## Modrinth

`tools/fetch-modrinth.mjs` is the only thing that talks to the Modrinth API.
It writes `tools/modrinth-cache.json` and downloads each icon into
`src/assets/img/`. After that the page makes no network calls, so the icons
ship with the site.

Run it when you add a mod, or when you want fresher descriptions:

```sh
pnpm --dir website run fetch    # fetch-modrinth.mjs
pnpm --dir website run data     # build-data.mjs only, uses the cache
```

`fetch` writes the raw icon under the extension the CDN actually used and
removes the widths `build-icons.mjs` made for that slug, so a re-fetch cannot
leave a stale pair behind. It finishes by naming any source it left in the
directory, which the next `build-icons` will pick up.

## Checks

```sh
pnpm --dir website run check              # all six, in order
pnpm --dir website run check:seo
pnpm --dir website run check:layout
pnpm --dir website run check:interactions
pnpm --dir website run check:contrast
pnpm --dir website run check:layout-i18n
pnpm --dir website run check:i18n
pnpm --dir website run report-size        # byte budgets
pnpm --dir website run shoot              # screenshots -> website/shots
```

Each browser check starts its own Vite dev server and a bundled Chromium, so
nothing needs to be running first and no system browser has to be installed.
They drive the page through Playwright rather than shelling out to a system
Chrome, which means they behave the same on Windows, Linux and CI.

`check-seo.mjs` is the exception: it reads `dist/` off disk and starts no
browser, which is why it runs first. A head tag that is right in `index.html`
and wrong in `dist` is the failure mode worth catching, and HTML minification,
plugin injection order and a stale `dist` can all produce exactly that.

**Run the suite against the built site too, not just the dev server.** The
prerender, the hashed filenames and the minified HTML exist only in `dist`, so
the dev server cannot see any of it:

```sh
pnpm --dir website run build
pnpm --dir website run serve               # http://127.0.0.1:8799
pnpm --dir website run check -- http://127.0.0.1:8799/
```

Both prerender bugs described above were found this way, and they were invisible
to the dev server. Passing the checks is therefore two claims, not one.

A URL can be passed to any check to point at a deployed build instead:

```sh
pnpm --dir website run check -- https://skywardmc.org/
```

- `check-seo.mjs` asserts the built document: canonical and `og:url` against
  `SITE_URL`, the locale and Twitter tags, that `og.png` really is 1200x630,
  that the JSON-LD parses, declares the three expected types, has no doubled
  slash in an `@id`, and that its item list matches `mods.json` rather than a
  hand-kept copy. Then `robots.txt`, `sitemap.xml`, that no mislabelled `.png`
  icon came back, that every icon exists at both widths and is really WebP at
  the width it claims, and that the prerendered rows, chips, hero numbers and
  wizard are all present in the served HTML. No browser needed.
- `check-layout.mjs` loads six viewports from 360px up and fails on any
  element whose box escapes the viewport, and on anything a clipping
  ancestor cuts off.
- `check-interactions.mjs` drives the theme toggle, group filters, search, the
  empty state, URL filter state, show more/less, both sort orders, the
  environment radiogroup and the addons toggle, the side tag on every row,
  addon folding and the orphan case, the newest first version row, the hero
  group bars, the install wizard, the scroll spy, copy buttons and the mobile
  drawer. It also asserts that **every row renders a decoded icon rather than
  the monogram fallback**, and that the `srcset` offers a 1x candidate. That
  assertion exists because a completely broken icon path passed the entire
  suite: the rows still had their names, tags and blurbs, and a monogram is
  indistinguishable from a deliberate choice in a screenshot. `naturalWidth` is
  the only thing that tells them apart.
- `check-contrast.mjs` walks every visible text node and fails anything under
  WCAG AA. It steps through every wizard branch, so the command block and its
  copy button get audited too, and it runs both themes against English and one
  translated locale with the language menu open, since the popover is the only
  new chrome that renders once per locale rather than once in total.
- `check-localised-layout.mjs` runs the same overflow probe as
  `check-layout.mjs` in every locale at the three narrowest widths, with the
  mod list expanded. English is the shortest locale, so a page that fits in
  English can overflow in Russian. This is the check that caught the wizard
  panel blowing past 360px wherever the launcher name was longer than
  "Modrinth App": a `white-space: nowrap` element with no `min-width: 0` feeds
  its min-content width into the grid column, and English was the one locale
  short enough not to notice.
- `check-i18n.mjs` runs in two halves. Statically, with no browser: every
  locale must carry exactly English's key set, the `{placeholders}` in a
  message must match, and plural forms are checked against the categories
  `Intl` says that language uses. In the browser: each locale must actually
  render, and a switch made through the UI must repaint the generated rows and
  not just the static markup.
- `shoot.mjs` captures full-page screenshots at exact CSS viewports, in both
  themes on desktop and mobile, one per non-English locale, and the language
  menu open in both themes. It takes `[outDir] [url]` and defaults the output
  to `website/shots` relative to the site directory, not the working
  directory, so it lands in the same place however the command was invoked.
  Point it at `serve-dist` to shoot the built site.

The first run needs the browser binary:

```sh
pnpm --dir website exec playwright install chromium
```

`openPage` in `tools/harness.mjs` pins the theme and the locale before any page
script reads them, so the checks assert English against English rather than
against whatever locale the machine running them happens to be set to.

## Page order

Hero, then the "it stays a foundation" statement, then the mod browser, then
the install wizard. The install wizard is client-only by decision: launcher
pick, Minecraft version, install. Every version and every mod count it shows
comes from `mods.json`, so it cannot drift from the pack.

The mod browser renders 12 entries at a time and reveals the rest on request.
A search always shows every hit, and a group that already fits renders no
button at all.

Addons are folded into their parent row as small chips rather than taking a
row of their own: Sodium carries its four addons, Xaero's Minimap its three,
Litematica and Flashback two each. The count sits in the title line next to
the side tag, so "Sodium + 4 addons CLIENT" reads as one cluster of metadata
rather than a stray line under the description. That makes 87 installed
curated mods read as 75 entries, which is how the repo README already counts
them. Pagination counts entries, not mods, so the page cannot promise 12 rows
and render 10. An addon whose parent is filtered out still gets a row of its
own rather than disappearing.

## Filters

Two controls sit next to the sort, and they are deliberately different shapes:

- **Environment** is one choice of three, so it is a `radiogroup`: Tab reaches
  it once and the arrow keys move between the options. "Client" and "Server"
  each include the both-side mods, because a both-side mod does install on
  that side; "Client & Server" is the whole list and the default. Each option
  carries a small icon so it reads without the label.
- **Hide addons** is an independent toggle, not a fourth option. It drops the
  addon chips and any addon that is its own row, leaving parents alone.

Both land in the URL (`?side=client&addons=hide`), alongside `group`, `q` and
`sort`, so a filtered view is shareable. The header count reports what is
actually on screen rather than the unfiltered group total.

Every mod row carries a side tag, so "works in both places" is stated rather
than inferred from a missing badge. Since the both-side tag sits on most rows
it stays muted, while client keeps the accent, which keeps the eye on the mod
name instead of the badge.

## Accessibility

Things that are patterns rather than features, and the reason for each.

**The group filters are a group, not a tab list.** They were
`role="tablist"` with `role="tab"` children and no `aria-controls`, no `tabpanel`
and no arrow-key handling. There is no panel: all five buttons drive the one
list underneath. That announced "tab" for controls that do not behave like tabs
and promised panels that do not exist, so they are now `aria-pressed` toggles
inside a `role="group"`. No visual change; the selected styling moved from
`[aria-selected="true"]` to `[aria-pressed="true"]`.

**The group filter's click handler is delegated.** `paintTabs()` used to attach
one listener per chip, which meant the wiring died with the markup — and the
prerender skips that function, leaving five chips that looked right and did
nothing. The listener now belongs to the container, which always exists.

**Roving tabindex is re-applied after every programmatic state change.** The
environment filter's `aria-checked` is driven by `?side=` in the URL and the
version list is rebuilt from scratch on a language change. Neither went through
the selection path, so Tab used to land on the option that was *not* checked,
and a language change gave the version group six tab stops instead of one.
`wireRadioGroup` returns its `paint()` and both call sites use it.

**`#browser-count` is a `role="status"`.** Filtering used to swap the entire
list with no announcement at all; a reader had no way of knowing it had
happened. The search input also points at it with `aria-describedby`.

**`scroll-behavior: smooth` is gated on `prefers-reduced-motion`.** The reveal
animations one screen down were already gated; the scrolling was not, and it is
motion. Anchor links, the scroll spy and the show-all pull-back all work
unchanged either way.

**Headings do not skip a level.** The three notes and the three footer columns
were `h4` directly under an `h2`. They are `h3` now; the sizes are set in CSS, so
nothing moved.

**The drawer is a `nav`, not a dialog.** Everything in it is a link, so it is a
named landmark and nothing more: no `aria-modal`, no focus trap. Opening it
moves focus to its first link and closing hands focus back to the burger, or
keyboard focus walks past the reader's own open menu into the page below it. A
language change only relabels the trigger, deliberately: it must not re-enter
`set()` and yank focus back into the drawer mid-sentence.

Target sizes are 32–36px against a 24px minimum.

## Scroll spy

The nav marks the section you are in with `aria-current`, filled with the
same accent as the other "selected" controls. It deliberately does not reuse
the hover style: "you are in this section" and "the pointer is on this link"
are different facts and used to look identical.

The observer tracks every entry rather than only the ones entering the band,
and keeps a set of the sections currently in it. Reacting only to entering
events left two bugs: jumping back up to Mods from Install left the highlight
on Install, and scrolling above the first section left it stuck on whatever
was last marked. When more than one section is in the band, the last in
document order wins.

The filters sit in `.browser`, which is `overflow: hidden`, so a toolbar
overflow on a narrow screen gets silently clipped instead of overflowing the
page. `check-layout.mjs` therefore also reports content cut off by a clipping
ancestor, which is what caught both the toolbar wrapping at 390px and the
side tag pushing a long mod title past 360px.

Brand marks in the top bar are inlined Simple Icons paths (CC0) rather than a
CDN link, so the page still makes no third-party request at runtime.

## Fonts

Geist and Geist Mono, latin subset only, from jsDelivr. Two files, both
preloaded, with a `preconnect` to the CDN in front of them: without it the
preloads queue behind a connection that has not been opened yet, so the
handshake happens on the critical path instead of ahead of it.

`unicode-range` is declared even though both files are already latin-only
subsets. Without it the browser downloads the face for any text that names the
family at all, including Cyrillic it cannot render, and falls back glyph by
glyph. With it, declaring a Cyrillic subset later is an added `@font-face`
rather than a change to anything already working.

Self-hosting was considered and rejected: it would remove the last third-party
request, but it adds roughly 150 kB of binaries to a repository whose pack
releases are already the large part, and the CDN's cache is doing this job
well. It remains the single biggest remaining network lever if the page is ever
moved behind a host that does not compress or cache well.

## Open items

- The CurseForge project slug is assumed to be `minecraft/modpacks/zitrus`.
  There is no CurseForge link anywhere in the repo, so that URL is a guess
  until the project is actually published there. It is marked with a TODO in
  `index.html` and in `main.js`.
- The share card is generated from the site's own tokens and webfont, so it is
  on-brand but it is not artwork. `dist/og.png` is the only file to replace
  when real brand art exists; nothing else needs to change.
- Cache headers. GitHub Pages pins `max-age=600` and offers no way to change
  it. A CDN in front is the only fix, and the build already emits hashed names
  so nothing would need to move.
- `wiki.md` and `mod-list.md` in `specs/` describe a docs site and a fuller
  mod browser. Neither exists yet; this homepage stands alone.