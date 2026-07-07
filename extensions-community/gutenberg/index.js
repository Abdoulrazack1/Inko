// ============================================================
// Project Gutenberg — extension Inko (type 'book', livres du domaine public)
// ============================================================
// ⚠ Extension communautaire. Utilise l'API Gutendex (gutendex.com), un
// front REST libre pour Project Gutenberg : ~70 000 livres du domaine
// public (classiques FR/EN/DE/ES…). Aucune clé requise.
//   - listes    : /books?sort=popular | ?sort=descending  (32/page)
//   - recherche : /books?search=…
//   - livre     : /books/<id>
//   - texte     : formats['text/plain; charset=utf-8'] (livre entier = 1 chapitre)
//
// IDs : livre = id numérique Gutenberg ; chapitre = "<id>:full".
// Type 'book' → ouvert dans le lecteur de texte (comme les novels).
// ============================================================
const { execFile } = require('child_process');

const API  = 'https://gutendex.com';
const UA   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
const PER  = 32;

// GET via curl (-L : Gutendex redirige ; gutenberg.org sert le texte)
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
async function getJson(url, ttl = 300_000) {
    const hit = cache.get(url);
    if (hit && hit.exp > Date.now()) return hit.val;
    const val = JSON.parse(await curlGet(url));
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
        status: 'completed',                       // œuvres achevées (domaine public)
        year: null, demographic: null,
        tags: (b.subjects || []).slice(0, 8),
        cover, coverLarge: cover, coverThumb: cover,
        contentRating: 'safe',
        langs: b.languages || [],
    };
}

async function browse({ limit = PER, offset = 0 } = {}, extra = '') {
    const page = Math.floor((+offset || 0) / PER) + 1;
    const data = await getJson(`${API}/books?page=${page}${extra}`);
    const results = (data.results || []).map(mapBook);
    return { total: data.count || results.length, results: results.slice(0, +limit || PER) };
}

// Retire l'en-tête/pied de licence Gutenberg et met en paragraphes HTML
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
    id:           'gutenberg',
    name:         'Project Gutenberg',
    lang:         'multi',
    baseUrl:      API,
    nsfw:         false,
    version:      '1.1.0',

    unit:      'chapter',
    type:         'book',
    description:  'Project Gutenberg — 70 000+ livres et romans du domaine public (classiques FR/EN/DE/ES…). Lecture en texte, 100% légal et gratuit.',
    capabilities: ['popular', 'latest', 'search', 'manga', 'chapters', 'text'],

    async popular(opts = {}) { return browse(opts, '&sort=popular'); },
    async latest(opts = {})  { return browse(opts, '&sort=descending'); },   // ids récents = ajouts récents

    async search({ q, limit = PER, offset = 0 } = {}) {
        if (!q) return this.popular({ limit, offset });
        return browse({ limit, offset }, `&search=${encodeURIComponent(q)}`);
    },

    async getManga(id) {
        const b = await getJson(`${API}/books/${encodeURIComponent(id)}`);
        return mapBook(b);
    },

    // Un livre Gutenberg = une seule « unité » de lecture
    async getChapters(id) {
        return { total: 1, results: [{
            id: `${id}:full`, chapter: 1, volume: null,
            title: 'Livre complet', lang: '', pages: 0, publishedAt: null,
        }] };
    },

    async getPages() {
        throw new Error('Project Gutenberg est une source de livres : utiliser getText()');
    },

    async getText(chapterId) {
        const id = String(chapterId).split(':')[0];
        const b = await getJson(`${API}/books/${encodeURIComponent(id)}`);
        const f = b.formats || {};
        // Le chemin /ebooks/<id>.txt.utf-8 fourni par Gutendex est souvent bloqué ;
        // le miroir /cache/epub/<id>/pg<id>.txt(.utf8) répond de façon fiable.
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
