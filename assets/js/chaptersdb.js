// ============================================================
// chaptersdb.js — MangaHub v16
// ============================================================
// Corrections v16 :
//   - fetchChapterByNumber : ?chapter=N → ?chapter[]=N (correct)
//   - Sans filtre de langue pour maximiser les résultats
//   - Sans filtre contentRating pour éviter les 400
//   - corsproxy.io confirmé OK, en première position
// ============================================================
(function () {
    'use strict';

    const MD      = 'https://api.mangadex.org';
    const TIMEOUT = 10000;
    const LS_KEY  = 'mangahub_uuids_v16';

    const _cache = { uuid: {}, chapters: {}, pages: {} };

    // ── UUID hardcodés ────────────────────────────────────────
    const UUID_CONFIRMED = {
        1:  '801513ba-a712-498c-8f57-cae55b38cc92', // Berserk
        3:  'c52b2ce3-7f95-469c-96b0-479524fb7a1a', // Vinland Saga
        7:  '304ceac3-8cdb-4fe7-acf7-2b6ff7a60613', // Dungeon Meshi
        11: '99182618-1be6-4963-9d5e-874741f66af3', // Oyasumi Punpun
        26: 'f5e3baad-3cd4-427c-a2ec-ad7d776b370d', // Fullmetal Alchemist
        28: '40bc649f-7b49-4645-859e-6cd94136e722', // Dragon Ball
        47: 'a77742b1-befd-49a4-bff5-1ad4e6b0ef7b', // Chainsaw Man
    };

    // ── Titres de recherche ───────────────────────────────────
    const SEARCH_QUERIES = {
        1:  'Berserk',                2:  'Vagabond',
        3:  'Vinland Saga',           4:  'Monster',
        5:  'Pluto',                  6:  'Dorohedoro',
        7:  'Dungeon Meshi',          8:  'Mushishi',
        9:  'Blame!',                 10: 'Biomega',
        11: 'Oyasumi Punpun',        12: 'Solanin',
        13: 'Blue Period',           14: 'Houseki no Kuni',
        15: 'Slam Dunk',             16: 'Hajime no Ippo',
        17: 'Haikyuu!!',             18: '20th Century Boys',
        19: 'Devilman',              20: 'Gantz',
        21: 'Yotsuba',               22: 'Parasyte',
        23: 'Ashita no Joe',         24: 'Hellsing',
        25: 'Beck',                  26: 'Fullmetal Alchemist',
        27: 'Hunter x Hunter',       28: 'Dragon Ball',
        29: 'Naruto',                30: 'Attack on Titan',
        31: 'One Piece',             32: 'Demon Slayer',
        33: 'Fairy Tail',            34: 'Death Note',
        35: 'Bleach',                36: 'Great Teacher Onizuka',
        37: 'Magi',                  38: 'My Hero Academia',
        39: 'Nana',                  40: 'Fruits Basket',
        41: 'Cardcaptor Sakura',     42: 'Sailor Moon',
        43: 'Baki',                  44: 'Yokohama Kaidashi Kikou',
        45: 'Golden Kamuy',          46: 'Fire Punch',
        47: 'Chainsaw Man',          48: 'Jujutsu Kaisen',
        49: 'Spy x Family',          50: 'Tokyo Ghoul',
        51: 'Made in Abyss',         52: 'Dr. Stone',
        53: 'The Promised Neverland',54: 'One-Punch Man',
        55: 'Mob Psycho 100',        56: 'Akira',
        57: 'Nausicaa',              58: 'Initial D',
        59: 'Claymore',              60: 'Rurouni Kenshin',
    };

    // ── localStorage ──────────────────────────────────────────
    let _lsUUIDs = {};
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) _lsUUIDs = JSON.parse(raw);
    } catch(e) {}
    function saveLS() {
        try { localStorage.setItem(LS_KEY, JSON.stringify(_lsUUIDs)); } catch(e) {}
    }

    // ── Fetch avec timeout ────────────────────────────────────
    async function _fetch(url) {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), TIMEOUT);
        try {
            const res = await fetch(url, { signal: ctrl.signal });
            clearTimeout(tid);
            if (!res.ok) return null;
            const text = await res.text();
            if (!text || (text[0] !== '{' && text[0] !== '[')) return null;
            return JSON.parse(text);
        } catch(e) {
            clearTimeout(tid);
            return null;
        }
    }

    // ── fetchMD : corsproxy.io confirmé OK ───────────────────
    async function fetchMD(url) {
        const enc = encodeURIComponent(url);
        const candidates = [
            `https://corsproxy.io/?${enc}`,
            url,
            `https://thingproxy.freeboard.io/fetch/${url}`,
        ];
        for (let i = 0; i < candidates.length; i++) {
            const data = await _fetch(candidates[i]);
            if (data) {
                if (i > 0) console.log(`[ChaptersDB] OK via proxy#${i + 1}`);
                return data;
            }
        }
        return null;
    }

    // ── Résolution UUID ───────────────────────────────────────
    async function resolveUUID(mangaId) {
        if (_cache.uuid[mangaId])    return _cache.uuid[mangaId];
        if (UUID_CONFIRMED[mangaId]) return (_cache.uuid[mangaId] = UUID_CONFIRMED[mangaId]);
        if (_lsUUIDs[mangaId])       return (_cache.uuid[mangaId] = _lsUUIDs[mangaId]);

        const query = SEARCH_QUERIES[mangaId];
        if (!query) return null;

        const data = await fetchMD(`${MD}/manga?title=${encodeURIComponent(query)}&limit=5&order[relevance]=desc`);
        const uuid = data?.data?.[0]?.id || null;

        if (uuid) {
            _lsUUIDs[mangaId] = uuid;
            _cache.uuid[mangaId] = uuid;
            saveLS();
            console.log(`[ChaptersDB] UUID id:${mangaId} → ${uuid}`);
        }
        return uuid;
    }

    // ── Liste des chapitres (pour la page série) ──────────────
    async function loadChapters(mangaId, lang) {
        const key = `${mangaId}-${lang}`;
        if (_cache.chapters[key]) return _cache.chapters[key];

        const uuid = await resolveUUID(mangaId);
        if (!uuid) return [];

        let all = [], offset = 0;
        const limit = 100;

        while (true) {
            const url = `${MD}/manga/${uuid}/feed`
                + `?translatedLanguage[]=${lang}`
                + `&limit=${limit}&offset=${offset}`
                + `&order[chapter]=desc`
                + `&contentRating[]=safe&contentRating[]=suggestive`;
            const data = await fetchMD(url);
            if (!data?.data?.length) break;
            all = all.concat(data.data);
            if (data.data.length < limit) break;
            offset += limit;
        }

        if (!all.length) return [];

        const seen = new Set();
        const chapters = [];
        for (const c of all) {
            const num = parseFloat(c.attributes.chapter);
            if (!num || num <= 0 || seen.has(num)) continue;
            seen.add(num);
            chapters.push({
                id:          c.id,
                mangaId,
                number:      num,
                title:       c.attributes.title || `Chapitre ${c.attributes.chapter}`,
                publishDate: c.attributes.publishAt
                    ? new Date(c.attributes.publishAt).toLocaleDateString('fr-FR')
                    : 'N/A',
                pages:       c.attributes.pages || 0,
                lang,
                readTime:    Math.max(5, Math.round((c.attributes.pages || 20) * 0.6)),
            });
        }

        chapters.sort((a, b) => b.number - a.number);
        _cache.chapters[key] = chapters;
        return chapters;
    }

    // ── Fetch d'un chapitre précis par numéro ─────────────────
    // Utilise chapter[]= (syntaxe correcte MangaDex)
    // Sans filtre de langue pour maximiser les résultats
    // Sans filtre contentRating pour éviter les 400
    async function fetchChapterByNumber(mangaId, chapterNum) {
        const uuid = await resolveUUID(mangaId);
        if (!uuid) return null;

        // Recherche sans langue ni contentRating = résultats maximaux
        const url = `${MD}/manga/${uuid}/feed`
            + `?chapter[]=${chapterNum}`
            + `&limit=20`
            + `&order[chapter]=asc`;

        const data = await fetchMD(url);
        if (!data?.data?.length) {
            console.warn(`[ChaptersDB] Chapitre ${chapterNum} introuvable sur MangaDex`);
            return null;
        }

        // Priorité : FR > EN > toute autre langue
        const priority = ['fr', 'en'];
        let entry = null;
        for (const lang of priority) {
            entry = data.data.find(c =>
                c.id &&
                c.attributes.translatedLanguage === lang &&
                parseFloat(c.attributes.chapter) > 0
            );
            if (entry) break;
        }
        // Fallback : première entrée valide quelle que soit la langue
        if (!entry) {
            entry = data.data.find(c => c.id && parseFloat(c.attributes.chapter) > 0);
        }
        if (!entry) return null;

        const num = parseFloat(entry.attributes.chapter);
        console.log(`[ChaptersDB] Chapitre ${chapterNum} trouvé (${entry.attributes.translatedLanguage}) → ${entry.id}`);

        return {
            id:          entry.id,
            mangaId,
            number:      num,
            title:       entry.attributes.title || `Chapitre ${chapterNum}`,
            publishDate: entry.attributes.publishAt
                ? new Date(entry.attributes.publishAt).toLocaleDateString('fr-FR')
                : 'N/A',
            pages:       entry.attributes.pages || 0,
            lang:        entry.attributes.translatedLanguage,
            readTime:    Math.max(5, Math.round((entry.attributes.pages || 20) * 0.6)),
        };
    }

    // ── Pages réelles depuis /at-home/server/:id ──────────────
    async function fetchPages(chapId) {
        const data = await fetchMD(`${MD}/at-home/server/${chapId}`);
        if (!data?.baseUrl || !data?.chapter?.hash || !data?.chapter?.data?.length) return null;
        const { baseUrl, chapter: { hash, data: files } } = data;
        return files.map((f, i) => ({
            pageNumber:  i + 1,
            src:         `${baseUrl}/data/${hash}/${f}`,
            srcFallback: `${baseUrl}/data-saver/${hash}/${f}`,
        }));
    }

    // ── API publique ──────────────────────────────────────────
    window.ChaptersDB = {

        getChapters: async function(mangaId) {
            console.log(`[ChaptersDB] getChapters(${mangaId})`);
            let list = await loadChapters(mangaId, 'fr');
            if (!list.length) list = await loadChapters(mangaId, 'en');
            if (!list.length) {
                console.warn(`[ChaptersDB] id:${mangaId} → fallback local`);
                return this._fallback(mangaId);
            }
            return list;
        },

        getChapterSync: function(mangaId, chapterNum) {
            const all = [
                ...(_cache.chapters[`${mangaId}-fr`] || []),
                ...(_cache.chapters[`${mangaId}-en`] || []),
            ];
            return all.find(c => Math.abs(c.number - chapterNum) < 0.01) || {
                id: null, mangaId, number: chapterNum,
                title: `Chapitre ${chapterNum}`,
                publishDate: 'N/A', pages: 20, readTime: 12,
            };
        },

        getPages: async function(mangaId, chapterNum) {
            const key = `${mangaId}-${chapterNum}`;
            if (_cache.pages[key]) return _cache.pages[key];

            // 1. Chercher dans le cache
            const cached = [
                ...(_cache.chapters[`${mangaId}-fr`] || []),
                ...(_cache.chapters[`${mangaId}-en`] || []),
            ].find(c => Math.abs(c.number - chapterNum) < 0.01);

            let chap = cached;

            // 2. Pas en cache → fetch direct par numéro (chapter[]=N)
            if (!chap?.id) {
                chap = await fetchChapterByNumber(mangaId, chapterNum);
            }

            // 3. Toujours rien → charger toute la liste puis rechercher
            if (!chap?.id) {
                await this.getChapters(mangaId);
                chap = [
                    ...(_cache.chapters[`${mangaId}-fr`] || []),
                    ...(_cache.chapters[`${mangaId}-en`] || []),
                ].find(c => Math.abs(c.number - chapterNum) < 0.01);
            }

            // 4. Récupérer les pages réelles
            if (chap?.id) {
                const pages = await fetchPages(chap.id);
                if (pages?.length) {
                    _cache.pages[key] = pages;
                    return pages;
                }
            }

            console.error(`[ChaptersDB] Chapitre ${chapterNum} introuvable pour id:${mangaId}`);
            return [];
        },

        _fallback: function(mangaId) {
            const manga = window.DB?.getManga(mangaId);
            if (!manga) return [];
            const total = manga.chapters || 10;
            return Array.from({ length: Math.min(total, 50) }, (_, i) => ({
                id: null, mangaId,
                number:      total - i,
                title:       `Chapitre ${total - i}`,
                publishDate: i === 0 ? 'Récent' : `Il y a ${i + 1} semaine${i > 0 ? 's' : ''}`,
                pages: 20, readTime: 12, lang: 'local',
            }));
        },

        clearCache: function() {
            Object.keys(_cache).forEach(k => { _cache[k] = {}; });
            _lsUUIDs = {};
            try { localStorage.removeItem(LS_KEY); } catch(e) {}
            console.log('[ChaptersDB] Cache vidé');
        },
    };

    if (window.DB) {
        window.DB.getChapters = (id) => window.ChaptersDB.getChapters(id);
    }

    console.log('[ChaptersDB] v16 chargé');
})();