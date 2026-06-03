// chapitre.js — Lecteur de chapitre dynamique (vraies pages MangaDex)
(function () {
    'use strict';

    let manga        = null;
    let chapters     = [];      // tous les chapitres du manga, triés desc
    let currentChap  = null;    // chapitre courant
    let pages        = [];      // [{ url, urlSaver }]
    let currentPage  = 1;
    let totalPages   = 0;
    let zoom         = 100;
    let readMode     = 'page';

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('chapitre');
        const params    = new URLSearchParams(location.search);
        const mangaId   = params.get('manga');
        const chapterId = params.get('chapter');
        const src       = params.get('source');
        if (src && API.sources.current !== src) API.sources.current = src; // contexte multi-sources

        if (!mangaId || !chapterId) {
            showError('Lien invalide.');
            return;
        }

        // Préférences UI
        const prefs = window.Storage?.getPrefs() || {};
        if (prefs.readMode) readMode = prefs.readMode;
        if (prefs.zoom)     zoom     = prefs.zoom;

        showLoader('Chargement…');

        try {
            // Récupère manga + chapitres + pages en parallèle
            const [m, chapsData, pagesData] = await Promise.all([
                API.mangas.get(mangaId),
                API.mangas.chapters(mangaId, { lang: 'fr,en', limit: 500 }),
                API.mangas.pages(chapterId),
            ]);
            manga    = m;
            chapters = chapsData.results || [];
            currentChap = chapters.find(c => c.id === chapterId);
            if (!currentChap) {
                // Fallback : objet minimal
                currentChap = { id: chapterId, chapter: '?', pages: pagesData.pages?.length || 0 };
            }
            pages = pagesData.pages || [];
            totalPages = pages.length;

            document.getElementById('pageTitle').textContent =
                `${manga.title} — Chap. ${currentChap.chapter}`;

            // Reprise à la page sauvegardée
            if (API.isLoggedIn()) {
                try {
                    const allProg = await API.me.progress();
                    const prog = allProg[manga.id];
                    if (prog && prog.chapterId === chapterId && prog.page > 1) {
                        currentPage = Math.min(prog.page, totalPages);
                    }
                } catch(e) {}
            }

            renderToolbar();
            renderModebar();
            renderPage(currentPage);
            renderThumbnails();
            renderNavigation();
            renderNextChapter();
            renderDetails();
            bindKeyboard();
            saveProgress();
        } catch (e) {
            showError('Impossible de charger le chapitre : ' + e.message);
        }
    });

    // ── UI Loaders / Errors ──
    function showLoader(msg) {
        const el = document.getElementById('readerPagesArea');
        if (!el) return;
        el.innerHTML = `<div class="reader-loading">
            <div class="reader-loading-spinner"></div>
            <div class="reader-loading-info">${MH.esc(msg)}</div>
        </div>`;
    }
    function showError(msg) {
        const el = document.getElementById('readerPagesArea');
        if (!el) return;
        el.innerHTML = `<div class="reader-unavailable">
            <div class="reader-unavail-icon"></div>
            <div class="reader-unavail-msg">${MH.esc(msg)}</div>
            <div class="reader-unavail-actions">
                <a href="javascript:history.back()" class="btn btn-ghost btn-sm">↩ Retour</a>
                <a href="accueil.html" class="btn btn-primary btn-sm">Accueil</a>
            </div>
        </div>`;
    }

    // ── Toolbar ──
    function renderToolbar() {
        const el = document.getElementById('readerToolbar');
        if (!el) return;
        const asc      = [...chapters].sort((a, b) => a.chapter - b.chapter);
        const curIdx   = asc.findIndex(c => c.id === currentChap.id);
        const prevChap = curIdx > 0 ? asc[curIdx - 1] : null;
        const nextChap = curIdx < asc.length - 1 ? asc[curIdx + 1] : null;

        el.innerHTML = `
        <div class="toolbar-left">
            <a href="serie.html?id=${encodeURIComponent(manga.id)}" class="toolbar-back">← ${MH.esc(manga.title)}</a>
            <span class="toolbar-sep">/</span>
            <span class="toolbar-chap">Chap. ${currentChap.chapter}</span>
        </div>
        <div class="toolbar-center">
            <button class="reader-icon-btn" ${!prevChap ? 'disabled' : ''} id="btnPrevChap">‹</button>
            <select class="reader-chap-select" id="chapSelect">
                ${asc.slice().reverse().map(c =>
                    `<option value="${c.id}" ${c.id === currentChap.id ? 'selected' : ''}>Chap. ${c.chapter}${c.title ? ' — ' + c.title : ''}</option>`
                ).join('')}
            </select>
            <button class="reader-icon-btn" ${!nextChap ? 'disabled' : ''} id="btnNextChap">›</button>
        </div>
        <div class="toolbar-right">
            <button class="reader-icon-btn" onclick="window.changeZoom(-10)" title="Zoom −">−</button>
            <span class="reader-zoom-label" id="zoomLabel">${zoom}%</span>
            <button class="reader-icon-btn" onclick="window.changeZoom(10)" title="Zoom +">+</button>
            <button class="reader-icon-btn" onclick="window.toggleFullscreen()" title="Plein écran"></button>
        </div>`;

        document.getElementById('chapSelect')?.addEventListener('change', e => {
            window.location.href = `chapitre.html?manga=${encodeURIComponent(manga.id)}&chapter=${encodeURIComponent(e.target.value)}`;
        });
        document.getElementById('btnPrevChap')?.addEventListener('click', () => {
            if (prevChap) window.location.href = `chapitre.html?manga=${encodeURIComponent(manga.id)}&chapter=${encodeURIComponent(prevChap.id)}`;
        });
        document.getElementById('btnNextChap')?.addEventListener('click', () => {
            if (nextChap) window.location.href = `chapitre.html?manga=${encodeURIComponent(manga.id)}&chapter=${encodeURIComponent(nextChap.id)}`;
        });
    }

    // ── Modebar ──
    function renderModebar() {
        const el = document.getElementById('readerModebar');
        if (!el) return;
        const modes = [
            { id: 'page',   label: 'Page/page' },
            { id: 'scroll', label: '↕ Défilement' },
            { id: 'double', label: 'Double' },
        ];
        el.innerHTML = modes.map(m => `
            <button class="modebar-btn ${m.id === readMode ? 'active' : ''}" data-mode="${m.id}">${m.label}</button>`
        ).join('') + `<span class="modebar-info">
            ${totalPages} pages · <span class="modebar-pct">0% lu</span>
        </span>`;
        el.addEventListener('click', e => {
            const btn = e.target.closest('[data-mode]');
            if (!btn) return;
            readMode = btn.dataset.mode;
            window.Storage?.setPref('readMode', readMode);
            el.querySelectorAll('.modebar-btn').forEach(b => b.classList.toggle('active', b === btn));
            renderPage(currentPage);
        });
    }

    // ── Rendering pages ──
    function pageSrc(p) {
        const quality = window.Storage?.getPref('quality') || 'high';
        return quality === 'saver' ? (p.urlSaver || p.url) : p.url;
    }

    function renderPage(num) {
        const el = document.getElementById('readerPagesArea');
        if (!el) return;
        if (readMode === 'scroll') return renderScroll();
        if (readMode === 'double') return renderDouble(num);

        const p = pages[num - 1];
        if (!p) return;
        el.innerHTML = `
        <div class="page-zone-prev" onclick="window.goToPage(${num - 1})"><div class="page-zone-arrow">‹</div></div>
        <div class="page-zone-next" onclick="window.goToPage(${num + 1})"><div class="page-zone-arrow">›</div></div>
        <div class="reader-page-wrapper" style="transform:scale(${zoom/100});transform-origin:top center">
            <img class="reader-page-img" src="${pageSrc(p)}" alt="Page ${num}"
                 onerror="this.src='${p.urlSaver || ''}'" loading="eager">
        </div>
        <div class="page-counter-badge">Page <strong>${num}</strong> / ${totalPages}</div>`;

        updateUIPage(num);
    }

    function renderScroll() {
        const el = document.getElementById('readerPagesArea');
        if (!el) return;
        el.innerHTML = `
        <div class="reader-page-wrapper" style="display:flex;flex-direction:column;gap:6px;transform:scale(${zoom/100});transform-origin:top center">
            ${pages.map((p, i) => `
                <img class="reader-page-img" data-page="${i+1}" src="${pageSrc(p)}" alt="Page ${i+1}"
                     onerror="this.src='${p.urlSaver || ''}'" loading="${i < 3 ? 'eager' : 'lazy'}">
            `).join('')}
        </div>
        <div class="page-counter-badge"><strong>${totalPages}</strong> pages — défilement</div>`;

        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver(entries => {
                entries.forEach(en => {
                    if (en.isIntersecting) {
                        const p = +en.target.dataset.page;
                        if (p > currentPage) { currentPage = p; updateUIPage(p); }
                    }
                });
            }, { threshold: 0.5 });
            el.querySelectorAll('[data-page]').forEach(img => io.observe(img));
        }
        updateUIPage(currentPage);
    }

    function renderDouble(num) {
        const el = document.getElementById('readerPagesArea');
        if (!el) return;
        const left  = pages[num - 1];
        const right = pages[num];
        if (!left) return;
        el.innerHTML = `
        <div class="page-zone-prev" onclick="window.goToPage(${num - 2})"><div class="page-zone-arrow">‹</div></div>
        <div class="page-zone-next" onclick="window.goToPage(${num + 2})"><div class="page-zone-arrow">›</div></div>
        <div class="reader-page-wrapper" style="display:flex;gap:6px;transform:scale(${zoom/100});transform-origin:top center">
            <img class="reader-page-img" src="${pageSrc(left)}" alt="P${num}" onerror="this.src='${left.urlSaver || ''}'" style="max-width:48%">
            ${right ? `<img class="reader-page-img" src="${pageSrc(right)}" alt="P${num+1}" onerror="this.src='${right.urlSaver || ''}'" style="max-width:48%">` : ''}
        </div>
        <div class="page-counter-badge">Pages <strong>${num}${right ? '–' + (num+1) : ''}</strong> / ${totalPages}</div>`;
        updateUIPage(right ? num + 1 : num);
    }

    function updateUIPage(p) {
        document.querySelectorAll('.reader-thumb').forEach((t, i) => t.classList.toggle('active', i + 1 === p));
        document.querySelector('.reader-thumb.active')?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        const pct = document.querySelector('.modebar-pct');
        if (pct) pct.textContent = `${Math.round((p / totalPages) * 100)}% lu`;
        renderNavigation();

        // Sauvegarde progression (debounce)
        if (p === totalPages && API.isLoggedIn()) markChapterRead();
        debouncedSave(p);
    }

    let saveTimer;
    function debouncedSave(p) {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            currentPage = p;
            saveProgress();
        }, 400);
    }

    async function saveProgress() {
        if (!API.isLoggedIn() || !manga || !currentChap) return;
        try {
            await API.me.setProgress(manga.id, {
                chapterId: currentChap.id,
                chapter:   currentChap.chapter,
                page:      currentPage,
            });
        } catch(e) { /* silencieux */ }
    }

    async function markChapterRead() {
        if (!API.isLoggedIn() || !manga || !currentChap) return;
        try {
            await API.me.markChapter({
                mangaId:   manga.id,
                chapterId: currentChap.id,
                chapter:   currentChap.chapter,
                read:      true,
            });
        } catch(e) {}
    }

    // ── Miniatures ──
    function renderThumbnails() {
        const el = document.getElementById('readerThumbnails');
        if (!el) return;
        el.innerHTML = pages.map((p, i) => `
            <div class="reader-thumb ${i + 1 === currentPage ? 'active' : ''}" data-page="${i + 1}" onclick="window.goToPage(${i + 1})">
                <img src="${p.urlSaver || p.url}" alt="p${i+1}" loading="lazy">
                <div class="reader-thumb-num">${i + 1}</div>
            </div>`).join('');
    }

    // ── Navigation ──
    function renderNavigation() {
        const el = document.getElementById('readerNavigation');
        if (!el) return;
        el.innerHTML = `
        <button class="reader-nav-btn" onclick="window.goToPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>← Précédent</button>
        <div class="reader-nav-center">
            <div class="reader-nav-page">Page <strong>${currentPage}</strong> / ${totalPages}</div>
            <div class="reader-shortcuts">
                <span class="shortcut-key">← →</span> pages &nbsp;
                <span class="shortcut-key">F</span> plein écran &nbsp;
                <span class="shortcut-key">+/−</span> zoom
            </div>
        </div>
        <button class="reader-nav-btn" onclick="window.goToPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>Suivant →</button>`;
    }

    // ── Next chapter ──
    function renderNextChapter() {
        const el = document.getElementById('readerNextChapter');
        if (!el) return;
        const asc = [...chapters].sort((a, b) => a.chapter - b.chapter);
        const idx = asc.findIndex(c => c.id === currentChap.id);
        const next = idx >= 0 && idx < asc.length - 1 ? asc[idx + 1] : null;
        if (!next) { el.innerHTML = ''; return; }
        el.innerHTML = `
        <div class="reader-next-chapter">
            <div class="next-chapter-cover">
                <img src="${manga.coverThumb || manga.cover || ''}" alt="" loading="lazy">
            </div>
            <div class="next-chapter-info">
                <div class="next-chapter-label">À suivre</div>
                <div class="next-chapter-title">Chapitre ${next.chapter}${next.title ? ' — ' + MH.esc(next.title) : ''}</div>
            </div>
            <a href="chapitre.html?manga=${encodeURIComponent(manga.id)}&chapter=${encodeURIComponent(next.id)}" class="btn btn-primary">Lire →</a>
        </div>`;
    }

    function renderDetails() {
        const el = document.getElementById('readerDetails');
        if (!el) return;
        el.innerHTML = `
        <div class="reader-details-block">
            <div class="reader-block-title">Détails</div>
            <div class="detail-tags">
                ${(manga.tags || []).slice(0, 8).map(g => `<span class="tag" style="font-size:10.5px;padding:2px 8px">${MH.esc(g)}</span>`).join('')}
            </div>
            <div class="detail-summary"><strong>Synopsis :</strong><br>${MH.esc(manga.description || '')}</div>
        </div>`;
    }

    // ── Controls globaux ──
    window.goToPage = function (p) {
        if (!pages.length || p < 1 || p > totalPages) return;
        currentPage = p;
        renderPage(currentPage);
        document.getElementById('readerPagesArea')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    window.changeZoom = function (delta) {
        zoom = Math.min(200, Math.max(50, zoom + delta));
        const label = document.getElementById('zoomLabel');
        if (label) label.textContent = `${zoom}%`;
        const wrapper = document.querySelector('.reader-page-wrapper');
        if (wrapper) wrapper.style.transform = `scale(${zoom / 100})`;
        window.Storage?.setPref('zoom', zoom);
    };

    window.toggleFullscreen = function () {
        if (!document.fullscreenElement) document.documentElement.requestFullscreen?.().catch(() => {});
        else document.exitFullscreen?.();
    };

    function bindKeyboard() {
        document.addEventListener('keydown', e => {
            if (['TEXTAREA','INPUT','SELECT'].includes(e.target.tagName)) return;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') window.goToPage(currentPage + 1);
            if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   window.goToPage(currentPage - 1);
            if (e.key === 'f' || e.key === 'F')                  window.toggleFullscreen();
            if (e.key === '+' || e.key === '=')                  window.changeZoom(10);
            if (e.key === '-')                                    window.changeZoom(-10);
        });
    }
})();
