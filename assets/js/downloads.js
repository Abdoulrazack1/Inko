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
            let done = 0;
            for (const url of urls) {
                // referer par défaut (origine) : c'est ce que le lecteur envoie et que les CDN acceptent
                for (let attempt = 0; attempt < 2; attempt++) {
                    try { await cache.put(url, await fetch(url, { mode: 'no-cors' })); break; }
                    catch (e) { if (attempt === 1) break; await sleep(300); }
                }
                done++;
                if (onProgress) onProgress(done, urls.length);
                await sleep(60);   // ménage le CDN (évite le rate-limit)
            }
            await putMeta({
                chapterId: info.chapterId, mangaId: info.mangaId,
                chapterNum: info.chapterNum ?? null, mangaTitle: info.mangaTitle || '',
                cover: info.cover || '', source: info.source || '',
                pages: urls, count: urls.length, savedAt: Date.now(),
            });
            return { count: urls.length };
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
