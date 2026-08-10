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
    // Audit AMEL-05 : un genre a trois états — neutre, inclus, exclu. Deux
    // ensembles disjoints plutôt qu'une valeur par genre : les deux listes
    // partent telles quelles vers l'API, et « est-ce inclus ? » reste un test
    // en O(1) aux quelque quinze endroits qui le posent.
    let excludedTags  = new Set();   // genres explicitement écartés
    let activeStatus  = new Set();   // statuts (multi)
    let activeDemo    = new Set();   // démographies (multi)
    let activeSort    = 'popularity'; // popularity | latest | alpha | added | rating
    // Trois filtres que MangaDex acceptait DEJA cote source sans qu'aucune
    // interface ne les propose : annee de publication, langue de traduction
    // disponible et classification du contenu.
    let activeYear    = '';          // annee EXACTE (ce que l'API accepte)
    let activeLangs   = new Set();   // langues de traduction (multi)
    let activeRatings = new Set();   // safe | suggestive | erotica
    let viewMode      = 'grid';       // grid | list
    let inFlight      = 0;
    let sourceInfo    = null;         // { id, name, lang } de la source active
    let allSources    = false;        // mode « Toutes les sources » (agrégé)
    let sourcesList   = [];           // manifest des sources installées

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('catalogue');
        restoreCtx();        // restaure le dernier contexte (filtres/tri/vue)
        readURLParams();     // l'URL (?q=, ?tag=, ?sort=) reste prioritaire
        try { allSources = localStorage.getItem('inko_cat_allsrc') === '1'; } catch (e) { window.MH?.err?.('catalogue.js', e); }
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
        // `tag` reste au singulier pour ne pas casser les liens déjà en
        // circulation (les cartes du hero pointent vers ?tag=Romance).
        if (p.get('tag'))  activeTags.add(p.get('tag'));
        p.getAll('tags').forEach(t => activeTags.add(t));
        p.getAll('sans').forEach(t => excludedTags.add(t));
        p.getAll('statut').forEach(s => activeStatus.add(s));
        p.getAll('demo').forEach(d => activeDemo.add(d));
        if (p.get('annee')) activeYear = p.get('annee');
        p.getAll('langue').forEach(l => activeLangs.add(l));
        p.getAll('classification').forEach(c => activeRatings.add(c));
        const page = parseInt(p.get('page') || '', 10);
        if (page > 0) currentPage = page;
    }

    // Audit AMEL-06 : les filtres ne vivaient que dans localStorage. Un
    // catalogue filtré ne se partageait pas, ne se mettait pas en favori, et le
    // bouton Précédent du navigateur ne ramenait pas à l'état d'avant. L'état
    // est désormais dans l'URL, qui redevient ce qu'elle doit être : l'adresse
    // de ce qu'on regarde.
    //
    // `replaceState` et non `pushState` : chaque clic sur un genre créerait
    // sinon une entrée d'historique, et il faudrait vingt « Précédent » pour
    // sortir de la page. La mémorisation locale reste, pour retrouver son
    // contexte en arrivant sans paramètres.
    function syncURL() {
        const p = new URLSearchParams();
        if (lastQuery)              p.set('q', lastQuery);
        if (activeSort && activeSort !== 'popularity') p.set('sort', activeSort);
        activeTags.forEach(t   => p.append('tags', t));
        excludedTags.forEach(t => p.append('sans', t));
        activeStatus.forEach(s => p.append('statut', s));
        activeDemo.forEach(d   => p.append('demo', d));
        if (activeYear) p.set('annee', activeYear);
        activeLangs.forEach(l   => p.append('langue', l));
        activeRatings.forEach(c => p.append('classification', c));
        if (currentPage > 1) p.set('page', String(currentPage));
        const qs = p.toString();
        const url = location.pathname + (qs ? '?' + qs : '');
        if (url !== location.pathname + location.search) {
            try { history.replaceState(null, '', url); } catch (e) { window.MH?.err?.('catalogue.js', e); }
        }
    }

    // ── Mémorisation du contexte (filtres / tri / vue) ──
    const CTX_KEY = 'inko_catalogue_ctx';
    function saveCtx() {
        try {
            localStorage.setItem(CTX_KEY, JSON.stringify({
                tags: [...activeTags], excluded: [...excludedTags],
                status: [...activeStatus], demo: [...activeDemo],
                sort: activeSort, view: viewMode, source: API.sources.current,
            }));
        } catch (e) { window.MH?.err?.('catalogue.js', e); }
    }
    function restoreCtx() {
        let c; try { c = JSON.parse(localStorage.getItem(CTX_KEY)); } catch (e) { window.MH?.err?.('catalogue.js', e); }
        if (!c) return;
        // Ne restaure les filtres que si on revient sur la même source
        if (c.source && c.source === API.sources.current) {
            (c.tags     || []).forEach(t => activeTags.add(t));
            (c.excluded || []).forEach(t => excludedTags.add(t));
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
        syncSortOptions();   // les tris dépendent de la source (audit BUG-06)
        syncSectionsFiltres();   // idem pour les filtres : rien d'inopérant à l'écran
        renderFiltresEtendus();
        renderResumeFiltres();
        renderSourceBar();   // re-rend maintenant que la liste est connue
    }

    // ── Bascule « Toutes les sources » / source par source ──────────────
    // Permet d'utiliser plusieurs extensions EN MÊME TEMPS depuis le catalogue :
    // en mode agrégé, populaires/recherche interrogent toutes les sources actives
    // en parallèle et fusionnent les résultats (dédup par titre).
    function enabledSources() {
        return sourcesList.filter(s => window.MH?.isSourceEnabled ? MH.isSourceEnabled(s.id) : true);
    }
    // Audit BUG-06 : le menu proposait « Note » quelle que soit la source. Sur
    // WeebCentral — la source par défaut — ce tri n'existe pas : la requête
    // partait avec le bon paramètre et revenait dans l'ordre de popularité,
    // sans le moindre signal. Une source déclare désormais ses tris réellement
    // honorés (`sorts`) ; on désactive les autres au lieu de mentir.
    // Une source qui ne déclare rien garde toutes les options.
    function syncSortOptions() {
        const sel = document.getElementById('sortSelect');
        if (!sel) return;
        const supported = allSources ? null : (sourceInfo && sourceInfo.sorts);
        [...sel.options].forEach(opt => {
            const ok = !supported || supported.includes(opt.value);
            opt.disabled = !ok;
            const base = opt.dataset.label || (opt.dataset.label = opt.textContent.trim());
            opt.textContent = ok ? base : `${base} — non géré par cette source`;
        });
        // Si le tri courant n'est pas géré, on retombe sur un tri valide plutôt
        // que de laisser un choix sans effet.
        if (supported && !supported.includes(sel.value)) {
            sel.value = supported[0] || 'popularity';
            activeSort = sel.value;
        }
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
            `<button class="quick-filter-btn ${on ? 'active' : ''}" aria-pressed="${!!on}" ${data}>${MH.esc(label)}</button>`;
        bar.innerHTML =
            chip('Toutes les sources', allSources, 'data-allsrc="1"') +
            enabledSources().map(s => chip(s.name, !allSources && s.id === API.sources.current, `data-src="${MH.esc(s.id)}"`)).join('');
        bar.querySelectorAll('[data-allsrc]').forEach(b => b.addEventListener('click', async () => {
            allSources = true;
            try { localStorage.setItem('inko_cat_allsrc', '1'); } catch (e) { window.MH?.err?.('catalogue.js', e); }
            currentPage = 1; renderSourceBar();
            await runSearch();
        }));
        bar.querySelectorAll('[data-src]').forEach(b => b.addEventListener('click', async () => {
            allSources = false;
            try { localStorage.setItem('inko_cat_allsrc', '0'); } catch (e) { window.MH?.err?.('catalogue.js', e); }
            API.sources.current = b.dataset.src;
            currentPage = 1;
            sourceInfo = sourcesList.find(s => s.id === b.dataset.src) || null;
            renderSourceBar(); renderChips(); syncSortOptions(); syncSectionsFiltres();
            loadTags().then(renderFilterSidebar).catch(() => {});
            await runSearch();
        }));
    }

    // Recherche agrégée : interroge chaque source active en parallèle et fusionne.
    function aggNormTitle(t) {
        return (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
    }
    // État du mode agrégé (audit N47) : offset PAR SOURCE + fusion cumulée —
    // avant, le mode « Toutes les sources » affichait un lot unique figé, sans
    // jamais proposer de page suivante.
    let aggOffset = 0;
    let aggSeen = new Map();

    async function runSearchAggregate(myReq, more = false) {
        const grid = document.getElementById('resultsGrid');
        const count = document.getElementById('resultsCount');
        const srcs = enabledSources();
        const per = Math.max(8, Math.ceil(PER_PAGE / Math.max(1, srcs.length)) * 2);
        if (!more) { aggOffset = 0; aggSeen = new Map(); }
        const settled = await Promise.allSettled(srcs.map(s => {
            const params = { limit: per, offset: aggOffset };
            if (lastQuery) { params.q = lastQuery; return API.mangas.searchFor(s.id, params); }
            return API.mangas.popularFor(s.id, params);
        }));
        if (myReq !== inFlight) return;
        // Fusion + dédup par titre (la même œuvre sur 2 sources = 1 carte, 1re source gagne)
        settled.forEach((r, i) => {
            if (r.status !== 'fulfilled') return;
            (r.value.results || []).forEach(m => {
                const key = aggNormTitle(m.title);
                if (!key || aggSeen.has(key)) return;
                m._source = srcs[i].id; m._sourceName = srcs[i].name;
                aggSeen.set(key, m);
            });
        });
        aggOffset += per;
        lastResults = [...aggSeen.values()];
        lastTotal = lastResults.length;
        const okCount = settled.filter(r => r.status === 'fulfilled').length;
        if (count) count.innerHTML = `<strong>${lastResults.length}</strong> séries · ${okCount}/${srcs.length} sources`;
        // Audit A11Y-06 : annonce le résultat aux lecteurs d'écran
        MH.announce?.(lastResults.length
            ? `${lastResults.length} séries trouvées sur ${okCount} source(s)`
            : 'Aucun résultat sur tes sources actives');
        if (!lastResults.length) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text2)">Aucun résultat sur tes sources actives.</div>';
        } else {
            grid.innerHTML = lastResults.map(m => mangaCardHTML(m)).join('');
            MH.markFavorites(grid);
        }
        // « Charger plus » tant qu'au moins une source a rempli sa page
        const pag = document.getElementById('pagination');
        if (!pag) return;
        const anyMore = settled.some(r => r.status === 'fulfilled' && (r.value.results || []).length >= per);
        if (!anyMore) { pag.innerHTML = ''; return; }
        pag.innerHTML = `<button class="btn" id="aggMore" style="display:block;margin:16px auto">Charger plus</button>`;
        pag.querySelector('#aggMore').addEventListener('click', async () => {
            const b = pag.querySelector('#aggMore');
            b.disabled = true; b.textContent = 'Chargement…';
            inFlight++;
            try { await runSearchAggregate(inFlight, true); }
            catch (e) { b.disabled = false; b.textContent = 'Charger plus'; }
        });
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
    function renderTagGroup(el, items, emptyMsg) {
        if (!el) return;
        el.innerHTML = items.length
            ? items.map(g => tagButtonHTML(g)).join('')
            : (emptyMsg ? `<div style="font-size:12px;color:var(--text3);padding:8px">${emptyMsg}</div>` : '');
    }

    // Audit AMEL-05 : trois états à rendre lisibles SANS s'appuyer seulement sur
    // la couleur — un daltonien doit distinguer « inclus » de « exclu ».
    // D'où le préfixe « − » et le titre explicite, en plus du style.
    function tagButtonHTML(g) {
        const inclus = activeTags.has(g.id);
        const exclu  = excludedTags.has(g.id);
        const classe = inclus ? 'filter-tag active' : exclu ? 'filter-tag excluded' : 'filter-tag';
        const titre  = inclus ? 'Inclus — cliquer pour exclure'
            : exclu ? 'Exclu — cliquer pour ne plus filtrer'
                : 'Cliquer pour inclure';
        return `<button class="${classe}" aria-pressed="${inclus}" title="${titre}"
            data-tag="${MH.esc(g.id)}">${exclu ? '−&nbsp;' : ''}${MH.esc(g.name)}</button>`;
    }

    // Repeint un bouton après un changement d'état (le libellé change aussi :
    // on ne peut pas se contenter de basculer une classe).
    function peindreTag(btn) {
        const id = btn.dataset.tag;
        const nom = btn.textContent.replace(/^−\s*/, '').trim();
        btn.outerHTML = tagButtonHTML({ id, name: nom });
    }
    function renderFilterSidebar() {
        // Tous les tags disponibles, répartis par groupe (genre / thème / format).
        // Plus de plafond : MangaDex expose 25 genres + 38 thèmes + 12 formats,
        // tous filtrables (includedTags accepte n'importe quel tag).
        const byGroup = (g) => allTags.filter(t => (t.group || 'genre') === g);
        const genres = allTags.filter(t => !t.group || t.group === 'genre');
        renderTagGroup(document.getElementById('filterGenres'), genres,
            'Pas de filtres par genre pour cette source.');
        // Sections thèmes/format masquées quand la source n'en fournit pas
        const themes = byGroup('theme');
        const formats = byGroup('format');
        renderTagGroup(document.getElementById('filterThemes'), themes, '');
        renderTagGroup(document.getElementById('filterFormats'), formats, '');
        toggleSection('filterThemes', themes.length);
        toggleSection('filterFormats', formats.length);

        const statusEl = document.getElementById('filterStatus');
        if (statusEl) {
            statusEl.innerHTML = [
                { v: 'ongoing',   l: 'En cours'  },
                { v: 'completed', l: 'Terminé'   },
                { v: 'hiatus',    l: 'En pause'  },
                { v: 'cancelled', l: 'Annulé'    },
            ].map(s =>
                `<button class="filter-status-btn ${activeStatus.has(s.v) ? 'active' : ''}" aria-pressed="${activeStatus.has(s.v)}" data-status="${s.v}">${s.l}</button>`
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
        // La recherche de genres se lie APRES le rendu des tags : avant, la
        // liste est vide et il n'y aurait rien a filtrer.
        initRechercheGenres();
        renderResumeFiltres();
    }

    // Masque une section de filtres (et son libellé) quand elle est vide
    function toggleSection(gridId, hasItems) {
        const grid = document.getElementById(gridId);
        const section = grid && grid.closest('.filter-section');
        if (section) section.style.display = hasItems ? '' : 'none';
    }

    // Resynchronise l'état visuel de la sidebar (plusieurs filtres actifs possibles)
    function syncSidebarState() {
        document.querySelectorAll('#filterStatus [data-status]').forEach(b =>
            b.classList.toggle('active', activeStatus.has(b.dataset.status)));
        document.querySelectorAll('#filterDemo [data-demo]').forEach(i =>
            { i.checked = activeDemo.has(i.dataset.demo); });
        // Audit AMEL-05 : trois états, donc un repaint complet du bouton —
        // basculer une classe ne suffit plus, le libellé porte aussi le « − ».
        document.querySelectorAll('#filterGenres [data-tag], #filterThemes [data-tag], #filterFormats [data-tag]')
            .forEach(b => peindreTag(b));
        updateFiltersCount();
    }

    function updateFiltersCount() {
        const el = document.getElementById('activeFiltersCount');
        if (!el) return;
        const n = activeTags.size + excludedTags.size + activeStatus.size + activeDemo.size;
        el.textContent = n ? `${n} filtre(s) actif(s)` : '';
    }

    // ── Recherche ──
    async function runSearch() {
        const grid = document.getElementById('resultsGrid');
        if (!grid) return;
        const count = document.getElementById('resultsCount');
        // Nouvelle recherche ou filtre modifie : la grille repart de zero, donc
        // le quota de defilement automatique aussi. Apres un saut de page, en
        // revanche, on ne charge rien de plus sans geste de l'utilisateur.
        reinitAutoDefilement(sautDePage);
        sautDePage = false;

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
            if (excludedTags.size) params.excludedTags = [...excludedTags];   // audit AMEL-05
            ajouterFiltresEtendus(params);

            const data = await API.mangas.search(params);
            if (myReq !== inFlight) return; // requête plus récente en cours
            lastResults = data.results || [];
            lastTotal   = data.total || 0;
            saveCtx();   // mémorise le contexte courant pour la prochaine visite
            syncURL();   // audit AMEL-06 : l'URL décrit ce qui est affiché

            if (count) count.innerHTML = texteCompteur(lastResults.length, lastTotal);

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
        const srcNsfw = (sourcesList.find(s => s.id === src) || {}).nsfw;
        // Audit C3 : lien « étendu » + cœur en frère (plus de bouton dans un lien)
        return `
        <div class="manga-card" data-manga-id="${MH.esc(m.id)}">
            <a href="serie.html?id=${encodeURIComponent(m.id)}&source=${encodeURIComponent(src)}" class="manga-card-link" aria-label="${MH.esc(m.title)}"${MH.nsfwCardAttrs(m, srcNsfw)}></a>
            <div class="manga-card-cover">
                <img src="${MH.cover(m.cover)}" alt="${MH.esc(m.title)}" loading="lazy" decoding="async"
                     onerror="this.src='${MH.placeholderCover(m.id)}'">
                <div class="manga-card-badges">
                    ${isNovel ? '<span class="badge" style="background:var(--ai);color:#fff">ROMAN</span>' : ''}
                    ${m.status === 'completed' ? '<span class="badge badge-termine">TERMINÉ</span>' : ''}
                    ${m.status === 'hiatus' ? '<span class="badge badge-pause">PAUSE</span>' : ''}
                </div>
                <button class="card-fav-btn" data-fav="${m.id}" title="Ajouter aux favoris" aria-pressed="false" aria-label="Ajouter aux favoris">${MH.heartIcon(false)}</button>
                <!-- Audit AMEL-39 : l'ajout à une liste n'était possible que
                     depuis la fiche série — il fallait donc ouvrir chaque titre
                     pour le ranger, alors qu'on constitue une liste EN
                     parcourant le catalogue. -->
                <button class="card-list-btn" data-addlist="${MH.esc(m.id)}" data-src="${MH.esc(src)}"
                        data-title="${MH.esc(m.title || '')}" data-cover="${MH.esc(m.cover || '')}"
                        title="Ajouter à une liste" aria-label="Ajouter à une liste">+</button>
                <div class="manga-card-overlay">
                    <div class="btn-read-overlay">Lire</div>
                </div>
            </div>
            <div class="manga-card-info">${cardInfoHTML(m)}</div>
        </div>`;
    }

    // Enrichit en arrière-plan les cartes "pauvres" via getManga (sources dont la
    // liste n'expose pas l'auteur/statut, ex. SushiScan, Chireads). Throttlé + caché serveur.
    async function enrichSparseCards(list, reqId) {
        const src = API.sources.current;
        // Plafond (audit N48) : sans lui, jusqu'à 24 requêtes getManga
        // supplémentaires partaient par page affichée vers des sites de
        // scraping déjà fragiles (SushiScan + Cloudflare). 8 suffisent à
        // enrichir le haut de la grille ; le reste s'affine à l'ouverture
        // de la fiche.
        const need = list.filter(isSparse).slice(0, 8);
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
                } catch (e) { window.MH?.err?.('catalogue.js', e); }
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
        renderLoadMore(pages);
    }


    // Compteur honnete (defaut releve avec le blocage a 48 series).
    // Beaucoup de sources ne connaissent pas la taille de leur catalogue et
    // renvoient un total « page pleine » : une borne BASSE valant exactement
    // « ce qui est charge + une page de plus ». Affiche tel quel, ca donnait
    // « 168 sur 192 series » sur un catalogue de plusieurs MILLIERS de titres —
    // un chiffre faux, qui laisse croire qu'on touche au bout.
    //
    // On ne peut pas deviner le vrai total. On peut, en revanche, ne pas
    // affirmer ce qu'on ne sait pas : quand le total porte cette signature, on
    // dit ce qui est charge et qu'il y en a d'autres.
    function texteCompteur(charges, total) {
        const n = (v) => (MH.fmt ? MH.fmt(v) : String(v));
        if (!charges) return 'Aucune série';
        const borneBasse = total <= charges + PER_PAGE;
        if (borneBasse) {
            return `Affichage de <strong>${n(charges)}</strong> séries<span style="color:var(--text3)"> — d’autres sont disponibles</span>`;
        }
        return `Affichage de <strong>${n(charges)}</strong> sur <strong>${n(total)}</strong> séries`;
    }


    // ── Filtres étendus (année, langue, classification) ──────
    // On n'envoie QUE ce que la source déclare honorer. Envoyer un filtre
    // qu'elle ignore ne casse rien, mais laisse croire qu'il agit — et c'est
    // exactement le défaut qu'on corrige ici : `year` et `contentRating`
    // étaient acceptés par MangaDex depuis le début, sans aucune interface.
    function sourceGere(cle) {
        if (allSources) return true;            // agrégé : au moins une source peut gérer
        const dec = sourceInfo && sourceInfo.filters;
        return !dec || dec.includes(cle);       // pas de déclaration = on ne préjuge pas
    }
    function ajouterFiltresEtendus(params) {
        if (activeYear && sourceGere('year')) params.year = activeYear;
        if (activeLangs.size && sourceGere('lang')) params.lang = [...activeLangs];
        if (activeRatings.size && sourceGere('contentRating')) params.contentRating = [...activeRatings];
    }

    // Masque les sections que la source courante n'honore pas. Un filtre visible
    // qui ne change rien est pire qu'un filtre absent : on le coche, le résultat
    // ne bouge pas, et on croit le catalogue cassé.
    function syncSectionsFiltres() {
        document.querySelectorAll('.filter-section[data-filter]').forEach(sec => {
            sec.hidden = !sourceGere(sec.dataset.filter);
        });
    }

    const LANGUES = [
        ['fr', 'Français'], ['en', 'Anglais'], ['es', 'Espagnol'], ['es-la', 'Espagnol (LatAm)'],
        ['pt-br', 'Portugais (BR)'], ['de', 'Allemand'], ['it', 'Italien'], ['ru', 'Russe'],
        ['ja', 'Japonais'], ['ko', 'Coréen'], ['zh', 'Chinois'],
    ];
    const CLASSIFICATIONS = [
        ['safe', 'Tout public'], ['suggestive', 'Suggestif'], ['erotica', 'Érotique'],
    ];

    function renderFiltresEtendus() {
        // Année : liste déroulante plutôt que saisie libre. L'API attend une
        // année EXACTE ; un champ texte inviterait à taper « 2020-2024 », qui
        // ne renverrait rien sans expliquer pourquoi.
        const selY = document.getElementById('filterYear');
        if (selY && selY.options.length <= 1) {
            const courante = new Date().getFullYear();
            for (let a = courante; a >= 1960; a--) {
                const o = document.createElement('option');
                o.value = String(a); o.textContent = String(a);
                selY.appendChild(o);
            }
        }
        if (selY) {
            selY.value = activeYear || '';
            if (!selY.dataset.lie) {
                selY.dataset.lie = '1';
                selY.addEventListener('change', () => {
                    activeYear = selY.value;
                    currentPage = 1; runSearch(); renderResumeFiltres();
                });
            }
        }

        const zoneL = document.getElementById('filterLang');
        if (zoneL && !zoneL.dataset.lie) {
            zoneL.dataset.lie = '1';
            zoneL.innerHTML = LANGUES.map(([c, n]) =>
                '<button type="button" class="filter-tag" data-lang="' + c + '" aria-pressed="false">' + MH.esc(n) + '</button>').join('');
            zoneL.addEventListener('click', (e) => {
                const b = e.target.closest('[data-lang]'); if (!b) return;
                const c = b.dataset.lang;
                if (activeLangs.has(c)) activeLangs.delete(c); else activeLangs.add(c);
                majEtatChips(zoneL, 'lang', activeLangs);
                currentPage = 1; runSearch(); renderResumeFiltres();
            });
        }
        if (zoneL) majEtatChips(zoneL, 'lang', activeLangs);

        const zoneR = document.getElementById('filterRating');
        if (zoneR && !zoneR.dataset.lie) {
            zoneR.dataset.lie = '1';
            zoneR.innerHTML = CLASSIFICATIONS.map(([c, n]) =>
                '<label class="filter-checkbox"><input type="checkbox" data-rating="' + c + '"> <span>' + MH.esc(n) + '</span></label>').join('');
            zoneR.addEventListener('change', (e) => {
                const i = e.target.closest('[data-rating]'); if (!i) return;
                if (i.checked) activeRatings.add(i.dataset.rating); else activeRatings.delete(i.dataset.rating);
                currentPage = 1; runSearch(); renderResumeFiltres();
            });
        }
        if (zoneR) {
            zoneR.querySelectorAll('[data-rating]').forEach(i => { i.checked = activeRatings.has(i.dataset.rating); });
        }
    }
    function majEtatChips(zone, attr, ens) {
        zone.querySelectorAll('[data-' + attr + ']').forEach(b => {
            const on = ens.has(b.dataset[attr]);
            b.classList.toggle('active', on);
            b.setAttribute('aria-pressed', String(on));
        });
    }

    // ── Résumé des filtres actifs ────────────────────────────
    // Sur une barre latérale longue, on perd de vue ce qui est coché — et donc
    // pourquoi le catalogue semble vide. Chaque filtre actif se retire d'un clic.
    function renderResumeFiltres() {
        const bloc = document.getElementById('filterSummary');
        const zone = document.getElementById('filterActiveChips');
        const cpt  = document.getElementById('filterCount');
        if (!bloc || !zone) return;
        const nomLangue = (v) => (LANGUES.find(x => x[0] === v) || [null, v])[1];
        const nomClasse = (v) => (CLASSIFICATIONS.find(x => x[0] === v) || [null, v])[1];
        const actifs = [];
        activeTags.forEach(t    => actifs.push({ k: 'tag', v: t, l: t }));
        excludedTags.forEach(t  => actifs.push({ k: 'sans', v: t, l: 'sans ' + t }));
        activeStatus.forEach(v  => actifs.push({ k: 'statut', v, l: v }));
        activeDemo.forEach(v    => actifs.push({ k: 'demo', v, l: v }));
        activeLangs.forEach(v   => actifs.push({ k: 'langue', v, l: nomLangue(v) }));
        activeRatings.forEach(v => actifs.push({ k: 'classification', v, l: nomClasse(v) }));
        if (activeYear) actifs.push({ k: 'annee', v: activeYear, l: activeYear });

        bloc.hidden = !actifs.length;
        if (cpt) cpt.textContent = actifs.length ? '(' + actifs.length + ')' : '';
        zone.innerHTML = actifs.map(a =>
            '<button type="button" class="filter-active-chip" data-off="' + MH.esc(a.k) + '" data-val="' + MH.esc(a.v) + '"'
            + ' aria-label="Retirer le filtre ' + MH.esc(a.l) + '">' + MH.esc(a.l) + ' <span aria-hidden="true">×</span></button>').join('');
        if (!zone.dataset.lie) {
            zone.dataset.lie = '1';
            zone.addEventListener('click', (e) => {
                const b = e.target.closest('[data-off]'); if (!b) return;
                const off = b.dataset.off, val = b.dataset.val;
                if (off === 'tag')                 activeTags.delete(val);
                else if (off === 'sans')           excludedTags.delete(val);
                else if (off === 'statut')         activeStatus.delete(val);
                else if (off === 'demo')           activeDemo.delete(val);
                else if (off === 'langue')         activeLangs.delete(val);
                else if (off === 'classification') activeRatings.delete(val);
                else if (off === 'annee')          activeYear = '';
                currentPage = 1;
                renderFiltresEtendus();
                renderFilterSidebar();
                runSearch();
                renderResumeFiltres();
            });
        }
    }

    // Recherche dans la liste des genres : des dizaines de tags, sans quoi
    // trouver « Psychological » demande de parcourir toute la liste.
    function initRechercheGenres() {
        const inp = document.getElementById('filterGenreSearch');
        const zone = document.getElementById('filterGenres');
        if (!inp || !zone || inp.dataset.lie) return;
        inp.dataset.lie = '1';
        inp.addEventListener('input', () => {
            const q = inp.value.trim().toLowerCase();
            let visibles = 0;
            zone.querySelectorAll('.filter-tag').forEach(b => {
                const ok = !q || b.textContent.toLowerCase().includes(q);
                b.hidden = !ok;
                if (ok) visibles++;
            });
            let vide = zone.querySelector('.filter-empty');
            if (!visibles) {
                if (!vide) {
                    vide = document.createElement('div');
                    vide.className = 'filter-empty';
                    vide.textContent = 'Aucun genre ne correspond';
                    zone.appendChild(vide);
                }
                vide.hidden = false;
            } else if (vide) { vide.hidden = true; }
        });
    }

    // ── Chargement de la suite (audit AMEL-09) ───────────────
    // 24 séries par page pour parcourir un catalogue de plusieurs dizaines de
    // milliers de titres : la pagination oblige à repartir du haut à chaque
    // clic, et fait perdre le fil.
    //
    // Choix : la pagination RESTE (elle permet d'aller directement page 40 et
    // rend l'état adressable, cf. AMEL-06), et un bouton « Charger la suite »
    // ajoute la page suivante à la fin de la grille. Un observateur le
    // déclenche quand on approche du bas — mais ce n'est qu'un raccourci :
    // le bouton existe, il est focusable au clavier, et rien ne dépend du
    // déclenchement de l'observateur. Même principe que le rendu progressif de
    // la bibliothèque (PERF-05) : un défaut de confort ne doit jamais devenir
    // un contenu inatteignable.
    let loadMoreObserver = null;
    let chargementEnCours = false;

    // Le raccourci avait mange la fonctionnalite. L'observateur se declenche
    // 400 px AVANT le bas : la grille grandissait donc toujours plus vite
    // qu'on ne descendait, et la barre de pagination — qui se trouve sous le
    // bouton — restait hors d'atteinte. Sur MangaDex elle annonce 3 483 pages
    // que personne ne pouvait atteindre autrement qu'en modifiant l'URL.
    //
    // Le chargement automatique est donc BORNE. Passe ce seuil, le bouton
    // « Charger la suite » reste (rien ne devient inatteignable) et la
    // pagination redevient accessible. Le compteur est remis a zero a chaque
    // nouvelle recherche, chaque changement de filtre et chaque saut de page :
    // la borne vaut par serie de defilement, pas pour la session.
    const AUTO_MAX = 2;
    let autoCharges = 0;
    // Un saut de page est une demande EXPLICITE : « montre-moi la page 3 ».
    // Y ajouter d'office la page 4 — ce que faisait l'observateur, la grille
    // etant courte apres un saut — repondait a cote et rendait le numero de
    // page actif faux (on cliquait 3, l'URL affichait 4).
    let sautDePage = false;
    function reinitAutoDefilement(desactive) { autoCharges = desactive ? AUTO_MAX : 0; }

    function renderLoadMore(pages) {
        const zone = document.getElementById('pagination');
        if (!zone) return;
        document.getElementById('catLoadMore')?.remove();
        loadMoreObserver?.disconnect();
        if (currentPage >= pages) return;

        const btn = document.createElement('button');
        btn.id = 'catLoadMore';
        btn.className = 'btn btn-secondary';
        btn.style.cssText = 'display:block;margin:18px auto 0';
        btn.textContent = 'Charger la suite';
        zone.parentNode.insertBefore(btn, zone);
        btn.addEventListener('click', () => chargerSuite(btn, pages));

        if (autoCharges < AUTO_MAX) {
            loadMoreObserver = new IntersectionObserver((entries) => {
                if (!entries.some(e => e.isIntersecting)) return;
                if (autoCharges >= AUTO_MAX) { loadMoreObserver?.disconnect(); return; }
                autoCharges += 1;
                chargerSuite(btn, pages);
            }, { rootMargin: '400px' });
            loadMoreObserver.observe(btn);
        }
    }

    async function chargerSuite(btn, pages) {
        if (chargementEnCours || currentPage >= pages) return;
        chargementEnCours = true;
        btn.disabled = true;
        btn.textContent = 'Chargement…';
        const grid = document.getElementById('catalogueGrid') || document.getElementById('resultsGrid');
        try {
            const params = { limit: PER_PAGE, offset: currentPage * PER_PAGE, sort: activeSort };
            if (lastQuery)         params.q            = lastQuery;
            if (activeStatus.size) params.status       = [...activeStatus];
            if (activeDemo.size)   params.demographic  = [...activeDemo];
            if (activeTags.size)   params.includedTags = [...activeTags];
            if (excludedTags.size) params.excludedTags = [...excludedTags];
            ajouterFiltresEtendus(params);

            const data = await API.mangas.search(params);
            const nouveaux = data.results || [];
            // Le total DOIT etre relu a chaque page. Plusieurs sources ne
            // connaissent pas la taille de leur catalogue et renvoient un
            // total « page pleine » : une borne BASSE qui grandit a mesure
            // qu'on avance (48, puis 72, puis 96…). Fige au premier appel, il
            // faisait croire a 2 pages et le bouton « Charger la suite »
            // disparaissait apres 48 series — sur un catalogue de plusieurs
            // milliers de titres.
            //
            // On prend la NOUVELLE valeur, jamais le maximum : sur la derniere
            // page, une source honnete renvoie un total plus PETIT que la borne
            // precedente (offset + ce qui reste). Garder le maximum proposerait
            // alors une page qui n'existe pas.
            if (Number.isFinite(data.total) && data.total > 0) lastTotal = data.total;
            currentPage += 1;
            if (grid && nouveaux.length) {
                grid.insertAdjacentHTML('beforeend', nouveaux.map(m => mangaCardHTML(m)).join(''));
                MH.markFavorites(grid);
                lastResults = lastResults.concat(nouveaux);
            }
            const count = document.getElementById('resultsCount');
            if (count) count.innerHTML = texteCompteur(lastResults.length, lastTotal);
            saveCtx(); syncURL();
            renderPagination();   // recrée le bouton pour la page d'après, ou le retire
        } catch (e) {
            btn.disabled = false;
            btn.textContent = 'Réessayer';
            MH.toast?.('Chargement interrompu : ' + e.message);
        } finally {
            chargementEnCours = false;
        }
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
            // Audit CAT2 : « du moment » = stable sur la journée (seed = date),
            // plus un tirage aléatoire différent à chaque rechargement.
            const daySeed = Math.floor(Date.now() / 86400000);
            const m = list[daySeed % list.length];
            el.innerHTML = `
                <div class="focus-label">Focus du moment</div>
                <div class="focus-cover"><img src="${MH.cover(m.cover)}" alt="${MH.esc(m.title)}" loading="lazy" decoding="async"></div>
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
                        <img src="${MH.cover(m.coverThumb, m.cover)}" alt="" loading="lazy" decoding="async" onerror="this.closest('.latest-mini-cover').classList.add('noimg')">
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
                        ${(l.covers || []).slice(0, 4).map(c => `<img src="${MH.esc(c)}" alt="" loading="lazy">`).join('') || ''}
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
        // Tags (genres, thèmes, formats — même set activeTags, délégation)
        // Audit AMEL-05 : cycle à trois temps sur un même bouton —
        // neutre → inclus → EXCLU → neutre. Un second clic est le geste
        // naturel pour dire « pas celui-là » ; l'alternative (clic droit)
        // n'existe pas au toucher et reste invisible tant qu'on ne l'a pas
        // découverte.
        const cycleTag = (id) => {
            if (activeTags.has(id))        { activeTags.delete(id); excludedTags.add(id); }
            else if (excludedTags.has(id)) { excludedTags.delete(id); }
            else                           { activeTags.add(id); }
        };
        const onTagClick = async e => {
            const btn = e.target.closest('[data-tag]');
            if (!btn) return;
            cycleTag(btn.dataset.tag);
            peindreTag(btn);
            currentPage = 1;
            updateFiltersCount();
            await runSearch();
        };
        ['filterGenres', 'filterThemes', 'filterFormats'].forEach(id =>
            document.getElementById(id)?.addEventListener('click', onTagClick));

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
            activeTags.clear(); excludedTags.clear(); activeStatus.clear(); activeDemo.clear();
            // Les filtres étendus doivent partir aussi : une réinitialisation
            // qui en laisse trois en place n'en est pas une, et l'utilisateur
            // cherche ensuite pourquoi le catalogue reste filtré.
            activeLangs.clear(); activeRatings.clear(); activeYear = '';
            const inpG = document.getElementById('filterGenreSearch');
            if (inpG) { inpG.value = ''; inpG.dispatchEvent(new Event('input')); }
            lastQuery = ''; currentPage = 1; activeSort = 'popularity';
            const sortSel = document.getElementById('sortSelect'); if (sortSel) sortSel.value = 'popularity';
            renderFilterSidebar();
            renderFiltresEtendus();
            renderResumeFiltres();
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
            sautDePage = true;
            window.scrollTo({ top: 0, behavior: 'smooth' });
            await runSearch();
        });

        // Tri
        const sortSel = document.getElementById('sortSelect');
        if (sortSel) {
            syncSortOptions();
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
