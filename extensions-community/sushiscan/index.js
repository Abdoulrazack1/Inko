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

// ── Source export ──
module.exports = {
    id:           'sushiscan',
    name:         'SushiScan',
    lang:         'fr',
    baseUrl:      BASE,
    nsfw:         false,
    version:      '0.1.0-experimental',
    description:  '⚠ Expérimental — scrape sushiscan.fr (Madara). Peut casser à tout moment, Cloudflare actif.',
    capabilities: ['popular', 'latest', 'search', 'manga', 'chapters', 'pages'],

    async popular({ limit = 20, offset = 0 } = {}) {
        requireCheerio();
        const page = Math.floor((+offset || 0) / 20) + 1;
        const url  = page > 1 ? `/catalogue/page/${page}/?order=popular` : '/catalogue/?order=popular';
        const html = await fetchHtml(url, 600_000);
        const $    = cheerio.load(html);
        const list = parseMangaList($).slice(0, +limit || 20);
        return { total: list.length, results: list };
    },

    async latest({ limit = 20, offset = 0 } = {}) {
        requireCheerio();
        const page = Math.floor((+offset || 0) / 20) + 1;
        const url  = page > 1 ? `/catalogue/page/${page}/?order=latest` : '/catalogue/?order=latest';
        const html = await fetchHtml(url, 300_000);
        const $    = cheerio.load(html);
        const list = parseMangaList($).slice(0, +limit || 20);
        return { total: list.length, results: list };
    },

    async search({ q, limit = 20, offset = 0 } = {}) {
        requireCheerio();
        if (!q) return this.popular({ limit, offset });
        const url  = `/?s=${encodeURIComponent(q)}`;
        const html = await fetchHtml(url, 120_000);
        const $    = cheerio.load(html);
        const list = parseMangaList($).slice(+offset || 0, (+offset || 0) + (+limit || 20));
        return { total: list.length, results: list };
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

    async getChapters(id, { limit = 500 } = {}) {
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
        return { total: chapters.length, results: chapters.slice(0, +limit || 500) };
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
