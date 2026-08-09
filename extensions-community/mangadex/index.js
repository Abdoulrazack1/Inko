// ============================================================
// MangaDex — extension Inko (modèle Mihon)
// ============================================================
// Wrap l'API publique MangaDex (https://api.mangadex.org).
// Le backend ne stocke aucune image : tout transite par les URLs
// MangaDex@Home (équivalent client de Tachiyomi/Paperback).
// ============================================================
const axios = require('axios');

const BASE        = 'https://api.mangadex.org';
const COVERS_BASE = 'https://uploads.mangadex.org/covers';
// L'API MangaDex EXIGE un User-Agent identifiant le client (règle officielle) :
// un UA de navigateur générique est rejeté par un 400 HTML. Version reprise de
// l'app quand elle est connue (audit : l'ancienne valeur figée dérivait).
const UA          = `Inko/${process.env.APP_VERSION || '2.2'} (+https://github.com/Abdoulrazack1/Inko)`;

// ── Cache mémoire avec TTL ──
const cache = new Map();
function getCache(k)        { const e = cache.get(k); if (!e) return null; if (e.expires < Date.now()) { cache.delete(k); return null; } return e.value; }
function setCache(k, v, ms = 60_000) { cache.set(k, { value: v, expires: Date.now() + ms }); }

const http = axios.create({
    baseURL: BASE,
    timeout: 15_000,
    headers: { 'User-Agent': UA },
});

async function call(path, params = {}, ttlMs = 60_000) {
    const key = `${path}?${JSON.stringify(params)}`;
    const cached = getCache(key);
    if (cached) return cached;
    // Rate-limit (audit F.15) : un seul réessai après Retry-After (borné 10 s)
    // sur 429/503, et un message lisible plutôt qu'une erreur axios brute.
    let data;
    try {
        ({ data } = await http.get(path, { params }));
    } catch (e) {
        const st = e.response?.status;
        if (st !== 429 && st !== 503) throw e;
        const wait = Math.min(parseInt(e.response.headers?.['retry-after'], 10) || 2, 10) * 1000;
        await new Promise(r => setTimeout(r, wait));
        try {
            ({ data } = await http.get(path, { params }));
        } catch (e2) {
            const st2 = e2.response?.status;
            if (st2 === 429 || st2 === 503) throw new Error('MangaDex limite temporairement les requêtes — réessaie dans un instant');
            throw e2;
        }
    }
    setCache(key, data, ttlMs);
    return data;
}

// ── Mappers ──
function pickTitle(t) {
    if (!t) return '';
    return t.en || t.fr || t['ja-ro'] || t.ja || Object.values(t)[0] || '';
}
function relsByType(rels, type) { return (rels || []).filter(r => r.type === type); }
function coverFile(rels)        { const c = relsByType(rels, 'cover_art')[0]; return c?.attributes?.fileName || null; }
function authorName(rels)       { const a = relsByType(rels, 'author')[0] || relsByType(rels, 'artist')[0]; return a?.attributes?.name || ''; }

function mapManga(m) {
    const a = m.attributes || {};
    const cover = coverFile(m.relationships);
    return {
        id:           m.id,
        title:        pickTitle(a.title),
        titleAlt:     pickTitle(a.altTitles?.[0]),
        author:       authorName(m.relationships),
        description:  pickTitle(a.description) || '',
        status:       a.status,
        year:         a.year,
        contentRating: a.contentRating,
        demographic:  a.publicationDemographic,
        tags:         (a.tags || []).map(t => pickTitle(t.attributes?.name)).filter(Boolean),
        cover:        cover ? `${COVERS_BASE}/${m.id}/${cover}.512.jpg` : null,
        coverLarge:   cover ? `${COVERS_BASE}/${m.id}/${cover}` : null,
        coverThumb:   cover ? `${COVERS_BASE}/${m.id}/${cover}.256.jpg` : null,
        rating:       a.rating,
        lastChapter:  a.lastChapter,
        langs:        a.availableTranslatedLanguages || [],
    };
}

function mapChapter(c) {
    const a = c.attributes || {};
    return {
        id:           c.id,
        chapter:      a.chapter ? parseFloat(a.chapter) : null,
        volume:       a.volume,
        title:        a.title || null,
        lang:         a.translatedLanguage,
        pages:        a.pages || 0,
        publishedAt:  a.publishAt || a.publishedAt,
        externalUrl:  a.externalUrl || null,
    };
}

// ── Source export ──
module.exports = {
    id:          'mangadex',
    name:        'MangaDex',
    lang:        'multi',
    baseUrl:     BASE,
    nsfw:        false,
    version:     '1.3.0',
    unit:      'chapter',
    description: 'Source officielle MangaDex API (scanlations communautaires, 80 000+ titres)',
    capabilities: ['popular', 'latest', 'search', 'manga', 'chapters', 'pages', 'tags'],
    // Filtres REELLEMENT honores par cette source. Meme principe que `sorts`
    // (audit BUG-06) : l'interface n'affiche pas un controle qui ne ferait
    // rien. `year` et `contentRating` etaient d'ailleurs deja acceptes ici
    // sans qu'aucune interface ne les propose.
    // `year` est une annee EXACTE, pas un intervalle : c'est ce que l'API
    // accepte, et annoncer une fourchette qu'elle ne sait pas traiter
    // reviendrait a proposer un filtre qui ment.
    filters: ['status', 'demographic', 'tags', 'excludedTags', 'year', 'contentRating', 'lang'],

    // UUIDs MangaDex des tags adultes à masquer hors espace +18
    _ADULT_TAGS: [
        '9ab53f92-3eed-4e9b-903a-917c86035ee3', // Ecchi
        '5920b825-4181-4a17-beeb-9918b0ff7a30', // Boys' Love (optionnel — sensible)
    ],
    _ECCHI: '9ab53f92-3eed-4e9b-903a-917c86035ee3',

    // Niveau de contenu selon le flag adult :
    //   adult absent / '0'   → SFW (safe, suggestive) + Ecchi exclu
    //   adult === 'only'     → +18 uniquement  (erotica, pornographic)
    //   adult === '1'/'all'  → tout
    _ratings(adult) {
        if (adult === 'only')             return ['erotica', 'pornographic'];
        if (adult === '1' || adult === 'all' || adult === true) return ['safe', 'suggestive', 'erotica', 'pornographic'];
        return ['safe', 'suggestive'];
    },
    _isAdult(adult) { return adult === 'only' || adult === '1' || adult === 'all' || adult === true; },

    async popular({ limit = 20, offset = 0, adult } = {}) {
        const params = {
            limit: Math.min(+limit || 20, 100),
            offset: +offset || 0,
            'includes[]': ['cover_art', 'author', 'artist'],
            'order[followedCount]': 'desc',
            'contentRating[]': this._ratings(adult),
        };
        if (!this._isAdult(adult)) params['excludedTags[]'] = [this._ECCHI];
        if (adult === 'only')      params['includedTags[]'] = [this._ECCHI], delete params['excludedTags[]'];
        const data = await call('/manga', params, 600_000);
        return { total: data.total, results: (data.data || []).map(mapManga) };
    },

    async latest({ limit = 20, offset = 0, adult } = {}) {
        const params = {
            limit: Math.min(+limit || 20, 100),
            offset: +offset || 0,
            'includes[]': ['cover_art', 'author', 'artist'],
            'order[latestUploadedChapter]': 'desc',
            'contentRating[]': this._ratings(adult),
        };
        if (!this._isAdult(adult)) params['excludedTags[]'] = [this._ECCHI];
        const data = await call('/manga', params, 300_000);
        return { total: data.total, results: (data.data || []).map(mapManga) };
    },

    // Tri UI (normalisé) → paramètre d'ordre MangaDex
    _SORT: {
        popularity: { 'order[followedCount]': 'desc' },
        latest:     { 'order[latestUploadedChapter]': 'desc' },
        rating:     { 'order[rating]': 'desc' },
        alpha:      { 'order[title]': 'asc' },
        added:      { 'order[createdAt]': 'desc' },
        year:       { 'order[year]': 'desc' },
    },

    async search({ q, limit = 20, offset = 0, filters = {} } = {}) {
        const params = {
            limit: Math.min(+limit || 20, 100),
            offset: +offset || 0,
            'includes[]': ['cover_art', 'author', 'artist'],
            ...(this._SORT[filters.sort] || { 'order[followedCount]': 'desc' }),
            'contentRating[]': filters.contentRating || this._ratings(filters.adult),
        };
        if (q) params.title = q;
        const arr = (v) => v == null ? [] : (Array.isArray(v) ? v : [v]);
        const dem = arr(filters.demographic); if (dem.length) params['publicationDemographic[]'] = dem;
        const st  = arr(filters.status);      if (st.length)  params['status[]']                = st;
        if (filters.year)        params.year                       = filters.year;
        // Langue de traduction disponible : c'est la question qu'on se pose
        // vraiment devant un catalogue international — « est-ce lisible dans
        // ma langue ? ». MangaDex l'expose, personne ne la demandait.
        const langs = arr(filters.lang || filters['lang[]']).filter(Boolean);
        if (langs.length) params['availableTranslatedLanguage[]'] = langs;
        const inc = arr(filters.includedTags || filters['includedTags[]']);
        if (inc.length) params['includedTags[]'] = inc;

        // Audit AMEL-05 : exclusion de genres. MangaDex la gère nativement,
        // donc le filtrage se fait EN AMONT — la page revient déjà complète,
        // sans le trou qu'un retrait après coup laisserait.
        // Attention : `excludedTags[]` servait déjà à masquer l'Ecchi hors
        // +18. Écraser le tableau ferait réapparaître du contenu adulte au
        // premier genre exclu par l'utilisateur ; on CUMULE.
        // MangaDex n'accepte que des UUID de tags. Un NOM (« Action ») lui fait
        // renvoyer zéro résultat, sans erreur — un catalogue vide et aucune
        // explication. L'interface envoie bien des UUID (loadTags les fournit),
        // mais on ne laisse pas ce piège au prochain appelant : ce qui n'est
        // pas un UUID n'est pas transmis, et le filtrage générique du
        // contrôleur (par nom de tag) s'en charge après coup.
        const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        const exc = arr(filters.excludedTags || filters['excludedTags[]']).filter(t => UUID.test(String(t)));
        const exclusions = new Set(exc);
        if (!this._isAdult(filters.adult)) exclusions.add(this._ECCHI);
        if (exclusions.size) params['excludedTags[]'] = [...exclusions];

        const data = await call('/manga', params, 120_000);
        return { total: data.total, results: (data.data || []).map(mapManga) };
    },

    async getManga(id) {
        const data = await call(`/manga/${id}`, {
            'includes[]': ['cover_art', 'author', 'artist'],
        }, 300_000);
        return mapManga(data.data);
    },

    async getChapters(mangaId, { lang, limit } = {}) {
        // Le feed est paginé à 500 entrées max : on boucle jusqu'au bout pour
        // ne JAMAIS tronquer les longues séries (One Piece ≈ 1100 chapitres,
        // multipliés par le nombre de langues demandées).
        // `limit` explicite (ex : check de MAJ) → plafonne le nombre d'entrées lues.
        const cap = +limit > 0 ? Math.min(+limit, 8000) : 8000;
        const baseParams = {
            'order[chapter]': 'desc',
            'translatedLanguage[]': (lang || 'fr,en').split(','),
            'contentRating[]': ['safe', 'suggestive', 'erotica'],
            includeFutureUpdates: 0,
        };
        let offset = 0, total = Infinity;
        const entries = [];
        while (offset < total && offset < cap) {
            const pageSize = Math.min(500, cap - offset);
            const data = await call(`/manga/${mangaId}/feed`, { ...baseParams, limit: pageSize, offset }, 60_000);
            total = data.total ?? 0;
            const batch = data.data || [];
            entries.push(...batch);
            if (!batch.length) break;
            offset += batch.length;
        }

        // Déduplique par numéro de chapitre (préférence fr > en > autre)
        const byNum = new Map();
        entries.forEach(c => {
            const m = mapChapter(c);
            if (m.chapter === null || m.externalUrl) return;
            const cur = byNum.get(m.chapter);
            const score = (x) => x.lang === 'fr' ? 2 : x.lang === 'en' ? 1 : 0;
            if (!cur || score(m) > score(cur)) byNum.set(m.chapter, m);
        });
        const results = [...byNum.values()].sort((a, b) => b.chapter - a.chapter);
        return { total: results.length, results };
    },

    async getPages(chapterId) {
        const data = await call(`/at-home/server/${chapterId}`, {}, 5 * 60_000);
        const baseUrl   = data.baseUrl;
        const hash      = data.chapter?.hash;
        const dataPages = data.chapter?.data || [];
        const dataSaver = data.chapter?.dataSaver || [];
        return {
            baseUrl,
            hash,
            pages: dataPages.map((file, i) => ({
                page:     i + 1,
                url:      `${baseUrl}/data/${hash}/${file}`,
                urlSaver: dataSaver[i] ? `${baseUrl}/data-saver/${hash}/${dataSaver[i]}` : null,
            })),
        };
    },

    async getTags() {
        const data = await call('/manga/tag', {}, 24 * 3600_000);
        return (data.data || []).map(t => ({
            id: t.id,
            name: pickTitle(t.attributes?.name),
            group: t.attributes?.group,
        })).sort((a, b) => a.name.localeCompare(b.name));
    },
};
