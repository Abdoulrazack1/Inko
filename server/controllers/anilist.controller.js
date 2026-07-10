// ============================================================
// anilist.controller.js — Config OAuth AniList (implicit grant)
// ============================================================
// L'OAuth AniList se fait côté client (implicit grant : le token
// arrive dans le fragment d'URL). Le serveur ne fait qu'exposer
// le client_id public et l'URI de redirection à enregistrer.
// ============================================================

const axios = require('axios');
const fs    = require('fs');
const path  = require('path');

// ── Client AniList officiel d'Inko (embarqué, façon Mihon) ──────
// Enregistré sur anilist.co avec Redirect URL
// http://127.0.0.1:8088/anilist.html — le port de l'app desktop.
// Le consommateur n'a rien à configurer : « Connecter » suffit.
// Reste remplaçable via ANILIST_CLIENT_ID (env) ou config/anilist.json
// pour un self-host sur un autre port.
const DEFAULT_CLIENT_ID = '43907';

// Client ID AniList : env > fichier config > client embarqué.
const ANILIST_CFG_PATH = path.join(__dirname, '..', 'config', 'anilist.json');
function getAnilistClientId() {
    if (process.env.ANILIST_CLIENT_ID) return process.env.ANILIST_CLIENT_ID.trim();
    try {
        const v = (JSON.parse(fs.readFileSync(ANILIST_CFG_PATH, 'utf8')).clientId || '').trim();
        if (v) return v;
    } catch (e) { /* pas de fichier : client embarqué */ }
    return DEFAULT_CLIENT_ID;
}
function setAnilistClientIdFile(clientId) {
    fs.mkdirSync(path.dirname(ANILIST_CFG_PATH), { recursive: true });
    fs.writeFileSync(ANILIST_CFG_PATH, JSON.stringify({ clientId: (clientId || '').trim() }, null, 2));
}

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
    const clientId = getAnilistClientId();
    const redirectUri = process.env.ANILIST_REDIRECT_URI ||
        `http://127.0.0.1:${process.env.PORT || 8088}/anilist.html`;
    res.json({
        configured: !!clientId,
        clientId,
        redirectUri,
        viaEnv: !!process.env.ANILIST_CLIENT_ID,
        builtin: !!clientId && clientId === DEFAULT_CLIENT_ID,
        authorizeBase: 'https://anilist.co/api/v2/oauth/authorize',
    });
}

// Définit le Client ID AniList depuis l'app (Paramètres / carte de connexion). Authentifié.
function setConfig(req, res, next) {
    try {
        if (process.env.ANILIST_CLIENT_ID)
            return res.status(409).json({ error: 'Client ID défini par variable d’environnement (ANILIST_CLIENT_ID).' });
        const v = String((req.body || {}).clientId || '').trim();
        if (v && !/^\d{3,8}$/.test(v))
            return res.status(400).json({ error: 'Client ID AniList invalide (identifiant numérique attendu).' });
        setAnilistClientIdFile(v);
        res.json({ ok: true, configured: !!v });
    } catch (e) { next(e); }
}

module.exports = { config, similar, setConfig };
