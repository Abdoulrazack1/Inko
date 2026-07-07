// ============================================================
// downloads.js — Téléchargement hors-ligne des chapitres
// ============================================================
// Métadonnées dans IndexedDB ('inko-dl' > 'chapters'),
// images dans le Cache API ('inko-offline'). Le service-worker
// sert ces images depuis le cache (online comme offline).
// Expose window.Downloads.
// ============================================================
(function () {
    'use strict';

    const DB_NAME = 'inko-dl';
    const STORE = 'chapters';
    const CACHE = 'inko-offline';

    function openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, 1);
            req.onupgradeneeded = () => {
                const db = req.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    const os = db.createObjectStore(STORE, { keyPath: 'chapterId' });
                    os.createIndex('mangaId', 'mangaId', { unique: false });
                }
            };
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });
    }

    function tx(db, mode) { return db.transaction(STORE, mode).objectStore(STORE); }
    function reqP(r) { return new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }

    async function getMeta(chapterId) {
        const db = await openDB();
        return reqP(tx(db, 'readonly').get(chapterId));
    }
    async function putMeta(meta) {
        const db = await openDB();
        return reqP(tx(db, 'readwrite').put(meta));
    }
    async function delMeta(chapterId) {
        const db = await openDB();
        return reqP(tx(db, 'readwrite').delete(chapterId));
    }
    async function allMeta() {
        const db = await openDB();
        return reqP(tx(db, 'readonly').getAll());
    }

    const Downloads = {
        async has(chapterId) {
            try { return !!(await getMeta(chapterId)); } catch (e) { return false; }
        },

        // info : { mangaId, chapterId, chapterNum, mangaTitle, cover, source }
        // pages : [{ url, urlSaver }]  (déjà résolues)
        async download(info, pages, onProgress) {
            if (!('caches' in window)) throw new Error('Cache API indisponible');
            const cache = await caches.open(CACHE);
            const urls = pages.map(p => p.url).filter(Boolean);
            const sleep = ms => new Promise(r => setTimeout(r, ms));

            // Récupère une page avec un STATUT LISIBLE (audit — un 403/404 ne doit plus
            // être compté comme « téléchargé »). L'ancien fetch no-cors renvoyait une
            // réponse opaque (status 0, ok=false illisible) : impossible de savoir si la
            // page avait vraiment été récupérée. On tente d'abord un fetch CORS direct
            // (statut lisible + réponse non-opaque, meilleure pour l'offline) ; si le CDN
            // bloque CORS, on retombe sur le proxy serveur same-origin (statut lisible lui
            // aussi). null = échec réel détecté.
            const base = (window.API && API.base) || '';
            async function fetchPage(url) {
                try {
                    const r = await fetch(url, { mode: 'cors' });
                    if (r.ok) return r;                     // statut HTTP OK et lisible
                    if (r.status >= 400) return null;       // 403/404… échec confirmé
                } catch (e) { /* CORS bloqué → repli proxy */ }
                if (base) {
                    try {
                        const pr = await fetch(base + '/img?u=' + encodeURIComponent(url));
                        if (pr.ok) return pr;
                    } catch (e) { /* échec réseau */ }
                }
                return null;
            }

            let done = 0, failed = 0;
            for (const url of urls) {
                let resp = null;
                for (let attempt = 0; attempt < 2 && !resp; attempt++) {
                    resp = await fetchPage(url);
                    if (!resp && attempt === 0) await sleep(300);
                }
                if (resp) { try { await cache.put(url, resp); } catch (e) { failed++; } }
                else failed++;
                done++;
                if (onProgress) onProgress(done, urls.length);
                await sleep(60);   // ménage le CDN (évite le rate-limit)
            }

            const okCount = urls.length - failed;
            // Rien n'a pu être récupéré → vrai échec, on ne prétend pas avoir téléchargé.
            if (urls.length && okCount === 0) throw new Error('Aucune page n\'a pu être téléchargée');

            await putMeta({
                chapterId: info.chapterId, mangaId: info.mangaId,
                chapterNum: info.chapterNum ?? null, mangaTitle: info.mangaTitle || '',
                cover: info.cover || '', source: info.source || '',
                pages: urls, count: urls.length, savedAt: Date.now(),
                incomplete: failed > 0, failed,
            });
            return { count: urls.length, failed };
        },

        // Téléchargement d'un chapitre de ROMAN (texte) — stocké dans IndexedDB.
        // info : { mangaId, chapterId, chapterNum, chapterTitle, mangaTitle, cover, source }
        async downloadText(info, content) {
            await putMeta({
                chapterId: info.chapterId, mangaId: info.mangaId,
                chapterNum: info.chapterNum ?? null, chapterTitle: info.chapterTitle || '',
                mangaTitle: info.mangaTitle || '', cover: info.cover || '',
                source: info.source || '', kind: 'novel',
                text: content || '', pages: [], count: 1, savedAt: Date.now(),
            });
            return { ok: true };
        },

        async remove(chapterId) {
            const meta = await getMeta(chapterId);
            if (meta && 'caches' in window) {
                const cache = await caches.open(CACHE);
                await Promise.all((meta.pages || []).map(u => cache.delete(u).catch(() => {})));
            }
            await delMeta(chapterId);
        },

        async get(chapterId) { return getMeta(chapterId); },
        async list() { return (await allMeta()).sort((a, b) => b.savedAt - a.savedAt); },

        // Liste groupée par manga
        async byManga() {
            const all = await this.list();
            const groups = {};
            all.forEach(c => {
                groups[c.mangaId] = groups[c.mangaId] || { mangaId: c.mangaId, title: c.mangaTitle, cover: c.cover, source: c.source, chapters: [] };
                groups[c.mangaId].chapters.push(c);
            });
            return Object.values(groups);
        },

        async removeManga(mangaId) {
            const all = await this.list();
            await Promise.all(all.filter(c => c.mangaId === mangaId).map(c => this.remove(c.chapterId)));
        },

        async storage() {
            try {
                if (navigator.storage?.estimate) {
                    const e = await navigator.storage.estimate();
                    return { usage: e.usage || 0, quota: e.quota || 0 };
                }
            } catch (e) {}
            return { usage: 0, quota: 0 };
        },

        async count() { try { return (await allMeta()).length; } catch (e) { return 0; } },
    };

    window.Downloads = Downloads;
})();
