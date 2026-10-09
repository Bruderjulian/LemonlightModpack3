# Mod list — feature list

## Content (per mod)

- [ ] Name, one-line player-facing description, Modrinth link
- [ ] Icon downloaded at build time and served from the site itself;
- [ ] Environment tag (both / client-only / server-only) from pack metadata
- [ ] Addons nested under their parent (e.g. Sodium + Addons counts as one entry)
- [ ] Libraries / bare dependencies hidden

## Browse & filter

- [ ] Groups: All / Performance / Visuals / Quality of life / Tweaks
- [ ] Environment filter: both envs / client / server
- [ ] Search across name, description, slug
- [ ] Follows the Minecraft version selector (mod set differs per version)
- [ ] Visible counts (showing X of Y, per-group totals)
- [ ] Composed empty state (how to get back)
- [ ] Filter state in the URL (shareable, reload-stable)

## Data

- [ ] Generated at build time, not typed by hand
- [ ] Source: packwiz metadata (name, side, Modrinth id) + Modrinth API
  at build time only (slug, description, icon download) + one
  hand-maintained grouping file (group, blurb, parenting)
- [ ] One JSON document per Minecraft version; ungrouped newcomers fail
  the build instead of vanishing
- [ ] No runtime Modrinth calls of any kind — icons and data ship
  with the site
