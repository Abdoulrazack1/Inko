// ============================================================
// NovelBin — extension Inko (source de ROMANS traduits, type 'novel')
// ============================================================
// ⚠ Extension communautaire. Scrape novelbin.com : traductions
// anglaises de light/web novels chinois, coréens et japonais
// (cultivation, système, isekai, romance…). Très grand catalogue.
// Structure :
//   - listes    : /sort/novelbin-popular, /sort/latest  (?page=N, 20/page)
//   - recherche : /search?keyword=…
//   - œuvre     : /b/<slug>                   (h3.title, data-novel-id, #tab-description)
//   - chapitres : /ajax/chapter-archive?novelId=<id>  (liste COMPLÈTE en 1 appel)
//   - chapitre  : /b/<slug>/<chapitre>        (#chr-content)
//
// IDs : œuvre = slug ; chapitre = "<slug>:<chapitre-slug>" (compatible VARCHAR(191)).
// NovelBin est derrière Cloudflare : on passe par curl (empreinte TLS navigateur),
// repli axios — même technique que NovelFull.
// ============================================================
const axios = require('axios');
const { execFile } = require('child_process');

let cheerio = null;
try { cheerio = require('cheerio'); }
catch (e) { console.warn('[novelbin] cheerio manquant — `cd server && npm install cheerio`'); }

const BASE = 'https://novelbin.com';
const UA   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const http = axios.create({
    baseURL: BASE,
    timeout: 25_000,
    maxRedirects: 5,
    headers: {
        'User-Agent':      UA,
        'Accept':          'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
        'Referer':         BASE + '/',
    },
});

// Cloudflare bloque l'empreinte TLS de Node mais laisse passer curl (présent
// nativement Win10+/macOS/Linux). curl en priorité, repli axios si absent.
function curlGet(url) {
    return new Promise((resolve, reject) => {
        execFile('curl', [
            '-s', '-L', '--max-redirs', '5', '--compressed', '-m', '25',
            '-A', UA,
            '-H', 'Accept: text/html,application/xhtml+xml,*/*;q=0.8',
            '-H', 'Accept-Language: en-US,en;q=0.9',
            '-H', `Referer: ${BASE}/`,
            url,
        ], { maxBuffer: 48 * 1024 * 1024, windowsHide: true }, (err, stdout) => {
            if (err) return reject(new Error('curl indisponible : ' + err.message));
            if (!stdout || stdout.length < 500) return reject(new Error('réponse vide (blocage anti-bot ?)'));
            resolve(stdout);
        });
    });
}

// ── Cache mémoire ──
const cache = new Map();
function getC(k) { const e = cache.get(k); if (!e) return null; if (e.expires < Date.now()) { cache.delete(k); return null; } return e.value; }
function setC(k, v, ms) { cache.set(k, { value: v, expires: Date.now() + ms }); }

function requireCheerio() { if (!cheerio) throw new Error('cheerio non installé — `cd server && npm install cheerio`'); }

// url peut être un chemin ("/sort/...") ou une URL absolue (liens chapitres).
async function fetchHtml(url, ttl = 120_000) {
    const full = /^https?:\/\//i.test(url) ? url : BASE + url;
    const c = getC(full);
    if (c) return c;
    let data;
    try { data = await curlGet(full); }
    catch (e) { ({ data } = await http.get(full, { responseType: 'text' })); }
    setC(full, data, ttl);
    return data;
}

// ── Helpers ──
function slugFromHref(href) {
    const m = (href || '').match(/\/b\/([^/?#]+)/i);
    return m ? m[1] : null;
}
function chapterSlugFromHref(href, slug) {
    const m = (href || '').match(new RegExp(`/b/${slug}/([^/?#]+)`, 'i'));
    return m ? m[1] : null;
}
function chapterNumFromText(t) {
    const m = (t || '').match(/chapter\s*([\d.]+)/i);
    return m ? parseFloat(m[1]) : null;
}

// Parse un listing (.list-novel .row → h3.novel-title a)
function parseList($) {
    const out = [];
    $('.list-novel .row, .archive .row').each((_, el) => {
        const $el = $(el);
        const a   = $el.find('h3.novel-title a, h3.title a').first();
        const id  = slugFromHref(a.attr('href'));
        if (!id) return;
        const img   = $el.find('img').first();
        const cover = img.attr('data-src') || img.attr('src') || '';
        out.push({
            id,
            title:  (a.attr('title') || a.text()).replace(/\s+/g, ' ').trim(),
            titleAlt: '',
            author: $el.find('.author').text().replace(/\s+/g, ' ').trim(),
            description: '',
            status: null,
            year: null, demographic: null,
            tags: [],
            cover, coverLarge: cover, coverThumb: cover,
            contentRating: 'safe', langs: ['en'],
        });
    });
    return out;
}

// Pagination NovelBin : 20 œuvres / page
async function browse(pathBase, { limit = 20, offset = 0 } = {}, ttl) {
    requireCheerio();
    const page = Math.floor((+offset || 0) / 20) + 1;
    const sep  = pathBase.includes('?') ? '&' : '?';
    const html = await fetchHtml(`${pathBase}${sep}page=${page}`, ttl);
    const results = parseList(cheerio.load(html));
    const off = +offset || 0;
    const total = results.length < 20 ? off + results.length : off + results.length + 20;
    return { total, results: results.slice(0, +limit || 20) };
}

// Filigranes / pubs / liens du site injectés dans le contenu des chapitres
const JUNK_RE = /(novelbin|read (latest|the latest|free)|please (support|bookmark)|bookmark this|fastest update|translator|tap the screen|chapter content)/i;

function sanitizeChapterHtml($, root) {
    root.find('script, style, iframe, form, input, button, ins, .ads, .ads-holder, [id^="ads"], [class*="adsbygoogle"], .unlock-buttons, .schedule-text').remove();
    root.find('*').each((_, el) => {
        const attribs = el.attribs || {};
        Object.keys(attribs).forEach(name => {
            if (/^on/i.test(name) || name === 'style' || name === 'class' || name === 'id') delete el.attribs[name];
        });
    });
    root.find('p, div, span').each((_, el) => {
        const t = $(el).text().trim();
        if (t && t.length < 200 && JUNK_RE.test(t)) $(el).remove();
    });
    return root.html() || '';
}

// ── Source export ──
module.exports = {
    id:           'novelbin',
    name:         'NovelBin',
    lang:         'en',
    baseUrl:      BASE,
    nsfw:         false,
    version:      '1.1.0',

    unit:      'chapter',
    type:         'novel',
    description:  'NovelBin — light/web novels chinois, coréens et japonais traduits en anglais (cultivation, système, isekai, romance). Très grand catalogue, lecture en texte.',
    capabilities: ['popular', 'latest', 'search', 'manga', 'chapters', 'text', 'tags'],

    async getTags() {
        return ['Action', 'Adventure', 'Comedy', 'Drama', 'Eastern', 'Fantasy', 'Game',
                'Gender Bender', 'Harem', 'Historical', 'Horror', 'Isekai', 'Josei',
                'Martial Arts', 'Mature', 'Mecha', 'Mystery', 'Psychological',
                'Reincarnation', 'Romance', 'School Life', 'Sci-fi', 'Seinen', 'Shoujo',
                'Shounen', 'Slice of Life', 'Sports', 'Supernatural', 'Tragedy', 'Urban',
                'Wuxia', 'Xianxia', 'Xuanhuan']
            .map(t => ({ id: t.toLowerCase().replace(/\s+/g, '-'), name: t, group: 'genre' }));
    },

    async popular(opts = {}) {
        return browse('/sort/novelbin-popular', opts, 600_000);
    },

    async latest(opts = {}) {
        return browse('/sort/latest', opts, 120_000);
    },

    async search({ q, limit = 20, offset = 0, filters = {} } = {}) {
        requireCheerio();
        let tags = filters.includedTags || filters['includedTags[]'] || [];
        if (!Array.isArray(tags)) tags = [tags];
        if (!q && tags.length) {
            const g = String(tags[0]).toLowerCase().replace(/\s+/g, '-');
            return browse(`/genre/${encodeURIComponent(g)}`, { limit, offset }, 300_000);
        }
        if (!q) return this.popular({ limit, offset });
        return browse(`/search?keyword=${encodeURIComponent(q)}`, { limit, offset }, 120_000);
    },

    async getManga(id) {
        requireCheerio();
        const html = await fetchHtml(`/b/${id}`, 300_000);
        const $ = cheerio.load(html);

        const title  = ($('h3.title[itemprop="name"]').first().text()
            || $('h3.title').first().text()
            || $('h1').first().text()).replace(/\s+/g, ' ').trim();
        // Restreint l'extraction à la boîte d'info (sinon footer/sections polluent)
        const info = $('.info-meta, .info, .book-info, ul.info').first();
        const scope = info.length ? info : $('#novel, .col-novel-main').first();
        const author = [...new Set((scope.length ? scope : $('body'))
            .find('a[href*="/a/"]').map((_, a) => $(a).text().trim()).get().filter(Boolean))].join(', ');
        const tags = [...new Set((scope.length ? scope : $('body'))
            .find('a[href*="/genre/"]').map((_, a) => $(a).text().trim()).get()
            .filter(t => t && t.length < 25 && !/&/.test(t)))];

        // Statut : meta property=…status (content "OnGoing"/"Completed") ou ligne "Status:"
        const statusTxt = (($('meta[property$="status"]').attr('content') || '')
            + ' ' + $('.info-meta li:contains("Status")').text()).toLowerCase();
        let status = null;
        if (/completed/.test(statusTxt))    status = 'completed';
        else if (/ongoing/.test(statusTxt)) status = 'ongoing';
        else if (/hiatus/.test(statusTxt))  status = 'hiatus';

        const description = $('#tab-description, .desc-text').first().text().replace(/\s+/g, ' ').trim();
        const cover = $('meta[property="og:image"]').attr('content')
            || $('.book img, .books img').attr('data-src')
            || $('.book img, .books img').attr('src') || '';

        return {
            id, title, titleAlt: '', author, description,
            status, year: null, demographic: null, tags,
            cover, coverLarge: cover, coverThumb: cover,
            contentRating: 'safe', langs: ['en'],
        };
    },

    // Liste COMPLÈTE en un appel via /ajax/chapter-archive
    async getChapters(id, { limit } = {}) {
        requireCheerio();
        // novelId = data-novel-id de la fiche (souvent = slug)
        let novelId = id;
        try {
            const page = await fetchHtml(`/b/${id}`, 300_000);
            const m = page.match(/data-novel-id="([^"]+)"/);
            if (m) novelId = m[1];
        } catch (e) { /* on tente avec le slug */ }

        const archive = await fetchHtml(`/ajax/chapter-archive?novelId=${encodeURIComponent(novelId)}`, 120_000);
        const $ = cheerio.load(archive);
        const out = [];
        $('a[href*="/b/"]').each((i, a) => {
            const href = $(a).attr('href') || '';
            const cslug = chapterSlugFromHref(href, id);
            if (!cslug) return;
            const label = ($(a).attr('title') || $(a).text()).replace(/\s+/g, ' ').trim();
            out.push({
                id:          `${id}:${cslug}`.slice(0, 191),
                chapter:     chapterNumFromText(label) ?? chapterNumFromText(cslug) ?? (i + 1),
                volume:      null,
                title:       label || null,
                lang:        'en',
                pages:       0,
                publishedAt: null,
            });
        });
        out.sort((a, b) => b.chapter - a.chapter); // desc, comme les autres sources
        return { total: out.length, results: limit && +limit < out.length ? out.slice(0, +limit) : out };
    },

    async getPages() {
        throw new Error('NovelBin est une source de romans : utiliser getText()');
    },

    async getText(chapterId) {
        requireCheerio();
        const sep = String(chapterId).indexOf(':');
        if (sep < 1) throw new Error('Identifiant de chapitre invalide');
        const slug  = String(chapterId).slice(0, sep);
        const cslug = String(chapterId).slice(sep + 1);
        const html = await fetchHtml(`/b/${slug}/${cslug}`, 10 * 60_000);
        const $ = cheerio.load(html);
        const root = $('#chr-content, .chr-c, #chapter-content').first();
        if (!root.length) throw new Error('Contenu du chapitre introuvable');
        const title = $('.chr-title, .chapter-title, a.chr-title').first().text().replace(/\s+/g, ' ').trim() || null;
        const content = sanitizeChapterHtml($, root);
        return { title, content };
    },
};
