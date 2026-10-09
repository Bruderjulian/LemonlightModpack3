<div align="center">
  <a href="https://github.com/Bruderjulian/LemonlightModpack3">
    <h1>Zitrus</h1>
  </a>
  <br />
  <br />
  <p align="center">
    A performance-first Fabric modpack with quality of life included
    <br />
    <a href="https://github.com/Bruderjulian/LemonlightModpack3">Explore the repo</a>
    ·
    <a href="https://github.com/Bruderjulian/LemonlightModpack3/issues">Report Bugs</a>
    ·
    <a href="https://github.com/Bruderjulian/LemonlightModpack3/issues">Request Features</a>
  </p>
</div>

![Available for Fabric](https://cdn.jsdelivr.net/npm/@intergrav/devins-badges@3/assets/compact/supported/fabric_vector.svg) [![Chat with us on Discord](https://cdn.jsdelivr.net/npm/@intergrav/devins-badges@3/assets/compact/social/discord-plural_vector.svg)](https://discord.gg/36Tv44cYte) [![Available on GitHub](https://cdn.jsdelivr.net/npm/@intergrav/devins-badges@3/assets/compact/available/github_vector.svg)](https://github.com/skywardmc/zitrus) [![Available on Modrinth](https://cdn.jsdelivr.net/npm/@intergrav/devins-badges@3/assets/compact/available/modrinth_vector.svg)](https://modrinth.com/project/zitrus)

Zitrus is a **client-side** or **server-side** modpack, developed for Fabric, comprised of the **best combination of mods** (e.g. Sodium and Lithium, along with many more) — with a curated set of quality-of-life mods, so a fresh install is smooth out of the box instead of a weekend of tweaking.

Two things set it apart from a bare performance pack:

- **Performance you can feel.** Rendering, game logic, memory and network are all patched, and the imported settings are already configured.
- **Batteries included.** Xaero's World/Minimap, Connected textures, Shaders and more ship by default.

It stays a *foundation*, not a walled garden. Remove what you don't want, add what you do, and you still end up with a fast, stable game.

- [⚡ Performance](#-performance)
- [📦 What's in the box](#-whats-in-the-box)
- [🎮 Supported versions](#-supported-versions)
- [📥 Installing on a client](#-installing-on-a-client)
- [🖥️ Installing on a server](#%EF%B8%8F-installing-on-a-server)
- [✅ Hardware compatibility](#-hardware-compatibility)
- [🐛 Something broken?](#-something-broken)
- [❓ Questions](#-questions)
- [🧑‍💻 Development](#-development)

# ⚡ Performance

Zitrus goes after the four things that actually cost you frames and stutter:

- **Rendering** — Sodium rebuilds the chunk renderer, so higher render distances stop being a slideshow. Culling mods remove entities and faces you can't see, and batching cuts draw calls and overdraw.
- **Frame pacing** — Gnetum spreads HUD updates over frames, Ixeris moves input polling off the main thread, and Dynamic FPS drops the game to 10 FPS when the window isn't focused.
- **Memory and load time** — FerriteCore shrinks block state models, ModernFix trims what the game loads at startup, and Jasione and Put A Plug In it! cut allocation churn and leak fixes.
- **Server tick rate** — Lithium optimises game logic, CCME and Structure Layout Optimizer move chunk work off the main thread, and Krypton plus Very Many Players keep the network out of your tick budget.


# 📦 What's in the box

Everything Zitrus ships, grouped by what it does for you. Libraries and dependencies are omitted — they exist to make the mods below work and nothing more.

A mod tagged **(client)** or **(server)** only installs in that environment; everything untagged ships for both. **(older versions)** means it isn't part of the current Minecraft version, but is still included where it fits. **+ Addons** means the parent mod ships here together with its addons, so you get the full feature set without hunting down each one — addons are counted as part of their parent.

<details open>
<summary><b>⚡ Performance (35 mods)</b></summary>

- **[Sodium + Addons](https://modrinth.com/mod/sodium)**
  - [Sodium Extra](https://modrinth.com/mod/sodium-extra)
  - [Reese's Sodium Options](https://modrinth.com/mod/reeses-sodium-options)
  - [Sodium Extra Information](https://modrinth.com/mod/sodium-extra-information)
  - [Sodium Shadowy Path Blocks (SSPB)](https://modrinth.com/mod/sodium-shadowy-path-blocks)
- [Lithium](https://modrinth.com/mod/lithium)
- [ImmediatelyFast](https://modrinth.com/mod/immediatelyfast) (client)
- [FerriteCore](https://modrinth.com/mod/ferrite-core)
- [CCME](https://modrinth.com/mod/c2me-fabric)
- [Optimized Block Entities (OBE)](https://modrinth.com/mod/obe)
- [ModernFix](https://modrinth.com/mod/modernfix)
- [BadOptimizations](https://modrinth.com/mod/badoptimizations)
- [Krypton](https://modrinth.com/mod/krypton) (server)
- [Iris Shaders](https://modrinth.com/mod/iris)
- [Entity Culling](https://modrinth.com/mod/entityculling) (client)
- [MoreCulling](https://modrinth.com/mod/moreculling)
- [Cull Fewer Leaves](https://modrinth.com/mod/cull-fewer-leaves) (client)
- [Entity Model Features (EMF)](https://modrinth.com/mod/entity-model-features)
- [Entity Texture Features (ETF)](https://modrinth.com/mod/entitytexturefeatures)
- [Packet Fixer](https://modrinth.com/mod/packet-fixer)
- [Dynamic FPS](https://modrinth.com/mod/dynamic-fps) (client)
- [Very Many Players](https://modrinth.com/mod/vmp-fabric) (server)
- [Better Biome Blend](https://modrinth.com/mod/better-biome-blend)
- [BetterGrassify](https://modrinth.com/mod/bettergrassify)
- [Structure Layout Optimizer](https://modrinth.com/mod/structure-layout-optimizer)
- [Ixeris](https://modrinth.com/mod/ixeris) (client)
- [Smart Particles](https://modrinth.com/mod/smart-particles)
- [Async Particles](https://modrinth.com/mod/asyncparticles)
- [ServerCore](https://modrinth.com/mod/servercore)
- [Gnetum](https://modrinth.com/mod/gnetum)
- [Jasione](https://modrinth.com/mod/jasione)
- [Put A Plug In it!](https://modrinth.com/mod/put-a-plug-in-it%21)
- [Fast Surface](https://modrinth.com/mod/zfastsurface)
- [Fast Noise](https://modrinth.com/mod/zfastnoise)
- [Material Rule Compiler](https://modrinth.com/mod/zmaterial-rule-compiler)
- [Async Logger](https://modrinth.com/mod/asynclogger) (client)
- [Quick Pack](https://modrinth.com/mod/quick-pack)
- [Kerria](https://modrinth.com/mod/kerria-opt) (client, older versions)
- [Starlight](https://modrinth.com/mod/starlight) (older versions)

</details>

<details>
<summary><b>🎨 Visuals (12 mods)</b></summary>

- [Continuity](https://modrinth.com/mod/continuity)
- [Animatica Refabricated](https://modrinth.com/mod/animatica)
- [ScalableLux](https://modrinth.com/mod/scalablelux) (client & server)
- [LambDynamicLights](https://modrinth.com/mod/lambdynamiclights)
- [Skyboxify](https://modrinth.com/mod/skyboxify)
- [3D Skin Layers](https://modrinth.com/mod/3dskinlayers)
- [Better Capes](https://modrinth.com/mod/better-capes)
- [Not Enough Animations](https://modrinth.com/mod/not-enough-animations)
- [Chat Patches](https://modrinth.com/mod/chatpatches)
- [Chat Heads](https://modrinth.com/mod/chat-heads)
- [Subtle Effects](https://modrinth.com/mod/subtle-effects)
- [Cubes Without Borders](https://modrinth.com/mod/cubes-without-borders) (older versions)

</details>

<details>
<summary><b>✨ Quality of life (22 mods)</b></summary>

- **[Xaero's + Addons](https://modrinth.com/mod/xaeros-minimap)**
- **[Litematica + Addons](https://modrinth.com/mod/litematica)**
  - [Litematica Printer](https://modrinth.com/mod/litematica-printer)
  - [Litematica Material Filter](https://modrinth.com/mod/litematica-material-filter)
  - [SchematicPreview](https://modrinth.com/mod/schematicpreview)
- [Jade](https://modrinth.com/mod/jade)
- [Fullbright](https://modrinth.com/mod/optimized-fullbright)
- [Mouse Tweaks](https://modrinth.com/mod/mouse-tweaks)
- [Mod Menu](https://modrinth.com/mod/modmenu) (client)
- [BetterF3](https://modrinth.com/mod/betterf3)
- [AppleSkin](https://modrinth.com/mod/appleskin)
- [Accurate Block Placement Reborn](https://modrinth.com/mod/accurate-block-placement-reborn)
- [Zoomify](https://modrinth.com/mod/zoomify)
- [ViaFabricPlus](https://modrinth.com/mod/viafabricplus)
- [Auth Me](https://modrinth.com/mod/auth-me)
- [Better Advancements](https://modrinth.com/mod/better-advancements)
- [InventoryHUD+](https://modrinth.com/mod/inventoryhudplus)
- [Better Statistics Screen](https://modrinth.com/mod/better-stats)
- [Better Mount HUD](https://modrinth.com/mod/better-mount-hud)
- [Held Item Info](https://modrinth.com/mod/held-item-info)
- [Shulker Box Tooltip](https://modrinth.com/mod/shulkerboxtooltip)
- [Skin Shuffle](https://modrinth.com/mod/skinshuffle)
- [Auto Reconnect Reforged](https://modrinth.com/mod/autoreconnectrf)
- **[Flashback + Addons](https://modrinth.com/mod/flashback)**
  - [Flashback Turbo](https://modrinth.com/mod/flashbackturbo)
  - [Flashback Extras](https://modrinth.com/mod/flashback-extras)
- [Controlify](https://modrinth.com/mod/controlify)

</details>

<details>
<summary><b>🔧 Tweaks (9 mods)</b></summary>

- [Crash Assistant](https://modrinth.com/mod/crash-assistant) (client)
- [Fast Server Pings](https://modrinth.com/mod/fastserverpings)
- [FastQuit](https://modrinth.com/mod/fastquit)
- [Adaptive Tooltips](https://modrinth.com/mod/adaptive-tooltips)
- [Better Highlighting](https://modrinth.com/mod/better-highlighting)
- [Paginated Advancements](https://modrinth.com/mod/paginatedadvancements) (older versions)
- [Polytone](https://modrinth.com/mod/polytone) (older versions)
- [No Chat Reports](https://modrinth.com/mod/no-chat-reports)
- [Language Reload](https://modrinth.com/mod/language-reload)

</details>


# 📥 Installing on a client

1. Read [Sodium's driver compatibility notes](https://github.com/CaffeineMC/sodium-fabric/wiki/Driver-Compatibility) first.
2. Install the pack for your Minecraft version from the [installation page](https://skywardmc.org/zitrus/installation) — either through a third-party launcher (Modrinth App, Prism Launcher, ATLauncher, MultiMC, …) or the standalone installer.
3. Follow the [post-install guide](https://skywardmc.org/zitrus/post-install) to allocate enough memory and set the few game options that matter for your hardware.

Adding more mods afterwards is the intended workflow: drop in anything compatible with your Minecraft version and it will sit happily on top of Zitrus. The [wiki](https://skywardmc.org/zitrus) also lists performance mods that are *not* bundled by default and when they are worth installing.

# 🖥️ Installing on a server

<details>
<summary>Server notes</summary>

Zitrus works server-side too. The pack uses Modrinth's mrpack environment feature, so installing it on a server pulls the server-side mods only — no client mods, and vanilla clients can still join.

<details>
<summary>🏷️ Aternos</summary>

[Aternos](https://aternos.org) gives you a free, low-power server, but vanilla Minecraft on it is slow. Aternos can install Zitrus via `Software → Change → Modpacks → Modrinth → Zitrus`, which speeds the server up considerably without changing vanilla behaviour.

</details>

<details>
<summary>📦 mrpack-install</summary>

Install [`mrpack-install`](https://github.com/nothub/mrpack-install/releases) (or your distro's package) and run:

```sh
mrpack-install zitrus [optional version number]
```

</details>

<details>
<summary>🐋 Docker Compose</summary>

> Some Docker knowledge is assumed.

1. Install [Docker Engine](https://docs.docker.com/engine/install).
2. Create a directory and save the Compose file below as `docker-compose.yml`. It also carries server-side performance settings: `sync-chunk-writes` disabled, reduced render and simulation distance.
3. Run `docker compose up -d` in that directory.

See the [itzg/minecraft-server docs](https://docker-minecraft-server.readthedocs.io) for everything else.

```yaml
services:
  mc:
    image: itzg/minecraft-server
    tty: true
    stdin_open: true
    ports:
      - "25565:25565"
    environment:
      EULA: "TRUE"
      # Zitrus and other mods
      MOD_PLATFORM: MODRINTH
      MODRINTH_DOWNLOAD_DEPENDENCIES: required
      MODRINTH_MODPACK: zitrus # latest Zitrus, or a specific Modrinth version link
      MODRINTH_PROJECTS: spark, chunky # comma-separated extra mods
      # Server properties
      VIEW_DISTANCE: 8
      SIMULATION_DISTANCE: 5
      SYNC_CHUNK_WRITES: false # big performance win, but can cause desync and (very rarely) data corruption — set to true if you have no backups
    volumes:
      - ./data:/data
```

</details>

<details>
<summary>✨ mcman</summary>

[mcman](https://github.com/ParadigmMC/mcman) manages a server's mods, plugins and configs. Import Zitrus while initializing:

```sh
mcman init --mrpack mr:zitrus
```

Then `mcman build`, and start it from `server/` with `sh start.sh` (or `call start.bat`). See [mcman's docs](https://github.com/ParadigmMC/mcman/blob/main/DOCS.md).

</details>

<details>
<summary>💿 mrpack4server</summary>

[mrpack4server](https://github.com/Patbox/mrpack4server) takes a `modpack-info.json`:

```json
{
	"project_id": "zitrus",
	"version_id": "version id or name"
}
```

</details>

<details>
<summary>🧙 packwiz-installer</summary>

> Back up your server first.

Some hosts let you run a command before the server starts — a *pre-launch command*. First grab [`packwiz-installer-bootstrap`](https://github.com/packwiz/packwiz-installer-bootstrap/releases) and place it next to your Fabric loader jar (usually the server root). Then point it at a [pack.toml](https://github.com/Bruderjulian/LemonlightModpack3/tree/main/versions) from a version you support:

```sh
java -jar packwiz-installer-bootstrap.jar -g -s server https://raw.githack.com/skywardmc/zitrus/dist/versions/fabric/1.21.1/pack.toml
```

Adding that command to your batch file or shell script before the launch command works fine.

_Stuck? Try the [packwiz installer tutorial](https://packwiz.infra.link/tutorials/installing/packwiz-installer/#using-a-modpack-with-a-server), then ask in the [packwiz Discord](https://discord.gg/DcSkRF4)._

</details>

</details>

# ✅ Hardware compatibility

Zitrus inherits its limits from the mods it ships — see the corresponding section in [Sodium's Modrinth description](https://modrinth.com/mod/sodium#hardware-compatibility) for GPUs and drivers that are known to misbehave, plus guidance for unusual setups (older iGPUs, laptops with switchable graphics, ARM/ADB devices).

# 🐛 Something broken?

Check these first — they cover most reports:

1. **Crash on launch or black screen?** Read [Sodium's driver compatibility page](https://github.com/CaffeineMC/sodium-fabric/wiki/Driver-Compatibility) and disable the driver it tells you to. This is the single most common cause.
2. **Low FPS?** Raise render distance before blaming the pack, give the game enough RAM (the [post-install guide](https://skywardmc.org/zitrus/post-install) has the numbers), and make sure your launcher isn't running the game on an integrated GPU.
3. **Started after adding a mod?** Remove it and confirm. Zitrus is tuned as a set — mods that replace the same work (another renderer, another minimap, another block-entities mod) will fight it.
4. **Server-side only?** Client mods aren't installed on servers, so a client-only feature won't exist there. That's the [mrpack environment feature](https://docs.modrinth.com/modpacks/environment-format) doing its job.

Still stuck? Open an issue on the [issue tracker](https://github.com/Bruderjulian/LemonlightModpack3/issues) with your CPU, GPU, RAM, OS, Minecraft version, modpack version and `latest.log`. Crash Assistant, bundled with the pack, collects all of that for you.

There are also templates for [mod requests](https://github.com/Bruderjulian/LemonlightModpack3/issues/new?template=mod-request.md) and [config requests](https://github.com/Bruderjulian/LemonlightModpack3/issues/new?template=config-request.md) if you'd rather see something added than report a bug.

# ❓ Questions

The [wiki](https://skywardmc.org/zitrus) covers installation, post-install tuning, troubleshooting and FAQs, and is updated far more often than this README. For anything else, come say hi on [Discord](https://discord.gg/36Tv44cYte).

# 🧑‍💻 Development

The repo is driven by [packwiz](https://packwiz.infra.link) and [just](https://github.com/casey/just). One directory per Minecraft version under [`versions/fabric`](./versions):

```sh
just refresh fabric    # rewrite pack.toml & index.toml
just update fabric     # update every pinned mod
just export fabric     # export .mrpack files to build/
```

Release builds are produced by `.github/workflows/build-dist.yml`, which publishes the resolved packs to the `dist` branch and tags them, so `pack.toml` files there are the ones to install with `packwiz-installer`.
