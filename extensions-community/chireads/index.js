// ============================================================
// Chireads — extension Inko (source de ROMANS traduits FR, type 'novel')
// ============================================================
// ⚠ Extension communautaire. Scrape chireads.com : traductions
// FRANÇAISES de novels chinois (fantrad). WordPress.
// Structure :
//   - liste     : /category/translatedtales/ (+ /page/N/)
//   - recherche : /search?x=0&y=0&name=…
//   - œuvre     : /category/translatedtales/<slug>/
//                 (h3.inform-title, .inform-product img, .inform-txt-show,
//                  chapitres COMPLETS dans .chapitre-table ul li a)
//   - chapitre  : /translatedtales/<slug>/<chapitre-slug>/<yyyy>/<mm>/<jj>/
//                 (texte dans #content.article-font)
//
// IDs : œuvre = slug ; chapitre = chemin après /translatedtales/
// (ex. "<slug>/chapitre-1-…/2026/03/03") — ≤191, compatible DB.
// ============================================================
const axios = require('axios');

let cheerio = null;
try { cheerio = require('cheerio'); }
catch (e) { console.warn('[chireads] cheerio manquant — `cd server && npm install cheerio`'); }

const BASE = 'https://chireads.com';
const UA   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const http = axios.create({
    baseURL: BASE,
    timeout: 20_000,
    maxRedirects: 5,
    headers: {
        'User-Agent':      UA,
        'Accept':          'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
    },
});

// ── Cache mémoire ──
const cache = new Map();
function getC(k) { const e = cache.get(k); if (!e) return null; if (e.expires < Date.now()) { cache.delete(k); return null; } return e.value; }
function setC(k, v, ms) { cache.set(k, { value: v, expires: Date.now() + ms }); }

function requireCheerio() { if (!cheerio) throw new Error('cheerio non installé — `cd server && npm install cheerio`'); }

async function fetchHtml(url, ttl = 120_000) {
    const c = getC(url);
    if (c) return c;
    const { data } = await http.get(url, { responseType: 'text' });
    setC(url, data, ttl);
    return data;
}

// ── Helpers ──
function slugFromNovelUrl(url) {
    const m = (url || '').match(/\/category\/translatedtales\/([^/]+)\/?/);
    return m ? m[1] : null;
}
function chapterIdFromUrl(url) {
    // https://chireads.com/translatedtales/<slug>/<chap>/<yyyy>/<mm>/<jj>/ → tout après /translatedtales/
    const m = (url || '').match(/\/translatedtales\/(.+?)\/?$/);
    return m ? m[1] : null;
}

// Parse un listing (.news-list ul li)
function parseList($) {
    const out = [];
    $('.news-list li').each((_, el) => {
        const $el = $(el);
        const a = $el.find('.news-list-tit a, h5 a').first();
        const id = slugFromNovelUrl(a.attr('href'));
        if (!id) return;
        const cover = $el.find('.news-list-img img').attr('src') || '';
        out.push({
            id,
            title:  (a.attr('title') || a.text()).replace(/\s+/g, ' ').trim(),
            titleAlt: '',
            author: '',
            description: $el.find('.news-list-txt').text().replace(/\s+/g, ' ').trim().slice(0, 400),
            status: null, year: null, demographic: null,
            tags: [],
            cover, coverLarge: cover, coverThumb: cover,
            contentRating: 'safe', langs: ['fr'],
        });
    });
    return out;
}

// Pagination WordPress : ~10-12 œuvres / page de catégorie
async function browse(pathBase, { limit = 20, offset = 0 } = {}, ttl, perPage = 12) {
    requireCheerio();
    const page = Math.floor((+offset || 0) / perPage) + 1;
    const url = page > 1 ? `${pathBase}page/${page}/` : pathBase;
    const html = await fetchHtml(url, ttl);
    const results = parseList(cheerio.load(html));
    const off = +offset || 0;
    const total = results.length < perPage ? off + results.length : off + results.length + perPage;
    return { total, results: results.slice(0, +limit || 20) };
}

function sanitizeChapterHtml($, root) {
    root.find('script, style, iframe, form, input, button, ins, [class*="adsbygoogle"], .code-block').remove();
    root.find('*').each((_, el) => {
        const attribs = el.attribs || {};
        Object.keys(attribs).forEach(name => {
            if (/^on/i.test(name) || name === 'style' || name === 'class' || name === 'id') delete el.attribs[name];
        });
    });
    return root.html() || '';
}

// ── Source export ──
module.exports = {
    id:           'chireads',
    name:         'Chireads',
    lang:         'fr',
    baseUrl:      BASE,
    nsfw:         false,
    version:      '1.2.0',
    unit:      'chapter',
    type:         'novel',
    description:  'Chireads — novels chinois traduits en FRANÇAIS par des équipes de fantrad (xianxia, romance, intrigue). Lecture en texte.',
    capabilities: ['popular', 'latest', 'search', 'manga', 'chapters', 'text'],

    async popular(opts = {}) {
        return browse('/category/translatedtales/', opts, 600_000);
    },

    async latest(opts = {}) {
        // La catégorie est triée par dernière publication : même flux
        return browse('/category/translatedtales/', opts, 120_000);
    },

    async search({ q, limit = 20, offset = 0, filters = {} } = {}) {
        requireCheerio();
        if (!q) {
            // Navigation sans recherche : on respecte le TRI choisi (issue #1)
            const sort = (filters && filters.sort) || '';
            if (/latest|updat|nouveau|added|recent|new/i.test(sort)) return this.latest({ limit, offset });
            return this.popular({ limit, offset });
        }
        const html = await fetchHtml(`/search?x=0&y=0&name=${encodeURIComponent(q)}`, 120_000);
        const results = parseList(cheerio.load(html));
        return { total: results.length, results: results.slice(0, +limit || 20) };
    },

    async getManga(id) {
        requireCheerio();
        const html = await fetchHtml(`/category/translatedtales/${id}/`, 300_000);
        const $ = cheerio.load(html);

        const title = $('h3.inform-title').first().text().replace(/\s+/g, ' ').trim();
        const meta  = $('.inform-inform-data h6').first().text();
        const authorM = meta.match(/Auteur\s*:\s*([^|]+?)(?:Fantrad|Statut|$)/);
        const description = $('.inform-txt-show').first().text().replace(/\s+/g, ' ').trim();
        const cover = $('.inform-product img').attr('src') || '';
        // Statut de parution : texte libre ("1 chapitre le mercredi", "Terminé"…)
        let status = 'ongoing';
        if (/termin|complet|fini/i.test(meta)) status = 'completed';

        return {
            id, title, titleAlt: '', author: authorM ? authorM[1].replace(/ /g, ' ').trim() : '',
            description, status, year: null, demographic: null,
            tags: ['Novel chinois', 'Fantrad FR'],
            cover, coverLarge: cover, coverThumb: cover,
            contentRating: 'safe', langs: ['fr'],
        };
    },

    // La page de l'œuvre contient la liste complète (table repliée)
    async getChapters(id, { limit } = {}) {
        requireCheerio();
        const html = await fetchHtml(`/category/translatedtales/${id}/`, 120_000);
        const $ = cheerio.load(html);
        const out = [];
        const seen = new Set();
        $('.chapitre-table a, .chapitre a[href*="/translatedtales/"]').each((_, a) => {
            const href = $(a).attr('href') || '';
            const cid = chapterIdFromUrl(href);
            if (!cid || !cid.startsWith(id + '/') || seen.has(cid)) return;
            seen.add(cid);
            const label = ($(a).attr('title') || $(a).text()).replace(/\s+/g, ' ').trim();
            const numM = label.match(/chapitre\s*([\d.]+)/i);
            out.push({
                id:          cid,
                chapter:     numM ? parseFloat(numM[1]) : (out.length + 1),
                volume:      null,
                title:       label || null,
                lang:        'fr',
                pages:       0,
                publishedAt: (cid.match(/(\d{4})\/(\d{2})\/(\d{2})$/) || []).slice(1).join('-') || null,
            });
        });
        out.sort((a, b) => b.chapter - a.chapter);
        return { total: out.length, results: limit && +limit < out.length ? out.slice(0, +limit) : out };
    },

    async getPages() {
        throw new Error('Chireads est une source de romans : utiliser getText()');
    },

    async getText(chapterId) {
        requireCheerio();
        const html = await fetchHtml(`/translatedtales/${chapterId}/`, 10 * 60_000);
        const $ = cheerio.load(html);
        // La page contient PLUSIEURS blocs #content.article-font (texte du
        // chapitre + pied de page Discord) : on garde le plus fourni.
        let root = null, best = 0;
        $('#content, .article-font').each((_, el) => {
            const len = $(el).text().trim().length;
            if (len > best) { best = len; root = $(el); }
        });
        if (!root || best < 50) throw new Error('Contenu du chapitre introuvable');
        const title = ($('meta[property="og:title"]').attr('content') || '').trim() || null;
        const content = sanitizeChapterHtml($, root);
        return { title, content };
    },
};
