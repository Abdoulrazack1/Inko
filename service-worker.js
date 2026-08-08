// service-worker.js — PWA Inko
// Stratégie : network-first pour /api (toujours frais)
//             stale-while-revalidate pour assets statiques
//             cache des couvertures mangadex (bande passante)

// Audit QUAL-08 : ce compteur est manuel et se désynchronise de la version
// applicative — un oubli de bump sert du code périmé, ce qui est exactement
// l'« écran noir après mise à jour » qui a motivé le bouton « Vider le cache ».
// Bump obligatoire à chaque changement d'asset ; la liste STATIC_ASSETS est
// désormais générée (npm run gen-precache) et vérifiée en CI.
const CACHE_VERSION = 'inko-2.4.0-notif53';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const COVERS_CACHE  = `${CACHE_VERSION}-covers`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const OFFLINE_CACHE = 'inko-offline';   // chapitres téléchargés (non versionné : persiste)
const OFFLINE_FALLBACK = '/offline.html';

// Hôtes de couvertures à mettre en cache durable (cache-first)
function isCoverHost(hostname) {
    return hostname === 'uploads.mangadex.org'
        || hostname.endsWith('mangadex.network')
        || hostname === 'temp.compsci88.com'      // WeebCentral
        || hostname.endsWith('royalroadcdn.com'); // Royal Road (covers directes)
}

const STATIC_ASSETS = [
    '/',
    '/accueil.html',
    '/anilist.html',
    '/assets/css/accueil.css',
    '/assets/css/bibliotheque.css',
    '/assets/css/catalogue.css',
    '/assets/css/chapitre.css',
    '/assets/css/collection-detail.css',
    '/assets/css/collections.css',
    '/assets/css/fonts.css',
    '/assets/css/global.css',
    '/assets/css/lecture.css',
    '/assets/css/music.css',
    '/assets/css/notes.css',
    '/assets/css/profil.css',
    '/assets/css/recherche.css',
    '/assets/css/serie.css',
    '/assets/i18n/en.json',
    '/assets/img/icon-192.png',
    '/assets/img/icon-512.png',
    '/assets/img/icon.svg',
    '/assets/js/accueil.js',
    '/assets/js/anilist.js',
    '/assets/js/api.js',
    '/assets/js/bibliotheque.js',
    '/assets/js/card-hover.js',
    '/assets/js/catalogue.js',
    '/assets/js/chapitre.js',
    '/assets/js/collection-detail.js',
    '/assets/js/collections.js',
    '/assets/js/downloads-page.js',
    '/assets/js/downloads.js',
    '/assets/js/eula.js',
    '/assets/js/global.js',
    '/assets/js/hero3d.js',
    '/assets/js/i18n.js',
    '/assets/js/import.js',
    '/assets/js/lecture.js',
    '/assets/js/liste.js',
    '/assets/js/localreader.js',
    '/assets/js/notes-ui.js',
    '/assets/js/notes.js',
    '/assets/js/notifications.js',
    '/assets/js/onboarding.js',
    '/assets/js/parametres.js',
    '/assets/js/profil.js',
    '/assets/js/pwa.js',
    '/assets/js/recherche.js',
    '/assets/js/serie.js',
    '/assets/js/sources.js',
    '/assets/js/stats.js',
    '/assets/js/storage.js',
    '/assets/js/theme.js',
    '/assets/js/u.js',
    '/assets/js/userdata.js',
    '/assets/vendor/jszip.min.js',
    '/bibliotheque.html',
    '/catalogue.html',
    '/chapitre.html',
    '/collection-detail.html',
    '/collections.html',
    '/confidentialite.html',
    '/downloads.html',
    '/import.html',
    '/index.html',
    '/lecture.html',
    '/liste.html',
    '/localreader.html',
    '/manifest.webmanifest',
    '/notes.html',
    '/notifications.html',
    '/offline.html',
    '/parametres.html',
    '/profil.html',
    '/recherche.html',
    '/serie.html',
    '/sources.html',
    '/stats.html',
    '/u.html',
];

self.addEventListener('install', (event) => {
    // Pré-cache par asset : un 404 isolé n'annule plus tout le lot
    // (audit SW3 : cache.addAll échoue en bloc au moindre asset manquant).
    event.waitUntil((async () => {
        const c = await caches.open(STATIC_CACHE);
        const results = await Promise.allSettled(STATIC_ASSETS.map(a => c.add(a)));
        const failed = results.filter(r => r.status === 'rejected').length;
        if (failed) console.warn(`[sw] pré-cache : ${failed}/${STATIC_ASSETS.length} asset(s) non mis en cache`);
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        // Navigation preload : la requête part pendant le réveil du SW (audit SW6)
        if (self.registration.navigationPreload) {
            try { await self.registration.navigationPreload.enable(); } catch (e) { /* navigationPreload non supporte */ }
        }
        const keys = await caches.keys();
        await Promise.all(keys
            .filter(k => !k.startsWith(CACHE_VERSION) && k !== OFFLINE_CACHE)
            .map(k => caches.delete(k))
        );
        await self.clients.claim();
    })());
});

self.addEventListener('fetch', (event) => {
    const req = event.request;
    if (req.method !== 'GET') return;
    const url = new URL(req.url);

    // 0) Images : sert depuis le cache hors-ligne si téléchargées
    if (req.destination === 'image') {
        event.respondWith(offlineImage(req, url));
        return;
    }

    // 1) API : network-first. Les GET publics (catalogue, sources, chapitres…)
    //    gardent une copie de secours pour consultation hors-ligne (audit SW8).
    //    Jamais les endpoints par compte (/me, /auth, /admin, /spotify).
    if (url.pathname.startsWith('/api/')) {
        const isPublicGet = !/^\/api\/(me|auth|admin|spotify)(\/|$)/.test(url.pathname);
        event.respondWith(networkFirst(req, isPublicGet ? RUNTIME_CACHE : undefined));
        return;
    }

    // 2) Covers / pages MangaDex : cache-first (économise bande passante)
    if (isCoverHost(url.hostname)) {
        event.respondWith(cacheFirst(req, COVERS_CACHE));
        return;
    }

    // 3) Code de l'app (HTML/JS/CSS) : network-first → toujours à jour,
    //    cache uniquement en secours hors-ligne. Évite le code périmé.
    if (url.origin === self.location.origin) {
        const isCode = /\.(html|js|css|webmanifest)$/.test(url.pathname) || url.pathname === '/';
        event.respondWith(isCode ? networkFirst(req, RUNTIME_CACHE, event) : staleWhileRevalidate(req));
        return;
    }
});

// Borne un cache à `max` entrées (éviction des plus anciennes) — audit SW7
async function trimCache(cacheName, max) {
    try {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        if (keys.length <= max) return;
        await Promise.all(keys.slice(0, keys.length - max).map(k => cache.delete(k)));
    } catch (e) { /* cache indisponible : on reessaiera au prochain passage */ }
}

async function offlineImage(req, url) {
    try {
        const off = await caches.open(OFFLINE_CACHE);
        const hit = await off.match(req, { ignoreVary: true });
        if (hit) return hit;
    } catch (e) { /* cache hors-ligne absent : on tente le reseau */ }
    // Couvertures (proxifiées /api/img + hôtes de covers connus) : cache-first
    if ((url.origin === self.location.origin && url.pathname === '/api/img')
        || isCoverHost(url.hostname)) {
        return cacheFirst(req, COVERS_CACHE);
    }
    try { return await fetch(req); }
    catch (e) { const c = await caches.match(req); return c || new Response('', { status: 504 }); }
}

async function networkFirst(req, cacheName, event) {
    try {
        // Navigation preload si dispo (réponse déjà en route pendant le réveil du SW)
        const preload = event ? await event.preloadResponse.catch(() => null) : null;
        const res = preload || await fetch(req);
        // Met en cache la version fraîche pour le mode hors-ligne
        if (cacheName && res.ok && req.url.startsWith('http')) {
            const c = await caches.open(cacheName);
            c.put(req, res.clone()).catch(() => {});
        }
        return res;
    } catch (e) {
        const cached = await caches.match(req);
        if (cached) return cached;
        // Navigation hors-ligne sans cache → page de repli offline.html (audit SW1)
        if (req.mode === 'navigate') {
            const off = await caches.match(OFFLINE_FALLBACK);
            if (off) return off;
        }
        return Response.json({ error: 'Hors ligne' }, { status: 503 });
    }
}

async function cacheFirst(req, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
        const res = await fetch(req);
        if (res.ok) {
            cache.put(req, res.clone()).catch(() => {});
            trimCache(cacheName, 400);   // le cache covers ne grossit plus indéfiniment (audit SW7)
        }
        return res;
    } catch (e) {
        return new Response('', { status: 504 });
    }
}

async function staleWhileRevalidate(req) {
    const cache = await caches.open(RUNTIME_CACHE);
    const cached = await cache.match(req);
    const networkPromise = fetch(req).then(res => {
        if (res.ok && req.url.startsWith('http')) {
            cache.put(req, res.clone()).catch(() => {});
        }
        return res;
    }).catch(() => null);
    return cached || (await networkPromise) || new Response('', { status: 504 });
}

// ── Web Push (audit §6.3 / SW) ────────────────────────────────
self.addEventListener('push', (event) => {
    let data = {};
    try { data = event.data ? event.data.json() : {}; }
    catch (e) { data = { body: event.data && event.data.text() }; }
    const title = data.title || 'Inko';
    // Réveil des onglets ouverts (audit G.4) : le badge de la cloche se
    // rafraîchit immédiatement sans attendre le prochain sondage.
    event.waitUntil((async () => {
        try {
            const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
            all.forEach(c => { try { c.postMessage({ type: 'notif:new' }); } catch (e) { /* onglet ferme entre-temps */ } });
        } catch (e) { /* aucun client a reveiller */ }
    })());
    event.waitUntil(self.registration.showNotification(title, {
        body:  data.body || '',
        icon:  '/assets/img/icon-192.png',
        badge: '/assets/img/icon-192.png',
        // Audit AMEL-53 : le tag valait `data.type` pour TOUT le monde — cinq
        // séries avec du nouveau produisaient cinq push qui se remplaçaient
        // l'un l'autre, et l'utilisateur n'en voyait qu'un. Le tag est
        // désormais l'œuvre : une série remplace sa propre notification
        // (c'est le regroupement voulu) et jamais celle d'une autre.
        tag:   data.groupKey ? `${data.type}:${data.groupKey}` : (data.type || 'inko'),
        data:  { link: data.link || '/' },
        // Audit AMEL-55 : ouvrir le chapitre demandait de cliquer la
        // notification puis de retrouver où on en était. Une action explicite
        // économise ce détour — et n'apparaît que là où elle a un sens.
        actions: data.type === 'new_chapter'
            ? [{ action: 'lire', title: 'Lire maintenant' }]
            : [],
    }));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    // Le clic sur le corps et le clic sur « Lire maintenant » mènent au même
    // endroit : le lien porte déjà le premier chapitre NON LU (calculé côté
    // serveur), pas le dernier paru.
    const link = (event.notification.data && event.notification.data.link) || '/';
    event.waitUntil((async () => {
        const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const c of all) {
            if ('focus' in c) { try { await c.navigate(link); } catch (e) { /* navigation refusee : on focus quand meme */ } return c.focus(); }
        }
        if (self.clients.openWindow) return self.clients.openWindow(link);
    })());
});
