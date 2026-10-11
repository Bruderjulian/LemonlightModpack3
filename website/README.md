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
  element whose box escapes the viewport.
- `check-interactions.mjs` drives the theme toggle, group tabs, search, the
  empty state, URL filter state, show more/less, the hero group bars, the
  install wizard, the scroll spy, copy buttons and the mobile drawer.
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

The mod browser renders 12 rows at a time and reveals the rest on request.
A search always shows every hit, and a group that already fits renders no
button at all.

## Open items

- The CurseForge project slug is assumed to be `minecraft/modpacks/zitrus`.
  There is no CurseForge link anywhere in the repo, so that URL is a guess
  until the project is actually published there. It is marked with a TODO in
  `index.html` and in `main.js`.
- Share image at 1200x630. It needs real brand art, so it is a marked TODO in
  `index.html` rather than a generated placeholder.
- `wiki.md` and `mod-list.md` in `specs/` describe a docs site and a fuller
  mod browser. Neither exists yet; this homepage stands alone.