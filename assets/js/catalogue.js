// catalogue.js — Recherche live + filtres via API (source-aware)
(function () {
    'use strict';

    const PER_PAGE = 24;
    let currentPage   = 1;
    let lastQuery     = '';
    let lastResults   = [];
    let lastTotal     = 0;
    let allTags       = [];
    let activeTags    = new Set();   // genres (multi)
    let activeStatus  = new Set();   // statuts (multi)
    let activeDemo    = new Set();   // démographies (multi)
    let activeSort    = 'popularity'; // popularity | latest | alpha | added | rating
    let viewMode      = 'grid';       // grid | list
    let inFlight      = 0;
    let sourceInfo    = null;         // { id, name, lang } de la source active
    let allSources    = false;        // mode « Toutes les sources » (agrégé)
    let sourcesList   = [];           // manifest des sources installées

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('catalogue');
        restoreCtx();        // restaure le dernier contexte (filtres/tri/vue)
        readURLParams();     // l'URL (?q=, ?tag=, ?sort=) reste prioritaire
        try { allSources = localStorage.getItem('inko_cat_allsrc') === '1'; } catch (e) {}
        renderQuickFilters();
        bindEvents();
        renderSourceBar();   // bascule source unique / toutes les sources

        // Sections annexes : chargement non bloquant, en parallèle
        loadSourceInfo().then(renderChips).catch(() => {});
        loadTags().then(renderFilterSidebar).catch(() => {});
        renderTeamPicks();
        renderFocus();
        renderLatestMini();
        renderCollectionsMini();

        await runSearch();
    });

    function readURLParams() {
        const p = new URLSearchParams(location.search);
        if (p.get('q'))    lastQuery  = p.get('q');
        if (p.get('sort')) activeSort = p.get('sort');
        if (p.get('tag'))  activeTags.add(p.get('tag'));
    }

    // ── Mémorisation du contexte (filtres / tri / vue) ──
    const CTX_KEY = 'inko_catalogue_ctx';
    function saveCtx() {
        try {
            localStorage.setItem(CTX_KEY, JSON.stringify({
                tags: [...activeTags], status: [...activeStatus], demo: [...activeDemo],
                sort: activeSort, view: viewMode, source: API.sources.current,
            }));
        } catch (e) {}
    }
    function restoreCtx() {
        let c; try { c = JSON.parse(localStorage.getItem(CTX_KEY)); } catch (e) {}
        if (!c) return;
        // Ne restaure les filtres que si on revient sur la même source
        if (c.source && c.source === API.sources.current) {
            (c.tags   || []).forEach(t => activeTags.add(t));
            (c.status || []).forEach(s => activeStatus.add(s));
            (c.demo   || []).forEach(d => activeDemo.add(d));
        }
        if (c.sort) activeSort = c.sort;
        if (c.view) viewMode = c.view;
    }

    // ── Source active (pour affichage honnête) ──
    async function loadSourceInfo() {
        const sources = await API.sources.list();
        sourcesList = sources || [];
        const cur = API.sources.current;
        sourceInfo = sourcesList.find(s => s.id === cur) || null;
        renderSourceBar();   // re-rend maintenant que la liste est connue
    }

    // ── Bascule « Toutes les sources » / source par source ──────────────
    // Permet d'utiliser plusieurs extensions EN MÊME TEMPS depuis le catalogue :
    // en mode agrégé, populaires/recherche interrogent toutes les sources actives
    // en parallèle et fusionnent les résultats (dédup par titre).
    function enabledSources() {
        return sourcesList.filter(s => window.MH?.isSourceEnabled ? MH.isSourceEnabled(s.id) : true);
    }
    function renderSourceBar() {
        let bar = document.getElementById('sourceBar');
        if (!bar) {
            const anchor = document.getElementById('quickFilters');
            if (!anchor) return;
            bar = document.createElement('div');
            bar.id = 'sourceBar';
            bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin:0 0 12px';
            anchor.parentNode.insertBefore(bar, anchor);
        }
        const chip = (label, on, data) =>
            `<button class="quick-filter-btn ${on ? 'active' : ''}" ${data}>${MH.esc(label)}</button>`;
        bar.innerHTML =
            chip('Toutes les sources', allSources, 'data-allsrc="1"') +
            enabledSources().map(s => chip(s.name, !allSources && s.id === API.sources.current, `data-src="${MH.esc(s.id)}"`)).join('');
        bar.querySelectorAll('[data-allsrc]').forEach(b => b.addEventListener('click', async () => {
            allSources = true;
            try { localStorage.setItem('inko_cat_allsrc', '1'); } catch (e) {}
            currentPage = 1; renderSourceBar();
            await runSearch();
        }));
        bar.querySelectorAll('[data-src]').forEach(b => b.addEventListener('click', async () => {
            allSources = false;
            try { localStorage.setItem('inko_cat_allsrc', '0'); } catch (e) {}
            API.sources.current = b.dataset.src;
            currentPage = 1;
            sourceInfo = sourcesList.find(s => s.id === b.dataset.src) || null;
            renderSourceBar(); renderChips();
            loadTags().then(renderFilterSidebar).catch(() => {});
            await runSearch();
        }));
    }

    // Recherche agrégée : interroge chaque source active en parallèle et fusionne.
    function aggNormTitle(t) {
        return (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
    }
    async function runSearchAggregate(myReq) {
        const grid = document.getElementById('resultsGrid');
        const count = document.getElementById('resultsCount');
        const srcs = enabledSources();
        const per = Math.max(8, Math.ceil(PER_PAGE / Math.max(1, srcs.length)) * 2);
        const settled = await Promise.allSettled(srcs.map(s => {
            const params = { limit: per };
            if (lastQuery) { params.q = lastQuery; return API.mangas.searchFor(s.id, params); }
            return API.mangas.popularFor(s.id, params);
        }));
        if (myReq !== inFlight) return;
        // Fusion + dédup par titre (la même œuvre sur 2 sources = 1 carte, 1re source gagne)
        const seen = new Map();
        settled.forEach((r, i) => {
            if (r.status !== 'fulfilled') return;
            (r.value.results || []).forEach(m => {
                const key = aggNormTitle(m.title);
                if (!key || seen.has(key)) return;
                m._source = srcs[i].id; m._sourceName = srcs[i].name;
                seen.set(key, m);
            });
        });
        lastResults = [...seen.values()];
        lastTotal = lastResults.length;
        const okCount = settled.filter(r => r.status === 'fulfilled').length;
        if (count) count.innerHTML = `<strong>${lastResults.length}</strong> séries · ${okCount}/${srcs.length} sources`;
        if (!lastResults.length) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text2)">Aucun résultat sur tes sources actives.</div>';
        } else {
            grid.innerHTML = lastResults.map(m => mangaCardHTML(m)).join('');
            MH.markFavorites(grid);
        }
        const pag = document.getElementById('pagination');
        if (pag) pag.innerHTML = '';   // pas de pagination croisée en mode agrégé
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
            `<button class="quick-filter-btn" data-quick="${o.val || ''}" data-type="${o.type || ''}">${o.label}</button>`
        ).join('');
        syncQuickFilters();
        el.addEventListener('click', async e => {
            const btn = e.target.closest('.quick-filter-btn');
            if (!btn) return;
            const v = btn.dataset.quick;
            const t = btn.dataset.type;
            if (!v) { activeStatus.clear(); activeDemo.clear(); }   // « Tout »
            else if (t === 'status') { activeStatus.has(v) ? activeStatus.delete(v) : activeStatus.add(v); }
            else if (t === 'demo')   { activeDemo.has(v)   ? activeDemo.delete(v)   : activeDemo.add(v); }
            currentPage = 1;
            syncQuickFilters();
            syncSidebarState();
            await runSearch();
        });
    }

    // Reflète l'état des sets sur les boutons rapides (plusieurs actifs possibles)
    function syncQuickFilters() {
        const none = !activeStatus.size && !activeDemo.size;
        document.querySelectorAll('.quick-filter-btn').forEach(b => {
            const v = b.dataset.quick, t = b.dataset.type;
            const on = !v ? none : (t === 'status' ? activeStatus.has(v) : activeDemo.has(v));
            b.classList.toggle('active', on);
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
                `<button class="filter-status-btn ${activeStatus.has(s.v) ? 'active' : ''}" data-status="${s.v}">${s.l}</button>`
            ).join('');
        }

        const demoEl = document.getElementById('filterDemo');
        if (demoEl) {
            demoEl.innerHTML = ['shounen','seinen','shoujo','josei'].map(d =>
                `<label class="filter-checkbox">
                    <input type="checkbox" data-demo="${d}" ${activeDemo.has(d) ? 'checked' : ''}> ${d.charAt(0).toUpperCase() + d.slice(1)}
                </label>`
            ).join('');
        }
        updateFiltersCount();
    }

    // Resynchronise l'état visuel de la sidebar (plusieurs filtres actifs possibles)
    function syncSidebarState() {
        document.querySelectorAll('#filterStatus [data-status]').forEach(b =>
            b.classList.toggle('active', activeStatus.has(b.dataset.status)));
        document.querySelectorAll('#filterDemo [data-demo]').forEach(i =>
            { i.checked = activeDemo.has(i.dataset.demo); });
        document.querySelectorAll('#filterGenres [data-tag]').forEach(b =>
            b.classList.toggle('active', activeTags.has(b.dataset.tag)));
        updateFiltersCount();
    }

    function updateFiltersCount() {
        const el = document.getElementById('activeFiltersCount');
        if (!el) return;
        const n = activeTags.size + activeStatus.size + activeDemo.size;
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

        // Mode agrégé « Toutes les sources » : chemin dédié
        if (allSources) {
            try { await runSearchAggregate(myReq); }
            catch (err) {
                if (myReq !== inFlight) return;
                grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#ef4444">Erreur : ${MH.esc(err.message)}</div>`;
            }
            return;
        }

        try {
            const params = {
                limit: PER_PAGE,
                offset: (currentPage - 1) * PER_PAGE,
                sort: activeSort,
            };
            if (lastQuery)        params.q            = lastQuery;
            if (activeStatus.size) params.status      = [...activeStatus];
            if (activeDemo.size)   params.demographic = [...activeDemo];
            if (activeTags.size)   params.includedTags = [...activeTags];

            const data = await API.mangas.search(params);
            if (myReq !== inFlight) return; // requête plus récente en cours
            lastResults = data.results || [];
            lastTotal   = data.total || 0;
            saveCtx();   // mémorise le contexte courant pour la prochaine visite

            if (count) count.innerHTML = `Affichage de <strong>${lastResults.length}</strong> sur <strong>${MH.fmt ? MH.fmt(lastTotal) : lastTotal}</strong> séries`;

            if (!lastResults.length) {
                grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text2)">Aucune série correspondante. Modifiez les filtres.</div>';
            } else {
                grid.innerHTML = lastResults.map(m => mangaCardHTML(m)).join('');
                MH.markFavorites(grid);
                enrichSparseCards(lastResults, myReq);   // complète auteur/statut si la liste est pauvre
            }
            renderPagination();
        } catch(err) {
            if (myReq !== inFlight) return;
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:40px;color:#ef4444">Erreur : ${MH.esc(err.message)}</div>`;
        }
    }

    const STATUS_LABELS = { ongoing: 'En cours', completed: 'Terminé', hiatus: 'En pause', cancelled: 'Annulé' };
    const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

    // Bloc info (titre + sous-titre + méta) — réutilisé par le rendu et l'enrichissement
    function cardInfoHTML(m) {
        const src = m._source || API.sources.current;
        const isNovel = MH.isNovelSource(src);
        const tags = (m.tags || []).filter(Boolean).slice(0, 3);
        const statusLabel = STATUS_LABELS[m.status] || '';
        const sub = m.author || (tags.length ? tags.join(' · ') : (isNovel ? 'Roman' : ''));
        const metaBits = [];
        if (m.year) metaBits.push(`<span class="mc-year">${m.year}</span>`);
        if (m.demographic) metaBits.push(`<span class="mc-demo">${MH.esc(cap(m.demographic))}</span>`);
        if (statusLabel) metaBits.push(`<span class="mc-status mc-${m.status}">${statusLabel}</span>`);
        if (m._sourceName && allSources) metaBits.push(`<span class="mc-demo">${MH.esc(m._sourceName)}</span>`);
        return `<div class="manga-card-title">${MH.esc(m.title)}</div>
                ${sub ? `<div class="manga-card-author">${MH.esc(sub)}</div>` : ''}
                ${metaBits.length ? `<div class="manga-card-meta">${metaBits.join('')}</div>` : ''}`;
    }

    // Une œuvre est "pauvre" si sa liste ne fournit ni auteur, ni statut, ni genres
    function isSparse(m) { return !m.author && !m.status && !(m.tags || []).length; }

    function mangaCardHTML(m) {
        const src = m._source || API.sources.current;
        const isNovel = MH.isNovelSource(src);
        return `
        <a href="serie.html?id=${encodeURIComponent(m.id)}&source=${encodeURIComponent(src)}" class="manga-card" data-manga-id="${MH.esc(m.id)}">
            <div class="manga-card-cover">
                <img src="${m.cover || ''}" alt="${MH.esc(m.title)}" loading="lazy" decoding="async"
                     onerror="this.src='${MH.placeholderCover(m.id)}'">
                <div class="manga-card-badges">
                    ${isNovel ? '<span class="badge" style="background:var(--ai);color:#fff">ROMAN</span>' : ''}
                    ${m.status === 'completed' ? '<span class="badge badge-termine">TERMINÉ</span>' : ''}
                    ${m.status === 'hiatus' ? '<span class="badge badge-pause">PAUSE</span>' : ''}
                </div>
                <button class="card-fav-btn" data-fav="${m.id}" title="Ajouter aux favoris">${MH.heartIcon(false)}</button>
                <div class="manga-card-overlay">
                    <div class="btn-read-overlay">Lire</div>
                </div>
            </div>
            <div class="manga-card-info">${cardInfoHTML(m)}</div>
        </a>`;
    }

    // Enrichit en arrière-plan les cartes "pauvres" via getManga (sources dont la
    // liste n'expose pas l'auteur/statut, ex. SushiScan, Chireads). Throttlé + caché serveur.
    async function enrichSparseCards(list, reqId) {
        const src = API.sources.current;
        const need = list.filter(isSparse);
        if (!need.length) return;
        let i = 0;
        const worker = async () => {
            while (i < need.length) {
                if (reqId !== inFlight) return;          // une recherche plus récente a pris le relais
                const m = need[i++];
                try {
                    const full = await API.mangas.getFrom(src, m.id);
                    if (reqId !== inFlight || !full || isSparse(full)) continue;
                    const card = [...document.querySelectorAll('#resultsGrid .manga-card')]
                        .find(c => c.dataset.mangaId === String(m.id));
                    const info = card?.querySelector('.manga-card-info');
                    if (info) info.innerHTML = cardInfoHTML(full);
                } catch (e) {}
            }
        };
        await Promise.all([worker(), worker(), worker()]);   // 3 requêtes en parallèle max
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
        el.innerHTML = '<div class="latest-mini-loading"><span class="spinner-inline" style="width:12px;height:12px;border-width:1px"></span></div>';
        try {
            const data = await API.mangas.latest({ limit: 6 });
            const list = (data.results || []).slice(0, 6);
            const src = API.sources.current;
            if (!list.length) { el.innerHTML = '<div class="latest-mini-empty">Rien pour l\'instant.</div>'; return; }
            el.innerHTML = `<div class="latest-mini">` + list.map((m, i) => `
                <a class="latest-mini-row" href="serie.html?id=${encodeURIComponent(m.id)}&source=${encodeURIComponent(src)}" title="${MH.esc(m.title)}">
                    <span class="latest-mini-rank">${i + 1}</span>
                    <span class="latest-mini-cover">
                        <img src="${m.coverThumb || m.cover || ''}" alt="" loading="lazy" decoding="async" onerror="this.closest('.latest-mini-cover').classList.add('noimg')">
                    </span>
                    <span class="latest-mini-info">
                        <span class="latest-mini-title">${MH.esc(m.title)}</span>
                        <span class="latest-mini-sub">${m.lastChapter ? 'Ch. ' + m.lastChapter : (m.status === 'completed' ? 'Terminé' : 'Mis à jour')}</span>
                    </span>
                </a>`).join('') + `</div>`;
        } catch (e) { el.innerHTML = '<div class="latest-mini-empty">Indisponible.</div>'; }
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

        // Statut (multi : on ajoute/retire du set)
        document.getElementById('filterStatus')?.addEventListener('click', async e => {
            const btn = e.target.closest('[data-status]');
            if (!btn) return;
            const v = btn.dataset.status;
            activeStatus.has(v) ? activeStatus.delete(v) : activeStatus.add(v);
            syncSidebarState();
            syncQuickFilters();
            currentPage = 1;
            await runSearch();
        });

        // Démographie (multi)
        document.getElementById('filterDemo')?.addEventListener('change', async e => {
            const inp = e.target.closest('[data-demo]');
            if (!inp) return;
            inp.checked ? activeDemo.add(inp.dataset.demo) : activeDemo.delete(inp.dataset.demo);
            syncSidebarState();
            syncQuickFilters();
            currentPage = 1;
            await runSearch();
        });

        // Reset
        document.getElementById('filtersReset')?.addEventListener('click', async () => {
            activeTags.clear(); activeStatus.clear(); activeDemo.clear();
            lastQuery = ''; currentPage = 1; activeSort = 'popularity';
            const sortSel = document.getElementById('sortSelect'); if (sortSel) sortSel.value = 'popularity';
            renderFilterSidebar();
            syncQuickFilters();
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
            saveCtx();
        }));
        // Applique la vue restauree au chargement
        document.querySelectorAll('.view-btn').forEach(x => x.classList.toggle('active', x.dataset.view === viewMode));
        document.getElementById('resultsGrid')?.classList.toggle('list-view', viewMode === 'list');

        // Lecture aléatoire
        document.getElementById('btnRandom')?.addEventListener('click', async () => {
            const btn = document.getElementById('btnRandom');
            if (btn) { btn.disabled = true; btn.dataset.label = btn.textContent; btn.textContent = 'Tirage…'; }
            try {
                const data = await API.mangas.popular({ limit: 100 });
                const list = data.results || [];
                if (!list.length) { MH.toast?.('Aucun manga à tirer'); return; }
                const m = list[Math.floor(Math.random() * list.length)];
                window.location.href = `serie.html?id=${encodeURIComponent(m.id)}&source=${encodeURIComponent(API.sources.current || '')}`;
            } catch (e) {
                MH.toast?.('Erreur : ' + e.message);
            } finally {
                if (btn) { btn.disabled = false; if (btn.dataset.label) btn.textContent = btn.dataset.label; }
            }
        });

        // Le toggle des favoris (cœurs de cartes) est géré globalement dans global.js.

        // URL query (entrée via header search)
        if (lastQuery) {
            const input = document.getElementById('headerSearch');
            if (input) input.value = lastQuery;
        }
    }
})();
