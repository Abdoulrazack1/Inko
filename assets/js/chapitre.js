// chapitre.js — Lecteur de chapitre MangaHub
// Charge les vraies pages via ChaptersDB (MangaDex API)
(function () {
    'use strict';

    let manga       = null;
    let chapter     = null;   // objet minimal, mis à jour après chargement async
    let pages       = [];     // { pageNumber, src, srcFallback }[]
    let currentPage = 1;
    let totalPages  = 0;
    let zoom        = 100;
    let readMode    = 'page'; // 'page' | 'scroll' | 'double'

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('chapitre');

        const params     = new URLSearchParams(location.search);
        const mangaId    = parseInt(params.get('manga'))   || 1;
        const chapterNum = parseInt(params.get('chapter')) || 1;

        manga = DB.getManga(mangaId) || DB.mangas[0];

        // Initialisation synchrone : objet chapitre minimal pour l'affichage immédiat.
        // ChaptersDB.getChapterSync() cherche dans le cache mémoire (si déjà chargé),
        // sinon retourne un objet générique sans appel réseau.
        chapter = window.ChaptersDB
            ? ChaptersDB.getChapterSync(manga.id, chapterNum)
            : { number: chapterNum, title: `Chapitre ${chapterNum}`, pages: 20, readTime: 12 };

        document.getElementById('pageTitle').textContent = `${manga.title} — Chap. ${chapter.number}`;

        // Rendu des éléments statiques (sans les chapitres de la barre de navigation)
        renderToolbarBasic();
        renderModebar();
        renderTranslatorNote();
        renderDetails();
        renderPanel();
        bindKeyboard();

        // Affichage du loader
        showLoader();

        // ── Chargement async des pages ────────────────────────
        try {
            if (window.ChaptersDB) {
                pages = await ChaptersDB.getPages(manga.id, chapter.number);
            }
        } catch (e) {
            console.error('[chapitre.js] getPages error:', e);
        }

        totalPages = pages.length || chapter.pages || 20;

        if (!pages.length) {
            showNoChapter();
            // Même sans pages, charger la liste des chapitres pour la toolbar
            loadChaptersForToolbar();
            return;
        }

        renderPage(currentPage);
        renderThumbnails();
        renderNavigation();
        renderNextChapter();

        // Charger la liste des chapitres en arrière-plan pour la toolbar
        loadChaptersForToolbar();
    });

    // ── Charger la liste des chapitres et mettre à jour la toolbar ──
    async function loadChaptersForToolbar() {
        try {
            const chaps = window.ChaptersDB
                ? await ChaptersDB.getChapters(manga.id)
                : [];

            // Mettre à jour le chapitre courant avec les vraies métadonnées
            if (chaps.length) {
                const real = chaps.find(c => Math.abs(c.number - chapter.number) < 0.01);
                if (real) {
                    chapter = real;
                    // Rafraîchir le titre de la page
                    const titleEl = document.getElementById('pageTitle');
                    if (titleEl) titleEl.textContent = `${manga.title} — Chap. ${chapter.number}`;
                }
            }

            // Rendre la toolbar complète avec la liste des chapitres
            renderToolbarFull(chaps);
        } catch(e) {
            console.warn('[chapitre.js] loadChaptersForToolbar error:', e);
        }
    }

    // ── Loader ────────────────────────────────────────────────
    function showLoader() {
        const el = document.getElementById('readerPagesArea');
        if (!el) return;
        el.innerHTML = `
        <div class="reader-loading">
            <div class="reader-loading-spinner"></div>
            <div class="reader-loading-manga">${MH.esc(manga.title)}</div>
            <div class="reader-loading-info">Chapitre ${chapter.number} · Chargement des pages…</div>
        </div>`;
    }

    // ── Pas de chapitre dispo ─────────────────────────────────
    function showNoChapter() {
        const el = document.getElementById('readerPagesArea');
        if (!el) return;
        el.innerHTML = `
        <div class="reader-unavailable">
            <div class="reader-unavail-icon">📚</div>
            <div class="reader-unavail-title">${MH.esc(manga.title)}</div>
            <div class="reader-unavail-chapter">Chapitre ${chapter.number} · ${MH.esc(chapter.title)}</div>
            <div class="reader-unavail-msg">
                Ce chapitre n'est pas encore disponible en lecture en ligne.<br>
                Essayez un autre chapitre ou consultez les sources officielles.
            </div>
            <div class="reader-unavail-actions">
                ${chapter.number > 1 ? `<a href="chapitre.html?manga=${manga.id}&chapter=${chapter.number - 1}" class="btn btn-primary btn-sm">← Chapitre précédent</a>` : ''}
                <a href="serie.html?id=${manga.id}" class="btn btn-ghost btn-sm">↩ Retour à la série</a>
            </div>
        </div>`;

        if (document.getElementById('readerThumbnails'))
            document.getElementById('readerThumbnails').innerHTML = '';
        if (document.getElementById('readerNavigation'))
            document.getElementById('readerNavigation').innerHTML = '';
    }

    // ── Rendu d'une page ──────────────────────────────────────
    function renderPage(pageNum) {
        const el = document.getElementById('readerPagesArea');
        if (!el) return;
        const pageObj = pages[pageNum - 1];
        if (!pageObj) return;

        el.innerHTML = `
        <div class="page-zone-prev" onclick="goToPage(${pageNum - 1})">
            <div class="page-zone-arrow">‹</div>
        </div>
        <div class="page-zone-next" onclick="goToPage(${pageNum + 1})">
            <div class="page-zone-arrow">›</div>
        </div>
        <div class="reader-page-wrapper" style="transform:scale(${zoom/100});transform-origin:top center;transition:transform .2s">
            <img
                class="reader-page-img"
                id="currentPageImg"
                src="${pageObj.src}"
                alt="Page ${pageNum}"
                onerror="this.src='${pageObj.srcFallback || ''}';this.onerror=null;"
                loading="eager"
            >
        </div>
        <div class="page-counter-badge">
            Page <strong>${pageNum}</strong> / ${totalPages}
        </div>`;

        document.querySelectorAll('.reader-thumb').forEach((t, i) => {
            t.classList.toggle('active', i + 1 === pageNum);
        });

        const activeThumb = document.querySelector('.reader-thumb.active');
        activeThumb?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });

        const pctEl = document.querySelector('.modebar-pct');
        if (pctEl) pctEl.textContent = `${Math.round((pageNum / totalPages) * 100)}% lu`;

        renderNavigation();
    }

    // ── Toolbar initiale (sans liste de chapitres) ────────────
    function renderToolbarBasic() {
        const el = document.getElementById('readerToolbar');
        if (!el) return;
        const prevChap = chapter.number > 1 ? chapter.number - 1 : null;
        const nextChap = chapter.number < manga.chapters ? chapter.number + 1 : null;

        el.innerHTML = `
        <div class="toolbar-left">
            <a href="serie.html?id=${manga.id}" class="toolbar-back">← ${MH.esc(manga.title)}</a>
            <span class="toolbar-sep">/</span>
            <span class="toolbar-chap">Chap. ${chapter.number}</span>
        </div>
        <div class="toolbar-center" id="toolbarCenter">
            <button class="reader-icon-btn" ${!prevChap ? 'disabled' : ''}
                onclick="window.location.href='chapitre.html?manga=${manga.id}&chapter=${prevChap}'">‹</button>
            <select class="reader-chap-select" id="chapSelect"
                onchange="window.location.href='chapitre.html?manga=${manga.id}&chapter='+this.value">
                <option value="${chapter.number}" selected>Chapitre ${chapter.number}</option>
            </select>
            <button class="reader-icon-btn" ${!nextChap ? 'disabled' : ''}
                onclick="window.location.href='chapitre.html?manga=${manga.id}&chapter=${nextChap}'">›</button>
        </div>
        <div class="toolbar-right">
            <button class="reader-icon-btn" onclick="changeZoom(-10)" title="Zoom −">−</button>
            <span class="reader-zoom-label" id="zoomLabel">${zoom}%</span>
            <button class="reader-icon-btn" onclick="changeZoom(10)" title="Zoom +">+</button>
            <button class="reader-icon-btn" onclick="toggleFullscreen()" title="Plein écran">⛶</button>
            <button class="reader-icon-btn" onclick="MH.toast('Paramètres bientôt disponibles')" title="Paramètres">⚙</button>
        </div>`;
    }

    // ── Toolbar complète (avec liste de chapitres chargée) ────
    function renderToolbarFull(chaps) {
        const select = document.getElementById('chapSelect');
        if (!select || !chaps.length) return;

        const chapLabel = (c) => c.title === `Chapitre ${c.number}`
            ? `Chap. ${c.number}`
            : `Chap. ${c.number} — ${MH.esc(c.title)}`;

        select.innerHTML = chaps.map(c =>
            `<option value="${c.number}" ${c.number === chapter.number ? 'selected' : ''}>${chapLabel(c)}</option>`
        ).join('');

        // Mettre à jour aussi le titre dans la toolbar
        const chapSpan = document.querySelector('.toolbar-chap');
        if (chapSpan) {
            const cur = chaps.find(c => c.number === chapter.number);
            if (cur) chapSpan.textContent = chapLabel(cur);
        }
    }

    // ── Barre de mode ─────────────────────────────────────────
    function renderModebar() {
        const el = document.getElementById('readerModebar');
        if (!el) return;
        const modes = [
            { id: 'page',   label: '📄 Page/page' },
            { id: 'scroll', label: '↕ Défilement' },
            { id: 'double', label: '📰 Double' },
        ];
        el.innerHTML = modes.map(m => `
            <button class="modebar-btn ${m.id === readMode ? 'active' : ''}" data-mode="${m.id}">${m.label}</button>`
        ).join('') +
        `<span class="modebar-info">
            ${chapter.readTime || 12} min · ${chapter.pages || '?'} pages ·
            <span class="modebar-pct">0% lu</span>
        </span>`;

        el.addEventListener('click', e => {
            const btn = e.target.closest('[data-mode]');
            if (!btn) return;
            readMode = btn.dataset.mode;
            el.querySelectorAll('.modebar-btn').forEach(b => b.classList.toggle('active', b === btn));
            MH.toast(`Mode : ${btn.textContent.trim()}`);
        });
    }

    // ── Note traducteur ───────────────────────────────────────
    function renderTranslatorNote() {
        const el = document.getElementById('translatorNote');
        if (!el) return;
        el.innerHTML = `
        <div class="translator-note">
            <div class="translator-note-icon">⚠️</div>
            <div>
                <div class="translator-note-title">Note du traducteur</div>
                <div class="translator-note-text">
                    Ce chapitre contient des références culturelles et folkloriques japonaises.
                    Certains termes ont été conservés en version originale pour en préserver le sens authentique.
                </div>
            </div>
            <button class="translator-note-close" onclick="this.closest('.translator-note').remove()">✕</button>
        </div>`;
    }

    // ── Miniatures ────────────────────────────────────────────
    function renderThumbnails() {
        const el = document.getElementById('readerThumbnails');
        if (!el) return;
        el.innerHTML = pages.map((p, i) => `
            <div class="reader-thumb ${i + 1 === currentPage ? 'active' : ''}" data-page="${i + 1}" onclick="goToPage(${i + 1})">
                ${p.src
                    ? `<img src="${p.srcFallback || p.src}" alt="p${i+1}" loading="lazy" onerror="this.style.display='none'">`
                    : ''}
                <div class="reader-thumb-num">${i + 1}</div>
            </div>`).join('');
    }

    // ── Navigation ────────────────────────────────────────────
    function renderNavigation() {
        const el = document.getElementById('readerNavigation');
        if (!el) return;
        el.innerHTML = `
        <button class="reader-nav-btn" onclick="goToPage(${currentPage - 1})" ${currentPage <= 1 ? 'disabled' : ''}>← Précédent</button>
        <div class="reader-nav-center">
            <div class="reader-nav-page">Page <strong>${currentPage}</strong> / ${totalPages}</div>
            <div class="reader-shortcuts">
                <span class="shortcut-key">← →</span> pages &nbsp;
                <span class="shortcut-key">F</span> plein écran &nbsp;
                <span class="shortcut-key">+/−</span> zoom
            </div>
        </div>
        <button class="reader-nav-btn" onclick="goToPage(${currentPage + 1})" ${currentPage >= totalPages ? 'disabled' : ''}>Suivant →</button>`;
    }

    // ── Prochain chapitre ─────────────────────────────────────
    function renderNextChapter() {
        const el = document.getElementById('readerNextChapter');
        if (!el) return;
        const nextNum = chapter.number + 1;
        const hasNext = nextNum <= manga.chapters;
        if (!hasNext) { el.innerHTML = ''; return; }

        el.innerHTML = `
        <div class="reader-next-chapter">
            <div class="next-chapter-cover">
                <img src="${manga.coverFallback}" alt="" onerror="this.src='${manga.coverFallback}'">
            </div>
            <div class="next-chapter-info">
                <div class="next-chapter-label">À suivre</div>
                <div class="next-chapter-title">Chapitre ${nextNum}</div>
                <div class="next-chapter-meta">Appuyez pour lire la suite</div>
            </div>
            <a href="chapitre.html?manga=${manga.id}&chapter=${nextNum}" class="btn btn-primary">Lire →</a>
        </div>`;
    }

    // ── Détails + commentaires ────────────────────────────────
    function renderDetails() {
        const el = document.getElementById('readerDetails');
        if (!el) return;
        el.innerHTML = `
        <div class="reader-details-block">
            <div class="reader-block-title">Détails & Statistiques</div>
            <div style="font-size:11px;color:var(--text3);margin-bottom:10px">
                Publié via <span style="color:var(--orange)">MangaDex</span>
            </div>
            <div class="detail-stats">
                ${[[MH.fmt(chapter.views || 245000),'VUES'],['12.4k','LIKES'],[manga.rating,'NOTE'],['8.9k','FAVORIS']].map(([n,l]) => `
                <div class="detail-stat"><div class="detail-stat-num">${n}</div><div class="detail-stat-label">${l}</div></div>`).join('')}
            </div>
            <div class="detail-tags">
                ${manga.genres.map(g => `<span class="tag" style="font-size:10.5px;padding:2px 8px">${g}</span>`).join('')}
            </div>
            <div class="detail-summary"><strong>Synopsis :</strong><br>${MH.esc(manga.description)}</div>
        </div>
        <div class="reader-comments-block">
            <div class="reader-block-title">Commentaires
                <span style="float:right;font-size:11px;color:var(--text2)">
                    <a href="#" style="margin-right:8px;color:var(--orange)">Top</a>
                    <a href="#" style="color:var(--text2)">Nouveau</a>
                </span>
            </div>
            <p class="comments-count">Discussion active</p>
            <textarea class="comment-input-area" placeholder="Rejoignez la discussion (SPOIL = BAN)"></textarea>
            <div class="comment-warning">⚠ Pas de spoilers dans les commentaires</div>
            <div class="comment-send">
                <button class="btn btn-primary btn-sm" onclick="MH.toast('Commentaire publié !')">Envoyer</button>
            </div>
        </div>`;
    }

    // ── Panneau latéral ───────────────────────────────────────
    function renderPanel() {
        const el = document.getElementById('readerPanel');
        if (!el) return;
        const readPct = Math.round((currentPage / (chapter.pages || 20)) * 100);
        el.innerHTML = `
        <div class="reader-panel-block ambiance-block">
            <div class="panel-block-title"><span>AMBIANCE SONORE</span><span>🎵</span></div>
            <div class="ambiance-track">OST — ${MH.esc(manga.title)}</div>
            <div class="ambiance-controls">
                <button class="ambiance-btn" onclick="MH.toast('Musique en pause')">⏸</button>
                <button class="ambiance-btn" onclick="MH.toast('Piste suivante')">↷</button>
                <button class="ambiance-btn" onclick="MH.toast('Volume ajusté')">🔊</button>
            </div>
        </div>

        <div class="reader-panel-block">
            <div class="panel-block-title"><span>PERSONNAGES</span><span style="font-size:11px;color:var(--text2)">${manga.characters?.length || 0}</span></div>
            <div class="casting-grid">
                ${(manga.characters || []).slice(0, 4).map(c => `
                <div class="casting-char">
                    <div class="casting-avatar">${c.name[0]}</div>
                    <div class="casting-name">${c.name}</div>
                    <div class="casting-role">${c.role || ''}</div>
                </div>`).join('')}
            </div>
        </div>

        <div class="reader-panel-block">
            <div class="panel-block-title"><span>MA PROGRESSION</span></div>
            <div class="progress-row">
                <span class="sidebar-progress-num">${readPct}%</span>
                <span class="sidebar-progress-label">de la série lue</span>
            </div>
            <div class="progress-bar-big"><div class="progress-fill" style="width:${manga.progress || readPct}%"></div></div>
            <div class="panel-next-chap">
                <div class="panel-next-cover">
                    <img src="${manga.coverFallback}" alt="" onerror="this.src='${manga.coverFallback}'">
                </div>
                <div>
                    <div style="font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.06em">Prochain</div>
                    <div style="font-size:13px;font-weight:600">Chap. ${chapter.number + 1}</div>
                    <button class="btn btn-ghost btn-xs" style="margin-top:4px" onclick="MH.toast('Rappel activé !')">⏰ M'alerter</button>
                </div>
            </div>
        </div>

        <div class="reader-panel-block">
            <div class="panel-block-title">PARTAGER</div>
            <div class="share-icons">
                ${['𝕏','📋','🔗','↗'].map(icon => `
                <button class="share-icon-btn" onclick="MH.toast('Lien copié !')">${icon}</button>`).join('')}
            </div>
        </div>`;
    }

    // ── Contrôles exposés globalement ────────────────────────
    window.goToPage = function (p) {
        if (!pages.length) return;
        if (p < 1 || p > totalPages) return;
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
    };

    window.toggleFullscreen = function () {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen?.().catch(() => {});
        } else {
            document.exitFullscreen?.();
        }
    };

    function bindKeyboard() {
        document.addEventListener('keydown', e => {
            if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') goToPage(currentPage + 1);
            if (e.key === 'ArrowLeft'  || e.key === 'ArrowUp')   goToPage(currentPage - 1);
            if (e.key === 'f' || e.key === 'F')                  toggleFullscreen();
            if (e.key === '+' || e.key === '=')                  changeZoom(10);
            if (e.key === '-')                                    changeZoom(-10);
        });
    }
})();