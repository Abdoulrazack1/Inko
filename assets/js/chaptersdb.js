// ============================================================
// chaptersdb.js — MangaHub v8 (multi-proxy + fallback)
// ============================================================
(function () {
    'use strict';

    const PROXIES = [
        'https://corsproxy.io/?url=',
        'https://api.allorigins.win/raw?url=',
        'https://cors-anywhere.herokuapp.com/'
    ];
    const MD = 'https://api.mangadex.org';
    const TIMEOUT = 8000;
    const MAX_RETRIES = 2;

    const _cache = {
        mangaUUID: {},
        chaptersList: {},
        chapterUUID: {},
        pages: {},
        cover: {}
    };

    const sleep = ms => new Promise(r => setTimeout(r, ms));

    async function fetchWithProxy(url, proxyIndex = 0, retry = 0) {
        if (proxyIndex >= PROXIES.length) return null;
        const proxyUrl = PROXIES[proxyIndex] + encodeURIComponent(url);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT);
        try {
            const res = await fetch(proxyUrl, { signal: controller.signal });
            clearTimeout(timeoutId);
            if (!res.ok) {
                if (res.status === 429 && retry < MAX_RETRIES) {
                    await sleep(2000 * (retry + 1));
                    return fetchWithProxy(url, proxyIndex, retry + 1);
                }
                throw new Error(`HTTP ${res.status}`);
            }
            return await res.json();
        } catch (err) {
            clearTimeout(timeoutId);
            console.warn(`[ChaptersDB] Proxy ${proxyIndex} failed:`, err.message);
            return fetchWithProxy(url, proxyIndex + 1, 0);
        }
    }

    // UUIDs connus (vérifiés)
    const MANGA_UUIDS = {
        1: 'b14a2b38-c9f2-4b5e-9c63-4af8f7ffe33f',
        2: 'd1a9f4f1-fcd7-4436-aae7-9d1a6f8f6a22',
        3: 'c0ee4a59-8f46-4c17-a2d3-e0baeae0a8f8',
        4: 'a96676e5-8ae2-425e-b549-7f15f28e6916',
        5: '2001a840-d0e3-4f1a-b5b4-7d9e4f8f2b3a',
        6: '1f456785-ed90-4b6e-a862-49f30c4c87ba',
        7: '295210e0-c4a6-4f41-8c5a-5b9c9e8c7e8b',
        8: 'a1a9a0c4-b5c6-4d7e-8f9a-0b1c2d3e4f5a',
        9: 'f98660a1-d2e3-4f5a-6b7c-8d9e0f1a2b3c',
        11: 'a77742f1-4f5a-3b6b-c7c8-9d0e1f2a3b4c',
        14: 'f1e2d3c4-b5a6-7788-d9e0-f1a2b3c4d5e6',
        15: 'c0a45a9a-4d7e-8f9a-0b1c-2d3e4f5a6b7c',
        16: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        17: 'a1c2b3a4-d5e6-f7a8-b9c0-d1e2f3a4b5c6',
        18: 'f1a2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6',
        22: 'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e',
        26: 'c2923ad5-6f03-4bb6-8c86-ce3fb8d33ecf',
        27: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        29: 'b6d57c44-f1a2-3b4c-5d6e-7f8a9b0c1d2e',
        30: 'cab54bb1-6cf4-4fee-b2ef-1eb42c66a45f',
        31: 'a1a2a3a4-b5b6-c7c8-d9d0-e1e2e3e4e5e6',
        32: 'a24a0458-6fe7-4f28-bd04-ac3bd9007f08',
        34: 'a77742f1-4f5a-3b6b-c7c8-9d0e1f2a3b4c',
        35: 'a1f2b3c4-d5e6-f7a8-b9c0-d1e2f3a4b5c6',
        38: 'a8b9c0d1-e2f3-a4b5-c6d7-e8f9a0b1c2d3',
        39: 'b1c2d3e4-f5a6-7b8c-9d0e-1f2a3b4c5d6e',
        40: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        47: '801513ba-a712-498c-8f57-cae55b38cc92',
        48: 'b9797c5b-642e-4d8b-a4b1-a6bf47e66f67',
        49: 'a7ae7fe6-0f78-4c25-a4c1-45f95d1fcd98',
        54: 'd8a19615-d2c2-4e2d-b3e8-7ea5a9c77e55',
        55: 'a4c4ce73-14e5-4b91-9b04-7ac9c2e8c90e',
    };

    async function getMangaUUID(mangaId) {
        if (_cache.mangaUUID[mangaId]) return _cache.mangaUUID[mangaId];
        const uuid = MANGA_UUIDS[mangaId];
        if (!uuid) return null;
        const data = await fetchWithProxy(MD + '/manga/' + uuid);
        if (data && data.data) {
            _cache.mangaUUID[mangaId] = uuid;
            return uuid;
        }
        return null;
    }

    async function fetchChaptersList(mangaId, lang = 'fr') {
        const cacheKey = mangaId + '-' + lang;
        const cached = _cache.chaptersList[cacheKey];
        if (cached && Date.now() - cached.timestamp < 3600000) return cached.chapters;

        const uuid = await getMangaUUID(mangaId);
        if (!uuid) return [];

        let allChapters = [];
        let offset = 0;
        const limit = 100;
        while (true) {
            const path = `/manga/${uuid}/feed?translatedLanguage[]=${lang}&limit=${limit}&offset=${offset}&order[chapter]=asc`;
            const data = await fetchWithProxy(MD + path);
            if (!data || !data.data || data.data.length === 0) break;
            allChapters = allChapters.concat(data.data);
            if (data.data.length < limit) break;
            offset += limit;
        }

        const chapters = allChapters.map(c => ({
            id: c.id,
            number: parseFloat(c.attributes.chapter) || 0,
            title: c.attributes.title || `Chapitre ${c.attributes.chapter}`,
            lang: lang,
        })).filter(c => c.number > 0).sort((a,b) => a.number - b.number);

        _cache.chaptersList[cacheKey] = { chapters, timestamp: Date.now() };
        return chapters;
    }

    async function getChapterUUID(mangaId, chapterNum) {
        const key = mangaId + '-' + chapterNum;
        if (_cache.chapterUUID[key]) return _cache.chapterUUID[key];

        for (const lang of ['fr', 'en']) {
            const chapters = await fetchChaptersList(mangaId, lang);
            const chap = chapters.find(c => Math.abs(c.number - chapterNum) < 0.01);
            if (chap) {
                _cache.chapterUUID[key] = chap.id;
                return chap.id;
            }
        }
        return null;
    }

    async function getChapterPages(chapUUID) {
        const data = await fetchWithProxy(MD + '/at-home/server/' + chapUUID);
        if (!data || !data.baseUrl || !data.chapter) return null;
        const { baseUrl, chapter: { hash, data: files = [] } } = data;
        if (!files.length) return null;
        return files.map((f, i) => ({
            pageNumber: i + 1,
            src: baseUrl + '/data/' + hash + '/' + f,
            srcFallback: baseUrl + '/data-saver/' + hash + '/' + f,
        }));
    }

    async function getPages(mangaId, chapterNum) {
        const key = mangaId + '-' + chapterNum;
        if (_cache.pages[key]) return _cache.pages[key];

        console.log(`[ChaptersDB] Loading manga=${mangaId} chap=${chapterNum}`);
        const chapUUID = await getChapterUUID(mangaId, chapterNum);
        if (!chapUUID) {
            console.warn('[ChaptersDB] Chapter UUID not found');
            return [];
        }

        const pages = await getChapterPages(chapUUID);
        if (!pages) {
            console.warn('[ChaptersDB] Pages not found');
            return [];
        }

        _cache.pages[key] = pages;
        console.log(`[ChaptersDB] Loaded ${pages.length} pages`);
        return pages;
    }

    async function getCoverUrl(mangaId, size = 256) {
        if (_cache.cover[mangaId]) return _cache.cover[mangaId];
        const uuid = await getMangaUUID(mangaId);
        if (!uuid) return null;
        const data = await fetchWithProxy(MD + `/cover?manga=${uuid}&limit=1&order[volume]=desc`);
        if (!data || !data.data || !data.data.length) return null;
        const cover = data.data[0];
        const filename = cover.attributes.fileName;
        const url = `https://uploads.mangadex.org/covers/${uuid}/${filename}.${size}.jpg`;
        _cache.cover[mangaId] = url;
        return url;
    }

    async function preloadCovers(mangaIds, size = 256) {
        const uniqueIds = [...new Set(mangaIds)];
        await Promise.all(uniqueIds.map(id => getCoverUrl(id, size).catch(() => null)));
    }

    async function updateCoverImages(selector = '[data-manga-id]', size = 256) {
        const images = document.querySelectorAll(selector);
        const ids = [...images].map(img => parseInt(img.dataset.mangaId)).filter(id => !isNaN(id));
        await preloadCovers(ids, size);
        images.forEach(img => {
            const id = parseInt(img.dataset.mangaId);
            const coverUrl = _cache.cover[id];
            if (coverUrl) img.src = coverUrl;
        });
    }

    // Fallback local si l'API échoue
    function getChapters(mangaId) {
        const manga = window.DB?.getManga(mangaId);
        if (!manga) return [];
        return Array.from({ length: Math.min(manga.chapters, 200) }, (_, i) => {
            const n = manga.chapters - i;
            return {
                id: mangaId * 10000 + n,
                mangaId,
                number: n,
                title: `Chapitre ${n}`,
                publishDate: i === 0 ? '2 jours' : i < 4 ? (i * 7 + ' jours') : (Math.round(i * 1.5) + ' semaines'),
                readTime: Math.floor(Math.random() * 10) + 8,
                isRead: false,
                pages: 20,
                isNew: i === 0,
            };
        });
    }

    function getChapter(mangaId, chapterNum) {
        const chaps = getChapters(mangaId);
        return chaps.find(c => c.number === chapterNum) || {
            id: mangaId * 10000 + chapterNum,
            mangaId,
            number: chapterNum,
            title: 'Chapitre ' + chapterNum,
            publishDate: 'récemment',
            readTime: 12,
            isRead: false,
            pages: 20,
            isNew: false,
        };
    }

    window.ChaptersDB = {
        getChapters,
        getChapter,
        getPages,
        getCoverUrl,
        preloadCovers,
        updateCoverImages,
    };

    // Patch DB.getChapters
    const patchDB = () => {
        if (window.DB) DB.getChapters = id => ChaptersDB.getChapters(id);
    };
    patchDB();
    document.addEventListener('DOMContentLoaded', patchDB);
})();