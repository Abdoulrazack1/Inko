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

    // ── Réglages lecteur (persistés) ──
    const rs = { bg: 'dark', brightness: 100, gap: 8, fit: 'original', direction: 'rtl' };
    function loadReaderSettings() {
        ['bg', 'brightness', 'gap', 'fit', 'direction'].forEach(k => {
            const v = window.Storage?.getPref('reader_' + k);
            if (v !== undefined && v !== null && v !== '') rs[k] = v;
        });
        rs.brightness = +rs.brightness || 100;
        rs.gap = +rs.gap; if (isNaN(rs.gap)) rs.gap = 8;
    }
    const READER_BG = { dark: '#0d0d0f', black: '#000000', gray: '#26262b', sepia: '#f1e7d0', light: '#ffffff' };

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
        loadReaderSettings();
        if (prefs.readingDir) rs.direction = prefs.readingDir;

        showLoader('Chargement…');

        try {
            // Récupère manga + chapitres + pages en parallèle (repli hors-ligne si échec)
            let m, chapsData, pagesData;
            try {
                [m, chapsData, pagesData] = await Promise.all([
                    API.mangas.get(mangaId),
                    API.mangas.chapters(mangaId, { lang: 'fr,en', limit: 500 }),
                    API.mangas.pages(chapterId),
                ]);
            } catch (netErr) {
                const dl = window.Downloads ? await window.Downloads.get(chapterId) : null;
                if (!dl) throw netErr;
                m = { id: mangaId, title: dl.mangaTitle || 'Chapitre', cover: dl.cover, coverThumb: dl.cover, tags: [], description: '', status: null, langs: [] };
                chapsData = { results: [{ id: chapterId, chapter: dl.chapterNum }] };
                pagesData = { pages: (dl.pages || []).map(u => ({ url: u })) };
                MH.toast?.('Lecture hors-ligne');
            }
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
            applyReaderSettings();
            renderPage(currentPage);
            renderThumbnails();
            renderNavigation();
            renderNextChapter();
            renderDetails();
            bindKeyboard();
            saveProgress();
            preloadNextChapter();
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
            <button class="reader-icon-btn" id="btnMarkRead" title="Marquer ce chapitre (et les précédents) comme lus">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="17" height="17"><path d="M20 6 9 17l-5-5"/></svg>
            </button>
            <button class="reader-icon-btn" id="btnDownload" title="Télécharger pour lire hors-ligne"></button>
            <button class="reader-icon-btn" onclick="window.changeZoom(-10)" title="Zoom −">−</button>
            <span class="reader-zoom-label" id="zoomLabel">${zoom}%</span>
            <button class="reader-icon-btn" onclick="window.changeZoom(10)" title="Zoom +">+</button>
            <button class="reader-icon-btn" onclick="window.toggleFullscreen()" title="Plein écran">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
            </button>
            <button class="reader-icon-btn" id="btnReaderSettings" title="Réglages du lecteur">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="17" height="17"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
        </div>`;

        document.getElementById('btnReaderSettings')?.addEventListener('click', toggleReaderSettings);
        document.getElementById('btnMarkRead')?.addEventListener('click', markUpToHere);
        wireDownloadBtn();
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
        const leftTarget  = rs.direction === 'rtl' ? num + 1 : num - 1;
        const rightTarget = rs.direction === 'rtl' ? num - 1 : num + 1;
        el.innerHTML = `
        <div class="page-zone-prev" onclick="window.goToPage(${leftTarget})"><div class="page-zone-arrow">‹</div></div>
        <div class="page-zone-next" onclick="window.goToPage(${rightTarget})"><div class="page-zone-arrow">›</div></div>
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
        <div class="reader-page-wrapper" style="display:flex;flex-direction:column;gap:${rs.gap}px;transform:scale(${zoom/100});transform-origin:top center">
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
        <div class="reader-page-wrapper" style="display:flex;gap:${rs.gap}px;transform:scale(${zoom/100});transform-origin:top center">
            <img class="reader-page-img" src="${pageSrc(left)}" alt="P${num}" onerror="this.src='${left.urlSaver || ''}'" style="max-width:48%">
            ${right ? `<img class="reader-page-img" src="${pageSrc(right)}" alt="P${num+1}" onerror="this.src='${right.urlSaver || ''}'" style="max-width:48%">` : ''}
        </div>
        <div class="page-counter-badge">Pages <strong>${num}${right ? '–' + (num+1) : ''}</strong> / ${totalPages}</div>`;
        updateUIPage(right ? num + 1 : num);
    }

    function updateUIPage(p) {
        preloadPage(p + 1); preloadPage(p + 2);   // précharge les pages suivantes
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

    function neighborChapter(delta) {
        const asc = [...chapters].sort((a, b) => a.chapter - b.chapter);
        const idx = asc.findIndex(c => c.id === currentChap.id);
        const t = idx + delta;
        return (t >= 0 && t < asc.length) ? asc[t] : null;
    }
    function goChapter(delta) {
        const c = neighborChapter(delta);
        if (c) window.location.href = `chapitre.html?manga=${encodeURIComponent(manga.id)}&chapter=${encodeURIComponent(c.id)}&source=${encodeURIComponent(API.sources.current)}`;
    }

    function bindKeyboard() {
        document.addEventListener('keydown', e => {
            if (['TEXTAREA', 'INPUT', 'SELECT'].includes(e.target.tagName)) return;
            const rtl = rs.direction === 'rtl';
            // Touches globales (tous modes)
            switch (e.key) {
                case 'n': case 'N': goChapter(1); return;
                case 'p': case 'P': goChapter(-1); return;
                case 'f': case 'F': window.toggleFullscreen(); return;
                case '+': case '=': window.changeZoom(10); return;
                case '-': window.changeZoom(-10); return;
                case 's': case 'S': case '?': case 'h': case 'H': toggleReaderSettings(); return;
                case 'Escape': if (document.getElementById('readerSettings')) toggleReaderSettings(); return;
            }
            // En défilement : on laisse le scroll natif
            if (readMode === 'scroll') return;
            switch (e.key) {
                case 'ArrowRight': window.goToPage(currentPage + (rtl ? -1 : 1)); break;
                case 'ArrowLeft':  window.goToPage(currentPage + (rtl ? 1 : -1)); break;
                case ' ': case 'ArrowDown': e.preventDefault(); window.goToPage(currentPage + 1); break;
                case 'ArrowUp': window.goToPage(currentPage - 1); break;
                case 'Home': window.goToPage(1); break;
                case 'End':  window.goToPage(totalPages); break;
            }
        });
    }

    // ── Réglages lecteur : application + panneau ──
    function applyReaderSettings() {
        const wrap = document.getElementById('readerViewerWrap');
        if (wrap) {
            wrap.style.background = READER_BG[rs.bg] || READER_BG.dark;
            wrap.classList.toggle('reader-onlight', rs.bg === 'light' || rs.bg === 'sepia');
            wrap.classList.remove('fit-width', 'fit-height', 'fit-original');
            wrap.classList.add('fit-' + rs.fit);
        }
        let dim = document.getElementById('readerDim');
        if (!dim) {
            dim = document.createElement('div');
            dim.id = 'readerDim';
            dim.style.cssText = 'position:fixed;inset:0;background:#000;pointer-events:none;z-index:75;transition:opacity .2s';
            document.body.appendChild(dim);
        }
        dim.style.opacity = String(Math.max(0, (100 - rs.brightness) / 100 * 0.72));
    }

    function saveReaderSetting(key, val, rerender) {
        rs[key] = val;
        window.Storage?.setPref('reader_' + key, val);
        applyReaderSettings();
        if (rerender) renderPage(currentPage);
    }

    function toggleReaderSettings() {
        const ex = document.getElementById('readerSettings');
        if (ex) { ex.remove(); return; }
        const panel = document.createElement('div');
        panel.id = 'readerSettings';
        panel.className = 'reader-settings-pop';
        const seg = (key, opts, cur) => `<div class="rs-seg" data-key="${key}">` +
            opts.map(o => `<button data-val="${o.v}" class="${cur == o.v ? 'on' : ''}">${o.l}</button>`).join('') + `</div>`;
        const q = window.Storage?.getPref('quality') || 'high';
        panel.innerHTML = `
            <div class="rs-head"><span>Réglages du lecteur</span><button class="rs-close" id="rsClose">✕</button></div>
            <label class="rs-label">Fond</label>
            ${seg('bg', [{v:'dark',l:'Sombre'},{v:'black',l:'Noir'},{v:'gray',l:'Gris'},{v:'sepia',l:'Sépia'},{v:'light',l:'Clair'}], rs.bg)}
            <label class="rs-label">Ajustement</label>
            ${seg('fit', [{v:'original',l:'Original'},{v:'width',l:'Largeur'},{v:'height',l:'Hauteur'}], rs.fit)}
            <label class="rs-label">Sens de lecture</label>
            ${seg('direction', [{v:'rtl',l:'← RTL'},{v:'ltr',l:'LTR →'}], rs.direction)}
            <label class="rs-label">Luminosité <span id="rsBrightVal">${rs.brightness}%</span></label>
            <input type="range" id="rsBright" min="40" max="100" value="${rs.brightness}" class="rs-range">
            <label class="rs-label">Écart entre pages <span id="rsGapVal">${rs.gap}px</span></label>
            <input type="range" id="rsGap" min="0" max="40" value="${rs.gap}" class="rs-range">
            <label class="rs-label">Qualité des images</label>
            ${seg('quality', [{v:'high',l:'Haute'},{v:'saver',l:'Éco'}], q)}
            <div class="rs-foot">
                <button class="btn btn-secondary btn-sm" id="rsMarkAll" style="width:100%">Marquer tout le manga comme lu</button>
                <div class="rs-shortcuts">← → pages · N/P chapitre · F plein écran · Espace page suivante · S réglages</div>
            </div>`;
        document.body.appendChild(panel);

        panel.querySelectorAll('.rs-seg').forEach(sg => {
            const key = sg.dataset.key;
            sg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
                sg.querySelectorAll('button').forEach(x => x.classList.remove('on'));
                b.classList.add('on');
                const val = b.dataset.val;
                if (key === 'quality') { window.Storage?.setPref('quality', val); renderPage(currentPage); renderThumbnails(); return; }
                saveReaderSetting(key, val, ['gap', 'fit', 'direction'].includes(key));
            }));
        });
        panel.querySelector('#rsBright').addEventListener('input', e => {
            document.getElementById('rsBrightVal').textContent = e.target.value + '%';
            saveReaderSetting('brightness', +e.target.value, false);
        });
        panel.querySelector('#rsGap').addEventListener('input', e => {
            document.getElementById('rsGapVal').textContent = e.target.value + 'px';
            saveReaderSetting('gap', +e.target.value, true);
        });
        panel.querySelector('#rsClose').addEventListener('click', toggleReaderSettings);
        panel.querySelector('#rsMarkAll').addEventListener('click', markAllManga);
    }

    // ── Marquer comme lu (en masse) ──
    async function bulkMark(items, msg) {
        if (!API.isLoggedIn()) { MH.toast?.('Connecte-toi pour suivre ta lecture'); return; }
        if (!items.length) return;
        try { await API.me.markChaptersBulk(manga.id, items); MH.toast?.(msg); }
        catch (e) { MH.toast?.('Erreur : ' + e.message); }
    }
    function markUpToHere() {
        const cur = parseFloat(currentChap.chapter);
        const items = chapters
            .filter(c => !isNaN(parseFloat(c.chapter)) && parseFloat(c.chapter) <= cur)
            .map(c => ({ chapterId: c.id, chapter: c.chapter }));
        bulkMark(items, `${items.length} chapitre(s) marqué(s) comme lus`);
    }
    function markAllManga() {
        const items = chapters.map(c => ({ chapterId: c.id, chapter: c.chapter }));
        bulkMark(items, 'Tout le manga marqué comme lu');
    }

    // ── Téléchargement hors-ligne ──
    function setDlIcon(done) {
        const btn = document.getElementById('btnDownload');
        if (!btn) return;
        btn.innerHTML = done
            ? '<svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M21.8 10A10 10 0 1 1 17 3.3"/><path d="m9 11 3 3L22 4"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></svg>';
        btn.title = done ? 'Téléchargé — cliquer pour supprimer' : 'Télécharger pour lire hors-ligne';
    }
    async function wireDownloadBtn() {
        const btn = document.getElementById('btnDownload');
        if (!btn) return;
        if (!window.Downloads) { btn.style.display = 'none'; return; }
        setDlIcon(await window.Downloads.has(currentChap.id));
        btn.onclick = async () => {
            if (await window.Downloads.has(currentChap.id)) {
                await window.Downloads.remove(currentChap.id);
                setDlIcon(false); MH.toast?.('Téléchargement supprimé');
                return;
            }
            if (!pages.length) { MH.toast?.('Aucune page à télécharger'); return; }
            btn.disabled = true;
            try {
                await window.Downloads.download(
                    { mangaId: manga.id, chapterId: currentChap.id, chapterNum: currentChap.chapter,
                      mangaTitle: manga.title, cover: manga.cover || manga.coverThumb, source: API.sources.current },
                    pages,
                    (d, n) => { btn.innerHTML = `<span style="font-size:10px;font-weight:700">${Math.round(d / n * 100)}%</span>`; }
                );
                setDlIcon(true); MH.toast?.('Chapitre téléchargé pour le hors-ligne');
            } catch (e) { setDlIcon(false); MH.toast?.('Erreur : ' + e.message); }
            finally { btn.disabled = false; }
        };
    }

    // ── Préchargement ──
    function preloadPage(num) {
        const p = pages[num - 1];
        if (p) { const im = new Image(); im.src = pageSrc(p); }
    }
    function preloadNextChapter() {
        const next = neighborChapter(1);
        if (!next) return;
        API.mangas.pages(next.id).then(d => {
            const first = d.pages?.[0];
            if (first) { const im = new Image(); im.src = first.url; }
        }).catch(() => {});
    }
})();
