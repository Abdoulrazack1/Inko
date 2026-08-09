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

// Messages lisibles pour les limites HTTP (audit F.15) : avant, un 429/503
// du site remontait comme une erreur axios brute qui ressemblait a un bug.
function friendlyHttpError(e) {
    const st = e && e.response && e.response.status;
    if (st === 429 || st === 503) return new Error('Source momentanement limitee - reessaie dans un instant');
    if (st) return new Error(`Site source indisponible (HTTP ${st})`);
    return e;
}

// Audit EXT-04 : aucun reessai. Un scan de bibliotheque enchaine des dizaines
// de requetes sur un site scrape : un hoquet reseau isole faisait echouer toute
// la serie et remontait comme une source cassee. On ne reessaie QUE ce qui est
// transitoire (reseau, 5xx, 429), jamais un 404/403 qui ne changera pas.
function isTransient(e) {
    const s = e && e.response && e.response.status;
    if (s) return s === 429 || (s >= 500 && s <= 599);
    return true;   // pas de reponse : DNS, timeout, connexion coupee
}
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchHtml(url, ttl = 120_000) {
    const c = getC(url);
    if (c) return c;
    let data, lastErr;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try { ({ data } = await http.get(url, { responseType: 'text' })); lastErr = null; break; }
        catch (e) {
            lastErr = e;
            if (attempt === 2 || !isTransient(e)) break;
            await sleep(700);
        }
    }
    if (lastErr) throw friendlyHttpError(lastErr);
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

// Pagination WordPress : ~10-12 œuvres / page de catégorie. On boucle sur les
// pages du site jusqu'à réunir `limit` résultats (audit N-EXT-13 : une seule
// page de 12 laissait la moitié de la grille Catalogue vide — la source la
// plus pénalisée), garde-fou de 5 requêtes par appel.
const MAX_PAGES = 5;
async function browse(pathBase, { limit = 20, offset = 0 } = {}, ttl, perPage = 12) {
    requireCheerio();
    const off = Math.max(0, +offset || 0);
    const lim = Math.max(1, +limit || 20);
    let page  = Math.floor(off / perPage) + 1;
    let skip  = off % perPage;           // entrées déjà servies sur la 1re page
    const seen = new Set();
    const acc  = [];
    let siteExhausted = false;
    for (let n = 0; n < MAX_PAGES && acc.length < lim; n++, page++) {
        const url = page > 1 ? `${pathBase}page/${page}/` : pathBase;
        const results = parseList(cheerio.load(await fetchHtml(url, ttl)));
        results.slice(skip).forEach(m => { if (!seen.has(m.id)) { seen.add(m.id); acc.push(m); } });
        skip = 0;
        if (results.length < perPage) { siteExhausted = true; break; }
    }
    const total = off + acc.length + (siteExhausted ? 0 : perPage);
    return { total, results: acc.slice(0, lim) };
}

function sanitizeChapterHtml($, root) {
    root.find('script, style, iframe, form, input, button, base, object, embed, ins, [class*="adsbygoogle"], .code-block').remove();
    root.find('*').each((_, el) => {
        const attribs = el.attribs || {};
        Object.keys(attribs).forEach(name => {
            if (/^on/i.test(name) || name === 'style' || name === 'class' || name === 'id') delete el.attribs[name];
        });
        // Audit S4 : neutralise les URLs javascript:/data:/vbscript: sur les
        // attributs de navigation — un lien piégé dans le texte du chapitre
        // exécutait du JS au clic dans le lecteur.
        ['href', 'src', 'xlink:href', 'action', 'formaction'].forEach(a => {
            const v = el.attribs && el.attribs[a];
            const clean = String(v).split('').filter(ch => ch.charCodeAt(0) > 32).join('');
            if (/^(javascript|data|vbscript):/i.test(clean)) delete el.attribs[a];
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
    version:      '1.2.2',
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
            // Étiquettes informatives, PAS des genres (audit N-EXT-7/N15) :
            // vérifié sur le site (juil. 2026), les fiches Chireads n'exposent
            // aucune donnée de genre/thème à extraire — seules les catégories
            // WordPress original/translatedtales existent. L'extension ne
            // déclare pas la capacité 'tags', donc pas de filtre Genres ici.
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
