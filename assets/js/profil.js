// profil.js — Page profil dynamique (backend)
(function () {
    'use strict';

    let cacheMangas = new Map(); // id → manga details

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('profil');

        if (!API.isLoggedIn()) {
            redirectGuest();
            return;
        }

        initTabs();
        // Lance tout en parallèle, chaque section gère ses propres erreurs
        await Promise.all([
            renderHeroAndStats(),
            renderFavs(),
            renderHistoryMini(),
            renderLibraryGrid(),
            renderHistoryTimeline(),
            renderHeatmap(),
            renderListsPanel(),
            renderMyReviews(),
            renderBadges(),
            renderGenres(),
            renderLastReview(),
            renderConnections(),
        ]);
        initToggles();
        initPrefBtns();
        initLibFilters();
        initHistoryFilters();
        initViewToggles();
        initListNav();
        bindDangerActions();
        wireExtraButtons();
    });

    function redirectGuest() {
        document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
        const main = document.querySelector('.profil-main');
        if (main) main.innerHTML = `
            <div class="card" style="padding:60px;text-align:center">
                <div style="font-size:48px;margin-bottom:16px"></div>
                <div style="font-size:18px;font-weight:600;margin-bottom:8px">Connexion requise</div>
                <div style="color:var(--text3);margin-bottom:24px">Connectez-vous pour accéder à votre profil, vos favoris et votre historique.</div>
                <a href="page_login.html" class="btn btn-primary">Se connecter</a>
                <a href="page_signup.html" class="btn btn-ghost" style="margin-left:8px">S'inscrire</a>
            </div>`;
    }

    // ── Helpers ──
    async function loadManga(id) {
        if (cacheMangas.has(id)) return cacheMangas.get(id);
        try {
            const m = await API.mangas.get(id);
            cacheMangas.set(id, m);
            return m;
        } catch(e) { return null; }
    }

    async function loadMangas(ids) {
        const results = await Promise.all(ids.map(id => loadManga(id)));
        return results.filter(Boolean);
    }

    // ── Tabs ──
    function initTabs() {
        const items = document.querySelectorAll('.sidebar-nav-item[data-tab]');
        const tabs  = document.querySelectorAll('.tab-content');
        function activate(id) {
            tabs.forEach(t => t.classList.remove('active'));
            items.forEach(i => i.classList.remove('active'));
            document.getElementById('tab-' + id)?.classList.add('active');
            document.querySelector(`.sidebar-nav-item[data-tab="${id}"]`)?.classList.add('active');
        }
        items.forEach(i => i.addEventListener('click', e => { e.preventDefault(); activate(i.dataset.tab); }));
        document.addEventListener('click', e => {
            const el = e.target.closest('[data-goto]');
            if (el) { e.preventDefault(); activate(el.dataset.goto); }
        });
        activate('overview');
    }

    // ── Hero + Stats ──
    function renderHeroIdentity() {
        const u = API.user;
        if (!u) return;
        const avatarEl = document.querySelector('.profil-avatar');
        const nameEl   = document.querySelector('.profil-name');
        const handleEl = document.querySelector('.profil-handle');
        const sinceEl  = document.querySelector('.profil-since');
        if (avatarEl) avatarEl.textContent = (u.avatar || u.username[0] || '?').toUpperCase().slice(0, 2);
        if (nameEl)   nameEl.textContent   = u.username;
        if (handleEl) handleEl.textContent = '@' + u.username.toLowerCase().replace(/\s+/g, '_');
        if (sinceEl)  sinceEl.textContent  = u.createdAt
            ? 'Membre depuis ' + new Date(u.createdAt).toLocaleDateString('fr-FR', { month:'short', year:'numeric' })
            : '';
    }

    async function renderHeroAndStats() {
        renderHeroIdentity();
        try {
            const stats = await API.me.stats();
            const t = stats.totals || {};
            const heat = stats.heatmap || {};
            const statsEls = document.querySelectorAll('.profil-stat .profil-stat-num');
            if (statsEls[0]) statsEls[0].textContent = MH.fmt(t.chapters_read || 0);
            if (statsEls[1]) statsEls[1].textContent = MH.fmt(t.library || 0);
            if (statsEls[2]) statsEls[2].textContent = MH.fmt(t.favorites || 0);

            // Niveau : progression douce basée sur les chapitres réellement lus
            const lvl = 1 + Math.floor(Math.sqrt(t.chapters_read || 0));
            const lvlEl = document.getElementById('profilLevel');
            if (lvlEl) lvlEl.textContent = 'NIVEAU ' + lvl;

            const statCards = document.querySelectorAll('.stat-mini-card');
            if (statCards[0]) statCards[0].querySelector('.stat-mini-num').textContent = t.chapters_this_month || 0;
            // Temps de lecture estimé (~8 min / chapitre)
            if (statCards[1]) {
                const mins = (t.chapters_read || 0) * 8;
                const txt = mins < 60 ? mins + ' min'
                    : mins < 60 * 48 ? Math.round(mins / 60) + ' h'
                    : Math.round(mins / 60 / 24) + ' j';
                statCards[1].querySelector('.stat-mini-num').textContent = txt;
            }
            if (statCards[2]) statCards[2].querySelector('.stat-mini-num').textContent = t.favorites || 0;
            if (statCards[3]) statCards[3].querySelector('.stat-mini-num').textContent = Object.keys(heat).length;

            // Tendance réelle : ce mois vs mois précédent (heatmap)
            const badge = document.getElementById('statTrendBadge');
            if (badge) {
                const now = new Date();
                const ym  = (d) => d.toISOString().slice(0, 7);
                const cur = ym(now);
                const prevD = new Date(now.getFullYear(), now.getMonth() - 1, 15);
                const prev = ym(prevD);
                let nCur = 0, nPrev = 0;
                Object.entries(heat).forEach(([day, n]) => {
                    if (day.startsWith(cur)) nCur += n;
                    else if (day.startsWith(prev)) nPrev += n;
                });
                if (nPrev > 0) {
                    const pct = Math.round(((nCur - nPrev) / nPrev) * 100);
                    badge.textContent = (pct >= 0 ? '+' : '') + pct + '%';
                    badge.className = 'stat-mini-badge ' + (pct >= 0 ? 'green' : 'blue');
                    badge.style.display = '';
                }
            }

            renderWeeklyGoal(heat);
        } catch(e) {}

        // Bouton éditer profil
        const editBtn = document.querySelector('.profil-actions .btn-ghost');
        if (editBtn && !editBtn.dataset.bound) {
            editBtn.dataset.bound = '1';
            editBtn.addEventListener('click', openEditProfile);
        }
    }

    // ── Objectif hebdo (réel : heatmap des 7 derniers jours) ──
    function renderWeeklyGoal(heat) {
        const goal = Math.max(1, +(window.Storage?.getPref('weeklyGoal') || 15));
        let read = 0;
        for (let i = 0; i < 7; i++) {
            const d = new Date(); d.setDate(d.getDate() - i);
            read += heat[d.toISOString().slice(0, 10)] || 0;
        }
        const ring = document.getElementById('goalRingFill');
        const num  = document.getElementById('goalNum');
        const lab  = document.getElementById('goalLabel');
        const sub  = document.getElementById('goalSub');
        const ratio = Math.min(1, read / goal);
        if (ring) ring.style.strokeDashoffset = String(201 * (1 - ratio));
        if (num)  num.textContent = `${read}/${goal}`;
        if (lab) {
            lab.textContent = ratio >= 1 ? 'Objectif atteint !' : ratio >= 0.6 ? 'Excellent rythme !' : ratio > 0 ? 'En bonne voie' : 'C\'est parti ?';
            lab.style.color = ratio >= 1 ? 'var(--green)' : 'var(--text2)';
        }
        if (sub) sub.textContent = ratio >= 1 ? 'Bien joué cette semaine' : `Plus que ${goal - read} chapitre(s)`;

        const edit = document.getElementById('goalEdit');
        if (edit && !edit.dataset.bound) {
            edit.dataset.bound = '1';
            edit.addEventListener('click', () => {
                const v = prompt('Objectif de chapitres par semaine :', String(goal));
                if (v === null) return;
                const n = parseInt(v, 10);
                if (!n || n < 1) { MH.toast('Valeur invalide'); return; }
                window.Storage?.setPref('weeklyGoal', n);
                renderWeeklyGoal(heat);
                MH.toast('Objectif mis à jour : ' + n + ' chapitres/semaine');
            });
        }
    }

    // ── Édition du profil (nom + avatar) ──
    function openEditProfile() {
        const u = API.user || {};
        const ov = document.createElement('div');
        ov.style.cssText = 'position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.6);backdrop-filter:blur(3px);display:flex;align-items:center;justify-content:center';
        ov.innerHTML = `
            <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:var(--radius);padding:24px;width:min(380px,calc(100% - 40px))">
                <div style="font-weight:700;font-size:15px;margin-bottom:16px">Éditer le profil</div>
                <label style="font-size:11.5px;color:var(--text2)">Nom d'utilisateur</label>
                <input id="epName" class="list-modal-input" style="width:100%;margin:6px 0 14px" value="${MH.esc(u.username || '')}" maxlength="50">
                <label style="font-size:11.5px;color:var(--text2)">Avatar (1–2 caractères, lettre ou emoji)</label>
                <input id="epAvatar" class="list-modal-input" style="width:100%;margin:6px 0 18px" value="${MH.esc(u.avatar || (u.username || '?')[0].toUpperCase())}" maxlength="2">
                <div style="display:flex;gap:8px;justify-content:flex-end">
                    <button class="btn btn-ghost btn-sm" id="epCancel">Annuler</button>
                    <button class="btn btn-primary btn-sm" id="epSave">Enregistrer</button>
                </div>
            </div>`;
        document.body.appendChild(ov);
        ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
        ov.querySelector('#epCancel').addEventListener('click', () => ov.remove());
        ov.querySelector('#epSave').addEventListener('click', async () => {
            const username = ov.querySelector('#epName').value.trim();
            const avatar   = ov.querySelector('#epAvatar').value.trim();
            if (username.length < 2) { MH.toast('Nom trop court (2 caractères min)'); return; }
            try {
                await API.auth.updateProfile({ username, avatar });
                renderHeroIdentity();
                MH.toast('Profil mis à jour ✓');
                ov.remove();
            } catch (e) { MH.toast('Erreur : ' + e.message); }
        });
        ov.querySelector('#epName').focus();
    }

    // ── Mes avis ──
    async function renderMyReviews() {
        const el = document.getElementById('myReviewsList');
        if (!el) return;
        try {
            const ratings = await API.me.myRatings();
            if (!ratings.length) {
                el.innerHTML = `<div style="text-align:center;padding:30px;color:var(--text3);font-size:13px">
                    Aucun avis pour l'instant. Note une série depuis sa fiche !</div>`;
                return;
            }
            const mangas = await loadMangas(ratings.slice(0, 30).map(r => r.mangaId));
            const byId = new Map(mangas.filter(Boolean).map(m => [m.id, m]));
            el.innerHTML = ratings.slice(0, 30).map(r => {
                const m = byId.get(r.mangaId);
                const stars = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
                return `
                <div style="display:flex;gap:12px;padding:12px 0;border-bottom:1px solid var(--border)">
                    <a href="serie.html?id=${encodeURIComponent(r.mangaId)}" style="flex-shrink:0">
                        <img src="${m?.coverThumb || m?.cover || ''}" alt="" loading="lazy"
                             style="width:44px;height:62px;object-fit:cover;border-radius:6px;background:var(--bg4)">
                    </a>
                    <div style="min-width:0">
                        <a href="serie.html?id=${encodeURIComponent(r.mangaId)}" style="font-weight:600;font-size:13.5px;color:var(--text);text-decoration:none">${MH.esc(m?.title || r.mangaId)}</a>
                        <div style="color:#f59e0b;font-size:13px;margin:2px 0">${stars}</div>
                        ${r.review ? `<div style="font-size:12.5px;color:var(--text2);font-style:italic">« ${MH.esc(r.review)} »</div>` : ''}
                        <div style="font-size:11px;color:var(--text3);margin-top:3px">${r.updatedAt ? new Date(r.updatedAt).toLocaleDateString('fr-FR') : ''}</div>
                    </div>
                </div>`;
            }).join('');
        } catch (e) {
            el.innerHTML = `<div style="color:#ef4444;font-size:13px">Erreur : ${MH.esc(e.message)}</div>`;
        }
    }

    // ── Genres préférés (calculés sur les tags des favoris) ──
    async function renderGenres() {
        const el = document.getElementById('genreBars');
        if (!el) return;
        try {
            const favs = await API.me.favorites();
            if (!favs.length) return; // garde le message par défaut
            const mangas = await loadMangas(favs.slice(0, 20).map(f => f.mangaId));
            const counts = {};
            let total = 0;
            mangas.filter(Boolean).forEach(m => (m.tags || []).slice(0, 6).forEach(t => {
                counts[t] = (counts[t] || 0) + 1; total++;
            }));
            const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 4);
            if (!top.length) return;
            const colors = ['var(--orange)', '#ef4444', '#22c55e', '#3b82f6'];
            const max = top[0][1];
            el.innerHTML = top.map(([name, n], i) => {
                const pct = Math.round((n / max) * 100);
                return `
                <div class="genre-bar-item">
                    <div class="genre-bar-label"><span>${MH.esc(name)}</span><span>${pct}%</span></div>
                    <div class="genre-bar-track"><div class="genre-bar-fill" style="width:${pct}%;background:${colors[i]}"></div></div>
                </div>`;
            }).join('');
        } catch (e) {}
    }

    // ── Dernier avis (aperçu overview) ──
    async function renderLastReview() {
        const el = document.getElementById('lastReviewBox');
        if (!el) return;
        try {
            const ratings = await API.me.myRatings();
            if (!ratings.length) return; // message par défaut
            const r = ratings[0];
            const m = await loadManga(r.mangaId);
            el.innerHTML = `
                <div class="review-preview-manga">${MH.esc(m?.title || r.mangaId)}</div>
                <div style="color:#f59e0b;font-size:13px;margin:4px 0">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
                ${r.review ? `<div class="review-preview-text">«&nbsp;${MH.esc(r.review)}&nbsp;»</div>` : ''}`;
        } catch (e) {}
    }

    // ── Comptes connectés (statuts réels) ──
    async function renderConnections() {
        const sp = document.getElementById('spotifyConnStatus');
        if (sp) {
            try {
                const st = await API.spotify.status();
                sp.textContent = st.linked ? 'Connecté' : 'Non connecté';
                sp.classList.toggle('on', !!st.linked);
            } catch (e) { sp.textContent = 'Non connecté'; }
        }
        const al = document.getElementById('anilistConnStatus');
        if (al) {
            let linked = false;
            try { linked = !!localStorage.getItem('anilist_token'); } catch (e) {}
            al.textContent = linked ? 'Connecté' : 'Non connecté';
            al.classList.toggle('on', linked);
        }
    }

    // ── Badges (succès calculés sur les vraies stats) ──
    async function renderBadges() {
        const el = document.getElementById('badgesGrid');
        if (!el) return;
        try {
            const stats = await API.me.stats();
            const t = stats.totals || {};
            const heat = stats.heatmap || {};
            const activeDays = Object.keys(heat).length;
            const chapters = t.chapters_read || 0;
            const streak = stats.streak?.current || 0;
            const BADGES = [
                { ico: '📖', name: 'Premier pas',      desc: 'Lire son premier chapitre',     ok: chapters >= 1 },
                { ico: '🔥', name: 'Lancé',            desc: '10 chapitres lus',              ok: chapters >= 10 },
                { ico: '💯', name: 'Centurion',        desc: '100 chapitres lus',             ok: chapters >= 100 },
                { ico: '🏆', name: 'Dévoreur',         desc: '1 000 chapitres lus',           ok: chapters >= 1000 },
                { ico: '❤️', name: 'Coup de cœur',     desc: 'Ajouter un favori',             ok: (t.favorites || 0) >= 1 },
                { ico: '📚', name: 'Collectionneur',   desc: '10 séries dans la bibliothèque', ok: (t.library || 0) >= 10 },
                { ico: '⭐', name: 'Critique',         desc: 'Donner un avis',                ok: (t.ratings || 0) >= 1 },
                { ico: '📅', name: 'Régulier',         desc: '7 jours de lecture actifs',     ok: activeDays >= 7 },
                { ico: '⚡', name: 'En feu',           desc: '3 jours d\'affilée',            ok: streak >= 3 },
                { ico: '🌙', name: 'Marathonien',      desc: '30 jours de lecture actifs',    ok: activeDays >= 30 },
            ];
            el.innerHTML = BADGES.map(b => `
                <div class="card" style="padding:14px;text-align:center;${b.ok ? '' : 'opacity:.38;filter:grayscale(.7)'}">
                    <div style="font-size:28px;margin-bottom:6px">${b.ico}</div>
                    <div style="font-weight:700;font-size:13px">${b.name}</div>
                    <div style="font-size:11px;color:var(--text3);margin-top:3px">${b.desc}</div>
                    <div style="font-size:10px;font-weight:700;margin-top:8px;color:${b.ok ? 'var(--green)' : 'var(--text3)'}">${b.ok ? 'DÉBLOQUÉ' : 'VERROUILLÉ'}</div>
                </div>`).join('');

            // Mini-aperçu (vue d'ensemble) : les 4 derniers badges débloqués
            const mini = document.getElementById('badgesMini');
            if (mini) {
                const unlocked = BADGES.filter(b => b.ok);
                mini.innerHTML = unlocked.length
                    ? unlocked.slice(-4).map(b => `<div class="badge-item" title="${b.name} — ${b.desc}">${b.ico}</div>`).join('')
                    : '<div style="color:var(--text3);font-size:12px;padding:6px 0">Lis ton premier chapitre pour débloquer un badge !</div>';
            }
        } catch (e) { el.innerHTML = ''; }
    }

    // ── Heatmap ──
    async function renderHeatmap() {
        const el = document.getElementById('heatmap');
        if (!el) return;
        try {
            const stats = await API.me.stats();
            const buckets = stats.heatmap || {};
            const colors = ['var(--bg4)', 'rgba(255,107,26,.2)', 'rgba(255,107,26,.4)', 'rgba(255,107,26,.7)', 'var(--orange)'];
            const today = new Date();
            let html = '';
            for (let i = 52 * 7 - 1; i >= 0; i--) {
                const d = new Date(today); d.setDate(d.getDate() - i);
                const key = d.toISOString().slice(0, 10);
                const c = buckets[key] || 0;
                const lvl = c === 0 ? 0 : Math.min(4, Math.ceil(c / 2));
                html += `<div class="heatmap-cell" style="background:${colors[lvl]}" title="${key} · ${c} chap."></div>`;
            }
            el.innerHTML = html;
            const total = Object.values(buckets).reduce((s, v) => s + v, 0);
            const countEl = document.querySelector('.activity-count');
            if (countEl) countEl.textContent = `${total} chapitres récents`;
        } catch(e) {}

        // History mini heatmap
        const historyEl = document.getElementById('historyHeatmap');
        if (historyEl) {
            try {
                const stats = await API.me.stats();
                const buckets = stats.heatmap || {};
                const colors = ['var(--bg4)', 'rgba(255,107,26,.2)', 'rgba(255,107,26,.45)', 'rgba(255,107,26,.75)', 'var(--orange)'];
                const today = new Date();
                let html = '';
                for (let i = 27; i >= 0; i--) {
                    const d = new Date(today); d.setDate(d.getDate() - i);
                    const key = d.toISOString().slice(0, 10);
                    const c = buckets[key] || 0;
                    const lvl = c === 0 ? 0 : Math.min(4, Math.ceil(c / 2));
                    html += `<div class="history-mini-cell" style="background:${colors[lvl]}" title="${key} · ${c} chap."></div>`;
                }
                historyEl.innerHTML = html;
            } catch(e) {}
        }
    }

    // ── Favoris ──
    async function renderFavs() {
        const el = document.getElementById('favsGrid');
        if (!el) return;
        try {
            const favs = await API.me.favorites();
            if (!favs.length) {
                el.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:24px;color:var(--text3);font-size:13px">
                    Aucun favori. <a href="catalogue.html" class="link-orange">Explorer le catalogue →</a>
                </div><div class="fav-add" onclick="window.location.href='catalogue.html'">+</div>`;
                return;
            }
            // Les favoris stockent titre/cover/source : on les affiche directement
            // (correct pour une bibliothèque multi-sources, et plus rapide)
            el.innerHTML = favs.slice(0, 6).map(f => `
                <a href="serie.html?id=${encodeURIComponent(f.mangaId)}&source=${encodeURIComponent(f.source || '')}" class="fav-item">
                    <img src="${f.cover || MH.placeholderCover(f.mangaId)}" alt="${MH.esc(f.title || '')}" loading="lazy" onerror="this.src='${MH.placeholderCover(f.mangaId)}'">
                    <div class="fav-item-title">${MH.esc(f.title || f.mangaId)}</div>
                </a>
            `).join('') + `<div class="fav-add" onclick="window.location.href='catalogue.html'">+</div>`;
        } catch(e) {
            el.innerHTML = `<div style="padding:14px;color:#ef4444;font-size:12px">Erreur de chargement</div>`;
        }
    }

    // ── Historique mini ──
    async function renderHistoryMini() {
        const el = document.getElementById('historyMini');
        if (!el) return;
        try {
            const progress = await API.me.progress();
            const items = Object.entries(progress)
                .map(([id, p]) => ({ mangaId: id, ...p }))
                .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
                .slice(0, 4);
            if (!items.length) {
                el.innerHTML = `<div style="color:var(--text3);font-size:12.5px;padding:12px">Aucune lecture en cours.</div>`;
                return;
            }
            await MH.loadSourceTypes();
            // Récupère chaque œuvre depuis SA source (manga ou roman)
            const settled = await Promise.allSettled(items.map(i => API.mangas.getFrom(i.source, i.mangaId)));
            const mangas = settled.map(r => r.status === 'fulfilled' ? r.value : null);
            const pctOf = (p) => MH.isNovelSource(p.source) ? Math.min(100, p.page || 0) : Math.min(100, Math.round((p.page / 20) * 100));
            el.innerHTML = items.map((p, i) => {
                const m = mangas[i];
                if (!m) return '';
                return `
                <div class="history-entry">
                    <div class="history-entry-cover"><img src="${m.coverThumb || m.cover || ''}" alt=""></div>
                    <div class="history-entry-info">
                        <div class="history-entry-title">${MH.esc(m.title)}</div>
                        <div class="history-entry-chap">Chapitre ${p.chapter}</div>
                        <div class="history-entry-time">${relativeTime(p.updatedAt)}</div>
                    </div>
                    <a href="${MH.readerHref(m.id, p.chapterId, p.source)}" class="history-entry-status link-orange" style="text-decoration:none">▶</a>
                </div>`;
            }).join('');

            // Last read card
            const lastCard = document.querySelector('.last-read-card');
            if (lastCard && items[0]) {
                const m = mangas[0];
                if (m) {
                    const pct = pctOf(items[0]);
                    lastCard.querySelector('.last-read-cover img').src = m.coverThumb || m.cover || '';
                    lastCard.querySelector('.last-read-title').textContent = m.title;
                    lastCard.querySelector('.last-read-chap').textContent = `Chapitre ${items[0].chapter}`;
                    lastCard.querySelector('.last-read-fill').style.width = pct + '%';
                    lastCard.querySelector('.last-read-progress span').textContent = pct + '%';
                    const a = lastCard.querySelector('a.btn-primary');
                    if (a) a.href = MH.readerHref(m.id, items[0].chapterId, items[0].source);
                }
            }
        } catch(e) {
            el.innerHTML = `<div style="padding:14px;color:#ef4444;font-size:12px">Erreur</div>`;
        }
    }

    // ── Library ──
    async function renderLibraryGrid(filter = 'all') {
        const el = document.getElementById('libraryGrid');
        if (!el) return;
        try {
            const library = await API.me.library();
            let entries = library;
            if (filter === 'en_cours')    entries = entries.filter(e => e.status === 'reading');
            if (filter === 'a_commencer') entries = entries.filter(e => e.status === 'planned');
            if (filter === 'termine')     entries = entries.filter(e => e.status === 'completed');

            if (!entries.length) {
                el.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--text3)">
                    <p style="margin-bottom:12px">Aucun manga dans cette catégorie.</p>
                    <a href="catalogue.html" class="btn btn-primary btn-sm">Explorer le catalogue →</a>
                </div>`;
                return;
            }

            // Métadonnées depuis les favoris (titre/cover/source stockés) — correct
            // en multi-sources ; fallback fetch source courante pour le reste.
            const [favs, progress] = await Promise.all([API.me.favorites(), API.me.progress()]);
            const favMap = new Map((favs || []).map(f => [String(f.mangaId), f]));
            const toFetch = entries.filter(e => !favMap.has(String(e.mangaId)));
            const fetched = await Promise.allSettled(toFetch.map(e => API.mangas.get(e.mangaId)));
            const fetchedMap = new Map();
            toFetch.forEach((e, i) => { if (fetched[i].status === 'fulfilled') fetchedMap.set(String(e.mangaId), fetched[i].value); });

            el.innerHTML = entries.map((e) => {
                const fav = favMap.get(String(e.mangaId));
                const m = fav
                    ? { id: e.mangaId, title: fav.title || e.mangaId, cover: fav.cover, source: fav.source, tags: [] }
                    : fetchedMap.get(String(e.mangaId));
                if (!m) return '';
                const p = progress[m.id];
                const chapRead = p?.chapter || 0;
                const pct = Math.min(100, Math.round((chapRead / 100) * 100)); // approximation
                const labels = { reading:'En cours', completed:'Terminé', planned:'À lire', paused:'En pause', dropped:'Abandonné' };
                const colors = { reading:'#22c55e', completed:'#9ca3af', planned:'#3b82f6', paused:'#f59e0b', dropped:'#ef4444' };
                return `
                <div class="lib-manga-card">
                    <a href="serie.html?id=${encodeURIComponent(m.id)}&source=${encodeURIComponent(m.source || '')}">
                        <div class="manga-card-cover" style="aspect-ratio:3/4;border-radius:var(--radius);overflow:hidden;position:relative">
                            <img src="${m.cover || MH.placeholderCover(m.id)}" alt="${MH.esc(m.title)}" style="width:100%;height:100%;object-fit:cover" onerror="this.src='${MH.placeholderCover(m.id)}'">
                        </div>
                        <div class="lib-manga-progress-label" style="margin-top:6px">
                            <span style="font-size:12.5px;font-weight:500;color:var(--text)">${MH.esc(m.title)}</span>
                            <span style="color:${colors[e.status]};font-size:11px">${labels[e.status] || e.status}</span>
                        </div>
                        <div style="font-size:11.5px;color:var(--text2);margin-top:1px">Ch. ${chapRead} · ${(m.tags || [])[0] || ''}</div>
                        <div style="display:flex;align-items:center;gap:6px;margin-top:5px">
                            <div style="flex:1;height:3px;background:var(--bg4);border-radius:2px">
                                <div style="height:100%;width:${pct}%;background:${e.status === 'completed' ? 'var(--green)' : 'var(--orange)'};border-radius:2px"></div>
                            </div>
                            <span style="font-size:10.5px;color:var(--text3)">${pct}%</span>
                        </div>
                    </a>
                </div>`;
            }).join('');

            // Update filter counts
            const btns = document.querySelectorAll('.lib-filter-btn');
            if (btns[0]) btns[0].textContent = `Tout (${library.length})`;
            if (btns[1]) btns[1].textContent = `En cours (${library.filter(e => e.status === 'reading').length})`;
            if (btns[2]) btns[2].textContent = `À commencer (${library.filter(e => e.status === 'planned').length})`;
            if (btns[3]) btns[3].textContent = `Terminés (${library.filter(e => e.status === 'completed').length})`;
        } catch(e) {
            el.innerHTML = `<div style="padding:14px;color:#ef4444">Erreur de chargement</div>`;
        }
    }

    function initLibFilters() {
        document.querySelectorAll('.lib-filter-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                document.querySelectorAll('.lib-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                await renderLibraryGrid(btn.dataset.libfilter);
            });
        });
    }

    // ── Timeline ──
    async function renderHistoryTimeline() {
        const el = document.getElementById('historyTimeline');
        if (!el) return;
        try {
            const events = await API.me.events(50);
            const readEvents = events.filter(e => e.type === 'read');
            if (!readEvents.length) {
                el.innerHTML = `<div style="color:var(--text3);font-size:13px;padding:20px;text-align:center">Aucune activité enregistrée. Lis un chapitre pour démarrer.</div>`;
                return;
            }
            const now = new Date();
            const today = now.toDateString();
            const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
            const yStr = yesterday.toDateString();
            const weekAgo = Date.now() - 7 * 86400000;

            const groups = { "Aujourd'hui": [], 'Hier': [], 'Cette semaine': [], 'Plus ancien': [] };
            readEvents.slice(0, 30).forEach(e => {
                const d = new Date(e.at);
                const ds = d.toDateString();
                if (ds === today) groups["Aujourd'hui"].push(e);
                else if (ds === yStr) groups['Hier'].push(e);
                else if (new Date(e.at).getTime() > weekAgo) groups['Cette semaine'].push(e);
                else groups['Plus ancien'].push(e);
            });

            const allMangaIds = [...new Set(readEvents.map(e => e.mangaId))];
            const mangas = await loadMangas(allMangaIds);
            const mangaMap = new Map(mangas.map(m => [m.id, m]));

            el.innerHTML = Object.entries(groups).map(([label, items]) => {
                if (!items.length) return '';
                const itemsHTML = items.map(item => {
                    const m = mangaMap.get(item.mangaId);
                    if (!m) return '';
                    return `
                    <div class="timeline-item">
                        <div class="timeline-dot green"></div>
                        <div class="timeline-time">${new Date(item.at).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}</div>
                        <div class="timeline-cover"><img src="${m.coverThumb || m.cover || ''}" alt="" loading="lazy"></div>
                        <div class="timeline-info">
                            <div class="timeline-manga-name">${MH.esc(m.title)}</div>
                            <div class="timeline-chap">Chapitre ${item.metadata?.chapter || '?'}</div>
                        </div>
                        <a href="${MH.readerHref(m.id, item.chapterId, item.source)}" class="timeline-status lu" style="text-decoration:none">Reprendre</a>
                    </div>`;
                }).join('');
                return `<div class="timeline-group-label">${label}</div>${itemsHTML}`;
            }).join('') || `<div style="color:var(--text3);font-size:13px;padding:20px;text-align:center">Aucune activité récente.</div>`;
        } catch(e) {
            el.innerHTML = `<div style="padding:14px;color:#ef4444">Erreur</div>`;
        }
    }

    // ── Lists ──
    async function renderListsPanel() {
        const panel = document.querySelector('.lists-panel');
        if (!panel) return;
        try {
            const lists = await API.me.lists();
            const customLabel = panel.querySelector('.lists-section-label:nth-of-type(2)');
            if (customLabel) {
                let next = customLabel.nextElementSibling;
                while (next && next.classList.contains('list-nav-item')) {
                    const el = next; next = next.nextElementSibling; el.remove();
                }
                const html = lists.length ? lists.map(l => `
                    <div class="list-nav-item" data-list="${l.id}">
                        <span class="list-nav-icon"></span>
                        <div>
                            <div class="list-nav-name">${MH.esc(l.name)}</div>
                            <div class="list-nav-count">${l.mangaIds.length} manga${l.mangaIds.length > 1 ? 's' : ''}</div>
                        </div>
                    </div>`).join('') : `<div style="color:var(--text3);font-size:11.5px;padding:8px 4px">Aucune liste créée.</div>`;
                customLabel.insertAdjacentHTML('afterend', html);
            }

            // Mise à jour favoris count (système)
            const favCount = (await API.me.favorites()).length;
            const favItem = panel.querySelector('.list-nav-item[data-list="favoris"] .list-nav-count');
            if (favItem) favItem.textContent = `${favCount} manga${favCount > 1 ? 's' : ''}`;

            const addBtn = panel.querySelector('.lists-panel-header button');
            if (addBtn && !addBtn.dataset.bound) {
                addBtn.dataset.bound = '1';
                addBtn.addEventListener('click', async () => {
                    const name = prompt('Nom de la nouvelle liste :');
                    if (name && name.trim()) {
                        try {
                            await API.me.createList({ name: name.trim() });
                            MH.toast(`Liste « ${name.trim()} » créée`);
                            await renderListsPanel();
                        } catch(e) { MH.toast('Erreur : ' + e.message); }
                    }
                });
            }
        } catch(e) {}

        // Détail : favoris par défaut
        await renderListDetail();
    }

    async function renderListDetail() {
        const grid = document.getElementById('listMangaGrid');
        if (!grid) return;
        try {
            const favs = await API.me.favorites();
            const ids = favs.map(f => f.mangaId).slice(0, 12);
            if (!ids.length) {
                grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--text3)">Cette liste est vide.</div>`;
                return;
            }
            const mangas = await loadMangas(ids);
            const progress = await API.me.progress();
            grid.innerHTML = mangas.map(m => {
                const p = progress[m.id];
                const chapRead = p?.chapter || 0;
                const pct = Math.min(100, Math.round((chapRead / 100) * 100));
                return `
                <div class="list-manga-item">
                    <a href="serie.html?id=${encodeURIComponent(m.id)}">
                        <div class="list-manga-cover"><img src="${m.cover || ''}" alt="${MH.esc(m.title)}" loading="lazy"></div>
                        <div class="list-manga-name">${MH.esc(m.title)}</div>
                        <div class="list-manga-meta">Ch. ${chapRead}</div>
                        <div class="list-manga-progress">
                            <div class="list-manga-prog-bar"><div class="list-manga-prog-fill green" style="width:${pct}%"></div></div>
                        </div>
                    </a>
                </div>`;
            }).join('');
        } catch(e) {
            grid.innerHTML = `<div style="padding:14px;color:#ef4444">Erreur</div>`;
        }
    }

    // ── Toggles + prefs ──
    function initToggles() {
        document.querySelectorAll('.toggle').forEach(t => {
            t.addEventListener('click', () => {
                t.classList.toggle('on');
                MH.toast(t.classList.contains('on') ? 'Activé ✓' : 'Désactivé');
            });
        });
    }
    function initPrefBtns() {
        // Mappe chaque groupe de préférences vers une vraie clé de réglage
        const prefMap = [
            { label: 'Sens de lecture', key: 'readingDir', vals: { 'Droite → Gauche': 'rtl', 'Gauche → Droite': 'ltr' } },
            { label: 'Thème du lecteur', key: 'theme',      vals: { 'Sombre': 'dark', 'Clair': 'light' } },
            { label: 'Mode de défilement', key: 'readMode', vals: { 'Vertical': 'scroll', 'Horizontal': 'page' } },
        ];
        document.querySelectorAll('.pref-item').forEach(item => {
            const label = item.querySelector('.pref-label')?.textContent?.trim();
            const cfg = prefMap.find(p => label && label.includes(p.label.split(' ')[0]));
            item.querySelectorAll('.pref-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    item.querySelectorAll('.pref-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    if (cfg) {
                        const val = cfg.vals[btn.textContent.trim()];
                        if (val) {
                            window.Storage?.setPref(cfg.key, val);
                            if (cfg.key === 'theme') window.Theme?.apply(val);
                            if (API.isLoggedIn()) { try { await API.me.saveSettings({ [cfg.key]: val }); } catch(e){} }
                            MH.toast('Préférence enregistrée ✓', 1200);
                        }
                    }
                });
            });
        });
    }

    // ── Wire tous les boutons restants (edit/share/social/connect) ──
    function wireExtraButtons() {
        // Hero : Éditer + Partager
        const actions = document.querySelectorAll('.profil-actions .btn-ghost');
        actions.forEach(btn => {
            const txt = btn.textContent;
            if (/Éditer|Editer/.test(txt)) {
                btn.addEventListener('click', () => {
                    const u = API.user; if (!u) { MH.toast('Connecte-toi'); return; }
                    const name = prompt('Nouveau pseudo :', u.username);
                    if (name && name.trim()) API.auth.updateProfile({ username: name.trim() })
                        .then(() => { MH.toast('Profil mis à jour ✓'); renderHeroAndStats(); })
                        .catch(e => MH.toast('Erreur : ' + e.message));
                });
            } else if (/Partager/.test(txt)) {
                btn.addEventListener('click', async () => {
                    const url = location.origin + '/profil.html';
                    try { await navigator.clipboard.writeText(url); MH.toast('Lien du profil copié ✓'); }
                    catch(e) { MH.toast(url); }
                });
            }
        });

        // Boutons sociaux : enregistrer une URL
        document.querySelectorAll('.profil-social-btn').forEach(a => {
            a.addEventListener('click', (e) => {
                e.preventDefault();
                const key = 'social_' + (a.title || 'link');
                const cur = window.Storage?.getPref(key) || '';
                const url = prompt(`Lien ${a.title || ''} :`, cur);
                if (url === null) return;
                if (url) { window.Storage?.setPref(key, url); window.open(url, '_blank'); }
            });
        });

        // Comptes connectés : Spotify → ouvre le lecteur de musique ; autres → site officiel
        document.querySelectorAll('.connected-item').forEach(item => {
            const name = item.querySelector('.connected-name')?.textContent?.trim() || '';
            const btn = item.querySelector('button, .connected-status');
            const toggle = item.querySelector('.toggle');
            const act = () => {
                if (/Spotify/i.test(name)) { MH.openMusic(); MH.toast('Lecteur de musique ouvert '); }
                else if (/Discord/i.test(name)) window.open('https://discord.com/app', '_blank');
                else if (/Crunchyroll/i.test(name)) window.open('https://www.crunchyroll.com', '_blank');
            };
            btn?.addEventListener('click', act);
            toggle?.addEventListener('click', () => { if (/Spotify/i.test(name)) MH.openMusic(); });
        });

        // "Ouvrir le lecteur" dans les préférences → lecteur de chapitre démo déjà un lien
        // Boutons "Voir tout", "Gérer", etc. avec data-goto déjà gérés par initTabs.

        // Boutons génériques restants sans handler → feedback honnête
        document.querySelectorAll('.card-link, .sort-btn, .badges-grid .badge-item').forEach(el => {
            if (el.dataset.wired || el.dataset.goto || el.getAttribute('href')) return;
            el.dataset.wired = '1';
            el.addEventListener('click', (e) => {
                if (el.closest('a')) return;
                MH.toast('Fonctionnalité à venir');
            });
        });
    }
    function initHistoryFilters() {
        document.querySelectorAll('.hqf-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.hqf-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }
    function initViewToggles() {
        document.querySelectorAll('.view-toggle-btns').forEach(group => {
            group.querySelectorAll('.view-toggle').forEach(btn => {
                btn.addEventListener('click', () => {
                    group.querySelectorAll('.view-toggle').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });
        });
    }
    function initListNav() {
        document.querySelectorAll('.list-nav-item[data-list]').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.list-nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            });
        });
    }

    function bindDangerActions() {
        document.querySelector('.sidebar-nav-danger')?.addEventListener('click', async (e) => {
            e.preventDefault();
            await API.auth.logout();
            MH.toast('Déconnecté');
            setTimeout(() => { window.location.href = 'accueil.html'; }, 500);
        });
    }

    function relativeTime(ts) {
        if (!ts) return '';
        const diff = (Date.now() - new Date(ts).getTime()) / 1000;
        if (diff < 60)     return "à l'instant";
        if (diff < 3600)   return `il y a ${Math.floor(diff / 60)} min`;
        if (diff < 86400)  return `il y a ${Math.floor(diff / 3600)}h`;
        if (diff < 604800) return `il y a ${Math.floor(diff / 86400)}j`;
        return new Date(ts).toLocaleDateString('fr-FR');
    }
})();
