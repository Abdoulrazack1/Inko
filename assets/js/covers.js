// ============================================================
// covers.js — v5 — Covers AniList fiables
// Corrections v5 vs v4 :
//   1. observeDOM() lancé EN PREMIER — ne plus rater les images dynamiques
//   2. Chargement en batch de 5 parallèles (700ms entre batches) → 42s → ~9s
//   3. data-seed stocké sur <img> → le seed est retrouvable même après remplacement src
//   4. onerror restaure le picsum original au lieu de mettre src à vide
// ============================================================
(function () {
    'use strict';

    // ── Mapping seed picsum → titre de recherche AniList ──────
    const MANGA_MAP = {
        'berserk':      { id:1,  q:'Berserk' },
        'vagabond':     { id:2,  q:'Vagabond' },
        'vinland':      { id:3,  q:'Vinland Saga' },
        'monster':      { id:4,  q:'Monster Naoki Urasawa' },
        'pluto':        { id:5,  q:'Pluto Naoki Urasawa' },
        'dorohedoro':   { id:6,  q:'Dorohedoro' },
        'dungeon':      { id:7,  q:'Dungeon Meshi' },
        'mushishi':     { id:8,  q:'Mushishi' },
        'blame':        { id:9,  q:'Blame Nihei' },
        'biomega':      { id:10, q:'Biomega' },
        'punpun':       { id:11, q:'Oyasumi Punpun' },
        'solanin':      { id:12, q:'Solanin' },
        'blueperiod':   { id:13, q:'Blue Period' },
        'houseki':      { id:14, q:'Houseki no Kuni' },
        'slamdunk':     { id:15, q:'Slam Dunk' },
        'ippo':         { id:16, q:'Hajime no Ippo' },
        'haikyuu':      { id:17, q:'Haikyuu' },
        '20boys':       { id:18, q:'20th Century Boys' },
        'devilman':     { id:19, q:'Devilman' },
        'gantz':        { id:20, q:'Gantz' },
        'yotsuba':      { id:21, q:'Yotsuba' },
        'parasyte':     { id:22, q:'Parasyte' },
        'ashitajoe':    { id:23, q:'Ashita no Joe' },
        'hellsing':     { id:24, q:'Hellsing' },
        'beck':         { id:25, q:'Beck' },
        'fma':          { id:26, q:'Fullmetal Alchemist' },
        'hxh':          { id:27, q:'Hunter x Hunter' },
        'dragonball':   { id:28, q:'Dragon Ball' },
        'naruto':       { id:29, q:'Naruto' },
        'aot':          { id:30, q:'Shingeki no Kyojin' },
        'onepiece':     { id:31, q:'One Piece' },
        'demonslayer':  { id:32, q:'Kimetsu no Yaiba' },
        'fairytail':    { id:33, q:'Fairy Tail' },
        'deathnote':    { id:34, q:'Death Note' },
        'bleach':       { id:35, q:'Bleach' },
        'gto':          { id:36, q:'Great Teacher Onizuka' },
        'magi':         { id:37, q:'Magi' },
        'mha':          { id:38, q:'Boku no Hero Academia' },
        'nana':         { id:39, q:'Nana Ai Yazawa' },
        'fruitsbasket': { id:40, q:'Fruits Basket' },
        'sakura':       { id:41, q:'Cardcaptor Sakura' },
        'sailormoon':   { id:42, q:'Bishoujo Senshi Sailor Moon' },
        'baki':         { id:43, q:'Baki' },
        'ykk':          { id:44, q:'Yokohama Kaidashi Kikou' },
        'goldenkamuy':  { id:45, q:'Golden Kamuy' },
        'firepunch':    { id:46, q:'Fire Punch' },
        'chainsawman':  { id:47, q:'Chainsaw Man' },
        'jjk':          { id:48, q:'Jujutsu Kaisen' },
        'spyfamily':    { id:49, q:'Spy x Family' },
        'tg':           { id:50, q:'Tokyo Ghoul' },
        'mia':          { id:51, q:'Made in Abyss' },
        'drstone':      { id:52, q:'Dr Stone' },
        'tpn':          { id:53, q:'Yakusoku no Neverland' },
        'opm':          { id:54, q:'One Punch Man' },
        'mob':          { id:55, q:'Mob Psycho 100' },
        'akira':        { id:56, q:'Akira' },
        'nausicaa':     { id:57, q:'Kaze no Tani no Nausicaa' },
        'initiald':     { id:58, q:'Initial D' },
        'claymore':     { id:59, q:'Claymore' },
        'kenshin':      { id:60, q:'Rurouni Kenshin' },
    };

    // ── Cache localStorage ────────────────────────────────────
    const LS_KEY = 'mangahub_covers_v5';
    let coverCache = {};
    try {
        const saved = localStorage.getItem(LS_KEY);
        if (saved) coverCache = JSON.parse(saved);
    } catch(e) {}

    function saveCache() {
        try { localStorage.setItem(LS_KEY, JSON.stringify(coverCache)); } catch(e) {}
    }

    // ── Extraire le seed depuis une URL picsum ────────────────
    function seedFromUrl(url) {
        if (!url) return null;
        const m = url.match(/picsum\.photos\/seed\/([^/?#\s]+)/);
        return m ? m[1] : null;
    }

    // ── Requête AniList pour UN manga ─────────────────────────
    async function fetchAniListCover(searchTitle) {
        const query = `
            query ($search: String) {
                Media(search: $search, type: MANGA, sort: SEARCH_MATCH) {
                    coverImage { extraLarge large }
                }
            }`;
        try {
            const res = await fetch('https://graphql.anilist.co', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ query, variables: { search: searchTitle } }),
            });
            if (!res.ok) return null;
            const data = await res.json();
            const img  = data?.data?.Media?.coverImage;
            return img?.extraLarge || img?.large || null;
        } catch(e) {
            return null;
        }
    }

    // ── Appliquer une cover à toutes les images ayant ce seed ─
    // Utilise data-seed pour retrouver le seed même après remplacement du src.
    function applyToImages(seed, coverUrl) {
        document.querySelectorAll('img').forEach(img => {
            // Récupérer le seed : data-seed en priorité, sinon l'extraire du src actuel
            let imgSeed = img.dataset.seed || seedFromUrl(img.getAttribute('src'));
            if (imgSeed !== seed) return;

            // Stocker le seed et le picsum original pour le fallback
            if (!img.dataset.seed)         img.dataset.seed    = seed;
            if (!img.dataset.picsumSrc)    img.dataset.picsumSrc = img.getAttribute('src');

            // Ne pas remplacer si déjà à jour
            if (img.getAttribute('src') === coverUrl) return;

            img.src = coverUrl;

            // Si AniList CDN tombe en erreur, restaurer le picsum d'origine
            img.onerror = function() {
                this.onerror = null;
                this.src = this.dataset.picsumSrc || '';
            };
        });
    }

    // ── Appliquer toutes les covers déjà en cache ─────────────
    function applyAllCached() {
        document.querySelectorAll('img').forEach(img => {
            const seed = img.dataset.seed || seedFromUrl(img.getAttribute('src'));
            if (!seed) return;
            const url  = coverCache[seed];
            if (!url)  return;

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
            if (seed && MANGA_MAP[seed] && !coverCache[seed]) {
                missing.add(seed);
            }
        });
        return [...missing];
    }

    // ── Chargement en batch parallèle ─────────────────────────
    // batch de BATCH_SIZE requêtes simultanées, DELAY_MS entre chaque batch
    // → bien sous le rate limit AniList (90 req/min)
    const BATCH_SIZE = 5;
    const DELAY_MS   = 750;

    async function loadCovers(seeds) {
        const missing = seeds.filter(s => MANGA_MAP[s] && !coverCache[s]);
        if (!missing.length) return;

        console.log(`[Covers] Chargement de ${missing.length} covers (batches de ${BATCH_SIZE})…`);

        for (let i = 0; i < missing.length; i += BATCH_SIZE) {
            const batch = missing.slice(i, i + BATCH_SIZE);

            // Toutes les requêtes du batch en parallèle
            const results = await Promise.all(
                batch.map(async seed => {
                    const entry = MANGA_MAP[seed];
                    if (!entry) return null;
                    const url = await fetchAniListCover(entry.q);
                    return url ? { seed, url } : null;
                })
            );

            // Appliquer immédiatement les résultats
            for (const r of results) {
                if (!r) continue;
                coverCache[r.seed] = r.url;
                applyToImages(r.seed, r.url);
            }

            // Délai entre batches (sauf le dernier)
            if (i + BATCH_SIZE < missing.length) {
                await new Promise(resolve => setTimeout(resolve, DELAY_MS));
            }
        }

        saveCache();
        console.log(`[Covers] Terminé — ${Object.keys(coverCache).length} covers en cache`);
    }

    // ── Observer les nouvelles images ajoutées dynamiquement ──
    // DOIT être actif AVANT le chargement pour ne rien rater
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

                        // Stocker immédiatement le seed et le picsum
                        img.dataset.seed     = seed;
                        img.dataset.picsumSrc = img.getAttribute('src');

                        if (coverCache[seed]) {
                            // Cover déjà connue → appliquer tout de suite
                            img.src = coverCache[seed];
                            img.onerror = function() {
                                this.onerror = null;
                                this.src = this.dataset.picsumSrc || '';
                            };
                        } else {
                            // À charger
                            newSeeds.add(seed);
                        }
                    });
                });
            });
            if (newSeeds.size) loadCovers([...newSeeds]);
        }).observe(document.body, { childList: true, subtree: true });
    }

    // ── Init ──────────────────────────────────────────────────
    async function init() {
        // ① Observer IMMÉDIATEMENT — avant tout le reste
        //    Garantit que les images ajoutées pendant le chargement sont captées
        observeDOM();

        // ② Appliquer le cache localStorage (0 délai)
        applyAllCached();

        // ③ Lancer le chargement des covers manquantes
        const seeds = collectMissingSeeds();

        if (!seeds.length) {
            // Aucun seed visible maintenant → réessayer dans 500ms
            // (les JS de rendu n'ont peut-être pas encore tourné)
            setTimeout(() => {
                applyAllCached();
                const s2 = collectMissingSeeds();
                if (s2.length) loadCovers(s2);
            }, 500);
            return;
        }

        loadCovers(seeds);
        // Pas d'await → ne bloque pas l'exécution
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // DOM déjà prêt (script chargé en defer ou en fin de body)
        setTimeout(init, 50);
    }

    // ── API publique ──────────────────────────────────────────
    window.Covers = {
        refresh:    () => { applyAllCached(); loadCovers(collectMissingSeeds()); },
        clearCache: () => {
            coverCache = {};
            try { localStorage.removeItem(LS_KEY); } catch(e) {}
            console.log('[Covers] Cache vidé');
        },
        get cache() { return coverCache; },
    };

})();