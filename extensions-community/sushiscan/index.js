// ============================================================
// SushiScan — extension Inko (modèle Mihon)
// ============================================================
// ⚠ Extension communautaire, fournie sans garantie. Scrape l'HTML
// de sushiscan.fr (thème Madara). Le site change régulièrement,
// utilise Cloudflare et peut bloquer les requêtes serveur.
//
// Pré-requis : `npm install cheerio` dans le dossier server/
// ============================================================
const axios = require('axios');

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

async function fetchHtml(url, ttlMs = 60_000) {
    const cached = getC(url);
    if (cached) return cached;
    const { data } = await http.get(url, { responseType: 'text' });
    setC(url, data, ttlMs);
    return data;
}

// ── Mappers ──
function slugFromUrl(url) {
    if (!url) return '';
    const m = url.match(/\/catalogue\/([^/]+)/) || url.match(/\/manga\/([^/]+)/);
    return m ? m[1] : url.split('/').filter(Boolean).pop();
}

function chapterIdFromUrl(url) {
    // URL chapter SushiScan : https://sushiscan.fr/manga-slug-chapter-N/
    if (!url) return '';
    return url.replace(BASE, '').replace(/^\/+|\/+$/g, '');
}

function chapterNumberFromTitle(title) {
    if (!title) return null;
    const m = title.match(/chap(?:ter|itre)?\s*(\d+(?:\.\d+)?)/i)
          || title.match(/(\d+(?:\.\d+)?)/);
    return m ? parseFloat(m[1]) : null;
}

function parseMangaList($) {
    const byId = new Map(); // dédup par slug
    // Sélecteurs Madara typiques. Ordre par priorité décroissante de précision.
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

        byId.set(id, {
            id,
            title,
            titleAlt:     '',
            author:       '',
            description:  '',
            status:       null,
            year:         null,
            tags:         [],
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

async function buildAdultIndex() {
    if (_adultCache.set && _adultCache.expires > Date.now()) return _adultCache;
    if (_building) return _building;

    _building = (async () => {
        const set  = new Set();
        const list = [];
        const seen = new Set();
        const add = (items) => items.forEach(m => {
            set.add(m.id);
            if (!seen.has(m.id)) { seen.add(m.id); m.contentRating = 'pornographic'; list.push(m); }
        });

        for (const g of ADULT_GENRES) {
            // Page 1 d'abord (pour savoir si le genre existe)
            const first = await fetchGenrePage(g, 1);
            if (!first || !first.length) continue;
            add(first);
            // Pages 2..MAX en parallèle, on s'arrête à la 1re page vide
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
        _adultCache = { set, list, expires: Date.now() + 6 * 3600_000 };
        _building = null;
        return _adultCache;
    })();
    return _building;
}

const isAdultFlag = (a) => a === 'only' || a === '1' || a === 'all' || a === true;

// ── Source export ──
module.exports = {
    id:           'sushiscan',
    name:         'SushiScan',
    lang:         'fr',
    baseUrl:      BASE,
    nsfw:         false,
    version:      '0.3.0-experimental',
    description:  '⚠ Expérimental — scrape sushiscan.fr (Madara). Catalogue paginé complet, contenu adulte filtré hors espace +18.',
    capabilities: ['popular', 'latest', 'search', 'manga', 'chapters', 'pages'],

    // Catalogue paginé : on mappe (offset/limit) sur la page native SushiScan
    // (~30 items/page). On retourne un total généreux pour permettre une
    // navigation profonde dans tout le catalogue.
    async _browse(order, { limit = 24, offset = 0, adult } = {}) {
        // +18 : on sert l'index adulte
        if (isAdultFlag(adult)) {
            const idx = await buildAdultIndex();
            const off = +offset || 0;
            return { total: idx.list.length, results: idx.list.slice(off, off + (+limit || 24)) };
        }
        const idx  = await buildAdultIndex();
        const page = Math.floor((+offset || 0) / (+limit || 24)) + 1;
        // SushiScan pagine via ?page=N (PAS /page/N/ qui renvoie toujours la 1re).
        const url  = page > 1 ? `/catalogue/?page=${page}` : `/catalogue/`;
        let items  = [];
        try { items = parseMangaList(cheerio.load(await fetchHtml(url, 300_000))); }
        catch (e) {}
        const sfw = items.filter(m => !idx.set.has(m.id));
        // Pas d'items → on est au-delà de la dernière page : total = position réelle.
        // Sinon : total généreux pour garder le bouton "page suivante" actif.
        const total = items.length ? Math.max((+offset || 0) + 480, 1000) : (+offset || 0);
        return { total, results: sfw };
    },

    async popular(opts = {}) { requireCheerio(); return this._browse('popular', opts); },
    async latest(opts = {})  { requireCheerio(); return this._browse('latest', opts); },

    async search({ q, limit = 20, offset = 0, filters = {} } = {}) {
        requireCheerio();
        const adult = filters.adult;
        if (!q) return this.popular({ limit, offset, adult });
        const url  = `/?s=${encodeURIComponent(q)}`;
        const html = await fetchHtml(url, 120_000);
        let list   = parseMangaList(cheerio.load(html));

        const idx = await buildAdultIndex();
        if (isAdultFlag(adult)) {
            // +18 : ne garder QUE l'adulte
            list = list.filter(m => idx.set.has(m.id)).map(m => ({ ...m, contentRating: 'pornographic' }));
        } else {
            // SFW : retirer l'adulte
            list = list.filter(m => !idx.set.has(m.id));
        }
        const off = +offset || 0;
        return { total: list.length, results: list.slice(off, off + (+limit || 20)) };
    },

    async getManga(id) {
        requireCheerio();
        const url  = `/catalogue/${id}/`;
        const html = await fetchHtml(url, 300_000);
        const $    = cheerio.load(html);

        const title = $('.entry-title, .post-title h1').first().text().trim();
        const cover = $('.thumb img, .summary_image img').attr('data-src')
                   || $('.thumb img, .summary_image img').attr('src');
        const description = $('.entry-content[itemprop="description"], .summary__content p').text().trim();
        const author = $('.author-content a, .info-content .imptdt:contains("Auteur") + .imptdt').text().trim();
        const status = ($('.post-status .post-content_item:contains("Statut") .summary-content, .imptdt:contains("Statut") i').text().trim() || '').toLowerCase();
        const tags = $('.mgen a, .wd-full a[rel="tag"]').map((_, el) => $(el).text().trim()).get();

        let statusNorm = null;
        if (/en cours|ongoing/i.test(status))      statusNorm = 'ongoing';
        else if (/terminé|completed/i.test(status))statusNorm = 'completed';
        else if (/pause|hiatus/i.test(status))     statusNorm = 'hiatus';

        return {
            id,
            title,
            titleAlt:     '',
            author,
            description,
            status:       statusNorm,
            year:         null,
            demographic:  null,
            tags,
            cover,
            coverLarge:   cover,
            coverThumb:   cover,
            contentRating: 'safe',
            langs:        ['fr'],
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
            if (num === null) return;
            chapters.push({
                id:           chapterIdFromUrl(href),
                chapter:      num,
                volume:       null,
                title:        titleText.replace(/^Chap(?:ter|itre)?\s*\d+(?:\.\d+)?\s*[:\-]?\s*/i, '').trim() || null,
                lang:         'fr',
                pages:        0,
                publishedAt:  dateText || null,
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
        const $    = cheerio.load(html);

        let pages = [];

        // 1) Madara : <div id="readerarea"><img src="..."> ou data-src
        $('#readerarea img, .reading-content img').each((i, el) => {
            const src = $(el).attr('data-src') || $(el).attr('src');
            if (src) pages.push({ page: pages.length + 1, url: src.trim(), urlSaver: null });
        });

        // 2) SushiScan custom : ts_reader.run({ sources: [{ images: [...] }] })
        if (!pages.length) {
            const m = html.match(/ts_reader\.run\(({[\s\S]*?})\);?/);
            if (m) {
                try {
                    const data = JSON.parse(m[1]);
                    const imgs = (data?.sources?.[0]?.images) || data?.images || [];
                    pages = imgs.map((u, i) => ({ page: i + 1, url: u, urlSaver: null }));
                } catch (e) {}
            }
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
