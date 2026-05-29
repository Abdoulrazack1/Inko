// services/mangadex.js — Client + cache mémoire vers l'API MangaDex
// ──────────────────────────────────────────────────────────────
// USAGE PERSONNEL : ce backend agit comme un client MangaDex
// (équivalent Tachiyomi/Paperback côté serveur). Il ne stocke
// pas les images, il les sert via les URLs MangaDex@Home.
// L'utilisateur est responsable de l'usage qu'il en fait.
// Doc API : https://api.mangadex.org/docs
// ──────────────────────────────────────────────────────────────
const axios = require('axios');

const BASE        = process.env.MANGADEX_BASE || 'https://api.mangadex.org';
const COVERS_BASE = process.env.COVERS_BASE   || 'https://uploads.mangadex.org/covers';
const UA          = 'Inko/1.0 (personal-reader)';

// ── Cache mémoire avec TTL ────────────────────────────────────
const cache = new Map();

function getCache(key) {
    const e = cache.get(key);
    if (!e) return null;
    if (e.expires < Date.now()) { cache.delete(key); return null; }
    return e.value;
}
function setCache(key, value, ttlMs = 60_000) {
    cache.set(key, { value, expires: Date.now() + ttlMs });
}

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

// ── Mappers : MangaDex → format Inko ──────────────────────
function pickTitle(t) {
    if (!t) return '';
    return t.en || t.fr || t['ja-ro'] || t.ja || Object.values(t)[0] || '';
}
function relsByType(rels, type) {
    return (rels || []).filter(r => r.type === type);
}
function coverFile(rels) {
    const c = relsByType(rels, 'cover_art')[0];
    return c?.attributes?.fileName || null;
}
function authorName(rels) {
    const a = relsByType(rels, 'author')[0] || relsByType(rels, 'artist')[0];
    return a?.attributes?.name || '';
}

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

// ── API publiques ────────────────────────────────────────
async function search({ q, limit = 20, offset = 0, demographic, status, includedTags, contentRating } = {}) {
    const params = {
        limit: Math.min(+limit || 20, 100),
        offset: +offset || 0,
        'includes[]': ['cover_art', 'author', 'artist'],
        'order[followedCount]': 'desc',
        'contentRating[]': contentRating || ['safe', 'suggestive'],
    };
    if (q) params.title = q;
    if (demographic) params['publicationDemographic[]'] = [demographic];
    if (status) params['status[]'] = [status];
    if (includedTags?.length) params['includedTags[]'] = includedTags;

    const data = await call('/manga', params, 120_000);
    return { total: data.total, results: (data.data || []).map(mapManga) };
}

async function getManga(id) {
    const data = await call(`/manga/${id}`, {
        'includes[]': ['cover_art', 'author', 'artist'],
    }, 300_000);
    return mapManga(data.data);
}

async function getMangaChapters(id, { lang, limit = 200, offset = 0 } = {}) {
    const params = {
        limit: Math.min(+limit || 200, 500),
        offset: +offset || 0,
        'order[chapter]': 'desc',
        'translatedLanguage[]': (lang || 'fr,en').split(','),
        'contentRating[]': ['safe', 'suggestive', 'erotica'],
        includeFutureUpdates: 0,
    };
    const data = await call(`/manga/${id}/feed`, params, 60_000);

    // Déduplique : un même numéro de chapitre peut avoir plusieurs
    // traductions — on garde la plus récente par numéro+langue préférée.
    const byNum = new Map();
    (data.data || []).forEach(c => {
        const m = mapChapter(c);
        if (m.chapter === null) return;
        if (m.externalUrl) return; // pas hébergé sur MangaDex
        const key = m.chapter;
        if (!byNum.has(key)) byNum.set(key, m);
        else {
            const cur = byNum.get(key);
            // Préférence : fr > en > autre
            const score = (x) => x.lang === 'fr' ? 2 : x.lang === 'en' ? 1 : 0;
            if (score(m) > score(cur)) byNum.set(key, m);
        }
    });

    return {
        total: data.total,
        results: [...byNum.values()].sort((a, b) => b.chapter - a.chapter),
    };
}

async function getChapterPages(chapterId) {
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
}

async function getPopular({ limit = 20 } = {}) {
    const params = {
        limit: Math.min(+limit || 20, 100),
        'includes[]': ['cover_art', 'author', 'artist'],
        'order[followedCount]': 'desc',
        'contentRating[]': ['safe', 'suggestive'],
    };
    const data = await call('/manga', params, 600_000);
    return { total: data.total, results: (data.data || []).map(mapManga) };
}

async function getLatest({ limit = 20 } = {}) {
    const params = {
        limit: Math.min(+limit || 20, 100),
        'includes[]': ['cover_art', 'author', 'artist'],
        'order[latestUploadedChapter]': 'desc',
        'contentRating[]': ['safe', 'suggestive'],
    };
    const data = await call('/manga', params, 300_000);
    return { total: data.total, results: (data.data || []).map(mapManga) };
}

async function getTags() {
    const data = await call('/manga/tag', {}, 24 * 3600_000);
    return (data.data || []).map(t => ({
        id: t.id,
        name: pickTitle(t.attributes?.name),
        group: t.attributes?.group,
    })).sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = {
    search, getManga, getMangaChapters, getChapterPages,
    getPopular, getLatest, getTags,
};
