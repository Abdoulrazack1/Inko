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
// 43908 = client « Inko » avec Redirect URL http://127.0.0.1:8088/anilist.html
// vérifiée (le 43907 renvoyait un 404 AniList après login : redirect absente).
const DEFAULT_CLIENT_ID = '43908';

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

// Cache borné (audit §3) : même correction qu'artwork.controller — l'ancienne
// Map sans éviction fuyait lentement sur un hub 24/7.
const BoundedCache = require('../lib/bounded-cache');
const SIM_TTL = 24 * 3600 * 1000;
const _simCache = new BoundedCache({ max: 500, ttl: SIM_TTL });
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
        if (hit) return res.json(hit);
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
        _simCache.set(key, data);
        res.json(data);
    } catch (e) { next(e); }
}

// ── SEC-29 : requêtes PUBLIQUES relayées par le serveur ─────────
// La fiche série demandait la note moyenne et l'identifiant AniList d'une
// œuvre directement depuis le navigateur, même sans compte AniList lié :
// AniList voyait l'adresse de chaque lecteur qui ouvrait une fiche. Les
// requêtes sont fixées ICI, par nom — le client ne fournit que des
// variables bornées, jamais du GraphQL. Seule la synchronisation d'un
// compte lié (choisie par l'utilisateur, jeton personnel) reste directe.
const PUBLIQUES = {
    recherche: {
        query: 'query ($s: String) { Page(perPage: 6) { media(search: $s, type: MANGA) { id title { romaji english native } synonyms } } }',
        variables: (v) => ({ s: String(v.s || '').slice(0, 200) }),
        valide: (v) => !!v.s,
    },
    note: {
        query: 'query ($id: Int) { Media(id: $id, type: MANGA) { id averageScore meanScore popularity } }',
        variables: (v) => ({ id: Number(v.id) }),
        valide: (v) => Number.isInteger(v.id) && v.id > 0,
    },
    fiche: {
        query: 'query ($id: Int) { Media(id: $id) { id siteUrl title { romaji english native } } }',
        variables: (v) => ({ id: Number(v.id) }),
        valide: (v) => Number.isInteger(v.id) && v.id > 0,
    },
};
const _pubCache = new BoundedCache({ max: 2000, ttl: 6 * 3600 * 1000 });

async function publique(req, res, next) {
    try {
        const def = PUBLIQUES[req.params.nom];
        if (!def) return res.status(404).json({ error: 'Requête inconnue' });
        const variables = def.variables(req.query || {});
        if (!def.valide(variables)) return res.status(400).json({ error: 'Paramètres invalides' });
        const cle = req.params.nom + ':' + JSON.stringify(variables).toLowerCase();
        const hit = _pubCache.get(cle);
        if (hit) return res.json(hit);
        let r;
        try {
            r = await axios.post('https://graphql.anilist.co', { query: def.query, variables },
                { headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, timeout: 12000, validateStatus: () => true });
        } catch (e) {
            return res.status(502).json({ error: 'AniList injoignable' });
        }
        if (r.status === 429) {
            if (res.set) res.set('Retry-After', String(r.headers?.['retry-after'] || 60));
            return res.status(429).json({ error: 'Limite AniList atteinte' });
        }
        const data = r.data && r.data.data;
        if (!data) return res.status(502).json({ error: (r.data?.errors?.[0]?.message) || 'Erreur AniList' });
        _pubCache.set(cle, { data });
        res.json({ data });
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

module.exports = { config, similar, setConfig, publique, _internes: { PUBLIQUES } };
