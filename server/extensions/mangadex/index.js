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
const UA          = 'Inko/1.0 (personal-reader; +https://github.com/Abdoulrazack1/Inko)';

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
    const { data } = await http.get(path, { params });
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
    version:     '1.0.0',
    description: 'Source officielle MangaDex API (scanlations communautaires, 80 000+ titres)',
    capabilities: ['popular', 'latest', 'search', 'manga', 'chapters', 'pages', 'tags'],

    async popular({ limit = 20, offset = 0 } = {}) {
        const data = await call('/manga', {
            limit: Math.min(+limit || 20, 100),
            offset: +offset || 0,
            'includes[]': ['cover_art', 'author', 'artist'],
            'order[followedCount]': 'desc',
            'contentRating[]': ['safe', 'suggestive'],
        }, 600_000);
        return { total: data.total, results: (data.data || []).map(mapManga) };
    },

    async latest({ limit = 20, offset = 0 } = {}) {
        const data = await call('/manga', {
            limit: Math.min(+limit || 20, 100),
            offset: +offset || 0,
            'includes[]': ['cover_art', 'author', 'artist'],
            'order[latestUploadedChapter]': 'desc',
            'contentRating[]': ['safe', 'suggestive'],
        }, 300_000);
        return { total: data.total, results: (data.data || []).map(mapManga) };
    },

    async search({ q, limit = 20, offset = 0, filters = {} } = {}) {
        const params = {
            limit: Math.min(+limit || 20, 100),
            offset: +offset || 0,
            'includes[]': ['cover_art', 'author', 'artist'],
            'order[followedCount]': 'desc',
            'contentRating[]': filters.contentRating || ['safe', 'suggestive'],
        };
        if (q) params.title = q;
        if (filters.demographic) params['publicationDemographic[]'] = [filters.demographic];
        if (filters.status)      params['status[]']                = [filters.status];
        if (filters.includedTags?.length) params['includedTags[]'] = filters.includedTags;

        const data = await call('/manga', params, 120_000);
        return { total: data.total, results: (data.data || []).map(mapManga) };
    },

    async getManga(id) {
        const data = await call(`/manga/${id}`, {
            'includes[]': ['cover_art', 'author', 'artist'],
        }, 300_000);
        return mapManga(data.data);
    },

    async getChapters(mangaId, { lang, limit = 200, offset = 0 } = {}) {
        const params = {
            limit: Math.min(+limit || 200, 500),
            offset: +offset || 0,
            'order[chapter]': 'desc',
            'translatedLanguage[]': (lang || 'fr,en').split(','),
            'contentRating[]': ['safe', 'suggestive', 'erotica'],
            includeFutureUpdates: 0,
        };
        const data = await call(`/manga/${mangaId}/feed`, params, 60_000);

        // Déduplique par numéro de chapitre (préférence fr > en > autre)
        const byNum = new Map();
        (data.data || []).forEach(c => {
            const m = mapChapter(c);
            if (m.chapter === null || m.externalUrl) return;
            const cur = byNum.get(m.chapter);
            const score = (x) => x.lang === 'fr' ? 2 : x.lang === 'en' ? 1 : 0;
            if (!cur || score(m) > score(cur)) byNum.set(m.chapter, m);
        });
        return {
            total: data.total,
            results: [...byNum.values()].sort((a, b) => b.chapter - a.chapter),
        };
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
