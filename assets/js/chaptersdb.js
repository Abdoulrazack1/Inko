// ============================================================
// chaptersdb.js — MangaHub v4.2 · MangaDex + WeebCentral (fallback)
// ============================================================
// Sources :
//   1. MangaDex    (API officielle, FR prioritaire)
//   2. WeebCentral (fallback scraping via server.js si MangaDex incomplet)
// Flux :
//   getChapters(id) → MangaDex FR+EN → si trous → WeebCentral → fusion
//   getPages(id, num) → selon .source du chapitre : MangaDex ou WeebCentral
// ============================================================
window.ChaptersDB = (function () {
    'use strict';

    const PROXY    = 'http://localhost:8080/mangadex';
    const IMG_BASE = 'http://localhost:8080/mdimg';
    const WC       = 'http://localhost:8080/weebcentral'; // endpoints serveur

    // ── UUIDs MangaDex vérifiés ───────────────────────────────
    const UUID_MAP = {
        1:  '801513ba-a712-498c-8f57-cae55b38cc92', // Berserk
        2:  'c92be031-f6c1-4571-8b5e-fde28ae49dc7', // Vagabond
        3:  'c52b2ce3-7f95-469c-96b0-479524fb7a1a', // Vinland Saga
        4:  'ee7b31c1-4e5c-4020-9fec-e01a7e7c67e5', // Monster
        5:  null,                                    // Pluto
        6:  'b049e0c8-0d18-43d8-b616-f7b4374b3e6d', // Dorohedoro
        7:  '304ceac3-8cdb-4fe7-acf7-2b6ff7a60613', // Dungeon Meshi
        8:  '24df1b1d-5f04-407c-9003-9d29ecb7bfeb', // Mushishi
        9:  '34a94faf-f884-4d63-a14f-5f4d33cd2ef8', // Blame!
        10: '7a41cc21-4a7f-4dff-a1fd-54d5cb8b8a4e', // Biomega
        11: '99182618-1be6-4963-9d5e-874741f66af3', // Oyasumi Punpun
        12: 'cbee8b5d-83ed-4a41-aaf1-64bb7dbc43e4', // Solanin
        13: '34194a1e-e2d1-4980-9bd2-d75e4b5e3f1d', // Blue Period
        14: 'cade38b7-64d5-4a51-9027-5f3d12a10b22', // Houseki no Kuni
        15: null,                                    // Slam Dunk
        16: null,                                    // Hajime no Ippo
        17: null,                                    // Haikyuu!!
        18: 'be3f04d1-0b63-464a-9bda-fb87cbc21b0e', // 20th Century Boys
        19: null,                                    // Devilman
        20: null,                                    // Gantz
        21: null,                                    // Yotsuba&!
        22: null,                                    // Parasyte
        23: null,                                    // Ashita no Joe
        24: 'fb27f1ad-5dbb-4862-bb07-f4c7c24e4e1a', // Hellsing
        25: null,                                    // Beck
        26: 'f5e3baad-3cd4-427c-a2ec-ad7d776b370d', // Fullmetal Alch.
        27: null,                                    // Hunter x Hunter
        28: '40bc649f-7b49-4645-859e-6cd94136e722', // Dragon Ball
        29: 'c13ddd06-a04a-4ce0-8342-fc69e4f5f0c8', // Naruto
        30: null,                                    // Attack on Titan
        31: 'a1c7c817-4e59-43b7-9365-09675a149a6f', // One Piece
        32: '32d76d19-8a05-4db0-9fc2-e0b0648fe9d0', // Demon Slayer
        33: null,                                    // Fairy Tail
        34: null,                                    // Death Note
        35: null,                                    // Bleach
        36: null,                                    // GTO
        37: null,                                    // Magi
        38: '87ebd557-8c74-4c7e-8c6b-1a97e1e9aaeb', // My Hero Academia
        39: null,                                    // Nana
        40: null,                                    // Fruits Basket
        41: null,                                    // Cardcaptor Sakura
        42: null,                                    // Sailor Moon
        43: null,                                    // Baki
        44: null,                                    // Yokohama KK
        45: 'b0b721fb-b43f-4f6d-bb8c-a7e7c193a001', // Golden Kamuy
        46: 'f9ea14d1-f877-47ee-9210-4fc3eb62b35b', // Fire Punch
        47: 'a77742b1-befd-49a4-bff5-1ad4e6b0ef7b', // Chainsaw Man
        48: null,                                    // Jujutsu Kaisen
        49: null,                                    // Spy x Family
        50: 'a7fb7acf-2950-4739-ad31-e6be05e88c54', // Tokyo Ghoul
        51: null,                                    // Made in Abyss
        52: 'e7eabe96-aa17-476f-b431-2497d5e9d060', // Dr. Stone
        53: null,                                    // Promised Neverland
        54: '37f5cce0-8070-4ada-96e5-fa24b1bd4ff9', // One-Punch Man
        55: null,                                    // Mob Psycho 100
        56: null,                                    // Akira
        57: null,                                    // Nausicaa
        58: null,                                    // Initial D
        59: null,                                    // Claymore
        60: 'c0ee660b-f694-4160-a6c8-1571780a3291', // Rurouni Kenshin
    };

    // ── WeebCentral Series IDs ────────────────────────────────
    // weebcentral.com/series/{SERIES_ID}/{slug}
    // null = résolu automatiquement via /weebcentral/search
    // Lance ChaptersDB.resolveAllWCIds() dans la console pour peupler.
    const WC_IDS = {
        1:  '01H9S3T35N14MQR314X4J1V4B1', // Berserk           ✓ vérifié
        2:  null, 3:  null, 4:  null, 5:  null, 6:  null,
        7:  null, 8:  null, 9:  null, 10: null, 11: null,
        12: null, 13: null, 14: null, 15: null, 16: null,
        17: null, 18: null, 19: null, 20: null, 21: null,
        22: null, 23: null, 24: null, 25: null, 26: null,
        27: null, 28: null, 29: null, 30: null, 31: null,
        32: null, 33: null, 34: null, 35: null, 36: null,
        37: null, 38: '01J76XYDXH7KT6AABVG3JAT3ZP', // My Hero Academia ✓ vérifié
        39: null, 40: null, 41: null, 42: null, 43: null,
        44: null, 45: null, 46: null, 47: null, 48: null,
        49: null, 50: null, 51: null, 52: null, 53: null,
        54: null, 55: null, 56: null, 57: null, 58: null,
        59: null, 60: null,
    };
    // ⚠ Remplis les IDs vrais en allant sur weebcentral.com/search?text=NomManga
    // et en copiant l'ID depuis l'URL : /series/{ID}/{slug}
    // Ou lance : ChaptersDB.resolveAllWCIds()  dans la console DevTools.

    const MANGA_NAMES = {
        1:'Berserk',2:'Vagabond',3:'Vinland Saga',4:'Monster',5:'Pluto',
        6:'Dorohedoro',7:'Dungeon Meshi',8:'Mushishi',9:'Blame!',10:'Biomega',
        11:'Oyasumi Punpun',12:'Solanin',13:'Blue Period',14:'Houseki no Kuni',
        15:'Slam Dunk',16:'Hajime no Ippo',17:'Haikyuu!!',18:'20th Century Boys',
        19:'Devilman',20:'Gantz',21:'Yotsuba&!',22:'Parasyte',23:'Ashita no Joe',
        24:'Hellsing',25:'Beck',26:'Fullmetal Alchemist',27:'Hunter x Hunter',
        28:'Dragon Ball',29:'Naruto',30:'Attack on Titan',31:'One Piece',
        32:'Demon Slayer',33:'Fairy Tail',34:'Death Note',35:'Bleach',
        36:'Great Teacher Onizuka',37:'Magi',38:'My Hero Academia',39:'Nana',
        40:'Fruits Basket',41:'Cardcaptor Sakura',42:'Sailor Moon',43:'Baki',
        44:'Yokohama Kaidashi Kikou',45:'Golden Kamuy',46:'Fire Punch',
        47:'Chainsaw Man',48:'Jujutsu Kaisen',49:'Spy x Family',50:'Tokyo Ghoul',
        51:'Made in Abyss',52:'Dr. Stone',53:'The Promised Neverland',
        54:'One-Punch Man',55:'Mob Psycho 100',56:'Akira',57:'Nausicaä',
        58:'Initial D',59:'Claymore',60:'Rurouni Kenshin',
    };

    // ── Cache mémoire ─────────────────────────────────────────
    const _cache = { uuid: {}, wcId: {}, chapters: {}, pages: {} };
    const _promiseCache = {};

    // ── Helpers ───────────────────────────────────────────────
    async function mdGet(path) {
        const res = await fetch(`${PROXY}${path}`);
        if (!res.ok) throw new Error(`MangaDex ${res.status}`);
        return res.json();
    }

    async function wcGet(endpoint) {
        const res = await fetch(`${WC}${endpoint}`);
        if (!res.ok) throw new Error(`WeebCentral ${res.status}`);
        return res.json();
    }

    function _scoreTitleMatch(resultTitle, searchName) {
        if (!resultTitle) return 0;
        const rt = resultTitle.toLowerCase().trim();
        const sn = searchName.toLowerCase().trim();
        if (rt === sn)          return 3;
        if (rt.startsWith(sn)) return 2;
        if (rt.includes(sn))   return 1;
        return 0;
    }

    // ── Résolution UUID MangaDex ──────────────────────────────
    async function resolveUUID(mangaId) {
        if (Object.prototype.hasOwnProperty.call(_cache.uuid, mangaId))
            return _cache.uuid[mangaId];
        if (UUID_MAP[mangaId]) {
            _cache.uuid[mangaId] = UUID_MAP[mangaId];
            return UUID_MAP[mangaId];
        }
        const name = MANGA_NAMES[mangaId];
        if (!name) return null;
        try {
            const data = await mdGet(`/manga?title=${encodeURIComponent(name)}&limit=10&order[relevance]=desc`);
            const scored = (data?.data || []).map(r => {
                const titles = [
                    r.attributes?.title?.en, r.attributes?.title?.ja,
                    r.attributes?.title?.['ja-ro'],
                    ...(r.attributes?.altTitles || []).flatMap(t => Object.values(t)),
                ].filter(Boolean);
                return { id: r.id, score: Math.max(...titles.map(t => _scoreTitleMatch(t, name)), 0) };
            }).sort((a, b) => b.score - a.score);
            const uuid = scored[0]?.id;
            if (uuid) {
                _cache.uuid[mangaId] = uuid;
                UUID_MAP[mangaId]    = uuid;
                console.log(`[ChaptersDB] UUID résolu "${name}": ${uuid}`);
                return uuid;
            }
        } catch(e) { console.error('[ChaptersDB] resolveUUID:', e.message); }
        _cache.uuid[mangaId] = null;
        return null;
    }

    // ── Résolution Series ID WeebCentral ─────────────────────
    async function resolveWCId(mangaId) {
        if (Object.prototype.hasOwnProperty.call(_cache.wcId, mangaId))
            return _cache.wcId[mangaId];
        if (WC_IDS[mangaId]) {
            _cache.wcId[mangaId] = WC_IDS[mangaId];
            return WC_IDS[mangaId];
        }
        const name = MANGA_NAMES[mangaId];
        if (!name) return null;
        try {
            const results = await wcGet(`/search?q=${encodeURIComponent(name)}`);
            if (!Array.isArray(results) || !results.length) return null;
            const best = results
                .map(r => ({ r, score: _scoreTitleMatch(r.title, name) }))
                .sort((a, b) => b.score - a.score)[0];
            if (best?.r?.seriesId) {
                console.log(`[ChaptersDB] WC ID résolu "${name}": ${best.r.seriesId}`);
                _cache.wcId[mangaId] = best.r.seriesId;
                WC_IDS[mangaId]      = best.r.seriesId;
                return best.r.seriesId;
            }
        } catch(e) { console.warn(`[ChaptersDB] resolveWCId (${name}):`, e.message); }
        _cache.wcId[mangaId] = null;
        return null;
    }

    // ── Fetch chapitres MangaDex (pagination complète) ────────
    async function fetchAllChaptersMD(uuid, lang) {
        const LIMIT = 500, MAX_RETRY = 3;
        let offset = 0, all = [], total = Infinity;

        async function batch(off) {
            let delay = 1000;
            for (let i = 0; i <= MAX_RETRY; i++) {
                try {
                    const res = await fetch(`${PROXY}/manga/${uuid}/feed?translatedLanguage[]=${lang}&limit=${LIMIT}&offset=${off}&order[chapter]=asc&includes[]=scanlation_group`);
                    if (res.status === 429) { await new Promise(r => setTimeout(r, delay * 2 ** i)); continue; }
                    if (!res.ok) throw new Error(`HTTP ${res.status}`);
                    return await res.json();
                } catch(e) {
                    if (i === MAX_RETRY) return null;
                    await new Promise(r => setTimeout(r, delay));
                }
            }
            return null;
        }

        while (offset < total) {
            const data = await batch(offset);
            if (!data) break;
            const items = data?.data || [];
            total = data?.total ?? items.length;
            if (!items.length) break;
            all = all.concat(items);
            offset += items.length;
            if (items.length < LIMIT) break;
        }
        return all;
    }

    // ── Fetch chapitres WeebCentral ───────────────────────────
    async function fetchChaptersWC(mangaId) {
        let seriesId = await resolveWCId(mangaId);
        if (!seriesId) return [];
        try {
            const chapters = await wcGet(`/chapters?seriesId=${encodeURIComponent(seriesId)}`);
            if (!Array.isArray(chapters)) return [];
            console.log(`[ChaptersDB] WC: ${chapters.length} chapitres pour manga ${mangaId}`);
            return chapters.map(c => ({
                id:       c.chapterId,
                number:   c.number,
                title:    c.title || `Chapter ${c.number}`,
                date:     c.date || '',
                lang:     'en',
                pages:    null,
                readTime: 10,
                group:    '',
                source:   'weebcentral',
            }));
        } catch(e) {
            console.warn(`[ChaptersDB] WC chapters error (seriesId=${seriesId}):`, e.message);
            // Si erreur → invalider l'ID et retenter via recherche
            WC_IDS[mangaId]       = null;
            _cache.wcId[mangaId]  = null;
            delete _cache.wcId[mangaId];
            const freshId = await resolveWCId(mangaId);
            if (freshId && freshId !== seriesId) {
                try {
                    const chapters = await wcGet(`/chapters?seriesId=${encodeURIComponent(freshId)}`);
                    if (Array.isArray(chapters)) {
                        return chapters.map(c => ({
                            id: c.chapterId, number: c.number,
                            title: c.title || `Chapter ${c.number}`,
                            date: c.date || '', lang: 'en', pages: null,
                            readTime: 10, group: '', source: 'weebcentral',
                        }));
                    }
                } catch(e2) { /* silencieux */ }
            }
            return [];
        }
    }

    // ── Récupère les chapitres (MangaDex + WC fusion) ─────────
    async function getChapters(mangaId) {
        const cacheKey = `${mangaId}`;
        if (_cache.chapters[cacheKey]) return _cache.chapters[cacheKey];
        if (_promiseCache[cacheKey])   return _promiseCache[cacheKey];

        const promise = (async () => {
            // ── MangaDex FR + EN ──────────────────────────────
            const uuid = await resolveUUID(mangaId);
            let frChaps = [], enChaps = [];

            if (uuid) {
                [frChaps, enChaps] = await Promise.all([
                    fetchAllChaptersMD(uuid, 'fr').catch(() => []),
                    fetchAllChaptersMD(uuid, 'en').catch(() => []),
                ]);
                console.log(`[ChaptersDB] manga ${mangaId}: ${frChaps.length} FR + ${enChaps.length} EN (MangaDex)`);

                if (frChaps.length === 0 && enChaps.length === 0 && UUID_MAP[mangaId] === uuid) {
                    console.warn(`[ChaptersDB] manga ${mangaId}: UUID hardcodé vide → recherche titre`);
                    UUID_MAP[mangaId] = null;
                    delete _cache.uuid[mangaId];
                    const freshUUID = await resolveUUID(mangaId);
                    if (freshUUID && freshUUID !== uuid) {
                        [frChaps, enChaps] = await Promise.all([
                            fetchAllChaptersMD(freshUUID, 'fr').catch(() => []),
                            fetchAllChaptersMD(freshUUID, 'en').catch(() => []),
                        ]);
                    }
                }
            }

            // Fusion FR > EN
            const mdMap = new Map();
            for (const raw of [...enChaps, ...frChaps]) {
                const numStr = raw.attributes?.chapter;
                if (numStr === null || numStr === undefined || numStr === '') continue;
                const num = parseFloat(numStr);
                if (isNaN(num)) continue;
                const key  = num.toFixed(1);
                const isFR = raw.attributes.translatedLanguage === 'fr';
                const ex   = mdMap.get(key);
                if (!ex || (isFR && ex.attributes.translatedLanguage !== 'fr')) mdMap.set(key, raw);
            }

            const mdChapters = [...mdMap.values()].map(raw => ({
                id:       raw.id,
                number:   parseFloat(raw.attributes.chapter),
                title:    raw.attributes.title || `Chapter ${raw.attributes.chapter}`,
                date:     raw.attributes.publishAt || raw.attributes.readableAt || '',
                lang:     raw.attributes.translatedLanguage || 'en',
                pages:    raw.attributes.pages ?? null,
                readTime: raw.attributes.pages ? Math.ceil(raw.attributes.pages / 8) : 10,
                group:    raw.relationships?.find(r => r.type === 'scanlation_group')?.attributes?.name || '',
                source:   'mangadex',
            }));

            // ── WeebCentral pour combler les trous ────────────
            let allChapters = mdChapters;
            try {
                const wcChaps = await fetchChaptersWC(mangaId);
                if (wcChaps.length > 0) {
                    const finalMap = new Map();
                    for (const c of mdChapters) finalMap.set(c.number.toFixed(1), c);
                    for (const c of wcChaps) {
                        const key = c.number.toFixed(1);
                        if (!finalMap.has(key)) finalMap.set(key, c);
                    }
                    allChapters = [...finalMap.values()];
                    const added = allChapters.length - mdChapters.length;
                    if (added > 0)
                        console.log(`[ChaptersDB] manga ${mangaId}: +${added} chapitres WeebCentral (total: ${allChapters.length})`);
                }
            } catch(e) {
                console.warn(`[ChaptersDB] WC fallback error manga ${mangaId}:`, e.message);
            }

            const chapters = allChapters.sort((a, b) => b.number - a.number);
            console.log(`[ChaptersDB] manga ${mangaId}: ${chapters.length} chapitres total`);
            _cache.chapters[cacheKey] = chapters;
            return chapters;
        })();

        _promiseCache[cacheKey] = promise;
        promise.finally(() => delete _promiseCache[cacheKey]);
        return promise;
    }

    // ── Chapitre synchrone depuis cache ───────────────────────
    function getChapterSync(mangaId, chapterNum) {
        const cached = _cache.chapters[`${mangaId}`];
        if (cached) {
            const found = cached.find(c => Math.abs(c.number - chapterNum) < 0.01);
            if (found) return found;
        }
        return { id: null, number: chapterNum, title: `Chapitre ${chapterNum}`, pages: 20, readTime: 10 };
    }

    // ── Pages d'un chapitre ───────────────────────────────────
    async function getPages(mangaId, chapterNum) {
        const chaps = await getChapters(mangaId);
        const chap  = chaps.find(c => Math.abs(c.number - chapterNum) < 0.01);
        if (!chap?.id) {
            console.warn(`[ChaptersDB] Chapitre ${chapterNum} introuvable pour manga ${mangaId}`);
            return [];
        }
        if (_cache.pages[chap.id]) return _cache.pages[chap.id];

        // ── Pages WeebCentral ─────────────────────────────────
        if (chap.source === 'weebcentral') {
            try {
                const raw = await wcGet(`/pages?chapterId=${encodeURIComponent(chap.id)}`);
                if (Array.isArray(raw) && raw.length) {
                    const pages = raw.map((p, i) => ({
                        pageNumber:  i + 1,
                        // Les images WC ont besoin du Referer weebcentral.com → proxy /weebcentral/img
                        src:         `${WC}/img?url=${encodeURIComponent(p.src)}`,
                        srcFallback: `${WC}/img?url=${encodeURIComponent(p.srcFallback || p.src)}`,
                    }));
                    _cache.pages[chap.id] = pages;
                    return pages;
                }
            } catch(e) {
                console.error(`[ChaptersDB] WC getPages error (${chap.id}):`, e.message);
                return [];
            }
        }

        // ── Pages MangaDex ────────────────────────────────────
        try {
            const data = await mdGet(`/at-home/server/${chap.id}`);
            const ch   = data?.chapter;
            if (!ch) return [];
            const { hash, data: files = [], dataSaver: filesSav = files } = ch;
            const base  = data.baseUrl || null;
            const toUrl = (q, f) => base ? `${base}/${q}/${hash}/${f}` : `${IMG_BASE}/${q}/${hash}/${f}`;
            const pages = files.map((filename, i) => ({
                pageNumber:  i + 1,
                src:         toUrl('data', filename),
                srcFallback: toUrl('data-saver', filesSav[i] || filename),
            }));
            _cache.pages[chap.id] = pages;
            return pages;
        } catch(e) {
            console.error(`[ChaptersDB] getPages MD error (${mangaId}, ${chapterNum}):`, e.message);
            return [];
        }
    }

    // ── API publique ──────────────────────────────────────────
    return {
        getChapters,
        getChapterSync,
        getPages,
        resolveUUID,

        clearCache() {
            Object.keys(_cache).forEach(k => { _cache[k] = {}; });
            Object.keys(_promiseCache).forEach(k => delete _promiseCache[k]);
            console.log('[ChaptersDB] Cache vidé');
        },

        patchUUID(mangaId, uuid) {
            UUID_MAP[mangaId]    = uuid;
            _cache.uuid[mangaId] = uuid;
            delete _cache.chapters[`${mangaId}`];
            delete _promiseCache[`${mangaId}`];
            console.log(`[ChaptersDB] UUID patché: manga ${mangaId} → ${uuid}`);
        },

        // Patch manuel d'un WC Series ID
        patchWCId(mangaId, seriesId) {
            WC_IDS[mangaId]      = seriesId;
            _cache.wcId[mangaId] = seriesId;
            delete _cache.chapters[`${mangaId}`];
            delete _promiseCache[`${mangaId}`];
            console.log(`[ChaptersDB] WC ID patché: manga ${mangaId} → ${seriesId}`);
        },

        // Résout tous les WC IDs manquants (à lancer dans la console DevTools)
        async resolveAllWCIds() {
            const ids = Object.keys(MANGA_NAMES).map(Number).filter(id => !WC_IDS[id]);
            console.log(`[ChaptersDB] Résolution de ${ids.length} WC IDs manquants...`);
            for (const id of ids) {
                const wcId = await resolveWCId(id);
                console.log(`  [${id}] ${MANGA_NAMES[id]}: ${wcId || 'INTROUVABLE'}`);
                await new Promise(r => setTimeout(r, 600));
            }
            console.log('[ChaptersDB] Done. WC_IDS résolus:\n' + JSON.stringify(WC_IDS, null, 2));
        },

        get cacheInfo() {
            return {
                uuids:    Object.keys(_cache.uuid).length,
                wcIds:    Object.keys(_cache.wcId).length,
                chapters: Object.keys(_cache.chapters).length,
                pages:    Object.keys(_cache.pages).length,
            };
        },

        _getChaptersCache(mangaId) {
            return _cache.chapters[`${mangaId}`] || [];
        },
    };
})();