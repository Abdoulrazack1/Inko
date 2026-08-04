// profil.js — Page profil dynamique (backend)
(function () {
    'use strict';

    let cacheMangas = new Map(); // id → manga details

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('profil');

        await (window.API?.ready || Promise.resolve());
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
            renderHistoryTimeline(),
            renderHeatmap(),
            renderListsPanel(),
            renderHistorySummary(),
            renderMyReviews(),
            renderBadges(),
            renderGenres(),
            renderLastReview(),
            renderConnections(),
            renderMiniCards(),
        ]);
        initToggles();
        initPrefBtns();
        initHistoryFilters();
        initViewToggles();
        initListNav();
        bindDangerActions();
        wireExtraButtons();
    });

    // ── Cartes de bas de profil : valeurs réelles ──
    async function renderMiniCards() {
        // Audit QUAL-04 : `dl` était utilisé sans jamais être déclaré — la
        // fonction levait donc une ReferenceError dès sa première ligne, et la
        // carte « Téléchargements » du profil restait sur son tiret. Même
        // classe de bug que le `reads7`/`reads7ev` déjà relevé : invisible en
        // lecture, avalée à l'exécution. C'est exactement ce que la règle
        // no-undef, réactivée, attrape.
        const dl = document.getElementById('miniDownloads');
        if (dl) {
            try {
                if (window.Downloads) {
                    const groups = await window.Downloads.byManga();
                    const st = await window.Downloads.storage();
                    const n = groups.reduce((a, g) => a + g.chapters.length, 0);
                    dl.textContent = n ? `${n} chap. · ${(st.usage / 1048576).toFixed(0)} Mo` : 'Aucun';
                } else { dl.textContent = 'Indisponible'; }
            } catch (e) { dl.textContent = 'Aucun'; }
        }
    }

    function redirectGuest() {
        document.querySelectorAll('.tab-content').forEach(t => t.style.display = 'none');
        const main = document.querySelector('.profil-main');
        // Audit N1/P4 : message honnête (non connecté ≠ serveur en panne)
        if (main) main.innerHTML = `<div class="card">${MH.guestNotice()}</div>`;
    }

    // ── Helpers ──
    const CACHE_MAX = 300;   // borne le cache (audit DF8 : Map non évincée)

    // Audit BUG-02 / PERF-01 : cette page déclenchait 201 appels
    // /api/sources/<src>/mangas/<id> par affichage — soit 201 SCRAPES du site
    // distant, ~80 s de temps réseau cumulé, et un risque de bannissement d'IP.
    // Or la donnée nécessaire (titre + couverture) est déjà renvoyée par
    // /api/me/favorites, EN UN SEUL APPEL, pour toute la bibliothèque. On amorce
    // donc le cache avec elle et on ne va sur le réseau que pour les œuvres
    // absentes des favoris (historique d'une série retirée, par ex.).
    let _favSeed = null;
    function favSeed() {
        if (!_favSeed) {
            _favSeed = Promise.resolve(API.me.favorites())
                .then(list => {
                    const map = new Map();
                    (list || []).forEach(f => {
                        const id = f.id || f.mangaId;
                        if (!id) return;
                        map.set(id, {
                            id,
                            title:      f.title || id,
                            cover:      f.cover || null,
                            coverThumb: f.cover || null,
                            source:     f.source || null,
                            fromSeed:   true,   // pas de tags : voir loadMangaFull()
                        });
                    });
                    return map;
                })
                .catch(() => new Map());
        }
        return _favSeed;
    }

    async function loadManga(id) {
        if (cacheMangas.has(id)) return cacheMangas.get(id);
        const seed = await favSeed();
        if (seed.has(id)) {
            const m = seed.get(id);
            cacheMangas.set(id, m);
            return m;
        }
        try {
            const m = await API.mangas.get(id);
            if (cacheMangas.size >= CACHE_MAX) cacheMangas.delete(cacheMangas.keys().next().value);
            cacheMangas.set(id, m);
            return m;
        } catch(e) { return null; }
    }

    // Récupère la fiche COMPLÈTE (avec tags) — nécessaire uniquement pour le
    // calcul des genres. Ignore l'amorce, qui n'a pas les tags.
    async function loadMangaFull(id) {
        const c = cacheMangas.get(id);
        if (c && !c.fromSeed) return c;
        try {
            const m = await API.mangas.get(id);
            if (cacheMangas.size >= CACHE_MAX) cacheMangas.delete(cacheMangas.keys().next().value);
            cacheMangas.set(id, m);
            return m;
        } catch(e) { return null; }
    }

    // Concurrence bornée : l'ancien Promise.all lançait N requêtes d'un coup.
    async function mapLimit(items, limit, fn) {
        const out = new Array(items.length);
        let idx = 0;
        await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
            while (idx < items.length) { const i = idx++; out[i] = await fn(items[i], i); }
        }));
        return out;
    }

    // Renvoie une Map id → œuvre (l'ancien tableau filtré désalignait les
    // index quand une œuvre manquait — les appelants indexaient par position).
    async function loadMangasMap(ids, { full = false } = {}) {
        const uniq = [...new Set(ids.filter(Boolean))];
        const fetcher = full ? loadMangaFull : loadManga;
        const list = await mapLimit(uniq, 4, fetcher);
        const map = new Map();
        uniq.forEach((id, i) => { if (list[i]) map.set(id, list[i]); });
        return map;
    }

    async function loadMangas(ids) {
        const map = await loadMangasMap(ids);
        return ids.map(id => map.get(id)).filter(Boolean);
    }

    // Audit P3 : un seul fetch de /me/stats partagé entre les 5 fonctions de
    // rendu qui tournent en parallèle au chargement (hero, badges, heatmap ×2,
    // résumé historique) — le serveur recalculait heatmap + streak 5 fois.
    let _statsPromise = null;
    function fetchStats() {
        if (!_statsPromise) {
            _statsPromise = API.me.stats();
            // Une erreur ne doit pas empoisonner le cache pour les appels suivants
            _statsPromise.catch(() => { _statsPromise = null; });
        }
        return _statsPromise;
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
        if (avatarEl) avatarEl.textContent = avatarText(u.avatar, u.username);
        if (nameEl)   nameEl.textContent   = u.username;
        // Audit P7 : le handle dérivé du pseudo n'était pas unique (deux
        // « John Doe » affichaient le même @john_doe). Suffixe #id = unique.
        if (handleEl) handleEl.textContent = '@' + u.username.toLowerCase().replace(/\s+/g, '_') + (u.id ? '#' + u.id : '');
        if (sinceEl)  sinceEl.textContent  = u.createdAt
            ? 'Membre depuis ' + new Date(u.createdAt).toLocaleDateString('fr-FR', { month:'short', year:'numeric' })
            : '';
    }

    async function renderHeroAndStats() {
        renderHeroIdentity();
        try {
            const stats = await fetchStats();
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
        } catch (e) { window.MH?.err?.('profil.js', e); }

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
            edit.addEventListener('click', async () => {
                const v = await MH.prompt('Objectif de lecture', { message: 'Combien de chapitres par semaine ?', value: String(goal), okText: 'Enregistrer' });
                if (v === null) return;
                const n = parseInt(v, 10);
                if (!n || n < 1) { MH.toast('Valeur invalide'); return; }
                window.Storage?.setPref('weeklyGoal', n);
                renderWeeklyGoal(heat);
                MH.toast('Objectif mis à jour : ' + n + ' chapitres/semaine');
            });
        }
    }

    // Avatar : emoji préservé tel quel, sinon 2 lettres majuscules
    function avatarText(a, name) {
        a = (a || '').trim();
        if (!a) return ((name || '?')[0] || '?').toUpperCase();
        if (/[^\x00-\x7F]/.test(a)) return a;   // emoji / caractère non-ASCII
        return a.toUpperCase().slice(0, 2);
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
                <label style="font-size:11.5px;color:var(--text2)">Avatar (lettre ou emoji)</label>
                <input id="epAvatar" class="list-modal-input" style="width:100%;margin:6px 0 10px" value="${MH.esc(u.avatar || (u.username || '?')[0].toUpperCase())}" maxlength="8">
                <div id="epEmojis" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px">
                    ${['📚','🦊','🐉','🌸','⚔️','👹','🔥','🌙','⭐','🎴','🐈','🍥','💀','👑','🎧'].map(e => `<button type="button" class="ep-emoji" data-e="${e}" style="font-size:18px;width:34px;height:34px;border-radius:9px;border:1px solid var(--border2);background:var(--bg3);cursor:pointer">${e}</button>`).join('')}
                </div>
                <div style="display:flex;gap:8px;justify-content:flex-end">
                    <button class="btn btn-ghost btn-sm" id="epCancel">Annuler</button>
                    <button class="btn btn-primary btn-sm" id="epSave">Enregistrer</button>
                </div>
            </div>`;
        document.body.appendChild(ov);
        ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
        ov.querySelectorAll('.ep-emoji').forEach(b => b.addEventListener('click', () => { ov.querySelector('#epAvatar').value = b.dataset.e; }));
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
                        <img src="${MH.cover(m?.coverThumb, m?.cover)}" alt="" loading="lazy"
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
            // Audit P6 : échantillon RÉPARTI sur toute la bibliothèque (60 max,
            // pas les 20 premiers) — les genres reflètent l'ensemble des goûts
            // sans marteler les sources d'un appel par favori pour autant.
            // Audit PERF-01 : c'est le SEUL bloc qui a réellement besoin des tags,
            // donc des fiches complètes (l'amorce via /me/favorites ne les porte
            // pas). L'échantillon descend de 60 à 24 : au-delà, la répartition des
            // genres ne bouge plus, et chaque fiche est un appel sortant vers la
            // source. Concurrence bornée à 4 par loadMangasMap.
            const SAMPLE = 24;
            const step = Math.max(1, Math.ceil(favs.length / SAMPLE));
            const sample = favs.filter((_, i) => i % step === 0).slice(0, SAMPLE);
            const byId = await loadMangasMap(sample.map(f => f.id || f.mangaId), { full: true });
            const mangas = [...byId.values()];
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
        } catch (e) { window.MH?.err?.('profil.js', e); }
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
        } catch (e) { window.MH?.err?.('profil.js', e); }
    }

    // ── Comptes connectés (composant unifié, actions réelles) ──
    async function renderConnections() {
        const el = document.getElementById('profilConnections');
        if (el && MH.renderConnections) await MH.renderConnections(el);
    }

    // ── Badges (succès calculés sur les vraies stats) ──
    async function renderBadges() {
        const el = document.getElementById('badgesGrid');
        if (!el) return;
        try {
            const stats = await fetchStats();
            const t = stats.totals || {};
            const heat = stats.heatmap || {};
            const activeDays = Object.keys(heat).length;
            const chapters = t.chapters_read || 0;
            const streak = stats.streak?.current || 0;
            const BADGES = [
                { ico: 'book', name: 'Premier pas',      desc: 'Lire son premier chapitre',     ok: chapters >= 1 },
                { ico: 'flame', name: 'Lancé',            desc: '10 chapitres lus',              ok: chapters >= 10 },
                { ico: 'target', name: 'Centurion',        desc: '100 chapitres lus',             ok: chapters >= 100 },
                { ico: 'trophy', name: 'Dévoreur',         desc: '1 000 chapitres lus',           ok: chapters >= 1000 },
                { ico: 'heart', name: 'Coup de cœur',     desc: 'Ajouter un favori',             ok: (t.favorites || 0) >= 1 },
                { ico: 'layers', name: 'Collectionneur',   desc: '10 séries dans la bibliothèque', ok: (t.library || 0) >= 10 },
                { ico: 'star', name: 'Critique',         desc: 'Donner un avis',                ok: (t.ratings || 0) >= 1 },
                { ico: 'calendar', name: 'Régulier',         desc: '7 jours de lecture actifs',     ok: activeDays >= 7 },
                { ico: 'zap', name: 'En feu',           desc: '3 jours d\'affilée',            ok: streak >= 3 },
                { ico: 'moon', name: 'Marathonien',      desc: '30 jours de lecture actifs',    ok: activeDays >= 30 },
            ];
            el.innerHTML = BADGES.map(b => `
                <div class="card" style="padding:14px;text-align:center;${b.ok ? '' : 'opacity:.38;filter:grayscale(.7)'}">
                    <div style="margin-bottom:6px;color:${b.ok ? 'var(--accent)' : 'var(--text3)'}">${MH.icon(b.ico, 28)}</div>
                    <div style="font-weight:700;font-size:13px">${b.name}</div>
                    <div style="font-size:11px;color:var(--text3);margin-top:3px">${b.desc}</div>
                    <div style="font-size:10px;font-weight:700;margin-top:8px;color:${b.ok ? 'var(--green)' : 'var(--text3)'}">${b.ok ? 'DÉBLOQUÉ' : 'VERROUILLÉ'}</div>
                </div>`).join('');

            // Mini-aperçu (vue d'ensemble) : les 4 derniers badges débloqués
            const mini = document.getElementById('badgesMini');
            if (mini) {
                const unlocked = BADGES.filter(b => b.ok);
                mini.innerHTML = unlocked.length
                    ? unlocked.slice(-4).map(b => `<div class="badge-item" title="${b.name} — ${b.desc}" style="color:var(--accent)">${MH.icon(b.ico, 24)}</div>`).join('')
                    : '<div style="color:var(--text3);font-size:12px;padding:6px 0">Lis ton premier chapitre pour débloquer un badge !</div>';
            }
        } catch (e) { el.innerHTML = ''; }
    }

    // ── Heatmap ──
    async function renderHeatmap() {
        const el = document.getElementById('heatmap');
        if (!el) return;
        try {
            const stats = await fetchStats();
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
        } catch (e) { window.MH?.err?.('profil.js', e); }

        // History mini heatmap
        const historyEl = document.getElementById('historyHeatmap');
        if (historyEl) {
            try {
                const stats = await fetchStats();
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
            } catch (e) { window.MH?.err?.('profil.js', e); }
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
                    <img src="${MH.cover(f.cover, MH.placeholderCover(f.mangaId))}" alt="${MH.esc(f.title || '')}" loading="lazy" onerror="this.src='${MH.placeholderCover(f.mangaId)}'">
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
            // Audit HIST2 : % exact basé sur le nombre réel de pages du chapitre
            // (persisté par le lecteur). Sans donnée (ancienne progression),
            // on n'affiche pas un faux % basé sur « 20 pages » deviné.
            const pctOf = (p) => {
                if (MH.isNovelSource(p.source)) return Math.min(100, p.page || 0);
                if (p.totalPages > 0) return Math.min(100, Math.round((p.page / p.totalPages) * 100));
                return null;   // inconnu : l'appelant masque le pourcentage
            };
            el.innerHTML = items.map((p, i) => {
                const m = mangas[i];
                if (!m) return '';
                return `
                <div class="history-entry">
                    <div class="history-entry-cover"><img src="${MH.cover(m.coverThumb, m.cover)}" alt="" loading="lazy" decoding="async"></div>
                    <div class="history-entry-info">
                        <div class="history-entry-title">${MH.esc(m.title)}</div>
                        <div class="history-entry-chap">Chapitre ${MH.chapNum(p.chapter)}</div>
                        <div class="history-entry-time">${relativeTime(p.updatedAt)}</div>
                    </div>
                    <a href="${MH.readerHref(m.id, p.chapterId, p.source)}" class="history-entry-status link-orange" style="text-decoration:none">▶</a>
                </div>`;
            }).join('');

            // Last read card — vraie progression ou état vide (jamais de démo)
            const lastCard = document.querySelector('.last-read-card');
            const body  = document.getElementById('lastReadBody');
            const empty = document.getElementById('lastReadEmpty');
            const m = items[0] ? mangas[0] : null;
            if (lastCard && m) {
                const pct = pctOf(items[0]);
                lastCard.querySelector('.last-read-cover img').src = m.coverThumb || m.cover || '';
                lastCard.querySelector('.last-read-title').textContent = m.title;
                lastCard.querySelector('.last-read-chap').textContent = `Chapitre ${MH.chapNum(items[0].chapter)}`;
                // pct=null : nombre de pages inconnu (ancienne progression) —
                // on affiche la page atteinte plutôt qu'un faux % (audit HIST2)
                lastCard.querySelector('.last-read-fill').style.width = (pct ?? 0) + '%';
                lastCard.querySelector('.last-read-progress span').textContent =
                    pct != null ? pct + '%' : `Page ${items[0].page || 1}`;
                const a = lastCard.querySelector('a.btn-primary');
                if (a) a.href = MH.readerHref(m.id, items[0].chapterId, items[0].source);
                if (body) body.style.display = '';
                if (empty) empty.style.display = 'none';
            } else {
                if (body) body.style.display = 'none';
                if (empty) empty.style.display = '';
            }
        } catch(e) {
            el.innerHTML = `<div style="padding:14px;color:#ef4444;font-size:12px">Erreur</div>`;
        }
    }

    // (renderLibraryGrid/initLibFilters supprimés — audit N4/F.7 : l'onglet
    //  « Ma bibliothèque » du profil est remplacé par la page bibliotheque.html)

    // ── Timeline ──
    // Audit HIST3 : la frise était tronquée à 30 événements sans « charger
    // plus » — on affiche par tranches et on recharge une fenêtre plus large
    // à la demande (plafond serveur : 500 événements).
    let histShown = 30;
    // Audit P8 : le bouton « ↕ Plus récent en premier » ne triait rien
    // (toast « Fonctionnalité à venir ») — il inverse désormais la frise.
    let histAsc = false;
    async function renderHistoryTimeline() {
        const el = document.getElementById('historyTimeline');
        if (!el) return;
        try {
            const fetchCount = Math.min(500, Math.max(50, histShown + 20));
            const events = await API.me.events(fetchCount);
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

            const shown = readEvents.slice(0, histShown);
            const groups = { "Aujourd'hui": [], 'Hier': [], 'Cette semaine': [], 'Plus ancien': [] };
            shown.forEach(e => {
                const d = new Date(e.at);
                const ds = d.toDateString();
                if (ds === today) groups["Aujourd'hui"].push(e);
                else if (ds === yStr) groups['Hier'].push(e);
                else if (new Date(e.at).getTime() > weekAgo) groups['Cette semaine'].push(e);
                else groups['Plus ancien'].push(e);
            });

            const allMangaIds = [...new Set(shown.map(e => e.mangaId))];
            const mangas = await loadMangas(allMangaIds);
            const mangaMap = new Map(mangas.map(m => [m.id, m]));

            let groupEntries = Object.entries(groups);
            if (histAsc) {
                // « Plus ancien en premier » : groupes ET événements inversés
                groupEntries = groupEntries.reverse();
                groupEntries.forEach(([, items]) => items.reverse());
            }
            el.innerHTML = groupEntries.map(([label, items]) => {
                if (!items.length) return '';
                const itemsHTML = items.map(item => {
                    const m = mangaMap.get(item.mangaId);
                    if (!m) return '';
                    return `
                    <div class="timeline-item">
                        <div class="timeline-dot green"></div>
                        <div class="timeline-time">${new Date(item.at).toLocaleTimeString('fr-FR', { hour:'2-digit', minute:'2-digit' })}</div>
                        <div class="timeline-cover"><img src="${MH.cover(m.coverThumb, m.cover)}" alt="" loading="lazy"></div>
                        <div class="timeline-info">
                            <div class="timeline-manga-name">${MH.esc(m.title)}</div>
                            <div class="timeline-chap">Chapitre ${item.metadata?.chapter || '?'}</div>
                        </div>
                        <a href="${MH.readerHref(m.id, item.chapterId, item.source)}" class="timeline-status lu" style="text-decoration:none">Reprendre</a>
                    </div>`;
                }).join('');
                return `<div class="timeline-group-label">${label}</div>${itemsHTML}`;
            }).join('') || `<div style="color:var(--text3);font-size:13px;padding:20px;text-align:center">Aucune activité récente.</div>`;

            // « Charger plus » tant qu'il reste des événements de lecture
            if (readEvents.length > histShown && histShown < 500) {
                el.innerHTML += `<div style="text-align:center;padding:14px">
                    <button class="btn btn-secondary btn-sm" id="histMore">Charger plus</button></div>`;
                el.querySelector('#histMore')?.addEventListener('click', () => {
                    histShown += 30;
                    renderHistoryTimeline();
                });
            }
        } catch(e) {
            el.innerHTML = `<div style="padding:14px;color:#ef4444">Erreur</div>`;
        }
    }

    // ── Lists ──
    // Résumé de l'onglet Historique : vraies stats (audit B6/B9 — fini les 42, +18%, One Piece…)
    async function renderHistorySummary() {
        if (!document.getElementById('hsChapters7')) return;
        const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
        try {
            const [stats, events] = await Promise.all([
                fetchStats().catch(() => ({})),
                API.me.events(500).catch(() => []),
            ]);
            const t = stats.totals || {};
            const heat = stats.heatmap || {};
            const now = Date.now(), DAY = 86400000;
            // Compte EXACT via la heatmap (DATE(read_at) sur read_chapters), pas les events
            // qui surcomptent (chaque reprise de progression émet un 'read').
            const dayKey = ms => new Date(ms).toISOString().slice(0, 10);
            let chap7 = 0, prev7chap = 0, active = 0;
            for (let i = 0; i < 7; i++)  { const c = heat[dayKey(now - i * DAY)] || 0; chap7 += c; if (c) active++; }
            for (let i = 7; i < 14; i++) { prev7chap += heat[dayKey(now - i * DAY)] || 0; }
            // Séries distinctes lues sur 7 j (via events, en relatif — ok pour un décompte de variété)
            const reads7ev = (events || []).filter(e => e.type === 'read' && now - new Date(e.at).getTime() <= 7 * DAY);

            set('hsChapters7', chap7);
            set('hsChaptersTotal', t.chapters_read ?? '—');
            set('hsSeries7', new Set(reads7ev.map(e => e.mangaId)).size);
            set('hsActiveDays', `${active}/7`);
            set('hsPerDay', (chap7 / 7).toFixed(1).replace('.', ','));
            set('hsChapters30', t.chapters_this_month ?? '—');
            set('hsStreak', (stats.streak?.current || 0) + ' j');

            // Tendance vs semaine précédente (réelle)
            const trendEl = document.getElementById('hsChaptersTrend');
            if (trendEl && (chap7 || prev7chap)) {
                const diff = chap7 - prev7chap;
                trendEl.textContent = diff === 0 ? '= semaine précédente' : `${diff > 0 ? '+' : ''}${diff} vs sem. préc.`;
                trendEl.className = 'hs-stat-trend ' + (diff >= 0 ? 'green' : '');
            }

            // Top séries les plus lues (7 j) — réelles
            const cont = document.getElementById('topSeries7');
            if (cont) {
                const counts = {};
                // Audit B4 : `reads7` n'existait pas (la variable s'appelle
                // reads7ev) — ReferenceError avalée par le catch silencieux,
                // le panneau « Top séries cette semaine » ne s'affichait jamais.
                reads7ev.forEach(e => { if (e.mangaId) counts[e.mangaId] = (counts[e.mangaId] || 0) + 1; });
                const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 3);
                if (!top.length) {
                    cont.innerHTML = `<div style="color:var(--text3);font-size:11.5px;padding:8px 4px">Aucune lecture cette semaine.</div>`;
                } else {
                    // Audit PERF-01 : indexation par id, pas par position — le
                    // tableau était filtré des valeurs nulles, donc une œuvre
                    // introuvable décalait tous les suivants (mauvaise couverture
                    // en face du mauvais titre).
                    const byId = await loadMangasMap(top.map(([id]) => id));
                    cont.innerHTML = top.map(([id, n]) => {
                        const m = byId.get(id) || {};
                        return `<div class="top-series-item">
                            <img src="${MH.cover(m.coverThumb, m.cover)}" alt="" loading="lazy" decoding="async" style="min-width:36px;min-height:50px;border-radius:4px;object-fit:cover;background:var(--bg4)" onerror="this.style.visibility='hidden'">
                            <div>
                                <div class="top-series-name">${MH.esc(m.title || id)}</div>
                                <div class="top-series-count">${n} chapitre${n > 1 ? 's' : ''} cette semaine</div>
                            </div>
                        </div>`;
                    }).join('');
                }
            }
        } catch (e) { window.MH?.err?.('profil.js', e); /* non bloquant, mais loggé (audit B4) */ }
    }

    let _lists = [];              // listes personnalisées (cache)
    let _activeList = 'favoris';  // 'favoris' ou id numérique

    async function renderListsPanel() {
        const panel = document.querySelector('.lists-panel');
        if (!panel) return;
        try {
            _lists = await API.me.lists();
            const customLabel = panel.querySelectorAll('.lists-section-label')[1];
            if (customLabel) {
                // Retire les anciennes entrées personnalisées puis réinjecte
                let next = customLabel.nextElementSibling;
                while (next) {
                    const el = next; next = next.nextElementSibling;
                    if (el.classList.contains('list-nav-item') || el.dataset.emptyLists) el.remove();
                }
                const html = _lists.length ? _lists.map(l => `
                    <div class="list-nav-item" data-list="${l.id}">
                        <span class="list-nav-icon"></span>
                        <div>
                            <div class="list-nav-name">${MH.esc(l.name)}</div>
                            <div class="list-nav-count">${l.mangaIds.length} titre${l.mangaIds.length > 1 ? 's' : ''}</div>
                        </div>
                    </div>`).join('') : `<div data-empty-lists="1" style="color:var(--text3);font-size:11.5px;padding:8px 4px">Aucune liste. Clique sur « + » pour en créer une.</div>`;
                customLabel.insertAdjacentHTML('afterend', html);
            }

            // Compteur Favoris (système) réel
            const favCount = (await API.me.favorites()).length;
            const favItem = panel.querySelector('.list-nav-item[data-list="favoris"] .list-nav-count');
            if (favItem) favItem.textContent = `${favCount} titre${favCount > 1 ? 's' : ''}`;

            // Bouton créer
            const addBtn = panel.querySelector('.lists-panel-header button');
            if (addBtn && !addBtn.dataset.bound) {
                addBtn.dataset.bound = '1';
                addBtn.addEventListener('click', async () => {
                    const name = await MH.prompt('Nouvelle liste', { placeholder: 'Nom de la liste', okText: 'Créer' });
                    if (name && name.trim()) {
                        try {
                            const l = await API.me.createList({ name: name.trim() });
                            MH.toast(`Liste « ${name.trim()} » créée`);
                            await renderListsPanel();
                            selectList(l.id);
                        } catch(e) { MH.toast('Erreur : ' + e.message); }
                    }
                });
            }

            // Sélection d'une liste (délégation : re-bind à chaque rendu)
            panel.querySelectorAll('.list-nav-item').forEach(item => {
                item.addEventListener('click', () => selectList(item.dataset.list));
            });

            // Bouton supprimer (une seule fois)
            const delBtn = document.getElementById('listDeleteBtn');
            if (delBtn && !delBtn.dataset.bound) {
                delBtn.dataset.bound = '1';
                delBtn.addEventListener('click', async () => {
                    if (_activeList === 'favoris') return;
                    const l = _lists.find(x => String(x.id) === String(_activeList));
                    if (!l) return;
                    if (!await MH.confirm(`Supprimer la liste « ${l.name} » ?`, { danger: true, okText: 'Supprimer' })) return;
                    try {
                        await API.me.deleteList(_activeList);
                        MH.toast('Liste supprimée');
                        await renderListsPanel();
                        selectList('favoris');
                    } catch(e) { MH.toast('Erreur : ' + e.message); }
                });
            }
        } catch (e) { window.MH?.err?.('profil.js', e); }

        // Restaure la sélection courante (ou favoris par défaut)
        selectList(_activeList);
    }

    function selectList(which) {
        _activeList = which || 'favoris';
        const panel = document.querySelector('.lists-panel');
        panel?.querySelectorAll('.list-nav-item').forEach(el =>
            el.classList.toggle('active', String(el.dataset.list) === String(_activeList)));
        const isFav = _activeList === 'favoris';
        const list = isFav ? null : _lists.find(l => String(l.id) === String(_activeList));
        const nameEl = document.getElementById('listDetailName');
        const countEl = document.getElementById('listDetailCount');
        const delBtn = document.getElementById('listDeleteBtn');
        if (nameEl)  nameEl.textContent = isFav ? 'Favoris' : (list?.name || 'Liste');
        if (delBtn)  delBtn.style.display = isFav ? 'none' : '';
        renderListDetail(isFav ? null : list, countEl);
    }

    async function renderListDetail(list, countEl) {
        const grid = document.getElementById('listMangaGrid');
        if (!grid) return;
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:24px;color:var(--text3)"><span class="spinner-inline"></span></div>`;
        try {
            // Favoris → toute la bibliothèque ; liste → ses mangaIds
            const ids = list
                ? (list.mangaIds || [])
                : (await API.me.favorites()).map(f => f.mangaId);
            if (countEl) countEl.textContent = `${ids.length} titre${ids.length > 1 ? 's' : ''}`;
            if (!ids.length) {
                grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--text3)">${
                    list ? 'Cette liste est vide. Ajoute des œuvres depuis leur fiche (« + Liste »).'
                         : 'Aucun favori pour l\'instant.'}</div>`;
                return;
            }
            const mangas = await loadMangas(ids.slice(0, 60));
            const progress = await API.me.progress();
            grid.innerHTML = mangas.map(m => {
                const p = progress[m.id];
                const chapRead = p?.chapter || 0;
                return `
                <div class="list-manga-item">
                    <a href="serie.html?id=${encodeURIComponent(m.id)}">
                        <div class="list-manga-cover"><img src="${MH.cover(m.cover, m.coverThumb)}" alt="${MH.esc(m.title)}" loading="lazy"></div>
                        <div class="list-manga-name">${MH.esc(m.title)}</div>
                        <div class="list-manga-meta">${chapRead ? 'Ch. ' + MH.chapNum(chapRead) : '—'}</div>
                    </a>
                </div>`;
            }).join('');
        } catch(e) {
            grid.innerHTML = `<div style="padding:14px;color:#ef4444">Erreur de chargement</div>`;
        }
    }

    // ── Toggles + prefs ──
    // Les toggles avec data-privacy sont persistés dans settings.privacy
    // (audit B10) ; les autres restent purement visuels.
    async function initToggles() {
        // Charge l'état réel des toggles de confidentialité
        let privacy = {};
        try { privacy = (await API.me.settings())?.privacy || {}; } catch (e) { window.MH?.err?.('profil.js', e); }
        document.querySelectorAll('.toggle[data-privacy]').forEach(t => {
            const key = t.dataset.privacy;
            const on = key === 'privateProfile' ? !!privacy[key] : (privacy[key] !== false); // défaut visible
            t.classList.toggle('on', on);
        });
        document.querySelectorAll('.toggle').forEach(t => {
            t.addEventListener('click', async () => {
                t.classList.toggle('on');
                const isOn = t.classList.contains('on');
                const key = t.dataset.privacy;
                if (key) {
                    try {
                        const cur = (await API.me.settings()) || {};
                        const p = { ...(cur.privacy || {}), [key]: isOn };
                        await API.me.saveSettings({ privacy: p });
                        MH.toast(isOn ? 'Activé ✓' : 'Désactivé');
                    } catch (e) { MH.toast('Erreur : ' + e.message); t.classList.toggle('on'); }
                } else {
                    MH.toast(isOn ? 'Activé ✓' : 'Désactivé');
                }
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
                            if (API.isLoggedIn()) { try { await API.me.saveSettings({ [cfg.key]: val }); } catch (e) { window.MH?.err?.('profil.js', e); } }
                            MH.toast('Préférence enregistrée ✓', 1200);
                        }
                    }
                });
            });
        });
    }

    // ── Wire tous les boutons restants (edit/share/social/connect) ──
    function wireExtraButtons() {
        // Hero : Partager. (Audit B5 : le bouton « Éditer » est câblé UNIQUEMENT
        // par renderHeroAndStats → openEditProfile — un second handler ici
        // ouvrait un MH.prompt concurrent par-dessus la modale au même clic.)
        const actions = document.querySelectorAll('.profil-actions .btn-ghost');
        actions.forEach(btn => {
            const txt = btn.textContent;
            if (/Partager/.test(txt)) {
                btn.addEventListener('click', async () => {
                    const url = location.origin + '/profil.html';
                    try { await navigator.clipboard.writeText(url); MH.toast('Lien du profil copié ✓'); }
                    catch(e) { MH.toast(url); }
                });
            }
        });

        // Boutons sociaux : enregistrer une URL
        document.querySelectorAll('.profil-social-btn').forEach(a => {
            a.addEventListener('click', async (e) => {
                e.preventDefault();
                const key = 'social_' + (a.title || 'link');
                const cur = window.Storage?.getPref(key) || '';
                const url = await MH.prompt(`Lien ${a.title || ''}`, { value: cur, placeholder: 'https://…', okText: 'Enregistrer' });
                if (url === null) return;
                if (url) { window.Storage?.setPref(key, url); window.open(url, '_blank'); }
            });
        });

        // (Audit P5) Bloc « comptes connectés Discord/Crunchyroll » supprimé :
        // ce pattern UI (.connected-item) n'existe plus — les comptes connectés
        // passent uniquement par MH.renderConnections() (AniList).

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
        // Audit P8 : câble le tri de la ligne du temps (avant : toast générique)
        const sortBtn = document.querySelector('.history-timeline-header .sort-btn');
        if (sortBtn && !sortBtn.dataset.wired) {
            sortBtn.dataset.wired = '1';
            sortBtn.addEventListener('click', () => {
                histAsc = !histAsc;
                sortBtn.textContent = histAsc ? '↕ Plus ancien en premier' : '↕ Plus récent en premier';
                renderHistoryTimeline();
            });
        }
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
