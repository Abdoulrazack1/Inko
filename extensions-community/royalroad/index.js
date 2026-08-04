// ============================================================
// Royal Road — extension Inko (source de ROMANS, type 'novel')
// ============================================================
// ⚠ Extension communautaire. Scrape royalroad.com (web novels EN).
// Structure :
//   - listes    : /fictions/best-rated, /fictions/latest-updates (20/page)
//   - recherche : /fictions/search?title=…
//   - fiction   : /fiction/<id>            (titre, tags, desc, chapitres)
//   - chapitre  : data-url du tableau #chapters → .chapter-content
//
// IDs : fiction = id numérique RR ; chapitre = "<fid>:<cid>" (court,
// compatible VARCHAR(64) côté DB) — l'URL réelle est résolue via la
// page fiction (cachée).
// ============================================================
const axios = require('axios');

let cheerio = null;
try { cheerio = require('cheerio'); }
catch (e) { console.warn('[royalroad] cheerio manquant — `cd server && npm install cheerio`'); }

const BASE = 'https://www.royalroad.com';
const UA   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const http = axios.create({
    baseURL: BASE,
    timeout: 20_000,
    maxRedirects: 5,
    headers: {
        'User-Agent':      UA,
        'Accept':          'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
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
function fictionIdFromUrl(url) {
    const m = (url || '').match(/\/fiction\/(\d+)/);
    return m ? m[1] : null;
}
function abs(u) { return u && u.startsWith('/') ? BASE + u : u; }

// Parse une liste de fictions (.fiction-list-item)
function parseList($) {
    const out = [];
    $('.fiction-list-item').each((_, el) => {
        const $el  = $(el);
        const a    = $el.find('a[href*="/fiction/"]').first();
        const id   = fictionIdFromUrl(a.attr('href'));
        if (!id) return;
        const title = ($el.find('.fiction-title').text() || a.text()).replace(/\s+/g, ' ').trim();
        const img   = $el.find('img').first();
        const cover = abs(img.attr('data-src') || img.attr('src') || '');
        const desc  = $el.find('.description, .fiction-description').text().replace(/\s+/g, ' ').trim().slice(0, 400);
        const tags  = $el.find('a.fiction-tag, .tags a').map((_, t) => $(t).text().trim()).get();
        out.push({
            id, title, titleAlt: '',
            author: '', description: desc,
            status: null, year: null, demographic: null,
            tags,
            cover, coverLarge: cover, coverThumb: cover,
            contentRating: 'safe', langs: ['en'],
        });
    });
    return out;
}

// Pagination RR : 20 fictions / page côté site. On boucle sur les pages du
// site jusqu'à réunir `limit` résultats (audit N-EXT-13 : une seule page
// laissait la grille Catalogue incomplète), garde-fou de 5 requêtes par appel.
const SITE_PER  = 20;
const MAX_PAGES = 5;
async function browse(pathBase, { limit = 20, offset = 0 } = {}, ttl) {
    requireCheerio();
    const off = Math.max(0, +offset || 0);
    const lim = Math.max(1, +limit || 20);
    const sep = pathBase.includes('?') ? '&' : '?';
    let page  = Math.floor(off / SITE_PER) + 1;
    let skip  = off % SITE_PER;          // entrées déjà servies sur la 1re page
    const seen = new Set();
    const acc  = [];
    let siteExhausted = false;
    for (let n = 0; n < MAX_PAGES && acc.length < lim; n++, page++) {
        const results = parseList(cheerio.load(await fetchHtml(`${pathBase}${sep}page=${page}`, ttl)));
        results.slice(skip).forEach(m => { if (!seen.has(m.id)) { seen.add(m.id); acc.push(m); } });
        skip = 0;
        if (results.length < SITE_PER) { siteExhausted = true; break; }
    }
    // RR ne donne pas de total exploitable : "une page de plus" tant que la
    // dernière page lue était pleine.
    const total = off + acc.length + (siteExhausted ? 0 : SITE_PER);
    return { total, results: acc.slice(0, lim) };
}

// Retire les paragraphes-filigranes anti-vol injectés par RR dans les chapitres
const WATERMARK_RE = /(unauthorized|without (the author'?s? )?permission|stolen (from|work|story|content)|report (any|this).*(violation|theft|infringement)|royal\s*road|amazon)/i;

function sanitizeChapterHtml($, root) {
    root.find('script, style, iframe, form, input, button, base, object, embed').remove();
    // Attributs dangereux / inutiles
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
    // Filigranes : courts paragraphes au contenu suspect
    root.find('p, div, span').each((_, el) => {
        const t = $(el).text().trim();
        if (t && t.length < 220 && WATERMARK_RE.test(t)) $(el).remove();
    });
    return root.html() || '';
}

// ── Source export ──
module.exports = {
    id:           'royalroad',
    name:         'Royal Road',
    lang:         'en',
    baseUrl:      BASE,
    nsfw:         false,
    version:      '1.2.2',
    unit:      'chapter',
    type:         'novel',
    description:  'Royal Road — la plus grande plateforme de web novels anglophones (LitRPG, fantasy, isekai). Lecture en texte.',
    capabilities: ['popular', 'latest', 'search', 'manga', 'chapters', 'text'],

    async popular(opts = {}) {
        return browse('/fictions/best-rated', opts, 600_000);
    },

    async latest(opts = {}) {
        return browse('/fictions/latest-updates', opts, 120_000);
    },

    async search({ q, limit = 20, offset = 0, filters = {} } = {}) {
        requireCheerio();
        if (!q) {
            // Navigation sans recherche : on respecte le TRI choisi (issue #1)
            const sort = (filters && filters.sort) || '';
            if (/latest|updat|nouveau|added|recent|new/i.test(sort)) return this.latest({ limit, offset });
            return this.popular({ limit, offset });
        }
        return browse(`/fictions/search?title=${encodeURIComponent(q)}`, { limit, offset }, 120_000);
    },

    async getManga(id) {
        requireCheerio();
        const html = await fetchHtml(`/fiction/${id}`, 300_000);
        const $ = cheerio.load(html);

        const title  = $('h1').first().text().trim();
        const author = $('h4 a[href*="/profile/"]').first().text().trim()
            || ($('meta[property="books:author"]').attr('content') || '').trim();
        const description = $('.description').text().replace(/\s+/g, ' ').trim();
        const tags  = $('a.fiction-tag').map((_, t) => $(t).text().trim()).get();
        const cover = abs($('.cover-art-container img').attr('src')
            || $('img.thumbnail').attr('src')
            || $('meta[property="og:image"]').attr('content') || '');

        const labels = $('.fiction-info .label, .fiction-info span.label')
            .map((_, l) => $(l).text().trim().toUpperCase()).get().join(' ');
        let status = null;
        if (/ONGOING/.test(labels))        status = 'ongoing';
        else if (/COMPLETED/.test(labels)) status = 'completed';
        else if (/HIATUS/.test(labels))    status = 'hiatus';
        else if (/STUB|DROPPED/.test(labels)) status = 'cancelled';

        return {
            id, title, titleAlt: '', author, description,
            status, year: null, demographic: null, tags,
            cover, coverLarge: cover, coverThumb: cover,
            contentRating: 'safe', langs: ['en'],
        };
    },

    // Le tableau #chapters de la page fiction contient TOUTE la liste
    async getChapters(id, { limit } = {}) {
        requireCheerio();
        const html = await fetchHtml(`/fiction/${id}`, 120_000);
        const $ = cheerio.load(html);
        const rows = [];
        $('#chapters tbody tr[data-url], table#chapters tr[data-url]').each((i, tr) => {
            const $tr  = $(tr);
            const url  = $tr.attr('data-url') || '';
            const cidM = url.match(/\/chapter\/(\d+)/);
            if (!cidM) return;
            const title = $tr.find('a').first().text().replace(/\s+/g, ' ').trim();
            const time  = $tr.find('time').attr('datetime') || null;
            rows.push({
                id:          `${id}:${cidM[1]}`,
                chapter:     i + 1,             // RR ne numérote pas : ordre de publication
                volume:      null,
                title:       title || `Chapitre ${i + 1}`,
                lang:        'en',
                pages:       0,
                publishedAt: time,
            });
        });
        rows.sort((a, b) => b.chapter - a.chapter); // desc, comme les autres sources
        return { total: rows.length, results: limit && +limit < rows.length ? rows.slice(0, +limit) : rows };
    },

    // Sources novel : pas d'images
    async getPages() {
        throw new Error('Royal Road est une source de romans : utiliser getText()');
    },

    // Contenu texte d'un chapitre (HTML assaini)
    async getText(chapterId) {
        requireCheerio();
        const [fid, cid] = String(chapterId).split(':');
        if (!fid || !cid) throw new Error('Identifiant de chapitre invalide');

        // Résout l'URL réelle via la page fiction (cachée)
        const fhtml = await fetchHtml(`/fiction/${fid}`, 120_000);
        const $f = cheerio.load(fhtml);
        let path = null;
        $f('tr[data-url]').each((_, tr) => {
            const u = $f(tr).attr('data-url') || '';
            if (u.includes(`/chapter/${cid}/`) || u.endsWith(`/chapter/${cid}`)) path = u;
        });
        if (!path) throw new Error('Chapitre introuvable sur Royal Road');

        const html = await fetchHtml(path, 10 * 60_000);
        const $ = cheerio.load(html);
        const root = $('.chapter-inner.chapter-content, .chapter-content').first();
        if (!root.length) throw new Error('Contenu du chapitre introuvable');
        const title = $('h1').first().text().trim() || null;
        const content = sanitizeChapterHtml($, root);
        return { title, content };
    },
};
