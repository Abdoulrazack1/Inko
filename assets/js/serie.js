// serie.js — Page série dynamique (backend + MangaDex metadata)
(function () {
    'use strict';

    let manga       = null;
    let chapters    = [];
    let readChapsSet= new Set();
    let progress    = null;
    let activeTab   = 'apercu';
    let chapSortAsc = false;
    let chapFilter  = '';
    let favorited   = false;

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('serie');
        const id = new URLSearchParams(location.search).get('id');
        if (!id) { showError('ID manquant.'); return; }

        showSkeleton();

        try {
            manga = await API.mangas.get(id);
            document.getElementById('pageTitle').textContent = 'MangaHub — ' + manga.title;

            // Données user (si connecté)
            if (API.isLoggedIn()) {
                const [favs, allRead, allProg] = await Promise.all([
                    API.me.favorites(),
                    API.me.readChapters(),
                    API.me.progress(),
                ]);
                favorited   = favs.some(f => f.mangaId === manga.id);
                readChapsSet = new Set((allRead[manga.id] || []).map(r => r.chapterId));
                progress    = allProg[manga.id] || null;
            }

            renderHero();
            renderTabs();
            renderTab('apercu');
            renderSidebar();

            // Chargement des chapitres async (pour ne pas bloquer l'affichage du hero)
            loadChapters();
        } catch (e) {
            showError("Manga introuvable : " + e.message);
        }
    });

    function showSkeleton() {
        const el = document.getElementById('serieHero');
        if (el) el.innerHTML = `<div style="padding:60px;text-align:center;color:var(--text3)">
            <div class="spinner-inline"></div>
            <div style="margin-top:12px;font-size:13px">Chargement de la fiche…</div>
        </div>`;
    }
    function showError(msg) {
        const el = document.getElementById('serieHero');
        if (el) el.innerHTML = `<div style="padding:40px;text-align:center;color:#ef4444">${MH.esc(msg)}</div>`;
    }

    async function loadChapters() {
        try {
            const data = await API.mangas.chapters(manga.id, { lang: 'fr,en', limit: 200 });
            chapters = data.results || [];
            if (activeTab === 'chapitres' || activeTab === 'apercu') renderTab(activeTab);
            renderSidebar();
            updateTabsLabels();
        } catch(e) {
            chapters = [];
            if (activeTab === 'chapitres') renderTab('chapitres');
        }
    }

    // ── HERO ──
    function renderHero() {
        const el = document.getElementById('serieHero');
        if (!el) return;
        const statusLabel = { ongoing:'En cours', completed:'Terminé', hiatus:'En pause', cancelled:'Annulé' }[manga.status] || manga.status;
        const resumeChap = progress?.chapterId;

        el.innerHTML = `
        <div class="serie-hero-inner">
            <div class="serie-cover-wrap">
                <div class="serie-cover-status">${MH.statusBadge(manga.status)}</div>
                <div class="serie-cover">
                    <img src="${manga.coverLarge || manga.cover || ''}" alt="${MH.esc(manga.title)}"
                         onerror="this.src='${MH.placeholderCover(manga.id)}'">
                </div>
                ${manga.rating?.bayesian ? `<div class="serie-cover-rating">⭐ ${manga.rating.bayesian.toFixed(2)}</div>` : ''}
            </div>
            <div class="serie-info">
                <div class="serie-title-tags">
                    ${(manga.tags || []).slice(0, 4).map(g => `<a href="catalogue.html?q=${encodeURIComponent(g)}" class="tag tag-link">${MH.esc(g)}</a>`).join('')}
                </div>
                <h1 class="serie-title">${MH.esc(manga.title)}</h1>
                ${manga.titleAlt ? `<div class="serie-title-jp">${MH.esc(manga.titleAlt)}</div>` : ''}
                <div class="serie-meta-row">
                    ${manga.author ? `<span class="serie-meta-item"><span class="serie-meta-icon">✍️</span> ${MH.esc(manga.author)}</span>` : ''}
                    <span class="serie-meta-item" id="chapCountMeta"><span class="serie-meta-icon">📖</span> <span class="spinner-inline" style="width:10px;height:10px;border-width:1px"></span> chapitres</span>
                    ${manga.year ? `<span class="serie-meta-item"><span class="serie-meta-icon">📅</span> ${manga.year}</span>` : ''}
                    <span class="serie-meta-item">
                        <span class="serie-meta-icon">🔵</span>
                        <span class="status-badge status-${manga.status}">${statusLabel}</span>
                    </span>
                </div>
                <p class="serie-desc-short">${MH.esc((manga.description || '').slice(0, 400))}${manga.description?.length > 400 ? '…' : ''}</p>
                <div class="serie-actions">
                    <button class="btn btn-primary" id="btnReadStart">▶ Lire depuis le début</button>
                    ${resumeChap ? `<button class="btn btn-secondary" id="btnResume">↻ Reprendre Ch.${progress.chapter}</button>` : ''}
                    <button class="btn btn-ghost ${favorited ? 'is-fav' : ''}" id="btnFavorite">
                        ${favorited ? '❤ Dans ma liste' : '♡ Ajouter à ma liste'}
                    </button>
                    <button class="btn btn-ghost btn-icon" id="btnShare" title="Partager">↗</button>
                </div>
            </div>
            <div class="serie-fiche">
                <div class="serie-fiche-title">Fiche rapide</div>
                <div class="fiche-subtitle">Informations principales</div>
                ${[
                    ['Statut', statusLabel],
                    ['Démographie', manga.demographic || '—'],
                    ['1er chapitre', manga.year || '—'],
                    ['Dernier chap.', manga.lastChapter || '—'],
                    ['Note moyenne', manga.rating?.bayesian ? manga.rating.bayesian.toFixed(2) : '—'],
                ].map(([k, v]) => `
                    <div class="fiche-row">
                        <span class="fiche-key">${k}</span>
                        <span class="fiche-val">${MH.esc(v)}</span>
                    </div>`).join('')}
                <div class="fiche-langs">
                    ${(manga.langs || []).slice(0, 5).map(l => `<span class="lang-badge">${l.toUpperCase()}</span>`).join('')}
                </div>
            </div>
        </div>`;

        // Bouton "Lire depuis le début" — attendre le chargement des chapitres
        document.getElementById('btnReadStart')?.addEventListener('click', async () => {
            if (!chapters.length) {
                MH.toast('Chargement des chapitres en cours…');
                return;
            }
            const first = [...chapters].sort((a, b) => a.chapter - b.chapter)[0];
            if (!first) return;
            window.location.href = `chapitre.html?manga=${encodeURIComponent(manga.id)}&chapter=${encodeURIComponent(first.id)}`;
        });

        document.getElementById('btnResume')?.addEventListener('click', () => {
            if (progress?.chapterId) {
                window.location.href = `chapitre.html?manga=${encodeURIComponent(manga.id)}&chapter=${encodeURIComponent(progress.chapterId)}`;
            }
        });

        document.getElementById('btnFavorite')?.addEventListener('click', async () => {
            if (!API.isLoggedIn()) { MH.toast('Connectez-vous pour ajouter des favoris'); return; }
            const btn = document.getElementById('btnFavorite');
            try {
                if (favorited) { await API.me.removeFavorite(manga.id); favorited = false; }
                else           { await API.me.addFavorite(manga.id); favorited = true; }
                btn.classList.toggle('is-fav', favorited);
                btn.textContent = favorited ? '❤ Dans ma liste' : '♡ Ajouter à ma liste';
                MH.toast(favorited ? 'Ajouté à votre liste !' : 'Retiré de votre liste');
            } catch(err) { MH.toast('Erreur : ' + err.message); }
        });

        document.getElementById('btnShare')?.addEventListener('click', async () => {
            const url = window.location.href;
            try {
                if (navigator.share) { await navigator.share({ title: manga.title, url }); return; }
                await navigator.clipboard.writeText(url);
                MH.toast('Lien copié !');
            } catch(e) { MH.toast(url); }
        });
    }

    // ── TABS ──
    function renderTabs() {
        const tabs = document.getElementById('serieTabs');
        const right = document.getElementById('serieTabsRight');
        if (!tabs) return;

        const tabDefs = [
            { key: 'apercu',    label: 'Aperçu' },
            { key: 'chapitres', label: `Chapitres` },
        ];
        tabs.innerHTML = tabDefs.map(t =>
            `<button class="serie-tab ${activeTab === t.key ? 'active' : ''}" data-tab="${t.key}">${t.label}</button>`
        ).join('');

        tabs.addEventListener('click', e => {
            const btn = e.target.closest('[data-tab]');
            if (!btn) return;
            activeTab = btn.dataset.tab;
            document.querySelectorAll('.serie-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));
            renderTab(activeTab);
        });

        if (right) right.textContent = manga.lastChapter ? `Dernier chap. : ${manga.lastChapter}` : '';
    }

    function updateTabsLabels() {
        const meta = document.getElementById('chapCountMeta');
        if (meta) meta.innerHTML = `<span class="serie-meta-icon">📖</span> ${chapters.length} chapitres`;
        document.querySelectorAll('.serie-tab[data-tab="chapitres"]').forEach(b => {
            b.textContent = `Chapitres (${chapters.length})`;
        });
    }

    function renderTab(tab) {
        const main = document.getElementById('serieMain');
        if (!main) return;
        if (tab === 'chapitres') return renderChapitres(main);
        renderApercu(main);
    }

    // ── APERÇU ──
    function renderApercu(el) {
        el.innerHTML = `
        <div class="synopsis-block">
            <div class="synopsis-block-header"><div class="synopsis-block-title">Synopsis</div></div>
            <div class="synopsis-text">${MH.esc(manga.description || 'Aucun synopsis disponible.')}</div>
        </div>
        <div class="chapters-block">
            <div class="chapters-block-header">
                <div class="chapters-block-title">Derniers chapitres</div>
                <button class="section-link" data-goto="chapitres">Voir tous →</button>
            </div>
            <div class="chapters-list" id="apercuChapsList">
                ${chapters.length ? chapters.slice(0, 5).map(c => renderChapterRow(c)).join('') : `<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px">
                    <div class="spinner-inline"></div>
                    <div style="margin-top:8px">Chargement des chapitres…</div>
                </div>`}
            </div>
        </div>`;
        el.querySelectorAll('[data-goto="chapitres"]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.preventDefault();
                activeTab = 'chapitres';
                document.querySelectorAll('.serie-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'chapitres'));
                renderTab('chapitres');
            });
        });
    }

    function renderChapterRow(c) {
        const isRead = readChapsSet.has(c.id);
        return `
        <a href="chapitre.html?manga=${encodeURIComponent(manga.id)}&chapter=${encodeURIComponent(c.id)}" class="chapter-row${isRead ? ' chapter-row--read' : ''}">
            <div class="chapter-num">Chap. ${c.chapter}</div>
            <div class="chapter-title-text">${MH.esc(c.title || 'Chapitre ' + c.chapter)}</div>
            <div class="chapter-meta">
                <span class="chapter-date">${c.publishedAt ? new Date(c.publishedAt).toLocaleDateString('fr-FR') : ''}</span>
                <span class="chapter-time">${c.pages ? c.pages + ' p.' : ''}</span>
                <span class="chapter-time">${(c.lang || '').toUpperCase()}</span>
                <span class="chapter-read-dot ${isRead ? 'is-read' : ''}" title="${isRead ? 'Lu' : 'Non lu'}"></span>
            </div>
        </a>`;
    }

    // ── CHAPITRES ──
    function renderChapitres(el) {
        if (!chapters.length) {
            el.innerHTML = `
            <div class="chapters-block">
                <div class="chapters-block-header"><div class="chapters-block-title">Tous les chapitres</div></div>
                <div class="chapters-list">
                    <div style="padding:20px;text-align:center;color:var(--text3);font-size:13px">
                        <div class="spinner-inline"></div>
                        <div style="margin-top:8px">Chargement des chapitres…</div>
                    </div>
                </div>
            </div>`;
            return;
        }

        el.innerHTML = `
        <div class="chapters-block">
            <div class="chapters-block-header">
                <div class="chapters-block-title">Tous les chapitres · <span id="chapCount">${chapters.length}</span></div>
                <div class="chapters-controls">
                    <input type="text" id="chapSearch" class="chap-search-input" placeholder="Chercher un chapitre…">
                    <button class="chap-sort-btn" id="chapSortBtn">${chapSortAsc ? '↑ Ancien' : '↓ Récent'}</button>
                </div>
            </div>
            <div class="chapters-list" id="chapsList"></div>
        </div>`;

        const input   = el.querySelector('#chapSearch');
        const sortBtn = el.querySelector('#chapSortBtn');
        const list    = el.querySelector('#chapsList');
        const countEl = el.querySelector('#chapCount');

        function render() {
            const q = chapFilter.toLowerCase();
            let filtered = chapters.filter(c =>
                !q || String(c.chapter).includes(q) || (c.title || '').toLowerCase().includes(q)
            );
            if (chapSortAsc) filtered = [...filtered].reverse();
            if (countEl) countEl.textContent = filtered.length;
            list.innerHTML = filtered.map(c => renderChapterRow(c)).join('') || '<div class="chapters-empty">Aucun chapitre trouvé</div>';
        }

        if (input) {
            input.value = chapFilter;
            input.addEventListener('input', () => { chapFilter = input.value; render(); });
        }
        if (sortBtn) {
            sortBtn.addEventListener('click', () => {
                chapSortAsc = !chapSortAsc;
                sortBtn.textContent = chapSortAsc ? '↑ Ancien' : '↓ Récent';
                render();
            });
        }
        render();
    }

    // ── SIDEBAR ──
    function renderSidebar() {
        const el = document.getElementById('serieSidebar');
        if (!el) return;
        const chapRead = readChapsSet.size;
        const total = chapters.length || parseInt(manga.lastChapter) || 1;
        const pct = Math.min(100, Math.round((chapRead / total) * 100));
        const resumeChap = progress?.chapterId || chapters[chapters.length - 1]?.id;

        el.innerHTML = `
        <div class="sidebar-progress">
            <div class="sidebar-progress-header"><div class="sidebar-progress-title">Ma progression</div></div>
            <div class="progress-stat">
                <span class="progress-label">Chapitres lus</span>
                <span class="progress-val">${chapRead} / ${total}</span>
            </div>
            <div class="progress-bar-big"><div class="progress-fill" style="width:${pct}%"></div></div>
            ${resumeChap ? `<button class="btn btn-primary sidebar-resume-btn" id="sidebarResumeBtn">
                ${chapRead > 0 ? '↻ Reprendre' : '▶ Commencer'}
            </button>` : ''}
        </div>

        <!-- Notes -->
        <div class="sidebar-rating card" id="ratingCard" style="padding:14px">
            <div class="sidebar-block-header"><span class="sidebar-block-title">Note</span></div>
            <div id="ratingBody" style="margin-top:8px;color:var(--text3);font-size:12.5px">Chargement…</div>
        </div>

        <div class="sidebar-tags card" style="padding:14px">
            <div class="sidebar-block-header"><span class="sidebar-block-title">Tags</span></div>
            <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:8px">
                ${(manga.tags || []).map(t =>
                    `<a href="catalogue.html?q=${encodeURIComponent(t)}" class="tag tag-link">${MH.esc(t)}</a>`
                ).join('')}
            </div>
        </div>`;

        document.getElementById('sidebarResumeBtn')?.addEventListener('click', () => {
            if (resumeChap) window.location.href = `chapitre.html?manga=${encodeURIComponent(manga.id)}&chapter=${encodeURIComponent(resumeChap)}`;
        });

        renderRating();
    }

    // ── NOTES / RATINGS ──
    async function renderRating() {
        const body = document.getElementById('ratingBody');
        if (!body) return;
        let data = { average: null, count: 0, mine: null };
        try { data = await API.ratings.get(manga.id); } catch (e) {}

        const myStars = data.mine?.rating || 0;
        const avgTxt = data.average != null
            ? `<strong style="color:var(--text);font-size:15px">${data.average.toFixed(1)}</strong>/5 · ${MH.fmt(data.count)} note${data.count > 1 ? 's' : ''}`
            : 'Aucune note pour l\'instant';

        body.innerHTML = `
            <div style="margin-bottom:10px">${avgTxt}</div>
            <div class="rate-stars" style="display:flex;gap:4px;font-size:24px;line-height:1">
                ${[1,2,3,4,5].map(n => `<span class="rate-star" data-n="${n}" style="cursor:pointer;color:${n <= myStars ? '#f59e0b' : 'var(--bg4)'}">★</span>`).join('')}
            </div>
            <div style="font-size:11px;color:var(--text3);margin-top:6px">${API.isLoggedIn() ? (myStars ? 'Ta note · clique pour changer' : 'Clique une étoile pour noter') : 'Connecte-toi pour noter'}</div>`;

        if (!API.isLoggedIn()) return;

        const stars = [...body.querySelectorAll('.rate-star')];
        const paint = (n) => stars.forEach(s => s.style.color = (+s.dataset.n <= n) ? '#f59e0b' : 'var(--bg4)');
        stars.forEach(s => {
            s.addEventListener('mouseenter', () => paint(+s.dataset.n));
            s.addEventListener('mouseleave', () => paint(myStars));
            s.addEventListener('click', async () => {
                const n = +s.dataset.n;
                try {
                    await API.ratings.set(manga.id, { rating: n });
                    MH.toast(`Noté ${n}/5 ⭐`);
                    renderRating();
                } catch (e) { MH.toast('Erreur : ' + e.message); }
            });
        });
    }
})();
