// ============================================================
// WeebCentral — extension Inko (modèle Mihon)
// ============================================================
// ⚠ Extension communautaire. Scrape weebcentral.com (HTMX).
// Structure :
//   - recherche : /search/data?text=…&sort=…&order=…
//   - série     : /series/<ID>/<slug>            (titre, tags, desc)
//   - chapitres : /series/<ID>/full-chapter-list (HTMX)
//   - pages     : /chapters/<ID>/images          (HTMX)
//   - covers    : temp.compsci88.com/cover/normal/<ID>.webp
//
// Pré-requis : `npm install cheerio` dans server/
// ============================================================
const axios = require('axios');

let cheerio = null;
try { cheerio = require('cheerio'); }
catch (e) { console.warn('[weebcentral] cheerio manquant — `cd server && npm install cheerio`'); }

const BASE     = 'https://weebcentral.com';
const COVER    = (id) => `https://temp.compsci88.com/cover/normal/${id}.webp`;
const COVER_FB = (id) => `https://temp.compsci88.com/cover/fallback/${id}.jpg`;
const UA       = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const http = axios.create({
    baseURL: BASE,
    timeout: 20_000,
    maxRedirects: 5,
    headers: {
        'User-Agent':      UA,
        'Accept':          'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'fr-FR,fr;q=0.9,en;q=0.8',
        'Referer':         BASE + '/',
    },
});

// ── Cache mémoire ──
const cache = new Map();
function getC(k) { const e = cache.get(k); if (!e) return null; if (e.expires < Date.now()) { cache.delete(k); return null; } return e.value; }
function setC(k, v, ms) { cache.set(k, { value: v, expires: Date.now() + ms }); }

function requireCheerio() { if (!cheerio) throw new Error('cheerio non installé — `cd server && npm install cheerio`'); }

async function fetchHtml(url, { ttl = 120_000, hx = false, referer } = {}) {
    const key = url + (hx ? '#hx' : '');
    const c = getC(key);
    if (c) return c;
    const headers = {};
    if (hx) headers['HX-Request'] = 'true';
    if (referer) headers['Referer'] = referer;
    const { data } = await http.get(url, { responseType: 'text', headers });
    setC(key, data, ttl);
    return data;
}

// ── Helpers ──
function idFromSeriesUrl(url) {
    const m = (url || '').match(/\/series\/([^/]+)/);
    return m ? m[1] : null;
}
function idFromChapterUrl(url) {
    const m = (url || '').match(/\/chapters\/([^/?#]+)/);
    return m ? m[1] : null;
}
function chapterNumFromText(t) {
    const m = (t || '').match(/chapter\s*([\d.]+)/i) || (t || '').match(/([\d.]+)/);
    return m ? parseFloat(m[1]) : null;
}

const DEMOS = ['shounen', 'seinen', 'shoujo', 'josei'];
function statusFromText(t) {
    t = (t || '').toLowerCase();
    if (/ongoing/.test(t))   return 'ongoing';
    if (/complete/.test(t))  return 'completed';
    if (/hiatus/.test(t))    return 'hiatus';
    if (/cancel/.test(t))    return 'cancelled';
    return null;
}

// Parse une liste de résultats. Le mode "Full Display" expose pour chaque série
// le titre, l'année, le statut, l'auteur et les tags : on extrait tout.
function parseList($) {
    const byId = new Map();
    $('a[href*="/series/"]').each((_, a) => {
        const id = idFromSeriesUrl($(a).attr('href'));
        if (!id || id === 'random' || byId.has(id)) return;

        const result = $(a).closest('article.bg-base-300');
        const root   = result.length ? result : $(a).closest('article, li');

        // Titre : div .text-lg de la section info, sinon alt de la cover
        let title = root.find('.text-lg').first().text().replace(/\s+/g, ' ').trim()
            || ($(a).find('img').attr('alt') || '').replace(/\s+cover$/i, '').trim()
            || $(a).attr('title') || '';
        title = title.replace(/\s+/g, ' ').trim();
        if (!title || title.length > 200) return;

        // Métadonnées via le texte de la fiche (Full Display)
        const info = (root.text() || '').replace(/\s+/g, ' ');
        const grab = (re) => { const m = info.match(re); return m ? m[1].trim() : ''; };
        const year   = (() => { const m = info.match(/Year:\s*(\d{4})/i); return m ? parseInt(m[1]) : null; })();
        const status = statusFromText(grab(/Status:\s*([A-Za-z]+)/i));
        const author = grab(/Author\(s\):\s*(.+?)\s*(?:Tag\(s\):|$)/i);
        const tagsStr = grab(/Tag\(s\):\s*(.+?)$/i);
        const tags = tagsStr ? tagsStr.split(',').map(s => s.trim()).filter(Boolean).slice(0, 10) : [];
        const demographic = (tags.find(t => DEMOS.includes(t.toLowerCase())) || '').toLowerCase() || null;

        byId.set(id, {
            id, title, titleAlt: '',
            author: author || '', description: '',
            status, year, demographic,
            tags,
            cover: COVER(id), coverLarge: COVER(id), coverThumb: COVER(id),
            contentRating: 'safe', langs: ['en'],
        });
    });
    return [...byId.values()];
}

function searchUrl({ text = '', sort = 'Best Match', order = 'Descending', limit = 32, offset = 0, statuses = [], tags = [] } = {}) {
    const p = new URLSearchParams({
        author: '', text,
        sort, order,
        official: 'Any',
        anime: 'Any', adult: 'Any',
        display_mode: 'Full Display',
        limit: String(limit),
        offset: String(offset),
    });
    statuses.forEach(s => p.append('included_status', s));
    tags.forEach(t => p.append('included_tag', t));
    return `/search/data?${p.toString()}`;
}

// Statuts UI (normalisés) → valeurs WeebCentral
const STATUS_MAP = { ongoing: 'Ongoing', completed: 'Complete', hiatus: 'Hiatus', cancelled: 'Canceled' };
// Tri UI (normalisé) → valeurs WeebCentral
const SORT_MAP = { popularity: 'Popularity', latest: 'Latest Updates', alpha: 'Alphabet', added: 'Recently Added' };

// Tags fixes du site (liste stable, hors contenu adulte)
const TAGS = [
    'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy', 'Gender Bender',
    'Harem', 'Historical', 'Horror', 'Isekai', 'Josei', 'Martial Arts', 'Mecha',
    'Mystery', 'Psychological', 'Romance', 'School Life', 'Sci-fi', 'Seinen',
    'Shoujo', 'Shounen', 'Slice of Life', 'Sports', 'Supernatural', 'Tragedy',
];

// ── Source export ──
module.exports = {
    id:           'weebcentral',
    name:         'Weeb Central',
    lang:         'en',
    baseUrl:      BASE,
    nsfw:         false,
    version:      '1.1.0',
    unit:      'chapter',
    description:  'Weeb Central — large catalogue anglais de scans (HTMX). Recherche, chapitres et lecture.',
    capabilities: ['popular', 'latest', 'search', 'manga', 'chapters', 'pages', 'tags'],

    async getTags() {
        return TAGS.map(t => ({ id: t, name: t, group: 'genre' }));
    },

    async popular({ limit = 24, offset = 0 } = {}) {
        requireCheerio();
        const html = await fetchHtml(searchUrl({ sort: 'Popularity', order: 'Descending', limit, offset }), { ttl: 600_000, hx: true });
        return { total: 5000, results: parseList(cheerio.load(html)) };
    },

    async latest({ limit = 24, offset = 0 } = {}) {
        requireCheerio();
        const html = await fetchHtml(searchUrl({ sort: 'Latest Updates', order: 'Descending', limit, offset }), { ttl: 120_000, hx: true });
        return { total: 5000, results: parseList(cheerio.load(html)) };
    },

    async search({ q, limit = 24, offset = 0, filters = {} } = {}) {
        requireCheerio();
        const arr = (v) => v == null ? [] : (Array.isArray(v) ? v : [v]);
        const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
        const statuses = arr(filters.status).map(s => STATUS_MAP[s] || s);
        let tags = arr(filters.includedTags || filters['includedTags[]']);
        // La démographie WeebCentral est un tag comme un autre (Shounen, Seinen…)
        arr(filters.demographic).forEach(d => tags.push(cap(d)));
        const hasFilters = statuses.length || tags.length;
        const sort = SORT_MAP[filters.sort] || (q ? 'Best Match' : 'Popularity');
        if (!q && !hasFilters && !filters.sort) return this.popular({ limit, offset });
        const html = await fetchHtml(searchUrl({ text: q || '', sort, limit, offset, statuses, tags }), { ttl: 120_000, hx: true });
        // Le site impose un minimum de ~32 résultats : on tronque à la limite demandée
        // (l'offset reste honoré par le site, donc aucune série n'est sautée)
        const all = parseList(cheerio.load(html));
        const results = all.slice(0, +limit || 24);
        // Pas de total renvoyé par le site : pagination "page suivante" tant que la page est pleine
        const off = +offset || 0;
        const total = all.length < +limit ? off + all.length : off + results.length + +limit;
        return { total, results };
    },

    async getManga(id) {
        requireCheerio();
        const html = await fetchHtml(`/series/${id}/x`, { ttl: 300_000 });
        const $ = cheerio.load(html);

        const title = $('h1').first().text().trim();
        const description = $('li:contains("Description") p, .whitespace-pre-wrap').first().text().trim()
            || $('p').filter((_, p) => $(p).text().length > 60).first().text().trim();
        const tags = $('a[href*="included_tag"]').map((_, a) => $(a).text().trim()).get();
        const author = $('a[href*="author"]').first().text().trim();
        const statusTxt = ($('a[href*="included_status"]').first().text() || '').toLowerCase();
        let status = null;
        if (/ongoing|en cours/.test(statusTxt))       status = 'ongoing';
        else if (/complete|terminé/.test(statusTxt))  status = 'completed';
        else if (/hiatus|paused/.test(statusTxt))     status = 'hiatus';
        else if (/cancel/.test(statusTxt))            status = 'cancelled';
        const yearM = html.match(/(\d{4})/);

        return {
            id, title, titleAlt: '', author, description,
            status, year: yearM ? parseInt(yearM[1]) : null,
            demographic: null, tags,
            cover: COVER(id), coverLarge: COVER(id), coverThumb: COVER(id),
            contentRating: 'safe', langs: ['en'],
        };
    },

    async getChapters(id, { limit } = {}) {
        requireCheerio();
        const html = await fetchHtml(`/series/${id}/full-chapter-list`, { ttl: 60_000, hx: true, referer: `${BASE}/series/${id}` });
        const $ = cheerio.load(html);
        const out = [];
        const seen = new Set();
        $('a[href*="/chapters/"]').each((_, a) => {
            const href = $(a).attr('href');
            const cid = idFromChapterUrl(href);
            if (!cid || seen.has(cid)) return;
            // Le numéro est dans un span dédié
            const label = $(a).find('span').filter((_, s) => /chapter/i.test($(s).text())).first().text()
                || $(a).text();
            const num = chapterNumFromText(label);
            if (num === null) return;
            seen.add(cid);
            out.push({
                id: cid,
                chapter: num,
                volume: null,
                title: null,
                lang: 'en',
                pages: 0,
                publishedAt: null,
            });
        });
        out.sort((a, b) => b.chapter - a.chapter);
        // Liste complète : ne jamais tronquer les longues séries
        return { total: out.length, results: limit && +limit < out.length ? out.slice(0, +limit) : out };
    },

    async getPages(chapterId) {
        requireCheerio();
        const url = `/chapters/${chapterId}/images?is_prev=False&current_page=1&reading_style=long_strip`;
        const html = await fetchHtml(url, { ttl: 5 * 60_000, hx: true, referer: `${BASE}/chapters/${chapterId}` });
        const $ = cheerio.load(html);
        const pages = [];
        $('img').each((_, img) => {
            const src = $(img).attr('src') || $(img).attr('data-src');
            if (src && /^https?:/.test(src) && !/brand|logo|icon/i.test(src)) {
                pages.push({ page: pages.length + 1, url: src.trim(), urlSaver: null });
            }
        });
        return { baseUrl: '', hash: '', pages };
    },
};
