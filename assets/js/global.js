// ============================================================
// global.js — Header, footer, search, toast, helpers
// ============================================================
(function () {
    'use strict';

    /* ── Helpers ─────────────────────────────────────────── */
    const $   = (sel, ctx = document) => ctx.querySelector(sel);
    const $$  = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];
    const fmt = n => n >= 1000000 ? (n / 1000000).toFixed(1) + 'M' : n >= 1000 ? Math.round(n / 1000) + 'k' : n;
    const esc = s => (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    window.MH = { $, $$, fmt, esc };

    // Numéro de chapitre lisible (gère prologue/null sans afficher "null")
    window.MH.chapNum = (n) => (n != null && n !== '') ? n : '?';

    /* ── Type de source (manga vs novel) ─────────────────────
       Cache du manifest pour router vers le bon lecteur. */
    window.MH._sourceTypes = null;
    window.MH.loadSourceTypes = async function () {
        if (window.MH._sourceTypes) return window.MH._sourceTypes;
        try {
            const list = await window.API.sources.list();
            const map = {};
            (list || []).forEach(s => { map[s.id] = s.type || 'manga'; });
            window.MH._sourceTypes = map;
        } catch (e) { window.MH._sourceTypes = {}; }
        return window.MH._sourceTypes;
    };
    window.MH.isNovelSource = function (id) {
        return !!(window.MH._sourceTypes && window.MH._sourceTypes[id] === 'novel');
    };
    // URL du lecteur adapté au type de la source (texte pour les romans)
    window.MH.readerHref = function (mangaId, chapterId, source) {
        const src = source || window.API?.sources?.current || '';
        const page = window.MH.isNovelSource(src) ? 'lecture.html' : 'chapitre.html';
        return `${page}?manga=${encodeURIComponent(mangaId)}&chapter=${encodeURIComponent(chapterId)}&source=${encodeURIComponent(src)}`;
    };

    /* ── Lecteur musique intégré (dock en bas de page) ────── */
    window.MH.openMusic = function () {
        if (window.Music) { window.Music.toggle(); return; }
        // music.js pas encore chargé : on réessaie brièvement
        let n = 0;
        const iv = setInterval(() => { n++; if (window.Music) { clearInterval(iv); window.Music.open(); } if (n > 20) clearInterval(iv); }, 100);
    };
    // Injecte le lecteur de musique sur toutes les pages
    (function loadMusicDock() {
        if (document.getElementById('inko-music-js')) return;
        const s = document.createElement('script');
        s.id = 'inko-music-js'; s.src = '/assets/js/music.js'; s.defer = true;
        (document.body || document.documentElement).appendChild(s);
    })();

    /* ── Toast ───────────────────────────────────────────── */
    window.MH.toast = function (msg, duration = 2500) {
        const el = document.createElement('div');
        el.className = 'toast';
        el.textContent = msg;
        Object.assign(el.style, {
            position: 'fixed', bottom: '24px', right: '24px', zIndex: '9999',
            background: '#ff6b1a', color: '#fff', padding: '10px 18px',
            borderRadius: '8px', fontSize: '13.5px', fontWeight: '500',
            boxShadow: '0 4px 16px rgba(255,107,26,.4)', opacity: '1',
            transition: 'opacity .3s', pointerEvents: 'none',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        });
        document.body.appendChild(el);
        setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, duration);
    };

    /* ── Star renderer ───────────────────────────────────── */
    window.MH.stars = function (rating) {
        const full = Math.floor(rating);
        const half = (rating % 1) >= 0.5;
        let html = '<span class="stars">';
        for (let i = 0; i < 5; i++) {
            if (i < full) html += '★';
            else if (i === full && half) html += '½';
            else html += '<span style="opacity:.25">★</span>';
        }
        return html + '</span>';
    };

    window.MH.statusBadge = function (status) {
        const map = {
            ongoing:   ['badge-cours', 'En cours'],
            completed: ['badge-termine', 'Terminé'],
            hiatus:    ['badge-pause', 'Pause'],
            cancelled: ['badge-pause', 'Annulé'],
            // Legacy / fr
            en_cours:  ['badge-cours', 'En cours'],
            termine:   ['badge-termine', 'Terminé'],
            pause:     ['badge-pause', 'Pause'],
        };
        const [cls, label] = map[status] || ['badge-termine', status || '—'];
        return `<span class="badge ${cls}">${label}</span>`;
    };

    // Placeholder local (SVG data URL) — pas de requête réseau, déterministe par seed
    window.MH.placeholderCover = function (seed) {
        const s = String(seed || 'manga');
        let h = 0;
        for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
        const hue = Math.abs(h) % 360;
        const c1 = `hsl(${hue}, 35%, 12%)`;
        const c2 = `hsl(${(hue + 40) % 360}, 60%, 28%)`;
        const initial = s[0].toUpperCase();
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 420">
            <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs>
            <rect width="300" height="420" fill="url(#g)"/>
            <text x="150" y="225" font-family="-apple-system,sans-serif" font-size="120" font-weight="800" fill="rgba(255,255,255,.85)" text-anchor="middle" dominant-baseline="middle">${initial}</text>
        </svg>`;
        return 'data:image/svg+xml;utf8,' + encodeURIComponent(svg);
    };

    /* ── Favoris : icône cœur SVG + état partagé ─────────── */
    window.MH.heartIcon = function (filled) {
        const d = 'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 1 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z';
        return `<svg viewBox="0 0 24 24" width="17" height="17" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
    };

    // Cache du jeu d'IDs favoris de l'utilisateur connecté
    window.MH._favSet = null;
    window.MH.getFavSet = async function (force) {
        if (!window.API?.isLoggedIn()) return new Set();
        if (window.MH._favSet && !force) return window.MH._favSet;
        try {
            const favs = await API.me.favorites();
            window.MH._favSet = new Set((favs || []).map(f => String(f.mangaId)));
        } catch (e) { window.MH._favSet = new Set(); }
        return window.MH._favSet;
    };
    // Marque dans le DOM les cœurs déjà en favori (état initial)
    window.MH.markFavorites = async function (root) {
        if (!window.API?.isLoggedIn()) return;
        const set = await window.MH.getFavSet();
        (root || document).querySelectorAll('.card-fav-btn[data-fav]').forEach(btn => {
            if (btn.dataset.favTouched) return; // ne pas écraser une action en cours de l'utilisateur
            const fav = set.has(String(btn.dataset.fav));
            btn.classList.toggle('is-fav', fav);
            btn.innerHTML = window.MH.heartIcon(fav);
        });
    };

    // Badge "nouveaux chapitres" sur les liens Bibliothèque (header + nav mobile)
    window.MH.updateLibBadge = function () {
        let n = 0; try { n = +localStorage.getItem('inko_lib_newcount') || 0; } catch (e) {}
        document.querySelectorAll('#navLibBadge, #navLibBadgeM').forEach(b => {
            if (n > 0) { b.textContent = n > 99 ? '99+' : String(n); b.style.display = ''; }
            else { b.style.display = 'none'; }
        });
    };

    /* ── Navigation mobile (bottom bar, ≤1024px) ─────────────
       Le header masque sa nav sous 1024px : cette barre app-like
       prend le relais. Masquée pendant la lecture (immersion). */
    function renderMobileNav(activePage) {
        if (activePage === 'chapitre') return;            // lecture : plein écran
        if (document.getElementById('inkoMobileNav')) return;
        const I = {
            home:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>',
            book:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>',
            lib:    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 6 4 14"/><path d="M12 6v14"/><path d="M8 8v12"/><path d="M4 4v16"/></svg>',
            search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>',
            user:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
        };
        const item = (href, id, label, svg, extra = '') =>
            `<a href="${href}" class="mnav-item ${activePage === id ? 'active' : ''}" aria-label="${label}">
                <span class="mnav-icon">${svg}${extra}</span><span class="mnav-label">${label}</span>
            </a>`;
        const nav = document.createElement('nav');
        nav.id = 'inkoMobileNav';
        nav.className = 'mobile-nav';
        nav.innerHTML =
            item('accueil.html', 'accueil', 'Accueil', I.home) +
            item('catalogue.html', 'catalogue', 'Catalogue', I.book) +
            item('bibliotheque.html', 'bibliotheque', 'Bibliothèque', I.lib,
                 '<span class="nav-badge" id="navLibBadgeM" style="display:none"></span>') +
            item('recherche.html', 'recherche', 'Recherche', I.search) +
            item(window.API?.isLoggedIn() ? 'profil.html' : 'page_login.html', 'profil', 'Profil', I.user);
        document.body.appendChild(nav);
    }

    // ── Vérification des nouveaux chapitres ──
    // Interroge toutes les œuvres suivies, met à jour le badge et notifie.
    // { force } ignore le throttle ; { silent } supprime les toasts.
    let _checkInFlight = false;
    window.MH.checkUpdates = async function ({ force = false, silent = false } = {}) {
        if (!window.API?.isLoggedIn()) { if (!silent) MH.toast('Connecte-toi pour suivre tes séries'); return null; }
        if (_checkInFlight) return null;
        _checkInFlight = true;
        setRefreshSpinning(true);
        try {
            const lang = window.Storage?.getPref('readingLang') || 'fr,en';
            const data = await API.me.updates(lang);
            const ups = data.updates || [];
            const newCount = ups.filter(u => u.unreadCount > 0).length;
            const fresh    = ups.filter(u => u.hasNew);
            try {
                localStorage.setItem('inko_lib_newcount', String(newCount));
                localStorage.setItem('inko_lib_lastcheck', String(Date.now()));
            } catch (e) {}
            window.MH.updateLibBadge();
            try { window.dispatchEvent(new CustomEvent('updates:checked', { detail: data })); } catch (e) {}
            if (!silent) {
                if (fresh.length) {
                    const names = fresh.slice(0, 2).map(u => u.title).filter(Boolean).join(', ');
                    MH.toast(`Nouveaux chapitres : ${names}${fresh.length > 2 ? ` (+${fresh.length - 2})` : ''}`);
                } else if (newCount > 0) {
                    MH.toast(`${newCount} série(s) avec des chapitres non lus`);
                } else if (force) {
                    MH.toast('Tout est à jour ✓');
                }
            }
            return data;
        } catch (e) {
            if (!silent && force) MH.toast('Actualisation impossible : ' + e.message);
            return null;
        } finally {
            _checkInFlight = false;
            setRefreshSpinning(false);
        }
    };

    function setRefreshSpinning(on) {
        document.querySelectorAll('#btnRefresh').forEach(b => {
            b.classList.toggle('spinning', on);
            b.disabled = on;
        });
    }

    // Au lancement : une fois par session, en silence.
    async function launchUpdateCheck() {
        try { if (sessionStorage.getItem('inko_launch_checked')) return; } catch (e) {}
        if (!window.API?.isLoggedIn()) return;
        try { sessionStorage.setItem('inko_launch_checked', '1'); } catch (e) {}
        window.MH.checkUpdates({ silent: false });
    }

    /* ── Comptes connectés (Spotify + AniList) ───────────────
       Composant unifié, partagé par profil et paramètres. */
    function ensureAniList() {
        return new Promise((resolve) => {
            if (window.AniList) return resolve();
            const s = document.createElement('script');
            s.src = '/assets/js/anilist.js'; s.defer = true;
            s.onload = () => resolve(); s.onerror = () => resolve();
            document.body.appendChild(s);
        });
    }

    const CONN_LOGOS = {
        spotify: '<svg viewBox="0 0 24 24" fill="#1db954" width="22" height="22"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/></svg>',
        anilist: '<svg viewBox="0 0 24 24" fill="#02a9ff" width="22" height="22"><path d="M6.361 2.943 0 21.056h4.942l1.077-3.133H11.4l1.052 3.133H22.9c.71 0 1.1-.392 1.1-1.101V17.53c0-.71-.39-1.101-1.1-1.101h-6.483V4.045c0-.71-.392-1.102-1.101-1.102h-2.422c-.71 0-1.101.392-1.101 1.102v1.064l-.758-2.166zm2.324 5.948 1.688 5.018H7.144z"/></svg>',
    };

    // Rend les cartes de comptes connectés dans `el`. opts.onChange() après lien/délier.
    window.MH.renderConnections = async function (el, opts = {}) {
        if (!el) return;
        await ensureAniList();
        el.classList.add('conn-list');
        el.innerHTML = `
            <div class="conn-card" id="conn-spotify">
                <div class="conn-logo">${CONN_LOGOS.spotify}</div>
                <div class="conn-body">
                    <div class="conn-name">Spotify <span class="conn-pill" id="conn-sp-pill">…</span></div>
                    <div class="conn-desc" id="conn-sp-desc">Retrouve tes playlists dans le lecteur de musique.</div>
                </div>
                <div class="conn-action" id="conn-sp-action"></div>
            </div>
            <div class="conn-card" id="conn-anilist">
                <div class="conn-logo">${CONN_LOGOS.anilist}</div>
                <div class="conn-body">
                    <div class="conn-name">AniList <span class="conn-pill" id="conn-al-pill">…</span></div>
                    <div class="conn-desc" id="conn-al-desc">Synchronise automatiquement ta progression de lecture.</div>
                </div>
                <div class="conn-action" id="conn-al-action"></div>
            </div>`;
        const changed = () => { try { opts.onChange && opts.onChange(); } catch (e) {} };
        renderSpotifyConn(el, changed);
        renderAniListConn(el, changed);
    };

    function pill(elId, label, kind) {
        const p = document.getElementById(elId);
        if (!p) return;
        p.textContent = label;
        p.className = 'conn-pill ' + (kind || '');
    }

    async function renderSpotifyConn(root, changed) {
        const action = document.getElementById('conn-sp-action');
        const desc   = document.getElementById('conn-sp-desc');
        if (!action) return;
        action.innerHTML = '';
        if (!window.API?.isLoggedIn()) { pill('conn-sp-pill', 'Connexion requise', 'muted'); return; }
        let st;
        try { st = await API.spotify.status(); }
        catch (e) { pill('conn-sp-pill', 'Indisponible', 'muted'); return; }
        if (!st.configured) {
            pill('conn-sp-pill', 'Non configuré', 'muted');
            desc.innerHTML = 'Clés Spotify manquantes côté serveur. Voir <code>SPOTIFY_SETUP.md</code>.';
            return;
        }
        if (st.linked) {
            pill('conn-sp-pill', 'Connecté', 'ok');
            desc.textContent = 'Lié à ' + (st.profile?.name || 'ton compte') + (st.profile?.product === 'premium' ? ' · Premium' : '');
            const btn = document.createElement('button');
            btn.className = 'btn btn-ghost btn-sm conn-btn-danger';
            btn.textContent = 'Délier';
            btn.onclick = async () => {
                btn.disabled = true;
                try { await API.spotify.disconnect(); MH.toast('Spotify délié'); renderSpotifyConn(root, changed); changed(); }
                catch (e) { btn.disabled = false; MH.toast('Erreur : ' + e.message); }
            };
            action.appendChild(btn);
        } else {
            pill('conn-sp-pill', 'Non connecté', '');
            const btn = document.createElement('button');
            btn.className = 'btn btn-sm conn-btn-spotify';
            btn.textContent = 'Connecter';
            btn.onclick = () => {
                window.open(API.spotify.loginUrl(), 'inkoSpotifyAuth', 'width=480,height=760');
                btn.disabled = true; btn.textContent = 'En attente…';
                let n = 0;
                const iv = setInterval(async () => {
                    n++;
                    try { const s = await API.spotify.status(); if (s.linked) { clearInterval(iv); MH.toast('Spotify connecté ✓'); renderSpotifyConn(root, changed); changed(); } } catch (e) {}
                    if (n > 90) { clearInterval(iv); btn.disabled = false; btn.textContent = 'Connecter'; }
                }, 2000);
            };
            action.appendChild(btn);
        }
    }

    async function renderAniListConn(root, changed) {
        const action = document.getElementById('conn-al-action');
        const desc   = document.getElementById('conn-al-desc');
        if (!action || !window.AniList) { pill('conn-al-pill', 'Indisponible', 'muted'); return; }
        action.innerHTML = '';
        const cfg = await AniList.getConfig();
        if (!cfg.configured) {
            pill('conn-al-pill', 'Non configuré', 'muted');
            desc.innerHTML = 'Client AniList manquant côté serveur (<code>ANILIST_CLIENT_ID</code>).';
            return;
        }
        if (AniList.isLinked()) {
            const u = AniList.user();
            pill('conn-al-pill', 'Connecté', 'ok');
            desc.textContent = 'Lié à ' + (u?.name || 'ton compte AniList');
            const btn = document.createElement('button');
            btn.className = 'btn btn-ghost btn-sm conn-btn-danger';
            btn.textContent = 'Délier';
            btn.onclick = () => { AniList.disconnect(); MH.toast('AniList délié'); renderAniListConn(root, changed); changed(); };
            action.appendChild(btn);
        } else {
            pill('conn-al-pill', 'Non connecté', '');
            const btn = document.createElement('button');
            btn.className = 'btn btn-sm conn-btn-anilist';
            btn.textContent = 'Connecter';
            btn.onclick = async () => {
                btn.disabled = true; btn.textContent = 'En attente…';
                try { await AniList.connect(); MH.toast('AniList connecté ✓'); renderAniListConn(root, changed); changed(); }
                catch (e) { btn.disabled = false; btn.textContent = 'Connecter'; MH.toast('Erreur : ' + e.message); }
            };
            action.appendChild(btn);
        }
    }

    /* ── Connexion Google (Google Identity Services) ─────────
       Bouton « Sign in with Google » sur login/signup. */
    window.MH.setupGoogleSignin = async function ({ container, divider } = {}) {
        const box = document.getElementById(container);
        const div = divider && document.getElementById(divider);
        const reveal = () => { if (div) div.style.display = ''; };
        if (!box || !window.API) { reveal(); return; }
        let cfg;
        try { cfg = await API.auth.providers(); } catch (e) { reveal(); return; }
        if (!cfg.google || !cfg.googleClientId) {
            box.style.display = 'none';   // non configuré : on garde juste l'email
            reveal();
            return;
        }
        reveal();
        // Attend que la lib GIS soit prête
        let n = 0;
        const iv = setInterval(() => {
            if (window.google?.accounts?.id) {
                clearInterval(iv);
                try {
                    google.accounts.id.initialize({
                        client_id: cfg.googleClientId,
                        callback: async (resp) => {
                            try {
                                const r = await API.auth.google(resp.credential);
                                MH.toast(`Bienvenue ${r.user.username} !`);
                                setTimeout(() => { window.location.href = 'accueil.html'; }, 500);
                            } catch (e) { MH.toast('Erreur Google : ' + e.message); }
                        },
                    });
                    google.accounts.id.renderButton(box, { theme: 'filled_black', size: 'large', width: 320, text: 'continue_with', shape: 'pill' });
                } catch (e) { box.style.display = 'none'; }
            } else if (++n > 40) { clearInterval(iv); box.style.display = 'none'; }
        }, 100);
    };

    /* ── Reprendre la lecture (bouton « Continuer » du header) ── */
    let _lastReadPromise = null;
    window.MH.lastReadTarget = function () {
        if (_lastReadPromise) return _lastReadPromise;
        _lastReadPromise = (async () => {
            if (!window.API?.isLoggedIn?.()) return null;
            try {
                const progress = await API.me.progress();
                const entries = Object.entries(progress)
                    .map(([id, p]) => ({ mangaId: id, ...p }))
                    .filter(e => e.chapterId)
                    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
                if (!entries.length) return null;
                const e = entries[0];
                return { href: window.MH.readerHref(e.mangaId, e.chapterId, e.source), mangaId: e.mangaId };
            } catch (err) { return null; }
        })();
        return _lastReadPromise;
    };
    window.MH.refreshContinueButton = async function () {
        const btn = document.getElementById('btnContinue');
        if (!btn) return;
        const last = await window.MH.lastReadTarget();
        btn.style.display = last ? '' : 'none';
    };

    /* ── Header HTML ─────────────────────────────────────── */
    const headerHTML = (activePage) => {
        const u = window.API?.user;
        const userBlock = u ? `
          <a href="profil.html" class="header-user" title="${esc(u.username)}">
            <div class="header-avatar">${esc(u.avatar || u.username[0].toUpperCase())}</div>
            <div class="user-label">${esc(u.username)}<span class="user-sublabel">Connecté</span></div>
          </a>
          <button class="btn-connect btn" id="btnLogout" title="Se déconnecter">↩ Déconnexion</button>` : `
          <a href="page_login.html" class="btn-connect btn">Se connecter</a>
          <a href="page_signup.html" class="btn btn-primary btn-sm" style="margin-left:6px">Inscription</a>`;

        // Accès discret +18 : visible uniquement si l'espace est activé
        const nsfwLink = (window.NSFW?.isEnabled?.())
            ? `<a href="secret.html" title="Espace +18" style="color:#ec4899;font-weight:700;font-size:12px">+18</a>` : '';

        return `
        <header class="site-header">
          <a href="accueil.html" class="header-logo">
            <img src="/assets/img/icon.svg" alt="Inko" class="logo-icon" style="width:28px;height:28px;border-radius:7px">
            Inko
          </a>
          <nav class="header-nav">
            <a href="accueil.html" class="${activePage === 'accueil' ? 'active' : ''}">Accueil</a>
            <a href="catalogue.html" class="${['catalogue','serie','chapitre'].includes(activePage) ? 'active' : ''}">Catalogue</a>
            <a href="bibliotheque.html" class="${activePage === 'bibliotheque' ? 'active' : ''}" style="position:relative">Bibliothèque<span class="nav-badge" id="navLibBadge" style="display:none"></span></a>
            <a href="#" id="navRandom">Aléatoire</a>
            <a href="sources.html" class="${activePage === 'sources' ? 'active' : ''}">Sources</a>
            ${nsfwLink}
          </nav>
          <div class="header-search">
            <span class="header-search-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14" style="vertical-align:middle"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg></span>
            <input type="text" id="headerSearch" placeholder="Rechercher un manga…" autocomplete="off">
            <div class="search-dropdown" id="searchDropdown"></div>
          </div>
          <div class="header-actions">
            <button class="header-icon-btn" id="btnContinue" title="Reprendre ma dernière lecture" style="display:none"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="17" height="17" style="vertical-align:middle"><polygon points="6 4 20 12 6 20 6 4" fill="currentColor" stroke="none"/></svg></button>
            <button class="header-icon-btn" id="btnRefresh" title="Actualiser mes séries (nouveaux chapitres)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="17" height="17" style="vertical-align:middle"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg></button>
            <button class="header-icon-btn" id="btnMusic" title="Musique (s'ouvre dans une fenêtre qui reste en lecture)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" style="vertical-align:middle"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg></button>
            <a href="parametres.html" class="header-icon-btn ${activePage === 'parametres' ? 'active' : ''}" title="Paramètres" style="text-decoration:none"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" style="vertical-align:middle"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg></a>
            ${userBlock}
          </div>
        </header>`;
    };

    /* ── Footer HTML ─────────────────────────────────────── */
    const footerHTML = `
    <footer class="site-footer">
      <div class="footer-inner">
        <div class="footer-brand">
          <div class="footer-logo"><img src="/assets/img/icon.svg" alt="Inko" style="width:24px;height:24px;border-radius:6px;vertical-align:middle;margin-right:6px">Inko</div>
          <p class="footer-desc">Lecteur de mangas open-source. Découvre, lis et organise ta bibliothèque, sur toutes tes plateformes.</p>
          <div class="footer-stay">
            <h4>Restez informé</h4>
            <div class="footer-email-form">
              <input type="email" id="footerEmailInput" placeholder="Votre email…">
              <button id="footerEmailBtn">S'inscrire</button>
            </div>
          </div>
        </div>
        <div class="footer-col">
          <h4>Explorer</h4>
          <ul>
            <li><a href="catalogue.html">Catalogue</a></li>
            <li><a href="catalogue.html?sort=latest">Nouveautés</a></li>
            <li><a href="catalogue.html?sort=rating">Top</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Communauté</h4>
          <ul>
            <li><a href="#" class="footer-coming">Forum</a></li>
            <li><a href="#" class="footer-coming">Discord</a></li>
            <li><a href="#" class="footer-coming">Contact</a></li>
          </ul>
        </div>
        <div class="footer-col">
          <h4>Légal</h4>
          <ul>
            <li><a href="#" class="footer-coming">Confidentialité</a></li>
            <li><a href="#" class="footer-coming">Conditions</a></li>
          </ul>
        </div>
      </div>
      <div class="footer-bottom">
        <p>© 2026 Inko. Tous droits réservés. Données issues de MangaDex.</p>
      </div>
    </footer>`;

    /* ── Inject header & footer ──────────────────────────── */
    window.MH.initPage = function (activePage) {
        const headerSlot = document.getElementById('header-slot');
        const footerSlot = document.getElementById('footer-slot');
        if (headerSlot) headerSlot.outerHTML = headerHTML(activePage);
        if (footerSlot) footerSlot.innerHTML = footerHTML;
        initSearch();
        initFooterButtons();
        initHeaderButtons();
        bindGlobalShortcuts();
        renderMobileNav(activePage);
        window.MH.updateLibBadge();
        window.MH.loadSourceTypes();   // pré-charge les types pour le routage lecteur
        // Check des nouveautés au lancement (pas pendant la lecture : priorité aux pages)
        if (activePage !== 'chapitre') launchUpdateCheck();

        // Re-render header au login/logout
        window.addEventListener('auth:change', () => {
            const oldHeader = document.querySelector('.site-header');
            if (!oldHeader) return;
            const wrapper = document.createElement('div');
            wrapper.innerHTML = headerHTML(activePage);
            oldHeader.replaceWith(wrapper.firstElementChild);
            initSearch();
            _lastReadPromise = null;            // recalcule selon le nouveau compte
            window.MH.refreshContinueButton();
        });
    };

    /* ── Live search ─────────────────────────────────────── */
    function initSearch() {
        const input    = document.getElementById('headerSearch');
        const dropdown = document.getElementById('searchDropdown');
        if (!input || !dropdown) return;

        function render(results, q) {
            if (!results.length) {
                dropdown.innerHTML = `<div style="padding:14px;text-align:center;color:var(--text3);font-size:13px">Aucun résultat${q ? ` pour « ${esc(q)} »` : ''}</div>`;
            } else {
                dropdown.innerHTML = results.map(m => `
                  <a href="serie.html?id=${encodeURIComponent(m.id)}" class="search-result-item">
                      <img src="${m.coverThumb || m.cover || ''}" alt="" loading="lazy" onerror="this.style.display='none'">
                      <div class="search-result-info">
                          <div class="title">${esc(m.title)}</div>
                          <div class="meta">${esc(m.author || '')} ${m.year ? `· ${m.year}` : ''}</div>
                      </div>
                  </a>`).join('');
            }
            if (q && q.length > 0) {
                dropdown.innerHTML += `<a href="catalogue.html?q=${encodeURIComponent(q)}" class="search-result-item" style="justify-content:center;color:var(--orange);font-size:12.5px;font-weight:500;border-top:1px solid var(--border);padding:10px">Voir tous les résultats →</a>`;
            }
            dropdown.classList.add('open');
        }

        let timeout, lastQ;
        async function go(q) {
            lastQ = q;
            try {
                const data = q
                    ? await API.mangas.search({ q, limit: 6 })
                    : await API.mangas.popular({ limit: 6 });
                if (q === lastQ) render(data.results || [], q);
            } catch(e) {
                dropdown.innerHTML = `<div style="padding:14px;text-align:center;color:#ef4444;font-size:12.5px">Erreur de recherche</div>`;
                dropdown.classList.add('open');
            }
        }

        input.addEventListener('focus', () => go(input.value.trim()));
        input.addEventListener('input', () => {
            clearTimeout(timeout);
            const q = input.value.trim();
            timeout = setTimeout(() => go(q), 250);
        });
        document.addEventListener('click', e => {
            if (!input.closest('.header-search').contains(e.target)) dropdown.classList.remove('open');
        });
        input.addEventListener('keydown', e => {
            if (e.key === 'Escape') { dropdown.classList.remove('open'); input.blur(); }
            if (e.key === 'Enter' && input.value.trim()) {
                dropdown.classList.remove('open');
                window.location.href = `recherche.html?q=${encodeURIComponent(input.value.trim())}`;
            }
        });
    }

    /* ── Footer ──────────────────────────────────────────── */
    function initFooterButtons() {
        const emailBtn   = document.getElementById('footerEmailBtn');
        const emailInput = document.getElementById('footerEmailInput');
        if (emailBtn && emailInput) {
            emailBtn.addEventListener('click', () => {
                const v = emailInput.value.trim();
                if (!v) { MH.toast('Entrez votre adresse email.'); return; }
                if (!API.auth.validateEmail(v)) { MH.toast('Email invalide.'); return; }
                MH.toast('Inscription confirmée ! ');
                emailInput.value = '';
            });
        }
        document.addEventListener('click', e => {
            const link = e.target.closest('.footer-coming');
            if (!link) return;
            e.preventDefault();
            MH.toast('Bientôt disponible !');
        });
    }

    /* ── Header buttons ──────────────────────────────────── */
    let headerButtonsBound = false;
    function initHeaderButtons() {
        if (headerButtonsBound) return;
        headerButtonsBound = true;

        document.addEventListener('click', e => {
            const btn = e.target.closest('.notif-dot');
            if (btn) MH.toast('Aucune nouvelle notification ');
        });

        // Bouton musique : ouvre/refocus la fenêtre popout (reste en lecture pendant la nav)
        document.addEventListener('click', e => {
            const btn = e.target.closest('#btnMusic');
            if (!btn) return;
            e.preventDefault();
            window.MH.openMusic();
        });

        // Bouton actualiser : relance la vérification des nouveaux chapitres à la demande
        document.addEventListener('click', e => {
            const btn = e.target.closest('#btnRefresh');
            if (!btn) return;
            e.preventDefault();
            window.MH.checkUpdates({ force: true });
        });

        // Bouton « Continuer » : reprend la dernière lecture en cours
        document.addEventListener('click', async e => {
            const btn = e.target.closest('#btnContinue');
            if (!btn) return;
            e.preventDefault();
            const last = await window.MH.lastReadTarget();
            if (last) window.location.href = last.href;
            else MH.toast('Aucune lecture en cours pour le moment');
        });
        // Révèle le bouton si une lecture est en cours
        window.MH.refreshContinueButton();

        document.addEventListener('click', async e => {
            const btn = e.target.closest('#btnLogout');
            if (!btn) return;
            e.preventDefault();
            await API.auth.logout();
            MH.toast('Déconnecté avec succès');
            setTimeout(() => { window.location.href = 'accueil.html'; }, 400);
        });

        document.addEventListener('click', async e => {
            const btn = e.target.closest('#navRandom');
            if (!btn) return;
            e.preventDefault();
            try {
                const data = await API.mangas.popular({ limit: 50 });
                const list = data.results || [];
                if (!list.length) return;
                const m = list[Math.floor(Math.random() * list.length)];
                MH.toast(`Lecture aléatoire : ${m.title} `);
                setTimeout(() => { window.location.href = `serie.html?id=${encodeURIComponent(m.id)}&source=${encodeURIComponent(API.sources.current)}`; }, 500);
            } catch(e) { MH.toast('Erreur de chargement'); }
        });

        // ── Favoris : handler délégué unique (cœurs de cartes + bouton « + Suivre ») ──
        document.addEventListener('click', async e => {
            const btn = e.target.closest('[data-fav]');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            if (!window.API?.isLoggedIn()) { MH.toast('Connecte-toi pour ajouter des favoris'); return; }
            const id = btn.dataset.fav;
            // Bouton icône (cœur) sur les cartes ET le hero ; bouton texte ailleurs
            const isIcon = btn.classList.contains('card-fav-btn') || btn.classList.contains('hero-fav-btn');
            const ctx = btn.closest('.manga-card') || btn.closest('.hero-inner');
            const meta = {
                title: ctx?.querySelector('.manga-card-title, .hero-title')?.textContent?.trim() || null,
                cover: ctx?.querySelector('.hero-poster, img')?.src || null,
                source: API.sources.current,
            };
            const willFav = !btn.classList.contains('is-fav');
            btn.dataset.favTouched = '1';
            btn.classList.toggle('is-fav', willFav);
            if (isIcon) btn.innerHTML = MH.heartIcon(willFav);
            else        btn.textContent = willFav ? 'Suivi' : '+ Suivre';
            try {
                if (willFav) await API.me.addFavorite(id, meta);
                else         await API.me.removeFavorite(id);
                // Met à jour le cache partagé
                const set = await MH.getFavSet();
                if (willFav) set.add(String(id)); else set.delete(String(id));
                MH.toast(willFav ? 'Ajouté aux favoris' : 'Retiré des favoris');
            } catch (err) {
                // Rollback visuel en cas d'échec
                btn.classList.toggle('is-fav', !willFav);
                if (isIcon) btn.innerHTML = MH.heartIcon(!willFav);
                else        btn.textContent = !willFav ? 'Suivi' : '+ Suivre';
                MH.toast('Erreur : ' + err.message);
            }
        });
    }

    /* ── Raccourcis clavier globaux ──────────────────────── */
    let shortcutsBound = false;
    function bindGlobalShortcuts() {
        if (shortcutsBound) return;
        shortcutsBound = true;

        document.addEventListener('keydown', async (e) => {
            // Ignore si saisie en cours ou combinaison avec modificateur
            const tag = (e.target.tagName || '').toUpperCase();
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || e.target.isContentEditable) {
                if (e.key === 'Escape') e.target.blur();
                return;
            }
            switch (e.key) {
                case '/':
                    e.preventDefault();
                    document.getElementById('headerSearch')?.focus();
                    break;
                case 'r': document.getElementById('navRandom')?.click(); break;
                case 'b': window.location.href = 'bibliotheque.html'; break;
                case 'h': window.location.href = 'accueil.html'; break;
                case 'c': {
                    const last = await window.MH.lastReadTarget?.();
                    if (last) window.location.href = last.href; else MH.toast('Aucune lecture en cours');
                    break;
                }
                case '?': toggleShortcutsHelp(); break;
                case 'Escape': document.getElementById('mhShortcuts')?.remove(); break;
            }
        });
    }
    function toggleShortcutsHelp() {
        const ex = document.getElementById('mhShortcuts');
        if (ex) { ex.remove(); return; }
        const rows = [
            ['/', 'Rechercher'], ['r', 'Lecture aléatoire'], ['c', 'Reprendre la lecture'],
            ['b', 'Ma bibliothèque'], ['h', 'Accueil'], ['?', 'Afficher cette aide'], ['Échap', 'Fermer'],
        ];
        const ov = document.createElement('div');
        ov.id = 'mhShortcuts';
        ov.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);backdrop-filter:blur(2px)';
        ov.innerHTML = `<div style="background:var(--bg2);border:1px solid var(--border);border-radius:14px;padding:22px 24px;min-width:300px;max-width:90vw;box-shadow:0 20px 60px rgba(0,0,0,.5)">
            <div style="font-family:var(--font-head);font-size:17px;font-weight:700;margin-bottom:14px">Raccourcis clavier</div>
            ${rows.map(([k, l]) => `<div style="display:flex;justify-content:space-between;align-items:center;gap:24px;padding:6px 0;font-size:13.5px;color:var(--text2)"><span>${l}</span><kbd style="background:var(--bg4);border:1px solid var(--border2);border-radius:6px;padding:2px 9px;font-family:monospace;color:var(--text)">${k}</kbd></div>`).join('')}
            <div style="text-align:right;margin-top:14px"><button class="btn btn-primary btn-sm" id="mhShortcutsClose">Fermer</button></div>
        </div>`;
        ov.addEventListener('click', (e) => { if (e.target === ov) ov.remove(); });
        document.body.appendChild(ov);
        document.getElementById('mhShortcutsClose')?.addEventListener('click', () => ov.remove());
    }

})();
