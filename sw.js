// Service worker : le jeu fonctionne hors connexion une fois installé.
// Changer CACHE à chaque mise en ligne pour forcer la mise à jour.
const CACHE = "legion-eternelle-v2.15.14";
// Musiques (4,8 Mo, coupées par défaut) : hors du pré-cache, gardées à la première écoute
// dans un cache à part qui survit aux mises à jour. Changer le numéro si un MP3 change.
const MEDIA = "legion-eternelle-media-1";
const FILES = [
  "./",
  "./index.html",
  "./ks-back.js",
  "./ks-studio.js",
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
  "./assets/monsters/treant.webp",
  "./assets/monsters/shard.webp",
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
  "./js/data/patchnotes.js",
  "./js/data/specs.js",
  "./js/main.js",
  "./js/ui/battle.js",
  "./js/ui/format.js",
  "./js/ui/screens.js",
  "./js/ui/sfx.js",
  "./js/ui/music.js",
  "./js/ui/sheet.js",
  "./js/ui/tutorial.js",
];

// Les fichiers sont lus avec cache: "reload" pour ne pas recopier une ancienne
// version encore gardée par le navigateur (GitHub Pages la garde 10 min).
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(FILES.map((f) => new Request(f, { cache: "reload" }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("legion-eternelle-") && k !== CACHE && k !== MEDIA).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Code (page, JS, CSS, JSON) : réseau d'abord, pour que tout vienne de la même version ;
// le cache ne sert que hors connexion. Images, sons, polices : cache d'abord.
const CODE = /\.(?:html|js|css|json)$/;

function networkFirst(request) {
  return fetch(request.url, { cache: "no-cache" })
    .then((response) => {
      const key = request.mode === "navigate" ? "./index.html" : request;
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(key, copy));
        return response;
      }
      // Serveur en panne (5xx) : la copie en cache plutôt qu'une page d'erreur.
      if (response.status >= 500) return caches.match(key, { ignoreSearch: true }).then((cached) => cached || response);
      return response;
    })
    .catch(() => caches.match(request.mode === "navigate" ? "./index.html" : request, { ignoreSearch: true }));
}

// Musique : le navigateur la lit par plages (en-tête Range). Le fichier entier est gardé
// dans MEDIA ; on y découpe la plage demandée (réponse 206, exigée par Safari).
function music(event, url) {
  const range = event.request.headers.get("range");
  return caches.match(url.pathname, { cacheName: MEDIA }).then((hit) => {
    if (!hit) {
      event.waitUntil(
        fetch(url.pathname)
          .then((full) => {
            if (full.status === 200) return caches.open(MEDIA).then((cache) => cache.put(url.pathname, full));
          })
          .catch(() => {})
      );
      return fetch(event.request);
    }
    if (!range) return hit;
    return hit.arrayBuffer().then((buf) => {
      const m = /bytes=(\d*)-(\d*)/.exec(range) || [];
      const size = buf.byteLength;
      const start = m[1] ? +m[1] : m[2] ? Math.max(0, size - +m[2]) : 0;
      const end = m[1] && m[2] ? Math.min(+m[2], size - 1) : size - 1;
      if (start >= size || start > end) {
        return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
      }
      return new Response(buf.slice(start, end + 1), {
        status: 206,
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Range": `bytes ${start}-${end}/${size}`,
          "Content-Length": String(end - start + 1),
          "Accept-Ranges": "bytes",
        },
      });
    });
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  if (url.pathname.endsWith(".mp3")) {
    event.respondWith(music(event, url));
    return;
  }
  if (request.mode === "navigate" || url.pathname.endsWith("/") || CODE.test(url.pathname)) {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
