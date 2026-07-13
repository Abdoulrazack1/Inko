// ============================================================
// NovelFull — extension Inko (source de ROMANS traduits, type 'novel')
// ============================================================
// ⚠ Extension communautaire. Scrape novelfull.com : traductions
// anglaises de light novels japonais, chinois et coréens
// (xianxia, wuxia, isekai…). Très grand catalogue.
// Structure :
//   - listes    : /most-popular, /latest-release-novel (?page=N, 20/page)
//   - recherche : /search?keyword=…
//   - œuvre     : /<slug>.html  (data-novel-id, info, desc-text)
//   - chapitres : /ajax-chapter-option?novelId=<id>  (liste COMPLÈTE en 1 appel)
//   - chapitre  : /<slug>/<fichier>.html  (#chapter-content)
//
// IDs : œuvre = slug ; chapitre = "<slug>:<fichier>" (≤191, compatible DB).
// ============================================================
const axios = require('axios');
const { execFile } = require('child_process');

let cheerio = null;
try { cheerio = require('cheerio'); }
catch (e) { console.warn('[novelfull] cheerio manquant — `cd server && npm install cheerio`'); }

const BASE = 'https://novelfull.com';
const UA   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const http = axios.create({
    baseURL: BASE,
    timeout: 20_000,
    maxRedirects: 5,
    headers: {
        'User-Agent':      UA,
        'Accept':          'text/html,application/xhtml+xml,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8',
        'Referer':         BASE + '/',
    },
});

// NovelFull bloque l'empreinte TLS de Node (Cloudflare) mais accepte curl,
// présent nativement sur Windows 10+, macOS et Linux. On passe donc par
// curl en priorité, avec repli axios si jamais curl est absent.
function curlGet(url) {
    return new Promise((resolve, reject) => {
        execFile('curl', [
            '-s', '-L', '--compressed', '-m', '25',
            '-A', UA,
            '-H', 'Accept: text/html,application/xhtml+xml,*/*;q=0.8',
            '-H', 'Accept-Language: en-US,en;q=0.9',
            '-H', `Referer: ${BASE}/`,
            BASE + url,
        ], { maxBuffer: 32 * 1024 * 1024, windowsHide: true }, (err, stdout) => {
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

async function fetchHtml(url, ttl = 120_000) {
    const c = getC(url);
    if (c) return c;
    let data;
    try { data = await curlGet(url); }
    catch (e) { ({ data } = await http.get(url, { responseType: 'text' })); }
    setC(url, data, ttl);
    return data;
}

// ── Helpers ──
function abs(u) { return u && u.startsWith('/') ? BASE + u : u; }
function slugFromHref(href) {
    const m = (href || '').match(/^\/([a-z0-9-]+)\.html/i);
    return m ? m[1] : null;
}
function chapterNumFromText(t) {
    const m = (t || '').match(/chapter\s*([\d.]+)/i);
    return m ? parseFloat(m[1]) : null;
}

// Parse un listing (.list-truyen .row)
function parseList($) {
    const out = [];
    $('.list-truyen .row').each((_, el) => {
        const $el = $(el);
        const a = $el.find('h3.truyen-title a').first();
        const id = slugFromHref(a.attr('href'));
        if (!id) return;
        const cover = abs($el.find('img.cover').attr('src') || '');
        out.push({
            id,
            title:  (a.attr('title') || a.text()).trim(),
            titleAlt: '',
            author: $el.find('.author').text().replace(/\s+/g, ' ').trim(),
            description: '',
            status: $el.find('.label-full').length ? 'completed' : null,
            year: null, demographic: null,
            tags: [],
            cover, coverLarge: cover, coverThumb: cover,
            contentRating: 'safe', langs: ['en'],
        });
    });
    return out;
}

// Pagination NovelFull : 20 œuvres / page
async function browse(pathBase, { limit = 20, offset = 0 } = {}, ttl) {
    requireCheerio();
    const page = Math.floor((+offset || 0) / 20) + 1;
    const sep = pathBase.includes('?') ? '&' : '?';
    const html = await fetchHtml(`${pathBase}${sep}page=${page}`, ttl);
    const results = parseList(cheerio.load(html));
    const off = +offset || 0;
    const total = results.length < 20 ? off + results.length : off + results.length + 20;
    return { total, results: results.slice(0, +limit || 20) };
}

// Filigranes / liens du site dans le contenu des chapitres
const JUNK_RE = /(novelfull|read (latest|free) chapters|fastest update|bookmark this|please support)/i;

function sanitizeChapterHtml($, root) {
    root.find('script, style, iframe, form, input, button, ins, .ads, .ads-holder, [id^="ads"], [class*="adsbygoogle"]').remove();
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
    id:           'novelfull',
    name:         'NovelFull',
    lang:         'en',
    baseUrl:      BASE,
    nsfw:         false,
    version:      '1.2.0',
    unit:      'chapter',
    type:         'novel',
    description:  'NovelFull — light novels japonais, chinois et coréens traduits en anglais (xianxia, wuxia, isekai). Lecture en texte.',
    capabilities: ['popular', 'latest', 'search', 'manga', 'chapters', 'text', 'tags'],

    async getTags() {
        // Genres stables du site (sidebar), hors contenu adulte
        return ['Action', 'Adventure', 'Comedy', 'Drama', 'Eastern', 'Fantasy', 'Game',
                'Harem', 'Historical', 'Horror', 'Isekai', 'Josei', 'Martial Arts', 'Mecha',
                'Mystery', 'Psychological', 'Reincarnation', 'Romance', 'School Life',
                'Sci-fi', 'Seinen', 'Shoujo', 'Shounen', 'Slice of Life', 'Sports',
                'Supernatural', 'Tragedy', 'Wuxia', 'Xianxia', 'Xuanhuan']
            .map(t => ({ id: t, name: t, group: 'genre' }));
    },

    async popular(opts = {}) {
        return browse('/most-popular', opts, 600_000);
    },

    async latest(opts = {}) {
        return browse('/latest-release-novel', opts, 120_000);
    },

    async search({ q, limit = 20, offset = 0, filters = {} } = {}) {
        requireCheerio();
        // Filtre par genre : pages /genre/<Tag> du site
        let tags = filters.includedTags || filters['includedTags[]'] || [];
        if (!Array.isArray(tags)) tags = [tags];
        if (!q && tags.length) {
            return browse(`/genre/${encodeURIComponent(tags[0].replace(/ /g, '+'))}`, { limit, offset }, 300_000);
        }
        if (!q) {
            // Navigation sans recherche : on respecte le TRI choisi (issue #1)
            const sort = (filters && filters.sort) || '';
            if (/latest|updat|nouveau|added|recent|new/i.test(sort)) return this.latest({ limit, offset });
            return this.popular({ limit, offset });
        }
        return browse(`/search?keyword=${encodeURIComponent(q)}`, { limit, offset }, 120_000);
    },

    async getManga(id) {
        requireCheerio();
        const html = await fetchHtml(`/${id}.html`, 300_000);
        const $ = cheerio.load(html);

        const title = ($('h3.title').first().text() || $('h1').first().text()).trim();
        const info  = $('.info');
        const author = info.find('a[href*="/author/"]').map((_, a) => $(a).text().trim()).get().join(', ')
            || info.find('h3:contains("Author")').parent().text().replace(/Author:?/i, '').trim();
        const tags = info.find('a[href*="/genre/"]').map((_, a) => $(a).text().trim()).get();
        const statusTxt = (info.find('a[href*="/status/"]').first().text() || '').toLowerCase();
        let status = null;
        if (/ongoing/.test(statusTxt))        status = 'ongoing';
        else if (/completed/.test(statusTxt)) status = 'completed';
        const description = $('.desc-text').text().replace(/\s+/g, ' ').trim();
        const cover = abs($('.book img').attr('src') || $('.info-holder img').attr('src') || '');

        return {
            id, title, titleAlt: '', author, description,
            status, year: null, demographic: null, tags,
            cover, coverLarge: cover, coverThumb: cover,
            contentRating: 'safe', langs: ['en'],
        };
    },

    // Liste COMPLÈTE en un appel via /ajax-chapter-option
    async getChapters(id, { limit } = {}) {
        requireCheerio();
        const page = await fetchHtml(`/${id}.html`, 300_000);
        const idM = page.match(/data-novel-id="(\d+)"/);
        if (!idM) throw new Error('novelId introuvable sur la page NovelFull');
        const optHtml = await fetchHtml(`/ajax-chapter-option?novelId=${idM[1]}`, 120_000);
        const $ = cheerio.load(optHtml);
        const out = [];
        $('option').each((i, o) => {
            const path = $(o).attr('value') || '';
            const m = path.match(/^\/[a-z0-9-]+\/([^/]+)\.html$/i);
            if (!m) return;
            const label = $(o).text().replace(/\s+/g, ' ').trim();
            out.push({
                id:          `${id}:${m[1]}`.slice(0, 191),
                chapter:     chapterNumFromText(label) ?? (i + 1),
                volume:      null,
                title:       label || null,
                lang:        'en',
                pages:       0,
                publishedAt: null,
            });
        });
        // Dédoublonne les numéros (chapitres bonus / volumes) en gardant l'ordre
        out.sort((a, b) => b.chapter - a.chapter);
        return { total: out.length, results: limit && +limit < out.length ? out.slice(0, +limit) : out };
    },

    async getPages() {
        throw new Error('NovelFull est une source de romans : utiliser getText()');
    },

    async getText(chapterId) {
        requireCheerio();
        const sep = String(chapterId).indexOf(':');
        if (sep < 1) throw new Error('Identifiant de chapitre invalide');
        const slug = String(chapterId).slice(0, sep);
        const file = String(chapterId).slice(sep + 1);
        const html = await fetchHtml(`/${slug}/${file}.html`, 10 * 60_000);
        const $ = cheerio.load(html);
        const root = $('#chapter-content, .chapter-c').first();
        if (!root.length) throw new Error('Contenu du chapitre introuvable');
        const title = $('.chapter-title, .chapter-text').first().text().trim()
            || $('h2 .chapter-text').text().trim() || null;
        const content = sanitizeChapterHtml($, root);
        return { title, content };
    },
};
