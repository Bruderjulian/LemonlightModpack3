# Zitrus website

Static homepage for Zitrus. No framework, no bundler, no runtime dependency.
Serve the `website/` directory as-is.

```sh
just website-serve   # http://localhost:8791
```

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
website/assets/data/mods.json   ---->  hero panel, group bars, mod browser
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
`assets/img/`. After that the page makes no network calls beyond two font
files, so it works offline and cannot break because someone changed an API.

Run it when you add a mod, or when you want fresher descriptions:

```sh
just website-data      # fetch-modrinth.mjs + build-data.mjs
just website-rebuild   # build-data.mjs only, uses the cache
```

## Checks

```sh
just website-check     # needs website-serve running
just website-shoot     # screenshots into website/shots
```

- `check-layout.mjs` loads six viewports from 360px up and fails on any
  element whose box escapes the viewport.
- `check-interactions.mjs` drives the theme toggle, group tabs, search, the
  empty state, URL filter state, copy buttons and the mobile drawer.
- `check-contrast.mjs` walks every visible text node in both themes and fails
  anything under WCAG AA.
- `shoot.mjs` captures full-page screenshots at exact CSS viewports. Use this
  rather than Chrome's `--window-size`, which does not set the layout
  viewport and produces misleadingly cropped captures.

## Deploying

Publish `website/` as static files. The paths are absolute from the root
(`/assets/...`), so the site has to sit at the domain root, or those become
`/zitrus/assets/...`.

## Still to do

- Share image at `/assets/img/og.png` (1200x630). It needs real brand art,
  so it is a marked TODO in `index.html` rather than a generated placeholder.
- `wiki.md` and `mod-list.md` in `specs/` describe a docs site and a fuller
  mod browser. Neither exists yet; this homepage stands alone.
