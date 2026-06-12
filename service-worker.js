// service-worker.js — PWA Inko
// Stratégie : network-first pour /api (toujours frais)
//             stale-while-revalidate pour assets statiques
//             cache des couvertures mangadex (bande passante)

const CACHE_VERSION = 'inko-v9';
const STATIC_CACHE  = `${CACHE_VERSION}-static`;
const COVERS_CACHE  = `${CACHE_VERSION}-covers`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const OFFLINE_CACHE = 'inko-offline';   // chapitres téléchargés (non versionné : persiste)

const STATIC_ASSETS = [
    '/',
    '/accueil.html',
    '/catalogue.html',
    '/serie.html',
    '/chapitre.html',
    '/profil.html',
    '/bibliotheque.html',
    '/parametres.html',
    '/sources.html',
    '/recherche.html',
    '/assets/js/recherche.js',
    '/collections.html',
    '/assets/js/collections.js',
    '/assets/css/collections.css',
    '/collection-detail.html',
    '/assets/js/collection-detail.js',
    '/assets/css/collection-detail.css',
    '/stats.html',
    '/assets/js/stats.js',
    '/player.html',
    '/anilist.html',
    '/assets/js/anilist.js',
    '/page_login.html',
    '/page_signup.html',
    '/page_mdpoublie.html',
    '/page_nouveaumdp.html',
    '/manifest.webmanifest',
    '/assets/css/global.css',
    '/assets/css/accueil.css',
    '/assets/css/catalogue.css',
    '/assets/css/serie.css',
    '/assets/css/chapitre.css',
    '/assets/css/profil.css',
    '/assets/css/auth-unified.css',
    '/assets/js/api.js',
    '/assets/js/storage.js',
    '/assets/js/global.js',
    '/assets/js/music.js',
    '/assets/js/downloads.js',
    '/assets/js/password-strength.js',
    '/assets/js/accueil.js',
    '/assets/js/catalogue.js',
    '/assets/js/serie.js',
    '/assets/js/chapitre.js',
    '/assets/js/profil.js',
    '/assets/js/page_login.js',
    '/assets/js/page_signup.js',
    '/assets/js/page_mdpoublie.js',
    '/assets/js/page_nouveaumdp.js',
    '/assets/img/icon.svg',
    '/assets/img/icon-192.png',
    '/assets/img/icon-512.png',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then(c => c.addAll(STATIC_ASSETS).catch(() => {})) // ignore les 404
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
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

    // 1) API : network-first (jamais cache stale)
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(networkFirst(req));
        return;
    }

    // 2) Covers / pages MangaDex : cache-first (économise bande passante)
    if (url.hostname === 'uploads.mangadex.org' || url.hostname.endsWith('mangadex.network')) {
        event.respondWith(cacheFirst(req, COVERS_CACHE));
        return;
    }

    // 3) Code de l'app (HTML/JS/CSS) : network-first → toujours à jour,
    //    cache uniquement en secours hors-ligne. Évite le code périmé.
    if (url.origin === self.location.origin) {
        const isCode = /\.(html|js|css|webmanifest)$/.test(url.pathname) || url.pathname === '/';
        event.respondWith(isCode ? networkFirst(req, RUNTIME_CACHE) : staleWhileRevalidate(req));
        return;
    }
});

async function offlineImage(req, url) {
    try {
        const off = await caches.open(OFFLINE_CACHE);
        const hit = await off.match(req, { ignoreVary: true });
        if (hit) return hit;
    } catch (e) {}
    if (url.hostname === 'uploads.mangadex.org' || url.hostname.endsWith('mangadex.network')) {
        return cacheFirst(req, COVERS_CACHE);
    }
    try { return await fetch(req); }
    catch (e) { const c = await caches.match(req); return c || new Response('', { status: 504 }); }
}

async function networkFirst(req, cacheName) {
    try {
        const res = await fetch(req);
        // Met en cache la version fraîche pour le mode hors-ligne
        if (cacheName && res.ok && req.url.startsWith('http')) {
            const c = await caches.open(cacheName);
            c.put(req, res.clone()).catch(() => {});
        }
        return res;
    } catch (e) {
        const cached = await caches.match(req);
        return cached || Response.json({ error: 'Hors ligne' }, { status: 503 });
    }
}

async function cacheFirst(req, cacheName) {
    const cache = await caches.open(cacheName);
    const cached = await cache.match(req);
    if (cached) return cached;
    try {
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone()).catch(() => {});
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
