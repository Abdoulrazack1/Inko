// ============================================================
// api.js — Client API Inko (vers backend Node sur /api)
// ============================================================
// Doit être chargé en premier (avant data.js si conservé).
// Expose window.API et émet 'auth:change' / 'api:error' sur window.
// ============================================================
(function () {
    'use strict';

    // Si l'app est servie par le backend Node : même origine.
    // Si servie par http-server statique : backend séparé.
    const SAME_ORIGIN_BACKEND = ['8088'].includes(location.port);
    const API_BASE = SAME_ORIGIN_BACKEND
        ? '/api'
        : 'http://localhost:8088/api';

    // ── État courant ──────────────────────────────────────────
    let _user  = null;
    let _token = null;
    try {
        const saved = localStorage.getItem('mh_session');
        if (saved) {
            const o = JSON.parse(saved);
            _user  = o.user  || null;
            _token = o.token || null;
        }
    } catch (e) {}

    function persist() {
        try {
            if (_user) localStorage.setItem('mh_session', JSON.stringify({ user: _user, token: _token }));
            else localStorage.removeItem('mh_session');
        } catch (e) {}
        try { window.dispatchEvent(new CustomEvent('auth:change', { detail: { user: _user } })); } catch(e) {}
    }

    // ── Fetch helper ──────────────────────────────────────────
    async function request(method, path, body) {
        const opts = {
            method,
            credentials: 'include',
            headers: { 'Accept': 'application/json' },
        };
        if (_token) opts.headers['Authorization'] = `Bearer ${_token}`;
        if (body)   { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }

        const res = await fetch(API_BASE + path, opts);
        let data = null;
        try { data = await res.json(); } catch (e) { data = null; }

        if (!res.ok) {
            const err = new Error(data?.error || `HTTP ${res.status}`);
            err.status = res.status;
            err.data = data;
            // Si token Inko invalide → déconnecte.
            // (Les 401 de services tiers liés — Spotify, etc. — répondent 424,
            //  on ne purge donc la session que sur un vrai rejet d'auth Inko.)
            if (res.status === 401 && _token) {
                _user = null; _token = null; persist();
            }
            try { window.dispatchEvent(new CustomEvent('api:error', { detail: err })); } catch(e) {}
            throw err;
        }
        return data;
    }

    const get  = (p)       => request('GET', p);
    const post = (p, body) => request('POST', p, body);
    const put  = (p, body) => request('PUT', p, body);
    const del  = (p)       => request('DELETE', p);

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
        get user()   { return _user; },
        get token()  { return _token; },
        isLoggedIn() { return !!_user; },

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
            async google(credential) {
                const r = await post('/auth/google', { credential });
                _user = r.user; _token = r.token; persist();
                return r;
            },
            googleConfig()            { return get('/auth/google-config'); },
            setGoogleConfig(clientId) { return put('/auth/google-config', { clientId }); },
            async logout() {
                try { await post('/auth/logout'); } catch (e) {}
                _user = null; _token = null; persist();
            },
            async me() {
                try {
                    const r = await get('/auth/me');
                    _user = r.user; persist();
                    return r.user;
                } catch (e) { return null; }
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
                } catch(e) {}
            },
            // Mises à jour des extensions (modèle Mihon)
            checkUpdates: ()      => get('/extensions/updates'),
            update:       (ids)   => post('/extensions/update', { ids: ids || null }),
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
            searchAll:(q)           => get('/search-all?q=' + encodeURIComponent(q || '')).then(mapMangaPage),
            popular:  (params = {}) => get(API.mangas._prefix() + '/mangas/popular' + API.mangas._qs(params)).then(mapMangaPage),
            latest:   (params = {}) => get(API.mangas._prefix() + '/mangas/latest'  + API.mangas._qs(params)).then(mapMangaPage),
            tags:     ()            => get(API.mangas._prefix() + '/mangas/tags'),
            get:      (id)          => get(API.mangas._prefix() + `/mangas/${encodeURIComponent(id)}`).then(mapManga),
            getFrom:  (source, id)  => get((source ? `/sources/${encodeURIComponent(source)}` : '') + `/mangas/${encodeURIComponent(id)}`).then(mapManga),
            chapters: (id, params={}) => get(API.mangas._prefix() + `/mangas/${encodeURIComponent(id)}/chapters` + API.mangas._qs(params)),
            chaptersFor: (source, id, params={}) => get((source ? `/sources/${encodeURIComponent(source)}` : '') + `/mangas/${encodeURIComponent(id)}/chapters` + API.mangas._qs(params)),
            pages:    (chapterId)   => get(API.mangas._prefix() + `/chapters/${encodeURIComponent(chapterId)}/pages`),
            text:     (chapterId)   => get(API.mangas._prefix() + `/chapters/${encodeURIComponent(chapterId)}/text`),
        },

        // ── User data (auth required) ──
        me: {
            favorites:        ()           => get('/me/favorites').then(a => { (a || []).forEach(f => { if (f.cover) f.cover = proxyCover(f.cover); }); return a; }),
            addFavorite:      (mangaId, meta = {}) => post('/me/favorites', {
                mangaId,
                source: meta.source || API.sources.current || 'mangadex',
                title:  meta.title || null,
                cover:  meta.cover || null,
            }),
            removeFavorite:   (mangaId)    => del('/me/favorites/' + encodeURIComponent(mangaId)),
            setCategory:      (mangaId, payload) => put('/me/favorites/' + encodeURIComponent(mangaId) + '/category', payload),
            updates:          (lang)       => get('/me/updates' + (lang ? '?lang=' + encodeURIComponent(lang) : '')).then(d => { (d && d.updates || []).forEach(u => { if (u.cover) u.cover = proxyCover(u.cover); }); return d; }),

            library:          ()           => get('/me/library'),
            setLibrary:       (mangaId, status, rating) =>
                put('/me/library/' + encodeURIComponent(mangaId), { status, rating }),

            progress:         ()           => get('/me/progress'),
            setProgress:      (mangaId, payload) =>
                put('/me/progress/' + encodeURIComponent(mangaId), { source: API.sources.current, ...payload }),
            removeProgress:   (mangaId)    => del('/me/progress/' + encodeURIComponent(mangaId)),

            readChapters:     ()           => get('/me/read-chapters'),
            markChapter:      (payload)    => post('/me/read-chapters', payload),
            markChaptersBulk: (mangaId, chapters) => post('/me/read-chapters/bulk', { mangaId, chapters }),

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

            events:           (limit=200)  => get('/me/events?limit=' + limit),
            stats:            ()           => get('/me/stats'),

            // Ratings
            myRatings:        ()           => get('/me/ratings'),

            // Settings synchronisés
            settings:         ()           => get('/me/settings'),
            saveSettings:     (data)       => put('/me/settings', data),

            // Données
            exportData:       ()           => get('/me/export'),
            importData:       (data)       => post('/me/import', data),
            clearHistory:     ()           => post('/me/clear-history'),
        },

        comments: {
            list:   (mangaId)         => get('/comments/' + encodeURIComponent(mangaId)),
            add:    (mangaId, payload)=> post('/comments/' + encodeURIComponent(mangaId), payload),
            recent: (limit = 6)       => get('/comments-recent?limit=' + limit),
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

        // ── Spotify (linking de compte OAuth) ──
        spotify: {
            // URL d'autorisation (navigation top-level requise : window.open / location)
            loginUrl() {
                const t = _token ? ('?token=' + encodeURIComponent(_token)) : '';
                return API_BASE + '/spotify/login' + t;
            },
            status:     ()  => get('/spotify/status'),
            playlists:  ()  => get('/spotify/playlists'),
            search:     (q) => get('/spotify/search?q=' + encodeURIComponent(q || '')),
            recent:     ()  => get('/spotify/recent'),
            top:        ()  => get('/spotify/top'),
            saved:      ()  => get('/spotify/saved'),
            nowPlaying: ()  => get('/spotify/now-playing'),
            disconnect: ()  => post('/spotify/disconnect'),
        },
    };

    window.API = API;

    // ── Vérification asynchrone du token au démarrage ─────────
    if (_token) {
        API.auth.me().catch(() => { /* géré dans request() */ });
    }
})();
