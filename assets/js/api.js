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
            // Si token invalide → déconnecte
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
            // Source active : préférence locale, défaut = première installée
            get current() {
                try { return localStorage.getItem('mh_source') || ''; } catch(e) { return ''; }
            },
            set current(id) {
                try {
                    if (id) localStorage.setItem('mh_source', id);
                    else    localStorage.removeItem('mh_source');
                    window.dispatchEvent(new CustomEvent('source:change', { detail: { id } }));
                } catch(e) {}
            },
        },

        // ── Mangas (public, route automatiquement selon la source courante) ──
        mangas: {
            _qs(params)        { const s = new URLSearchParams(params).toString(); return s ? '?' + s : ''; },
            _prefix()          { const id = API.sources.current; return id ? `/sources/${encodeURIComponent(id)}` : ''; },
            search:   (params = {}) => get(API.mangas._prefix() + '/mangas/search'  + API.mangas._qs(params)),
            popular:  (params = {}) => get(API.mangas._prefix() + '/mangas/popular' + API.mangas._qs(params)),
            latest:   (params = {}) => get(API.mangas._prefix() + '/mangas/latest'  + API.mangas._qs(params)),
            tags:     ()            => get(API.mangas._prefix() + '/mangas/tags'),
            get:      (id)          => get(API.mangas._prefix() + `/mangas/${encodeURIComponent(id)}`),
            chapters: (id, params={}) => get(API.mangas._prefix() + `/mangas/${encodeURIComponent(id)}/chapters` + API.mangas._qs(params)),
            pages:    (chapterId)   => get(API.mangas._prefix() + `/chapters/${encodeURIComponent(chapterId)}/pages`),
        },

        // ── User data (auth required) ──
        me: {
            favorites:        ()           => get('/me/favorites'),
            addFavorite:      (mangaId)    => post('/me/favorites', { mangaId }),
            removeFavorite:   (mangaId)    => del('/me/favorites/' + encodeURIComponent(mangaId)),

            library:          ()           => get('/me/library'),
            setLibrary:       (mangaId, status, rating) =>
                put('/me/library/' + encodeURIComponent(mangaId), { status, rating }),

            progress:         ()           => get('/me/progress'),
            setProgress:      (mangaId, payload) =>
                put('/me/progress/' + encodeURIComponent(mangaId), payload),

            readChapters:     ()           => get('/me/read-chapters'),
            markChapter:      (payload)    => post('/me/read-chapters', payload),

            lists:            ()           => get('/me/lists'),
            createList:       (data)       => post('/me/lists', data),
            updateList:       (id, data)   => put('/me/lists/' + id, data),
            deleteList:       (id)         => del('/me/lists/' + id),
            addToList:        (id, mangaId)=> post(`/me/lists/${id}/items`, { mangaId }),
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
            clearHistory:     ()           => post('/me/clear-history'),
        },

        comments: {
            list:  (mangaId)         => get('/comments/' + encodeURIComponent(mangaId)),
            add:   (mangaId, payload)=> post('/comments/' + encodeURIComponent(mangaId), payload),
        },

        ratings: {
            get:    (mangaId)          => get('/ratings/' + encodeURIComponent(mangaId)),
            set:    (mangaId, payload) => put('/ratings/' + encodeURIComponent(mangaId), payload),
            remove: (mangaId)          => del('/ratings/' + encodeURIComponent(mangaId)),
        },
    };

    window.API = API;

    // ── Vérification asynchrone du token au démarrage ─────────
    if (_token) {
        API.auth.me().catch(() => { /* géré dans request() */ });
    }
})();
