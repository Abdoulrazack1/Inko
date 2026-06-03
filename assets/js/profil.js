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
    async function renderHeroAndStats() {
        const u = API.user;
        if (u) {
            const avatarEl = document.querySelector('.profil-avatar');
            const nameEl   = document.querySelector('.profil-name');
            const handleEl = document.querySelector('.profil-handle');
            const sinceEl  = document.querySelector('.profil-since');
            if (avatarEl) avatarEl.textContent = (u.username[0] || '?').toUpperCase();
            if (nameEl)   nameEl.textContent   = u.username;
            if (handleEl) handleEl.textContent = '@' + u.username.toLowerCase().replace(/\s+/g, '_');
            if (sinceEl)  sinceEl.textContent  = u.createdAt
                ? 'Membre depuis ' + new Date(u.createdAt).toLocaleDateString('fr-FR', { month:'short', year:'numeric' })
                : '';
        }
        try {
            const stats = await API.me.stats();
            const t = stats.totals || {};
            const statsEls = document.querySelectorAll('.profil-stat .profil-stat-num');
            if (statsEls[0]) statsEls[0].textContent = MH.fmt(t.chapters_read || 0);
            if (statsEls[1]) statsEls[1].textContent = MH.fmt(t.library || 0);
            if (statsEls[2]) statsEls[2].textContent = MH.fmt(t.favorites || 0);

            const statCards = document.querySelectorAll('.stat-mini-card');
            if (statCards[0]) statCards[0].querySelector('.stat-mini-num').textContent = t.chapters_this_month || 0;
            if (statCards[2]) statCards[2].querySelector('.stat-mini-num').textContent = t.favorites || 0;
            if (statCards[3]) statCards[3].querySelector('.stat-mini-num').textContent = Object.keys(stats.heatmap || {}).length;
        } catch(e) {}

        // Bouton éditer profil
        const editBtn = document.querySelector('.profil-actions .btn-ghost');
        if (editBtn && !editBtn.dataset.bound) {
            editBtn.dataset.bound = '1';
            editBtn.addEventListener('click', () => MH.toast('Édition du profil bientôt disponible'));
        }
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
            const mangas = await loadMangas(favs.slice(0, 6).map(f => f.mangaId));
            el.innerHTML = mangas.map(m => `
                <a href="serie.html?id=${encodeURIComponent(m.id)}" class="fav-item">
                    <img src="${m.coverThumb || m.cover || ''}" alt="${MH.esc(m.title)}" loading="lazy">
                    <div class="fav-item-title">${MH.esc(m.title)}</div>
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
            const mangas = await loadMangas(items.map(i => i.mangaId));
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
                    <a href="chapitre.html?manga=${encodeURIComponent(m.id)}&chapter=${encodeURIComponent(p.chapterId)}" class="history-entry-status link-orange" style="text-decoration:none">▶</a>
                </div>`;
            }).join('');

            // Last read card
            const lastCard = document.querySelector('.last-read-card');
            if (lastCard && items[0]) {
                const m = mangas[0];
                if (m) {
                    const pct = Math.min(100, Math.round((items[0].page / 20) * 100));
                    lastCard.querySelector('.last-read-cover img').src = m.coverThumb || m.cover || '';
                    lastCard.querySelector('.last-read-title').textContent = m.title;
                    lastCard.querySelector('.last-read-chap').textContent = `Chapitre ${items[0].chapter}`;
                    lastCard.querySelector('.last-read-fill').style.width = pct + '%';
                    lastCard.querySelector('.last-read-progress span').textContent = pct + '%';
                    const a = lastCard.querySelector('a.btn-primary');
                    if (a) a.href = `chapitre.html?manga=${encodeURIComponent(m.id)}&chapter=${encodeURIComponent(items[0].chapterId)}`;
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

            const mangas = await loadMangas(entries.map(e => e.mangaId));
            const progress = await API.me.progress();

            el.innerHTML = entries.map((e, i) => {
                const m = mangas[i];
                if (!m) return '';
                const p = progress[m.id];
                const chapRead = p?.chapter || 0;
                const pct = Math.min(100, Math.round((chapRead / 100) * 100)); // approximation
                const labels = { reading:'En cours', completed:'Terminé', planned:'À lire', paused:'En pause', dropped:'Abandonné' };
                const colors = { reading:'#22c55e', completed:'#9ca3af', planned:'#3b82f6', paused:'#f59e0b', dropped:'#ef4444' };
                return `
                <div class="lib-manga-card">
                    <a href="serie.html?id=${encodeURIComponent(m.id)}">
                        <div class="manga-card-cover" style="aspect-ratio:3/4;border-radius:var(--radius);overflow:hidden;position:relative">
                            <img src="${m.cover || ''}" alt="${MH.esc(m.title)}" style="width:100%;height:100%;object-fit:cover">
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
                        <a href="chapitre.html?manga=${encodeURIComponent(m.id)}&chapter=${encodeURIComponent(item.chapterId)}" class="timeline-status lu" style="text-decoration:none">Reprendre</a>
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
