// ============================================================
// SushiScan — extension Inko (modèle Mihon)
// ============================================================
// ⚠ Extension communautaire, fournie sans garantie. Scrape l'HTML
// de sushiscan.fr (thème Madara/TS). Le site change régulièrement,
// utilise Cloudflare et peut bloquer les requêtes serveur.
//
// Pré-requis : `npm install cheerio` dans le dossier server/
// ============================================================
const axios = require('axios');
const { execFile } = require('child_process');

let cheerio = null;
try { cheerio = require('cheerio'); }
catch (e) {
    console.warn('[sushiscan] cheerio manquant — installer avec `cd server && npm install cheerio`');
}

const BASE = 'https://sushiscan.fr';
const UA   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const http = axios.create({
    baseURL: BASE,
    timeout: 20_000,
    headers: {
        'User-Agent':      UA,
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Referer':         BASE + '/',
        'DNT':             '1',
    },
});

// ── Cache mémoire ──
const cache = new Map();
function getC(k)        { const e = cache.get(k); if (!e) return null; if (e.expires < Date.now()) { cache.delete(k); return null; } return e.value; }
function setC(k, v, ms) { cache.set(k, { value: v, expires: Date.now() + ms }); }

function requireCheerio() {
    if (!cheerio) throw new Error('cheerio non installé — `cd server && npm install cheerio`');
}

// SushiScan est protégé par Cloudflare : l'empreinte TLS de Node est bloquée.
// curl (présent nativement Win10+/macOS/Linux) passe ; repli axios si absent.
// Audit EXT-04 : aucun reessai. Un scan de bibliotheque enchaine des dizaines
// de requetes sur un site scrape derriere Cloudflare : un blocage ponctuel ou
// un hoquet reseau faisait echouer toute la serie et remontait a l'utilisateur
// comme une source cassee. Deux tentatives, 800 ms d'attente. On ne reessaie
// que le transitoire : une reponse vide (blocage anti-bot) ou une erreur curl,
// jamais une reponse valide mais inattendue.
function curlGetOnce(url) {
    return new Promise((resolve, reject) => {
        execFile('curl', [
            '-s', '-L', '--compressed', '-m', '25',
            '-A', UA,
            '-H', 'Accept: text/html,application/xhtml+xml,*/*;q=0.8',
            '-H', 'Accept-Language: fr-FR,fr;q=0.9,en;q=0.8',
            '-H', `Referer: ${BASE}/`,
            BASE + url,
        ], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024, windowsHide: true }, (err, stdout) => {
            if (err) return reject(new Error('curl indisponible : ' + err.message));
            if (!stdout || stdout.length < 800) return reject(new Error('réponse vide (blocage anti-bot ?)'));
            resolve(stdout);
        });
    });
}
const sleepMs = (ms) => new Promise(r => setTimeout(r, ms));
async function curlGet(url) {
    let last;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try { return await curlGetOnce(url); }
        catch (e) { last = e; if (attempt < 2) await sleepMs(800); }
    }
    throw last;
}

// Messages lisibles pour les limites HTTP (audit F.15) : avant, un 429/503
// du site remontait comme une erreur axios brute qui ressemblait a un bug.
function friendlyHttpError(e) {
    const st = e && e.response && e.response.status;
    if (st === 429 || st === 503) return new Error('Source momentanement limitee - reessaie dans un instant');
    if (st) return new Error(`Site source indisponible (HTTP ${st})`);
    return e;
}

async function fetchHtml(url, ttlMs = 60_000) {
    const cached = getC(url);
    if (cached) return cached;
    let data;
    try { data = await curlGet(url); }
    catch (e) {
        try { ({ data } = await http.get(url, { responseType: 'text' })); }
        catch (e2) { throw friendlyHttpError(e2); }
    }
    setC(url, data, ttlMs);
    return data;
}

// ── Helpers ──
function slugFromUrl(url) {
    if (!url) return '';
    const m = url.match(/\/catalogue\/([^/]+)/) || url.match(/\/manga\/([^/]+)/);
    return m ? m[1] : url.split('/').filter(Boolean).pop();
}

// Titre lisible déduit du slug (la cover/le vrai titre sont affinés par getManga)
function titleFromSlug(slug) {
    return (slug || '')
        .replace(/-(scan|vf|vostfr|french|fr|colored|color|manga|manhwa|webtoon)$/i, '')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ').trim()
        .replace(/\b\w/g, c => c.toUpperCase());
}

// Statut SushiScan ("En Cours", "Terminé", "En Pause"…) → valeur normalisée Inko
function normStatus(s) {
    s = (s || '').toLowerCase();
    if (/en cours|ongoing|publishing/.test(s))     return 'ongoing';
    if (/termin|completed|fini|complete/.test(s))  return 'completed';
    if (/pause|hiatus/.test(s))                    return 'hiatus';
    if (/abandonn|annul|cancel|drop/.test(s))      return 'cancelled';
    return null;
}

// Format de série → type d'œuvre ("manga", "manhwa", "manhua", "webtoon")
function normFormat(s) {
    s = (s || '').toLowerCase();
    if (/manhwa/.test(s))  return 'manhwa';
    if (/manhua/.test(s))  return 'manhua';
    if (/webtoon/.test(s)) return 'webtoon';
    if (/comic/.test(s))   return 'comic';
    if (/manga/.test(s))   return 'manga';
    return null;
}

// Dates de chapitres → ISO (YYYY-MM-DD). Gère l'anglais ("July 13, 2025"),
// le français ("13 juillet 2025") et l'ISO. Renvoie null si illisible
// (le front préfère ne rien afficher plutôt qu'une date fausse).
const FR_MONTHS = {
    janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6,
    juillet: 7, aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11,
    decembre: 12, décembre: 12,
};
function parseChapterDate(s) {
    if (!s) return null;
    s = s.replace(/\s+/g, ' ').trim();
    if (!s) return null;
    // Déjà ISO
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    // Français : "13 juillet 2025"
    m = s.match(/(\d{1,2})\s+([a-zàâäéèêëîïôöûüç]+)\.?\s+(\d{4})/i);
    if (m) {
        const mo = FR_MONTHS[m[2].toLowerCase()];
        if (mo) return `${m[3]}-${String(mo).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
    }
    // Anglais ("July 13, 2025") et autres formats reconnus par JS.
    // On lit les composantes LOCALES (pas toISOString, qui décale d'un jour
    // selon le fuseau du serveur).
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
        const p = n => String(n).padStart(2, '0');
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    }
    return null;
}

function chapterIdFromUrl(url) {
    // URL chapitre SushiScan : https://sushiscan.fr/<slug>-chapitre-N/
    if (!url) return '';
    return url.replace(BASE, '').replace(/^\/+|\/+$/g, '');
}

function chapterNumberFromTitle(title) {
    if (!title) return null;
    const m = title.match(/chap(?:ter|itre)?\s*(\d+(?:\.\d+)?)/i)
          || title.match(/(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : null;
}

// ── Index COMPLET du catalogue (via les manga-sitemaps RankMath) ──
// Le moteur de recherche WordPress de SushiScan est désactivé : on construit
// donc un index de TOUTES les séries (id + cover + titre déduit) à partir des
// sitemaps, mis en cache 6 h. Permet de chercher dans tout le catalogue.
let _catalog = null;       // { list, byId, builtAt }
let _catalogBuilding = null;
async function buildCatalogIndex() {
    if (_catalog && Date.now() - _catalog.builtAt < 6 * 3600_000) return _catalog;
    if (_catalogBuilding) return _catalogBuilding;
    _catalogBuilding = (async () => {
        const byId = new Map();
        const ingest = (xml) => {
            if (!xml || !/<url>/.test(xml)) return false;
            for (const block of xml.split('<url>')) {
                const loc = block.match(/<loc>[^<]*\/catalogue\/([^<]+?)\/<\/loc>/);
                if (!loc) continue;
                const slug = loc[1];
                if (!slug || slug.includes('/') || byId.has(slug)) continue;
                const img = block.match(/<image:loc>([^<]+)<\/image:loc>/);
                const cover = img ? img[1].trim() : '';
                byId.set(slug, {
                    id: slug, title: titleFromSlug(slug), titleAlt: '',
                    author: '', description: '', status: null, year: null, demographic: null, tags: [],
                    cover, coverLarge: cover, coverThumb: cover,
                    contentRating: 'safe', langs: ['fr'],
                });
            }
            return true;
        };
        // La 1re sitemap confirme l'existence, puis on récupère les 2..15 EN
        // PARALLÈLE (avant : séquentiel → ~15 s, pile sur le timeout de la
        // recherche multi-sources ; désormais quelques secondes).
        try {
            const first = await fetchHtml('/manga-sitemap1.xml', 6 * 3600_000);
            ingest(first);
        } catch (e) { /* pas de sitemap : index vide, la recherche renverra 0 */ }
        const rest = await Promise.allSettled(
            Array.from({ length: 14 }, (_, k) =>
                fetchHtml(`/manga-sitemap${k + 2}.xml`, 6 * 3600_000))
        );
        rest.forEach(r => { if (r.status === 'fulfilled') ingest(r.value); });
        _catalog = { list: [...byId.values()], byId, builtAt: Date.now() };
        _catalogBuilding = null;
        return _catalog;
    })();
    return _catalogBuilding;
}

// ── Parse une grille de cartes (.bs/.bsx du thème TS) ──
// Enrichit chaque carte avec le dernier chapitre (.epxs), le statut (.status)
// et le format (.type) quand disponibles.
function parseMangaList($) {
    const byId = new Map(); // dédup par slug
    const SELECTORS = [
        '.listupd .bs',
        '.page-listing-item .bs',
        '.utao .uta',
        '.bsx',
        'article.bs',
        '.manga',
    ];
    SELECTORS.forEach(sel => $(sel).each((_, el) => {
        const $el  = $(el);
        const link = $el.find('a').first();
        const href = link.attr('href');
        if (!href || /\/page\//.test(href) || /\?/.test(href)) return;
        // SushiScan : /catalogue/<slug>/ ou /manga/<slug>/
        if (!/\/(catalogue|manga|series)\//.test(href)) return;

        const id = slugFromUrl(href);
        if (!id || byId.has(id)) return;

        const title = (link.attr('title')
                    || $el.find('.tt, .ttx, .post-title h3, .luf h4').first().text()
                    || link.text()).trim();
        if (!title) return;

        const img = $el.find('img').first();
        const cover = img.attr('data-src')
                   || img.attr('data-lazy-src')
                   || img.attr('src')
                   || '';

        // Dernier chapitre dispo sur la carte (badge ".epxs" : "Chapitre 111")
        const epxs = $el.find('.epxs').first().text().trim();
        const lastChapter = chapterNumberFromTitle(epxs);
        // Statut & format (classes/texte du badge)
        const statusRaw = ($el.find('.status').attr('class') || '') + ' ' + $el.find('.status').text();
        const typeRaw   = ($el.find('.type').attr('class') || '') + ' ' + $el.find('.type').text();

        byId.set(id, {
            id,
            title,
            titleAlt:     '',
            author:       '',
            description:  '',
            status:       normStatus(statusRaw),
            format:       normFormat(typeRaw),
            year:         null,
            tags:         [],
            lastChapter:  lastChapter,
            cover,
            coverLarge:   cover,
            coverThumb:   cover,
            contentRating: 'safe',
            langs:        ['fr'],
        });
    }));
    return [...byId.values()];
}

// ── Index des slugs adultes ──
// Tous les genres clairement adultes de SushiScan. Construit en scrapant
// TOUTES les pages de chaque genre (en parallèle), mis en cache 6h.
// Sert à la fois à masquer l'adulte du catalogue normal et à alimenter
// l'espace +18.
const ADULT_GENRES = [
    'smut', 'erotique', 'pornhwa', 'hentai', 'adulte', 'mature', 'ecchi',
];
const MAX_PAGES = 12;     // garde-fou
let _adultCache = { set: null, list: null, expires: 0 };
let _building   = null;   // promesse de build en cours (évite les builds concurrents)

async function fetchGenrePage(g, p) {
    // Les pages de taxonomie (genres) paginent via /page/N/ (≠ catalogue ?page=N)
    const url = p === 1 ? `/genres/${g}/` : `/genres/${g}/page/${p}/`;
    try {
        const html = await fetchHtml(url, 6 * 3600_000);
        return parseMangaList(cheerio.load(html));
    } catch (e) { return null; } // 404 → fin du genre
}

// Audit EXT-03 : cet index conditionne TOUT le parcours du catalogue — tant
// qu'il n'est pas prêt, on ne peut pas afficher une liste sans risquer d'y
// laisser du contenu +18 (les titres adultes du site ont des noms ordinaires,
// aucun filtre sur le slug ne les rattrape). Il était construit genre par
// genre, en série, à chaque démarrage du serveur : 17,3 s avant le premier
// affichage. Deux corrections, sans toucher au résultat produit :
//   · les 7 genres sont parcourus EN PARALLÈLE (ils sont indépendants) ;
//   · le résultat est écrit sur disque, donc un redémarrage ne le reconstruit
//     pas — c'est le cas courant, le premier build ne se paie qu'une fois
//     toutes les 6 h.
const ADULT_CACHE_FILE = require('path').join(require('os').tmpdir(), 'inko-sushiscan-adult-v1.json');
const ADULT_TTL_MS = 6 * 3600_000;

function readAdultCacheFile() {
    try {
        const fs = require('fs');
        const raw = JSON.parse(fs.readFileSync(ADULT_CACHE_FILE, 'utf8'));
        if (!raw || !Array.isArray(raw.list) || !(raw.expires > Date.now())) return null;
        return { set: new Set(raw.list.map(m => m.id)), list: raw.list, expires: raw.expires };
    } catch (e) { return null; }   // absent, illisible ou périmé → on reconstruit
}
function writeAdultCacheFile(cache) {
    try {
        require('fs').writeFileSync(ADULT_CACHE_FILE,
            JSON.stringify({ expires: cache.expires, list: cache.list }));
    } catch (e) { /* disque en lecture seule : le cache mémoire suffit */ }
}

async function collectGenre(g, add) {
    // Page 1 d'abord (pour savoir si le genre existe)
    const first = await fetchGenrePage(g, 1);
    if (!first || !first.length) return;
    add(first);
    // Pages 2..MAX par lots, on s'arrête à la 1re page vide
    for (let base = 2; base <= MAX_PAGES; base += 4) {
        const batch = await Promise.all(
            [0, 1, 2, 3].map(i => base + i <= MAX_PAGES ? fetchGenrePage(g, base + i) : Promise.resolve(null))
        );
        let stop = false;
        batch.forEach(items => {
            if (!items || !items.length) { stop = true; return; }
            add(items);
        });
        if (stop) break;
    }
}

async function buildAdultIndex() {
    if (_adultCache.set && _adultCache.expires > Date.now()) return _adultCache;
    if (_building) return _building;

    const fromDisk = readAdultCacheFile();
    if (fromDisk) { _adultCache = fromDisk; return _adultCache; }

    _building = (async () => {
        const set  = new Set();
        const list = [];
        const seen = new Set();
        // `add` est appelé depuis plusieurs genres concurrents. Node est
        // mono-thread et cette fonction ne contient aucun `await` : elle
        // s'exécute donc d'un bloc, sans entrelacement possible.
        const add = (items) => items.forEach(m => {
            set.add(m.id);
            if (!seen.has(m.id)) { seen.add(m.id); m.contentRating = 'pornographic'; list.push(m); }
        });

        // Les genres sont indépendants : rien ne justifiait de les enchaîner.
        // allSettled et non all — un genre qui échoue ne doit pas vider
        // l'index et faire disparaître le filtrage pour tous les autres.
        await Promise.allSettled(ADULT_GENRES.map(g => collectGenre(g, add)));

        _adultCache = { set, list, expires: Date.now() + ADULT_TTL_MS };
        writeAdultCacheFile(_adultCache);
        _building = null;
        return _adultCache;
    })();
    return _building;
}

// Audit EXT-03 : il existait ici un filtre de repli non bloquant
// (`peekAdultIndex` + `ADULT_SLUG_RE` + `looksAdult`) censé masquer le contenu
// adulte par mot-clé de slug tant que l'index n'était pas construit.
// Supprimé, car il ne protégeait pas : mesuré sur les 24 premiers résultats du
// catalogue, 15 titres +18 passaient au travers. Les séries adultes de
// SushiScan s'appellent « arretez-la », « just-friends », « sous-hypnose » —
// il n'y a rien à reconnaître dans le slug.
//
// Le laisser en place aurait été pire que rien : du code qui RESSEMBLE à une
// protection invite à s'y fier. Les deux chemins concernés (parcours du
// catalogue et recherche) attendent désormais le véritable index, dont le coût
// a été ramené de 17,3 s à ~6,6 s au premier build, puis à zéro grâce au cache
// disque de 6 h.
const isAdultFlag = (a) => a === 'only' || a === '1' || a === 'all' || a === true;

// ── Source export ──
module.exports = {
    id:           'sushiscan',
    name:         'SushiScan',
    lang:         'fr',
    baseUrl:      BASE,
    nsfw:         false,
    // 1.0.0 (audit EXT-03) : c'était la seule source restée sous 1.0, et le
    // numéro était mérité — le parcours du catalogue bloquait 17 s au premier
    // appel, un catalogue injoignable se présentait comme un catalogue vide, et
    // le filtre +18 de repli laissait passer 15 titres sur 24. Les trois sont
    // traités et la chaîne complète est vérifiée bout en bout (populaires,
    // dernières sorties, recherche, fiche, chapitres, pages).
    // Le site reste scrapé derrière Cloudflare : la source dépend d'un HTML
    // tiers qui peut changer sans préavis. C'est la nature de la source, pas un
    // défaut à corriger.
    version:      '1.0.0',
    unit:      'chapter',
    description:  '⚠ Expérimental — scrape sushiscan.fr (Madara/TS). Populaires & dernières sorties distinctes, dates de sortie des chapitres, recherche sur tout le catalogue, contenu adulte filtré hors espace +18.',
    capabilities: ['popular', 'latest', 'search', 'manga', 'chapters', 'pages'],

    // Pré-chauffage : construit l'index du catalogue en arrière-plan dès le
    // démarrage, pour que la 1re recherche soit instantanée (avant, le build
    // à froid ~15 s tombait pile sur le timeout de la recherche multi-sources).
    async warmup() {
        try { await Promise.all([buildCatalogIndex(), buildAdultIndex()]); } catch (e) {}
    },

    // Catalogue trié & paginé : SushiScan accepte ?order=popular|update|title
    // et pagine via ?page=N (PAS /page/N/ qui renvoie toujours la 1re page).
    // - popular → ?order=popular  (les plus lues)
    // - latest  → ?order=update   (dernières mises à jour)
    async _browse(order, { limit = 24, offset = 0, adult } = {}) {
        // +18 : on sert l'index adulte (déjà trié par genre)
        if (isAdultFlag(adult)) {
            const idx = await buildAdultIndex();
            const off = +offset || 0;
            return { total: idx.list.length, results: idx.list.slice(off, off + (+limit || 24)) };
        }
        // Audit EXT-03 : le parcours du catalogue ATTEND l'index adulte, et
        // c'est volontaire. Tenté puis REJETÉ : servir un repli instantané
        // (peekAdultIndex + filtre sur le slug) le temps que l'index se
        // construise. Mesuré sur les 24 premiers résultats de `popular`,
        // 15 titres +18 passaient au travers — les titres adultes de SushiScan
        // s'appellent « arretez-la », « just-friends », « sous-hypnose », donc
        // aucun motif de slug ne les distingue. On échangeait une attente
        // contre du contenu pornographique sur la page d'accueil.
        //
        // L'attente est donc conservée, et c'est le COÛT de l'index qui a été
        // traité : genres construits en parallèle et cache persisté sur disque
        // (voir buildAdultIndex).
        const idx = await buildAdultIndex();
        const isAdultItem = (m) => idx.set.has(m.id);
        const lim = +limit || 24;
        const off = +offset || 0;
        const ord = order === 'popular' ? 'popular' : 'update';
        // Audit N-EXT-12 : le retrait du contenu adulte APRÈS récupération
        // laissait des pages incomplètes (déficit erratique selon la proportion
        // +18 de la page du site). On boucle désormais sur les pages suivantes
        // pour combler le déficit, garde-fou de 4 requêtes par appel. La
        // correspondance offset→page du site reste approximative (le site ne
        // sépare pas le contenu adulte en amont) : de rares doublons entre
        // pages consécutives sont possibles, mais chaque page rend désormais
        // le nombre demandé.
        let page = Math.floor(off / lim) + 1;
        const seen = new Set();
        const sfw  = [];
        let sawItems = false;
        for (let n = 0; n < 4 && sfw.length < lim; n++, page++) {
            const qp = `order=${ord}` + (page > 1 ? `&page=${page}` : '');
            let items = [];
            try { items = parseMangaList(cheerio.load(await fetchHtml(`/catalogue/?${qp}`, 300_000))); }
            catch (e) {
                // Audit EXT-03 : ce catch était vide. Site injoignable, blocage
                // Cloudflare, cheerio absent — tout finissait en `results: []`,
                // que l'interface affiche « aucun résultat ». Indiscernable d'un
                // catalogue vide : l'utilisateur croyait la source sans contenu
                // au lieu de savoir qu'elle est en panne, et personne ne pouvait
                // diagnostiquer.
                // Sur la PREMIÈRE page on remonte l'erreur ; sur les suivantes on
                // continue avec ce qu'on a déjà (le déficit est comblé au mieux).
                if (n === 0) throw friendlyHttpError(e);
                break;
            }
            if (!items.length) break;   // fin réelle du catalogue (ou site HS)
            sawItems = true;
            items.forEach(m => { if (!isAdultItem(m) && !seen.has(m.id)) { seen.add(m.id); sfw.push(m); } });
        }
        // Pas d'items du tout → au-delà de la dernière page : total = position
        // réelle. Sinon : total généreux pour garder « page suivante » actif.
        const total = sawItems ? Math.max(off + 480, 1000) : off;
        return { total, results: sfw.slice(0, lim) };
    },

    async popular(opts = {}) { requireCheerio(); return this._browse('popular', opts); },
    async latest(opts = {})  { requireCheerio(); return this._browse('latest', opts); },

    async search({ q, limit = 20, offset = 0, filters = {} } = {}) {
        requireCheerio();
        const adult = filters.adult;
        if (!q) {
            const sort = (filters && filters.sort) || '';
            if (/latest|updat|nouveau|added|recent|new/i.test(sort)) return this.latest({ limit, offset, adult });
            return this.popular({ limit, offset, adult });
        }

        // Recherche dans l'index complet du catalogue (le moteur du site est HS).
        // On normalise (sans accents/tirets) pour matcher « arslan senki », etc.
        const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
        const terms = norm(q).split(' ').filter(Boolean);
        let list = [];
        try {
            const cat = await buildCatalogIndex();
            list = cat.list.filter(m => {
                const hay = norm(m.id) + ' ' + norm(m.title);
                return terms.every(t => hay.includes(t));
            });
        } catch (e) { list = []; }

        if (isAdultFlag(adult)) {
            // Espace +18 explicite : on attend l'index adulte (l'utilisateur
            // le demande), mais borné pour ne pas bloquer indéfiniment.
            const idx = await buildAdultIndex();
            list = list.filter(m => idx.set.has(m.id)).map(m => ({ ...m, contentRating: 'pornographic' }));
        } else {
            // Audit EXT-03 : cette branche se repliait sur `looksAdult` (motif
            // de slug) quand l'index n'était pas prêt, pour rester rapide.
            // Mesuré : sur les 24 premiers résultats du catalogue, ce repli
            // laissait passer 15 titres +18 — « arretez-la », « just-friends »,
            // « sous-hypnose »… aucun mot-clé ne les distingue. Le filtrage ne
            // tenait donc qu'à une course entre deux index, gagnée « en
            // général ». Ce n'est pas un critère acceptable pour du contenu
            // pornographique.
            //
            // On attend l'index, comme le parcours du catalogue. Le coût est
            // borné : il est désormais construit en parallèle et persisté sur
            // disque, donc payé une fois toutes les 6 h et non à chaque
            // démarrage. La recherche à chaud reste à ~250 ms.
            const idx = await buildAdultIndex();
            list = list.filter(m => !idx.set.has(m.id));
        }
        // Tri : les correspondances en début de titre d'abord
        const qn = norm(q);
        list.sort((a, b) => (norm(b.title).startsWith(qn) ? 1 : 0) - (norm(a.title).startsWith(qn) ? 1 : 0));
        const off = +offset || 0;
        return { total: list.length, results: list.slice(off, off + (+limit || 20)) };
    },

    async getManga(id) {
        requireCheerio();
        const url  = `/catalogue/${id}/`;
        const html = await fetchHtml(url, 300_000);
        const $    = cheerio.load(html);

        const og = (p) => $(`meta[property="og:${p}"]`).attr('content') || '';

        const title = ($('.entry-title, .post-title h1').first().text().trim())
                   || og('title').replace(/\s*(Scan|VF|FR|Gratuit)\b.*$/i, '').trim()
                   || titleFromSlug(id);
        const cover = $('.thumb img, .summary_image img, .seriestucontent img, .infomanga img').attr('data-src')
                   || $('.thumb img, .summary_image img, .seriestucontent img, .infomanga img').attr('src')
                   || og('image') || '';
        const description = ($('.entry-content[itemprop="description"], .summary__content, [itemprop="description"]').first().text() || '')
                   .replace(/\s+/g, ' ').trim()
                   || og('description');

        // Thème Madara/TS : table.infotable (Statut / Type / Sortie / Auteur / Dessinateur / Prépublication)
        const info = {};
        $('.infotable tr').each((_, tr) => {
            const k = $(tr).find('td').eq(0).text().replace(/\s+/g, ' ').trim().toLowerCase();
            const v = $(tr).find('td').eq(1).text().replace(/\s+/g, ' ').trim();
            if (k) info[k] = v;
        });
        const author = info['auteur'] || info['dessinateur'] || '';
        const yearM  = (info['sortie'] || info['année'] || '').match(/(\d{4})/);
        const statusNorm = normStatus(info['statut']);
        const format     = normFormat(info['type']);

        const tags = $('.seriestugenre a, .wd-full .mgen a, .mgen a, .gnr a').map((_, el) => $(el).text().trim()).get().filter(Boolean);
        const DEMOS = ['shounen', 'seinen', 'shoujo', 'josei'];
        const demographic = (tags.find(t => DEMOS.includes(t.toLowerCase())) || '').toLowerCase() || null;

        return {
            id, title, titleAlt: '',
            author, description,
            status: statusNorm,
            format,
            year: yearM ? parseInt(yearM[1]) : null,
            demographic,
            tags,
            cover, coverLarge: cover, coverThumb: cover,
            contentRating: 'safe', langs: ['fr'],
        };
    },

    async getChapters(id, { limit } = {}) {
        requireCheerio();
        const url  = `/catalogue/${id}/`;
        const html = await fetchHtml(url, 60_000);
        const $    = cheerio.load(html);

        const chapters = [];
        $('.eplister li, .wp-manga-chapter').each((_, el) => {
            const $el = $(el);
            const a   = $el.find('a').first();
            const href = a.attr('href');
            if (!href) return;
            const titleText = $el.find('.chapternum').text().trim() || a.text().trim();
            const dateText  = $el.find('.chapterdate, .chapter-release-date').text().trim();
            const num = chapterNumberFromTitle(titleText);
            if (num === null) return;   // ignore le gabarit Madara "Chapitre {{number}}"
            chapters.push({
                id:           chapterIdFromUrl(href),
                chapter:      num,
                volume:       null,
                title:        titleText.replace(/^Chap(?:ter|itre)?\s*\d+(?:\.\d+)?\s*[:\-]?\s*/i, '').trim() || null,
                lang:         'fr',
                pages:        0,
                publishedAt:  parseChapterDate(dateText),
            });
        });

        chapters.sort((a, b) => b.chapter - a.chapter);
        // Liste complète par défaut ; tronque seulement si une limite est demandée
        return { total: chapters.length, results: limit && +limit < chapters.length ? chapters.slice(0, +limit) : chapters };
    },

    async getPages(chapterId) {
        requireCheerio();
        const url  = chapterId.startsWith('http') ? chapterId : '/' + chapterId.replace(/^\/+/, '');
        const html = await fetchHtml(url, 5 * 60_000);

        // Ignore les images d'UI/branding qui peuvent traîner dans la page
        const isJunk = (u) => !u || /(\/social\.|logo|placeholder|loading|banner|sushiscan\.fr\/wp-content\/uploads\/\d{4}\/\d{2}\/social)/i.test(u);

        let pages = [];

        // 1) SushiScan/TS : ts_reader.run({ sources: [{ images: [...] }] }) — source autoritaire
        const m = html.match(/ts_reader\.run\(({[\s\S]*?})\);?\s*<\/script>/) || html.match(/ts_reader\.run\(({[\s\S]*?})\);?/);
        if (m) {
            try {
                const data = JSON.parse(m[1]);
                const imgs = (data && data.sources && data.sources[0] && data.sources[0].images) || (data && data.images) || [];
                pages = imgs.filter(u => !isJunk(u)).map((u, i) => ({ page: i + 1, url: String(u).trim(), urlSaver: null }));
            } catch (e) {}
        }

        // 2) Repli Madara : <div id="readerarea"><img src|data-src="..."></div>
        if (!pages.length) {
            const $ = cheerio.load(html);
            $('#readerarea img, .reading-content img').each((_, el) => {
                const src = ($(el).attr('data-src') || $(el).attr('src') || '').trim();
                if (src && !isJunk(src)) pages.push({ page: pages.length + 1, url: src, urlSaver: null });
            });
        }

        return { baseUrl: '', hash: '', pages };
    },
};

// ── Warm-up : construit l'index adulte en arrière-plan au démarrage ──
// Ainsi le filtrage est prêt avant la 1re navigation de l'utilisateur.
if (cheerio) {
    buildAdultIndex()
        .then(idx => console.log(`[sushiscan] index adulte prêt : ${idx.set.size} titres masqués`))
        .catch(() => {});
}
