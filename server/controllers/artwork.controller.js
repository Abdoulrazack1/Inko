// ============================================================
// artwork.controller.js — Illustrations officielles (AniList)
// ============================================================
// Récupère le bannerImage (key visual large) d'une œuvre via l'API
// publique AniList, pour un hero de qualité au lieu d'étirer un cover.
// Réponses mises en cache 24h (AniList limite à ~90 req/min).
// ============================================================
const axios = require('axios');

const cache = new Map();           // titre (lower) -> { data, exp }
const TTL = 24 * 3600 * 1000;
const QUERY = `query ($s: String) {
  Media(search: $s, type: MANGA, sort: SEARCH_MATCH) {
    id
    title { romaji english }
    bannerImage
    coverImage { extraLarge large }
  }
}`;

async function artwork(req, res, next) {
    try {
        const title = (req.query.title || '').trim();
        if (!title) return res.json({ banner: null, cover: null, title: null });

        const key = title.toLowerCase();
        const hit = cache.get(key);
        if (hit && hit.exp > Date.now()) return res.json(hit.data);

        let data = { banner: null, cover: null, title: null };
        try {
            const r = await axios.post('https://graphql.anilist.co',
                { query: QUERY, variables: { s: title } },
                { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, timeout: 12000 });
            const m = r.data?.data?.Media;
            if (m) data = {
                id:     m.id || null,
                banner: m.bannerImage || null,
                cover:  m.coverImage?.extraLarge || m.coverImage?.large || null,
                title:  m.title?.romaji || m.title?.english || null,
            };
        } catch (e) { /* AniList indispo : on renvoie null, le front retombe sur le cover */ }

        cache.set(key, { data, exp: Date.now() + TTL });
        res.json(data);
    } catch (e) { next(e); }
}

module.exports = { artwork };
