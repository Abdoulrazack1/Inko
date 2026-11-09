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
function curlGet(url, maxBuffer = 32 * 1024 * 1024, asBuffer = false, delaiMs = 0) {
    // `-m` en SECONDES, au minimum 1 : un appelant qui demande un delai
    // court le fait pour pouvoir se rabattre, pas pour attendre.
    const max = delaiMs ? String(Math.max(1, Math.round(delaiMs / 1000))) : '30';
    return new Promise((resolve, reject) => {
        execFile('curl', ['-s', '-f', '-L', '--compressed', '-m', max, '-A', UA, url],
            { maxBuffer, windowsHide: true, encoding: asBuffer ? 'buffer' : 'utf8' }, (err, stdout) => {
                if (err) return reject(new Error('curl : ' + err.message));
                if (!stdout || !stdout.length) return reject(new Error('réponse vide'));
                resolve(stdout);
            });
    });
}

const cache = new Map();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function getJson(url, ttl = 300_000, delaiMs = 0) {
    const hit = cache.get(url);
    if (hit && hit.exp > Date.now()) return hit.val;
    // Gutendex répond parfois lentement (throttling) : une 2e tentative suffit.
    let raw;
    // Un delai court demande par l'appelant (le tri, qui est facultatif)
    // ne merite pas deux tentatives : on veut echouer VITE pour retomber
    // sur la requete qui, elle, repond.
    const essais = delaiMs ? 1 : 2;
    for (let attempt = 1; attempt <= essais; attempt++) {
        try { raw = await curlGet(url, undefined, false, delaiMs); break; }
        catch (e) { if (attempt === essais) throw e; await sleep(1200); }
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
        status: 'completed',                       // œuvres achevées (domaine public)
        year: null, demographic: null,
        tags: (b.subjects || []).slice(0, 8),
        cover, coverLarge: cover, coverThumb: cover,
        contentRating: 'safe',
        langs: b.languages || [],
    };
}

// Boucle sur les pages Gutendex (32/page) jusqu'à réunir `limit` résultats
// (audit N-EXT-13 : un appel limit > 32, ex. le bouton « Aléatoire », ne
// recevait qu'une page), garde-fou de 4 requêtes par appel.
// ── Le slash final n'est pas cosmetique ─────────────────────
// `/books?page=1` rend un 301 vers `/books/?page=1`. Suivre cette
// redirection est gratuit... sauf avec un parametre de tri. Mesure du
// 9 novembre, curl, meme machine, meme instant :
//
//   /books/?page=1&sort=popular     0,08 s
//   /books/?page=1                  0,08 s
//   /books/?page=1&sort=descending   15 s
//   /books?page=1&sort=popular      PEND, delai de 30 s atteint
//
// L'extension demandait la derniere forme : la liste mise en avant ne
// revenait jamais, et le bac a sable disait « pas de reponse en 20 s ».
// On croyait la source lente ou tombee — elle repond en 80 ms.
//
// Le tri `descending` reste lent (15 s) cote Gutendex, slash ou pas :
// ca, c'est leur affaire, et le delai de 30 s le couvre.
// ── Le tri est une PREFERENCE, pas une exigence ─────────────
// Mesure du 9 novembre, curl, meme machine, meme instant :
//
//   /books/?languages=fr&page=1                     0,11 s
//   /books/?languages=fr&page=1&sort=popular        PEND (25 s)
//   /books/?languages=fr&page=1&sort=descending     503 apres 15 s
//
// Gutendex ne sait plus servir un tri combine a un filtre de langue.
// L'extension demandait le tri, attendait trente secondes, et rendait
// une erreur : la source paraissait morte alors qu'elle repond en cent
// millisecondes des qu'on ne trie pas.
//
// On essaie donc le tri avec un delai COURT, et on retombe sur la meme
// requete sans tri. Une liste non triee vaut infiniment mieux qu'une
// source absente — et le journal dit qu'on a du s'en passer, pour que
// personne ne croie le tri actif.
const DELAI_TRI_MS = 8000;
let triAbandonne = false;

async function getJsonOuSansTri(base, extra, ttl) {
    if (!extra || triAbandonne) return getJson(base + (triAbandonne ? '' : extra), ttl);
    try {
        return await getJson(base + extra, ttl, DELAI_TRI_MS);
    } catch (e) {
        triAbandonne = true;
        console.warn(`[gutenberg] tri « ${extra.replace(/^&/, '')} » sans reponse `
            + `(${e.message}) — liste rendue SANS tri pour cette session.`);
        return getJson(base, ttl);
    }
}

async function browse({ limit = PER, offset = 0 } = {}, extra = '') {
    const off = Math.max(0, +offset || 0);
    const lim = Math.max(1, +limit || PER);
    let page  = Math.floor(off / PER) + 1;
    let skip  = off % PER;               // entrées déjà servies sur la 1re page
    const acc = [];
    let total = 0, more = true;
    for (let n = 0; n < 4 && acc.length < lim && more; n++, page++) {
        const data = await getJsonOuSansTri(`${API}/books/?page=${page}`, extra);
        const results = (data.results || []).map(mapBook);
        total = data.count || total;
        acc.push(...results.slice(skip));
        skip = 0;
        more = !!data.next && results.length > 0;
    }
    return { total: total || off + acc.length, results: acc.slice(0, lim) };
}

// Retire l'en-tête/pied de licence Gutenberg et met en paragraphes HTML
// Décode un texte Gutenberg selon son encodage RÉEL (audit N-EXT-10) : les
// textes anciens sont parfois en ISO-8859-1 — forcer l'UTF-8 corrompt les
// accentués. En-tête « Character set encoding » d'abord, sinon UTF-8 avec
// repli Latin-1 si des caractères de remplacement apparaissent.
function decodeBook(buf) {
    if (typeof buf === 'string') return buf;
    const head = buf.slice(0, 4096).toString('latin1');
    const m = head.match(/Character set encoding\s*:\s*([\w-]+)/i);
    const declared = (m && m[1] || '').toLowerCase();
    if (/8859|latin|1252/.test(declared)) return buf.toString('latin1');
    if (/utf-?8|ascii/.test(declared))    return buf.toString('utf8');
    const utf8 = buf.toString('utf8');
    const bad = (utf8.match(/�/g) || []).length;
    return bad > 2 ? buf.toString('latin1') : utf8;
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
    id:           'gutenberg',
    name:         'Project Gutenberg',
    lang:         'multi',
    baseUrl:      API,
    nsfw:         false,
    version:      '1.2.3',
    unit:      'chapter',
    type:         'book',
    description:  'Project Gutenberg — 70 000+ livres et romans du domaine public (classiques FR/EN/DE/ES…). Lecture en texte, 100% légal et gratuit.',
    capabilities: ['popular', 'latest', 'search', 'manga', 'chapters', 'text'],
    // Audit AMEL-64 : ces livres sont du domaine public — leur fiche et leur
    // sommaire ne changeront JAMAIS. Le defaut global (15 min / 5 min) fait
    // re-interroger l'API pour rien. 24 h, le plafond autorise.
    cacheTtl:     86400,

    async popular(opts = {}) { return browse(opts, '&sort=popular'); },
    async latest(opts = {})  { return browse(opts, '&sort=descending'); },   // ids récents = ajouts récents

    async search({ q, limit = PER, offset = 0 } = {}) {
        if (!q) return this.popular({ limit, offset });
        return browse({ limit, offset }, `&search=${encodeURIComponent(q)}`);
    },

    // Le slash final, ici aussi : `/books/78027` PEND (22 s), `/books/78027/`
    // repond en 0,08 s. Mesure du 9 novembre. Meme cause que pour les
    // listes — la redirection de Gutendex est devenue un piege.
    async getManga(id) {
        const b = await getJson(`${API}/books/${encodeURIComponent(id)}/`);
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
        const b = await getJson(`${API}/books/${encodeURIComponent(id)}/`);
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
                const r = await curlGet(url, 48 * 1024 * 1024, true);   // Buffer brut
                if (r && r.length > 500) { raw = r; break; }
            } catch (e) { /* essaie le suivant */ }
        }
        if (!raw) throw new Error('Texte du livre indisponible');
        return { title: b.title || null, content: textToHtml(decodeBook(raw)) };
    },
};
