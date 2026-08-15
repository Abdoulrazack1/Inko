// ============================================================
// api.js — Client API Inko (vers backend Node sur /api)
// ============================================================
// Doit être chargé en premier (avant data.js si conservé).
// Expose window.API et émet 'auth:change' / 'api:error' sur window.
// ============================================================
(function () {
    'use strict';

    // Si l'app est servie par le backend Node : même origine — c'est le cas
    // en local (:8088), en Docker direct (:8088→8080) ET derrière un
    // reverse-proxy HTTPS standard (Cloudflare Tunnel, Caddy… port implicite),
    // où le backend sert aussi le frontend (audit S7 : l'ancienne détection
    // « port === 8088 » cassait l'accès distant via tunnel).
    // Seul cas de backend séparé : serveur statique de dev (Live Server & co).
    const DEV_STATIC_PORTS = ['5500', '5501', '5173', '4173', '3000'];
    const SAME_ORIGIN_BACKEND = location.protocol !== 'file:'
        && !DEV_STATIC_PORTS.includes(location.port);
    const API_BASE = SAME_ORIGIN_BACKEND
        ? '/api'
        : 'http://localhost:8088/api';

    // ── État courant ──────────────────────────────────────────
    // Audit SEC-06 : le JWT était persisté dans localStorage EN PLUS du cookie
    // httpOnly. Le cookie protège justement du vol par XSS — la copie en
    // localStorage annulait cette protection : toute injection pouvait lire
    // `mh_session` et repartir avec un jeton valide 30 jours.
    //
    // Le cookie suffit dans le cas nominal (même origine : local, Docker,
    // desktop, tunnel HTTPS). Le Bearer n'est nécessaire QUE lorsque le
    // frontend est servi par un serveur statique de dev, sur une autre origine
    // que l'API — c'est déjà ce que détecte SAME_ORIGIN_BACKEND ci-dessus.
    // Dans ce cas seulement, le jeton est gardé EN MÉMOIRE (perdu au
    // rechargement, ce qui est acceptable pour du développement).
    const PERSIST_TOKEN = !SAME_ORIGIN_BACKEND;
    let _user  = null;
    let _token = null;
    try {
        const saved = localStorage.getItem('mh_session');
        if (saved) {
            const o = JSON.parse(saved);
            _user  = o.user  || null;
            // Migration silencieuse : on relit l'ancien jeton une dernière fois
            // pour ne pas déconnecter les sessions existantes, puis on cesse de
            // l'écrire (la réécriture ci-dessous ne le remettra pas).
            _token = o.token || null;
        }
    } catch (e) { window.MH?.err?.('api.js', e); }

    function persist() {
        try {
            if (_user) {
                const payload = PERSIST_TOKEN
                    ? { user: _user, token: _token }
                    : { user: _user };          // le jeton reste en mémoire
                localStorage.setItem('mh_session', JSON.stringify(payload));
            } else {
                localStorage.removeItem('mh_session');
            }
        } catch (e) { window.MH?.err?.('api.js', e); }
        try { window.dispatchEvent(new CustomEvent('auth:change', { detail: { user: _user } })); } catch (e) { window.MH?.err?.('api.js', e); }
    }

    // Nettoie TOUTES les données locales liées au compte (audit DF1) :
    // vie privée sur machine partagée — la déconnexion ne doit pas laisser
    // préférences, miroir bibliothèque, signets, tokens AniList, NSFW…
    function clearLocalUserData() {
        try {
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const k = localStorage.key(i);
                if (!k) continue;
                if (/^(mh_|inko_)/i.test(k) || /anilist|nsfw|userdata|bookmark|mirror|music/i.test(k)) {
                    localStorage.removeItem(k);
                }
            }
        } catch (e) { window.MH?.err?.('api.js', e); }
    }

    // ── Fetch helper ──────────────────────────────────────────
    // Timeout via AbortController : sans ça, un serveur qui ne répond pas
    // fige l'UI indéfiniment (audit API1/DF4, critique).
    const DEFAULT_TIMEOUT = 30000;
    // Mode global, ou serie explicitement privee dont l'identifiant apparait
    // dans le chemin. Passer le drapeau a travers chaque appelant aurait
    // demande de toucher des dizaines de signatures pour le meme resultat.
    function estRequetePrivee(path) {
        const MH = window.MH;
        if (!MH || !MH.isIncognito) return false;
        if (MH.isIncognito()) return true;
        try {
            const s = JSON.parse(sessionStorage.getItem('inko_incognito_series') || '[]');
            if (!s.length) return false;
            const decode = decodeURIComponent(path);
            return s.some(id => decode.includes(id));
        } catch (e) { return false; }
    }

    async function request(method, path, body, { timeout = DEFAULT_TIMEOUT, keepalive = false } = {}) {
        // Audit PERF-02 : toute écriture périme le cache de lectures partagées.
        // Sans ça, « ajouter aux favoris » puis relire la liste dans la seconde
        // qui suit renverrait l'ancienne. On vide tout plutôt que de raisonner
        // par préfixe : une écriture est rare, une lecture périmée est un bug.
        if (method !== 'GET') sharedCache.clear();
        const ctrl  = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), timeout);
        const opts = {
            method,
            credentials: 'include',
            headers: { 'Accept': 'application/json' },
            signal: ctrl.signal,
            // keepalive : la requête survit à la navigation (audit N52/N53 —
            // sauvegarde de progression / marquage lu au moment de quitter la page)
            keepalive,
        };
        if (_token) opts.headers['Authorization'] = `Bearer ${_token}`;
        if (body)   { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
        // Audit AMEL-107 : la table `events` alimente le flux d'activité et le
        // profil — c'est une trace, et elle était écrite même en lecture
        // privée puisque le serveur ignorait tout du mode. L'en-tête le lui
        // dit. Le geste demandé (ajouter un favori, poser un statut) est
        // toujours exécuté : seule sa trace dans l'historique est omise.
        if (method !== 'GET' && estRequetePrivee(path)) opts.headers['X-Inko-Private'] = '1';

        let res;
        try {
            res = await fetch(API_BASE + path, opts);
        } catch (e) {
            const err = new Error(e && e.name === 'AbortError'
                ? 'Délai dépassé — le serveur met trop de temps à répondre.'
                : 'Connexion impossible — vérifie ta connexion réseau.');
            err.status = 0; err.network = true;
            // Audit BUG-04 : mémorise la dernière erreur pour que l'UI puisse
            // distinguer « pas de session » de « serveur/base en panne ».
            try { (window.MH = window.MH || {}).lastApiError = err; } catch (_) { /* noop */ }
            // Audit M8 : les écritures de lecture faites hors-ligne (marquer
            // lu, progression) étaient simplement perdues — elles sont
            // désormais mises en file et rejouées au retour du réseau.
            queueOffline(method, path, body);
            try { window.dispatchEvent(new CustomEvent('api:error', { detail: err })); } catch (_) { window.MH?.err?.('api.js', _); }
            throw err;
        } finally {
            clearTimeout(timer);
        }
        let data = null;
        try { data = await res.json(); } catch (e) { data = null; }

        if (!res.ok) {
            const err = new Error(data?.error || `HTTP ${res.status}`);
            err.status = res.status;
            err.data = data;
            // Audit BUG-04 : un 5xx (base morte) ne doit pas être présenté
            // comme une session expirée.
            try { (window.MH = window.MH || {}).lastApiError = err; } catch (_) { /* noop */ }
            // Si token Inko invalide → déconnecte.
            // (Les 401 de services tiers liés — AniList, etc. — répondent 424,
            //  on ne purge donc la session que sur un vrai rejet d'auth Inko.)
            if (res.status === 401 && _token) {
                _user = null; _token = null; persist();
            }
            try { window.dispatchEvent(new CustomEvent('api:error', { detail: err })); } catch (e) { window.MH?.err?.('api.js', e); }
            throw err;
        }
        return data;
    }

    // GET avec un réessai automatique (audit DF9) : uniquement les lectures
    // (idempotentes) et uniquement sur erreur réseau ou 5xx — jamais sur 4xx.
    async function getWithRetry(p) {
        try { return await request('GET', p); }
        catch (e) {
            if (e.network || (e.status >= 500 && e.status <= 599)) {
                await new Promise(r => setTimeout(r, 800));
                return request('GET', p);
            }
            throw e;
        }
    }

    // ── Lectures partagées (audit PERF-02) ───────────────────
    // Mesuré sur l'accueil : 39 appels /api, dont /me/progress ×4,
    // /me/notifications/unread ×3, /me/favorites ×2, /health ×2. Personne ne
    // les demandait deux fois « exprès » : global.js (en-tête, cloche, avatar)
    // et le script de page interrogent les mêmes ressources sans se connaître,
    // et rien ne les met en commun. Le problème n'est donc pas sur l'accueil,
    // il est ici — chaque page le reproduit à sa façon.
    //
    // Ces routes sont des lectures idempotentes et propres à l'utilisateur :
    // deux demandes à quelques centaines de ms d'intervalle ont, par
    // construction, la même réponse. On coalesce donc les appels concurrents
    // sur une seule requête réseau, et on garde le résultat pendant une fenêtre
    // très courte pour couvrir les appels séquentiels du chargement de page.
    //
    // Volontairement PAS mis en commun : /sources/*/mangas/* (dépend d'une
    // source tierce et peut être long), les recherches (paramétrées), et tout
    // ce qui n'est pas un GET.
    const SHARED_GET = [
        /^\/me\/favorites$/,
        /^\/me\/progress$/,
        /^\/me\/settings$/,
        /^\/me\/stats$/,
        /^\/me\/notifications\/unread$/,
        /^\/sources$/,
        /^\/health$/,
    ];
    const SHARED_TTL = 3000;
    const sharedCache = new Map();   // chemin → { at, promise }

    // Les appelants reçoivent une COPIE : plusieurs modules partagent désormais
    // la même réponse, et il suffirait qu'un seul trie ou filtre le tableau
    // en place pour corrompre la vue des autres — un bug qui ne se manifeste
    // qu'en présence de deux consommateurs, donc quasi introuvable.
    const copy = (d) => {
        if (d == null || typeof d !== 'object') return d;
        try { return structuredClone(d); }
        catch (e) { try { return JSON.parse(JSON.stringify(d)); } catch (_) { return d; } }
    };

    function getShared(p) {
        const hit = sharedCache.get(p);
        if (hit && (Date.now() - hit.at) < SHARED_TTL) return hit.promise.then(copy);
        const promise = getWithRetry(p);
        sharedCache.set(p, { at: Date.now(), promise });
        // Un échec ne doit pas être resservi pendant 3 s : on le retire aussitôt
        // pour que le prochain appelant retente vraiment.
        promise.catch(() => {
            if (sharedCache.get(p)?.promise === promise) sharedCache.delete(p);
        });
        return promise.then(copy);
    }

    const get  = (p)       => (SHARED_GET.some(re => re.test(p.split('?')[0])) ? getShared(p) : getWithRetry(p));
    const post = (p, body) => request('POST', p, body);
    const put  = (p, body) => request('PUT', p, body);
    const del  = (p)       => request('DELETE', p);

    // ── File offline → online (audit M8) ─────────────────────
    // Seules les écritures de lecture, idempotentes et rejouables sans
    // risque, sont mises en file : progression (PUT écrase), marquage lu
    // (INSERT IGNORE côté serveur). Rejouées dans l'ordre au retour du
    // réseau ; entrées > 7 jours abandonnées ; file bornée à 200.
    const OFFLINE_KEY = 'inko_offline_queue_v1';
    const OFFLINE_OK = [
        { method: 'PUT',  re: /^\/me\/progress\// },
        { method: 'POST', re: /^\/me\/read-chapters(\/bulk)?$/ },
    ];
    function readQueue() {
        try { return JSON.parse(localStorage.getItem(OFFLINE_KEY) || '[]'); }
        catch (e) { return []; }
    }
    function writeQueue(q) {
        try { localStorage.setItem(OFFLINE_KEY, JSON.stringify(q.slice(-200))); }
        catch (e) { window.MH?.err?.('api.js', e); }
    }
    function queueOffline(method, path, body) {
        if (!OFFLINE_OK.some(r => r.method === method && r.re.test(path))) return;
        const q = readQueue();
        // Dédoublonne la progression : une seule entrée par œuvre (la dernière gagne)
        const filtered = method === 'PUT' ? q.filter(e => !(e.method === 'PUT' && e.path === path)) : q;
        filtered.push({ method, path, body, at: Date.now() });
        writeQueue(filtered);
    }
    let _flushing = false;
    async function flushOfflineQueue() {
        if (_flushing || !navigator.onLine || !_token) return;
        const q = readQueue().filter(e => Date.now() - e.at < 7 * 86400000);
        if (!q.length) { writeQueue([]); return; }
        _flushing = true;
        const remaining = [];
        for (const e of q) {
            try { await request(e.method, e.path, e.body); }
            catch (err) {
                if (err.network) { remaining.push(e); }   // toujours hors-ligne : on garde
                // erreur applicative (4xx/5xx) : on abandonne l'entrée (pas de boucle)
            }
        }
        writeQueue(remaining);
        _flushing = false;
        if (q.length > remaining.length) {
            window.MH?.toast?.(`${q.length - remaining.length} action(s) hors-ligne synchronisée(s) ✓`);
        }
    }
    window.addEventListener('online', () => setTimeout(flushOfflineQueue, 1500));
    setTimeout(flushOfflineQueue, 4000);   // rattrapage au chargement de page

    // ── Proxy de couvertures ──────────────────────────────────
    // Réécrit vers /api/img (cache serveur + bon Referer + compat Cloudflare)
    // UNIQUEMENT les hôtes lents ou protégés (sources de romans). Les hôtes
    // manga rapides (MangaDex, WeebCentral) chargent en direct via HTTP/2,
    // c'est plus rapide qu'un détour serveur. Les data:/URLs locales passent.
    const PROXY_HOSTS = ['chireads.com', 'novelfull.com', 'royalroad.com', 'royalroadcdn.com', 'sushiscan.fr', 'sushiscan.net'];
    function shouldProxy(u) {
        try {
            const h = new URL(u).hostname;
            return PROXY_HOSTS.some(d => h === d || h.endsWith('.' + d));
        } catch (e) { return false; }
    }
    function proxyCover(u) {
        if (!u || typeof u !== 'string') return u;
        if (u.startsWith('data:') || u.startsWith('/')) return u;
        if (!/^https?:\/\//i.test(u)) return u;
        if (u.indexOf('/api/img?') !== -1) return u; // déjà proxifié
        return shouldProxy(u) ? API_BASE + '/img?u=' + encodeURIComponent(u) : u;
    }
    function mapManga(m) {
        if (m && typeof m === 'object') {
            ['cover', 'coverLarge', 'coverThumb'].forEach(k => { if (m[k]) m[k] = proxyCover(m[k]); });
        }
        return m;
    }
    function mapMangaPage(d) {
        if (d && Array.isArray(d.results)) d.results.forEach(mapManga);
        if (d && Array.isArray(d.groups))  d.groups.forEach(g => (g.items || []).forEach(mapManga));
        return d;
    }

    // ── API publique ──────────────────────────────────────────
    const API = {
        get base()   { return API_BASE; },
        // Audit AMEL-79 : la file d'ecritures hors-ligne existait mais restait
        // INVISIBLE. Marquer des chapitres lus sans reseau semblait ne rien
        // faire, et rien ne disait si c'etait finalement parti. Une ecriture
        // en attente qu'on ne voit pas est indistinguable d'une ecriture
        // perdue — l'utilisateur refait le geste, ou renonce.
        offlineQueue() {
            return readQueue().map(e => ({
                method: e.method, path: e.path, at: e.at,
                // Le chemin brut ne parle pas : on en tire ce que l'action VEUT dire.
                label: /read-chapters/.test(e.path) ? 'Chapitre marque lu'
                    : /progress/.test(e.path) ? 'Progression de lecture'
                        : /favorites/.test(e.path) ? 'Favori'
                            : /library/.test(e.path) ? 'Statut de suivi'
                                : /ratings/.test(e.path) ? 'Note'
                                    : e.path,
            }));
        },
        flushOffline() { return flushOfflineQueue(); },
        get user()   { return _user; },
        get token()  { return _token; },
        isLoggedIn() { return !!_user; },

        // Audit PERF-02 : /health était appelé par deux `fetch()` bruts dans
        // global.js (bandeau de mise à jour, bandeau de repli base) qui
        // court-circuitaient api.js — donc ni réessai, ni mise en commun.
        // Exposé ici, il bénéficie du cache partagé et n'est plus demandé
        // qu'une fois par chargement.
        health: () => get('/health'),
        // Sante de l'instance (audit AMEL-116) : /health repond par oui/non,
        // celui-ci dit depuis quand, avec quoi, et si les sauvegardes tournent.
        instance: () => get('/instance'),

        // ── Auth ──
        auth: {
            async register({ username, email, password }) {
                const r = await post('/auth/register', { username, email, password });
                _user = r.user; _token = r.token; persist();
                return r;
            },
            async login({ email, password }) {
                const r = await post('/auth/login', { email, password });
                _user = r.user; _token = r.token; persist();
                return r;
            },
            providers() { return get('/auth/providers'); },
            // Sessions actives, revocables une a une (audit AMEL-69)
            sessions()            { return get('/auth/sessions'); },
            revokeSession(id)     { return del('/auth/sessions/' + encodeURIComponent(id)); },
            revokeOthers()        { return del('/auth/sessions/others'); },
            // Force du mot de passe, evaluee par le MEME code que la
            // validation serveur (audit AMEL-70) : un indicateur qui a sa
            // propre regle finit par contredire celle qui decide vraiment.
            passwordStrength(password, meta = {}) {
                return post('/auth/password-strength', { password, ...meta });
            },
            async google(credential) {
                const r = await post('/auth/google', { credential });
                _user = r.user; _token = r.token; persist();
                return r;
            },
            googleConfig()            { return get('/auth/google-config'); },
            setGoogleConfig(clientId) { return put('/auth/google-config', { clientId }); },
            async logout() {
                try { await post('/auth/logout'); } catch (e) { window.MH?.err?.('api.js', e); }
                _user = null; _token = null;
                clearLocalUserData();   // vie privée : purge les données locales du compte
                persist();
            },
            async me() {
                try {
                    const r = await get('/auth/me');
                    _user = r.user; persist();
                    return r.user;
                } catch (e) { return null; }
            },
            // Mode local (façon Mihon) : session automatique sur le compte
            // propriétaire, aucun écran de connexion.
            async local() {
                const r = await post('/auth/local');
                _user = r.user; _token = r.token; persist();
                return r;
            },
            async requestReset(email)   { return post('/auth/forgot', { email }); },
            async resetPassword(payload){ return post('/auth/reset',  payload); },
            async changePassword(payload){ return put('/auth/password', payload); },
            async updateProfile(payload) {
                const r = await put('/auth/profile', payload);
                if (r.user) { _user = r.user; persist(); }
                return r;
            },
            async deleteAccount(password) {
                const r = await post('/auth/delete', { password });
                _user = null; _token = null; persist();
                return r;
            },
            validateEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email || ''); },
        },

        // ── Sources (extensions installées) ──
        sources: {
            list:    ()             => get('/sources'),
            uninstall:  (id) => post('/extensions/' + encodeURIComponent(id) + '/uninstall'),
            reinstall:  (id) => post('/extensions/' + encodeURIComponent(id) + '/reinstall'),
            uninstalled:()   => get('/extensions/uninstalled'),
            // Source active : préférence locale, défaut = WeebCentral
            // (pages des titres populaires lisibles, contrairement à MangaDex
            //  qui en licencie beaucoup en externalUrl). Modifiable via /sources.
            get current() {
                try { return localStorage.getItem('mh_source') || 'weebcentral'; } catch(e) { return 'weebcentral'; }
            },
            set current(id) {
                try {
                    if (id) localStorage.setItem('mh_source', id);
                    else    localStorage.removeItem('mh_source');
                    window.dispatchEvent(new CustomEvent('source:change', { detail: { id } }));
                } catch (e) { window.MH?.err?.('api.js', e); }
            },
            // Mises à jour des extensions (modèle Mihon)
            checkUpdates: ()      => get('/extensions/updates'),
            update:       (ids)   => post('/extensions/update', { ids: ids || null }),
            // Test de connectivité d'une source + santé globale
            test:         (id)    => get('/extensions/' + encodeURIComponent(id) + '/test'),
            // Journal des derniers appels d'une source (audit AMEL-68)
            log:          (id, limit = 20) =>
                get('/extensions/' + encodeURIComponent(id) + '/log?limit=' + limit),
            // Audit AMEL-66 : `defaultSource()` codait en dur weebcentral puis
            // sushiscan. L'ordre de preference est une habitude de lecture,
            // propre a chacun — il vit donc chez le client, qui l'applique au
            // choix de la source initiale et a l'ordre affiche.
            get order() {
                try { return JSON.parse(localStorage.getItem('mh_source_order') || '[]'); }
                catch (e) { return []; }
            },
            set order(ids) {
                try { localStorage.setItem('mh_source_order', JSON.stringify(ids || [])); }
                catch (e) { window.MH?.err?.('api.js', e); }
            },
            // Trie une liste de sources selon la preference, les inconnues a la
            // suite dans leur ordre d'origine : installer une extension ne doit
            // pas la faire disparaitre au fond parce qu'elle n'est pas classee.
            sortByPreference(list) {
                const ord = API.sources.order;
                if (!ord.length) return list;
                const rang = new Map(ord.map((id, i) => [id, i]));
                return [...list].sort((a, b) =>
                    (rang.has(a.id) ? rang.get(a.id) : 1e9) - (rang.has(b.id) ? rang.get(b.id) : 1e9));
            },
            health:       ()      => get('/extensions/health'),
        },

        // ── Mangas (public, route automatiquement selon la source courante) ──
        mangas: {
            _qs(params)        {
                // Les tableaux deviennent des clés répétées (?status=a&status=b),
                // ce qui permet de combiner plusieurs valeurs d'un même filtre.
                const sp = new URLSearchParams();
                Object.entries(params || {}).forEach(([k, v]) => {
                    if (Array.isArray(v)) v.forEach(x => { if (x != null && x !== '') sp.append(k, x); });
                    else if (v != null && v !== '') sp.append(k, v);
                });
                const s = sp.toString(); return s ? '?' + s : '';
            },
            _prefix()          { const id = API.sources.current; return id ? `/sources/${encodeURIComponent(id)}` : ''; },
            search:   (params = {}) => get(API.mangas._prefix() + '/mangas/search'  + API.mangas._qs(params)).then(mapMangaPage),
            // limit : 12 par défaut (aperçu), plus généreux sur recherche.html (audit N38)
            searchAll:(q, limit = 12) => get('/search-all?q=' + encodeURIComponent(q || '') + '&limit=' + limit).then(mapMangaPage),
            popular:  (params = {}) => get(API.mangas._prefix() + '/mangas/popular' + API.mangas._qs(params)).then(mapMangaPage),
            latest:   (params = {}) => get(API.mangas._prefix() + '/mangas/latest'  + API.mangas._qs(params)).then(mapMangaPage),
            // Variantes ciblant une source précise (catalogue « Toutes les sources »)
            popularFor:(source, params = {}) => get('/sources/' + encodeURIComponent(source) + '/mangas/popular' + API.mangas._qs(params)).then(mapMangaPage),
            searchFor: (source, params = {}) => get('/sources/' + encodeURIComponent(source) + '/mangas/search'  + API.mangas._qs(params)).then(mapMangaPage),
            tags:     ()            => get(API.mangas._prefix() + '/mangas/tags'),
            // `source` optionnel : sans lui on interroge la source COURANTE, ce
            // qui est faux dès qu'on résout une œuvre lue ailleurs (stats,
            // historique). Omis, le comportement d'origine est conservé.
            get:      (id, source)  => get((source ? '/sources/' + encodeURIComponent(source) : API.mangas._prefix())
                + `/mangas/${encodeURIComponent(id)}`).then(mapManga),
            // BUG-01 : sans `source`, l'URL partait SANS préfixe et le serveur
            // appliquait la source courante. Mesuré pendant l'audit : 14
            // requêtes avec un identifiant étranger à la source appelée, dont
            // `/api/sources/weebcentral/mangas/2701` — 2701 est l'identifiant
            // de Moby Dick chez Project Gutenberg. Le serveur répondait 200
            // avec une fiche VIDE (BUG-02), donc rien ne signalait la faute :
            // un roman ouvrait le lecteur d'images, d'où la « page blanche ».
            //
            // On refuse désormais d'envoyer la requête. Ne rien afficher est
            // honnête ; afficher l'œuvre d'un autre catalogue ne l'est pas.
            // Les six appelants passent tous par `allSettled` ou un `catch`.
            getFrom:  (source, id)  => (source
                ? get(`/sources/${encodeURIComponent(source)}/mangas/${encodeURIComponent(id)}`).then(mapManga)
                : Promise.reject(new Error(`source inconnue pour « ${id} » — requête non envoyée (BUG-01)`))),
            chapters: (id, params={}) => get(API.mangas._prefix() + `/mangas/${encodeURIComponent(id)}/chapters` + API.mangas._qs(params)),
            // Même défaut que `getFrom`, mêmes conséquences : demander les
            // chapitres d'une série à un catalogue qui ne la contient pas.
            chaptersFor: (source, id, params={}) => (source
                ? get(`/sources/${encodeURIComponent(source)}/mangas/${encodeURIComponent(id)}/chapters` + API.mangas._qs(params))
                : Promise.reject(new Error(`source inconnue pour « ${id} » — requête non envoyée (BUG-01)`))),
            pages:    (chapterId)   => get(API.mangas._prefix() + `/chapters/${encodeURIComponent(chapterId)}/pages`),
            text:     (chapterId)   => get(API.mangas._prefix() + `/chapters/${encodeURIComponent(chapterId)}/text`),
        },

        // ── User data (auth required) ──
        me: {
            favorites:        ()           => get('/me/favorites').then(a => {
                (a || []).forEach(f => { if (f.cover) f.cover = proxyCover(f.cover); });
                // Rafraîchit le miroir hors-ligne à CHAQUE fetch (audit DF3 :
                // sinon inko_lib_mirror reste périmé après ajout/suppression).
                try { window.Storage?.cacheLibrary?.(a); } catch (e) { window.MH?.err?.('api.js', e); }
                return a;
            }),
            addFavorite:      (mangaId, meta = {}) => post('/me/favorites', {
                mangaId,
                source: meta.source || API.sources.current || 'mangadex',
                title:  meta.title || null,
                cover:  meta.cover || null,
            }),
            removeFavorite:   (mangaId)    => del('/me/favorites/' + encodeURIComponent(mangaId)),
            setCategory:      (mangaId, payload) => put('/me/favorites/' + encodeURIComponent(mangaId) + '/category', payload),
            // opts : string (lang, rétro-compat) ou { lang, scope: 'active'|'all', manga }
            updates: (opts) => {
                const o = typeof opts === 'string' ? { lang: opts } : (opts || {});
                const sp = new URLSearchParams();
                if (o.lang)  sp.set('lang', o.lang);
                if (o.scope) sp.set('scope', o.scope);
                if (o.manga) sp.set('manga', o.manga);
                const qs = sp.toString();
                // Timeout long (3 min) : un scan de bibliothèque interroge toutes
                // les sources de scraping (SushiScan/Cloudflare…) et dépasse
                // facilement le défaut de 30 s → ne plus afficher « serveur trop
                // long » alors que le scan travaille encore.
                return request('GET', '/me/updates' + (qs ? '?' + qs : ''), null, { timeout: 180000 }).then(d => {
                    (d && d.updates  || []).forEach(u => { if (u.cover) u.cover = proxyCover(u.cover); });
                    (d && d.failures || []).forEach(u => { if (u.cover) u.cover = proxyCover(u.cover); });
                    return d;
                });
            },

            library:          ()           => get('/me/library'),
            setLibrary:       (mangaId, status, rating) =>
                put('/me/library/' + encodeURIComponent(mangaId), { status, rating }),

            progress:         ()           => get('/me/progress'),
            // keepalive : survivent à une navigation immédiate (audit N52/N53)
            // `clientAt` : instant où la lecture a REELLEMENT eu lieu (audit
            // AMEL-29). Sans lui, une écriture rejouée depuis la file hors-ligne
            // arriverait horodatée à son envoi et écraserait une lecture plus
            // récente faite entre-temps sur un autre appareil.
            setProgress:      (mangaId, payload) =>
                request('PUT', '/me/progress/' + encodeURIComponent(mangaId),
                    { source: API.sources.current, clientAt: new Date().toISOString(), ...payload },
                    { keepalive: true }),
            removeProgress:   (mangaId)    => del('/me/progress/' + encodeURIComponent(mangaId)),
            // Audit AMEL-28 : positions precedentes d'une serie.
            progressHistory:  (mangaId)    => get('/me/progress/' + encodeURIComponent(mangaId) + '/history'),

            readChapters:     ()           => get('/me/read-chapters'),
            markChapter:      (payload)    => request('POST', '/me/read-chapters', payload, { keepalive: true }),
            markChaptersBulk: (mangaId, chapters) => post('/me/read-chapters/bulk', { mangaId, chapters }),
            // Audit AMEL-40 : annulation d'un marquage en masse.
            unmarkChaptersBulk: (mangaId, chapterIds) => post('/me/read-chapters/unmark-bulk', { mangaId, chapterIds }),

            // ── Journal de lecture (notes personnelles) ──
            notes:            (opts = {})  => {
                                                // Pagination (audit J2) : offset/limit cumulables avec manga/q
                                                const qs = [];
                                                if (opts.manga)  qs.push('manga='  + encodeURIComponent(opts.manga));
                                                if (opts.q)      qs.push('q='      + encodeURIComponent(opts.q));
                                                if (opts.limit)  qs.push('limit='  + opts.limit);
                                                if (opts.offset) qs.push('offset=' + opts.offset);
                                                return get('/me/notes' + (qs.length ? '?' + qs.join('&') : ''))
                                                    .then(r => { (r.notes || []).forEach(n => { if (n.cover) n.cover = proxyCover(n.cover); }); return r; });
                                              },
            notesStats:       ()           => get('/me/notes/stats'),
            addNote:          (payload)    => post('/me/notes', payload),
            updateNote:       (id, payload) => put('/me/notes/' + encodeURIComponent(id), payload),
            removeNote:       (id)         => del('/me/notes/' + encodeURIComponent(id)),

            lists:            ()           => get('/me/lists').then(a => { (a || []).forEach(l => {
                if (Array.isArray(l.covers)) l.covers = l.covers.map(proxyCover);
                if (Array.isArray(l.items))  l.items.forEach(it => { if (it.cover) it.cover = proxyCover(it.cover); });
            }); return a; }),
            createList:       (data)       => post('/me/lists', data),
            updateList:       (id, data)   => put('/me/lists/' + id, data),
            deleteList:       (id)         => del('/me/lists/' + id),
            addToList:        (id, mangaId, meta = {}) => post(`/me/lists/${id}/items`, {
                mangaId,
                source: meta.source || API.sources.current || null,
                title:  meta.title  || null,
                cover:  meta.cover  || null,
            }),
            removeFromList:   (id, mangaId)=> del(`/me/lists/${id}/items/${encodeURIComponent(mangaId)}`),
            // Audit AMEL-37 : ordre persisté des éléments d'une liste.
            reorderList:      (id, mangaIds)=> put(`/me/lists/${id}/order`, { mangaIds }),

            // Audit AMEL-41 : signets sortis du blob de reglages.
            bookmarks:        ()           => get('/me/bookmarks'),
            addBookmark:      (b)          => post('/me/bookmarks', b),
            removeBookmark:   (mangaId, chapterId) =>
                del(`/me/bookmarks/${encodeURIComponent(mangaId)}/${encodeURIComponent(chapterId)}`),

            events:           (limit=200)  => get('/me/events?limit=' + limit),
            stats:            ()           => get('/me/stats'),
            // Répartition des lectures par source et par mois (audit AMEL-57)
            distribution:     (months = 12) => get('/me/stats/distribution?months=' + months),

            // Ratings
            myRatings:        ()           => get('/me/ratings'),

            // Settings synchronisés
            settings:         ()           => get('/me/settings'),
            saveSettings:     (data)       => put('/me/settings', data),

            // Liens AniList — sortis du blob de réglages (audit PERF-09) :
            // ils pesaient 7 348 des 8 188 octets rechargés à CHAQUE page.
            anilistLinks:     ()           => get('/me/anilist-links'),
            saveAnilistLinks: (data)       => put('/me/anilist-links', data),

            // Données
            exportData:       ()           => get('/me/export'),
            importData:       (data)       => post('/me/import', data),
            clearHistory:     (days)      => post('/me/clear-history', days ? { days } : {}),
            // Historique : ciblé plutôt que tout-ou-rien (audit AMEL-112/113).
            // `chapterId` omis => toute la série.
            deleteHistoryEntry: (mangaId, chapterId) =>
                del('/me/history/' + encodeURIComponent(mangaId)
                    + (chapterId ? '?chapterId=' + encodeURIComponent(chapterId) : '')),
            historyExportUrl: (format = 'json') => API.base + '/me/history/export?format=' + encodeURIComponent(format),
            // Sauvegardes nocturnes : lister, previsualiser, restaurer SON
            // compte (audit AMEL-73). Le script CLI existait deja mais suppose
            // un acces shell au serveur.
            backups:          ()          => get('/me/backups'),
            backupPreview:    (file, passphrase) =>
                post('/me/backups/' + encodeURIComponent(file) + '/preview', { passphrase }),
            backupRestore:    (file, passphrase) =>
                post('/me/backups/' + encodeURIComponent(file) + '/restore', { passphrase }),
        },

        comments: {
            // Paginé par fil (audit N51) : renvoie { items, total, hasMore }
            // `chapterId` filtre le fil sur un chapitre précis (audit AMEL-52)
            list:   (mangaId, { limit = 50, offset = 0, chapterId = null } = {}) =>
                get('/comments/' + encodeURIComponent(mangaId) + `?limit=${limit}&offset=${offset}`
                    + (chapterId ? '&chapterId=' + encodeURIComponent(chapterId) : '')),
            add:    (mangaId, payload)=> post('/comments/' + encodeURIComponent(mangaId), payload),
            reply:  (mangaId, parentId, text, opts = {}) =>
                post('/comments/' + encodeURIComponent(mangaId),
                    { text, parentId, spoiler: !!opts.spoiler, visibility: opts.visibility }),
            report: (commentId, reason) => post('/comments/' + commentId + '/report', { reason }),
            remove: (commentId)       => del('/comments/' + commentId),
            recent: (limit = 6)       => get('/comments-recent?limit=' + limit),
        },

        // ── Notifications in-app + Web Push ──
        notifications: {
            list:      (limit = 30, offset = 0) => get('/me/notifications?limit=' + limit + (offset ? '&offset=' + offset : '')),
            unread:    ()           => get('/me/notifications/unread'),
            markRead:  (id)         => post('/me/notifications/' + id + '/read'),
            markAll:   ()           => post('/me/notifications/read-all'),
            subscribe: (sub)        => post('/me/push/subscribe', sub),
            vapid:     ()           => get('/push/vapid'),
            // Fréquence de scan et séries surveillées (audit AMEL-54)
            prefs:     ()           => get('/me/notif-prefs'),
            setPrefs:  (everyHours) => put('/me/notif-prefs', { everyHours }),
            watch:     (mangaId, on)=> put('/me/notif-watch/' + encodeURIComponent(mangaId), { notify: !!on }),
        },

        // ── Import local (EPUB / CBZ / CBR) ──
        local: {
            list:    ()   => get('/library/local'),
            remove:  (id) => del('/library/local/' + id),
            fileUrl: (id) => API_BASE + '/library/local/' + id + '/file',
            // `meta` accepte une chaîne (titre seul, forme historique) ou un
            // objet { title, cover }. Audit AMEL-25 : la vignette est extraite
            // du fichier par le client et voyage avec le téléversement.
            async upload(file, meta, onProgress) {
                const { title, cover } = typeof meta === 'string' ? { title: meta } : (meta || {});
                const fd = new FormData();
                fd.append('file', file);
                if (title) fd.append('title', title);
                if (cover) fd.append('cover', cover);
                // XHR pour la progression d'upload (fetch ne l'expose pas simplement)
                return new Promise((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open('POST', API_BASE + '/library/import/local');
                    if (_token) xhr.setRequestHeader('Authorization', 'Bearer ' + _token);
                    xhr.upload.onprogress = (e) => { if (onProgress && e.lengthComputable) onProgress(e.loaded / e.total); };
                    xhr.onload = () => {
                        try {
                            const data = JSON.parse(xhr.responseText || '{}');
                            xhr.status >= 200 && xhr.status < 300 ? resolve(data) : reject(new Error(data.error || 'Échec de l\'import'));
                        } catch (e) { reject(new Error('Réponse invalide')); }
                    };
                    xhr.onerror = () => reject(new Error('Erreur réseau'));
                    xhr.send(fd);
                });
            },
        },

        // ── Profil public ──
        users: {
            // `preview` force le point de vue d'un inconnu, même sur son propre
            // profil (audit AMEL-62) : c'est le serveur qui recalcule, pas le
            // client qui masque — un aperçu reconstitué finirait par mentir.
            profile: (username, { preview = false } = {}) =>
                get('/users/profile/' + encodeURIComponent(username) + (preview ? '?as=public' : '')).then(p => {
                if (p && p.avatar && /^https?:\/\//.test(p.avatar)) p.avatar = proxyCover(p.avatar);
                return p;
            }),
        },

        // ── Administration & modération (role=admin) ──
        admin: {
            stats:         ()              => get('/admin/stats'),
            users:         (q = '')        => get('/admin/users' + (q ? '?q=' + encodeURIComponent(q) : '')),
            setRole:       (id, role)      => put('/admin/users/' + id + '/role', { role }),
            setBan:        (id, banned)    => put('/admin/users/' + id + '/ban', { banned }),
            reports:       (status = 'open') => get('/admin/reports?status=' + encodeURIComponent(status)),
            resolveReport: (id, action)    => post('/admin/reports/' + id + '/resolve', { action }),
        },

        ratings: {
            get:    (mangaId)          => get('/ratings/' + encodeURIComponent(mangaId)),
            set:    (mangaId, payload) => put('/ratings/' + encodeURIComponent(mangaId), payload),
            remove: (mangaId)          => del('/ratings/' + encodeURIComponent(mangaId)),
        },

        // ── Proxy d'image (couvertures, vignettes) ──
        img: proxyCover,

        // ── Artwork officiel (AniList) ──
        art: {
            get:     (title) => get('/artwork?title=' + encodeURIComponent(title || '')),
            similar: (title) => get('/anilist/similar?title=' + encodeURIComponent(title || '')),
        },

        // ── AniList (config OAuth) ──
        anilist: {
            config()           { return get('/anilist/config'); },
            setConfig(clientId) { return put('/anilist/config', { clientId }); },
        },

        // ── Migration entre sources (audit XIII.1) ──
        // Trois sources ne répondent plus et 13 séries en dépendent. Ces
        // appels ne passent PAS par le cache partagé : `candidats` interroge
        // toutes les autres sources en direct, et servir un résultat de la
        // minute précédente ferait proposer une source qui vient de revenir —
        // ou l'inverse.
        migrate: {
            candidats(source, mangaId, titre) {
                const qs = new URLSearchParams({ source: source || '', mangaId: mangaId || '' });
                if (titre) qs.set('titre', titre);
                return get('/me/migrate/candidats?' + qs.toString());
            },
            lancer(corps)  { return post('/me/migrate', corps); },
            annuler(id)    { return post(`/me/migrate/${encodeURIComponent(id)}/annuler`, {}); },
            annulables()   { return get('/me/migrate'); },
        },

    };

    window.API = API;

    // ── Démarrage : session locale automatique (mode Mihon) ─────
    // Plus d'écran de connexion : si aucune session n'est stockée, on en
    // obtient une auprès du serveur (compte propriétaire). `API.ready` permet
    // aux pages d'attendre la toute première authentification.
    API.ready = (async () => {
        if (_token) {
            // Réconciliation avec le compte propriétaire : une session en
            // cache peut pointer un AUTRE compte que celui résolu côté
            // serveur (ex. correction du propriétaire en base) — l'utilisateur
            // croirait alors sa bibliothèque disparue. On revalide, et si le
            // compte a changé on adopte la bonne session puis on recharge.
            try {
                const before = _user?.id;
                const r = await API.auth.local();
                if (r?.user?.id && before && r.user.id !== before) {
                    try { window.dispatchEvent(new CustomEvent('auth:change', { detail: { user: _user } })); } catch (e) { window.MH?.err?.('api.js', e); }
                    setTimeout(() => window.location.reload(), 80);
                }
            } catch (e) {
                // Mode local désactivé (multi-comptes) : session existante conservée
                API.auth.me().catch(() => { /* géré dans request() */ });
            }
            return true;
        }
        try {
            await API.auth.local();
            try { window.dispatchEvent(new CustomEvent('auth:change', { detail: { user: _user } })); } catch (e) { window.MH?.err?.('api.js', e); }
            return true;
        } catch (e) { return false; }   // serveur down / mode local désactivé
    })();
})();
