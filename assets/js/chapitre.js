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
    const rs = { bg: 'dark', brightness: 100, gap: 8, fit: 'original', direction: 'rtl', autospeed: 1.4, warm: 0,
        // IX.8 : « libre » par defaut, et c'est deliberе. Verrouiller
        // d'autorite priverait de la double page en paysage ceux qui la
        // preferent — le verrou repond a une gene reelle (se retourner dans
        // son lit recompose la planche et fait perdre sa place), mais c'est
        // une gene que tout le monde n'a pas.
        orientation: 'libre',
        // P3.3 : une planche double affichee en entier sur un ecran de 375 px
        // donne deux pages de 187 px de large. On les lit l'une apres l'autre.
        decouper: '0',
        // Passer en double page quand l'ecran devient large : c'est le seul
        // moment ou deux planches tiennent sans devenir illisibles.
        autoDouble: '0' };
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
    let sleepMins = 0;       // minuteur de lecture (0 = off)
    let sleepTimerId = null;
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

        // IX.8 : orientation et double page automatique. Le verrou est posé
        // ICI, à l'entrée du lecteur, et relâché en le quittant — verrouiller
        // toute l'application pour un confort de lecture serait un effet de
        // bord que personne ne relierait à ce réglage.
        appliquerOrientation();

        // A11Y-01 : le titre lu (invisible) porte la serie et le chapitre.
        // Sans ca il annoncerait « Lecture » sur les 268 series.
        const hA11y = document.getElementById('readerTitreA11y');
        if (hA11y) {
            hA11y.textContent = (manga?.title || 'Lecture')
                + (currentChap?.chapter ? ` — chapitre ${currentChap.chapter}` : '');
        }

        // ── P3.1 : cet écran devient pilotable ──────────────
        // On branche les commandes sur les fonctions QUI EXISTENT DÉJÀ. Le
        // relais ne sait rien de l'état du lecteur : c'est ici, et seulement
        // ici, qu'une commande devient une action — donc impossible de
        // désynchroniser quoi que ce soit à distance.
        window.MH?.telecommande?.ecouter({
            'page-suivante':     () => window.navStep(1),
            'page-precedente':   () => window.navStep(-1),
            'chapitre-suivant':  () => goChapter(1),
            'chapitre-precedent':() => goChapter(-1),
            'aller-a-la-page':   (n) => { if (n) window.goToPage(n); },
            'plein-ecran':       () => window.toggleFullscreen(),
            'defilement-auto':   () => toggleAutoScroll(),
            'reglages':          () => toggleReaderSettings(),
        });

        // IX.8 : les touches de volume tournent les pages. On ne les réclame
        // QUE dans le lecteur — les confisquer ailleurs ferait passer
        // l'application pour cassée, sans que rien ne le rattache à un réglage.
        window.INKO_NATIF?.toucherVolume?.(true);
        window.INKO_toucheVolume = (sens) => {
            // Le sens de lecture ne s'applique PAS ici : « suivant » veut dire
            // la suite du récit, quel que soit le côté vers lequel on tourne.
            // Inverser les touches en RTL ferait reculer ceux qui lisent des
            // mangas, c'est-à-dire la majorité des lecteurs de cette app.
            if (sens === 'suivant') window.goToPage?.(currentPage + 1);
            else window.goToPage?.(currentPage - 1);
        };

        window.addEventListener('pagehide', () => {
            window.INKO_NATIF?.orientation?.(null);
            window.INKO_NATIF?.toucherVolume?.(false);
        });
        // `orientationchange` n'existe pas partout et `resize` seul confond une
        // rotation avec l'ouverture du clavier virtuel. Les deux, débruités
        // ensemble : la bascule ne coûte rien quand le mode est déjà le bon.
        let _tempoRot = null;
        const rotation = () => { clearTimeout(_tempoRot); _tempoRot = setTimeout(surRotation, 150); };
        window.addEventListener('orientationchange', rotation);
        window.addEventListener('resize', rotation);
        surRotation();

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
                // P2.3 : la copie de sûreté PASSE AVANT l'URL d'origine.
                // `srcPage` rend le fichier privé de l'application quand il
                // existe, et l'URL sinon. Sans ça, un Cache API évincé par
                // Android renverrait la planche sur le réseau — c'est-à-dire
                // sur rien, dans la seule situation où l'on ne peut plus rien
                // faire pour la récupérer.
                pagesData = { pages: (dl.pages || []).map((u, i) => ({
                    url: (window.Downloads?.srcPage ? window.Downloads.srcPage(dl, i) : null) || u,
                })) };
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
                `${manga.title} — ${MH.unitLabel(API.sources.current, { short: true })} ${currentChap.chapter}`;

            // Reprise à la page sauvegardée
            if (API.isLoggedIn()) {
                try {
                    const allProg = await API.me.progress();
                    const prog = allProg[manga.id];
                    if (prog && prog.chapterId === chapterId && prog.page > 1) {
                        currentPage = Math.min(prog.page, totalPages);
                    }
                } catch (e) { window.MH?.err?.('chapitre.js', e); }
            }
            // Audit AMEL-114 : une position explicite dans l'URL prime sur la
            // progression enregistrée. C'est ce qui permet à une ligne
            // d'historique de rouvrir EXACTEMENT là où on s'était arrêté, y
            // compris sur un chapitre qui n'est plus le chapitre courant.
            const pageDemandee = parseInt(new URLSearchParams(location.search).get('page') || '', 10);
            if (pageDemandee > 1) currentPage = Math.min(pageDemandee, totalPages);

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
            bindTouch();
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
            <span class="toolbar-chap">${MH.unitLabel(API.sources.current, { short: true })} ${currentChap.chapter}</span>
        </div>
        <div class="toolbar-center">
            <button class="reader-icon-btn" ${!prevChap ? 'disabled' : ''} id="btnPrevChap">‹</button>
            <select class="reader-chap-select" id="chapSelect">
                ${asc.slice().reverse().map(c =>
                    `<option value="${c.id}" ${c.id === currentChap.id ? 'selected' : ''}>${MH.unitLabel(API.sources.current, { short: true })} ${c.chapter}${c.title ? ' — ' + c.title : ''}</option>`
                ).join('')}
            </select>
            <button class="reader-icon-btn" ${!nextChap ? 'disabled' : ''} id="btnNextChap">›</button>
        </div>
        <div class="toolbar-right">
            <button class="reader-icon-btn" id="btnBookmark" title="Ajouter un signet sur cette page (B)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
            <button class="reader-icon-btn" id="btnNotes" title="Mes notes de lecture (J)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>
            <button class="reader-icon-btn" id="btnShare" title="Partager ce chapitre">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg>
            </button>
            <button class="reader-icon-btn" id="btnImmersive" title="Mode immersif — masquer l'interface (I)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3"/></svg>
            </button>
            <button class="reader-icon-btn" id="btnMarkRead" title="Marquer ce chapitre (et les précédents) comme lus">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="17" height="17"><path d="M20 6 9 17l-5-5"/></svg>
            </button>
            <button class="reader-icon-btn" id="btnDownload" title="Télécharger pour lire hors-ligne"></button>
            <button class="reader-icon-btn" id="btnZoomOut" title="Zoom −">−</button>
            <span class="reader-zoom-label" id="zoomLabel">${zoom}%</span>
            <button class="reader-icon-btn" id="btnZoomIn" title="Zoom +">+</button>
            <button class="reader-icon-btn" id="btnFullscreen" title="Plein écran">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
            </button>
            <button class="reader-icon-btn" id="btnAutoScroll" title="Défilement automatique (A)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="17" height="17"><path d="M12 5v14"/><path d="m6 13 6 6 6-6"/></svg>
            </button>
            <button class="reader-icon-btn" id="btnReaderSettings" title="Réglages du lecteur">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="17" height="17"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
        </div>`;

        document.getElementById('btnZoomOut')?.addEventListener('click', () => window.changeZoom(-10));
        document.getElementById('btnZoomIn')?.addEventListener('click', () => window.changeZoom(10));
        document.getElementById('btnFullscreen')?.addEventListener('click', () => window.toggleFullscreen());
        document.getElementById('btnReaderSettings')?.addEventListener('click', toggleReaderSettings);
        document.getElementById('btnAutoScroll')?.addEventListener('click', toggleAutoScroll);
        document.getElementById('btnMarkRead')?.addEventListener('click', markUpToHere);
        document.getElementById('btnBookmark')?.addEventListener('click', toggleBookmark);
        document.getElementById('btnImmersive')?.addEventListener('click', toggleImmersive);
        document.getElementById('btnShare')?.addEventListener('click', shareChapter);
        document.getElementById('btnNotes')?.addEventListener('click', openNotes);
        window.NotesUI?.updateBadge?.(notesContext());
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
            // Choix EXPLICITE de l'utilisateur : la bascule automatique
            // paysage/portrait se tait pour cette session. Sans ce desarmement,
            // remettre « page » en paysage serait annule dans la seconde, et on
            // perdrait la main sur son propre lecteur.
            autoDoubleDesarme = true;
            window.Storage?.setPref('readMode', readMode);                  // défaut global
            window.Storage?.setPref('readMode_' + manga.id, readMode);     // mémorisé pour cette série
            el.querySelectorAll('.modebar-btn').forEach(b => b.classList.toggle('active', b === btn));
            if (readMode === 'double') doubleBase = currentPage;            // ancre la planche sur la page courante
            renderPage(currentPage);
            resetPagedScroll(1);
        });
    }

    // ── Rendering pages ──
    // Audit PERF-08 — reste de constat, à corriger ici : la bibliothèque et
    // les couvertures passaient bien par /api/img, mais LE LECTEUR chargeait
    // ses pages en direct depuis le site scrapé. C'est pourtant là que le
    // volume est : une session de lecture, c'est des centaines d'images.
    //
    // Trois conséquences, dans l'ordre d'importance :
    //   · l'adresse IP de l'utilisateur est envoyée au site source à chaque
    //     page tournée, alors que l'application annonce ne rien exposer ;
    //   · les hôtes qui refusent le hotlink rendent des images cassées ;
    //   · le canvas est « teinté », ce qui interdit toute analyse locale de
    //     l'image (c'est ce qui a fait échouer AMEL-17, et c'est ce qui l'a
    //     révélé).
    function pageSrc(p) {
        const quality = window.Storage?.getPref('quality') || 'high';
        const brute = quality === 'saver' ? (p.urlSaver || p.url) : p.url;
        return MH.proxify ? MH.proxify(brute) : brute;
    }

    // ── Écouteurs délégués : le lecteur ne dépend d'AUCUN attribut ──────
    //
    // L'app desktop applique `script-src-attr 'none'` (défaut de helmet, la CSP
    // du serveur ne déclarant pas `scriptSrcAttr`). Les gestionnaires écrits en
    // ATTRIBUT n'y sont donc jamais exécutés. Comme `.reader-page-img` part à
    // `opacity: 0` et n'est révélée que par la classe `loaded`, les planches se
    // téléchargeaient normalement et restaient INVISIBLES : chapitre blanc.
    // Le zoom, le plein écran et les zones de changement de page étaient morts
    // pour la même raison.
    //
    // Mesuré sur l'app installée 2.5.7, chapitre de One Piece :
    //   1 balise · 1 téléchargée (naturalWidth > 0) · classe `loaded` absente
    //   opacité 0 · violation « script-src-attr | inline »
    //
    // `load` et `error` ne remontent PAS dans l'arbre : on les écoute en phase
    // de CAPTURE. Cela couvre toutes les planches quelle que soit la façon dont
    // elles ont été insérées — y compris celles que le chargement paresseux
    // crée plus tard.
    document.addEventListener('load', (e) => {
        const t = e.target;
        if (t && t.tagName === 'IMG' && t.classList.contains('reader-page-img')) {
            t.classList.add('loaded');
        }
    }, true);
    document.addEventListener('error', (e) => {
        const t = e.target;
        if (t && t.tagName === 'IMG' && t.classList.contains('reader-page-img')) {
            window.imgFail?.(t);
        }
    }, true);

    // Un seul écouteur pour toutes les commandes de navigation : zones latérales,
    // vignettes, boutons de bas de page. `data-act` remplace `onclick`.
    document.addEventListener('click', (e) => {
        const el = e.target.closest?.('[data-act]');
        if (!el) return;
        const arg = Number(el.dataset.arg);
        if (!Number.isFinite(arg)) return;
        if (el.dataset.act === 'page')      window.goToPage?.(arg);
        else if (el.dataset.act === 'step') window.navStep?.(arg);
    });

    // Markup d'une image de page : fade-in au chargement + retry en cas d'échec
    function pageImg(idx, extra = '', lazy = false) {
        const p = pages[idx];
        return `<img class="reader-page-img" data-idx="${idx}" src="${MH.esc(pageSrc(p))}" alt="Page ${idx + 1}"
                 decoding="async" loading="${lazy ? 'lazy' : 'eager'}" ${extra}>`;
    }

    // ── Défilement virtualisé (chapitres longs ET volumes entiers) ──
    // Avant : toutes les pages étaient créées sans hauteur, tombaient donc
    // toutes dans la marge de préchargement et partaient EN MÊME TEMPS —
    // supportable sur 18 pages, intenable sur un volume de 300-500 pages
    // (autant de requêtes d'un coup sur une source de scraping + autant
    // d'images décodées en mémoire → trous, blocages, crash mobile).
    // Maintenant : hauteur réservée d'emblée, fenêtre glissante de chargement,
    // déchargement des pages lointaines et concurrence bornée.
    const RATIO_DEFAUT = 1.45;              // hauteur/largeur typique d'une planche
    const pageRatios   = new Map();         // idx -> ratio réel une fois connu
    const LOAD_NEAR    = 3;                 // pages chargées de part et d'autre
    const KEEP_LOADED  = 10;                // au-delà : on décharge (mémoire)
    const MAX_PARALLEL = 3;                 // requêtes simultanées max
    let   loadQueue = [], loadActive = 0, scrollObservers = [];

    function ratioOf(idx) { return pageRatios.get(idx) || RATIO_DEFAUT; }

    // Marque-place : une image SANS src mais avec sa hauteur réservée
    function placeholderImg(idx) {
        return `<img class="reader-page-img" data-idx="${idx}" data-page="${idx + 1}"
                 alt="Page ${idx + 1}" decoding="async"
                 style="width:100%;aspect-ratio:1/${ratioOf(idx)};background:var(--bg2,#141414)"
                 >`;
    }

    function enqueueLoad(img) {
        if (img.dataset.state === 'loading' || img.dataset.state === 'loaded') return;
        img.dataset.state = 'loading';
        loadQueue.push(img);
        pumpQueue();
    }
    function pumpQueue() {
        while (loadActive < MAX_PARALLEL && loadQueue.length) {
            const img = loadQueue.shift();
            if (!img.isConnected) continue;
            const idx = +img.dataset.idx;
            const p = pages[idx];
            if (!p) continue;
            loadActive++;
            const done = () => { loadActive--; pumpQueue(); };
            img.onload = () => {
                img.classList.add('loaded');
                img.dataset.state = 'loaded';
                if (img.naturalWidth) {
                    // Hauteur exacte mémorisée : le déchargement ne fera plus sauter la page
                    const r = img.naturalHeight / img.naturalWidth;
                    pageRatios.set(idx, r);
                    img.style.aspectRatio = `1/${r}`;
                }
                done();
            };
            img.addEventListener('error', done, { once: true });
            img.src = pageSrc(p);   // échange explicite : déclenche vraiment le fetch
        }
    }
    function unloadImg(img) {
        if (img.dataset.state !== 'loaded') return;
        img.dataset.state = '';
        img.classList.remove('loaded');
        img.removeAttribute('src');      // libère l'image décodée, la hauteur reste réservée
    }
    // Les images déjà en cache peuvent être "complete" avant le binding
    function armImages(root) {
        (root || document).querySelectorAll('.reader-page-img').forEach(im => {
            if (im.complete && im.naturalWidth) im.classList.add('loaded');
            armerRecadrage(im);
        });
    }

    // ── Recadrage des marges (audit AMEL-17) ─────────────────
    // Beaucoup de scans arrivent avec une bordure blanche ou noire qui peut
    // manger 10 à 15 % de la hauteur utile — sensible sur un écran étroit, où
    // c'est justement la surface qui manque.
    //
    // Trois décisions qui font tenir la fonctionnalité :
    //
    //  · OPTION, décochée par défaut. Un recadrage automatique qui se trompe
    //    ampute une planche ; ce n'est pas un défaut acceptable par défaut.
    //  · Analyse sur une vignette de 64 px de large, pas sur l'image pleine.
    //    Décoder 326 pages en pleine résolution coûterait plus que le gain.
    //    Une marge est une zone uniforme : 64 px suffisent à la trouver.
    //  · Garde-fou : si la zone de contenu détectée couvre moins de la moitié
    //    de l'image, on ne recadre PAS. Une page très claire (planche de neige,
    //    fond blanc volontaire) serait sinon massacrée. Mieux vaut ne rien
    //    faire que mutiler.
    //
    // Les images passent par /api/img, donc même origine : le canvas n'est pas
    // « teinté » et reste lisible.
    const CROP_KEY = 'reader_autocrop';
    const cropCache = new Map();   // src → {top,right,bottom,left} en %

    function autoCropActif() { return window.Storage?.getPref(CROP_KEY) === '1'; }

    function armerRecadrage(im) {
        if (!autoCropActif()) { im.style.clipPath = ''; im.style.margin = ''; return; }
        const appliquer = () => {
            const connu = cropCache.get(im.src);
            if (connu) return appliquerRecadrage(im, connu);
            const m = mesurerMarges(im);
            if (m) { cropCache.set(im.src, m); appliquerRecadrage(im, m); }
        };
        if (im.complete && im.naturalWidth) appliquer();
        else im.addEventListener('load', appliquer, { once: true });
    }

    function appliquerRecadrage(im, m) {
        im.style.clipPath = `inset(${m.top}% ${m.right}% ${m.bottom}% ${m.left}%)`;
        // clip-path masque sans réduire la place occupée : on rattrape avec des
        // marges négatives, sinon la page garderait le vide qu'on vient de
        // cacher et le recadrage ne servirait à rien.
        im.style.marginTop    = `-${m.top}%`;
        im.style.marginBottom = `-${m.bottom}%`;
    }

    function mesurerMarges(im) {
        try {
            const L = 64;
            const H = Math.max(1, Math.round(L * (im.naturalHeight / im.naturalWidth)));
            const c = document.createElement('canvas');
            c.width = L; c.height = H;
            const ctx = c.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(im, 0, 0, L, H);
            const d = ctx.getImageData(0, 0, L, H).data;

            // Une ligne/colonne est « marge » si TOUS ses pixels sont proches
            // du blanc ou du noir. On compare à la teinte du coin supérieur
            // gauche, qui donne la couleur de fond réelle de ce scan.
            const fond = [d[0], d[1], d[2]];
            const proche = (i) => Math.abs(d[i] - fond[0]) < 18
                && Math.abs(d[i + 1] - fond[1]) < 18 && Math.abs(d[i + 2] - fond[2]) < 18;
            const ligneVide = (y) => { for (let x = 0; x < L; x++) if (!proche((y * L + x) * 4)) return false; return true; };
            const colVide   = (x) => { for (let y = 0; y < H; y++) if (!proche((y * L + x) * 4)) return false; return true; };

            let haut = 0;   while (haut < H && ligneVide(haut)) haut++;
            let bas  = 0;   while (bas < H - haut && ligneVide(H - 1 - bas)) bas++;
            let gauche = 0; while (gauche < L && colVide(gauche)) gauche++;
            let droite = 0; while (droite < L - gauche && colVide(L - 1 - droite)) droite++;

            const hUtile = H - haut - bas, lUtile = L - gauche - droite;
            if (hUtile < H * 0.5 || lUtile < L * 0.5) return null;   // garde-fou
            const m = {
                top: +(haut / H * 100).toFixed(2), bottom: +(bas / H * 100).toFixed(2),
                left: +(gauche / L * 100).toFixed(2), right: +(droite / L * 100).toFixed(2),
            };
            // Moins de 1,5 % de marge : le gain ne vaut pas le décalage.
            if (m.top + m.bottom + m.left + m.right < 1.5) return null;
            return m;
        } catch (e) {
            // Canvas teinté (image d'une autre origine) ou décodage impossible :
            // on renonce silencieusement, l'image reste telle quelle.
            return null;
        }
    }

    // Échec de chargement : bascule éco → sinon bouton Réessayer
    window.imgFail = function (img) {
        const p = pages[+img.dataset.idx];
        if (!p) return;
        // Audit PERF-08 : les pages passent désormais par /api/img. Si le
        // proxy refuse l'hôte (403 : CDN non déclaré par l'extension, voir
        // `imageHosts`), on retombe sur l'URL DIRECTE plutôt que de laisser un
        // trou dans le chapitre. C'est un compromis assumé et non un oubli :
        // l'utilisateur voit sa page, mais son adresse IP part chez la source.
        // La correction propre est de déclarer l'hôte côté extension — le
        // message de console dit lequel.
        if (!img.dataset.triedDirect && /\/api\/img\?/.test(img.src)) {
            img.dataset.triedDirect = '1';
            const brute = window.Storage?.getPref('quality') === 'saver' ? (p.urlSaver || p.url) : p.url;
            try {
                console.warn('[inko] proxy d’images refusé pour', new URL(brute).hostname,
                    '— chargement direct. Ajoute cet hôte à `imageHosts` de l’extension.');
            } catch (e) { /* URL illisible */ }
            img.src = brute;
            return;
        }
        if (!img.dataset.triedSaver && p.urlSaver) {
            // Le repli « qualité éco » posait l'URL brute, rouvrant en direct
            // la connexion que pageSrc venait de faire passer par le proxy.
            const replique = MH.proxify ? MH.proxify(p.urlSaver) : p.urlSaver;
            if (img.src !== replique) {
                img.dataset.triedSaver = '1';
                img.src = replique;
                return;
            }
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
            img.dataset.state = '';        // repasse en « à charger » (défilement virtualisé)
            img.removeAttribute('src');
            enqueueLoad(img);              // repasse par la file bornée
        };
        img.style.display = 'none';
        img.after(div);
    };

    // ── P3.3 : la moitie affichee, ou null pour la planche entiere ──
    //
    // Une planche double est UNE image qui contient DEUX pages. Affichee telle
    // quelle sur un ecran de 375 px, chaque page fait 187 px de large : le
    // texte des bulles devient illisible, et il faut zoomer puis se deplacer
    // pour chacune. La decouper rend la lecture normale.
    //
    // On ne peut pas savoir a l'avance qu'une planche est double : c'est
    // l'image chargee qui le dit (largeur > hauteur). La decoupe s'applique
    // donc APRES le chargement, ce qui evite aussi de couper une planche
    // simple un peu large.
    let demi = null;

    // Le sens de lecture compte ICI, et seulement ici. En lecture japonaise on
    // commence par la moitie DROITE : commencer a gauche ferait lire la
    // planche a l'envers, ce qu'un lecteur de manga voit immediatement.
    function premiereMoitie() { return rs.direction === 'rtl' ? 1 : 0; }
    function secondeMoitie()  { return rs.direction === 'rtl' ? 0 : 1; }

    function estDouble(img) {
        return !!(img && img.naturalWidth && img.naturalHeight
            && img.naturalWidth > img.naturalHeight * 1.2);
    }

    /** La planche affichee est-elle decoupable, et l'est-elle en ce moment ? */
    function planhceDecoupable() {
        if (rs.decouper !== '1' || readMode !== 'page') return false;
        const img = document.querySelector('#readerPagesArea .reader-page-img');
        return estDouble(img);
    }

    // Applique (ou retire) la decoupe sur l'image affichee.
    function appliquerDecoupe() {
        const enveloppe = document.querySelector('#readerPagesArea .reader-page-wrapper');
        const img = enveloppe && enveloppe.querySelector('.reader-page-img');
        if (!enveloppe || !img) return;

        if (rs.decouper !== '1' || readMode !== 'page' || !estDouble(img)) {
            enveloppe.classList.remove('mh-demi');
            enveloppe.removeAttribute('data-demi');
            demi = null;
            return;
        }
        if (demi === 'fin') demi = secondeMoitie();      // planche atteinte en reculant
        if (demi === null) demi = premiereMoitie();
        enveloppe.classList.add('mh-demi');
        enveloppe.setAttribute('data-demi', String(demi));
        // Le compteur doit dire ou l'on est DANS la planche : sans ca, deux
        // ecrans successifs affichent « Page 12 / 40 » et l'on croit que le
        // geste n'a pas pris.
        const badge = document.querySelector('#readerPagesArea .page-counter-badge');
        if (badge) {
            badge.innerHTML = `Page <strong>${currentPage}</strong> / ${totalPages}`
                + ` <span style="opacity:.7">(${demi === premiereMoitie() ? '1' : '2'}/2)</span>`;
        }
    }

    function renderPage(num) {
        const el = document.getElementById('readerPagesArea');
        if (!el) return;
        if (readMode === 'scroll') return renderScroll();
        if (readMode === 'double') return renderDouble(doubleBase || num);

        const p = pages[num - 1];
        if (!p) return;
        el.classList.remove('reader-scrollmode');   // retour en mode paginé
        el.classList.add('paged');   // défilement interne quand la page dépasse l'écran
        const leftTarget  = rs.direction === 'rtl' ? num + 1 : num - 1;
        const rightTarget = rs.direction === 'rtl' ? num - 1 : num + 1;
        el.innerHTML = `
        <div class="page-zone-prev" data-act="page" data-arg="${leftTarget}"><div class="page-zone-arrow">‹</div></div>
        <div class="page-zone-next" data-act="page" data-arg="${rightTarget}"><div class="page-zone-arrow">›</div></div>
        <div class="reader-page-wrapper" style="transform:scale(${zoom/100});transform-origin:top center">
            ${pageImg(num - 1)}
        </div>
        <div class="page-counter-badge">Page <strong>${num}</strong> / ${totalPages}</div>`;

        armImages(el);
        updateUIPage(num);

        // Apres chargement : c'est l'image qui dit si la planche est double.
        const img = el.querySelector('.reader-page-img');
        if (img) {
            if (img.complete) appliquerDecoupe();
            else img.addEventListener('load', appliquerDecoupe, { once: true });
        }
    }

    function renderScroll() {
        const el = document.getElementById('readerPagesArea');
        if (!el) return;
        el.classList.remove('paged');
        el.classList.add('reader-scrollmode');   // block + overflow visible : la fenêtre scrolle, jamais de coupe
        // Le zoom passe par la LARGEUR (pas transform:scale, qui laisserait le
        // bas du chapitre déborder sous la zone scrollable et inatteignable).
        const widthPct = Math.max(20, Math.min(100, zoom));
        // Toutes les pages sont créées en marque-place (hauteur réservée, pas de
        // src) : la barre de défilement est juste dès le départ, même sur un
        // volume de 500 pages, et seules les pages proches sont réellement
        // téléchargées (voir enqueueLoad / unloadImg plus haut).
        scrollObservers.forEach(o => { try { o.disconnect(); } catch (e) { /* déjà libéré */ } });
        scrollObservers = [];
        loadQueue = []; loadActive = 0;
        el.innerHTML = `
        <div class="reader-page-wrapper reader-scroll-wrapper" style="display:flex;flex-direction:column;align-items:center;gap:${rs.gap}px;width:${widthPct}%;margin:0 auto">
            ${pages.map((p, i) => placeholderImg(i)).join('')}
        </div>
        <div class="page-counter-badge"><strong>${totalPages}</strong> pages — défilement</div>`;

        const imgs = [...el.querySelectorAll('.reader-page-img')];

        // Recalcule la fenêtre : charge autour de la page visible, décharge loin.
        function refreshWindow(centerIdx) {
            for (const im of imgs) {
                const d = Math.abs(+im.dataset.idx - centerIdx);
                if (d <= LOAD_NEAR) enqueueLoad(im);
                else if (d > KEEP_LOADED) unloadImg(im);
            }
        }

        if ('IntersectionObserver' in window) {
            // Déclenche le chargement des pages qui approchent (~1 écran avant)
            const near = new IntersectionObserver((ents) => {
                ents.forEach(en => { if (en.isIntersecting) enqueueLoad(en.target); });
            }, { rootMargin: '150% 0px' });
            imgs.forEach(im => near.observe(im));
            scrollObservers.push(near);

            // Suit la page visible (avance ET retours arrière) + pilote la fenêtre
            const io = new IntersectionObserver(entries => {
                entries.forEach(en => {
                    if (!en.isIntersecting) return;
                    const p = +en.target.dataset.page;
                    if (p !== currentPage) { currentPage = p; updateUIPage(p); }
                    refreshWindow(p - 1);
                });
            }, { threshold: 0.3 });
            imgs.forEach(im => io.observe(im));
            scrollObservers.push(io);
        } else {
            imgs.forEach(im => enqueueLoad(im));   // repli : navigateurs sans IO
        }

        refreshWindow(Math.max(0, currentPage - 1));   // amorce autour de la position courante
        updateUIPage(currentPage);
    }

    function renderDouble(num) {
        const el = document.getElementById('readerPagesArea');
        if (!el) return;
        if (num < 1) num = 1;
        doubleBase = num;              // ancre de la planche (navigation par 2)
        el.classList.remove('reader-scrollmode');
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
        <div class="page-zone-prev" data-act="step" data-arg="${leftStep}"><div class="page-zone-arrow">‹</div></div>
        <div class="page-zone-next" data-act="step" data-arg="${rightStep}"><div class="page-zone-arrow">›</div></div>
        <div class="reader-page-wrapper reader-spread" style="transform:scale(${zoom/100});transform-origin:top center">
            ${spread}
        </div>
        <div class="page-counter-badge">Pages <strong>${num}${next ? '–' + (num+1) : ''}</strong> / ${totalPages}${rtl && next ? ' · sens →←' : ''}</div>`;
        armImages(el);
        updateUIPage(next ? num + 1 : num);
    }

    function updateUIPage(p) {
        currentPage = p;   // MAJ immédiate → l'affichage (numéro, barre) est toujours juste
        // Audit AMEL-14 : fenêtre ajustée à la vitesse réellement mesurée.
        const fenetre = fenetrePrechargement();
        for (let i = 1; i <= fenetre; i++) preloadPage(p + i);
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
        armerBarreProgression();
        renderNavigation();

        // Sauvegarde progression (debounce)
        if (p === totalPages && API.isLoggedIn()) markChapterRead();
        debouncedSave();

        // Audit AMEL-15 : c'est ICI que la fin du chapitre est constatée.
        // Quitter la dernière page (retour en arrière) annule l'enchaînement —
        // sinon on serait emmené au chapitre suivant après avoir explicitement
        // fait demi-tour.
        if (p >= totalPages && autoNextActif()) armerEnchainement(chapitreSuivant());
        else if (p < totalPages) annulerEnchainement();
    }

    // ── Barre de progression cliquable (audit AMEL-19) ───────
    // Sur un chapitre de 326 pages, la navigation n'existait qu'en séquentiel
    // ou par saisie du numéro. La barre affichait déjà la position : elle
    // devient le moyen de la CHANGER, ce que tout lecteur suppose d'une barre
    // de progression.
    //
    // Câblée une seule fois (marqueur data-arme) : updateUIPage est appelée à
    // chaque page, on ne veut pas empiler 326 écouteurs.
    function armerBarreProgression() {
        const bar = document.querySelector('.reader-progressbar');
        if (!bar || bar.dataset.arme === '1') return;
        bar.dataset.arme = '1';
        bar.setAttribute('role', 'slider');
        bar.setAttribute('aria-label', 'Progression dans le chapitre');
        bar.tabIndex = 0;

        const pageSousCurseur = (e) => {
            const r = bar.getBoundingClientRect();
            const ratio = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
            return Math.min(totalPages, Math.max(1, Math.round(ratio * totalPages) || 1));
        };
        bar.addEventListener('click', (e) => {
            const n = pageSousCurseur(e);
            if (typeof window.goToPage === 'function') window.goToPage(n);
        });
        // Aperçu au survol : sauter à l'aveugle dans 326 pages n'aiderait pas.
        bar.addEventListener('mousemove', (e) => {
            bar.title = `Aller à la page ${pageSousCurseur(e)} sur ${totalPages}`;
        });
        // Au clavier, la barre se comporte comme le curseur qu'elle annonce.
        bar.addEventListener('keydown', (e) => {
            const pas = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1
                : e.key === 'PageDown' ? 10 : e.key === 'PageUp' ? -10 : 0;
            if (!pas) return;
            e.preventDefault();
            const n = Math.min(totalPages, Math.max(1, currentPage + pas));
            if (typeof window.goToPage === 'function') window.goToPage(n);
        });
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
        saveTimer = setTimeout(() => { saveTimer = null; saveProgress(); }, 400);   // currentPage déjà à jour
    }
    // Audit N52 : une sauvegarde debouncée encore en attente était perdue si on
    // quittait le lecteur dans les 400 ms (retour, fermeture, chapitre suivant).
    // On la force au départ de la page — le keepalive d'api.js fait survivre la
    // requête à la navigation.
    window.addEventListener('pagehide', () => {
        if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; saveProgress(); }
    });

    async function saveProgress() {
        if (window.MH?.isIncognito?.(manga?.id)) return;   // lecture privée (globale ou série)
        if (!API.isLoggedIn() || !manga || !currentChap) return;
        try {
            await API.me.setProgress(manga.id, {
                chapterId:  currentChap.id,
                chapter:    currentChap.chapter,
                page:       currentPage,
                totalPages: totalPages || null,   // audit HIST2 : % exact sur le profil
            });
        } catch(e) { /* silencieux */ }

        // P3.5 : l'ecran d'accueil suit la lecture.
        //
        // C'est volontairement place APRES les gardes ci-dessus : une lecture
        // privee ne doit pas s'afficher sur le fond d'ecran, la ou n'importe
        // qui la voit. Accrocher le widget ici le fait heriter de la regle
        // plutot que de la reimplementer — et donc de l'oublier un jour.
        majWidget();
    }

    // `encodeURIComponent` laisse passer !'()*~ — legal dans une URL, mais
    // REFUSE par la validation de RaccourcisPlugin (`/[A-Za-z0-9_./?=&%-]*`).
    // Mesure : sur six identifiants realistes, cinq etaient rejetes, dont
    // « one-piece_(2024) » et « k-on! ». L'appui sur le widget ouvrait alors
    // l'application sans naviguer, sans le moindre message.
    //
    // On encode donc plus strictement du cote qui FABRIQUE le lien, plutot que
    // d'elargir le garde-fou du cote qui l'execute.
    function encoderStrict(v) {
        return encodeURIComponent(String(v)).replace(/[!'()*~]/g,
            (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
    }

    // Ce que le widget affichera. Le lien est celui que RaccourcisPlugin sait
    // deja valider et ouvrir : un seul chemin d'entree, pas deux.
    function majWidget() {
        if (!window.INKO_NATIF?.dansApp) return;
        const chap = currentChap.chapter ? `Chapitre ${currentChap.chapter}` : 'Chapitre';
        const page = totalPages ? ` · page ${currentPage}/${totalPages}` : '';
        const lien = `/chapitre.html?manga=${encoderStrict(manga.id)}`
            + `&chapter=${encoderStrict(currentChap.id)}`
            + `&source=${encoderStrict(API.sources.current)}`;
        window.INKO_NATIF.majWidget(manga.title || 'Lecture', chap + page, lien);
    }

    async function markChapterRead() {
        if (window.MH?.isIncognito?.(manga?.id)) return;   // lecture privée (globale ou série)
        if (!API.isLoggedIn() || !manga || !currentChap) return;
        // Audit N53 : au double-appui « chapitre suivant » (le geste que l'écran
        // de transition suggère), la navigation interrompait cette requête et le
        // chapitre terminé n'était pas compté. markChapter est désormais envoyé
        // en keepalive (api.js) → il survit à la navigation. On lance les deux
        // appels tout de suite (sans await séquentiel) pour maximiser leurs
        // chances de partir avant le départ de la page.
        const req = API.me.markChapter({
            mangaId:   manga.id,
            chapterId: currentChap.id,
            chapter:   currentChap.chapter,
            read:      true,
        }).catch(() => {});
        // Synchro AniList (best-effort, silencieux)
        try {
            const n = parseFloat(currentChap.chapter);
            window.AniList?.syncByTitle(manga.title, { progress: isNaN(n) ? undefined : n, status: 'reading' });
        } catch (e) { window.MH?.err?.('chapitre.js', e); }
        await req;
    }

    // ── Miniatures ──
    function renderThumbnails() {
        const el = document.getElementById('readerThumbnails');
        if (!el) return;
        el.innerHTML = pages.map((p, i) => `
            <div class="reader-thumb ${i + 1 === currentPage ? 'active' : ''}" data-page="${i + 1}" data-act="page" data-arg="${i + 1}">
                <img src="${MH.cover(p.urlSaver, p.url)}" alt="p${i+1}" loading="lazy">
                <div class="reader-thumb-num">${i + 1}</div>
            </div>`).join('');
    }

    // ── Navigation ──
    function renderNavigation() {
        const el = document.getElementById('readerNavigation');
        if (!el) return;
        el.innerHTML = `
        <button class="reader-nav-btn reader-nav-edge" data-act="page" data-arg="1" ${currentPage <= 1 ? 'disabled' : ''} title="Première page (Début)">⤒</button>
        <button class="reader-nav-btn" data-act="page" data-arg="${currentPage - 1}" ${currentPage <= 1 ? 'disabled' : ''}>← Précédent</button>
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
        <button class="reader-nav-btn" data-act="page" data-arg="${currentPage + 1}" ${currentPage >= totalPages ? 'disabled' : ''}>Suivant →</button>
        <button class="reader-nav-btn reader-nav-edge" data-act="page" data-arg="${totalPages}" ${currentPage >= totalPages ? 'disabled' : ''} title="Dernière page (Fin)">⤓</button>`;
        const scrub = el.querySelector('#pageScrub');
        if (scrub) {
            scrub.addEventListener('input', () => window.goToPage(+scrub.value));
            // IX.8 : le curseur déplaçait bien, mais À L'AVEUGLE. Sur un
            // chapitre de 40 planches, chercher la page où la scène change
            // revenait à balayer au hasard, lâcher, regarder, recommencer —
            // chaque essai déclenchant un vrai chargement. La vignette remplace
            // cette boucle par un seul geste continu.
            window.MH?.lecteurCurseur?.equiper(scrub, () => pages);
        }
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
                <img src="${MH.cover(manga.coverThumb, manga.cover)}" alt="" loading="lazy">
            </div>
            <div class="next-chapter-info">
                <div class="next-chapter-label">À suivre</div>
                <div class="next-chapter-title">Chapitre ${next.chapter}${next.title ? ' — ' + MH.esc(next.title) : ''}</div>
            </div>
            <a href="chapitre.html?manga=${encodeURIComponent(manga.id)}&chapter=${encodeURIComponent(next.id)}" class="btn btn-primary" id="btnNextChapterCTA">Lire →</a>
        </div>
        <label class="next-chapter-auto">
            <input type="checkbox" id="autoNextChap" ${autoNextActif() ? 'checked' : ''}>
            <span>Enchaîner automatiquement</span>
        </label>`;
        document.getElementById('autoNextChap')?.addEventListener('change', (e) => {
            window.Storage?.setPref('reader_autonext', e.target.checked ? '1' : '0');
            if (e.target.checked) armerEnchainement(next);
            else annulerEnchainement();
        });
        if (autoNextActif()) armerEnchainement(next);
    }

    // ── Enchaînement automatique (audit AMEL-15) ─────────────
    // Arriver au bout d'un chapitre et vouloir le suivant est le geste le plus
    // fréquent d'une session de lecture ; il fallait pourtant repasser par le
    // sélecteur ou viser un bouton.
    //
    // Deux garde-fous délibérés, parce qu'une navigation qu'on n'a pas demandée
    // est pire que pas de raccourci du tout :
    //   · c'est une OPTION, décochée par défaut, et son état est mémorisé ;
    //   · même activée, elle laisse un délai visible et annulable — arriver à
    //     la dernière page ne veut pas toujours dire « continue », on peut
    //     vouloir relire la double page ou simplement s'arrêter là.
    let minuterieEnchainement = null;
    const AUTONEXT_MS = 4000;

    function autoNextActif() {
        return window.Storage?.getPref('reader_autonext') === '1';
    }

    // Le chapitre suivant, calculé à la demande. renderNextChapter le connaît
    // déjà mais dans sa portée locale, et updateUIPage en a besoin AUSSI :
    // c'est en arrivant à la dernière page que l'enchaînement doit s'armer, pas
    // au chargement (où l'on n'y est jamais). Sans ça, l'option était cochable
    // mais ne se déclenchait pour personne.
    function chapitreSuivant() {
        if (!chapters || !currentChap) return null;
        const asc = [...chapters].sort((a, b) => a.chapter - b.chapter);
        const idx = asc.findIndex(c => c.id === currentChap.id);
        return idx >= 0 && idx < asc.length - 1 ? asc[idx + 1] : null;
    }
    function annulerEnchainement() {
        clearTimeout(minuterieEnchainement);
        minuterieEnchainement = null;
        document.getElementById('autoNextCountdown')?.remove();
    }
    function armerEnchainement(next) {
        annulerEnchainement();
        if (!next || currentPage < totalPages) return;   // seulement à la fin

        const hote = document.querySelector('.reader-next-chapter');
        if (!hote) return;
        const info = document.createElement('div');
        info.id = 'autoNextCountdown';
        info.className = 'next-chapter-countdown';
        let reste = Math.round(AUTONEXT_MS / 1000);
        const peindre = () => {
            info.innerHTML = `Chapitre suivant dans ${reste} s · `
                + '<button type="button" class="next-chapter-cancel">Annuler</button>';
            info.querySelector('.next-chapter-cancel').onclick = () => {
                annulerEnchainement();
                MH.toast?.('Enchaînement annulé');
            };
        };
        peindre();
        hote.appendChild(info);

        const tic = setInterval(() => {
            reste -= 1;
            if (reste <= 0) { clearInterval(tic); return; }
            if (document.getElementById('autoNextCountdown')) peindre(); else clearInterval(tic);
        }, 1000);

        minuterieEnchainement = setTimeout(() => {
            clearInterval(tic);
            if (!document.getElementById('autoNextCountdown')) return;   // annulé entre-temps
            // `chapURL` est local à renderToolbar : on reprend la même forme
            // d'URL que le lien « Lire → » juste au-dessus, source comprise.
            const lien = document.getElementById('btnNextChapterCTA');
            window.location.href = lien ? lien.getAttribute('href')
                : `chapitre.html?manga=${encodeURIComponent(manga.id)}&chapter=${encodeURIComponent(next.id)}`;
        }, AUTONEXT_MS);
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
        // P3.3 : sur une planche decoupee, un pas change de MOITIE avant de
        // changer de page. Sans ca, la seconde moitie ne serait jamais
        // atteignable autrement qu'en zoomant.
        if (planhceDecoupable()) {
            const versLaSuite = dir > 0;
            const surLaPremiere = demi === premiereMoitie();
            if (versLaSuite && surLaPremiere) { demi = secondeMoitie(); appliquerDecoupe(); return; }
            if (!versLaSuite && !surLaPremiere) { demi = premiereMoitie(); appliquerDecoupe(); return; }
            // On sort de la planche : la suivante s'ouvre sur SA premiere
            // moitie, la precedente sur sa SECONDE — c'est le sens de lecture,
            // pas une preference.
            demi = versLaSuite ? null : 'fin';
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
            // Ctrl + molette → zoom (ergonomie demandée en issue #4), dans tous
            // les modes. On empêche le zoom natif du navigateur/page.
            if (e.ctrlKey) {
                e.preventDefault();
                // Audit AMEL-18 : le zoom se faisait depuis le haut de la page,
                // si bien qu'agrandir ÉLOIGNAIT du détail visé — il fallait
                // ensuite faire défiler pour le retrouver. On ancre au curseur :
                // le point sous la souris reste sous la souris.
                ancrerZoomSur({ x: e.clientX, y: e.clientY });
                window.changeZoom(e.deltaY < 0 ? 10 : -10);
                return;
            }
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

    // ── Gestes tactiles (mobile) — swipe de page + double-tap zoom ──
    // Absents jusqu'ici malgré un usage mobile probable (audit §4).
    function bindTouch() {
        const area = document.getElementById('readerPagesArea');
        if (!area || area.dataset.touchBound) return;
        area.dataset.touchBound = '1';

        // Audit AMEL-18 : PAS de double-clic pour zoomer au bureau. Tenté puis
        // écarté après essai : la zone de lecture est déjà découpée en bandes
        // de navigation (page-zone-prev / page-zone-next), donc le premier clic
        // tourne la page avant que le second n'arrive. On aurait tourné deux
        // pages puis zoomé — pire que pas de raccourci.
        // Le geste desktop équivalent est Ctrl + molette, qui n'a aucun
        // conflit ; il est désormais ancré au curseur (voir bindWheel).
        let sx = 0, sy = 0, st = 0, moved = false, lastTap = 0;
        area.addEventListener('touchstart', (e) => {
            if (e.touches.length !== 1) return;
            sx = e.touches[0].clientX; sy = e.touches[0].clientY; st = Date.now(); moved = false;
        }, { passive: true });
        area.addEventListener('touchmove', (e) => {
            if (e.touches.length !== 1) return;
            if (Math.abs(e.touches[0].clientX - sx) > 10 || Math.abs(e.touches[0].clientY - sy) > 10) moved = true;
        }, { passive: true });
        area.addEventListener('touchend', (e) => {
            const dt = Date.now() - st;
            const t = e.changedTouches[0];
            const dx = t.clientX - sx, dy = t.clientY - sy;
            const adx = Math.abs(dx), ady = Math.abs(dy);
            // Double-tap → bascule le zoom (immobile + tap rapide)
            if (!moved && dt < 250) {
                const now = Date.now();
                if (now - lastTap < 300) { lastTap = 0; toggleTapZoom({ x: t.clientX, y: t.clientY }); }
                else lastTap = now;
                return;
            }
            // Swipe horizontal franc → navigation (respecte le sens de lecture)
            if (adx > 55 && adx > ady * 1.6 && dt < 700) {
                const rtl = rs.direction === 'rtl';
                const dir = (dx < 0 ? 1 : -1) * (rtl ? -1 : 1);   // swipe gauche = suivant (LTR)
                if (readMode === 'scroll') goChapter(dir);        // webtoon : swipe = chapitre
                else window.navStep(dir);
            }
        }, { passive: true });

        // ── Pinch et chrome auto (audit IX.8) ──
        // Délégués à `lecteur-gestes.js` : ce fichier fait déjà 1 654 lignes,
        // et une machine à états tactile de plus le rendrait illisible. Le
        // module reçoit ce dont il a besoin, pas l'objet entier.
        window.MH?.lecteurGestes?.({
            zone: area,
            getZoom: () => zoom,
            setZoom: (z, point) => appliquerZoom(z, point),
            estDefilement: () => readMode === 'scroll',
        });
    }

    // Point d'entrée unique du zoom : le pinch, le double-tap et Ctrl+molette
    // passent tous par ici, pour que l'ancrage et la persistance soient écrits
    // une seule fois.
    function appliquerZoom(z, point) {
        zoom = Math.round(Math.min(400, Math.max(20, z)));
        const label = document.getElementById('zoomLabel');
        if (label) label.textContent = zoom + '%';
        ancrerZoomSur(zoom > 100 ? point : null);
        document.querySelectorAll('.reader-page-wrapper')
            .forEach(w => { w.style.transform = `scale(${zoom / 100})`; });
        window.Storage?.setPref('zoom', zoom);
    }
    // ── Zoom ancré (audit AMEL-18) ───────────────────────────
    // Le zoom partait de `transform-origin: top center` : agrandir éloignait
    // du détail visé, et il fallait ensuite faire défiler pour le retrouver.
    // Sur une planche, on zoome pour lire une case précise — le point qu'on
    // désigne doit rester sous le doigt (ou le curseur).
    //
    // `point` est en coordonnées écran ; on le convertit en position dans le
    // conteneur, ce que `transform-origin` attend.
    // Fixe le point d'ancrage du zoom à partir d'une coordonnée écran.
    // `transform-origin` attend une position DANS l'élément : on convertit.
    function ancrerZoomSur(point) {
        document.querySelectorAll('.reader-page-wrapper').forEach(w => {
            if (!point) { w.style.transformOrigin = 'top center'; return; }
            const r = w.getBoundingClientRect();
            if (!r.width || !r.height) return;
            const x = Math.min(100, Math.max(0, ((point.x - r.left) / r.width) * 100));
            const y = Math.min(100, Math.max(0, ((point.y - r.top) / r.height) * 100));
            w.style.transformOrigin = `${x.toFixed(2)}% ${y.toFixed(2)}%`;
        });
    }

    function toggleTapZoom(point) {
        if (readMode === 'scroll') return;
        const agrandi = zoom > 110;
        zoom = agrandi ? 100 : 170;
        const label = document.getElementById('zoomLabel'); if (label) label.textContent = zoom + '%';
        // Retour à 100 % : origine neutre, sinon la page resterait décalée.
        ancrerZoomSur(agrandi ? null : point);
        document.querySelectorAll('.reader-page-wrapper')
            .forEach(w => { w.style.transform = `scale(${zoom / 100})`; });
        window.Storage?.setPref('zoom', zoom);
    }

    // ── Partager ce chapitre (audit §9) ──
    function shareChapter() {
        const url = `${location.origin}/chapitre.html?manga=${encodeURIComponent(manga.id)}&chapter=${encodeURIComponent(currentChap.id)}&source=${encodeURIComponent(API.sources.current)}`;
        const title = `${manga.title} — ${MH.unitLabel(API.sources.current, { short: true })} ${currentChap.chapter}`;
        if (navigator.share) {
            navigator.share({ title, url }).catch(() => {});
        } else if (navigator.clipboard) {
            navigator.clipboard.writeText(url).then(() => MH.toast?.('Lien du chapitre copié')).catch(() => MH.toast?.(url));
        } else { MH.toast?.(url); }
    }

    // ── Notes de lecture (journal) ──
    function notesContext() {
        return {
            mangaId: manga.id, source: API.sources.current,
            mangaTitle: manga.title, cover: manga.cover || manga.coverThumb,
            chapterId: currentChap.id, chapterNum: currentChap.chapter, page: currentPage,
        };
    }
    function openNotes() { window.NotesUI?.open(notesContext()); }

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
        if (wrapper) {
            if (readMode === 'scroll') {
                // En défilement, le zoom passe par la LARGEUR (jamais transform:scale,
                // qui laisserait le bas du chapitre inatteignable — bug corrigé).
                wrapper.style.transform = '';
                wrapper.style.width = `${Math.max(20, Math.min(100, zoom))}%`;
            } else {
                wrapper.style.transform = `scale(${zoom / 100})`;
            }
        }
        window.Storage?.setPref('zoom', zoom);
    };

    window.toggleFullscreen = function () {
        const inReal = !!document.fullscreenElement;
        const inFallback = document.body.classList.contains('reader-fullscreen');
        if (!inReal && !inFallback) {
            // Entrer : vrai plein écran OS si possible, sinon repli plein cadre
            let req;
            try { req = document.documentElement.requestFullscreen?.(); } catch (e) { window.MH?.err?.('chapitre.js', e); }
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
        // Tri robuste aux numéros non numériques (« Extra », « Bonus 1 »… — audit
        // N54) : a.chapter - b.chapter donnait NaN → ordre imprévisible et
        // « chapitre suivant » pouvant sauter au mauvais endroit. Les entrées non
        // numériques sont classées en fin de liste, entre elles par texte.
        const num = c => { const n = parseFloat(c.chapter); return isNaN(n) ? null : n; };
        const asc = [...chapters].sort((a, b) => {
            const na = num(a), nb = num(b);
            if (na !== null && nb !== null) return na - nb;
            if (na !== null) return -1;
            if (nb !== null) return 1;
            return String(a.chapter).localeCompare(String(b.chapter), 'fr');
        });
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
                case 'j': case 'J': openNotes(); return;
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

    // ── Minuteur de lecture (sleep timer) ──
    function setSleepTimer(mins) {
        sleepMins = mins || 0;
        if (sleepTimerId) { clearTimeout(sleepTimerId); sleepTimerId = null; }
        if (sleepMins > 0) {
            sleepTimerId = setTimeout(triggerSleep, sleepMins * 60 * 1000);
            MH.toast?.(`Minuteur réglé : pause dans ${sleepMins} min`);
        } else {
            MH.toast?.('Minuteur désactivé');
        }
    }
    function triggerSleep() {
        if (autoTimer) stopAutoScroll();
        sleepTimerId = null;
        if (document.getElementById('sleepOverlay')) return;
        const ov = document.createElement('div');
        ov.id = 'sleepOverlay';
        ov.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;z-index:130;background:rgba(0,0,0,.82);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center';
        ov.innerHTML = `<div style="text-align:center;max-width:340px;padding:30px">
            <div style="margin-bottom:12px;color:var(--accent)">${MH.icon('moon', 40)}</div>
            <div style="font-family:var(--font-head);font-size:20px;font-weight:800;margin-bottom:8px;color:#fff">Pause lecture</div>
            <div style="font-size:13.5px;color:rgba(255,255,255,.7);margin-bottom:20px">Tu lis depuis ${sleepMins} min. Le temps de souffler un peu ?</div>
            <div style="display:flex;gap:10px;justify-content:center">
                <button class="btn btn-primary" id="sleepResume">Continuer</button>
                <a class="btn btn-ghost" href="accueil.html">Arrêter</a>
            </div></div>`;
        document.body.appendChild(ov);
        ov.querySelector('#sleepResume').onclick = () => { ov.remove(); if (sleepMins) setSleepTimer(sleepMins); };
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
            dim.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;background:#000;pointer-events:none;z-index:75;transition:opacity .2s';
            document.body.appendChild(dim);
        }
        dim.style.opacity = String(Math.max(0, (100 - rs.brightness) / 100 * 0.72));

        // Filtre confort des yeux (lumière chaude type f.lux)
        let warm = document.getElementById('readerWarm');
        if (!warm) {
            warm = document.createElement('div');
            warm.id = 'readerWarm';
            warm.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;background:#ff8a1e;pointer-events:none;z-index:76;mix-blend-mode:multiply;transition:opacity .2s';
            document.body.appendChild(warm);
        }
        warm.style.opacity = String(Math.max(0, Math.min(0.6, (+rs.warm || 0) / 100 * 0.6)));
    }

    function saveReaderSetting(key, val, doRerender) {
        rs[key] = val;
        window.Storage?.setPref('reader_' + key, val);
        applyReaderSettings();
        if (key === 'orientation') appliquerOrientation();
        if (doRerender) rerender();
    }

    // ── IX.8 : verrouillage d'orientation ───────────────────
    // Une rotation involontaire — on se retourne dans son lit — recompose la
    // planche et fait perdre sa place. Le verrou n'est appliqué QUE dans le
    // lecteur, et relâché en le quittant : verrouiller toute l'application
    // pour un confort de lecture serait un effet de bord que personne ne
    // relierait à ce réglage.
    function appliquerOrientation() {
        if (!window.INKO_NATIF) return;
        window.INKO_NATIF.orientation(rs.orientation === 'libre' ? null : rs.orientation);
    }

    // ── IX.8 : double page automatique en paysage ───────────
    // Deux planches côte à côte ne tiennent qu'en paysage ; en portrait elles
    // deviennent deux timbres. Basculer à la main à chaque rotation est
    // précisément le genre de geste qu'on cesse de faire au bout de deux
    // jours, et le réglage reste alors sur la mauvaise valeur.
    //
    // Deux garde-fous :
    //   · le mode DÉFILEMENT n'est jamais touché — c'est celui des webtoons,
    //     où la double page n'a aucun sens ;
    //   · un changement de mode FAIT À LA MAIN désarme la bascule pour la
    //     session. Sans ça, on remettrait « page » en paysage et l'automatisme
    //     le rebasculerait aussitôt : l'utilisateur perdrait la main sur son
    //     propre lecteur.
    let autoDoubleDesarme = false;
    function surRotation() {
        if (rs.autoDouble !== '1' || autoDoubleDesarme) return;
        if (readMode === 'scroll') return;
        const paysage = window.innerWidth > window.innerHeight;
        const voulu = paysage ? 'double' : 'page';
        if (readMode === voulu) return;
        readMode = voulu;
        if (voulu === 'double') doubleBase = currentPage;
        renderModebar();
        rerender();
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
            <label class="rs-label">Marges des scans (audit AMEL-17)</label>
            <label class="rs-check">
                <input type="checkbox" id="rsAutoCrop" ${autoCropActif() ? 'checked' : ''}>
                <span>Rogner automatiquement les bordures</span>
            </label>
            <label class="rs-label">Luminosité <span id="rsBrightVal">${rs.brightness}%</span></label>
            <input type="range" id="rsBright" min="40" max="100" value="${rs.brightness}" class="rs-range">
            <label class="rs-label">Confort des yeux (lumière chaude) <span id="rsWarmVal">${rs.warm || 0}%</span></label>
            <input type="range" id="rsWarm" min="0" max="100" value="${rs.warm || 0}" class="rs-range">
            <label class="rs-label">Écart entre pages <span id="rsGapVal">${rs.gap}px</span></label>
            <input type="range" id="rsGap" min="0" max="40" value="${rs.gap}" class="rs-range">
            <label class="rs-label">Vitesse défilement auto <span id="rsAutoVal">${(+rs.autospeed || 1.4).toFixed(1)}×</span></label>
            <input type="range" id="rsAuto" min="0.4" max="6" step="0.2" value="${rs.autospeed}" class="rs-range">
            <label class="rs-label">Orientation de l'écran</label>
            ${seg('orientation', [{v:'libre',l:'Libre'},{v:'portrait',l:'Portrait'},{v:'landscape',l:'Paysage'}], rs.orientation)}
            <label class="rs-check">
                <input type="checkbox" id="rsAutoDouble" ${rs.autoDouble === '1' ? 'checked' : ''}>
                <span>Double page automatique en paysage</span>
            </label>
            <label class="rs-check">
                <input type="checkbox" id="rsDecouper" ${rs.decouper === '1' ? 'checked' : ''}>
                <span>Découper les planches doubles en deux pages</span>
            </label>
            <label class="rs-label">Qualité des images</label>
            ${seg('quality', [{v:'high',l:'Haute'},{v:'saver',l:'Éco'}], q)}
            <label class="rs-label">Minuteur de lecture</label>
            <div class="rs-seg" id="rsSleep">
                ${[['0','Off'],['15','15m'],['30','30m'],['45','45m'],['60','60m']].map(([v,l]) =>
                    `<button data-sleep="${v}" class="${String(sleepMins)===v?'on':''}">${l}</button>`).join('')}
            </div>
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
        // Audit AMEL-17 : bascule du recadrage. Le cache de mesures est vidé
        // à chaque changement, sinon désactiver puis réactiver resservirait des
        // marges calculées pour d'autres pages.
        panel.querySelector('#rsDecouper')?.addEventListener('change', e => {
            saveReaderSetting('decouper', e.target.checked ? '1' : '0');
            demi = null;              // on repart de la planche entiere
            rerender();
        });
        panel.querySelector('#rsAutoDouble')?.addEventListener('change', e => {
            saveReaderSetting('autoDouble', e.target.checked ? '1' : '0');
            // Reprise immediate : cocher la case en paysage doit basculer tout
            // de suite, sinon le reglage a l'air sans effet et on le decoche.
            autoDoubleDesarme = false;
            surRotation();
        });
        panel.querySelector('#rsAutoCrop')?.addEventListener('change', e => {
            window.Storage?.setPref(CROP_KEY, e.target.checked ? '1' : '0');
            cropCache.clear();
            document.querySelectorAll('.reader-page-img').forEach(im => {
                im.style.clipPath = ''; im.style.marginTop = ''; im.style.marginBottom = '';
            });
            rerender();
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
        panel.querySelector('#rsSleep')?.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
            panel.querySelectorAll('#rsSleep button').forEach(x => x.classList.remove('on'));
            b.classList.add('on');
            setSleepTimer(+b.dataset.sleep);
        }));
        panel.querySelector('#rsClose').addEventListener('click', toggleReaderSettings);
        panel.querySelector('#rsMarkAll').addEventListener('click', markAllManga);
    }

    // ── Marquer comme lu (en masse) ──
    async function bulkMark(items, msg) {
        // Audit BUG-22 : saveProgress() et markChapterRead() respectaient le mode
        // incognito, pas celui-ci. Le bouton « Marquer ce chapitre (et les
        // précédents) » écrivait donc jusqu'à 18 lignes en base alors que l'app
        // affiche « lecture non enregistrée » — et le geste est irréversible
        // sans dépiler les chapitres un à un.
        if (window.MH?.isIncognito?.(manga?.id)) {
            MH.toast?.('Mode incognito : rien n\'a été enregistré');
            return;
        }
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
        const showPct = (d, n) => { btn.innerHTML = `<span style="font-size:10px;font-weight:700">${Math.round(d / n * 100)}%</span>`; };
        btn.onclick = async () => {
            // Téléchargement en cours : le clic bascule pause ↔ reprise ;
            // maintenir (contextmenu / appui long non géré ici) annule.
            const st = window.Downloads.state?.(currentChap.id);
            if (st === 'running') { window.Downloads.pause(currentChap.id); btn.title = 'Reprendre le téléchargement'; MH.toast?.('Téléchargement en pause'); return; }
            if (st === 'paused')  { window.Downloads.resume(currentChap.id); btn.title = 'Mettre en pause'; MH.toast?.('Téléchargement repris'); return; }
            if (await window.Downloads.has(currentChap.id)) {
                await window.Downloads.remove(currentChap.id);
                setDlIcon(false); MH.toast?.('Téléchargement supprimé');
                return;
            }
            if (!pages.length) { MH.toast?.('Aucune page à télécharger'); return; }
            btn.title = 'Mettre en pause';
            try {
                const r = await window.Downloads.download(
                    { mangaId: manga.id, chapterId: currentChap.id, chapterNum: currentChap.chapter,
                      mangaTitle: manga.title, cover: manga.cover || manga.coverThumb, source: API.sources.current },
                    pages, showPct
                );
                setDlIcon(true);
                MH.toast?.(r?.failed
                    ? `Téléchargé avec ${r.failed} page(s) manquante(s) sur ${r.count}`
                    : 'Chapitre téléchargé pour le hors-ligne');
            } catch (e) {
                setDlIcon(false);
                MH.toast?.(e.message === '__cancelled__' ? 'Téléchargement annulé' : 'Erreur : ' + e.message);
            }
            finally { btn.title = 'Télécharger pour lire hors-ligne'; }
        };
        // Appui long / clic droit sur le bouton = annuler le téléchargement en cours
        btn.oncontextmenu = (e) => {
            if (window.Downloads.isDownloading?.(currentChap.id)) { e.preventDefault(); window.Downloads.cancel(currentChap.id); }
        };
    }

    // ── Préchargement ──
    // ── Préchargement adaptatif (audit AMEL-14) ──────────────
    // La fenêtre était fixe à 3 pages, quelle que soit la liaison. Sur une
    // connexion lente, 3 pages en vol se disputent la bande passante avec
    // celle qu'on regarde ; sur une bonne liaison, 3 pages c'est trop peu et
    // on attend à chaque tour.
    //
    // Deux signaux, dans cet ordre : la durée RÉELLEMENT mesurée des dernières
    // pages (elle intègre tout — réseau, proxy, lenteur de la source), et à
    // défaut `navigator.connection` au premier chargement, quand on n'a encore
    // rien mesuré.
    let dureesPages = [];   // ms des dernières images chargées

    function noterDureePage(ms) {
        if (!(ms > 0)) return;
        dureesPages.push(ms);
        if (dureesPages.length > 8) dureesPages.shift();
    }

    function fenetrePrechargement() {
        if (dureesPages.length >= 3) {
            const triees = [...dureesPages].sort((a, b) => a - b);
            const mediane = triees[Math.floor(triees.length / 2)];
            if (mediane > 2500) return 1;    // liaison poussive : ne pas encombrer
            if (mediane > 900)  return 3;
            return 6;                        // rapide : on prend de l'avance
        }
        // Aucune mesure encore : on se fie à ce que déclare le navigateur.
        const c = navigator.connection;
        if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) return 1;
        if (c && c.effectiveType === '3g') return 2;
        return 3;
    }

    function preloadPage(num) {
        const p = pages[num - 1];
        if (!p) return;
        const t0 = performance.now();
        const im = new Image();
        im.onload = () => noterDureePage(performance.now() - t0);
        im.src = pageSrc(p);
    }
    function preloadNextChapter() {
        const next = neighborChapter(1);
        if (!next) return;
        API.mangas.pages(next.id).then(d => {
            const first = d.pages?.[0];
            // Audit PERF-08 : cette ligne posait l'URL BRUTE. Un seul appel,
            // mais suffisant pour contacter le site source en direct — donc
            // pour rendre l'ensemble de l'effort inutile, puisqu'il suffit
            // d'une requête pour révéler l'adresse IP.
            if (first) { const im = new Image(); im.src = MH.proxify ? MH.proxify(first.url) : first.url; }
        }).catch(() => {});
    }
})();
