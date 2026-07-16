// service-worker.js — PWA Inko
// Stratégie : network-first pour /api (toujours frais)
//             stale-while-revalidate pour assets statiques
//             cache des couvertures mangadex (bande passante)

const CACHE_VERSION = 'inko-v17';
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
    '/offline.html',
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
    '/lecture.html',
    '/assets/js/lecture.js',
    '/assets/css/lecture.css',
    '/player.html',
    '/anilist.html',
    '/assets/js/anilist.js',
    '/page_login.html',
    '/page_signup.html',
    '/page_mdpoublie.html',
    '/page_nouveaumdp.html',
    // Pages & modules récents (audit SW2 : liste tenue à jour)
    '/admin.html',
    '/assets/js/admin.js',
    '/u.html',
    '/assets/js/u.js',
    '/import.html',
    '/assets/js/import.js',
    '/localreader.html',
    '/assets/js/localreader.js',
    '/assets/vendor/jszip.min.js',
    '/assets/vendor/gsap.min.js',
    '/assets/vendor/ScrollTrigger.min.js',
    '/assets/vendor/pdf.min.js',
    '/assets/js/motion.js',
    '/confidentialite.html',
    '/notifications.html',
    '/assets/js/notifications.js',
    '/downloads.html',
    '/assets/js/downloads-page.js',
    '/assets/i18n/fr.json',
    '/assets/i18n/en.json',
    '/assets/js/userdata.js',
    '/assets/js/theme.js',
    '/assets/js/i18n.js',
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
    '/assets/js/accueil.js',
    '/assets/js/catalogue.js',
    '/assets/js/serie.js',
    '/assets/js/chapitre.js',
    '/assets/js/profil.js',
    '/assets/img/icon.svg',
    '/assets/img/icon-192.png',
    '/assets/img/icon-512.png',
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
            try { await self.registration.navigationPreload.enable(); } catch (e) {}
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
    } catch (e) {}
}

async function offlineImage(req, url) {
    try {
        const off = await caches.open(OFFLINE_CACHE);
        const hit = await off.match(req, { ignoreVary: true });
        if (hit) return hit;
    } catch (e) {}
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
            all.forEach(c => { try { c.postMessage({ type: 'notif:new' }); } catch (e) {} });
        } catch (e) {}
    })());
    event.waitUntil(self.registration.showNotification(title, {
        body:  data.body || '',
        icon:  '/assets/img/icon-192.png',
        badge: '/assets/img/icon-192.png',
        tag:   data.type || 'inko',
        data:  { link: data.link || '/' },
    }));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const link = (event.notification.data && event.notification.data.link) || '/';
    event.waitUntil((async () => {
        const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const c of all) {
            if ('focus' in c) { try { await c.navigate(link); } catch (e) {} return c.focus(); }
        }
        if (self.clients.openWindow) return self.clients.openWindow(link);
    })());
});
