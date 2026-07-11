// ============================================================
// Livres en français — extension Inko (type 'book', domaine public FR)
// ============================================================
// ⚠ Extension communautaire. Même moteur que Project Gutenberg
// (API Gutendex, gutendex.com) mais VERROUILLÉE sur les livres en
// français : ~4 000 classiques du domaine public (Hugo, Zola, Balzac,
// Dumas, Verne, Flaubert, Maupassant…). Aucune clé requise, texte
// intégral, 100 % légal et gratuit.
//   - listes    : /books?languages=fr&sort=popular | ?sort=descending
//   - recherche : /books?languages=fr&search=…
//   - livre     : /books/<id>
//   - texte     : miroir /cache/epub/<id>/pg<id>.txt (fiable)
//
// IDs : livre = id numérique Gutenberg ; chapitre = "<id>:full".
// ============================================================
const { execFile } = require('child_process');

const API  = 'https://gutendex.com';
const UA   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PER  = 32;
const LANG = 'fr';   // ← la seule différence de fond avec l'extension Gutenberg

function curlGet(url, maxBuffer = 32 * 1024 * 1024) {
    return new Promise((resolve, reject) => {
        execFile('curl', ['-s', '-f', '-L', '--compressed', '-m', '30', '-A', UA, url],
            { maxBuffer, windowsHide: true }, (err, stdout) => {
                if (err) return reject(new Error('curl : ' + err.message));
                if (!stdout || !stdout.length) return reject(new Error('réponse vide'));
                resolve(stdout);
            });
    });
}

const cache = new Map();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function getJson(url, ttl = 300_000) {
    const hit = cache.get(url);
    if (hit && hit.exp > Date.now()) return hit.val;
    // Gutendex répond parfois lentement (throttling) : une 2e tentative suffit.
    let raw;
    for (let attempt = 1; attempt <= 2; attempt++) {
        try { raw = await curlGet(url); break; }
        catch (e) { if (attempt === 2) throw e; await sleep(1200); }
    }
    const val = JSON.parse(raw);
    cache.set(url, { val, exp: Date.now() + ttl });
    return val;
}

function mapBook(b) {
    const cover = b.formats && (b.formats['image/jpeg'] || '');
    return {
        id: String(b.id),
        title: b.title || 'Sans titre',
        titleAlt: '',
        author: (b.authors || []).map(a => a.name).join(', '),
        description: (b.summaries && b.summaries[0]) || (b.subjects || []).slice(0, 4).join(' · ') || '',
        status: 'completed',
        year: null, demographic: null,
        tags: (b.subjects || []).slice(0, 8),
        cover, coverLarge: cover, coverThumb: cover,
        contentRating: 'safe',
        langs: b.languages || ['fr'],
    };
}

async function browse({ limit = PER, offset = 0 } = {}, extra = '') {
    const page = Math.floor((+offset || 0) / PER) + 1;
    const data = await getJson(`${API}/books?languages=${LANG}&page=${page}${extra}`);
    const results = (data.results || []).map(mapBook);
    return { total: data.count || results.length, results: results.slice(0, +limit || PER) };
}

function textToHtml(raw) {
    let t = raw;
    const start = t.search(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG.*?\*\*\*/i);
    if (start !== -1) t = t.slice(t.indexOf('\n', start) + 1);
    const end = t.search(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i);
    if (end !== -1) t = t.slice(0, end);
    const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return t.trim().split(/\n\s*\n/).map(p => `<p>${esc(p.trim()).replace(/\n/g, '<br>')}</p>`).join('\n');
}

module.exports = {
    id:           'gutenberg-fr',
    name:         'Livres en français',
    lang:         'fr',
    baseUrl:      API,
    nsfw:         false,
    version:      '1.0.0',
    unit:         'chapter',
    type:         'book',
    description:  'Livres du domaine public en français — ~4 000 classiques (Hugo, Zola, Balzac, Dumas, Verne, Flaubert, Maupassant…) via Project Gutenberg. Lecture en texte intégral, 100 % légal et gratuit.',
    capabilities: ['popular', 'latest', 'search', 'manga', 'chapters', 'text'],

    async popular(opts = {}) { return browse(opts, '&sort=popular'); },
    async latest(opts = {})  { return browse(opts, '&sort=descending'); },

    async search({ q, limit = PER, offset = 0 } = {}) {
        if (!q) return this.popular({ limit, offset });
        return browse({ limit, offset }, `&search=${encodeURIComponent(q)}`);
    },

    async getManga(id) {
        const b = await getJson(`${API}/books/${encodeURIComponent(id)}`);
        return mapBook(b);
    },

    async getChapters(id) {
        return { total: 1, results: [{
            id: `${id}:full`, chapter: 1, volume: null,
            title: 'Livre complet', lang: 'fr', pages: 0, publishedAt: null,
        }] };
    },

    async getPages() {
        throw new Error('« Livres en français » est une source de livres : utiliser getText()');
    },

    async getText(chapterId) {
        const id = String(chapterId).split(':')[0];
        const b = await getJson(`${API}/books/${encodeURIComponent(id)}`);
        const f = b.formats || {};
        const candidates = [
            `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
            `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt.utf8`,
            f['text/plain; charset=utf-8'], f['text/plain; charset=us-ascii'], f['text/plain'],
        ].filter(Boolean);
        let raw = null;
        for (const url of candidates) {
            try {
                const r = await curlGet(url, 48 * 1024 * 1024);
                if (r && r.length > 500) { raw = r; break; }
            } catch (e) { /* essaie le suivant */ }
        }
        if (!raw) throw new Error('Texte du livre indisponible');
        return { title: b.title || null, content: textToHtml(raw.toString('utf8')) };
    },
};
