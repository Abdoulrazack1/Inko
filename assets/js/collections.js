// collections.js
(function () {
    'use strict';
    let activeFilter = 'all';

    document.addEventListener('DOMContentLoaded', () => {
        MH.initPage('collections');
        renderHeroTags();
        renderGenreIcons();
        renderFeatured();
        renderCurators();
        renderFilters();
        renderGrid();
    });

    function renderHeroTags() {
        const el = document.getElementById('heroTags');
        if (!el) return;
        ['#Isekai', '#DarkFantasy', '#Cyberpunk', '#RomCom'].forEach(t => {
            const a = document.createElement('a');
            a.href = '#'; a.className = 'hero-tag'; a.textContent = t;
            el.appendChild(a);
        });
    }

    function renderGenreIcons() {
        const el = document.getElementById('genreIconsBar');
        if (!el) return;
        const items = [
            ['⚔️', 'Action'], ['❤️', 'Romance'], ['🐉', 'Fantastique'],
            ['🩸', 'Horreur'], ['🚀', 'Sci-Fi'], ['🏆', 'Sports'],
            ['😄', 'Comédie'], ['🔍', 'Mystère'],
        ];
        el.innerHTML = items.map(([icon, label]) => `
            <div class="genre-icon-card" onclick="window.location.href='catalogue.html?genre=${encodeURIComponent(label)}'">
                <div class="genre-icon">${icon}</div>
                <div class="genre-icon-label">${label}</div>
            </div>`).join('');
    }

    function renderFeatured() {
        const el = document.getElementById('featuredGrid');
        if (!el) return;
        const picks = [
            { colId: 1, badge: 'TENDANCE', color: '#ff6b1a', mangaId: 1 },
            { colId: 3, badge: 'CHOIX DE L\'ÉDITEUR', color: '#3b82f6', mangaId: 12 },
        ];
        el.innerHTML = picks.map(p => {
            const c = DB.getCollection(p.colId);
            const m = DB.getManga(p.mangaId);
            if (!c || !m) return '';
            return `
            <a href="collection-detail.html?id=${c.id}" class="featured-card">
                <div class="featured-card-bg" style="background-image:url('${m.bannerFallback}')"></div>
                <div class="featured-card-overlay"></div>
                <div class="featured-card-content">
                    <div class="featured-badge">
                        <span class="badge" style="background:${p.color};color:#fff">${p.badge}</span>
                    </div>
                    <div class="featured-title">${MH.esc(c.title)}</div>
                    <div class="featured-meta">
                        <span>Par ${c.curator.name}</span>
                        <span>${c.seriesCount} Séries</span>
                        <span>❤️ ${MH.fmt(c.likes)} Likes</span>
                    </div>
                </div>
            </a>`;
        }).join('');
    }

    function renderCurators() {
        const el = document.getElementById('curatorsStrip');
        if (!el) return;
        el.innerHTML = DB.curators.map(c => `
            <div class="curator-card">
                <div class="curator-avatar">${c.name[0]}</div>
                <div class="curator-name">${c.name}</div>
                <div class="curator-count">${c.collections} Collections</div>
                <button class="curator-follow" onclick="MH.toast('Vous suivez ${c.name} !')">Suivre</button>
            </div>`).join('');
    }

    function renderFilters() {
        const el = document.getElementById('collectionsFilters');
        if (!el) return;
        const filters = [
            { v: 'all', l: 'Tout' }, { v: 'trending', l: 'Tendances' },
            { v: 'new', l: 'Nouvelles' }, { v: 'lowrated', l: 'Les mieux notées' },
            { v: 'staff', l: 'Staff Picks' }, { v: 'webtoon', l: 'Webtoons' },
            { v: 'termine', l: 'Terminées' },
        ];
        el.innerHTML = filters.map(f =>
            `<button class="collections-filter-btn ${f.v === activeFilter ? 'active' : ''}" data-filter="${f.v}">${f.l}</button>`
        ).join('') + `
        <div class="filter-spacer"></div>
        <select class="sort-dropdown-mini" id="colSort">
            <option>Trier par : Popularité</option>
            <option>Trier par : Note</option>
            <option>Trier par : Récent</option>
        </select>`;
        el.addEventListener('click', e => {
            const btn = e.target.closest('[data-filter]');
            if (!btn) return;
            activeFilter = btn.dataset.filter;
            el.querySelectorAll('[data-filter]').forEach(b => b.classList.toggle('active', b.dataset.filter === activeFilter));
            renderGrid();
        });
    }

    function renderGrid() {
        const el = document.getElementById('collectionsGrid');
        if (!el) return;
        let cols = [...DB.collections];
        if (activeFilter === 'trending') cols = cols.filter(c => c.isTrending);
        else if (activeFilter === 'staff') cols = cols.filter(c => c.isStaffPick);
        if (!cols.length) cols = DB.collections;

        el.innerHTML = cols.map(c => {
            const covers = c.mangaIds.slice(0, 4).map(id => DB.getManga(id)).filter(Boolean);
            return `
            <a href="collection-detail.html?id=${c.id}" class="collection-card">
                <div class="collection-card-cover">
                    <div class="collection-card-cover-mosaic">
                        ${covers.slice(0, 4).map(m =>
                            `<img src="${m.coverFallback}" alt="" onerror="this.src='${m.coverFallback}'">`
                        ).join('')}
                    </div>
                    <span class="collection-card-cover-count">📚 ${c.seriesCount}</span>
                </div>
                <div class="collection-card-body">
                    <div class="collection-card-title">${MH.esc(c.title)}</div>
                    <div class="collection-card-meta">${c.seriesCount} séries · ⭐ Moy. ${c.avgRating}</div>
                    <div class="collection-card-tags">
                        ${c.tags.slice(0,3).map(t => `<span class="collection-card-tag">${t}</span>`).join('')}
                    </div>
                    <div class="collection-card-footer">
                        <span>👤 ${MH.fmt(c.readers)}</span>
                        <span class="collection-card-likes">❤️ ${MH.fmt(c.likes)}</span>
                    </div>
                </div>
            </a>`;
        }).join('');
    }
})();