// ============================================================
// anilist.controller.js — Config OAuth AniList (implicit grant)
// ============================================================
// L'OAuth AniList se fait côté client (implicit grant : le token
// arrive dans le fragment d'URL). Le serveur ne fait qu'exposer
// le client_id public et l'URI de redirection à enregistrer.
// ============================================================

const axios = require('axios');
const _simCache = new Map();
const SIM_TTL = 24 * 3600 * 1000;
const SIM_QUERY = `query ($s: String) {
  Media(search: $s, type: MANGA, sort: SEARCH_MATCH) {
    recommendations(sort: RATING_DESC, perPage: 14) {
      nodes { mediaRecommendation { id title { romaji english } coverImage { large extraLarge } } }
    }
  }
}`;

async function similar(req, res, next) {
    try {
        const title = (req.query.title || '').trim();
        if (!title) return res.json({ items: [] });
        const key = title.toLowerCase();
        const hit = _simCache.get(key);
        if (hit && hit.exp > Date.now()) return res.json(hit.data);
        let items = [];
        try {
            const r = await axios.post('https://graphql.anilist.co',
                { query: SIM_QUERY, variables: { s: title } },
                { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, timeout: 12000 });
            const nodes = r.data?.data?.Media?.recommendations?.nodes || [];
            items = nodes.map(n => n.mediaRecommendation).filter(Boolean).map(m => ({
                id: m.id,
                title: m.title?.romaji || m.title?.english || '',
                cover: m.coverImage?.large || m.coverImage?.extraLarge || null,
            })).filter(x => x.title);
        } catch (e) { /* AniList indispo */ }
        const data = { items };
        _simCache.set(key, { data, exp: Date.now() + SIM_TTL });
        res.json(data);
    } catch (e) { next(e); }
}

function config(_req, res) {
    const clientId = process.env.ANILIST_CLIENT_ID || '';
    const redirectUri = process.env.ANILIST_REDIRECT_URI ||
        `http://127.0.0.1:${process.env.PORT || 8088}/anilist.html`;
    res.json({
        configured: !!clientId,
        clientId,
        redirectUri,
        authorizeBase: 'https://anilist.co/api/v2/oauth/authorize',
    });
}

module.exports = { config, similar };
