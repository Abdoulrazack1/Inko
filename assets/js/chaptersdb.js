// ============================================================
// chaptersdb.js — MangaHub
// ============================================================
// Gestion des chapitres et pages.
// Les données de chapitres sont fournies directement (pas de fetch
// vers un serveur proxy — MangaDex et WeebCentral supprimés).
// ============================================================
window.ChaptersDB = (function () {
    'use strict';

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
    const _cache = { chapters: {}, pages: {} };

    // ── getChapters ───────────────────────────────────────────
    // Retourne les chapitres mis en cache, ou une liste vide.
    // Pour alimenter le cache, utilisez ChaptersDB.setChapters(mangaId, array).
    async function getChapters(mangaId) {
        return _cache.chapters[`${mangaId}`] || [];
    }

    // ── getChapterSync ────────────────────────────────────────
    function getChapterSync(mangaId, chapterNum) {
        const cached = _cache.chapters[`${mangaId}`];
        if (cached) {
            const found = cached.find(c => Math.abs(c.number - chapterNum) < 0.01);
            if (found) return found;
        }
        return { id: null, number: chapterNum, title: `Chapitre ${chapterNum}`, pages: 20, readTime: 10 };
    }

    // ── getPages ──────────────────────────────────────────────
    async function getPages(mangaId, chapterNum) {
        const chaps = await getChapters(mangaId);
        const chap  = chaps.find(c => Math.abs(c.number - chapterNum) < 0.01);
        if (!chap?.id) return [];
        return _cache.pages[chap.id] || [];
    }

    // ── API publique ──────────────────────────────────────────
    return {
        getChapters,
        getChapterSync,
        getPages,

        // Injection de chapitres depuis une source externe
        setChapters(mangaId, chaptersArray) {
            _cache.chapters[`${mangaId}`] = chaptersArray;
        },

        // Injection de pages pour un chapitre (par son id)
        setPages(chapterId, pagesArray) {
            _cache.pages[chapterId] = pagesArray;
        },

        clearCache() {
            Object.keys(_cache).forEach(k => { _cache[k] = {}; });
            console.log('[ChaptersDB] Cache vidé');
        },

        get cacheInfo() {
            return {
                chapters: Object.keys(_cache.chapters).length,
                pages:    Object.keys(_cache.pages).length,
            };
        },

        _getChaptersCache(mangaId) {
            return _cache.chapters[`${mangaId}`] || [];
        },

        get mangaNames() { return { ...MANGA_NAMES }; },
    };
})();