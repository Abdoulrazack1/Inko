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

// novelbin.com ne résout plus ; .co est un domaine parqué ; .net exige du JS.
// novel-bin.com est le miroir fonctionnel avec le même balisage.
// ── Réparée le 15 août 2026 (audit BUG-06) ──
// Le site avait restructuré ses URL de liste : `/sort/novelbin-popular` et
// `/sort/latest` rendaient 404, donc `popular()` et `latest()` rendaient 0
// résultat. Le job hebdomadaire sources-health le signalait depuis le
// 20 juillet — quatre lundis de suite, sans que personne n'agisse.
//
// Ce que la panne était VRAIMENT : seules les URL de liste avaient bougé. Le
// balisage, lui, n'avait pas changé — `search()` marchait tout du long, avec
// le MÊME parseur (`parseList`) sur `/search?keyword=`. La note précédente
// concluait qu'il fallait « réécrire les sélecteurs, un travail de scraping à
// part entière » : c'était faux, et cette conclusion a probablement contribué
// à ce que la réparation soit repoussée quatre semaines.
//
// Les vraies listes, relevées dans la navigation du site :
//   · /monthvisit/  les plus consultées du mois   → popular
//   · /dayvisit/    les plus consultées du jour   → latest (approximation)
//   · /allvisit/    les plus consultées, toujours
//   · /full.html    les romans terminés
//   · /genre/<G>/   par genre
// Les fiches restent sous /novel-bin/<slug>.
const BASE = 'https://novel-bin.com';
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
// Audit EXT-04 : aucun reessai. Un scan de bibliotheque enchaine des dizaines
// de requetes sur un site scrape derriere Cloudflare : un blocage ponctuel ou
// un hoquet reseau faisait echouer toute la serie et remontait a l'utilisateur
// comme une source cassee. Deux tentatives, 800 ms d'attente. On ne reessaie
// que le transitoire : une reponse vide (blocage anti-bot) ou une erreur curl,
// jamais une reponse valide mais inattendue.
function curlGetOnce(url) {
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
const sleepMs = (ms) => new Promise(r => setTimeout(r, ms));
async function curlGet(url) {
    let last;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try { return await curlGetOnce(url); }
        catch (e) { last = e; if (attempt < 2) await sleepMs(800); }
    }
    throw last;
}

// ── Cache mémoire ──
const cache = new Map();
function getC(k) { const e = cache.get(k); if (!e) return null; if (e.expires < Date.now()) { cache.delete(k); return null; } return e.value; }
function setC(k, v, ms) { cache.set(k, { value: v, expires: Date.now() + ms }); }

function requireCheerio() { if (!cheerio) throw new Error('cheerio non installé — `cd server && npm install cheerio`'); }

// url peut être un chemin ("/sort/...") ou une URL absolue (liens chapitres).
// Messages lisibles pour les limites HTTP (audit F.15) : avant, un 429/503
// du site remontait comme une erreur axios brute qui ressemblait a un bug.
function friendlyHttpError(e) {
    const st = e && e.response && e.response.status;
    if (st === 429 || st === 503) return new Error('Source momentanement limitee - reessaie dans un instant');
    if (st) return new Error(`Site source indisponible (HTTP ${st})`);
    return e;
}

async function fetchHtml(url, ttl = 120_000) {
    const full = /^https?:\/\//i.test(url) ? url : BASE + url;
    const c = getC(full);
    if (c) return c;
    let data;
    try { data = await curlGet(full); }
    catch (e) {
        try { ({ data } = await http.get(full, { responseType: 'text' })); }
        catch (e2) { throw friendlyHttpError(e2); }
    }
    setC(full, data, ttl);
    return data;
}

// ── Helpers ──
// Le miroir actuel (novel-bin.com) sert les œuvres sous /novel-bin/<slug>/
// (l'ancien domaine utilisait /b/<slug>) — on accepte les deux.
function slugFromHref(href) {
    const m = (href || '').match(/\/(?:novel-bin|b)\/([^/?#]+)/i);
    return m ? m[1] : null;
}
function chapterSlugFromHref(href, slug) {
    const m = (href || '').match(new RegExp(`/(?:novel-bin|b)/${slug}/([^/?#]+)`, 'i'));
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

// Pagination NovelBin : 20 œuvres / page côté site. On boucle sur les pages
// jusqu'à réunir `limit` résultats (audit N-EXT-13 : une seule page laissait
// la grille Catalogue incomplète), garde-fou de 5 requêtes par appel.
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
    const total = off + acc.length + (siteExhausted ? 0 : SITE_PER);
    return { total, results: acc.slice(0, lim) };
}

// Filigranes / pubs / liens du site injectés dans le contenu des chapitres
const JUNK_RE = /(novelbin|read (latest|the latest|free)|please (support|bookmark)|bookmark this|fastest update|translator|tap the screen|chapter content)/i;

function sanitizeChapterHtml($, root) {
    root.find('script, style, iframe, form, input, button, base, object, embed, ins, .ads, .ads-holder, [id^="ads"], [class*="adsbygoogle"], .unlock-buttons, .schedule-text').remove();
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
    version:      '1.3.0',
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

    // Les listes du site sont classées par FRÉQUENTATION, pas par date :
    // `/monthvisit/` (le mois), `/dayvisit/` (le jour), `/allvisit/` (toujours).
    // Aucun classement « mis à jour récemment » n'existe.
    //
    // `latest` retombe donc sur les plus consultées DU JOUR. Ce n'est pas la
    // même chose qu'une sortie récente, et il vaut mieux l'écrire ici que de
    // laisser croire le contraire : un roman très lu aujourd'hui n'a pas
    // forcément publié aujourd'hui. C'est l'approximation la plus proche que
    // le site rende disponible, et elle vaut mieux qu'une page 404.
    async popular(opts = {}) {
        return browse('/monthvisit/', opts, 600_000);
    },

    async latest(opts = {}) {
        return browse('/dayvisit/', opts, 120_000);
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
        const html = await fetchHtml(`/novel-bin/${id}/`, 300_000);
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
        // Le miroir actuel liste TOUS les chapitres sur la fiche elle-même
        // (les endpoints /ajax/chapter-archive et /ajax/chapter-option
        // renvoient la page d'accueil : morts). On parse donc la fiche.
        const page = await fetchHtml(`/novel-bin/${id}/`, 300_000);
        const $ = cheerio.load(page);
        const seen = new Set();
        const out = [];
        // Périmètre restreint à la zone de liste des chapitres quand elle existe
        // (audit N-EXT-6 : le sélecteur pleine page pouvait capter un lien
        // « à lire aussi » au slug voisin), repli page entière sinon.
        const zone = $('.list-chapter, #list-chapter, .chapter-list, #chapter-list, .panel-body').first();
        (zone.length ? zone : $.root()).find(`a[href*="/${id}/"]`).each((i, a) => {
            const href = $(a).attr('href') || '';
            const cslug = chapterSlugFromHref(href, id);
            if (!cslug || seen.has(cslug)) return;
            seen.add(cslug);
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
        const html = await fetchHtml(`/novel-bin/${slug}/${cslug}`, 10 * 60_000);
        const $ = cheerio.load(html);
        const root = $('#chr-content, .chr-c, #chapter-content').first();
        if (!root.length) throw new Error('Contenu du chapitre introuvable');
        const title = $('.chr-title, .chapter-title, a.chr-title').first().text().replace(/\s+/g, ' ').trim() || null;
        const content = sanitizeChapterHtml($, root);
        return { title, content };
    },
};
