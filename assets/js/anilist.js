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

        // Mode autonome : la configuration vit sur l'appareil. Cet appel-ci
        // court-circuitait `api.js` (fetch direct), donc son routage vers le
        // magasin local ne s'appliquait pas — il partait vers
        // `localhost:8088`, échouait, et AniList se déclarait « indisponible
        // dans cette version ». C'était la SEULE chose qui empêchait AniList
        // de marcher sans ordinateur : le reste du module parle déjà
        // directement à graphql.anilist.co, où CORS est autorisé.
        if (window.INKO_AUTONOME && window.INKO_MOI_LOCAL) {
            const r = window.INKO_MOI_LOCAL.repondre('GET', '/anilist/config');
            if (r !== window.INKO_MOI_LOCAL.ABSENT) { _config = r; return _config; }
        }

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
        try { localStorage.removeItem(TOKEN_KEY); localStorage.removeItem(USER_KEY); } catch (e) { window.MH?.err?.('anilist.js', e); }
    }

    // Connexion : redirection pleine page vers AniList (flux OAuth classique).
    // La page revient sur anilist.html qui stocke le token puis renvoie ici.
    // (L'ancienne popup + polling échouait dans l'app desktop : la fenêtre
    // s'ouvrait dans le navigateur système, le token n'arrivait jamais.)
    async function connect() {
        const cfg = await getConfig();
        if (!cfg.configured) throw new Error('AniList indisponible dans cette version — mets à jour Inko');
        try { localStorage.removeItem(TOKEN_KEY); } catch (e) { window.MH?.err?.('anilist.js', e); }
        try { localStorage.setItem('anilist_return', location.pathname + location.search); } catch (e) { window.MH?.err?.('anilist.js', e); }
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

    // ── Score moyen AniList (audit AMEL-49) ──────────────────
    // Les liens titre → mediaId sont déjà résolus et persistés (~160 en cache) :
    // il ne manquait que la requête qui va chercher la note du public. Sans
    // point de comparaison, une note personnelle ne dit rien — « 4/5 » ne
    // prend son sens qu'à côté de « la moyenne est 3,6 ».
    //
    // Volontairement SANS authentification (`false`) : la note moyenne est une
    // donnée publique, et la demander ne doit pas exiger un compte AniList lié.
    const SCORE_Q = `query ($id: Int) {
        Media(id: $id, type: MANGA) { id averageScore meanScore popularity }
    }`;
    const scoreCache = {};

    async function publicScore(title) {
        if (!title) return null;
        if (scoreCache[title] !== undefined) return scoreCache[title];
        try {
            const id = await mediaId(title);
            if (!id) { scoreCache[title] = null; return null; }
            const d = await gql(SCORE_Q, { id }, false);
            const m = d?.Media;
            // AniList note sur 100 ; on rend la valeur brute et laisse
            // l'appelant décider de l'échelle d'affichage.
            scoreCache[title] = m && m.averageScore
                ? { id: m.id, score100: m.averageScore, popularity: m.popularity || 0 }
                : null;
            return scoreCache[title];
        } catch (e) { scoreCache[title] = null; return null; }
    }

    // ── Rattachement persisté titre → mediaId (audit N56) ──
    // Avant : recherche floue refaite à chaque session, premier résultat mis en
    // cache silencieusement en l'absence de correspondance exacte — toute la
    // progression pouvait partir vers la mauvaise fiche AniList sans indice ni
    // moyen de corriger. Le lien résolu est désormais persisté côté serveur
    // (user_settings.anilistLinks, fusion JSON_MERGE_PATCH) avec un drapeau
    // `exact`, et corrigeable manuellement via setLink().
    // Audit PERF-09 : ces liens vivaient dans user_settings, blob rechargé à
    // CHAQUE page (7 348 des 8 188 octets, une entrée par titre, sans éviction).
    // Ils ont désormais leur propre endpoint, appelé uniquement ici — donc
    // seulement sur les pages qui touchent réellement à AniList.
    let _links = null;   // { "<titre normalisé>": { id, exact } }
    async function loadLinks() {
        if (_links) return _links;
        try {
            _links = await window.API?.me?.anilistLinks?.() || {};
        } catch (e) { _links = {}; }
        return _links;
    }
    async function persistLink(title, id, exact) {
        const key = norm(title);
        if (!key || id == null) return;
        (_links || (_links = {}))[key] = { id, exact: !!exact };
        try { await window.API?.me?.saveAnilistLinks?.({ [key]: { id, exact: !!exact } }); }
        catch (e) { window.MH?.err?.('anilist.js', e); }
    }
    // Lien actuel (persisté) pour un titre — null si jamais résolu
    async function getLink(title) {
        const links = await loadLinks();
        return links[norm(title)] || null;
    }
    // Force (ou efface avec id=null) le rattachement d'un titre
    async function setLink(title, id) {
        const key = norm(title);
        if (!key) return;
        if (id == null) {
            if (_links) delete _links[key];
            delete idCache[title];
            // Une valeur null supprime l'entrée côté serveur
            try { await window.API?.me?.saveAnilistLinks?.({ [key]: null }); }
            catch (e) { window.MH?.err?.('anilist.js', e); }
            return;
        }
        idCache[title] = id;
        await persistLink(title, id, true);
    }
    // Détail d'une fiche (pour afficher « liée à … » dans l'UI)
    async function mediaInfo(id) {
        if (!id) return null;
        try {
            const d = await gql('query ($id:Int){ Media(id:$id){ id siteUrl title { romaji english native } } }', { id }, false);
            return d?.Media || null;
        } catch (e) { return null; }
    }

    // Résout l'id AniList d'un manga à partir de son titre — robuste :
    // lien persisté d'abord, sinon recherche (correspondance exacte si possible,
    // sinon le premier résultat, persisté avec exact:false pour que l'UI puisse
    // proposer une correction).
    async function mediaId(title) {
        if (!title) return null;
        if (idCache[title] != null) return idCache[title];
        const saved = await getLink(title);
        if (saved && saved.id) { idCache[title] = saved.id; return saved.id; }
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
            if (exact) { idCache[title] = exact.id; persistLink(title, exact.id, true); return exact.id; }
        }
        idCache[title] = fallback;   // pas d'exact : on garde le plus pertinent
        if (fallback != null) persistLink(title, fallback, false);
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

    /** Enregistre un Client ID, sur l'appareil quand il n'y a pas de hub. */
    async function setConfig(clientId) {
        clearConfigCache();
        if (window.INKO_AUTONOME && window.INKO_MOI_LOCAL) {
            return window.INKO_MOI_LOCAL.repondre('PUT', '/anilist/config', { clientId });
        }
        return window.API.anilist.setConfig(clientId);
    }

    window.AniList = { getConfig, setConfig, clearConfigCache, isLinked, user, token, me, connect, disconnect, syncEntry, syncByTitle, mediaId, publicScore, STATUS_MAP,
        getLink, setLink, mediaInfo, searchMedia };   // rattachement corrigeable (audit N56)
})();
