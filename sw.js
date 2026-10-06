// Service worker : le jeu fonctionne hors connexion une fois installé.
// Changer CACHE à chaque mise en ligne pour forcer la mise à jour.
const CACHE = "legion-eternelle-v2.11.0";
const FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./assets/icon-192.png",
  "./assets/keismey-logo.webp",
  "./assets/title-bg.webp",
  "./assets/fonts/cinzel.woff",
  "./assets/fonts/sora.woff",
  "./assets/bg/ancientGolem.webp",
  "./assets/bg/arcaneDragon.webp",
  "./assets/bg/bladeMaster.webp",
  "./assets/bg/campaign.webp",
  "./assets/bg/colossalGuardian.webp",
  "./assets/bg/fallenHighPriest.webp",
  "./assets/bg/primalDruid.webp",
  "./assets/bg/scarletHunter.webp",
  "./assets/bg/voidArchmage.webp",
  "./assets/bosses/ancientGolem.webp",
  "./assets/bosses/arcaneDragon.webp",
  "./assets/bosses/bladeMaster.webp",
  "./assets/bosses/colossalGuardian.webp",
  "./assets/bosses/fallenHighPriest.webp",
  "./assets/bosses/primalDruid.webp",
  "./assets/bosses/scarletHunter.webp",
  "./assets/bosses/voidArchmage.webp",
  "./assets/monsters/bandit.webp",
  "./assets/monsters/cultist.webp",
  "./assets/monsters/ghoul.webp",
  "./assets/monsters/goblin.webp",
  "./assets/monsters/harpy.webp",
  "./assets/monsters/orc.webp",
  "./assets/monsters/skeleton.webp",
  "./assets/monsters/slime.webp",
  "./assets/monsters/spider.webp",
  "./assets/monsters/wolf.webp",
  "./assets/slots/boots.webp",
  "./assets/slots/chest.webp",
  "./assets/slots/gloves.webp",
  "./assets/slots/helmet.webp",
  "./assets/slots/legs.webp",
  "./assets/icons/gold.webp",
  "./assets/icons/shards.webp",
  "./assets/icons/souls.webp",
  "./assets/uniques/aegis.webp",
  "./assets/uniques/chain.webp",
  "./assets/uniques/vampiric.webp",
  "./assets/uniques/titan.webp",
  "./assets/uniques/tempest.webp",
  "./assets/uniques/inferno.webp",
  "./assets/uniques/bastion.webp",
  "./assets/uniques/reaper.webp",
  "./assets/uniques/executioner.webp",
  "./assets/uniques/frenzy.webp",
  "./assets/uniques/phoenix.webp",
  "./assets/uniques/retaliate.webp",
  "./assets/heroes/alchemist.webp",
  "./assets/heroes/bard.webp",
  "./assets/heroes/berserker.webp",
  "./assets/heroes/cleric.webp",
  "./assets/heroes/druid.webp",
  "./assets/heroes/guardian.webp",
  "./assets/heroes/mage.webp",
  "./assets/heroes/monk.webp",
  "./assets/heroes/paladin.webp",
  "./assets/heroes/ranger.webp",
  "./assets/heroes/rogue.webp",
  "./assets/heroes/runeknight.webp",
  "./assets/heroes/shadowpriest.webp",
  "./assets/heroes/shaman.webp",
  "./assets/heroes/warlock.webp",
  "./assets/heroes/warrior.webp",
  "./assets/icon-512-maskable.png",
  "./assets/icon-512.png",
  "./assets/music.mp3",
  "./css/style.css",
  "./js/core/challenges.js",
  "./js/core/combat.js",
  "./js/core/curve.js",
  "./js/core/game.js",
  "./js/core/heroes.js",
  "./js/core/loot.js",
  "./js/core/meta.js",
  "./js/core/state.js",
  "./js/core/storage.js",
  "./js/core/zones.js",
  "./js/data/bosses.js",
  "./js/data/classes.js",
  "./js/data/config.js",
  "./js/data/effects.js",
  "./js/data/i18n.js",
  "./js/data/specs.js",
  "./js/main.js",
  "./js/ui/battle.js",
  "./js/ui/format.js",
  "./js/ui/screens.js",
  "./js/ui/sfx.js",
  "./js/ui/sheet.js",
  "./js/ui/tutorial.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Page : réseau d'abord (pour recevoir les mises à jour), cache en secours.
// Fichiers : cache d'abord, réseau sinon.
self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put("./index.html", copy));
          return response;
        })
        .catch(() => caches.match("./index.html"))
    );
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
