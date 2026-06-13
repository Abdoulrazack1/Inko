// ============================================================
// spotify.controller.js — Linking de compte Spotify (OAuth)
// ============================================================
// Flux Authorization Code :
//   1. /api/spotify/login?token=<jwt>  → redirige vers l'autorisation Spotify
//   2. Spotify renvoie vers /api/spotify/callback?code=…&state=<jwt>
//   3. On échange le code contre access+refresh tokens, on lit le profil,
//      on stocke le tout par utilisateur.
//   4. Le front lit /api/spotify/status (profil + token frais) et
//      /api/spotify/playlists.
// ============================================================
const axios = require('axios');
const jwt   = require('jsonwebtoken');
const { pool } = require('../config/db');

const SECRET   = process.env.JWT_SECRET || 'change-me';
const CLIENT   = process.env.SPOTIFY_CLIENT_ID;
const CSECRET  = process.env.SPOTIFY_CLIENT_SECRET;
const REDIRECT = process.env.SPOTIFY_REDIRECT_URI || 'http://127.0.0.1:8088/api/spotify/callback';
const SCOPES   = [
    'user-read-private', 'user-read-email',
    'playlist-read-private', 'playlist-read-collaborative',
    'user-read-playback-state', 'user-modify-playback-state',
    'user-read-currently-playing', 'user-read-recently-played',
    'user-top-read', 'streaming',
].join(' ');

function configured() { return !!(CLIENT && CSECRET); }

// Lit le user depuis req.user / req.userId (cookie ou Bearer via middleware)
// ou ?token=<jwt> (navigation top-level, ex. window.open)
function userIdFrom(req) {
    if (req.user) return req.user.id;
    if (req.userId) return req.userId;
    const t = req.query.token;
    if (t) { try { return jwt.verify(t, SECRET).uid; } catch (e) {} }
    return null;
}

// ── 1. Démarrage de l'autorisation ──
function login(req, res) {
    if (!configured())
        return res.status(503).send('Spotify non configuré côté serveur (SPOTIFY_CLIENT_ID/SECRET manquants dans server/.env).');
    const uid = userIdFrom(req);
    if (!uid) return res.status(401).send('Non authentifié');

    const state = jwt.sign({ uid }, SECRET, { expiresIn: '10m' });
    const url = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
        response_type: 'code',
        client_id: CLIENT,
        scope: SCOPES,
        redirect_uri: REDIRECT,
        state,
        show_dialog: 'true',
    }).toString();
    res.redirect(url);
}

// ── 2. Callback : échange du code ──
async function callback(req, res, next) {
    try {
        const { code, state, error } = req.query;
        if (error) return res.redirect('/parametres.html?spotify=denied');
        let uid;
        try { uid = jwt.verify(state, SECRET).uid; }
        catch (e) { return res.redirect('/parametres.html?spotify=badstate'); }

        // Échange code → tokens
        const tok = await axios.post('https://accounts.spotify.com/api/token',
            new URLSearchParams({
                grant_type: 'authorization_code',
                code,
                redirect_uri: REDIRECT,
            }).toString(),
            { headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(`${CLIENT}:${CSECRET}`).toString('base64'),
            } }
        );
        const { access_token, refresh_token, expires_in } = tok.data;

        // Profil
        const me = await axios.get('https://api.spotify.com/v1/me', {
            headers: { Authorization: 'Bearer ' + access_token },
        });
        const p = me.data;

        await pool.query(
            `INSERT INTO spotify_accounts
                (user_id, spotify_id, display_name, avatar, product, access_token, refresh_token, expires_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                spotify_id=VALUES(spotify_id), display_name=VALUES(display_name),
                avatar=VALUES(avatar), product=VALUES(product),
                access_token=VALUES(access_token), refresh_token=VALUES(refresh_token),
                expires_at=VALUES(expires_at)`,
            [uid, p.id, p.display_name || p.id, p.images?.[0]?.url || null, p.product || null,
             access_token, refresh_token, Date.now() + (expires_in * 1000)]
        );
        res.redirect('/parametres.html?spotify=linked');
    } catch (e) {
        console.error('[spotify] callback', e.response?.data || e.message);
        res.redirect('/parametres.html?spotify=error');
    }
}

// Renvoie un access token valide (rafraîchi si expiré)
async function validToken(uid) {
    const [[row]] = await pool.query('SELECT * FROM spotify_accounts WHERE user_id = ?', [uid]);
    if (!row) return null;
    if (row.expires_at - 30_000 > Date.now()) return row;   // encore valide

    // Refresh
    try {
        const tok = await axios.post('https://accounts.spotify.com/api/token',
            new URLSearchParams({ grant_type: 'refresh_token', refresh_token: row.refresh_token }).toString(),
            { headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(`${CLIENT}:${CSECRET}`).toString('base64'),
            } }
        );
        const { access_token, expires_in, refresh_token } = tok.data;
        const newExpires = Date.now() + expires_in * 1000;
        await pool.query(
            'UPDATE spotify_accounts SET access_token=?, expires_at=?, refresh_token=COALESCE(?, refresh_token) WHERE user_id=?',
            [access_token, newExpires, refresh_token || null, uid]
        );
        row.access_token = access_token;
        row.expires_at   = newExpires;
        return row;
    } catch (e) {
        return row; // au pire on renvoie l'ancien
    }
}

// ── Statut : profil lié + token frais ──
async function status(req, res, next) {
    try {
        if (!configured()) return res.json({ configured: false, linked: false });
        const row = await validToken(req.user.id);
        if (!row) return res.json({ configured: true, linked: false });
        res.json({
            configured: true, linked: true,
            profile: { id: row.spotify_id, name: row.display_name, avatar: row.avatar, product: row.product },
            accessToken: row.access_token,
            expiresAt: row.expires_at,
        });
    } catch (e) { next(e); }
}

async function disconnect(req, res, next) {
    try {
        await pool.query('DELETE FROM spotify_accounts WHERE user_id = ?', [req.user.id]);
        res.json({ ok: true });
    } catch (e) { next(e); }
}

// ── Playlists de l'utilisateur ──
async function playlists(req, res, next) {
    try {
        const row = await validToken(req.user.id);
        if (!row) return res.status(404).json({ error: 'Compte Spotify non lié' });
        const r = await axios.get('https://api.spotify.com/v1/me/playlists?limit=50', {
            headers: { Authorization: 'Bearer ' + row.access_token },
        });
        res.json((r.data.items || []).map(p => ({
            id: p.id, name: p.name, uri: p.uri,
            image: p.images?.[0]?.url || null,
            tracks: p.tracks?.total || 0,
            owner: p.owner?.display_name || '',
        })));
    } catch (e) {
        if (e.response?.status === 401) return res.status(424).json({ error: 'Token Spotify expiré' }); // 424 : ne PAS renvoyer 401 (le client le traiterait comme une session Inko invalide)
        next(e);
    }
}

// ── Recherche (titres + playlists) ──
async function search(req, res, next) {
    try {
        const row = await validToken(req.user.id);
        if (!row) return res.status(404).json({ error: 'Compte Spotify non lié' });
        const q = (req.query.q || '').trim();
        if (!q) return res.json({ tracks: [], playlists: [] });
        const r = await axios.get('https://api.spotify.com/v1/search', {
            headers: { Authorization: 'Bearer ' + row.access_token },
            params: { q, type: 'track,playlist', limit: 10 },
        });
        const tracks = (r.data.tracks?.items || []).map(t => ({
            id: t.id, uri: t.uri, name: t.name,
            artists: (t.artists || []).map(a => a.name).join(', '),
            image: t.album?.images?.slice(-1)[0]?.url || t.album?.images?.[0]?.url || null,
        }));
        const playlists = (r.data.playlists?.items || []).filter(Boolean).map(p => ({
            id: p.id, uri: p.uri, name: p.name,
            owner: p.owner?.display_name || '',
            image: p.images?.[0]?.url || null,
        }));
        res.json({ tracks, playlists });
    } catch (e) {
        if (e.response?.status === 401) return res.status(424).json({ error: 'Token Spotify expiré' }); // 424 : ne PAS renvoyer 401 (le client le traiterait comme une session Inko invalide)
        next(e);
    }
}

// ── Écoutés récemment ──
async function recent(req, res, next) {
    try {
        const row = await validToken(req.user.id);
        if (!row) return res.status(404).json({ error: 'Compte Spotify non lié' });
        const r = await axios.get('https://api.spotify.com/v1/me/player/recently-played?limit=20', {
            headers: { Authorization: 'Bearer ' + row.access_token },
        });
        const seen = new Set();
        const tracks = [];
        (r.data.items || []).forEach(it => {
            const t = it.track; if (!t || seen.has(t.id)) return; seen.add(t.id);
            tracks.push({
                id: t.id, uri: t.uri, name: t.name,
                artists: (t.artists || []).map(a => a.name).join(', '),
                image: t.album?.images?.slice(-1)[0]?.url || null,
            });
        });
        res.json({ tracks: tracks.slice(0, 12) });
    } catch (e) {
        if (e.response?.status === 401) return res.status(424).json({ error: 'Token Spotify expiré' }); // 424 : ne PAS renvoyer 401 (le client le traiterait comme une session Inko invalide)
        next(e);
    }
}

function mapTrack(t) {
    if (!t) return null;
    return {
        id: t.id, uri: t.uri, name: t.name,
        artists: (t.artists || []).map(a => a.name).join(', '),
        image: t.album?.images?.slice(-1)[0]?.url || t.album?.images?.[0]?.url || null,
    };
}

// ── Titres les plus écoutés ──
async function top(req, res, next) {
    try {
        const row = await validToken(req.user.id);
        if (!row) return res.status(404).json({ error: 'Compte Spotify non lié' });
        const r = await axios.get('https://api.spotify.com/v1/me/top/tracks', {
            headers: { Authorization: 'Bearer ' + row.access_token },
            params: { limit: 12, time_range: 'short_term' },
        });
        res.json({ tracks: (r.data.items || []).map(mapTrack).filter(Boolean) });
    } catch (e) {
        if (e.response?.status === 401) return res.status(424).json({ error: 'Token Spotify expiré' }); // 424 : ne PAS renvoyer 401 (le client le traiterait comme une session Inko invalide)
        next(e);
    }
}

// ── Titres aimés (sauvegardés) ──
async function saved(req, res, next) {
    try {
        const row = await validToken(req.user.id);
        if (!row) return res.status(404).json({ error: 'Compte Spotify non lié' });
        const r = await axios.get('https://api.spotify.com/v1/me/tracks', {
            headers: { Authorization: 'Bearer ' + row.access_token },
            params: { limit: 20 },
        });
        res.json({ tracks: (r.data.items || []).map(it => mapTrack(it.track)).filter(Boolean).slice(0, 16) });
    } catch (e) {
        if (e.response?.status === 401) return res.status(424).json({ error: 'Token Spotify expiré' }); // 424 : ne PAS renvoyer 401 (le client le traiterait comme une session Inko invalide)
        next(e);
    }
}

// ── Lecture en cours sur Spotify ──
async function nowPlaying(req, res, next) {
    try {
        const row = await validToken(req.user.id);
        if (!row) return res.status(404).json({ error: 'Compte Spotify non lié' });
        const r = await axios.get('https://api.spotify.com/v1/me/player/currently-playing', {
            headers: { Authorization: 'Bearer ' + row.access_token },
            validateStatus: s => s === 200 || s === 204,
        });
        if (r.status === 204 || !r.data) return res.json({ playing: false });
        res.json({ playing: !!r.data.is_playing, track: mapTrack(r.data.item) });
    } catch (e) {
        if (e.response?.status === 401) return res.status(424).json({ error: 'Token Spotify expiré' }); // 424 : ne PAS renvoyer 401 (le client le traiterait comme une session Inko invalide)
        next(e);
    }
}

module.exports = { configured, login, callback, status, disconnect, playlists, search, recent, top, saved, nowPlaying };
