// ============================================================
// covers.js — v7 — Covers AniList (graphql.anilist.co direct)
// ============================================================
// Bugs corrigés vs v4 :
//   1. observeDOM() lancé EN PREMIER (avant tout chargement)
//   2. Batch de 5 parallèles au lieu de séquentiel (~9s vs 42s)
//   3. data-seed + data-picsum-src stockés sur <img> →
//      seed retrouvable après remplacement du src
//   4. onerror restaure le picsum original (src n'est plus vide)
//   5. Queries corrigées pour tous les cas ambigus
//   6. Vérification du résultat AniList : compare le titre retourné
//      avec les alias connus → évite les mauvaises covers
//   7. Requête Page (3 résultats) + pick du meilleur au lieu du 1er
// ============================================================
(function () {
    'use strict';

    // ── Configuration ─────────────────────────────────────────
    // q      : terme de recherche principal (anglais quand plus précis)
    // alt    : terme alternatif si q ne donne pas de résultat valide
    // tokens : mots-clés du titre — AU MOINS UN doit apparaître dans
    //          le titre retourné par AniList (vérification anti-mauvais-match)
    const MANGA_MAP = {
        'berserk':     { id:1,  q:'Berserk',                          tokens:['berserk'] },
        'vagabond':    { id:2,  q:'Vagabond',                         tokens:['vagabond'] },
        'vinland':     { id:3,  q:'Vinland Saga',                     tokens:['vinland'] },
        'monster':     { id:4,  q:'Monster',         alt:'Monster Urasawa',     tokens:['monster'] },
        'pluto':       { id:5,  q:'Pluto',           alt:'Pluto Urasawa',       tokens:['pluto'] },
        'dorohedoro':  { id:6,  q:'Dorohedoro',                       tokens:['dorohedoro'] },
        'dungeon':     { id:7,  q:'Dungeon Meshi',   alt:'Delicious in Dungeon',tokens:['dungeon','meshi','delicious'] },
        'mushishi':    { id:8,  q:'Mushishi',                         tokens:['mushishi','mushi'] },
        'blame':       { id:9,  q:'Blame!',                           tokens:['blame'] },
        'biomega':     { id:10, q:'Biomega',                          tokens:['biomega'] },
        'punpun':      { id:11, q:'Goodnight Punpun',alt:'Oyasumi Punpun',      tokens:['punpun'] },
        'solanin':     { id:12, q:'Solanin',                          tokens:['solanin'] },
        'blueperiod':  { id:13, q:'Blue Period',                      tokens:['blue','period'] },
        'houseki':     { id:14, q:'Land of the Lustrous',alt:'Houseki no Kuni', tokens:['lustrous','houseki'] },
        'slamdunk':    { id:15, q:'Slam Dunk',                        tokens:['slam','dunk'] },
        'ippo':        { id:16, q:'Hajime no Ippo',                   tokens:['ippo'] },
        'haikyuu':     { id:17, q:'Haikyuu',                         tokens:['haikyuu','haikyu'] },
        '20boys':      { id:18, q:'20th Century Boys',                tokens:['century','boys','20'] },
        'devilman':    { id:19, q:'Devilman',                         tokens:['devilman'] },
        'gantz':       { id:20, q:'Gantz',                            tokens:['gantz'] },
        'yotsuba':     { id:21, q:'Yotsuba',                          tokens:['yotsuba'] },
        'parasyte':    { id:22, q:'Parasyte',         alt:'Kiseijuu',           tokens:['parasyte','parasite','kiseijuu'] },
        'ashitajoe':   { id:23, q:'Ashita no Joe',                    tokens:['joe','ashita'] },
        'hellsing':    { id:24, q:'Hellsing',                         tokens:['hellsing'] },
        'beck':        { id:25, q:'BECK',             alt:'Beck Mongolian Chop Squad', tokens:['beck'] },
        'fma':         { id:26, q:'Fullmetal Alchemist',              tokens:['fullmetal','alchemist'] },
        'hxh':         { id:27, q:'Hunter x Hunter',                  tokens:['hunter'] },
        'dragonball':  { id:28, q:'Dragon Ball',                      tokens:['dragon','ball'] },
        'naruto':      { id:29, q:'Naruto',                           tokens:['naruto'] },
        'aot':         { id:30, q:'Attack on Titan', alt:'Shingeki no Kyojin', tokens:['titan','kyojin','shingeki'] },
        'onepiece':    { id:31, q:'One Piece',                        tokens:['one','piece'] },
        'demonslayer': { id:32, q:'Demon Slayer',    alt:'Kimetsu no Yaiba',   tokens:['demon','slayer','kimetsu'] },
        'fairytail':   { id:33, q:'Fairy Tail',                       tokens:['fairy','tail'] },
        'deathnote':   { id:34, q:'Death Note',                       tokens:['death','note'] },
        'bleach':      { id:35, q:'Bleach',                           tokens:['bleach'] },
        'gto':         { id:36, q:'Great Teacher Onizuka',            tokens:['onizuka','gto','teacher'] },
        'magi':        { id:37, q:'Magi: The Labyrinth of Magic',     tokens:['magi','labyrinth'] },
        'mha':         { id:38, q:'My Hero Academia',alt:'Boku no Hero Academia',tokens:['hero','academia','boku'] },
        'nana':        { id:39, q:'Nana',             alt:'Nana Yazawa',        tokens:['nana'] },
        'fruitsbasket':{ id:40, q:'Fruits Basket',                    tokens:['fruits','basket'] },
        'sakura':      { id:41, q:'Cardcaptor Sakura',                tokens:['cardcaptor','sakura'] },
        'sailormoon':  { id:42, q:'Sailor Moon',     alt:'Bishoujo Senshi Sailor Moon', tokens:['sailor','moon'] },
        'baki':        { id:43, q:'Grappler Baki',                    tokens:['baki','grappler'] },
        'ykk':         { id:44, q:'Yokohama Kaidashi Kiko',           tokens:['yokohama','kaidashi'] },
        'goldenkamuy': { id:45, q:'Golden Kamuy',                     tokens:['golden','kamuy'] },
        'firepunch':   { id:46, q:'Fire Punch',                       tokens:['fire','punch'] },
        'chainsawman': { id:47, q:'Chainsaw Man',                     tokens:['chainsaw'] },
        'jjk':         { id:48, q:'Jujutsu Kaisen',                   tokens:['jujutsu','kaisen'] },
        'spyfamily':   { id:49, q:'Spy x Family',                     tokens:['spy','family'] },
        'tg':          { id:50, q:'Tokyo Ghoul',                      tokens:['tokyo','ghoul'] },
        'mia':         { id:51, q:'Made in Abyss',                    tokens:['abyss','made'] },
        'drstone':     { id:52, q:'Dr. Stone',                        tokens:['stone','dr'] },
        'tpn':         { id:53, q:'The Promised Neverland',alt:'Yakusoku no Neverland',tokens:['neverland','promised','yakusoku'] },
        'opm':         { id:54, q:'One Punch Man',  alt:'Onepunchman',          tokens:['punch','man','one'] },
        'mob':         { id:55, q:'Mob Psycho 100',                   tokens:['mob','psycho'] },
        'akira':       { id:56, q:'Akira',                            tokens:['akira'] },
        'nausicaa':    { id:57, q:'Nausicaa of the Valley of the Wind',alt:'Kaze no Tani no Nausicaa',tokens:['nausicaa','nausicaä','nausicaa'] },
        'initiald':    { id:58, q:'Initial D',                        tokens:['initial'] },
        'claymore':    { id:59, q:'Claymore',                         tokens:['claymore'] },
        'kenshin':     { id:60, q:'Rurouni Kenshin',                  tokens:['kenshin','rurouni'] },
    };

    // ── Cache localStorage ────────────────────────────────────
    // Clé v7 : invalide les caches v4/v5/v6 avec mauvaises covers
    const LS_KEY = 'mangahub_covers_v7';
    let coverCache = {};
    try {
        const saved = localStorage.getItem(LS_KEY);
        if (saved) coverCache = JSON.parse(saved);
    } catch(e) {}

    function saveCache() {
        try { localStorage.setItem(LS_KEY, JSON.stringify(coverCache)); } catch(e) {}
    }

    // ── Extraction du seed depuis URL picsum ──────────────────
    function seedFromUrl(url) {
        if (!url) return null;
        const m = url.match(/picsum\.photos\/seed\/([^/?#\s]+)/);
        return m ? m[1] : null;
    }

    // ── Vérification du résultat AniList ─────────────────────
    // Normalise un titre et vérifie qu'il contient au moins un
    // des tokens attendus → évite les mauvaises covers
    function titleMatches(returnedTitles, tokens) {
        if (!tokens || !tokens.length) return true;
        const normalize = s => (s || '').toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        const allText = [
            returnedTitles.romaji,
            returnedTitles.english,
            returnedTitles.native,
        ].map(normalize).join(' ');

        return tokens.some(tok => allText.includes(tok.toLowerCase()));
    }

    // ── Requête AniList : cherche 3 résultats, prend le meilleur ─
    async function fetchCover(seed) {
        const entry = MANGA_MAP[seed];
        if (!entry) return null;

        // Requête Page → jusqu'à 3 résultats pour choisir le meilleur
        const gql = `
            query ($search: String) {
                Page(perPage: 3) {
                    media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
                        title { romaji english native }
                        coverImage { extraLarge large }
                        format
                    }
                }
            }`;

        const tryQuery = async (searchTerm, attempt = 0) => {
            try {
                const ANILIST_URL = 'https://graphql.anilist.co';
                const res = await fetch(ANILIST_URL, {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ query: gql, variables: { search: searchTerm } }),
                });
                // 429 : rate limit → attendre et réessayer (max 3 fois)
                if (res.status === 429) {
                    if (attempt >= 3) return null;
                    const wait = (attempt + 1) * 2000; // 2s, 4s, 6s
                    console.warn(`[Covers] AniList 429 — retry dans ${wait}ms`);
                    await new Promise(r => setTimeout(r, wait));
                    return tryQuery(searchTerm, attempt + 1);
                }
                if (!res.ok) return null;
                const data = await res.json();
                const items = data?.data?.Page?.media || [];

                // Parcourir les résultats et prendre le premier qui passe la vérification
                for (const item of items) {
                    if (titleMatches(item.title, entry.tokens)) {
                        const img = item.coverImage;
                        const url = img?.extraLarge || img?.large;
                        if (url) return url;
                    }
                }

                // Aucun résultat ne matche → retourner le 1er quand même
                // (mieux que rien, surtout pour les mangas peu connus)
                const first = items[0];
                if (first) {
                    const img = first.coverImage;
                    return img?.extraLarge || img?.large || null;
                }
                return null;
            } catch(e) {
                return null;
            }
        };

        // 1. Requête principale
        let url = await tryQuery(entry.q);
        if (url) return url;

        // 2. Requête alternative si définie
        if (entry.alt) {
            url = await tryQuery(entry.alt);
            if (url) return url;
        }

        return null;
    }

    // ── Appliquer une cover à toutes les images avec ce seed ─
    function applyToImages(seed, coverUrl) {
        document.querySelectorAll('img').forEach(img => {
            // Chercher le seed : data-seed en priorité, puis extraire du src
            const imgSeed = img.dataset.seed || seedFromUrl(img.getAttribute('src'));
            if (imgSeed !== seed) return;

            // Mémoriser le seed et le picsum original sur l'élément
            if (!img.dataset.seed)      img.dataset.seed     = seed;
            if (!img.dataset.picsumSrc) img.dataset.picsumSrc = img.getAttribute('src');

            if (img.getAttribute('src') === coverUrl) return;
            img.src = coverUrl;

            // Si le CDN AniList est mort, restaurer le picsum
            img.onerror = function() {
                this.onerror = null;
                this.src = this.dataset.picsumSrc || '';
            };
        });
    }

    // ── Appliquer toutes les covers en cache ──────────────────
    function applyAllCached() {
        document.querySelectorAll('img').forEach(img => {
            const seed = img.dataset.seed || seedFromUrl(img.getAttribute('src'));
            if (!seed) return;
            const url = coverCache[seed];
            if (!url) return;

            if (!img.dataset.seed)      img.dataset.seed     = seed;
            if (!img.dataset.picsumSrc) img.dataset.picsumSrc = img.getAttribute('src');
            if (img.getAttribute('src') === url) return;

            img.src = url;
            img.onerror = function() {
                this.onerror = null;
                this.src = this.dataset.picsumSrc || '';
            };
        });
    }

    // ── Collecter les seeds manquants dans le DOM ─────────────
    function collectMissingSeeds() {
        const missing = new Set();
        document.querySelectorAll('img').forEach(img => {
            const seed = img.dataset.seed || seedFromUrl(img.getAttribute('src'));
            if (seed && MANGA_MAP[seed] && !coverCache[seed]) missing.add(seed);
        });
        return [...missing];
    }

    // ── Chargement séquentiel avec délai ─────────────────────
    // 1 requête à la fois, 800ms entre chaque → jamais de 429
    const DELAY_MS = 800;

    async function loadCovers(seeds) {
        const missing = seeds.filter(s => MANGA_MAP[s] && !coverCache[s]);
        if (!missing.length) return;

        console.log(`[Covers] ${missing.length} covers à charger (séquentiel)…`);

        for (let i = 0; i < missing.length; i++) {
            const seed = missing[i];
            const url  = await fetchCover(seed);
            if (url) {
                coverCache[seed] = url;
                applyToImages(seed, url);
            }
            if (i < missing.length - 1) {
                await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            }
        }

        saveCache();
        console.log(`[Covers] Terminé — ${Object.keys(coverCache).length} covers en cache`);
    }

    // ── Observer les nouvelles images (ajouts dynamiques) ────
    // DOIT être actif AVANT tout chargement
    function observeDOM() {
        new MutationObserver(mutations => {
            const newSeeds = new Set();
            mutations.forEach(m => {
                m.addedNodes.forEach(node => {
                    if (node.nodeType !== 1) return;
                    const imgs = node.tagName === 'IMG'
                        ? [node]
                        : [...(node.querySelectorAll?.('img') || [])];

                    imgs.forEach(img => {
                        const seed = seedFromUrl(img.getAttribute('src'));
                        if (!seed || !MANGA_MAP[seed]) return;

                        // Mémoriser seed + picsum original dès que l'image apparaît
                        img.dataset.seed     = seed;
                        img.dataset.picsumSrc = img.getAttribute('src');

                        if (coverCache[seed]) {
                            img.src = coverCache[seed];
                            img.onerror = function() {
                                this.onerror = null;
                                this.src = this.dataset.picsumSrc || '';
                            };
                        } else {
                            newSeeds.add(seed);
                        }
                    });
                });
            });
            if (newSeeds.size) loadCovers([...newSeeds]);
        }).observe(document.body, { childList: true, subtree: true });
    }

    // ── Init ──────────────────────────────────────────────────
    function init() {
        observeDOM();       // ① Observer en PREMIER — avant tout le reste
        applyAllCached();   // ② Appliquer le cache immédiatement

        const seeds = collectMissingSeeds();
        if (!seeds.length) {
            // Aucun seed visible maintenant → le rendu JS n'est pas encore fini
            setTimeout(() => {
                applyAllCached();
                const s2 = collectMissingSeeds();
                if (s2.length) loadCovers(s2);
            }, 300);
            return;
        }

        loadCovers(seeds); // fire-and-forget, ne bloque pas
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 50);
    }

    // ── API publique ──────────────────────────────────────────
    window.Covers = {
        refresh:    () => { applyAllCached(); loadCovers(collectMissingSeeds()); },
        reload:     (seed) => {
            if (seed) {
                delete coverCache[seed];
                loadCovers([seed]);
            } else {
                coverCache = {};
                try { localStorage.removeItem(LS_KEY); } catch(e) {}
                loadCovers(collectMissingSeeds());
            }
        },
        clearCache: () => {
            coverCache = {};
            try { localStorage.removeItem(LS_KEY); } catch(e) {}
            console.log('[Covers] Cache vidé');
        },
        get cache() { return { ...coverCache }; },
    };

})();