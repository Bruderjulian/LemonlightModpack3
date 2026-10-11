/**
 * English. This file is the source of truth for the key set: check:i18n
 * fails if another locale has a key this one does not, or is missing one.
 *
 * Mod names, blurbs and group blurbs are data, not copy. They stay as Modrinth
 * serves them, in English, for every locale. Translating 87 blurbs by hand
 * would be worse than leaving the source language: a mistranslated mod
 * description is a support ticket, whereas an English one is recognisably the
 * mod author's own words.
 */

export default {
	/* ---------- Document ---------- */
	"meta.title": "Zitrus: a performance-first Fabric modpack",
	"meta.description":
		"Zitrus is a performance-first Fabric modpack for Minecraft with quality of life already configured. 87 curated mods for six Minecraft versions, client and server.",
	"meta.ogDescription":
		"Rendering, memory, network and tick rate are tuned for you. Nothing to configure before you play.",

	/* ---------- Skip link and chrome ---------- */
	"a11y.skip": "Skip to content",
	"a11y.home": "Zitrus home",
	"a11y.sections": "Sections",
	"a11y.openMenu": "Open menu",
	"a11y.closeMenu": "Close menu",
	"a11y.toggleTheme": "Toggle colour theme",
	"a11y.language": "Language",
	"a11y.languageList": "Choose a language",
	"a11y.onModrinth": "Zitrus on Modrinth",
	"a11y.onCurseforge": "Zitrus on CurseForge",
	"a11y.onGithub": "Zitrus on GitHub",
	"a11y.onDiscord": "Zitrus on Discord",

	/* ---------- Nav ---------- */
	"nav.mods": "Mods",
	"nav.install": "Install",
	"nav.wiki": "Wiki",
	"nav.discord": "Discord",

	/* ---------- Hero ---------- */
	"hero.eyebrow": "Fabric performance modpack",
	"hero.title": "Fast <em>by default.</em>",
	"hero.sub":
		"A performance-first Fabric modpack with quality of life already configured and nothing to set up before you play.",
	"hero.ctaInstall": "Install",
	"hero.ctaBrowse": "Browse the mods",

	/* ---------- Hero panel ---------- */
	"panel.label": "Pack at a glance",
	"panel.loading": "loading",
	"panel.modsInstalled": "Mods installed",
	"panel.curated": "Curated",
	"panel.mcVersions": "MC versions",
	"panel.byGroup": "By group",
	"panel.tapToFilter": "tap to filter",
	"panel.supported": "Supported",
	"panel.latestSuffix": "{version} · latest",
	"panel.showGroup": "Show the {group} mods",

	/* ---------- Foundation band ---------- */
	"foundation.quote":
		"It stays a <em>foundation</em>, not a walled garden. Remove what you don't want, add what you do.",
	"foundation.readWiki": "Read the wiki",
	"foundation.askDiscord": "Ask on Discord",
	"foundation.aside":
		"Zitrus is tuned as a set, so mods that replace the same work, another renderer or another minimap, will fight it. Drop one or the other and the pack stays fast. The wiki covers which mods are worth adding on top and which ones are not.",

	/* ---------- Mods section ---------- */
	"mods.heading": "Everything in the box.",
	"mods.lead":
		"Every curated mod Zitrus ships, grouped by what it does for you. Addons ride along under their parent, so a mod you get as a bundle reads as one entry. Libraries are left out because they exist only to make the rest work.",
	"mods.groups": "Mod groups",
	"mods.tabAll": "All",
	"mods.searchLabel": "Search mods",
	"mods.searchPlaceholder": "Search mods",
	"mods.clearSearch": "Clear search",
	"mods.loading": "Loading mod list...",
	"mods.hideAddons": "Hide addons",
	"mods.filterEnv": "Filter by environment",
	"mods.envClient": "Client",
	"mods.envServer": "Server",
	"mods.envBoth": "Client & Server",
	"mods.sortLabel": "Order the mod list",
	"mods.sortDownloads": "Downloads",
	"mods.sortRelevance": "Relevance",
	"mods.showAll": "Show all",
	"mods.showFewer": "Show fewer",
	"mods.showAllCount": {
		one: "Show all {n} mod",
		other: "Show all {n} mods"
	},
	"mods.showing": "Showing {shown} of {total}",
	"mods.count": {
		one: "{n} mod",
		other: "{n} mods"
	},
	"mods.noMatch": "No mods match {query}.",
	"mods.clearTheSearch": "Clear the search",
	"mods.addonsCount": {
		one: "+ {n} addon",
		other: "+ {n} addons"
	},

	/* ---------- Side tags ---------- */
	"side.client": "Client",
	"side.server": "Server",
	"side.both": "Client & Server",
	"side.clientTitle": "Client only, not installed on servers",
	"side.serverTitle": "Server only, not installed on clients",
	"side.bothTitle": "Installed on clients and servers",

	/* ---------- Group names, keyed to groups.json ---------- */
	"group.performance": "Performance",
	"group.visuals": "Visuals",
	"group.qol": "Quality of life",
	"group.tweaks": "Tweaks",

	/* ---------- Install section ---------- */
	"install.heading": "Pick a launcher. Pick a version. Play.",
	"install.lead":
		"The wizard below hands you the exact install for your setup. Nothing is left to configure afterwards, because the pack ships already tuned.",
	"install.step1": "Choose a launcher",
	"install.step2": "Choose your Minecraft version",
	"install.step3": "Install and launch",
	"install.chooseLauncher": "Choose a launcher",

	/* ---------- Notes ---------- */
	"note.blackScreenTitle": "Black screen or crash on launch?",
	"note.blackScreenBody":
		"It is almost always a driver Sodium flags. Read",
	"note.blackScreenLink": "Sodium's driver notes",
	"note.blackScreenAfter":
		"and disable the one it names, which fixes most reports before anything else is tried.",
	"note.lowFpsTitle": "Low FPS after the first minute?",
	"note.lowFpsBody":
		"Raise render distance, make sure the launcher runs the game on your dedicated GPU, and give it enough RAM. The",
	"note.lowFpsLink": "post-install guide",
	"note.lowFpsAfter": "has the numbers per setup.",
	"note.serverTitle": "Running a server instead?",
	"note.serverBody":
		"Server setup, Docker and pre-launch commands are in the",
	"note.serverLink": "server section of the repo",
	"note.serverAfter": ". Vanilla clients still join.",

	/* ---------- Wizard ---------- */
	"wizard.copy": "Copy",
	"wizard.copied": "Copied",
	"wizard.prelaunch": "Pre-launch command",

	"wizard.modrinth.name": "Modrinth App",
	"wizard.modrinth.step1": "Install the app and sign in to your account.",
	"wizard.modrinth.step2": "Press the button below to open Zitrus, then press Install.",
	"wizard.modrinth.step3": "Keep {version} selected in the version dropdown to get this exact build.",
	"wizard.modrinth.step4": "Launch it from your profile. Nothing else to configure.",
	"wizard.modrinth.open": "Open in Modrinth App",
	"wizard.modrinth.project": "Project page",

	"wizard.prism.name": "Prism Launcher",
	"wizard.prism.step1": "Open Add Instance in Prism Launcher.",
	"wizard.prism.step2": "Switch the source to Modrinth and search for Zitrus.",
	"wizard.prism.step3": "Create the instance for {version}.",
	"wizard.prism.step4": "Set your Java version and memory, then launch.",
	"wizard.prism.open": "Open on Modrinth",

	"wizard.curseforge.name": "CurseForge app",
	"wizard.curseforge.step1": "Open Minecraft in the CurseForge app.",
	"wizard.curseforge.step2": "Choose Install a modpack and search for Zitrus.",
	"wizard.curseforge.step3": "Pick {version}, then let the app install it.",
	"wizard.curseforge.step4":
		"Every dependency is downloaded into a new profile for you.",
	"wizard.curseforge.open": "Open on CurseForge",

	"wizard.standalone.name": "Standalone",
	"wizard.standalone.step1":
		"Download packwiz-installer-bootstrap and put the jar in your instance folder.",
	"wizard.standalone.step2":
		"Run the command below once. It writes the profile and fetches the mods.",
	"wizard.standalone.step3": "Point it at the {version} build with the path above.",
	"wizard.standalone.step4": "Start Minecraft afterwards as usual.",
	"wizard.standalone.releases": "Bootstrap releases",

	/* ---------- Footer ---------- */
	"footer.tag":
		"A performance-first Fabric modpack with quality of life included. Maintained by LemonlightMC.",
	"footer.getIt": "Get it",
	"footer.learn": "Learn",
	"footer.contribute": "Contribute",
	"footer.modrinth": "Modrinth",
	"footer.curseforge": "CurseForge",
	"footer.releases": "Releases",
	"footer.discord": "Discord",
	"footer.installation": "Installation",
	"footer.serverSetup": "Server setup",
	"footer.hardware": "Hardware",
	"footer.troubleshooting": "Troubleshooting",
	"footer.issueTracker": "Issue tracker",
	"footer.requestMod": "Request a mod",
	"footer.requestConfig": "Request a config",
	"footer.notAffiliated": "Not affiliated with Mojang or Microsoft",
	/* Composed in main.js from the two counts, so each inflects on its own:
	   six versions and 106 mods are two different nouns in most languages. */
	"footer.summary": "{version} · {versions} · {mods}",
	"mods.versionCount": {
		one: "{n} version",
		other: "{n} versions"
	},

	/* ---------- Language menu ---------- */
	"lang.current": "Current language: {language}"
};