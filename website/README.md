# Zitrus website

Homepage for Zitrus. One page, no framework. Vite handles the dev server, the
asset pipeline and the production build; there is no runtime dependency.

```sh
pnpm --dir website install       # once
pnpm --dir website run dev       # http://localhost:8791
pnpm --dir website run build     # -> website/dist
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
    styles.css      all styling
    data/mods.json  generated, git tracked
    assets/img/     mod icons, downloaded from Modrinth
  tools/            data build and browser checks
```

`mods.json` is imported as a module, so it is bundled into the JS instead of
fetched at runtime. The page makes no network calls beyond the two font files,
so it works offline and cannot break because someone changed an API.

Mod icons go through Vite's asset pipeline: `mods.json` records a bare file
name and `main.js` maps it through `import.meta.glob`, so the built URLs carry
a content hash.

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

## Checks

```sh
pnpm --dir website run check              # all three, in order
pnpm --dir website run check:layout
pnpm --dir website run check:interactions
pnpm --dir website run check:contrast
pnpm --dir website run shoot              # screenshots -> website/shots
```

Each check starts its own Vite dev server and a bundled Chromium, so nothing
needs to be running first and no browser has to be installed. They drive the
page through Playwright rather than shelling out to a system Chrome, which
means they behave the same on Windows, Linux and CI. Pass a URL to any of them
to point at a deployed build instead:

```sh
pnpm --dir website run check -- https://skywardmc.org/zitrus/
```

- `check-layout.mjs` loads six viewports from 360px up and fails on any
  element whose box escapes the viewport, and on anything a clipping
  ancestor cuts off.
- `check-interactions.mjs` drives the theme toggle, group tabs, search, the
  empty state, URL filter state, show more/less, both sort orders, the
  environment radiogroup and the addons toggle, the side tag on every row,
  addon folding and the orphan case, the newest first version row, the hero
  group bars, the install wizard, the scroll spy, copy buttons and the mobile
  drawer.
- `check-contrast.mjs` walks every visible text node in both themes and fails
  anything under WCAG AA. It steps through every wizard branch, so the command
  block and its copy button get audited too.
- `shoot.mjs` captures full-page screenshots at exact CSS viewports, in both
  themes on desktop and mobile.

The first run needs the browser binary:

```sh
pnpm --dir website exec playwright install chromium
```

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

## Open items

- The CurseForge project slug is assumed to be `minecraft/modpacks/zitrus`.
  There is no CurseForge link anywhere in the repo, so that URL is a guess
  until the project is actually published there. It is marked with a TODO in
  `index.html` and in `main.js`.
- Share image at 1200x630. It needs real brand art, so it is a marked TODO in
  `index.html` rather than a generated placeholder.
- `wiki.md` and `mod-list.md` in `specs/` describe a docs site and a fuller
  mod browser. Neither exists yet; this homepage stands alone.