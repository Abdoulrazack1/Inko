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
    let doubleBase   = 1;       // 1re page de la planche affichée en mode double

    // ── Réglages lecteur (persistés) ──
    const rs = { bg: 'dark', brightness: 100, gap: 8, fit: 'original', direction: 'rtl', autospeed: 1.4, warm: 0 };
    function loadReaderSettings() {
        ['bg', 'brightness', 'gap', 'fit', 'direction', 'autospeed', 'warm'].forEach(k => {
            const v = window.Storage?.getPref('reader_' + k);
            if (v !== undefined && v !== null && v !== '') rs[k] = v;
        });
        rs.brightness = +rs.brightness || 100;
        rs.gap = +rs.gap; if (isNaN(rs.gap)) rs.gap = 8;
        rs.autospeed = +rs.autospeed || 1.4;
        rs.warm = +rs.warm; if (isNaN(rs.warm)) rs.warm = 0;
    }
    let autoTimer = null;
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

        // Source de romans → lecteur texte (toutes les entrées passent par ici)
        try {
            const sources = await API.sources.list();
            const cur = (sources || []).find(s => s.id === API.sources.current);
            if (cur?.type === 'novel') { location.replace('lecture.html' + location.search); return; }
        } catch (e) { /* hors-ligne : on tente la lecture image */ }

        // Préférences UI — le mode de lecture est mémorisé PAR SÉRIE
        // (un webtoon se lit en défilement, un manga en page/page)
        const prefs = window.Storage?.getPrefs() || {};
        if (prefs.readMode) readMode = prefs.readMode;
        if (prefs['readMode_' + mangaId]) readMode = prefs['readMode_' + mangaId];
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
                    API.mangas.chapters(mangaId, { lang: window.Storage?.getPref('readingLang') || 'fr,en' }),
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

            doubleBase = currentPage;   // ancre de la planche double (reprise correcte)
            renderToolbar();
            renderModebar();
            applyReaderSettings();
            renderPage(currentPage);
            renderThumbnails();
            renderNavigation();
            renderNextChapter();
            renderDetails();
            bindKeyboard();
            bindWheel();
            applyInitialScroll();
            saveProgress();
            preloadNextChapter();
            requestWakeLock();
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
            <button class="reader-icon-btn" id="btnBookmark" title="Ajouter un signet sur cette page (B)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
            <button class="reader-icon-btn" id="btnImmersive" title="Mode immersif — masquer l'interface (I)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3"/></svg>
            </button>
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
            <button class="reader-icon-btn" id="btnAutoScroll" title="Défilement automatique (A)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="17" height="17"><path d="M12 5v14"/><path d="m6 13 6 6 6-6"/></svg>
            </button>
            <button class="reader-icon-btn" id="btnReaderSettings" title="Réglages du lecteur">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="17" height="17"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
        </div>`;

        document.getElementById('btnReaderSettings')?.addEventListener('click', toggleReaderSettings);
        document.getElementById('btnAutoScroll')?.addEventListener('click', toggleAutoScroll);
        document.getElementById('btnMarkRead')?.addEventListener('click', markUpToHere);
        document.getElementById('btnBookmark')?.addEventListener('click', toggleBookmark);
        document.getElementById('btnImmersive')?.addEventListener('click', toggleImmersive);
        refreshBookmarkBtn();
        wireDownloadBtn();
        updateAutoBtn();
        const chapURL = (id) => `chapitre.html?manga=${encodeURIComponent(manga.id)}&chapter=${encodeURIComponent(id)}&source=${encodeURIComponent(API.sources.current)}`;
        document.getElementById('chapSelect')?.addEventListener('change', e => { window.location.href = chapURL(e.target.value); });
        document.getElementById('btnPrevChap')?.addEventListener('click', () => { if (prevChap) window.location.href = chapURL(prevChap.id); });
        document.getElementById('btnNextChap')?.addEventListener('click', () => { if (nextChap) window.location.href = chapURL(nextChap.id); });
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
            window.Storage?.setPref('readMode', readMode);                  // défaut global
            window.Storage?.setPref('readMode_' + manga.id, readMode);     // mémorisé pour cette série
            el.querySelectorAll('.modebar-btn').forEach(b => b.classList.toggle('active', b === btn));
            if (readMode === 'double') doubleBase = currentPage;            // ancre la planche sur la page courante
            renderPage(currentPage);
            resetPagedScroll(1);
        });
    }

    // ── Rendering pages ──
    function pageSrc(p) {
        const quality = window.Storage?.getPref('quality') || 'high';
        return quality === 'saver' ? (p.urlSaver || p.url) : p.url;
    }

    // Markup d'une image de page : fade-in au chargement + retry en cas d'échec
    function pageImg(idx, extra = '', lazy = false) {
        const p = pages[idx];
        return `<img class="reader-page-img" data-idx="${idx}" src="${pageSrc(p)}" alt="Page ${idx + 1}"
                 onload="this.classList.add('loaded')" onerror="window.imgFail&&window.imgFail(this)"
                 decoding="async" loading="${lazy ? 'lazy' : 'eager'}" ${extra}>`;
    }
    // Les images déjà en cache peuvent être "complete" avant le binding
    function armImages(root) {
        (root || document).querySelectorAll('.reader-page-img').forEach(im => {
            if (im.complete && im.naturalWidth) im.classList.add('loaded');
        });
    }

    // Échec de chargement : bascule éco → sinon bouton Réessayer
    window.imgFail = function (img) {
        const p = pages[+img.dataset.idx];
        if (!p) return;
        if (!img.dataset.triedSaver && p.urlSaver && img.src !== p.urlSaver) {
            img.dataset.triedSaver = '1';
            img.src = p.urlSaver;
            return;
        }
        if (img.nextElementSibling?.classList.contains('reader-img-fail')) return;
        const div = document.createElement('div');
        div.className = 'reader-img-fail';
        div.innerHTML = `<div class="reader-img-fail-msg">Page ${+img.dataset.idx + 1} introuvable</div>
            <button class="btn btn-secondary btn-sm">Réessayer</button>`;
        div.querySelector('button').onclick = () => {
            delete img.dataset.triedSaver;
            div.remove();
            img.style.display = '';
            const url = pageSrc(p);
            img.src = ''; img.src = url;   // force un vrai re-fetch
        };
        img.style.display = 'none';
        img.after(div);
    };

    function renderPage(num) {
        const el = document.getElementById('readerPagesArea');
        if (!el) return;
        if (readMode === 'scroll') return renderScroll();
        if (readMode === 'double') return renderDouble(doubleBase || num);

        const p = pages[num - 1];
        if (!p) return;
        el.classList.add('paged');   // défilement interne quand la page dépasse l'écran
        const leftTarget  = rs.direction === 'rtl' ? num + 1 : num - 1;
        const rightTarget = rs.direction === 'rtl' ? num - 1 : num + 1;
        el.innerHTML = `
        <div class="page-zone-prev" onclick="window.goToPage(${leftTarget})"><div class="page-zone-arrow">‹</div></div>
        <div class="page-zone-next" onclick="window.goToPage(${rightTarget})"><div class="page-zone-arrow">›</div></div>
        <div class="reader-page-wrapper" style="transform:scale(${zoom/100});transform-origin:top center">
            ${pageImg(num - 1)}
        </div>
        <div class="page-counter-badge">Page <strong>${num}</strong> / ${totalPages}</div>`;

        armImages(el);
        updateUIPage(num);
    }

    function renderScroll() {
        const el = document.getElementById('readerPagesArea');
        if (!el) return;
        el.classList.remove('paged');   // défilement natif de la fenêtre (images empilées)
        el.innerHTML = `
        <div class="reader-page-wrapper" style="display:flex;flex-direction:column;gap:${rs.gap}px;transform:scale(${zoom/100});transform-origin:top center">
            ${pages.map((p, i) => pageImg(i, `data-page="${i+1}"`, i >= 3)).join('')}
        </div>
        <div class="page-counter-badge"><strong>${totalPages}</strong> pages — défilement</div>`;

        if ('IntersectionObserver' in window) {
            const io = new IntersectionObserver(entries => {
                entries.forEach(en => {
                    if (en.isIntersecting) {
                        // Suit la page visible (lecture avant ET retours arrière / sauts)
                        const p = +en.target.dataset.page;
                        if (p !== currentPage) { currentPage = p; updateUIPage(p); }
                    }
                });
            }, { threshold: 0.5 });
            el.querySelectorAll('[data-page]').forEach(img => io.observe(img));
        }
        armImages(el);
        updateUIPage(currentPage);
    }

    function renderDouble(num) {
        const el = document.getElementById('readerPagesArea');
        if (!el) return;
        if (num < 1) num = 1;
        doubleBase = num;              // ancre de la planche (navigation par 2)
        el.classList.add('paged');     // défilement interne si la planche dépasse l'écran
        const cur  = pages[num - 1];   // page courante (num)
        const next = pages[num];       // page suivante (num+1)
        if (!cur) return;
        const rtl = rs.direction === 'rtl';
        // Planche collée : en RTL la page la plus récente est à GAUCHE
        const curImg  = pageImg(num - 1);
        const nextImg = next ? pageImg(num) : '';
        const spread  = (rtl && next) ? (nextImg + curImg) : (curImg + nextImg);
        // Zones : gauche/droite = sens de lecture (clic = planche suivante/précédente)
        const leftStep  = rtl ? 1 : -1;   // en RTL, la gauche fait avancer
        const rightStep = rtl ? -1 : 1;
        el.innerHTML = `
        <div class="page-zone-prev" onclick="window.navStep(${leftStep})"><div class="page-zone-arrow">‹</div></div>
        <div class="page-zone-next" onclick="window.navStep(${rightStep})"><div class="page-zone-arrow">›</div></div>
        <div class="reader-page-wrapper reader-spread" style="transform:scale(${zoom/100});transform-origin:top center">
            ${spread}
        </div>
        <div class="page-counter-badge">Pages <strong>${num}${next ? '–' + (num+1) : ''}</strong> / ${totalPages}${rtl && next ? ' · sens →←' : ''}</div>`;
        armImages(el);
        updateUIPage(next ? num + 1 : num);
    }

    function updateUIPage(p) {
        currentPage = p;   // MAJ immédiate → l'affichage (numéro, barre) est toujours juste
        preloadPage(p + 1); preloadPage(p + 2); preloadPage(p + 3);   // précharge les pages suivantes
        document.querySelectorAll('.reader-thumb').forEach((t, i) => t.classList.toggle('active', i + 1 === p));
        centerActiveThumb();   // recentre la miniature SANS jamais bouger la fenêtre
        const pct = document.querySelector('.modebar-pct');
        if (pct) {
            const remaining = Math.max(0, totalPages - p);
            const secs = remaining * 8;   // ~8 s par page
            const tleft = secs >= 60 ? `${Math.round(secs / 60)} min` : `${secs} s`;
            pct.textContent = `${Math.round((p / totalPages) * 100)}% lu` + (remaining ? ` · ~${tleft}` : ' · terminé');
        }
        const fill = document.getElementById('readerProgressFill');
        if (fill) fill.style.width = `${(p / totalPages) * 100}%`;
        renderNavigation();

        // Sauvegarde progression (debounce)
        if (p === totalPages && API.isLoggedIn()) markChapterRead();
        debouncedSave();
    }

    // Recentre la miniature active dans SA bande horizontale uniquement
    // (ne touche jamais au scroll de la fenêtre → corrige les sauts de page)
    function centerActiveThumb() {
        const strip = document.getElementById('readerThumbnails');
        const thumb = strip?.querySelector('.reader-thumb.active');
        if (!strip || !thumb) return;
        const target = thumb.offsetLeft - (strip.clientWidth / 2) + (thumb.clientWidth / 2);
        strip.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
    }

    // Positionne la fenêtre au bon endroit à l'ouverture (corrige « ne démarre pas à la 1re page »)
    function applyInitialScroll() {
        if (readMode === 'scroll' && currentPage > 1) {
            // Reprise : on attend un court instant que les 1res images aient une hauteur
            setTimeout(() => {
                const img = document.querySelector(`.reader-page-img[data-page="${currentPage}"]`);
                if (img) img.scrollIntoView({ block: 'start' });
                else window.scrollTo(0, 0);
            }, 250);
        } else {
            window.scrollTo(0, 0);   // démarre toujours en haut (page 1 visible)
        }
    }

    let saveTimer;
    function debouncedSave() {
        clearTimeout(saveTimer);
        saveTimer = setTimeout(() => { saveProgress(); }, 400);   // currentPage déjà à jour
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
        // Synchro AniList (best-effort, silencieux)
        try {
            const n = parseFloat(currentChap.chapter);
            window.AniList?.syncByTitle(manga.title, { progress: isNaN(n) ? undefined : n, status: 'reading' });
        } catch (e) {}
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
        <button class="reader-nav-btn reader-nav-edge" onclick="window.goToPage(1)" ${currentPage <= 1 ? 'disabled' : ''} title="Première page (Début)">⤒</button>
        <button class="reader-nav-btn" onclick="window.goToPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>← Précédent</button>
        <div class="reader-nav-center">
            <div class="reader-nav-page">Page <strong>${currentPage}</strong> / ${totalPages}</div>
            <input type="range" class="reader-scrub" id="pageScrub" min="1" max="${totalPages}" value="${currentPage}"
                   style="${rs.direction === 'rtl' && readMode !== 'scroll' ? 'direction:rtl' : ''}"
                   title="Aller à la page…" aria-label="Aller à la page">
            <div class="reader-shortcuts">
                <span class="shortcut-key">← →</span> pages &nbsp;
                <span class="shortcut-key">B</span> signet &nbsp;
                <span class="shortcut-key">I</span> immersif &nbsp;
                <span class="shortcut-key">F</span> plein écran
            </div>
        </div>
        <button class="reader-nav-btn" onclick="window.goToPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>Suivant →</button>
        <button class="reader-nav-btn reader-nav-edge" onclick="window.goToPage(${totalPages})" ${currentPage >= totalPages ? 'disabled' : ''} title="Dernière page (Fin)">⤓</button>`;
        const scrub = el.querySelector('#pageScrub');
        if (scrub) scrub.addEventListener('input', () => window.goToPage(+scrub.value));
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
        if (!pages.length) return;
        // Avant la première page → chapitre précédent ; après la dernière → transition
        if (p < 1) { if (neighborChapter(-1)) showChapterTransition(-1); return; }
        if (p > totalPages) { showChapterTransition(1); return; }
        if (readMode === 'scroll') {
            // En défilement : on saute à l'image, sans tout re-rendre
            currentPage = p;
            const img = document.querySelector(`.reader-page-img[data-page="${p}"]`);
            if (img) { img.scrollIntoView({ behavior: 'smooth', block: 'start' }); updateUIPage(p); return; }
            return;
        }
        if (readMode === 'double') {
            // Affiche la planche commençant à p (utilisé par le scrub / miniatures)
            renderDouble(p);
            resetPagedScroll(1);
            return;
        }
        currentPage = p;
        renderPage(currentPage);
        resetPagedScroll(1);
    };

    // Avance/recule d'une UNITÉ de lecture (1 page, ou 1 planche en mode double)
    window.navStep = function (dir) {   // dir : +1 = suivant, -1 = précédent
        if (readMode === 'scroll') { window.goToPage(currentPage + dir); return; }
        if (readMode === 'double') {
            const target = doubleBase + dir * 2;
            if (target < 1) { if (neighborChapter(-1)) showChapterTransition(-1); return; }
            if (target > totalPages) { showChapterTransition(1); return; }
            renderDouble(target);
            resetPagedScroll(dir);
            return;
        }
        window.goToPage(currentPage + dir);
    };

    // Remet le défilement interne de la page en haut (ou en bas si retour arrière)
    function resetPagedScroll(dir) {
        const area = document.getElementById('readerPagesArea');
        if (!area) return;
        requestAnimationFrame(() => { area.scrollTop = dir < 0 ? area.scrollHeight : 0; });
    }

    // Molette / flèches verticales : défile DANS la page si elle dépasse, sinon tourne la page
    function scrollOrStep(dir) {
        const area = document.getElementById('readerPagesArea');
        if (!area) { window.navStep(dir); return; }
        const canScroll = area.scrollHeight > area.clientHeight + 2;
        const atBottom  = area.scrollTop + area.clientHeight >= area.scrollHeight - 2;
        const atTop     = area.scrollTop <= 2;
        if (canScroll && ((dir > 0 && !atBottom) || (dir < 0 && !atTop))) {
            area.scrollBy({ top: dir * area.clientHeight * 0.9, behavior: 'smooth' });
            return;
        }
        window.navStep(dir);
    }

    // Liaison molette (page/double) — défilement natif dans la page, tourne aux extrémités
    let wheelLock = 0;
    function bindWheel() {
        const area = document.getElementById('readerPagesArea');
        if (!area) return;
        area.addEventListener('wheel', (e) => {
            if (readMode === 'scroll') return;   // défilement natif des images empilées
            const down = e.deltaY > 0;
            const canScroll = area.scrollHeight > area.clientHeight + 2;
            const atBottom  = area.scrollTop + area.clientHeight >= area.scrollHeight - 2;
            const atTop     = area.scrollTop <= 2;
            // Page haute non terminée → on laisse le défilement natif
            if (canScroll && ((down && !atBottom) || (!down && !atTop))) return;
            // Sinon (extrémité atteinte, ou page qui tient à l'écran) → on tourne la page
            e.preventDefault();
            const now = Date.now();
            if (now - wheelLock < 360) return;   // anti-rebond (1 cran = 1 page)
            wheelLock = now;
            window.navStep(down ? 1 : -1);
        }, { passive: false });
    }

    // Re-render selon le mode courant (utilisé après changement de réglage)
    function rerender() {
        if (readMode === 'scroll') renderScroll();
        else if (readMode === 'double') renderDouble(doubleBase);
        else renderPage(currentPage);
    }

    // ── Transition de fin/début de chapitre (façon Mihon) ──
    function showChapterTransition(delta) {
        const target = neighborChapter(delta);
        const ex = document.getElementById('chapTransition');
        if (ex) { // déjà affichée → confirme
            if (target) goChapter(delta);
            return;
        }
        if (delta > 0 && API.isLoggedIn()) markChapterRead();
        const ov = document.createElement('div');
        ov.id = 'chapTransition';
        ov.className = 'chap-transition';
        ov.innerHTML = `
            <div class="chap-transition-card">
                <div class="chap-transition-label">${delta > 0 ? 'Fin du chapitre' : 'Début du chapitre'} ${MH.esc(String(currentChap.chapter))}</div>
                ${target ? `
                    <div class="chap-transition-next">${delta > 0 ? 'À suivre' : 'Précédent'} : <strong>Chapitre ${MH.esc(String(target.chapter))}</strong>${target.title ? ' — ' + MH.esc(target.title) : ''}</div>
                    <div class="chap-transition-actions">
                        <button class="btn btn-primary" id="ctGo">${delta > 0 ? 'Chapitre suivant →' : '← Chapitre précédent'}</button>
                        <button class="btn btn-ghost btn-sm" id="ctStay">Rester ici</button>
                    </div>
                    <div class="chap-transition-hint">Appuie encore sur ${delta > 0 ? '→' : '←'} pour continuer</div>
                ` : `
                    <div class="chap-transition-next">${delta > 0 ? "C'est le dernier chapitre disponible. Reviens plus tard !" : "C'est le premier chapitre."}</div>
                    <div class="chap-transition-actions">
                        <a class="btn btn-primary" href="serie.html?id=${encodeURIComponent(manga.id)}">Retour à la série</a>
                        <button class="btn btn-ghost btn-sm" id="ctStay">Rester ici</button>
                    </div>
                `}
            </div>`;
        document.body.appendChild(ov);
        ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
        ov.querySelector('#ctStay')?.addEventListener('click', () => ov.remove());
        ov.querySelector('#ctGo')?.addEventListener('click', () => goChapter(delta));
        // Fermeture auto si on ne confirme pas
        setTimeout(() => { document.getElementById('chapTransition')?.remove(); }, 8000);
    }

    window.changeZoom = function (delta) {
        zoom = Math.min(200, Math.max(50, zoom + delta));
        const label = document.getElementById('zoomLabel');
        if (label) label.textContent = `${zoom}%`;
        const wrapper = document.querySelector('.reader-page-wrapper');
        if (wrapper) wrapper.style.transform = `scale(${zoom / 100})`;
        window.Storage?.setPref('zoom', zoom);
    };

    window.toggleFullscreen = function () {
        const inReal = !!document.fullscreenElement;
        const inFallback = document.body.classList.contains('reader-fullscreen');
        if (!inReal && !inFallback) {
            // Entrer : vrai plein écran OS si possible, sinon repli plein cadre
            let req;
            try { req = document.documentElement.requestFullscreen?.(); } catch (e) {}
            if (req && req.catch) req.catch(() => { document.body.classList.add('reader-fullscreen'); rerender(); });
            else if (!req) { document.body.classList.add('reader-fullscreen'); rerender(); }
        } else if (inReal) {
            document.exitFullscreen?.();
        } else {
            // Sortir du repli (pas de vrai plein écran natif)
            document.body.classList.remove('reader-fullscreen');
            rerender();
        }
    };
    // Synchronise le rendu avec l'état réel du plein écran navigateur (vrai plein écran OS)
    document.addEventListener('fullscreenchange', () => {
        document.body.classList.toggle('reader-fullscreen', !!document.fullscreenElement);
        rerender();
    });

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
        // Double-clic sur la page = zoom rapide 100 % ↔ 150 %
        document.getElementById('readerPagesArea')?.addEventListener('dblclick', e => {
            if (!e.target.closest('.reader-page-img')) return;
            e.preventDefault();
            window.changeZoom(zoom === 100 ? 50 : 100 - zoom);
        });
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
                case 'a': case 'A': toggleAutoScroll(); return;
                case 'b': case 'B': toggleBookmark(); return;
                case 'i': case 'I': toggleImmersive(); return;
                case '[': bumpAutoSpeed(-0.2); return;
                case ']': bumpAutoSpeed(0.2); return;
                case 'Escape':
                    if (document.body.classList.contains('reader-immersive')) { toggleImmersive(); return; }
                    if (document.getElementById('chapTransition')) { document.getElementById('chapTransition').remove(); return; }
                    if (autoTimer) { stopAutoScroll(); return; }
                    if (document.getElementById('readerSettings')) toggleReaderSettings(); return;
            }
            // En défilement : on laisse le scroll natif
            if (readMode === 'scroll') return;
            switch (e.key) {
                // Gauche/Droite = sens de lecture (tourne la page/planche)
                case 'ArrowRight': e.preventDefault(); window.navStep(rtl ? -1 : 1); break;
                case 'ArrowLeft':  e.preventDefault(); window.navStep(rtl ? 1 : -1); break;
                // Haut/Bas/Espace = défile dans la page si elle dépasse, sinon tourne
                case ' ': case 'ArrowDown': e.preventDefault(); scrollOrStep(1); break;
                case 'ArrowUp': e.preventDefault(); scrollOrStep(-1); break;
                case 'PageDown': e.preventDefault(); scrollOrStep(1); break;
                case 'PageUp': e.preventDefault(); scrollOrStep(-1); break;
                case 'Home': window.goToPage(1); break;
                case 'End':  window.goToPage(totalPages); break;
            }
        });
    }

    // ── Défilement automatique (webtoon) ──
    function setMode(mode) {
        readMode = mode;
        window.Storage?.setPref('readMode', mode);
        renderModebar();
        renderPage(currentPage);
    }
    function updateAutoBtn() {
        const b = document.getElementById('btnAutoScroll');
        if (b) b.classList.toggle('on', !!autoTimer);
    }
    function stopAutoScroll() {
        if (autoTimer) { clearInterval(autoTimer); autoTimer = null; }
        updateAutoBtn();
    }
    function toggleAutoScroll() {
        if (autoTimer) { stopAutoScroll(); MH.toast?.('Défilement auto arrêté'); return; }
        if (readMode !== 'scroll') setMode('scroll');
        let acc = 0;
        autoTimer = setInterval(() => {
            acc += (+rs.autospeed || 1.4);
            const step = Math.floor(acc);
            if (step >= 1) { window.scrollBy(0, step); acc -= step; }
            if (window.innerHeight + Math.ceil(window.scrollY) >= document.body.scrollHeight - 2) {
                stopAutoScroll();
                if (neighborChapter(1)) setTimeout(() => goChapter(1), 700);
            }
        }, 16);
        updateAutoBtn();
        MH.toast?.('Défilement auto · A pour arrêter, [ ] vitesse');
    }
    function bumpAutoSpeed(delta) {
        let v = Math.round(((+rs.autospeed || 1.4) + delta) * 10) / 10;
        v = Math.max(0.4, Math.min(8, v));
        rs.autospeed = v;
        window.Storage?.setPref('reader_autospeed', v);
        const lbl = document.getElementById('rsAutoVal'); if (lbl) lbl.textContent = v.toFixed(1) + '×';
        const rng = document.getElementById('rsAuto');    if (rng) rng.value = v;
        if (autoTimer) MH.toast?.('Vitesse : ' + v.toFixed(1) + '×');
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

        // Filtre confort des yeux (lumière chaude type f.lux)
        let warm = document.getElementById('readerWarm');
        if (!warm) {
            warm = document.createElement('div');
            warm.id = 'readerWarm';
            warm.style.cssText = 'position:fixed;inset:0;background:#ff8a1e;pointer-events:none;z-index:76;mix-blend-mode:multiply;transition:opacity .2s';
            document.body.appendChild(warm);
        }
        warm.style.opacity = String(Math.max(0, Math.min(0.6, (+rs.warm || 0) / 100 * 0.6)));
    }

    function saveReaderSetting(key, val, doRerender) {
        rs[key] = val;
        window.Storage?.setPref('reader_' + key, val);
        applyReaderSettings();
        if (doRerender) rerender();
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
            <label class="rs-label">Confort des yeux (lumière chaude) <span id="rsWarmVal">${rs.warm || 0}%</span></label>
            <input type="range" id="rsWarm" min="0" max="100" value="${rs.warm || 0}" class="rs-range">
            <label class="rs-label">Écart entre pages <span id="rsGapVal">${rs.gap}px</span></label>
            <input type="range" id="rsGap" min="0" max="40" value="${rs.gap}" class="rs-range">
            <label class="rs-label">Vitesse défilement auto <span id="rsAutoVal">${(+rs.autospeed || 1.4).toFixed(1)}×</span></label>
            <input type="range" id="rsAuto" min="0.4" max="6" step="0.2" value="${rs.autospeed}" class="rs-range">
            <label class="rs-label">Qualité des images</label>
            ${seg('quality', [{v:'high',l:'Haute'},{v:'saver',l:'Éco'}], q)}
            <div class="rs-foot">
                <button class="btn btn-secondary btn-sm" id="rsMarkAll" style="width:100%">Marquer tout le manga comme lu</button>
                <div class="rs-shortcuts">← → pages · ↑ ↓ / molette défile puis tourne · Début/Fin première/dernière · N/P chapitre · F plein écran · I immersif · B signet · A défilement auto · [ ] vitesse · S réglages</div>
            </div>`;
        document.body.appendChild(panel);

        panel.querySelectorAll('.rs-seg').forEach(sg => {
            const key = sg.dataset.key;
            sg.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
                sg.querySelectorAll('button').forEach(x => x.classList.remove('on'));
                b.classList.add('on');
                const val = b.dataset.val;
                if (key === 'quality') { window.Storage?.setPref('quality', val); rerender(); renderThumbnails(); return; }
                saveReaderSetting(key, val, ['gap', 'fit', 'direction'].includes(key));
            }));
        });
        panel.querySelector('#rsBright').addEventListener('input', e => {
            document.getElementById('rsBrightVal').textContent = e.target.value + '%';
            saveReaderSetting('brightness', +e.target.value, false);
        });
        panel.querySelector('#rsWarm').addEventListener('input', e => {
            document.getElementById('rsWarmVal').textContent = e.target.value + '%';
            saveReaderSetting('warm', +e.target.value, false);
        });
        panel.querySelector('#rsGap').addEventListener('input', e => {
            document.getElementById('rsGapVal').textContent = e.target.value + 'px';
            saveReaderSetting('gap', +e.target.value, true);
        });
        panel.querySelector('#rsAuto').addEventListener('input', e => {
            document.getElementById('rsAutoVal').textContent = (+e.target.value).toFixed(1) + '×';
            saveReaderSetting('autospeed', +e.target.value, false);
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

    // ── Signet de page (UserData → onglet Signets de la bibliothèque) ──
    function refreshBookmarkBtn() {
        const btn = document.getElementById('btnBookmark');
        if (!btn || !window.UserData || !currentChap) return;
        const on = UserData.hasBookmark(manga.id, currentChap.id);
        btn.classList.toggle('on', on);
        btn.title = on ? 'Signet posé sur ce chapitre (B)' : 'Ajouter un signet sur cette page (B)';
    }
    function toggleBookmark() {
        if (!window.UserData) return;
        if (UserData.hasBookmark(manga.id, currentChap.id)) {
            UserData.removeBookmark(manga.id, currentChap.id);
            MH.toast?.('Signet retiré');
        } else {
            UserData.addBookmark({
                mangaId: manga.id, source: API.sources.current,
                title: manga.title, cover: manga.cover || manga.coverThumb,
                chapterId: currentChap.id, chapterNum: currentChap.chapter,
                label: 'Page ' + currentPage,
            });
            MH.toast?.('Signet ajouté — retrouvé dans ta bibliothèque');
        }
        refreshBookmarkBtn();
    }

    // ── Mode immersif (masque l'interface pour une lecture sans distraction) ──
    function toggleImmersive() {
        const on = document.body.classList.toggle('reader-immersive');
        const btn = document.getElementById('btnImmersive');
        if (btn) btn.classList.toggle('on', on);
        MH.toast?.(on ? 'Mode immersif — I ou Échap pour quitter' : 'Interface affichée');
    }

    // ── Garder l'écran allumé pendant la lecture (Wake Lock) ──
    let wakeLock = null;
    async function requestWakeLock() {
        try {
            if ('wakeLock' in navigator) {
                wakeLock = await navigator.wakeLock.request('screen');
                wakeLock.addEventListener?.('release', () => { wakeLock = null; });
            }
        } catch (e) { /* refusé ou non supporté : sans gravité */ }
    }
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && !wakeLock) requestWakeLock();
    });

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
