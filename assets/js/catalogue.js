// catalogue.js — Recherche live + filtres via API (source-aware)
(function () {
    'use strict';

    const PER_PAGE = 24;
    let currentPage   = 1;
    let lastQuery     = '';
    let lastResults   = [];
    let lastTotal     = 0;
    let allTags       = [];
    let activeTags    = new Set();
    let activeStatus  = null;
    let activeDemo    = null;
    let activeSort    = 'popularity'; // popularity | latest | alpha | added | rating
    let viewMode      = 'grid';       // grid | list
    let inFlight      = 0;
    let sourceInfo    = null;         // { id, name, lang } de la source active

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('catalogue');
        readURLParams();
        renderQuickFilters();
        bindEvents();

        // Sections annexes : chargement non bloquant, en parallèle
        loadSourceInfo().then(renderChips).catch(() => {});
        loadTags().then(renderFilterSidebar).catch(() => {});
        renderTeamPicks();
        renderFocus();
        renderLatestMini();
        renderCollectionsMini();
        renderReviews();

        await runSearch();
    });

    function readURLParams() {
        const p = new URLSearchParams(location.search);
        if (p.get('q'))    lastQuery  = p.get('q');
        if (p.get('sort')) activeSort = p.get('sort');
        if (p.get('tag'))  activeTags.add(p.get('tag'));
    }

    // ── Source active (pour affichage honnête) ──
    async function loadSourceInfo() {
        const sources = await API.sources.list();
        const cur = API.sources.current;
        sourceInfo = (sources || []).find(s => s.id === cur) || null;
    }

    // ── Chips info ──
    function renderChips() {
        const el = document.getElementById('catalogueChips');
        if (!el) return;
        const name = sourceInfo?.name || 'source active';
        const lang = (sourceInfo?.lang || '').toUpperCase();
        el.innerHTML = [
            `Catalogue ${MH.esc(name)} en direct`,
            lang ? `Langue : ${MH.esc(lang)}` : 'Multi-langues',
            'Mises à jour temps réel',
            'Lecture intégrée',
        ].map(t => `<div class="catalogue-chip">${t}</div>`).join('');
    }

    // ── Quick filters ──
    function renderQuickFilters() {
        const el = document.getElementById('quickFilters');
        if (!el) return;
        const options = [
            { label: 'Tout',       val: null },
            { label: 'En cours',   val: 'ongoing',  type: 'status' },
            { label: 'Terminés',   val: 'completed', type: 'status' },
            { label: 'Pause',      val: 'hiatus',   type: 'status' },
            { label: 'Shōnen',     val: 'shounen',  type: 'demo'   },
            { label: 'Seinen',     val: 'seinen',   type: 'demo'   },
            { label: 'Shōjo',      val: 'shoujo',   type: 'demo'   },
            { label: 'Josei',      val: 'josei',    type: 'demo'   },
        ];
        el.innerHTML = options.map(o =>
            `<button class="quick-filter-btn ${!o.val && !activeStatus && !activeDemo ? 'active' : ''}"
                data-quick="${o.val || ''}" data-type="${o.type || ''}">${o.label}</button>`
        ).join('');
        el.addEventListener('click', async e => {
            const btn = e.target.closest('.quick-filter-btn');
            if (!btn) return;
            document.querySelectorAll('.quick-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            activeStatus = null; activeDemo = null;
            const v = btn.dataset.quick;
            const t = btn.dataset.type;
            if (t === 'status') activeStatus = v;
            if (t === 'demo')   activeDemo   = v;
            currentPage = 1;
            syncSidebarState();
            await runSearch();
        });
    }

    async function loadTags() {
        try { allTags = await API.mangas.tags() || []; }
        catch (e) { allTags = []; }
    }

    // ── Sidebar (rendu pur — les listeners sont délégués dans bindEvents) ──
    function renderFilterSidebar() {
        const genresEl = document.getElementById('filterGenres');
        if (genresEl) {
            const genres = allTags.filter(t => !t.group || t.group === 'genre').slice(0, 26);
            genresEl.innerHTML = genres.length
                ? genres.map(g =>
                    `<button class="filter-tag ${activeTags.has(g.id) ? 'active' : ''}" data-tag="${MH.esc(g.id)}">${MH.esc(g.name)}</button>`
                  ).join('')
                : '<div style="font-size:12px;color:var(--text3);padding:8px">Pas de filtres par genre pour cette source.</div>';
        }

        const statusEl = document.getElementById('filterStatus');
        if (statusEl) {
            statusEl.innerHTML = [
                { v: 'ongoing',   l: 'En cours'  },
                { v: 'completed', l: 'Terminé'   },
                { v: 'hiatus',    l: 'En pause'  },
                { v: 'cancelled', l: 'Annulé'    },
            ].map(s =>
                `<button class="filter-status-btn ${activeStatus === s.v ? 'active' : ''}" data-status="${s.v}">${s.l}</button>`
            ).join('');
        }

        const demoEl = document.getElementById('filterDemo');
        if (demoEl) {
            demoEl.innerHTML = ['shounen','seinen','shoujo','josei'].map(d =>
                `<label class="filter-checkbox">
                    <input type="checkbox" data-demo="${d}" ${activeDemo === d ? 'checked' : ''}> ${d.charAt(0).toUpperCase() + d.slice(1)}
                </label>`
            ).join('');
        }
        updateFiltersCount();
    }

    // Resynchronise l'état visuel de la sidebar (après quick filter / reset)
    function syncSidebarState() {
        document.querySelectorAll('#filterStatus [data-status]').forEach(b =>
            b.classList.toggle('active', b.dataset.status === activeStatus));
        document.querySelectorAll('#filterDemo [data-demo]').forEach(i =>
            { i.checked = i.dataset.demo === activeDemo; });
        document.querySelectorAll('#filterGenres [data-tag]').forEach(b =>
            b.classList.toggle('active', activeTags.has(b.dataset.tag)));
        updateFiltersCount();
    }

    function updateFiltersCount() {
        const el = document.getElementById('activeFiltersCount');
        if (!el) return;
        const n = activeTags.size + (activeStatus ? 1 : 0) + (activeDemo ? 1 : 0);
        el.textContent = n ? `${n} filtre(s) actif(s)` : '';
    }

    // ── Recherche ──
    async function runSearch() {
        const grid = document.getElementById('resultsGrid');
        if (!grid) return;
        const count = document.getElementById('resultsCount');

        inFlight++;
        const myReq = inFlight;
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text3)">
            <div class="spinner-inline"></div>
            <div style="margin-top:8px;font-size:12.5px">Recherche…</div>
        </div>`;

        try {
            const params = {
                limit: PER_PAGE,
                offset: (currentPage - 1) * PER_PAGE,
                sort: activeSort,
            };
            if (lastQuery)       params.q           = lastQuery;
            if (activeStatus)    params.status      = activeStatus;
            if (activeDemo)      params.demographic = activeDemo;
            if (activeTags.size) params.includedTags = [...activeTags];

            const data = await API.mangas.search(params);
            if (myReq !== inFlight) return; // requête plus récente en cours
            lastResults = data.results || [];
            lastTotal   = data.total || 0;

            if (count) count.innerHTML = `Affichage de <strong>${lastResults.length}</strong> sur <strong>${MH.fmt ? MH.fmt(lastTotal) : lastTotal}</strong> séries`;

            if (!lastResults.length) {
                grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text2)">Aucune série correspondante. Modifiez les filtres.</div>';
            } else {
                grid.innerHTML = lastResults.map(m => mangaCardHTML(m)).join('');
                MH.markFavorites(grid);
            }
            renderPagination();
        } catch(err) {
            if (myReq !== inFlight) return;
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#ef4444">Erreur : ${MH.esc(err.message)}</div>`;
        }
    }

    function mangaCardHTML(m) {
        return `
        <a href="serie.html?id=${encodeURIComponent(m.id)}" class="manga-card" data-manga-id="${m.id}">
            <div class="manga-card-cover">
                <img src="${m.cover || ''}" alt="${MH.esc(m.title)}" loading="lazy" decoding="async"
                     onerror="this.src='${MH.placeholderCover(m.id)}'">
                <div class="manga-card-badges">
                    ${m.status === 'completed' ? '<span class="badge badge-termine">TERMINÉ</span>' : ''}
                    ${m.status === 'hiatus' ? '<span class="badge badge-pause">PAUSE</span>' : ''}
                </div>
                <button class="card-fav-btn" data-fav="${m.id}" title="Ajouter aux favoris">${MH.heartIcon(false)}</button>
                <div class="manga-card-overlay">
                    <div class="btn-read-overlay">Lire</div>
                </div>
            </div>
            <div class="manga-card-info">
                <div class="manga-card-title">${MH.esc(m.title)}</div>
                <div class="manga-card-author">${MH.esc(m.author || '—')}</div>
                <div class="manga-card-tags">
                    ${(m.tags || []).slice(0, 2).map(t => `<span class="manga-card-tag">${MH.esc(t)}</span>`).join('')}
                </div>
                <div class="manga-card-meta" style="margin-top:6px">
                    <span class="manga-card-rating">${m.year || '—'}</span>
                    ${m.demographic ? `<span>${m.demographic}</span>` : ''}
                </div>
            </div>
        </a>`;
    }

    function renderPagination() {
        const el = document.getElementById('pagination');
        if (!el) return;
        const pages = Math.ceil(lastTotal / PER_PAGE);
        if (pages <= 1) { el.innerHTML = ''; return; }
        let html = `<button class="page-btn" data-page="${currentPage - 1}" ${currentPage === 1 ? 'disabled' : ''}>‹</button>`;
        const visible = [];
        for (let i = Math.max(1, currentPage - 2); i <= Math.min(pages, currentPage + 2); i++) visible.push(i);
        if (visible[0] > 1) { html += `<button class="page-btn" data-page="1">1</button>`; if (visible[0] > 2) html += `<span class="page-sep">…</span>`; }
        visible.forEach(i => { html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" data-page="${i}">${i}</button>`; });
        if (visible[visible.length-1] < pages) { if (visible[visible.length-1] < pages - 1) html += `<span class="page-sep">…</span>`; html += `<button class="page-btn" data-page="${pages}">${pages}</button>`; }
        html += `<button class="page-btn" data-page="${currentPage + 1}" ${currentPage === pages ? 'disabled' : ''}>›</button>`;
        el.innerHTML = html;
    }

    // ══ Sections annexes ══════════════════════════════════════

    // Les incontournables (top populaires du moment)
    async function renderTeamPicks() {
        const el = document.getElementById('teamPicksGrid');
        if (!el) return;
        try {
            const data = await API.mangas.popular({ limit: 3 });
            const picks = (data.results || []).slice(0, 3);
            if (!picks.length) { el.closest('.team-picks-section')?.remove(); return; }
            el.innerHTML = picks.map((m, i) => `
                <div class="team-pick-card" onclick="location.href='serie.html?id=${encodeURIComponent(m.id)}'">
                    <div class="team-pick-bg" style="background-image:url('${m.cover || ''}')"></div>
                    <div class="team-pick-content">
                        <span class="badge badge-orange team-pick-badge">#${i + 1} POPULAIRE</span>
                        <div class="team-pick-title">${MH.esc(m.title)}</div>
                        <div class="team-pick-subtitle">${MH.esc((m.tags || []).slice(0, 3).join(' · ') || m.author || '')}</div>
                    </div>
                </div>`).join('');
        } catch (e) { el.closest('.team-picks-section')?.remove(); }
    }

    // Focus du moment (une série mise en avant)
    async function renderFocus() {
        const el = document.getElementById('catalogueFocus');
        if (!el) return;
        try {
            const data = await API.mangas.popular({ limit: 10 });
            const list = data.results || [];
            if (!list.length) { el.remove(); return; }
            const m = list[Math.floor(Math.random() * list.length)];
            el.innerHTML = `
                <div class="focus-label">Focus du moment</div>
                <div class="focus-cover"><img src="${m.cover || ''}" alt="${MH.esc(m.title)}" loading="lazy" decoding="async"></div>
                <div class="focus-title">${MH.esc(m.title)}</div>
                <div class="focus-stats">
                    <div class="focus-stat"><div class="focus-stat-label">Statut</div><div class="focus-stat-value">${m.status === 'completed' ? 'Terminé' : m.status === 'hiatus' ? 'En pause' : 'En cours'}</div></div>
                    <div class="focus-stat"><div class="focus-stat-label">Année</div><div class="focus-stat-value">${m.year || '—'}</div></div>
                </div>
                <a class="btn btn-primary btn-sm" style="width:100%;margin-top:10px;justify-content:center" href="serie.html?id=${encodeURIComponent(m.id)}">Voir la fiche</a>`;
        } catch (e) { el.remove(); }
    }

    // Dernières sorties (sidebar)
    async function renderLatestMini() {
        const el = document.getElementById('weekCalendar');
        if (!el) return;
        try {
            const data = await API.mangas.latest({ limit: 5 });
            const list = (data.results || []).slice(0, 5);
            if (!list.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:4px 0">Rien pour l\'instant.</div>'; return; }
            el.innerHTML = list.map(m => `
                <a href="serie.html?id=${encodeURIComponent(m.id)}" style="display:flex;align-items:center;gap:8px;padding:5px 0;text-decoration:none">
                    <img src="${m.coverThumb || m.cover || ''}" alt="" loading="lazy" decoding="async"
                         style="width:30px;height:42px;object-fit:cover;border-radius:4px;background:var(--bg4)"
                         onerror="this.style.visibility='hidden'">
                    <div style="min-width:0">
                        <div style="font-size:12px;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${MH.esc(m.title)}</div>
                        <div style="font-size:10.5px;color:var(--text3)">Mis à jour récemment</div>
                    </div>
                </a>`).join('');
        } catch (e) { el.innerHTML = ''; }
    }

    // Mes collections (mini)
    async function renderCollectionsMini() {
        const el = document.getElementById('collectionsMiniGrid');
        const section = el?.closest('.catalogue-collections');
        if (!el) return;
        if (!API.isLoggedIn()) { if (section) section.style.display = 'none'; return; }
        try {
            const lists = await API.me.lists();
            if (!lists || !lists.length) { if (section) section.style.display = 'none'; return; }
            el.innerHTML = lists.slice(0, 3).map(l => `
                <div class="collection-mini-card" onclick="location.href='collection-detail.html?id=${l.id}'">
                    <div class="collection-mini-cover">
                        ${(l.covers || []).slice(0, 4).map(c => `<img src="${c}" alt="" loading="lazy">`).join('') || ''}
                    </div>
                    <div class="collection-mini-info">
                        <div class="collection-mini-title">${MH.esc(l.name)}</div>
                        <div class="collection-mini-meta">${l.count || 0} série(s)</div>
                    </div>
                </div>`).join('');
        } catch (e) { if (section) section.style.display = 'none'; }
    }

    // Derniers avis de la communauté
    async function renderReviews() {
        const el = document.getElementById('reviewsGrid');
        const section = el?.closest('.catalogue-reviews');
        if (!el) return;
        try {
            const comments = await API.comments.recent(6);
            if (!comments || !comments.length) { if (section) section.style.display = 'none'; return; }
            el.innerHTML = comments.slice(0, 6).map(c => {
                const stars = c.rating ? '★'.repeat(Math.round(c.rating)) + '☆'.repeat(5 - Math.round(c.rating)) : '';
                const serieLink = `serie.html?id=${encodeURIComponent(c.mangaId)}${c.mangaSource ? '&source=' + encodeURIComponent(c.mangaSource) : ''}`;
                return `
                <div class="review-card">
                    <a class="review-card-manga" href="${serieLink}" style="text-decoration:none;display:block">${MH.esc(c.mangaTitle || 'Voir la série →')}</a>
                    ${stars ? `<div class="review-card-stars" style="color:#f59e0b;font-size:12px">${stars}</div>` : ''}
                    <div class="review-card-text">« ${MH.esc(c.text.length > 140 ? c.text.slice(0, 140) + '…' : c.text)} »</div>
                    <div class="review-card-user"><span class="review-avatar">${MH.esc((c.avatar || '?').slice(0, 2))}</span> ${MH.esc(c.user)}</div>
                </div>`;
            }).join('');
        } catch (e) { if (section) section.style.display = 'none'; }
    }

    // ══ Événements (tous bindés UNE fois) ═════════════════════
    function bindEvents() {
        // Genres (délégation : le contenu est re-rendu, le listener reste)
        document.getElementById('filterGenres')?.addEventListener('click', async e => {
            const btn = e.target.closest('[data-tag]');
            if (!btn) return;
            const id = btn.dataset.tag;
            if (activeTags.has(id)) activeTags.delete(id);
            else activeTags.add(id);
            btn.classList.toggle('active');
            currentPage = 1;
            updateFiltersCount();
            await runSearch();
        });

        // Statut
        document.getElementById('filterStatus')?.addEventListener('click', async e => {
            const btn = e.target.closest('[data-status]');
            if (!btn) return;
            activeStatus = activeStatus === btn.dataset.status ? null : btn.dataset.status;
            syncSidebarState();
            currentPage = 1;
            await runSearch();
        });

        // Démographie
        document.getElementById('filterDemo')?.addEventListener('change', async e => {
            const inp = e.target.closest('[data-demo]');
            if (!inp) return;
            activeDemo = inp.checked ? inp.dataset.demo : null;
            syncSidebarState();
            currentPage = 1;
            await runSearch();
        });

        // Reset
        document.getElementById('filtersReset')?.addEventListener('click', async () => {
            activeTags.clear(); activeStatus = null; activeDemo = null;
            lastQuery = ''; currentPage = 1;
            renderFilterSidebar();
            document.querySelectorAll('.quick-filter-btn').forEach((b, i) => b.classList.toggle('active', i === 0));
            await runSearch();
        });

        // Pagination (délégation — bindé une seule fois)
        document.getElementById('pagination')?.addEventListener('click', async e => {
            const b = e.target.closest('[data-page]');
            if (!b || b.disabled) return;
            const p = +b.dataset.page;
            const pages = Math.ceil(lastTotal / PER_PAGE);
            if (p < 1 || p > pages || p === currentPage) return;
            currentPage = p;
            window.scrollTo({ top: 0, behavior: 'smooth' });
            await runSearch();
        });

        // Tri
        const sortSel = document.getElementById('sortSelect');
        if (sortSel) {
            sortSel.value = activeSort;
            if (sortSel.value !== activeSort) sortSel.value = 'popularity'; // valeur inconnue
            sortSel.addEventListener('change', async () => {
                activeSort = sortSel.value;
                currentPage = 1;
                await runSearch();
            });
        }

        // Vue grille / liste
        document.querySelectorAll('.view-btn').forEach(b => b.addEventListener('click', () => {
            viewMode = b.dataset.view;
            document.querySelectorAll('.view-btn').forEach(x => x.classList.toggle('active', x === b));
            document.getElementById('resultsGrid')?.classList.toggle('list-view', viewMode === 'list');
        }));

        // Lecture aléatoire
        document.getElementById('btnRandom')?.addEventListener('click', async () => {
            const data = await API.mangas.popular({ limit: 100 });
            const list = data.results || [];
            if (!list.length) return;
            const m = list[Math.floor(Math.random() * list.length)];
            window.location.href = `serie.html?id=${encodeURIComponent(m.id)}`;
        });

        // Le toggle des favoris (cœurs de cartes) est géré globalement dans global.js.

        // URL query (entrée via header search)
        if (lastQuery) {
            const input = document.getElementById('headerSearch');
            if (input) input.value = lastQuery;
        }
    }
})();
