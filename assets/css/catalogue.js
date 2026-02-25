// catalogue.js
(function () {
    'use strict';
    const PER_PAGE = 10;
    let currentPage = 1;
    let currentView = 'grid';
    let filters = { status: null, genre: null, demographic: null, minRating: 3.5, lang: null, isWebtoon: undefined, sort: 'popularity' };
    let searchQuery = '';

    document.addEventListener('DOMContentLoaded', () => {
        MH.initPage('catalogue');
        readURLParams();
        renderChips();
        renderQuickFilters();
        renderFilterSidebar();
        renderFocus();
        renderTeamPicks();
        renderResults();
        renderCollectionsMini();
        renderReviews();
        bindEvents();
    });

    function readURLParams() {
        const p = new URLSearchParams(location.search);
        if (p.get('q')) searchQuery = p.get('q');
        if (p.get('genre')) filters.genre = p.get('genre');
        if (p.get('status')) filters.status = p.get('status');
    }

    // ── Chips (stats bar) ────────────────────────────────────
    function renderChips() {
        const el = document.getElementById('catalogueChips');
        if (!el) return;
        el.innerHTML = [
            ['📚', `${DB.mangas.length * 150} séries disponibles`],
            ['🆕', '12 nouveautés aujourd\'hui'],
            ['🌐', 'FR · EN · JP'],
            ['🚫', 'Sans pubs intrusives'],
            ['🔄', 'Sync multi-appareils'],
            ['📥', 'Lecture hors-ligne'],
        ].map(([icon, text]) =>
            `<div class="catalogue-chip"><span class="catalogue-chip-icon">${icon}</span> ${text}</div>`
        ).join('');
    }

    // ── Quick filters bar ────────────────────────────────────
    function renderQuickFilters() {
        const el = document.getElementById('quickFilters');
        if (!el) return;
        const options = [
            { label: 'Tout', value: null },
            { label: 'Top notés', value: 'top' },
            { label: 'En cours', value: 'en_cours' },
            { label: 'Terminés', value: 'termine' },
            { label: 'Nouveautés', value: 'new' },
            { label: 'Webtoon', value: 'webtoon' },
            { label: 'Seinen', value: 'seinen' },
            { label: 'Shōnen', value: 'shonen' },
        ];
        el.innerHTML = options.map(o =>
            `<button class="quick-filter-btn ${!o.value && !filters.status ? 'active' : ''}"
                data-quick="${o.value || ''}">${o.label}</button>`
        ).join('');
        el.addEventListener('click', e => {
            const btn = e.target.closest('.quick-filter-btn');
            if (!btn) return;
            MH.$$('.quick-filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            const v = btn.dataset.quick;
            filters.status = null; filters.isWebtoon = undefined; filters.demographic = null;
            if (v === 'en_cours') filters.status = 'en_cours';
            else if (v === 'termine') filters.status = 'termine';
            else if (v === 'new') filters.isNew = true;
            else if (v === 'webtoon') filters.isWebtoon = true;
            else if (v === 'seinen') filters.demographic = 'Seinen';
            else if (v === 'shonen') filters.demographic = 'Shōnen';
            else if (v === 'top') filters.sort = 'rating';
            currentPage = 1;
            renderResults();
        });
    }

    // ── Filter sidebar ───────────────────────────────────────
    function renderFilterSidebar() {
        // Types
        const types = ['Action', 'Aventure', 'Isekai', 'Romance', 'Comédie', 'Slice of life', 'Drame', 'Psychologique', 'Mystère', 'Thriller', 'Horreur', 'Fantasy', 'Sci-Fi', 'Mecha', 'Sport', 'Arts martiaux', 'Historique', 'Musique', 'Idole', 'Tranche de vie', 'Sport scolaire', 'Superhéros', 'Surnaturel', 'Magie', 'Guerre', 'Crime', 'Enquête', 'Familial', 'Cuisine', 'Jeu / e-sport'];
        document.getElementById('filterTypes').innerHTML = types.map(t =>
            `<button class="filter-tag" data-type="${t}">${t}</button>`
        ).join('');

        // Genres (db)
        const genres = [...new Set(DB.mangas.flatMap(m => m.genres))].sort();
        document.getElementById('filterGenres').innerHTML = genres.map(g =>
            `<button class="filter-tag ${filters.genre === g ? 'active' : ''}" data-genre="${g}">${g}</button>`
        ).join('');

        // Status
        document.getElementById('filterStatus').innerHTML = [
            { v: 'en_cours', l: 'En cours' }, { v: 'termine', l: 'Terminé' }, { v: 'pause', l: 'Pause' }
        ].map(s =>
            `<button class="filter-status-btn ${filters.status === s.v ? 'active' : ''}" data-status="${s.v}">${s.l}</button>`
        ).join('');

        // Demo
        document.getElementById('filterDemo').innerHTML = ['Shōnen', 'Seinen', 'Shōjo', 'Josei'].map(d =>
            `<label class="filter-checkbox">
                <input type="checkbox" ${filters.demographic === d ? 'checked' : ''} data-demo="${d}">
                ${d}
            </label>`
        ).join('');

        // Langs
        document.getElementById('filterLangs').innerHTML = ['FR', 'EN', 'JP'].map(l =>
            `<button class="lang-btn ${filters.lang === l ? 'active' : ''}" data-lang="${l}">${l}</button>`
        ).join('');

        // Calendar
        const cal = document.getElementById('weekCalendar');
        if (cal) {
            cal.innerHTML = DB.calendarReleases.map(r => {
                const m = DB.getManga(r.mangaId);
                if (!m) return '';
                return `
                    <div class="week-release">
                        <div class="week-day">${r.day}${r.time ? ' · ' + r.time : ''}</div>
                        <a href="serie.html?id=${m.id}" class="week-release-item">
                            <div class="week-cover">
                                <img src="${m.coverFallback}" alt="" onerror="this.src='${m.coverFallback}'">
                            </div>
                            <div class="week-info">
                                <div class="week-title">${MH.esc(m.title)}</div>
                                <div>Chapitre ${r.chapter}</div>
                            </div>
                        </a>
                    </div>`;
            }).join('');
        }

        // Rating slider
        const slider = document.getElementById('ratingSlider');
        if (slider) {
            slider.value = filters.minRating;
            slider.addEventListener('input', () => {
                slider.previousElementSibling && (slider.previousElementSibling.textContent = slider.value);
                const vals = slider.parentElement.querySelector('.rating-vals span');
                if (vals) vals.textContent = slider.value;
                filters.minRating = parseFloat(slider.value);
                currentPage = 1; renderResults();
            });
        }

        // Click events
        document.getElementById('filterTypes')?.addEventListener('click', e => {
            const btn = e.target.closest('.filter-tag');
            if (!btn) return;
            btn.classList.toggle('active');
        });
        document.getElementById('filterGenres')?.addEventListener('click', e => {
            const btn = e.target.closest('[data-genre]');
            if (!btn) return;
            const isActive = btn.classList.contains('active');
            MH.$$('[data-genre]').forEach(b => b.classList.remove('active'));
            if (!isActive) { btn.classList.add('active'); filters.genre = btn.dataset.genre; }
            else filters.genre = null;
            currentPage = 1; renderResults();
        });
        document.getElementById('filterStatus')?.addEventListener('click', e => {
            const btn = e.target.closest('[data-status]');
            if (!btn) return;
            const isActive = btn.classList.contains('active');
            MH.$$('[data-status]').forEach(b => b.classList.remove('active'));
            if (!isActive) { btn.classList.add('active'); filters.status = btn.dataset.status; }
            else filters.status = null;
            currentPage = 1; renderResults();
        });
        document.getElementById('filterDemo')?.addEventListener('change', e => {
            const inp = e.target.closest('[data-demo]');
            if (!inp) return;
            filters.demographic = inp.checked ? inp.dataset.demo : null;
            currentPage = 1; renderResults();
        });
        document.getElementById('filterLangs')?.addEventListener('click', e => {
            const btn = e.target.closest('[data-lang]');
            if (!btn) return;
            const isActive = btn.classList.contains('active');
            MH.$$('[data-lang]').forEach(b => b.classList.remove('active'));
            if (!isActive) { btn.classList.add('active'); filters.lang = btn.dataset.lang; }
            else filters.lang = null;
        });

        document.getElementById('filtersReset')?.addEventListener('click', () => {
            filters = { status: null, genre: null, demographic: null, minRating: 0, lang: null, isWebtoon: undefined, sort: 'popularity' };
            searchQuery = '';
            currentPage = 1;
            renderFilterSidebar();
            renderResults();
        });
    }

    // ── Focus block ──────────────────────────────────────────
    function renderFocus() {
        const el = document.getElementById('catalogueFocus');
        if (!el) return;
        const m = DB.getManga(1); // Berserk comme featured
        if (!m) return;
        el.innerHTML = `
            <div class="focus-label">Focus du moment</div>
            <div class="focus-title">${MH.esc(m.title)}</div>
            <div style="position:relative">
                <div class="focus-cover">
                    <img src="${m.bannerFallback}" alt="${MH.esc(m.title)}"
                         onerror="this.src='${m.bannerFallback}'">
                </div>
                <span class="badge badge-orange" style="position:absolute;top:6px;right:6px">TOP 1</span>
            </div>
            <div class="focus-stats">
                <div class="focus-stat">
                    <div class="focus-stat-label">Lecteurs actifs</div>
                    <div class="focus-stat-value">${MH.fmt(m.readersActive)}</div>
                </div>
                <div class="focus-stat">
                    <div class="focus-stat-label">Chapitres</div>
                    <div class="focus-stat-value">${m.chapters}</div>
                </div>
                <div class="focus-stat">
                    <div class="focus-stat-label">Note moyenne</div>
                    <div class="focus-stat-value">⭐ ${m.rating}</div>
                </div>
                <div class="focus-stat">
                    <div class="focus-stat-label">Genre</div>
                    <div class="focus-stat-value" style="font-size:11px">${m.genres.slice(0,2).join(' · ')}</div>
                </div>
            </div>`;
    }

    // ── Team picks ───────────────────────────────────────────
    function renderTeamPicks() {
        const el = document.getElementById('teamPicksGrid');
        if (!el) return;
        const picks = [
            { mangaId: 9, badge: 'NEW', badgeCls: 'badge-new', subtitle: 'Sci-Fi Déjanté' },
            { mangaId: 3, badge: 'HOT', badgeCls: 'badge-hot', subtitle: 'Le retour d\'un classique' },
            { mangaId: 7, badge: 'EXCLU', badgeCls: 'badge-exclu', subtitle: 'Réédition couleur' },
        ];
        el.innerHTML = picks.map(p => {
            const m = DB.getManga(p.mangaId);
            if (!m) return '';
            return `
                <a href="serie.html?id=${m.id}" class="team-pick-card">
                    <div class="team-pick-bg" style="background-image:url('${m.bannerFallback}')"></div>
                    <div class="team-pick-content">
                        <div class="team-pick-badge"><span class="badge ${p.badgeCls}">${p.badge}</span></div>
                        <div class="team-pick-title">${MH.esc(m.title)}</div>
                        <div class="team-pick-subtitle">${p.subtitle}</div>
                    </div>
                </a>`;
        }).join('');
    }

    // ── Results ──────────────────────────────────────────────
    function getFiltered() {
        let r = DB.searchMangas(searchQuery, {
            status: filters.status,
            genre: filters.genre,
            demographic: filters.demographic,
            minRating: filters.minRating,
            isWebtoon: filters.isWebtoon,
            sort: filters.sort,
        });
        if (filters.isNew) r = r.filter(m => m.isNew);
        return r;
    }

    function renderResults() {
        const el = document.getElementById('resultsGrid');
        const countEl = document.getElementById('resultsCount');
        if (!el) return;
        const all = getFiltered();
        const total = all.length;
        const start = (currentPage - 1) * PER_PAGE;
        const page = all.slice(start, start + PER_PAGE);

        countEl && (countEl.innerHTML = `Affichage de <strong>${page.length}</strong> séries sur <strong>${total}</strong>`);

        if (!page.length) {
            el.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text2)">Aucune série correspondante. Modifiez les filtres.</div>';
        } else {
            el.innerHTML = page.map(m => catalogueCardHTML(m)).join('');
        }
        renderPagination(total);
    }

    function catalogueCardHTML(m) {
        if (currentView === 'list') return listCardHTML(m);
        return `
        <a href="serie.html?id=${m.id}" class="manga-card">
            <div class="manga-card-cover">
                <img src="${m.coverFallback}" alt="${MH.esc(m.title)}"
                     onerror="this.src='${m.coverFallback}'">
                <div class="manga-card-badges">
                    ${m.isHot ? '<span class="badge badge-hot">HOT</span>' : ''}
                    ${m.isNew ? '<span class="badge badge-new">NEW</span>' : ''}
                    ${m.isWebtoon ? '<span class="badge badge-blue" style="background:rgba(59,130,246,.15);color:#60a5fa">WEBTOON</span>' : ''}
                    ${m.status === 'termine' ? '<span class="badge badge-termine">TERMINÉ</span>' : ''}
                </div>
                <div class="manga-card-overlay">
                    <div class="btn-read-overlay">▶ Lecture</div>
                    <div class="btn-add-overlay">+ Ajouter</div>
                </div>
                <div class="progress-bar" style="position:absolute;bottom:0;left:0;right:0;border-radius:0">
                    <div class="progress-fill" style="width:${m.progress}%"></div>
                </div>
            </div>
            <div class="manga-card-info">
                <div class="manga-card-title">${MH.esc(m.title)}</div>
                <div class="manga-card-author">${MH.esc(m.author)}</div>
                <div class="manga-card-tags">
                    ${m.tags.slice(0, 2).map(t => `<span class="manga-card-tag">${t}</span>`).join('')}
                </div>
                <div class="manga-card-meta" style="margin-top:6px">
                    <span class="manga-card-rating">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                        ${m.rating}
                    </span>
                    <span>Chap. ${m.chapters}</span>
                </div>
            </div>
        </a>`;
    }

    function listCardHTML(m) {
        return `
        <a href="serie.html?id=${m.id}" class="manga-card" style="display:flex;flex-direction:row">
            <div class="manga-card-cover" style="width:70px;flex-shrink:0;aspect-ratio:auto;height:96px">
                <img src="${m.coverFallback}" alt="${MH.esc(m.title)}"
                     onerror="this.src='${m.coverFallback}'" style="height:100%;object-fit:cover">
            </div>
            <div class="manga-card-info" style="flex:1;padding:10px 14px">
                <div class="manga-card-title" style="font-size:14px;white-space:normal">${MH.esc(m.title)}</div>
                <div class="manga-card-author">${MH.esc(m.author)}</div>
                <div class="manga-card-tags" style="margin-top:4px">
                    ${m.tags.map(t => `<span class="manga-card-tag">${t}</span>`).join('')}
                </div>
                <div style="display:flex;gap:14px;margin-top:6px;font-size:11.5px;color:var(--text2)">
                    <span>⭐ ${m.rating} · ${MH.fmt(m.reviewCount)} avis</span>
                    <span>📖 ${m.chapters} chap.</span>
                    <span>👤 ${MH.fmt(m.readers)} lecteurs</span>
                    ${MH.statusBadge(m.status)}
                </div>
            </div>
        </a>`;
    }

    // ── Pagination ───────────────────────────────────────────
    function renderPagination(total) {
        const el = document.getElementById('pagination');
        if (!el) return;
        const pages = Math.ceil(total / PER_PAGE);
        if (pages <= 1) { el.innerHTML = ''; return; }
        let html = `<button class="page-btn" onclick="goPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>‹</button>`;
        for (let i = 1; i <= Math.min(pages, 5); i++) {
            html += `<button class="page-btn ${i === currentPage ? 'active' : ''}" onclick="goPage(${i})">${i}</button>`;
        }
        if (pages > 5) html += `<span class="page-sep">…</span><button class="page-btn" onclick="goPage(${pages})">${pages}</button>`;
        html += `<button class="page-btn" onclick="goPage(${currentPage + 1})" ${currentPage === pages ? 'disabled' : ''}>›</button>`;
        el.innerHTML = html;
    }
    window.goPage = function (p) {
        const all = getFiltered();
        const pages = Math.ceil(all.length / PER_PAGE);
        if (p < 1 || p > pages) return;
        currentPage = p;
        renderResults();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    // ── Collections mini ────────────────────────────────────
    function renderCollectionsMini() {
        const el = document.getElementById('collectionsMiniGrid');
        if (!el) return;
        el.innerHTML = DB.collections.slice(0, 3).map(c => {
            const covers = c.mangaIds.slice(0, 4).map(id => DB.getManga(id)).filter(Boolean);
            return `
            <a href="collection-detail.html?id=${c.id}" class="collection-mini-card">
                <div class="collection-mini-cover">
                    ${covers.slice(0, 2).map(m =>
                        `<img src="${m.coverFallback}" alt="" onerror="this.src='${m.coverFallback}'">`
                    ).join('')}
                </div>
                <div class="collection-mini-info">
                    <div class="collection-mini-title">${MH.esc(c.title)}</div>
                    <div class="collection-mini-meta">${c.seriesCount} séries · ⭐ Moy. ${c.avgRating}</div>
                </div>
            </a>`;
        }).join('');
    }

    // ── Reviews ──────────────────────────────────────────────
    function renderReviews() {
        const el = document.getElementById('reviewsGrid');
        if (!el) return;
        const reviews = [
            { mangaId: 1, user: 'Kuro_88', avatar: 'K', rating: 5, text: '"Absolument incroyable, l\'art est sublime et l\'histoire tient en haleine jusqu\'au bout. Je recommande !"' },
            { mangaId: 3, user: 'NordikSaga', avatar: 'N', rating: 4, text: '"Une saga épique et touchante. Les personnages sont très attachants, même si le rythme est un peu lent au début."' },
            { mangaId: 7, user: 'RPGAddict', avatar: 'R', rating: 5, text: '"L\'univers cyberpunk est très bien construit. Les combats sont dynamiques. Hâte de voir la suite !"' },
        ];
        el.innerHTML = reviews.map(r => {
            const m = DB.getManga(r.mangaId);
            if (!m) return '';
            return `
            <div class="review-card">
                <div class="review-card-manga">${MH.esc(m.title)}</div>
                <div class="review-card-stars">${MH.stars(r.rating)}</div>
                <div class="review-card-text">${MH.esc(r.text)}</div>
                <div class="review-card-user">
                    <div class="review-avatar">${r.avatar}</div>
                    ${r.user}
                </div>
            </div>`;
        }).join('');
    }

    // ── Bind misc events ────────────────────────────────────
    function bindEvents() {
        document.getElementById('btnRandom')?.addEventListener('click', () => {
            const all = DB.mangas;
            const m = all[Math.floor(Math.random() * all.length)];
            window.location.href = `serie.html?id=${m.id}`;
        });

        document.getElementById('sortSelect')?.addEventListener('change', e => {
            filters.sort = e.target.value;
            currentPage = 1; renderResults();
        });

        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentView = btn.dataset.view;
                const grid = document.getElementById('resultsGrid');
                if (grid) {
                    grid.classList.toggle('list-view', currentView === 'list');
                    if (currentView === 'list') grid.style.gridTemplateColumns = '1fr';
                    else grid.style.gridTemplateColumns = '';
                }
                renderResults();
            });
        });
    }
})();
