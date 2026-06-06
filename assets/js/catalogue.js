// catalogue.js — Recherche live + filtres via API
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
    let activeSort    = 'popularity'; // popularity | latest | year
    let inFlight      = 0;

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('catalogue');
        readURLParams();
        renderChips();
        renderQuickFilters();
        await loadTags();
        renderFilterSidebar();
        bindEvents();
        await runSearch();
    });

    function readURLParams() {
        const p = new URLSearchParams(location.search);
        if (p.get('q')) {
            lastQuery = p.get('q');
            const input = document.querySelector('input[type="text"]') || document.getElementById('headerSearch');
        }
        if (p.get('sort')) activeSort = p.get('sort');
    }

    // ── Chips info ──
    function renderChips() {
        const el = document.getElementById('catalogueChips');
        if (!el) return;
        el.innerHTML = [
            ['', 'Catalogue MangaDex en direct'],
            ['', 'FR · EN · JP'],
            ['', 'Mises à jour temps réel'],
            ['', 'Lecture intégrée'],
        ].map(([i, t]) =>
            `<div class="catalogue-chip"><span class="catalogue-chip-icon">${i}</span> ${t}</div>`
        ).join('');
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
            await runSearch();
        });
    }

    async function loadTags() {
        try {
            const tags = await API.mangas.tags();
            allTags = tags;
        } catch(e) { allTags = []; }
    }

    function renderFilterSidebar() {
        const genresEl = document.getElementById('filterGenres');
        if (genresEl) {
            const genres = allTags.filter(t => t.group === 'genre').slice(0, 24);
            genresEl.innerHTML = genres.map(g =>
                `<button class="filter-tag ${activeTags.has(g.id) ? 'active' : ''}" data-tag="${g.id}">${MH.esc(g.name)}</button>`
            ).join('') || '<div style="font-size:12px;color:var(--text3);padding:8px">Chargement…</div>';
            genresEl.addEventListener('click', async e => {
                const btn = e.target.closest('[data-tag]');
                if (!btn) return;
                const id = btn.dataset.tag;
                if (activeTags.has(id)) activeTags.delete(id);
                else activeTags.add(id);
                btn.classList.toggle('active');
                currentPage = 1;
                await runSearch();
            });
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
            statusEl.addEventListener('click', async e => {
                const btn = e.target.closest('[data-status]');
                if (!btn) return;
                const v = btn.dataset.status;
                activeStatus = activeStatus === v ? null : v;
                statusEl.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.status === activeStatus));
                currentPage = 1;
                await runSearch();
            });
        }

        const demoEl = document.getElementById('filterDemo');
        if (demoEl) {
            demoEl.innerHTML = ['shounen','seinen','shoujo','josei'].map(d =>
                `<label class="filter-checkbox">
                    <input type="checkbox" data-demo="${d}" ${activeDemo === d ? 'checked' : ''}> ${d.charAt(0).toUpperCase() + d.slice(1)}
                </label>`
            ).join('');
            demoEl.addEventListener('change', async e => {
                const inp = e.target.closest('[data-demo]');
                if (!inp) return;
                activeDemo = inp.checked ? inp.dataset.demo : null;
                currentPage = 1;
                await runSearch();
            });
        }

        document.getElementById('filtersReset')?.addEventListener('click', async () => {
            activeTags.clear(); activeStatus = null; activeDemo = null;
            lastQuery = ''; currentPage = 1;
            renderFilterSidebar();
            await runSearch();
        });
    }

    // ── Search ──
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
            };
            if (lastQuery) params.q = lastQuery;
            if (activeStatus) params.status = activeStatus;
            if (activeDemo)   params.demographic = activeDemo;
            if (activeTags.size) params.includedTags = [...activeTags];

            const data = await API.mangas.search(params);
            if (myReq !== inFlight) return; // requête plus récente en cours
            lastResults = data.results || [];
            lastTotal   = data.total || 0;

            if (count) count.innerHTML = `Affichage de <strong>${lastResults.length}</strong> sur <strong>${lastTotal}</strong> séries`;

            if (!lastResults.length) {
                grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text2)">Aucune série correspondante. Modifiez les filtres.</div>';
            } else {
                grid.innerHTML = lastResults.map(m => mangaCardHTML(m)).join('');
                MH.markFavorites(grid);
            }
            renderPagination();
        } catch(err) {
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#ef4444">Erreur : ${MH.esc(err.message)}</div>`;
        }
    }

    function mangaCardHTML(m) {
        return `
        <a href="serie.html?id=${encodeURIComponent(m.id)}" class="manga-card" data-manga-id="${m.id}">
            <div class="manga-card-cover">
                <img src="${m.cover || ''}" alt="${MH.esc(m.title)}" loading="lazy"
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
        el.addEventListener('click', async e => {
            const b = e.target.closest('[data-page]');
            if (!b) return;
            const p = +b.dataset.page;
            if (p < 1 || p > pages) return;
            currentPage = p;
            window.scrollTo({ top: 0, behavior: 'smooth' });
            await runSearch();
        });
    }

    function bindEvents() {
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
