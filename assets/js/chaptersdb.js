// ============================================================
// chaptersdb.js — MangaHub v10 — Définitif
// ============================================================
// Stratégie UUID :
//   1. Seul Berserk a un UUID hardcodé confirmé
//   2. Tous les autres : recherche MangaDex par titre optimisé
//   3. Cache localStorage → la recherche ne se fait qu'une fois par manga
//
// Stratégie chapitres :
//   1. Fetch direct (MangaDex supporte CORS nativement)
//   2. Proxy allorigins en backup si fetch direct échoue
//   3. Tente FR → EN → fallback local
// ============================================================
(function () {
    'use strict';

    const MD      = 'https://api.mangadex.org';
    const TIMEOUT = 12000;
    const LS_KEY  = 'mangahub_uuids_v10';

    // ── Cache mémoire session ─────────────────────────────────
    const _cache = {
        uuid:     {},
        chapters: {},
        pages:    {},
    };

    // ── UUID confirmé fonctionnel ─────────────────────────────
    const UUID_CONFIRMED = {
        1: '801513ba-a712-498c-8f57-cae55b38cc92', // Berserk ✓
    };

    // ── Termes de recherche optimisés pour chaque manga ───────
    // Titres choisis pour maximiser la précision sur MangaDex.
    // Même principe que covers.js : titres JP quand plus précis.
    const SEARCH_QUERIES = {
        1:  'Berserk',
        2:  'Vagabond',
        3:  'Vinland Saga',
        4:  'Monster Naoki Urasawa',
        5:  'Pluto Naoki Urasawa',
        6:  'Dorohedoro',
        7:  'Dungeon Meshi',
        8:  'Mushishi',
        9:  'Blame Nihei',
        10: 'Biomega',
        11: 'Oyasumi Punpun',
        12: 'Solanin',
        13: 'Blue Period',
        14: 'Houseki no Kuni',
        15: 'Slam Dunk',
        16: 'Hajime no Ippo',
        17: 'Haikyuu',
        18: '20th Century Boys',
        19: 'Devilman',
        20: 'Gantz',
        21: 'Yotsuba',
        22: 'Parasyte',
        23: 'Ashita no Joe',
        24: 'Hellsing',
        25: 'Beck',
        26: 'Fullmetal Alchemist',
        27: 'Hunter x Hunter',
        28: 'Dragon Ball',
        29: 'Naruto',
        30: 'Shingeki no Kyojin',
        31: 'One Piece',
        32: 'Kimetsu no Yaiba',
        33: 'Fairy Tail',
        34: 'Death Note',
        35: 'Bleach',
        36: 'Great Teacher Onizuka',
        37: 'Magi',
        38: 'Boku no Hero Academia',
        39: 'Nana Ai Yazawa',
        40: 'Fruits Basket',
        41: 'Cardcaptor Sakura',
        42: 'Bishoujo Senshi Sailor Moon',
        43: 'Baki',
        44: 'Yokohama Kaidashi Kikou',
        45: 'Golden Kamuy',
        46: 'Fire Punch',
        47: 'Chainsaw Man',
        48: 'Jujutsu Kaisen',
        49: 'Spy x Family',
        50: 'Tokyo Ghoul',
        51: 'Made in Abyss',
        52: 'Dr Stone',
        53: 'Yakusoku no Neverland',
        54: 'One Punch Man',
        55: 'Mob Psycho 100',
        56: 'Akira',
        57: 'Kaze no Tani no Nausicaa',
        58: 'Initial D',
        59: 'Claymore',
        60: 'Rurouni Kenshin',
    };

    // ── UUIDs persistés en localStorage ──────────────────────
    let _lsUUIDs = {};
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (raw) _lsUUIDs = JSON.parse(raw);
    } catch(e) {}

    function saveLS() {
        try { localStorage.setItem(LS_KEY, JSON.stringify(_lsUUIDs)); } catch(e) {}
    }

    // ── Fetch MangaDex (direct + fallback proxy) ─────────────
    async function fetchMD(url) {
        // 1. Fetch direct — MangaDex supporte CORS nativement
        try {
            const ctrl = new AbortController();
            const tid  = setTimeout(() => ctrl.abort(), TIMEOUT);
            const res  = await fetch(url, {
                signal: ctrl.signal,
                headers: { 'Accept': 'application/json' },
            });
            clearTimeout(tid);
            if (res.ok) return await res.json();
        } catch(e) {
            console.warn('[ChaptersDB] Fetch direct échoué:', e.message);
        }

        // 2. Proxy allorigins (retourne { contents: "..." })
        try {
            const proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(url);
            const ctrl = new AbortController();
            const tid  = setTimeout(() => ctrl.abort(), TIMEOUT);
            const res  = await fetch(proxyUrl, { signal: ctrl.signal });
            clearTimeout(tid);
            if (res.ok) {
                const wrapper = await res.json();
                if (wrapper?.contents) return JSON.parse(wrapper.contents);
            }
        } catch(e) {
            console.warn('[ChaptersDB] Proxy allorigins échoué:', e.message);
        }

        // 3. Proxy corsproxy.io (retourne le JSON brut)
        try {
            const proxyUrl = 'https://corsproxy.io/?url=' + encodeURIComponent(url);
            const ctrl = new AbortController();
            const tid  = setTimeout(() => ctrl.abort(), TIMEOUT);
            const res  = await fetch(proxyUrl, { signal: ctrl.signal });
            clearTimeout(tid);
            if (res.ok) {
                const text = await res.text();
                if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
                    return JSON.parse(text);
                }
            }
        } catch(e) {
            console.warn('[ChaptersDB] Proxy corsproxy.io échoué:', e.message);
        }

        return null;
    }

    // ── Résolution UUID ───────────────────────────────────────
    async function resolveUUID(mangaId) {
        if (_cache.uuid[mangaId])    return _cache.uuid[mangaId];
        if (UUID_CONFIRMED[mangaId]) {
            _cache.uuid[mangaId] = UUID_CONFIRMED[mangaId];
            return _cache.uuid[mangaId];
        }
        if (_lsUUIDs[mangaId]) {
            _cache.uuid[mangaId] = _lsUUIDs[mangaId];
            return _cache.uuid[mangaId];
        }

        const query = SEARCH_QUERIES[mangaId];
        if (!query) return null;

        console.log(`[ChaptersDB] Recherche UUID id:${mangaId} → "${query}"`);

        const url  = `${MD}/manga?title=${encodeURIComponent(query)}&limit=5&order[relevance]=desc`;
        const data = await fetchMD(url);
        const uuid = data?.data?.[0]?.id || null;

        if (uuid) {
            console.log(`[ChaptersDB] UUID id:${mangaId} → ${uuid}`);
            _lsUUIDs[mangaId] = uuid;
            _cache.uuid[mangaId] = uuid;
            saveLS();
        } else {
            console.warn(`[ChaptersDB] UUID introuvable pour id:${mangaId} ("${query}")`);
        }

        return uuid;
    }

    // ── Chargement des chapitres ──────────────────────────────
    async function loadChapters(mangaId, lang) {
        const key = `${mangaId}-${lang}`;
        if (_cache.chapters[key]) return _cache.chapters[key];

        const uuid = await resolveUUID(mangaId);
        if (!uuid) return [];

        let all    = [];
        let offset = 0;
        const limit = 100;

        try {
            while (true) {
                const url  = `${MD}/manga/${uuid}/feed`
                    + `?translatedLanguage[]=${lang}`
                    + `&limit=${limit}&offset=${offset}`
                    + `&order[chapter]=desc`
                    + `&contentRating[]=safe&contentRating[]=suggestive&contentRating[]=erotica&contentRating[]=pornographic`;
                const data = await fetchMD(url);
                if (!data?.data?.length) break;
                all = all.concat(data.data);
                if (data.data.length < limit) break;
                offset += limit;
            }
        } catch(e) {
            console.error('[ChaptersDB] Erreur loadChapters:', e);
            return [];
        }

        if (!all.length) return [];

        // Dédupliquer par numéro de chapitre
        const seen     = new Set();
        const chapters = [];
        for (const c of all) {
            const num = parseFloat(c.attributes.chapter);
            if (!num || num <= 0) continue;
            if (seen.has(num)) continue;
            seen.add(num);
            chapters.push({
                id:          c.id,
                mangaId:     mangaId,
                number:      num,
                title:       c.attributes.title || `Chapitre ${c.attributes.chapter}`,
                publishDate: c.attributes.publishAt
                    ? new Date(c.attributes.publishAt).toLocaleDateString('fr-FR')
                    : 'N/A',
                pages:       c.attributes.pages || 0,
                lang:        lang,
                readTime:    Math.max(5, Math.round((c.attributes.pages || 20) * 0.6)),
            });
        }

        chapters.sort((a, b) => b.number - a.number);
        _cache.chapters[key] = chapters;
        return chapters;
    }

    // ── API publique ──────────────────────────────────────────
    window.ChaptersDB = {

        getChapters: async function(mangaId) {
            console.log(`[ChaptersDB] getChapters(${mangaId})`);

            let list = await loadChapters(mangaId, 'fr');

            if (!list.length) {
                console.log(`[ChaptersDB] id:${mangaId} — FR vide, tentative EN`);
                list = await loadChapters(mangaId, 'en');
            }

            if (!list.length) {
                console.warn(`[ChaptersDB] id:${mangaId} — fallback local`);
                return this._fallback(mangaId);
            }

            return list;
        },

        // Synchrone — ne fait pas d'appel réseau
        getChapterSync: function(mangaId, chapterNum) {
            const fr    = _cache.chapters[`${mangaId}-fr`] || [];
            const en    = _cache.chapters[`${mangaId}-en`] || [];
            const found = [...fr, ...en].find(c => Math.abs(c.number - chapterNum) < 0.01);
            if (found) return found;
            return {
                id: null, mangaId, number: chapterNum,
                title: `Chapitre ${chapterNum}`,
                publishDate: 'N/A', pages: 20, readTime: 12,
            };
        },

        getPages: async function(mangaId, chapterNum) {
            const key = `${mangaId}-${chapterNum}`;
            if (_cache.pages[key]) return _cache.pages[key];

            const chapters = await this.getChapters(mangaId);
            const chap     = chapters.find(c => Math.abs(c.number - chapterNum) < 0.01);

            if (!chap?.id) {
                console.warn(`[ChaptersDB] Chapitre ${chapterNum} introuvable pour id:${mangaId}`);
                return [];
            }

            const data = await fetchMD(`${MD}/at-home/server/${chap.id}`);
            if (!data?.baseUrl || !data?.chapter) return [];

            const { baseUrl, chapter: { hash, data: files = [] } } = data;
            const pages = files.map((f, i) => ({
                pageNumber:  i + 1,
                src:         `${baseUrl}/data/${hash}/${f}`,
                srcFallback: `${baseUrl}/data-saver/${hash}/${f}`,
            }));

            _cache.pages[key] = pages;
            return pages;
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

    // Patch DB.getChapters → async
    if (window.DB) {
        window.DB.getChapters = (id) => window.ChaptersDB.getChapters(id);
    }

    console.log('[ChaptersDB] v10 chargé');

})();