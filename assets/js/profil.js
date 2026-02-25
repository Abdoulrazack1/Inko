// profil.js — Page Profil MangaHub
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', () => {
        MH.initPage('profil');
        initTabs();
        renderHeatmap();
        renderFavs();
        renderHistoryMini();
        renderLibraryGrid();
        renderHistoryTimeline();
        renderHistoryHeatmap();
        renderListMangaGrid();
        initToggles();
        initPrefBtns();
        initLibFilters();
        initHistoryFilters();
        initViewToggles();
        initListNav();
    });

    // ── Tabs ─────────────────────────────────────────────────
    function initTabs() {
        const items = document.querySelectorAll('.sidebar-nav-item[data-tab]');
        const tabs  = document.querySelectorAll('.tab-content');

        function activate(tabId) {
            tabs.forEach(t => t.classList.remove('active'));
            items.forEach(i => i.classList.remove('active'));
            const tab  = document.getElementById('tab-' + tabId);
            const item = document.querySelector(`.sidebar-nav-item[data-tab="${tabId}"]`);
            if (tab)  tab.classList.add('active');
            if (item) item.classList.add('active');
        }

        items.forEach(item => {
            item.addEventListener('click', e => {
                e.preventDefault();
                activate(item.dataset.tab);
            });
        });

        // Liens "goto" dans les cartes
        document.addEventListener('click', e => {
            const el = e.target.closest('[data-goto]');
            if (el) { e.preventDefault(); activate(el.dataset.goto); }
        });

        // Activer le premier tab par défaut
        activate('overview');
    }

    // ── Heatmap annuelle ─────────────────────────────────────
    function renderHeatmap() {
        const el = document.getElementById('heatmap');
        if (!el) return;
        const levels = [0, 1, 2, 3, 4];
        const weights = [0.45, 0.25, 0.15, 0.1, 0.05];
        let html = '';
        for (let w = 0; w < 52; w++) {
            for (let d = 0; d < 7; d++) {
                const rnd = Math.random();
                let acc = 0, lvl = 0;
                for (let i = 0; i < weights.length; i++) { acc += weights[i]; if (rnd < acc) { lvl = i; break; } }
                const colors = ['var(--bg4)', 'rgba(255,107,26,.2)', 'rgba(255,107,26,.4)', 'rgba(255,107,26,.7)', 'var(--orange)'];
                html += `<div class="heatmap-cell" style="background:${colors[lvl]}" title="${lvl * 3} chapitres"></div>`;
            }
        }
        el.innerHTML = html;
    }

    // ── Historique mini heatmap ──────────────────────────────
    function renderHistoryHeatmap() {
        const el = document.getElementById('historyHeatmap');
        if (!el) return;
        const colors = ['var(--bg4)', 'rgba(255,107,26,.2)', 'rgba(255,107,26,.45)', 'rgba(255,107,26,.75)', 'var(--orange)'];
        let html = '';
        for (let i = 0; i < 28; i++) {
            const lvl = Math.floor(Math.random() * 5);
            html += `<div class="history-mini-cell" style="background:${colors[lvl]}"></div>`;
        }
        el.innerHTML = html;
    }

    // ── Favoris ──────────────────────────────────────────────
    function renderFavs() {
        const el = document.getElementById('favsGrid');
        if (!el || !window.DB) return;
        const favMangas = [1, 48, 47, 3, 2].map(id => DB.getManga(id)).filter(Boolean);
        el.innerHTML = favMangas.map(m => `
            <a href="serie.html?id=${m.id}" class="fav-item">
                <img src="${m.coverFallback}" alt="${MH.esc(m.title)}">
                <div class="fav-item-title">${MH.esc(m.title)}</div>
            </a>
        `).join('') + `<div class="fav-add" onclick="MH.toast('Fonctionnalité bientôt disponible !')">+</div>`;
    }

    // ── Historique mini (overview) ───────────────────────────
    function renderHistoryMini() {
        const el = document.getElementById('historyMini');
        if (!el || !window.DB) return;
        const items = [
            { mangaId: 31, chap: 1100, time: 'il y a 4h 2h', status: 'Lu', pct: 80 },
            { mangaId: 47, chap: 148,  time: 'Terminé hier', status: 'Lu', pct: 100 },
            { mangaId: 1,  chap: 41,   time: 'il y a 3 jours', status: 'Lu', pct: 60 },
        ];
        el.innerHTML = items.map(h => {
            const m = DB.getManga(h.mangaId);
            if (!m) return '';
            return `
            <div class="history-entry">
                <div class="history-entry-cover">
                    <img src="${m.coverFallback}" alt="${MH.esc(m.title)}">
                </div>
                <div class="history-entry-info">
                    <div class="history-entry-title">${MH.esc(m.title)}</div>
                    <div class="history-entry-chap">Chapitre ${h.chap}</div>
                    <div class="history-entry-time">${h.time}</div>
                </div>
                <div class="history-entry-status">${h.status}</div>
            </div>`;
        }).join('');
    }

    // ── Grille bibliothèque ──────────────────────────────────
    const libMangaIds = [1, 47, 48, 2, 31, 56, 34, 29];
    function renderLibraryGrid(filter = 'all') {
        const el = document.getElementById('libraryGrid');
        if (!el || !window.DB) return;
        const progData = {
            1:  { pct: 92, status: 'termine',  chap: 359, tag: 'Dark Fantasy', rating: '★★★★★' },
            47: { pct: 62, status: 'en_cours',  chap: 148, tag: 'Surnaturel',   rating: '★★★★☆' },
            48: { pct: 81, status: 'en_cours',  chap: 247, tag: 'Action',       rating: '★★★★☆' },
            2:  { pct: 0,  status: 'a_commencer',chap: 21, tag: 'Historique',   rating: '★★★★★' },
            31: { pct: 62, status: 'en_cours',  chap: 1100,tag: 'Aventure',     rating: '★★★★★' },
            56: { pct: 0,  status: 'termine',   chap: 8,   tag: 'Sci-Fi',       rating: '★★★★☆', note: 'Terminé' },
            34: { pct: 0,  status: 'a_commencer',chap: 1,  tag: 'Thriller',     rating: '★★★★★', note: 'Relecture' },
            29: { pct: 0,  status: 'en_cours',  chap: 500, tag: 'Action',       rating: '★★★☆☆', note: 'En pause' },
        };
        let ids = libMangaIds;
        if (filter === 'en_cours')    ids = ids.filter(id => progData[id]?.status === 'en_cours');
        if (filter === 'a_commencer') ids = ids.filter(id => progData[id]?.status === 'a_commencer');
        if (filter === 'termine')     ids = ids.filter(id => progData[id]?.status === 'termine');

        el.innerHTML = ids.map(id => {
            const m = DB.getManga(id);
            if (!m) return '';
            const p = progData[id] || { pct: 0, status: 'en_cours', chap: 1, tag: m.genres[0], rating: '★★★☆☆' };
            const fillColor = p.status === 'termine' ? 'green' : 'orange';
            const statusLabel = { en_cours: 'En cours', termine: 'Terminé', a_commencer: 'À lire', pause: 'Pause' }[p.status] || p.status;
            const statusColor = { en_cours: '#22c55e', termine: '#9ca3af', a_commencer: '#3b82f6', pause: '#f59e0b' }[p.status] || 'var(--text2)';
            return `
            <div class="lib-manga-card">
                <a href="serie.html?id=${m.id}">
                    <div class="manga-card-cover" style="aspect-ratio:3/4;border-radius:var(--radius);overflow:hidden;position:relative">
                        <img src="${m.coverFallback}" alt="${MH.esc(m.title)}" style="width:100%;height:100%;object-fit:cover">
                        <div class="manga-card-badges">
                            ${m.isHot ? '<span class="badge badge-hot">HOT</span>' : ''}
                        </div>
                    </div>
                    <div class="lib-manga-progress-label" style="margin-top:6px">
                        <span style="font-size:12.5px;font-weight:500;color:var(--text)">${MH.esc(m.title)}</span>
                        <span style="color:${statusColor};font-size:11px">${p.note || statusLabel}</span>
                    </div>
                    <div style="font-size:11.5px;color:var(--text2);margin-top:1px">Ch. ${p.chap} · ${p.tag}</div>
                    <div style="display:flex;align-items:center;gap:6px;margin-top:5px">
                        <div style="flex:1;height:3px;background:var(--bg4);border-radius:2px">
                            <div style="height:100%;width:${p.pct}%;background:${p.status === 'termine' ? 'var(--green)' : 'var(--orange)'};border-radius:2px"></div>
                        </div>
                        <span style="font-size:10.5px;color:var(--text3)">${p.pct}%</span>
                        <span style="font-size:10.5px;color:var(--text3)">${p.rating}</span>
                    </div>
                </a>
            </div>`;
        }).join('');
    }

    function initLibFilters() {
        document.querySelectorAll('.lib-filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.lib-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderLibraryGrid(btn.dataset.libfilter);
            });
        });
    }

    // ── Timeline historique ──────────────────────────────────
    function renderHistoryTimeline() {
        const el = document.getElementById('historyTimeline');
        if (!el || !window.DB) return;
        const groups = [
            {
                label: "Aujourd'hui",
                items: [
                    { mangaId: 31, chap: 1100, genre: 'Aventure',    time: '14:20', status: 'lu',       statusLabel: 'Terminé'     },
                    { mangaId: 48, chap: 240,  genre: 'Action',      time: '13:02', status: 'lu',       statusLabel: 'Lu'          },
                ],
            },
            {
                label: 'Hier',
                items: [
                    { mangaId: 1,  chap: 356,  genre: 'Dark Fantasy', time: '22:40', status: 'lu',       statusLabel: 'Lu'          },
                    { mangaId: 29, chap: 500,  genre: 'Action',       time: '18:15', status: 'cours',    statusLabel: 'En cours'    },
                ],
            },
            {
                label: 'Ce week-end',
                items: [
                    { mangaId: 2,  chap: 21,   genre: 'Historique',  time: 'Sam. 16:45', status: 'relecture', statusLabel: 'Relecture'  },
                    { mangaId: 34, chap: 45,   genre: 'Thriller',    time: 'Dim. 11:10', status: 'arc',       statusLabel: 'Arc terminé'},
                ],
            },
        ];
        el.innerHTML = groups.map(g => {
            const itemsHTML = g.items.map(item => {
                const m = DB.getManga(item.mangaId);
                if (!m) return '';
                const dotColor = item.status === 'lu' ? 'green' : 'orange';
                return `
                <div class="timeline-item">
                    <div class="timeline-dot ${dotColor}"></div>
                    <div class="timeline-time">${item.time}</div>
                    <div class="timeline-cover">
                        <img src="${m.coverFallback}" alt="${MH.esc(m.title)}">
                    </div>
                    <div class="timeline-info">
                        <div class="timeline-manga-name">${MH.esc(m.title)}</div>
                        <div class="timeline-chap">Chapitre ${item.chap} · ${item.genre}</div>
                    </div>
                    <div class="timeline-status ${item.status}">${item.statusLabel}</div>
                </div>`;
            }).join('');
            return `<div class="timeline-group-label">${g.label}</div>${itemsHTML}`;
        }).join('');
    }

    // ── Liste manga grid ─────────────────────────────────────
    function renderListMangaGrid() {
        const el = document.getElementById('listMangaGrid');
        if (!el || !window.DB) return;
        const listMangas = [
            { id: 31,  chapLu: 1100, chapTotal: 1110, status: 'en_cours', pct: 99,  color: 'green'  },
            { id: 48,  chapLu: 244,  chapTotal: 250,  status: 'en_cours', pct: 98,  color: 'green'  },
            { id: 29,  chapLu: 700,  chapTotal: 700,  status: 'termine',  pct: 100, color: 'green'  },
            { id: 47,  chapLu: 157,  chapTotal: 166,  status: 'en_cours', pct: 95,  color: 'green'  },
            { id: 35,  chapLu: 480,  chapTotal: 686,  status: 'pause',    pct: 70,  color: 'yellow' },
        ];
        el.innerHTML = listMangas.map(l => {
            const m = DB.getManga(l.id);
            if (!m) return '';
            const statusLabels = { en_cours: 'En cours', termine: 'Terminé', pause: 'Pause' };
            const statusColors = { en_cours: '#22c55e', termine: '#9ca3af', pause: '#f59e0b' };
            return `
            <div class="list-manga-item">
                <a href="serie.html?id=${m.id}">
                    <div class="list-manga-cover">
                        <img src="${m.coverFallback}" alt="${MH.esc(m.title)}"
                             onerror="this.parentElement.innerHTML='<div class=placeholder></div>'">
                    </div>
                    <div class="list-manga-name">${MH.esc(m.title)}</div>
                    <div class="list-manga-meta">Ch. ${l.chapLu}/${l.chapTotal}</div>
                    <div class="list-manga-progress">
                        <div class="list-manga-prog-bar">
                            <div class="list-manga-prog-fill ${l.color}" style="width:${l.pct}%"></div>
                        </div>
                        <span style="font-size:11px;color:${statusColors[l.status]}">${statusLabels[l.status]}</span>
                    </div>
                </a>
            </div>`;
        }).join('');
    }

    // ── Toggles ──────────────────────────────────────────────
    function initToggles() {
        document.querySelectorAll('.toggle').forEach(t => {
            t.addEventListener('click', () => {
                t.classList.toggle('on');
                MH.toast(t.classList.contains('on') ? 'Activé ✓' : 'Désactivé');
            });
        });
    }

    // ── Pref buttons ─────────────────────────────────────────
    function initPrefBtns() {
        document.querySelectorAll('.pref-options').forEach(group => {
            group.querySelectorAll('.pref-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    group.querySelectorAll('.pref-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    MH.toast(`Préférence : ${btn.textContent}`);
                });
            });
        });
    }

    // ── History filters ──────────────────────────────────────
    function initHistoryFilters() {
        document.querySelectorAll('.hqf-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.hqf-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });
    }

    // ── View toggles ─────────────────────────────────────────
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

    // ── List nav (onglets listes de lecture) ─────────────────
    function initListNav() {
        document.querySelectorAll('.list-nav-item[data-list]').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.list-nav-item').forEach(i => i.classList.remove('active'));
                item.classList.add('active');
            });
        });
    }

})();