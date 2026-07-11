// ============================================================
// anilist.js — Suivi de lecture AniList (OAuth implicit, client-side)
// ============================================================
// Connexion via implicit grant (token dans le fragment, lu par
// anilist.html). Synchronise la progression / statut / note via
// l'API GraphQL d'AniList (CORS autorisé). Expose window.AniList.
// ============================================================
(function () {
    'use strict';

    const GQL = 'https://graphql.anilist.co';
    const TOKEN_KEY = 'anilist_token';
    const USER_KEY  = 'anilist_user';
    const idCache = {};   // titre -> mediaId

    // Statuts Inko -> AniList
    const STATUS_MAP = {
        reading: 'CURRENT', completed: 'COMPLETED', planned: 'PLANNING',
        paused: 'PAUSED', dropped: 'DROPPED',
    };

    let _config = null;

    async function getConfig() {
        if (_config) return _config;
        try { _config = await fetch(API.base + '/anilist/config').then(r => r.json()); }
        catch (e) { _config = { configured: false }; }
        return _config;
    }
    function clearConfigCache() { _config = null; }

    function token() { try { return localStorage.getItem(TOKEN_KEY); } catch (e) { return null; } }
    function isLinked() { return !!token(); }
    function user() { try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); } catch (e) { return null; } }

    async function gql(query, variables, withAuth) {
        const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json' };
        if (withAuth) { const t = token(); if (t) headers['Authorization'] = 'Bearer ' + t; }
        const r = await fetch(GQL, { method: 'POST', headers, body: JSON.stringify({ query, variables }) });
        let j = null;
        try { j = await r.json(); } catch (e) { j = {}; }
        if (r.status === 429 || j.errors) {
            // Expose le statut + Retry-After : indispensable pour que la synchro
            // en masse puisse ATTENDRE au lieu d'échouer en silence (limite
            // AniList ≈ 30 requêtes/min — c'était la cause du blocage à ~8 œuvres).
            const err = new Error(j.errors?.[0]?.message || (r.status === 429 ? 'Limite AniList atteinte' : 'Erreur AniList'));
            err.status = r.status;
            err.retryAfter = parseInt(r.headers.get('Retry-After') || '0', 10) || (r.status === 429 ? 60 : 0);
            throw err;
        }
        return j.data;
    }

    async function me() {
        const d = await gql('query { Viewer { id name avatar { medium } } }', {}, true);
        const v = d.Viewer;
        if (v) localStorage.setItem(USER_KEY, JSON.stringify({ id: v.id, name: v.name, avatar: v.avatar?.medium || null }));
        return v;
    }

    function disconnect() {
        try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch (e) {}
    }

    // Connexion : redirection pleine page vers AniList (flux OAuth classique).
    // La page revient sur anilist.html qui stocke le token puis renvoie ici.
    // (L'ancienne popup + polling échouait dans l'app desktop : la fenêtre
    // s'ouvrait dans le navigateur système, le token n'arrivait jamais.)
    async function connect() {
        const cfg = await getConfig();
        if (!cfg.configured) throw new Error('AniList indisponible dans cette version — mets à jour Inko');
        try { localStorage.removeItem(TOKEN_KEY); } catch (e) {}
        try { localStorage.setItem('anilist_return', location.pathname + location.search); } catch (e) {}
        const url = `${cfg.authorizeBase}?client_id=${encodeURIComponent(cfg.clientId)}&response_type=token`;
        window.location.assign(url);
        return new Promise(() => {});   // la page part : rien à résoudre
    }

    // Normalise un titre pour comparaison souple (casse, accents, ponctuation)
    function norm(s) {
        return (s || '').toLowerCase()
            .normalize('NFD').replace(/[̀-ͯ]/g, '')   // enlève les accents
            .replace(/[^a-z0-9]+/g, ' ').trim();
    }
    // Variantes d'un titre à tenter successivement : brut, puis sans suffixes
    // d'édition (« (Official Colored) », « : Season 2 », « - Tome 1 »…).
    function titleVariants(title) {
        const v = [title];
        const cleaned = title
            .replace(/\([^)]*\)/g, '')                 // (Official Colored), (Colored)…
            .replace(/[:\-–—].*$/, '')                 // sous-titres / tomes / saisons
            .replace(/\b(official|colored|full color|digital|complete|edition)\b/gi, '')
            .replace(/\s+/g, ' ').trim();
        if (cleaned && norm(cleaned) !== norm(title)) v.push(cleaned);
        return v;
    }

    // Recherche AniList directe (CORS ouvert) : renvoie plusieurs candidats,
    // on choisit la meilleure correspondance par titre/synonymes.
    const SEARCH_Q = `query ($s: String) {
        Page(perPage: 6) { media(search: $s, type: MANGA) {
            id title { romaji english native } synonyms
        } }
    }`;
    async function searchMedia(term) {
        try {
            const d = await gql(SEARCH_Q, { s: term }, false);
            return d?.Page?.media || [];
        } catch (e) { return []; }
    }

    // Résout l'id AniList d'un manga à partir de son titre — robuste :
    // essaie chaque variante, prend une correspondance exacte si possible,
    // sinon le premier résultat de la recherche (AniList trie par pertinence).
    async function mediaId(title) {
        if (!title) return null;
        if (idCache[title] != null) return idCache[title];
        let fallback = null;
        for (const variant of titleVariants(title)) {
            const media = await searchMedia(variant);
            if (!media.length) continue;
            if (fallback == null) fallback = media[0].id;   // meilleur résultat global
            const target = norm(variant);
            const exact = media.find(m => {
                const names = [m.title?.romaji, m.title?.english, m.title?.native, ...(m.synonyms || [])];
                return names.some(n => norm(n) === target);
            });
            if (exact) { idCache[title] = exact.id; return exact.id; }
        }
        idCache[title] = fallback;   // pas d'exact : on garde le plus pertinent
        return fallback;
    }

    async function syncEntry(mid, { progress, status, score } = {}) {
        if (!mid || !isLinked()) return false;
        const vars = { mediaId: mid };
        if (progress != null) vars.progress = Math.round(progress);
        if (status) vars.status = STATUS_MAP[status] || status;
        if (score != null) vars.scoreRaw = Math.round(score);   // 0..100
        const m = `mutation ($mediaId:Int,$progress:Int,$status:MediaListStatus,$scoreRaw:Int){
            SaveMediaListEntry(mediaId:$mediaId, progress:$progress, status:$status, scoreRaw:$scoreRaw){ id progress status }
        }`;
        await gql(m, vars, true);
        return true;
    }

    // Synchronise par titre (best-effort, silencieux)
    async function syncByTitle(title, opts) {
        try {
            if (!isLinked()) return false;
            const mid = await mediaId(title);
            if (!mid) return false;
            return await syncEntry(mid, opts);
        } catch (e) { return false; }
    }

    window.AniList = { getConfig, clearConfigCache, isLinked, user, token, me, connect, disconnect, syncEntry, syncByTitle, mediaId, STATUS_MAP };
})();
