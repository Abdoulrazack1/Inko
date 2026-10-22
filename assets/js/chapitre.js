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
    // « Hauteur » par défaut : la planche entière tient à l'écran, comme dans
    // Mihon. « Original » la faisait déborder et obligeait à défiler dans la page.
    const rs = { bg: 'dark', brightness: 100, gap: 8, fit: 'height', direction: 'rtl', autospeed: 1.4, warm: 0,
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
        // `orientation`, `decouper` et `autoDouble` étaient enregistrés mais
        // jamais relus : cochés, ils retombaient à leur défaut à l'ouverture
        // du chapitre suivant.
        ['bg', 'brightness', 'gap', 'fit', 'direction', 'autospeed', 'warm', 'orientation', 'decouper', 'autoDouble'].forEach(k => {
            const v = window.Storage?.getPref('reader_' + k);
            if (v !== undefined && v !== null && v !== '') rs[k] = v;
        });
        rs.brightness = +rs.brightness || 100;
        rs.gap = +rs.gap; if (isNaN(rs.gap)) rs.gap = 8;
        rs.autospeed = +rs.autospeed || 1.4;
        rs.warm = +rs.warm; if (isNaN(rs.warm)) rs.warm = 0;
        rs.continu = window.Storage?.getPref('reader_continu') === '0' ? '0' : '1';
        rs.nuitAuto = window.Storage?.getPref('reader_nuitAuto') === '1' ? '1' : '0';
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
        // Le zoom suit la MEME logique que le mode de lecture, et pour la
        // meme raison : un scan de magazine se lit confortablement a 60 % sur
        // un grand ecran, un webtoon a 100 %. Un seul zoom global obligeait a
        // le refaire a chaque changement de serie - et jusqu'a ce qu'on y
        // pense, le reglage d'une autre serie restait applique a celle-ci.
        if (prefs.zoom)               zoom = prefs.zoom;
        if (prefs['zoom_' + mangaId]) zoom = prefs['zoom_' + mangaId];
        loadReaderSettings();
        if (prefs.readingDir) rs.direction = prefs.readingDir;
        // Nuit progressive : réévaluée chaque minute (armée ici, à l'entrée du
        // lecteur, et non au chargement du module).
        setInterval(() => { if (rs.nuitAuto === '1') applyReaderSettings(); }, 60 * 1000);

        // IX.8 : orientation et double page automatique. Le verrou est posé
        // ICI, à l'entrée du lecteur, et relâché en le quittant — verrouiller
        // toute l'application pour un confort de lecture serait un effet de
        // bord que personne ne relierait à ce réglage.
        appliquerOrientation();

        // ── Temps passé à lire ──────────────────────────────
        //
        // Compté par TRANCHES envoyées régulièrement, pas au départ de la
        // page : fermer l'application, verrouiller le téléphone ou perdre la
        // batterie n'enverrait alors jamais rien, et la statistique la plus
        // parlante serait celle qui manque le plus souvent.
        //
        // Le compteur s'arrête quand l'onglet passe en arrière-plan : un
        // téléphone posé écran allumé sur une planche n'est pas de la lecture,
        // et gonfler le chiffre le rendrait inutile.
        (function compterLeTemps() {
            const TRANCHE = 30000;
            let credit = 0;
            let derniere = Date.now();
            let visible = !document.hidden;

            const verser = () => {
                if (credit < 5) return;             // sous 5 s, ce n'est pas de la lecture
                const sec = Math.round(credit);
                credit = 0;
                window.API?.me?.ajouterTempsLecture?.(sec);
            };

            document.addEventListener('visibilitychange', () => {
                const t = Date.now();
                if (visible) credit += (t - derniere) / 1000;
                visible = !document.hidden;
                derniere = t;
                if (!visible) verser();             // on verse EN PARTANT
            });

            setInterval(() => {
                const t = Date.now();
                if (visible) credit += (t - derniere) / 1000;
                derniere = t;
                verser();
            }, TRANCHE);

            // Dernière chance : la page se ferme.
            window.addEventListener('pagehide', verser);
        })();

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
        // La décision dépend du format RÉEL des planches : on la reprend dès
        // que la première est mesurée (avant, on ne connaît que la fenêtre).
        document.addEventListener('load', (e) => {
            const im = e.target;
            if (!im.classList?.contains('reader-page-img') || !im.naturalWidth) return;
            const idx = +im.dataset.idx;
            if (!Number.isInteger(idx) || pageRatios.has(idx)) return;
            const premiere = !ratiosConnus();
            pageRatios.set(idx, im.naturalHeight / im.naturalWidth);
            if (premiere) rotation();
        }, true);

        showLoader('Chargement…');
        // Source momentanément saturée : api.js réessaie seul ; on le dit.
        const surReessai = (ev) => {
            const sec = Math.round((ev.detail?.attente || 0) / 1000);
            showLoader(`Source occupée — nouvel essai dans ${sec} s…`);
        };
        window.addEventListener('api:retry', surReessai);

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
            window.removeEventListener('api:retry', surReessai);
            manga    = m;
            chapters = chapsData.results || [];
            currentChap = chapters.find(c => c.id === chapterId);
            if (!currentChap) {
                // Fallback : objet minimal
                currentChap = { id: chapterId, chapter: '?', pages: pagesData.pages?.length || 0 };
            }
            pages = pagesData.pages || [];
            totalPages = pages.length;

            // Zéro page n'est PAS un succès.
            //
            // La source rend un objet parfaitement formé, avec une liste de
            // pages vide — aucune exception n'est levée. Le lecteur poursuivait
            // donc son montage, ne dessinait rien, et laissait « Chargement… »
            // à l'écran pour toujours. Constaté à la main sur un identifiant de
            // chapitre inventé : zéro image, zéro erreur, un spinner éternel.
            // C'est le pire des états — l'utilisateur attend quelque chose qui
            // n'arrivera jamais, et rien ne lui dit d'abandonner.
            if (!totalPages) {
                // Une entrée vide ne doit pas devenir un cul-de-sac. On la
                // retient pour la session (neighborChapter la sautera), et si
                // l'on arrive en tournant les chapitres, on poursuit dans le
                // même sens au lieu d'arrêter la lecture sur un écran d'erreur.
                retenirChapitreVide(chapterId);
                const saut = +params.get('saut');
                const suite = (saut === 1 || saut === -1) ? neighborChapter(saut) : null;
                if (suite) {
                    MH.toast?.(`Chapitre ${currentChap.chapter} vide à la source — on passe au ${saut > 0 ? 'suivant' : 'précédent'}`);
                    location.replace(urlChapitre(suite, saut));
                    return;
                }
                showError('Ce chapitre ne contient aucune page', neighborChapter(1));
                return;
            }

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
            armerMinuteur(lireMinuteur(), true);   // le minuteur survit au changement de chapitre
        } catch (e) {
            showError(e);
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
    /**
     * L'écran d'échec du lecteur.
     *
     * Deux défauts, mesurés par l'audit des états (toutes les requêtes `/api`
     * coupées) : la page rendait trente-neuf caractères, et le message était
     * « Impossible de charger le chapitre : Failed to fetch » — un code
     * technique. Surtout, il n'y avait **aucun « Réessayer »** : la panne la
     * plus fréquente d'un lecteur (le réseau qui cligne) n'offrait que
     * « Retour » et « Accueil », c'est-à-dire abandonner.
     *
     * `history.back()` est branché en écouteur, plus en `href="javascript:"` :
     * un lien pareil ne s'ouvre pas dans un onglet, ne se copie pas, et va
     * contre le retrait annoncé de `script-src-attr 'unsafe-inline'`.
     */
    function showError(err, suivant) {
        const el = document.getElementById('readerPagesArea');
        if (!el) return;
        const retour = { libelle: '↩ Retour', onClick: () => history.back() };
        const versSuivant = suivant ? [{ libelle: `Chapitre ${suivant.chapter} →`, href: urlChapitre(suivant, 1) }] : [];
        const accueil = { libelle: 'Accueil', href: 'accueil.html' };

        if (err instanceof Error) {
            // La source vient de l'URL : elle n'est pas une variable de ce
            // module, et `source` tout court aurait silencieusement designé
            // `window.source`.
            const src = new URLSearchParams(location.search).get('source') || undefined;
            const m = MH.messageErreur(err, { onRetry: () => location.reload(), source: src });
            m.actions = [...(m.actions || []), retour, accueil];
            MH.poserEtatVide(el, m);
            el.firstChild?.setAttribute('role', 'alert');
            return;
        }
        MH.poserEtatVide(el, {
            icone: '\u{1F517}',
            titre: String(err || 'Chapitre indisponible'),
            texte: suivant ? 'La source liste ce chapitre sans en fournir les pages.' : 'Le lien est peut-être incomplet.',
            actions: [...versSuivant, retour, accueil],
        });
    }


    /**
     * Date courte d'un chapitre, pour le sélecteur.
     *
     * Vide si la source ne date pas ses chapitres : mieux vaut rien qu'une
     * date inventée, et toutes ne datent pas (Gutenberg rend un livre entier).
     */
    function dateCourte(c) {
        if (!c || !c.publishedAt) return '';
        const d = new Date(c.publishedAt);
        if (Number.isNaN(d.getTime())) return '';
        return ' · ' + d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    }

    // ── Toolbar ──
    function renderToolbar() {
        const el = document.getElementById('readerToolbar');
        if (!el) return;
        const asc      = chapitresTries();
        const prevChap = neighborChapter(-1);
        const nextChap = neighborChapter(1);

        el.innerHTML = `
        <div class="toolbar-left">
            <!-- « &source= » manquait ici, alors que le lecteur de romans le
                 porte : un identifiant sans sa source part a la source
                 COURANTE (BUG-01). Ca tenait parce que l'init la pose depuis
                 l'URL, pas parce que le lien etait juste. -->
            <a href="serie.html?id=${encodeURIComponent(manga.id)}&source=${encodeURIComponent(API.sources.current)}" class="toolbar-back">← ${MH.esc(manga.title)}</a>
            <span class="toolbar-sep">/</span>
            <span class="toolbar-chap">${MH.unitLabel(API.sources.current, { short: true })} ${currentChap.chapter}</span>
            <span class="toolbar-source" title="Source de ce chapitre">${MH.esc(MH.sourceName?.(API.sources.current) || API.sources.current || '')}</span>
        </div>
        <div class="toolbar-center">
            <button class="reader-icon-btn" ${!prevChap ? 'disabled' : ''} id="btnPrevChap" title="Chapitre précédent (←)" aria-label="Chapitre précédent">‹</button>
            <select class="reader-chap-select" id="chapSelect">
                ${asc.slice().reverse().map(c =>
                    `<option value="${c.id}" ${c.id === currentChap.id ? 'selected' : ''}>${MH.unitLabel(API.sources.current, { short: true })} ${c.chapter}${c.title ? ' — ' + c.title : ''}${dateCourte(c)}</option>`
                ).join('')}
            </select>
            <button class="reader-icon-btn" ${!nextChap ? 'disabled' : ''} id="btnNextChap" title="Chapitre suivant (→)" aria-label="Chapitre suivant">›</button>
        </div>
        <div class="toolbar-right">
            <!-- Cinq gestes visibles — ceux qu'on fait en lisant. Le reste
                 (marquer lu, défilement auto, immersif, partage, zoom) vit
                 dans « ⋯ » : quinze icônes sans libellé ne se lisent pas. -->
            <button class="reader-icon-btn" id="btnBookmark" title="Ajouter un signet sur cette page (B)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
            </button>
            <button class="reader-icon-btn" id="btnNotes" title="Mes notes de lecture (J)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
            </button>
            <button class="reader-icon-btn" id="btnDownload" title="Télécharger pour lire hors-ligne"></button>
            <button class="reader-icon-btn" id="btnFullscreen" title="Plein écran">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
            </button>
            <button class="reader-icon-btn" id="btnReaderSettings" title="Réglages du lecteur">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="17" height="17"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            </button>
            <div class="reader-more" data-pop-wrap>
                <button class="reader-icon-btn" id="btnReaderMore" title="Plus d'actions" aria-label="Plus d'actions" aria-haspopup="menu" aria-expanded="false">⋯</button>
                <div class="reader-pop" id="readerMoreMenu" role="menu" hidden>
                    <button class="reader-pop-item" id="btnMarkRead" role="menuitem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg><span>Marquer lu jusqu'ici</span></button>
                    <button class="reader-pop-item" id="btnAutoScroll" role="menuitem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true"><path d="M12 5v14"/><path d="m6 13 6 6 6-6"/></svg><span>Défilement automatique</span><kbd>A</kbd></button>
                    <button class="reader-pop-item" id="btnImmersive" role="menuitem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3m13-5v3a2 2 0 0 1-2 2h-3"/></svg><span>Mode immersif</span><kbd>I</kbd></button>
                    <button class="reader-pop-item" id="btnShare" role="menuitem"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 13.5 6.8 4M15.4 6.5l-6.8 4"/></svg><span>Partager ce chapitre</span></button>
                    <div class="reader-pop-zoom">
                        <span>Zoom</span>
                        <button class="reader-icon-btn" id="btnZoomOut" title="Zoom −" aria-label="Zoom moins">−</button>
                        <span class="reader-zoom-label" id="zoomLabel">${zoom}%</span>
                        <button class="reader-icon-btn" id="btnZoomIn" title="Zoom +" aria-label="Zoom plus">+</button>
                    </div>
                </div>
            </div>
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
        brancherMenuLecteur();
        window.NotesUI?.updateBadge?.(notesContext());
        refreshBookmarkBtn();
        wireDownloadBtn();
        updateAutoBtn();
        const chapURL = (id) => `chapitre.html?manga=${encodeURIComponent(manga.id)}&chapter=${encodeURIComponent(id)}&source=${encodeURIComponent(API.sources.current)}`;
        document.getElementById('chapSelect')?.addEventListener('change', e => { window.location.href = chapURL(e.target.value); });
        document.getElementById('btnPrevChap')?.addEventListener('click', () => { if (prevChap) window.location.href = urlChapitre(prevChap, -1); });
        document.getElementById('btnNextChap')?.addEventListener('click', () => { if (nextChap) window.location.href = urlChapitre(nextChap, 1); });
    }

    // Menu « ⋯ » du lecteur : fermé au clic ailleurs, par Échap, ou après
    // une action (sauf le zoom, qu'on ajuste en plusieurs clics).
    let menuLecteurBranche = false;
    function brancherMenuLecteur() {
        const btn = document.getElementById('btnReaderMore');
        const pop = document.getElementById('readerMoreMenu');
        if (!btn || !pop) return;
        const fermer = () => { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const ouvrir = pop.hidden;
            pop.hidden = !ouvrir;
            btn.setAttribute('aria-expanded', String(ouvrir));
        });
        pop.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.target.closest('.reader-pop-item')) fermer();
        });
        if (menuLecteurBranche) return;
        menuLecteurBranche = true;
        document.addEventListener('click', () => {
            const p = document.getElementById('readerMoreMenu');
            if (p && !p.hidden) { p.hidden = true; document.getElementById('btnReaderMore')?.setAttribute('aria-expanded', 'false'); }
        });
        document.addEventListener('keydown', (e) => {
            const p = document.getElementById('readerMoreMenu');
            if (e.key === 'Escape' && p && !p.hidden) { e.stopImmediatePropagation(); p.hidden = true; document.getElementById('btnReaderMore')?.focus(); }
        }, true);
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
            const pageAvant = currentPage;   // le rendu va la remettre a 1
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
            // Les bornes du zoom dépendent du mode : passer en défilement avec
            // 150 % en mémoire afficherait une planche à 100 % sous une
            // étiquette « 150 % ». On renormalise avant de redessiner.
            appliquerZoom(zoom);
            renderPage(currentPage);
            // Changer de mode ramenait en haut du chapitre. Mesure sur
            // Blue Lock, 73 pages : page 20 en mode page, bascule en
            // defilement, scrollY = 0 et « 1 % lu » — dix-neuf pages en
            // arriere, sans un mot. Le sens inverse marchait deja, parce
            // que l'observateur de defilement tient `currentPage`.
            //
            // `applyInitialScroll` fait exactement ce travail a l'ouverture
            // d'un chapitre repris : on l'appelle plutot que d'en ecrire une
            // seconde version qui derivera.
            if (readMode === 'scroll') applyInitialScroll(pageAvant);
            else resetPagedScroll(1);
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

    // La place qu'une planche occupera vraiment, en pixels.
    //
    // `width:100%` + `aspect-ratio` ne reservait presque rien. Dans une colonne
    // flex en `align-items:center`, la largeur de la ligne est INDEFINIE : un
    // pourcentage n'a rien contre quoi se resoudre, la largeur repasse en auto,
    // et c'est alors le `min-height:120px` de la feuille qui pilote la boite —
    // par l'aspect-ratio, en sens inverse. Mesure sur Blue Lock, 73 pages,
    // fenetre 1100x900 :
    //
    //     marque-place    84 x 120 px
    //     planche chargee 559 x 796 px
    //
    // La barre de defilement annoncait donc 20 000 px pour un chapitre qui en
    // fait trois fois plus, et toute reprise de position visait a cote.
    //
    // La hauteur reelle est bornee par `max-height: 88vh` (feuille), et
    // `object-fit: contain` ramene la largeur a hauteur/ratio : c'est
    // exactement ce que la planche chargee mesure.
    const PLAFOND_VH = 0.88;            // .reader-page-img { max-height: 88vh }
    function boiteReservee(idx) { return boitePour(ratioOf(idx)); }
    function boitePour(ratio) {
        const area = document.getElementById('readerPagesArea');
        const pct = Math.max(20, Math.min(100, zoom)) / 100;
        const largeurColonne = (area ? area.clientWidth : window.innerWidth) * pct;
        const h = Math.min(largeurColonne * ratio, window.innerHeight * PLAFOND_VH);
        return { w: Math.round(h / ratio), h: Math.round(h) };
    }

    // Marque-place : une image SANS src mais avec sa hauteur réservée
    function placeholderImg(idx) {
        const b = boiteReservee(idx);
        return `<img class="reader-page-img" data-idx="${idx}" data-page="${idx + 1}"
                 alt="Page ${idx + 1}" decoding="async"
                 style="width:${b.w}px;height:${b.h}px"
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
                    // La boite reservee suit le ratio reel : au dechargement,
                    // la page gardera exactement la place qu'elle occupait.
                    const b = boiteReservee(idx);
                    img.style.width = b.w + 'px';
                    img.style.height = b.h + 'px';
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
        suite = null;   // la suite accrochée vivait dans le contenu qu'on remplace
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

        } else {
            imgs.forEach(im => enqueueLoad(im));   // repli : navigateurs sans IO
        }

        // Suit la planche sous le MILIEU de l'écran (avance ET retours) et
        // pilote la fenêtre. C'était un IntersectionObserver au seuil 0,3 :
        // la dernière entrée traitée gagnait, quelle que soit la planche
        // réellement lue. Mesuré dans Chromium, 20 planches, fenêtre 900 px :
        //     planches de 796 px    30 positions fausses sur 111
        //     planches de 4000 px  551 sur 579 — « page 20/20 » dès l'ouverture
        // Un webtoon a justement des planches plus hautes que l'écran. Les
        // boîtes sont réservées d'emblée et dans l'ordre vertical : une
        // recherche dichotomique par image d'animation suffit.
        let rafSuivi = 0;
        const suivrePage = () => {
            rafSuivi = 0;
            if (!imgs.length || !imgs[0].isConnected) return;
            const milieu = window.innerHeight / 2;
            let lo = 0, hi = imgs.length - 1, idx = imgs.length - 1;
            while (lo <= hi) {
                const m = (lo + hi) >> 1;
                if (imgs[m].getBoundingClientRect().bottom < milieu) lo = m + 1;
                else { idx = m; hi = m - 1; }
            }
            // En bas du document, la dernière planche est lue même si elle
            // est trop courte pour atteindre le milieu de l'écran.
            const enBas = window.innerHeight + Math.ceil(window.scrollY) >= document.documentElement.scrollHeight - 2;
            if (enBas) idx = imgs.length - 1;
            const p = idx + 1;
            if (p !== currentPage) { currentPage = p; updateUIPage(p); }
            refreshWindow(idx);
            // La barre avance DANS la planche : sur une bande de webtoon de
            // 4000 px, elle restait figée le temps de dix écrans.
            const r = imgs[idx].getBoundingClientRect();
            const dans = enBas ? 1 : Math.max(0, Math.min(1, (milieu - r.top) / (r.height || 1)));
            const fill = document.getElementById('readerProgressFill');
            if (fill) fill.style.width = `${((idx + dans) / totalPages) * 100}%`;
        };
        const surDefilement = () => { if (!rafSuivi) rafSuivi = requestAnimationFrame(suivrePage); };
        window.addEventListener('scroll', surDefilement, { passive: true });
        window.addEventListener('resize', surDefilement, { passive: true });
        // Une planche qui arrive prend sa vraie hauteur et décale tout ce qui
        // suit, sans qu'aucun `scroll` ne parte : la page annoncée restait
        // celle d'avant le décalage.
        if ('ResizeObserver' in window) {
            const ro = new ResizeObserver(surDefilement);
            ro.observe(el.querySelector('.reader-scroll-wrapper'));
            scrollObservers.push(ro);
        }
        scrollObservers.push({ disconnect() {
            window.removeEventListener('scroll', surDefilement);
            window.removeEventListener('resize', surDefilement);
            if (rafSuivi) cancelAnimationFrame(rafSuivi);
        } });

        refreshWindow(Math.max(0, currentPage - 1));   // amorce autour de la position courante
        updateUIPage(currentPage);
    }

    // ── Pages doubles en mode double ─────────────────────────
    // Une planche panoramique (deux pages imprimées d'un seul tenant) était
    // collée à sa voisine. Mesuré sur 1600 px : panoramique 1114 px + page
    // 557 px = 1671 px, la planche déborde et la voisine n'a rien à voir avec
    // le dessin d'un seul tenant qu'on regarde. Une panoramique
    // s'affiche donc SEULE, et la page qui la précède aussi — sinon on
    // l'apparierait à une page qui n'est pas sa vraie voisine d'impression.
    // Le format vient de `pageRatios`, rempli au chargement et au
    // préchargement : en général connu avant qu'on arrive sur la page.
    function pageLarge(n) {
        const r = pageRatios.get(n - 1);   // hauteur / largeur
        return !!r && r < 1 / 1.2;         // même seuil que estDouble()
    }
    /** Combien de pages afficher à partir de `num` : 1 ou 2. */
    function uniteDouble(num, total, large) {
        if (num >= total || large(num) || large(num + 1)) return 1;
        return 2;
    }
    /** Début de l'unité qui précède `num`, sans jamais réafficher `num`. */
    function uniteAvant(num, large) {
        const s = num - 1;
        if (s < 1) return null;
        if (large(s) || s - 1 < 1 || large(s - 1)) return { base: s, n: 1 };
        return { base: s - 1, n: 2 };
    }
    let doubleCount = 2;   // pages affichées par la planche courante

    function renderDouble(num, n) {
        const el = document.getElementById('readerPagesArea');
        if (!el) return;
        if (num < 1) num = 1;
        doubleBase = num;              // ancre de la planche
        doubleCount = n || uniteDouble(num, totalPages, pageLarge);
        el.classList.remove('reader-scrollmode');
        el.classList.add('paged');     // défilement interne si la planche dépasse l'écran
        const cur  = pages[num - 1];   // page courante (num)
        const next = doubleCount === 2 ? pages[num] : null;   // page suivante (num+1)
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
        // Une planche affichée se révèle panoramique au chargement : on refait
        // l'appariement (une seule fois, l'unité ne change plus ensuite).
        el.querySelectorAll('.reader-page-img').forEach(im => im.addEventListener('load', () => {
            if (!im.naturalWidth) return;
            pageRatios.set(+im.dataset.idx, im.naturalHeight / im.naturalWidth);
            if (readMode === 'double' && doubleBase === num && n !== 1
                && uniteDouble(num, totalPages, pageLarge) !== doubleCount) renderDouble(num);
        }, { once: true }));
        updateUIPage(next ? num + 1 : num);
    }

    function updateUIPage(p) {
        currentPage = p;   // MAJ immédiate → l'affichage (numéro, barre) est toujours juste
        // Audit AMEL-14 : fenêtre ajustée à la vitesse réellement mesurée.
        const fenetre = fenetrePrechargement();
        for (let i = 1; i <= fenetre; i++) preloadPage(p + i);
        // À l'approche de la fin, on prépare VRAIMENT le chapitre suivant.
        // C'est ici qu'il sert, pas au chargement de la page — où l'on est à
        // la planche 1 et où le cache mémoire a tout le temps d'évincer.
        if (totalPages && p >= totalPages - 2) preloadNextChapter({ profond: true });
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

        if (sleepEchu && p >= totalPages) afficherRappelMinuteur();
        // Sauvegarde progression (debounce)
        if (p === totalPages && API.isLoggedIn()) markChapterRead();
        debouncedSave();

        // Audit AMEL-15 : c'est ICI que la fin du chapitre est constatée.
        // Quitter la dernière page (retour en arrière) annule l'enchaînement —
        // sinon on serait emmené au chapitre suivant après avoir explicitement
        // fait demi-tour.
        if (readMode === 'scroll' && rs.continu === '1' && p >= totalPages - 1) preparerSuite();
        if (p >= totalPages && autoNextActif() && !sleepEchu && !(readMode === 'scroll' && rs.continu === '1')) armerEnchainement(chapitreSuivant());
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
    // `page` explicite : au changement de mode, l'observateur de
    // defilement repose `currentPage` a 1 des que les premieres planches
    // entrent dans la fenetre — avant que ce minuteur ne parte. Lire
    // `currentPage` ici ramenait donc en haut, ce qui etait precisement le
    // defaut qu'on corrige.
    function applyInitialScroll(page) {
        // À l'ouverture (pas au changement de mode, où `page` est donné) :
        // la position fine notée sur cet appareil, si elle désigne la même
        // planche à une près — l'observateur compte une planche comme « vue »
        // dès 30 % visible, la page sauvegardée peut donc précéder l'ancre.
        let cible = page || currentPage;
        const fine = page ? null : lirePositionFine();
        if (fine && Math.abs(fine.p - cible) <= 1) cible = fine.p;
        const frac = fine && fine.p === cible ? fine.f : 0;
        if (readMode !== 'scroll' || !(cible > 1 || frac > 0)) {
            window.scrollTo(0, 0);   // démarre toujours en haut (page 1 visible)
            return;
        }
        // Viser UNE fois ne suffit pas : la hauteur des planches bouge pendant
        // que les premieres images arrivent, et la cible glisse sous le
        // curseur. Mesure sur Blue Lock, 73 pages : un seul `scrollIntoView`
        // a 250 ms posait le defilement a 10 815 px sur un chapitre qui n'en
        // fait que 11 109 — le bas du chapitre, pas la page 20.
        //
        // On rectifie donc pendant une seconde et demie, et on s'arrete des
        // que le lecteur defile lui-meme : reprendre la main sur son propre
        // defilement serait pire que de rater la page.
        // On s'arrete au premier geste du lecteur, pas au premier mouvement
        // du defilement : les images qui arrivent au-dessus font bouger
        // `scrollY` toutes seules, et prendre ca pour un geste faisait
        // abandonner l'ancrage des la premiere planche chargee.
        let essais = 0, rendu = false;
        const lacher = () => { rendu = true; };
        const GESTES = ['wheel', 'touchstart', 'keydown', 'mousedown'];
        GESTES.forEach(g => window.addEventListener(g, lacher, { once: true, passive: true }));
        const arreter = () => GESTES.forEach(g => window.removeEventListener(g, lacher));
        const viser = () => {
            if (rendu || readMode !== 'scroll') { arreter(); return; }
            const img = document.querySelector(`.reader-page-img[data-page="${cible}"]`);
            if (img) {
                const r = img.getBoundingClientRect();
                const ecart = r.top + frac * r.height;   // 0 : la ligne lue est en haut de l'écran
                if (Math.abs(ecart) > 8) window.scrollBy(0, ecart);
            }
            if (++essais < 14) setTimeout(viser, 130);
            else arreter();
        };
        setTimeout(viser, 120);
    }

    // ── Reprise au pixel près en mode défilement ─────────────
    // La progression ne retient qu'un numéro de page : rouvrir un chapitre
    // en défilement reposait le HAUT de la planche en haut de l'écran. Sur un
    // webtoon, une « planche » fait souvent trois ou quatre écrans — on
    // reprenait jusqu'à trois écrans en arrière. On note donc, sur cet
    // appareil, quelle part de la planche est déjà passée au-dessus de l'écran.
    // Local seulement : la fraction n'a de sens qu'avec la page, et la
    // progression serveur garde son format.
    const CLE_POS_FINE = 'inko_pos_fine', MAX_POS_FINE = 60;
    const clePosFine = () => `${manga?.id}|${currentChap?.id}`;
    function lirePositionFine() {
        try {
            const v = JSON.parse(localStorage.getItem(CLE_POS_FINE) || '{}')[clePosFine()];
            return v && v.p >= 1 && v.f >= 0 && v.f < 1 ? v : null;
        } catch (e) { return null; }
    }
    function noterPositionFine() {
        if (readMode !== 'scroll' || !manga || !currentChap) return;
        if (window.MH?.isIncognito?.(manga.id)) return;   // lecture privée : rien ne reste
        const imgs = document.querySelectorAll('.reader-page-img[data-page]');
        for (const im of imgs) {
            const r = im.getBoundingClientRect();
            if (r.top <= 0 && r.bottom > 0 && r.height > 0) {
                try {
                    const toutes = JSON.parse(localStorage.getItem(CLE_POS_FINE) || '{}');
                    delete toutes[clePosFine()];   // réinsérée en dernier : la plus récente
                    toutes[clePosFine()] = { p: +im.dataset.page, f: Math.round((-r.top / r.height) * 1e4) / 1e4 };
                    const cles = Object.keys(toutes);
                    cles.slice(0, Math.max(0, cles.length - MAX_POS_FINE)).forEach(k => delete toutes[k]);
                    localStorage.setItem(CLE_POS_FINE, JSON.stringify(toutes));
                } catch (e) { /* stockage plein ou bloqué : la reprise à la page suffit */ }
                return;
            }
        }
    }
    let posFineTimer = null;
    window.addEventListener('scroll', () => {
        if (posFineTimer) return;
        posFineTimer = setTimeout(() => { posFineTimer = null; noterPositionFine(); }, 300);
    }, { passive: true });
    window.addEventListener('pagehide', noterPositionFine);

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
        // Même voisin que les touches N et la transition de fin : ce bloc
        // triait par `a.chapter - b.chapter`, qui rend NaN sur « Extra » ou
        // « Bonus 1 » — il pouvait annoncer un autre chapitre que celui où
        // menait la flèche.
        const next = neighborChapter(1);
        if (!next) { el.innerHTML = finDeSerie(); return; }
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

    // Au dernier chapitre, le bloc « À suivre » disparaissait et la flèche
    // suivante restait grisée sans un mot : on ne savait pas si la série
    // était finie, en pause, ou si le suivant manquait.
    function finDeSerie() {
        const statut = manga?.status;
        const titre = statut === 'completed' ? 'Série terminée'
            : statut === 'cancelled' ? 'Série arrêtée'
            : statut === 'hiatus' ? 'Série en pause'
            : 'Tu es à jour';
        const texte = statut === 'completed' ? `Tu as lu le dernier chapitre de ${MH.esc(manga.title)}.`
            : statut === 'cancelled' ? "La publication a été arrêtée : il n'y aura pas de suite."
            : `C'est le dernier chapitre paru pour l'instant.`;
        return `
        <div class="reader-next-chapter reader-fin-serie" role="status">
            <div class="next-chapter-cover">
                <img src="${MH.cover(manga.coverThumb, manga.cover)}" alt="" loading="lazy">
            </div>
            <div class="next-chapter-info">
                <div class="next-chapter-label">${titre}</div>
                <div class="next-chapter-title">${texte}</div>
            </div>
            <a href="serie.html?id=${encodeURIComponent(manga.id)}&source=${encodeURIComponent(API.sources.current)}" class="btn btn-ghost">Voir la fiche</a>
        </div>`;
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
        return neighborChapter(1);
    }
    // ── Lecture continue en défilement ───────────────────────
    // En défilement, la fin d'un chapitre était un mur : un bloc « Chapitre
    // suivant », un clic, un rechargement complet du lecteur, et on
    // repartait en haut d'une page vide le temps que la première planche
    // arrive. Sur un webtoon, c'est une coupure toutes les trois minutes.
    //
    // À l'avant-dernière planche, on va chercher les pages du chapitre suivant
    // et on les accroche SOUS le chapitre courant, avec son titre. Quand ce
    // titre passe au-dessus de l'écran, le lecteur bascule sur place : le
    // chapitre suivant devient le chapitre courant (adresse, titre,
    // progression, barre), sans rechargement. La planche sous les yeux reste
    // au même pixel : les marque-places reçoivent les formats déjà mesurés.
    let suite = null;   // { chap, pages, ratios, el } une fois accrochée
    let suiteEcoute = false;
    async function preparerSuite() {
        if (suite || readMode !== 'scroll') return;
        const chap = chapitreSuivant();
        if (!chap) return;
        const pourChap = currentChap.id;
        suite = { chap, pages: null, ratios: [], el: null };
        let data;
        try { data = await API.mangas.pages(chap.id); } catch (e) { suite = null; return; }
        // Entre-temps : mode changé, chapitre changé, ou rendu refait.
        if (readMode !== 'scroll' || currentChap.id !== pourChap || !suite || suite.chap !== chap) return;
        const liste = data?.pages || [];
        if (!liste.length) { suite = null; return; }
        suite.pages = liste;
        const zone = document.getElementById('readerPagesArea');
        const colonne = zone?.querySelector('.reader-scroll-wrapper');
        if (!colonne) { suite = null; return; }
        const widthPct = Math.max(20, Math.min(100, zoom));
        const el = document.createElement('section');
        el.className = 'reader-suite';
        el.setAttribute('aria-label', `Suite : chapitre ${chap.chapter}`);
        el.innerHTML = `<div class="reader-suite-tete">${MH.esc(MH.unitLabel(API.sources.current, { short: true }))} ${MH.esc(String(chap.chapter))}${chap.title ? ' · ' + MH.esc(chap.title) : ''}</div>
            <div class="reader-scroll-wrapper" style="display:flex;flex-direction:column;align-items:center;gap:${rs.gap}px;width:${widthPct}%;margin:0 auto">
            ${liste.map((p, i) => { const b = boitePour(RATIO_DEFAUT); return `<img class="reader-page-img reader-suite-img" data-i="${i}" alt="Page ${i + 1}" loading="lazy" decoding="async"
                style="width:${b.w}px;height:${b.h}px;background:var(--bg2,#141414)" src="${MH.esc(pageSrc(p))}">`; }).join('')}
            </div>`;
        el.querySelectorAll('.reader-suite-img').forEach(im => im.addEventListener('load', () => {
            if (!im.naturalWidth) return;
            im.classList.add('loaded');   // même fondu que les planches du chapitre
            const r = im.naturalHeight / im.naturalWidth;
            suite && (suite.ratios[+im.dataset.i] = r);
            const b = boitePour(r);
            im.style.width = b.w + 'px'; im.style.height = b.h + 'px';
        }, { once: true }));
        colonne.after(el);
        suite.el = el;
        if (!suiteEcoute) {
            suiteEcoute = true;
            let prevu = false;
            window.addEventListener('scroll', () => {
                if (prevu) return;
                prevu = true;
                requestAnimationFrame(() => { prevu = false; surveillerSuite(); });
            }, { passive: true });
        }
    }
    function surveillerSuite() {
        if (!suite?.el || readMode !== 'scroll') return;
        const tete = suite.el.querySelector('.reader-suite-tete');
        if (tete && tete.getBoundingClientRect().bottom <= 0) basculerSurSuite();
    }
    function basculerSurSuite() {
        const s = suite;
        // La planche sous le haut de l'écran : c'est elle qui ne doit pas bouger.
        // (Les images de la suite portent aussi `reader-page-img` : même CSS,
        // donc même boîte que les marque-places qui vont les remplacer.)
        const imgs = [...s.el.querySelectorAll('.reader-suite-img')];
        const ancre = imgs.find(im => im.getBoundingClientRect().bottom > 0) || imgs[0];
        const k = +ancre.dataset.i, haut = ancre.getBoundingClientRect().top;

        currentChap = s.chap;
        pages = s.pages;
        totalPages = pages.length;
        pageRatios.clear();
        s.ratios.forEach((r, i) => { if (r) pageRatios.set(i, r); });
        currentPage = k + 1;
        suite = null;
        annulerEnchainement();
        history.replaceState(null, '', `chapitre.html?manga=${encodeURIComponent(manga.id)}&chapter=${encodeURIComponent(currentChap.id)}&source=${encodeURIComponent(API.sources.current)}`);
        document.getElementById('pageTitle').textContent =
            `${manga.title} — ${MH.unitLabel(API.sources.current, { short: true })} ${currentChap.chapter}`;
        renderToolbar();
        renderModebar();
        renderPage(currentPage);
        renderThumbnails();
        renderNavigation();
        renderNextChapter();
        renderDetails();
        const img = document.querySelector(`.reader-page-img[data-page="${k + 1}"]`);
        // `instant` : le document défile en douceur (scroll-behavior: smooth),
        // et une compensation animée se verrait glisser.
        if (img) window.scrollBy({ top: img.getBoundingClientRect().top - haut, behavior: 'instant' });
        saveProgress();
        preloadNextChapter();
        const hA11y = document.getElementById('readerTitreA11y');
        if (hA11y) hA11y.textContent = `${manga.title} — chapitre ${currentChap.chapter}`;
        MH.announce?.(`Chapitre ${currentChap.chapter}`);
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
            <h2 class="reader-block-title">Détails</h2>
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
            const avant = dir < 0 ? uniteAvant(doubleBase, pageLarge) : null;
            const target = dir > 0 ? doubleBase + doubleCount : (avant ? avant.base : 0);
            if (target < 1) { if (neighborChapter(-1)) showChapterTransition(-1); return; }
            if (target > totalPages) { showChapterTransition(1); return; }
            renderDouble(target, avant?.n);
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

        // Audit AMEL-18 : le double-clic de bureau ne vaut que sur l'image.
        // Les bandes de navigation (page-zone-prev / page-zone-next) couvrent
        // 35 % de chaque côté : y double-cliquer tourne deux pages, et le
        // gestionnaire posé par `bindKeyboard` s'y retire de lui-même puisqu'il
        // exige `.reader-page-img`. Il ne reste donc actif que dans la bande
        // centrale. Le geste de bureau à recommander est Ctrl + molette, sans
        // aucun conflit et ancré au curseur (voir bindWheel).
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
                if (now - lastTap < 300) { lastTap = 0; zoomerSurCase({ x: t.clientX, y: t.clientY }, e.target.closest?.('.reader-page-img')); }
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

    // Point d'entrée unique du zoom. Il ne l'était pas : trois fonctions
    // écrivaient chacune sa version — celle-ci pour le pinch, `changeZoom`
    // pour les boutons et le clavier, `toggleTapZoom` pour le double-tap —
    // avec trois bornes différentes et deux façons d'appliquer l'échelle.
    // Deux défauts en sortaient, tous deux atteignables au doigt :
    //
    //   · pincer jusqu'à 400 % puis toucher « − » retombait à 200 %, parce que
    //     `changeZoom` plafonnait là. Un « −10 % » qui divise par deux.
    //   · en défilement, le pinch posait `transform: scale()` sur la colonne
    //     d'images empilées — précisément ce que `changeZoom` évite depuis un
    //     correctif, la mise à l'échelle faisant déborder le bas du chapitre
    //     hors de la zone défilable, donc hors d'atteinte. Le défilement est
    //     le mode des webtoons et le pinch un geste de téléphone : leur
    //     croisement était la situation la plus probable, pas la plus rare.
    //
    // En défilement le zoom est une LARGEUR, et une largeur ne dépasse pas son
    // conteneur : la borne y est 100 %. Sans elle, l'étiquette annoncerait
    // « 150 % » devant une planche qui n'a pas bougé.
    function appliquerZoom(z, point) {
        const defilement = readMode === 'scroll';
        zoom = Math.round(Math.min(defilement ? 100 : 400, Math.max(50, z)));
        const label = document.getElementById('zoomLabel');
        if (label) label.textContent = zoom + '%';
        if (defilement) {
            document.querySelectorAll('.reader-page-wrapper').forEach(w => {
                w.style.transform = '';
                w.style.transformOrigin = '';
                w.style.width = zoom + '%';
            });
        } else {
            ancrerZoomSur(zoom > 100 ? point : null);
            document.querySelectorAll('.reader-page-wrapper')
                .forEach(w => { w.style.transform = `scale(${zoom / 100})`; });
        }
        window.Storage?.setPref('zoom', zoom);                      // défaut global
        if (manga?.id) window.Storage?.setPref('zoom_' + manga.id, zoom);
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

    // `appliquerZoom` remet l'origine au neutre en dessous de 100 % : le
    // retour à 100 % n'a donc plus besoin d'être traité à part ici.
    function toggleTapZoom(point) {
        if (readMode === 'scroll') return;
        appliquerZoom(zoom > 110 ? 100 : 170, point);
    }

    // ── Zoom sur la case désignée ────────────────────────────
    // Double-clic ou double appui sur une planche : on cadre la CASE sous le
    // pointeur (zoom-case.js trouve ses gouttières) et on la centre. Sans
    // case reconnaissable, on retombe sur le zoom ancré ci-dessus. Le même
    // geste, ou Échap, ramène la planche entière.
    function zoomCaseActif() {
        return !!document.querySelector('.reader-page-wrapper[data-zoom-case]');
    }
    function quitterZoomCase() {
        document.querySelectorAll('.reader-page-wrapper[data-zoom-case]').forEach(w => delete w.dataset.zoomCase);
        appliquerZoom(100);
    }
    function zoomerSurCase(point, img) {
        if (readMode === 'scroll') return;
        if (zoomCaseActif() || zoom > 110) { quitterZoomCase(); return; }
        const wrapper = img?.closest('.reader-page-wrapper');
        const zone = document.getElementById('readerPagesArea');
        const v = window.MH?.zoomCase?.vignette(img);
        if (!wrapper || !zone || !v) { toggleTapZoom(point); return; }
        const r0 = img.getBoundingClientRect();
        const kase = window.MH.zoomCase.detecterCase(v.px, v.w, v.h,
            ((point.x - r0.left) / r0.width) * v.w, ((point.y - r0.top) / r0.height) * v.h);
        if (!kase) { toggleTapZoom(point); return; }
        appliquerZoom(100);                        // mesurer à l'échelle 1
        const r = img.getBoundingClientRect(), W = wrapper.getBoundingClientRect(), V = zone.getBoundingClientRect();
        const cw = kase.w * r.width, ch = kase.h * r.height;
        const s = Math.min(4, Math.max(1.2, Math.min(V.width / cw, V.height / ch) * 0.94));
        const cx = r.left + (kase.x + kase.w / 2) * r.width, cy = r.top + (kase.y + kase.h / 2) * r.height;
        const tx = (V.left + V.width / 2) - W.left - s * (cx - W.left);
        const ty = (V.top + V.height / 2) - W.top - s * (cy - W.top);
        wrapper.dataset.zoomCase = '1';
        wrapper.style.transformOrigin = '0 0';
        wrapper.style.transform = `translate(${tx.toFixed(1)}px, ${ty.toFixed(1)}px) scale(${s.toFixed(3)})`;
        const label = document.getElementById('zoomLabel');
        if (label) label.textContent = Math.round(s * 100) + '%';
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

    // Boutons « + / − » du panneau, touches + et −, Ctrl + molette.
    // Tout le travail est dans `appliquerZoom` : ici il ne reste que le pas.
    window.changeZoom = function (delta) { appliquerZoom(zoom + delta); };

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
        const asc = chapitresTries();
        const idx = asc.findIndex(c => c.id === currentChap.id);
        if (idx < 0) return null;
        // Seules les entrées CONSTATÉES vides dans la session sont sautées.
        // Pas `pages === 0` : WeebCentral, SushiScan et les sources de romans
        // écrivent 0 pour « inconnu » — le prendre pour « vide » sauterait
        // tous leurs chapitres.
        const vides = chapitresVides();
        for (let t = idx + delta; t >= 0 && t < asc.length; t += delta) {
            const c = asc[t];
            if (vides.has(String(c.id))) continue;
            return c;
        }
        return null;
    }
    // Un seul ordre de chapitres pour tout le lecteur. La barre d'outils, le
    // bloc « À suivre » et l'enchaînement triaient chacun par
    // `a.chapter - b.chapter`, qui rend NaN dès qu'un numéro n'est pas un
    // nombre : trois voisins possibles pour un même chapitre.
    function chapitresTries() {
        const num = c => { const n = parseFloat(c.chapter); return isNaN(n) ? null : n; };
        return [...chapters].sort((a, b) => {
            const na = num(a), nb = num(b);
            if (na !== null && nb !== null) return na - nb;
            if (na !== null) return -1;
            if (nb !== null) return 1;
            return String(a.chapter).localeCompare(String(b.chapter), 'fr');
        });
    }
    function urlChapitre(c, saut) {
        return `chapitre.html?manga=${encodeURIComponent(manga.id)}&chapter=${encodeURIComponent(c.id)}&source=${encodeURIComponent(API.sources.current)}`
            + (saut ? `&saut=${saut}` : '');
    }
    function goChapter(delta) {
        const c = neighborChapter(delta);
        if (c) window.location.href = urlChapitre(c, delta);
    }
    const CLE_VIDES = 'inko_chapitres_vides';
    function chapitresVides() {
        try { return new Set(JSON.parse(sessionStorage.getItem(CLE_VIDES) || '[]')); }
        catch (e) { return new Set(); }   // stockage refusé (navigation privée) : rien à sauter
    }
    function retenirChapitreVide(id) {
        const v = chapitresVides(); v.add(String(id));
        try { sessionStorage.setItem(CLE_VIDES, JSON.stringify([...v].slice(-200))); }
        catch (e) { window.MH?.err?.('chapitre.js', e); }
    }

    function bindKeyboard() {
        // Double-clic sur une planche : cadrer la case désignée (ou dézoomer).
        // C'était un 100 % ↔ 150 % partant du haut de la planche, qui ne
        // gardait même pas le point cliqué sous le curseur.
        document.getElementById('readerPagesArea')?.addEventListener('dblclick', e => {
            const img = e.target.closest('.reader-page-img');
            if (!img) return;
            e.preventDefault();
            zoomerSurCase({ x: e.clientX, y: e.clientY }, img);
        });
        // Les touches du lecteur sont les siennes : les raccourcis globaux
        // (B bibliothèque, H accueil, ? aide…) ne doivent pas partir en même temps.
        window.MH?.reserverTouches?.(['n', 'N', 'p', 'P', 'b', 'B', 'h', 'H', 's', 'S', '?', 'a', 'A',
            'j', 'J', 'i', 'I', 'f', 'F', '+', '-', '=', '[', ']', ' ']);
        document.addEventListener('keydown', e => {
            if (MH.toucheIgnoree(e)) return;
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
                case 'b': case 'B': e.preventDefault(); toggleBookmark(); return;   // sinon le « b » s'écrit dans le champ de la note
                case 'j': case 'J': openNotes(); return;
                case 'i': case 'I': toggleImmersive(); return;
                case '[': bumpAutoSpeed(-0.2); return;
                case ']': bumpAutoSpeed(0.2); return;
                case 'Escape':
                    if (zoomCaseActif()) { quitterZoomCase(); return; }
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

    // ── Minuteur de lecture (« encore 20 minutes ») ──
    // Deux défauts dans la première version :
    //   · le minuteur vivait dans la page. Changer de chapitre recharge le
    //     lecteur : il était perdu. « Encore 20 minutes » sur des chapitres de
    //     8 minutes ne se déclenchait donc JAMAIS ;
    //   · à l'échéance, un voile plein écran tombait au milieu d'une planche,
    //     parfois au milieu d'une bulle.
    // L'échéance est désormais notée pour la session (sessionStorage : un
    // nouvel onglet demain n'hérite pas d'un minuteur d'hier), et le rappel
    // attend la FIN DU CHAPITRE — le moment naturel pour s'arrêter. Il est
    // discret (un encart, pas un voile) et l'enchaînement automatique vers le
    // chapitre suivant est suspendu : c'est lui qui faisait « encore un ».
    const CLE_MINUTEUR = 'inko_minuteur';
    let sleepEchu = false;
    function lireMinuteur() {
        try { const m = JSON.parse(sessionStorage.getItem(CLE_MINUTEUR) || 'null'); return m && m.fin > 0 ? m : null; }
        catch (e) { return null; }
    }
    function ecrireMinuteur(m) {
        try { m ? sessionStorage.setItem(CLE_MINUTEUR, JSON.stringify(m)) : sessionStorage.removeItem(CLE_MINUTEUR); }
        catch (e) { /* stockage bloqué : le minuteur vit au moins jusqu'au chapitre suivant */ }
    }
    function armerMinuteur(m, auChargement) {
        if (sleepTimerId) { clearTimeout(sleepTimerId); sleepTimerId = null; }
        sleepEchu = false;
        if (!m) { sleepMins = 0; return; }
        sleepMins = m.mins;
        const reste = m.fin - Date.now();
        if (reste > 0) { sleepTimerId = setTimeout(triggerSleep, reste); return; }
        // Échu pendant qu'on changeait de chapitre : on est au début d'un
        // chapitre, c'est déjà un bon moment pour le dire.
        if (auChargement) { sleepEchu = true; afficherRappelMinuteur(true); }
        else triggerSleep();
    }
    function setSleepTimer(mins) {
        mins = +mins || 0;
        const m = mins > 0 ? { mins, fin: Date.now() + mins * 60 * 1000 } : null;
        ecrireMinuteur(m);
        armerMinuteur(m);
        document.getElementById('sleepRappel')?.remove();
        MH.toast?.(m ? `Minuteur réglé : rappel à la fin du chapitre après ${mins} min` : 'Minuteur désactivé');
    }
    function triggerSleep() {
        sleepTimerId = null;
        sleepEchu = true;
        annulerEnchainement();   // pas de « chapitre suivant » automatique une fois l'heure passée
        if (totalPages && currentPage >= totalPages) afficherRappelMinuteur();
        // Sinon : updateUIPage l'affichera en arrivant à la dernière page.
    }
    function afficherRappelMinuteur(entreDeux) {
        if (document.getElementById('sleepRappel')) return;
        const mins = sleepMins;
        ecrireMinuteur(null);
        sleepMins = 0;
        if (autoTimer) stopAutoScroll();
        const el = document.createElement('div');
        el.id = 'sleepRappel';
        el.setAttribute('role', 'status');
        el.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:130;max-width:min(420px,calc(100vw - 32px));padding:14px 16px;border-radius:14px;background:rgba(20,20,24,.94);color:#fff;box-shadow:0 8px 30px rgba(0,0,0,.4);display:flex;gap:12px;align-items:center;font-size:13.5px';
        el.innerHTML = `<span style="color:var(--accent);flex:none">${MH.icon('moon', 22)}</span>
            <span style="flex:1"><span>${mins ? `Tes ${mins} minutes sont passées.` : 'Le temps prévu est passé.'}</span> <span>${entreDeux ? 'Entre deux chapitres' : 'Fin de chapitre'} : un bon moment pour t'arrêter.</span></span>
            <button class="btn btn-ghost btn-sm" id="sleepEncore">Encore 10 min</button>
            <a class="btn btn-primary btn-sm" href="accueil.html">Arrêter</a>`;
        document.body.appendChild(el);
        el.querySelector('#sleepEncore').onclick = () => { el.remove(); setSleepTimer(10); };
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
        // La nuit progressive ne remplace pas les curseurs : elle ne peut que
        // les renforcer. Un réglage manuel plus fort qu'elle reste gagnant.
        const nuit = rs.nuitAuto === '1' ? nuitProgressive(new Date()) : { chaleur: 0, assombri: 0 };
        const luminosite = Math.min(rs.brightness, 100 - nuit.assombri);
        const chaleur = Math.max(+rs.warm || 0, nuit.chaleur);
        dim.style.opacity = String(Math.max(0, (100 - luminosite) / 100 * 0.72));

        // Filtre confort des yeux (lumière chaude type f.lux)
        let warm = document.getElementById('readerWarm');
        if (!warm) {
            warm = document.createElement('div');
            warm.id = 'readerWarm';
            warm.style.cssText = 'position:fixed;top:0;right:0;bottom:0;left:0;background:#ff8a1e;pointer-events:none;z-index:76;mix-blend-mode:multiply;transition:opacity .2s';
            document.body.appendChild(warm);
        }
        warm.style.opacity = String(Math.max(0, Math.min(0.6, chaleur / 100 * 0.6)));
        const note = document.getElementById('rsNuitNote');
        if (note) note.textContent = rs.nuitAuto !== '1' ? ''
            : (nuit.chaleur ? `En ce moment : chaleur ${nuit.chaleur} %, luminosité −${nuit.assombri} %` : 'En ce moment : rien (de jour)');
    }

    // ── Nuit progressive ─────────────────────────────────────
    // Les curseurs « luminosité » et « lumière chaude » sont réglés une fois,
    // de jour ou de nuit, et restent faux le reste du temps : trop sombres à
    // midi, trop blancs à minuit. La nuit progressive suit l'heure locale :
    // rien jusqu'à 20 h, une montée douce jusqu'à 23 h, le plein la nuit, puis
    // une redescente de 5 h à 7 h. Linéaire et réévaluée chaque minute : le
    // changement ne se voit jamais d'un coup.
    const NUIT_CHALEUR_MAX = 50, NUIT_ASSOMBRI_MAX = 20;   // en %
    function nuitProgressive(date) {
        const h = date.getHours() + date.getMinutes() / 60;
        let t;
        if (h >= 23 || h < 5) t = 1;
        else if (h >= 20) t = (h - 20) / 3;
        else if (h >= 5 && h < 7) t = 1 - (h - 5) / 2;
        else t = 0;
        return { chaleur: Math.round(NUIT_CHALEUR_MAX * t), assombri: Math.round(NUIT_ASSOMBRI_MAX * t) };
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
    //
    // Le critère est le format RÉEL des planches, pas l'orientation de la
    // fenêtre. « Paysage » n'en était qu'une approximation, fausse dans les
    // deux sens. Mesuré : une fenêtre de bureau de 1100 × 1000 est en
    // paysage, mais deux planches de manga (0,7 de large pour 1 de haut) y
    // s'affichent à 627 + 627 px dans 1100 : la planche double déborde. On
    // passe donc en double quand deux planches côte à côte tiennent dans la
    // largeur à pleine hauteur (2 % de tolérance). Tant qu'aucune planche
    // n'est mesurée, on suppose le format typique (RATIO_DEFAUT) plutôt que
    // l'orientation : basculer en double puis revenir aussitôt clignoterait.
    let autoDoubleDesarme = false;
    const DOUBLE_HAUTEUR_MIN = 0.98;
    /** Largeur / hauteur typique (médiane) des planches simples mesurées, ou null. */
    function formatPlanches(ratios) {
        const lh = ratios.map(r => 1 / r).filter(x => x > 0 && x <= 1.2).sort((a, b) => a - b);
        return lh.length ? lh[Math.floor(lh.length / 2)] : null;
    }
    function doubleTient(largeur, hauteur, ratios) {
        if (!largeur || !hauteur) return false;
        const f = formatPlanches(ratios) || 1 / RATIO_DEFAUT;
        return largeur / (2 * f * hauteur) >= DOUBLE_HAUTEUR_MIN;
    }
    function ratiosConnus() { return formatPlanches([...pageRatios.values()]) !== null; }
    function surRotation() {
        if (rs.autoDouble !== '1' || autoDoubleDesarme) return;
        if (readMode === 'scroll') return;
        const zone = document.getElementById('readerPagesArea');
        const largeur = zone?.clientWidth || window.innerWidth;
        const hauteur = window.innerHeight - Math.max(0, zone?.getBoundingClientRect().top || 0);
        const voulu = doubleTient(largeur, hauteur, [...pageRatios.values()]) ? 'double' : 'page';
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
            <div class="rs-head"><span>Réglages du lecteur</span><button class="rs-close" id="rsClose" aria-label="Fermer les réglages de lecture">✕</button></div>
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
            <label class="rs-check">
                <input type="checkbox" id="rsNuitAuto" ${rs.nuitAuto === '1' ? 'checked' : ''}>
                <span>Nuit progressive selon l'heure</span>
            </label>
            <div class="rs-note" id="rsNuitNote" aria-live="polite"></div>
            <label class="rs-label">Écart entre pages <span id="rsGapVal">${rs.gap}px</span></label>
            <input type="range" id="rsGap" min="0" max="40" value="${rs.gap}" class="rs-range">
            <label class="rs-label">Vitesse défilement auto <span id="rsAutoVal">${(+rs.autospeed || 1.4).toFixed(1)}×</span></label>
            <input type="range" id="rsAuto" min="0.4" max="6" step="0.2" value="${rs.autospeed}" class="rs-range">
            <label class="rs-label">Orientation de l'écran</label>
            ${seg('orientation', [{v:'libre',l:'Libre'},{v:'portrait',l:'Portrait'},{v:'landscape',l:'Paysage'}], rs.orientation)}
            <label class="rs-check">
                <input type="checkbox" id="rsAutoDouble" ${rs.autoDouble === '1' ? 'checked' : ''}>
                <span>Double page automatique quand deux planches tiennent</span>
            </label>
            <label class="rs-check">
                <input type="checkbox" id="rsDecouper" ${rs.decouper === '1' ? 'checked' : ''}>
                <span>Découper les planches doubles en deux pages</span>
            </label>
            <label class="rs-check">
                <input type="checkbox" id="rsContinu" ${rs.continu === '1' ? 'checked' : ''}>
                <span>Enchaîner les chapitres en défilement</span>
            </label>
            <label class="rs-label">Qualité des images</label>
            ${seg('quality', [{v:'high',l:'Haute'},{v:'saver',l:'Éco'}], q)}
            <label class="rs-label">Minuteur de lecture</label>
            <div class="rs-seg" id="rsSleep">
                ${[['0','Off'],['10','10m'],['20','20m'],['30','30m'],['45','45m'],['60','60m']].map(([v,l]) =>
                    `<button data-sleep="${v}" class="${String(sleepMins)===v?'on':''}">${l}</button>`).join('')}
            </div>
            <div class="rs-foot">
                <a class="btn btn-ghost btn-sm" id="rsComparer" style="width:100%;margin-bottom:6px"
                   href="comparer.html?manga=${encodeURIComponent(manga.id)}&chapter=${encodeURIComponent(currentChap.id)}&source=${encodeURIComponent(API.sources.current)}">Comparer avec une autre source</a>
                <button class="btn btn-secondary btn-sm" id="rsMarkAll" style="width:100%">Marquer tout le manga comme lu</button>
                <div class="rs-shortcuts">← → pages · ↑ ↓ / molette défile puis tourne · Début/Fin première/dernière · N/P chapitre · F plein écran · I immersif · B signet · A défilement auto · [ ] vitesse · S réglages</div>
            </div>`;
        document.body.appendChild(panel);
        applyReaderSettings();   // remplit la note de la nuit progressive

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
        panel.querySelector('#rsContinu')?.addEventListener('change', e => {
            saveReaderSetting('continu', e.target.checked ? '1' : '0', false);
        });
        panel.querySelector('#rsNuitAuto')?.addEventListener('change', e => {
            saveReaderSetting('nuitAuto', e.target.checked ? '1' : '0', false);
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

        // ── L'annulation ne doit défaire QUE ce que ce geste a fait ──
        //
        // « Marquer jusqu'ici » envoie tous les chapitres précédents, y
        // compris ceux qu'on avait déjà lus il y a des mois. Démarquer
        // l'ensemble effacerait la frontière entre lu et non lu — la donnée
        // la plus longue à reconstituer, et précisément celle qu'une
        // annulation est censée protéger.
        //
        // On relève donc l'état avant d'écrire, et le bandeau ne propose de
        // défaire que les chapitres réellement ajoutés.
        let dejaLus = null;
        try {
            const tout = await API.me.readChapters();
            dejaLus = new Set((tout?.[manga.id] || []).map(c => c.chapterId));
        } catch (e) { dejaLus = null; }
        const nouveaux = dejaLus ? items.filter(i => !dejaLus.has(i.chapterId)) : [];

        try { await API.me.markChaptersBulk(manga.id, items); }
        catch (e) { MH.toast?.('Erreur : ' + e.message); return; }

        // Sans cet état, pas d'annulation proposée : mieux vaut ne rien
        // offrir qu'un bouton qui démarquerait d'anciennes lectures.
        if (!dejaLus || !nouveaux.length) { MH.toast?.(msg); return; }

        // Le bandeau (audit IX.6) plutôt que le toast : lui seul peut porter
        // une action, et il s'ancre au-dessus de la barre d'onglets.
        MH.bandeau?.(msg, {
            action: 'Annuler',
            duree: 5000,        // IX.6 : cinq secondes, le temps de réaliser
            onAction: async () => {
                try {
                    await API.me.unmarkChaptersBulk(manga.id, nouveaux.map(c => c.chapterId));
                    MH.bandeau?.(`${nouveaux.length} chapitre(s) remis en non-lu.`);
                } catch (e) { MH.bandeau?.('Annulation impossible : ' + e.message); }
            },
        });
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
    // Un signet porte une PHRASE, pas seulement une position : ce qu'on veut
    // retrouver, c'est souvent pourquoi on l'a posé. B (ou le bouton) pose
    // le signet tout de suite — rien n'est perdu si on ne tape rien — et
    // ouvre un champ pour la phrase. Sur un signet existant, le même geste
    // rouvre ce champ, avec de quoi le retirer.
    //
    // La page est envoyée pour de bon : seul le libellé « Page N » partait,
    // le serveur enregistrait donc page = 1 et « Lire » depuis la
    // bibliothèque rouvrait la progression, pas la page marquée.
    function signetCourant() {
        return (UserData.getBookmarks?.() || []).find(b => b.mangaId === manga.id && b.chapterId === currentChap.id) || null;
    }
    function poserSignet(page, note) {
        UserData.addBookmark({
            mangaId: manga.id, source: API.sources.current,
            title: manga.title, cover: manga.cover || manga.coverThumb,
            chapterId: currentChap.id, chapterNum: currentChap.chapter,
            page, label: 'Page ' + page, note: (note || '').trim().slice(0, 500),
        });
    }
    function toggleBookmark() {
        if (!window.UserData) return;
        const ouvert = document.getElementById('signetPop');
        if (ouvert) { ouvert.remove(); return; }
        let signet = signetCourant();
        const nouveau = !signet;
        if (nouveau) {
            poserSignet(currentPage, '');
            signet = signetCourant() || { page: currentPage, note: '' };
            MH.toast?.('Signet ajouté — retrouvé dans ta bibliothèque');
        }
        refreshBookmarkBtn();
        ouvrirNoteSignet(signet, nouveau);
    }
    function ouvrirNoteSignet(signet, nouveau) {
        const pop = document.createElement('form');
        pop.id = 'signetPop';
        pop.className = 'signet-pop';
        pop.setAttribute('role', 'dialog');
        pop.setAttribute('aria-label', 'Note du signet');
        const page = signet.page || currentPage;
        pop.innerHTML = `
            <label class="signet-pop-label" for="signetNote">Une phrase pour ce signet <span>(page ${page}, facultatif)</span></label>
            <input id="signetNote" class="input" maxlength="500" autocomplete="off" placeholder="ex. : la révélation, la case à montrer">
            <div class="signet-pop-actions">
                <button type="submit" class="btn btn-primary btn-sm">Enregistrer</button>
                ${nouveau ? '' : '<button type="button" class="btn btn-ghost btn-sm" id="signetRetirer">Retirer le signet</button>'}
            </div>`;
        pop.querySelector('#signetNote').value = signet.note || '';
        document.body.appendChild(pop);
        const fermer = () => { pop.remove(); document.removeEventListener('pointerdown', dehors, true); };
        const dehors = (e) => { if (!pop.contains(e.target) && !e.target.closest?.('#btnBookmark')) fermer(); };
        document.addEventListener('pointerdown', dehors, true);
        pop.addEventListener('keydown', (e) => {
            e.stopPropagation();   // les raccourcis du lecteur ne s'appliquent pas en tapant
            if (e.key === 'Escape') fermer();
        });
        pop.addEventListener('submit', (e) => {
            e.preventDefault();
            poserSignet(page, pop.querySelector('#signetNote').value);
            fermer();
            MH.toast?.('Signet enregistré');
        });
        pop.querySelector('#signetRetirer')?.addEventListener('click', () => {
            UserData.removeBookmark(manga.id, currentChap.id);
            fermer();
            refreshBookmarkBtn();
            MH.toast?.('Signet retiré');
        });
        pop.querySelector('#signetNote').focus();
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
        im.onload = () => {
            noterDureePage(performance.now() - t0);
            // Le format des planches à venir, connu AVANT qu'on les affiche :
            // le mode double sait d'avance qu'une panoramique doit rester seule.
            if (im.naturalWidth) pageRatios.set(num - 1, im.naturalHeight / im.naturalWidth);
        };
        im.src = pageSrc(p);
    }
    // ── Le chapitre suivant, préparé pour de bon ────────────────
    //
    // Deux manques, et le même symptôme : on tourne la dernière page et on
    // attend devant un écran vide.
    //
    //   · une SEULE page était préchargée. La source mesurée met de 3,7 à
    //     9 secondes par planche selon le moment : la page 2 du chapitre
    //     suivant arrivait donc aussi tard que si rien n'avait été fait ;
    //   · le préchargement n'avait lieu qu'au CHARGEMENT de la page. On y est
    //     alors à la planche 1 sur 17 — dix minutes avant d'en avoir besoin,
    //     largement de quoi se faire évincer du cache mémoire. Il fallait
    //     l'armer à l'approche de la fin, au moment où il sert.
    //
    // La profondeur suit la fenêtre déjà calculée sur la latence réellement
    // observée : une liaison poussive ne doit pas être encombrée pour un
    // chapitre qu'on n'ouvrira peut-être pas. Le cache disque, lui, garde ce
    // travail d'une session à l'autre.
    // On retient l'id ET la profondeur : le passage superficiel du chargement
    // ne doit pas empêcher le passage profond de la fin de chapitre.
    let chapSuivantPrepare = { id: null, profond: false };
    function preloadNextChapter({ profond = false } = {}) {
        const next = neighborChapter(1);
        if (!next) return;
        if (chapSuivantPrepare.id === next.id && (chapSuivantPrepare.profond || !profond)) return;
        chapSuivantPrepare = { id: next.id, profond };
        const combien = profond ? Math.max(2, Math.min(fenetrePrechargement(), 5)) : 1;
        API.mangas.pages(next.id).then(d => {
            const liste = (d.pages || []).slice(0, combien);
            for (const p of liste) {
                // Audit PERF-08 : cette ligne posait l'URL BRUTE. Un seul appel,
                // mais suffisant pour contacter le site source en direct — donc
                // pour rendre l'ensemble de l'effort inutile, puisqu'il suffit
                // d'une requête pour révéler l'adresse IP.
                const im = new Image();
                im.src = MH.proxify ? MH.proxify(p.url) : p.url;
            }
        }).catch(() => { chapSuivantPrepare = null; });   // un échec doit pouvoir être retenté
    }
})();
