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
    let libStatus   = null;     // statut de lecture (library)
    let libCategory = null;     // catégorie (favorites.category)

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('serie');
        const params = new URLSearchParams(location.search);
        const id = params.get('id');
        const src = params.get('source');
        if (src && API.sources.current !== src) API.sources.current = src; // contexte multi-sources
        if (!id) { showError('ID manquant.'); return; }

        await MH.loadSourceTypes();   // pour router les liens de lecture (manga/novel)
        bindBookmarkHandler();        // handlers délégués actifs dès le départ
        bindReadToggle();
        showSkeleton();

        try {
            manga = await API.mangas.get(id);
            document.getElementById('pageTitle').textContent = 'Inko — ' + manga.title;

            // Données user (si connecté)
            if (API.isLoggedIn()) {
                const [favs, allRead, allProg] = await Promise.all([
                    API.me.favorites(),
                    API.me.readChapters(),
                    API.me.progress(),
                ]);
                const myFav = favs.find(f => f.mangaId === manga.id);
                favorited   = !!myFav;
                libStatus   = myFav?.status || null;
                libCategory = myFav?.category || null;
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
            // Pas de limite : la liste complète, même pour les très longues séries
            const data = await API.mangas.chapters(manga.id, { lang: window.Storage?.getPref('readingLang') || 'fr,en' });
            chapters = data.results || [];
            if (activeTab === 'chapitres') {
                renderTab('chapitres');
            } else if (activeTab === 'apercu') {
                // Mise à jour ciblée : ne reconstruit que la liste de chapitres,
                // pour préserver les commentaires en cours de saisie et les similaires.
                const cl = document.getElementById('apercuChapsList');
                if (cl) {
                    cl.innerHTML = chapters.length
                        ? chapters.slice(0, 5).map(c => renderChapterRow(c)).join('')
                        : `<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px">Aucun chapitre disponible.</div>`;
                } else {
                    renderTab('apercu');
                }
            }
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
        // Libellé du bouton Reprendre : numéro de chapitre si connu, sinon générique
        const resumeLabel = (progress?.chapter != null && progress.chapter !== '')
            ? `↻ Reprendre Ch.${progress.chapter}` : '↻ Reprendre la lecture';

        el.innerHTML = `
        <div class="serie-hero-inner">
            <div class="serie-cover-wrap">
                <div class="serie-cover-status">${MH.statusBadge(manga.status)}</div>
                <div class="serie-cover">
                    <img src="${manga.coverLarge || manga.cover || ''}" alt="${MH.esc(manga.title)}"
                         onerror="this.src='${MH.placeholderCover(manga.id)}'">
                </div>
                ${manga.rating?.bayesian ? `<div class="serie-cover-rating">${manga.rating.bayesian.toFixed(2)}</div>` : ''}
            </div>
            <div class="serie-info">
                <div class="serie-title-tags">
                    ${(manga.tags || []).slice(0, 4).map(g => `<a href="catalogue.html?q=${encodeURIComponent(g)}" class="tag tag-link">${MH.esc(g)}</a>`).join('')}
                </div>
                <h1 class="serie-title">${MH.esc(manga.title)}</h1>
                ${manga.titleAlt ? `<div class="serie-title-jp">${MH.esc(manga.titleAlt)}</div>` : ''}
                <div class="serie-meta-row">
                    ${manga.author ? `<span class="serie-meta-item"><span class="serie-meta-icon"></span> ${MH.esc(manga.author)}</span>` : ''}
                    <span class="serie-meta-item" id="chapCountMeta"><span class="serie-meta-icon"></span> <span class="spinner-inline" style="width:10px;height:10px;border-width:1px"></span> chapitres</span>
                    ${manga.year ? `<span class="serie-meta-item"><span class="serie-meta-icon"></span> ${manga.year}</span>` : ''}
                    <span class="serie-meta-item">
                        <span class="serie-meta-icon"></span>
                        <span class="status-badge status-${manga.status}">${statusLabel}</span>
                    </span>
                </div>
                <p class="serie-desc-short">${MH.esc((manga.description || '').slice(0, 400))}${manga.description?.length > 400 ? '…' : ''}</p>
                <div class="serie-actions">
                    <button class="btn btn-primary" id="btnReadStart">▶ Lire depuis le début</button>
                    ${resumeChap ? `<button class="btn btn-secondary" id="btnResume">${resumeLabel}</button>` : ''}
                    <button class="btn btn-secondary" id="btnNextUnread" title="Ouvrir le premier chapitre non lu">⏭ 1er non-lu</button>
                    <button class="btn btn-ghost ${favorited ? 'is-fav' : ''}" id="btnFavorite">
                        ${favorited ? 'Dans ma liste' : '♡ Ajouter à ma liste'}
                    </button>
                    <select id="serieStatus" title="Statut de lecture" style="background:var(--bg3);border:1px solid var(--border2);color:var(--text);padding:9px 12px;border-radius:9px;font-size:13px;cursor:pointer">
                        <option value="">Sans statut</option>
                        <option value="reading"   ${libStatus==='reading'  ?'selected':''}>En cours</option>
                        <option value="completed" ${libStatus==='completed'?'selected':''}>Terminé</option>
                        <option value="planned"   ${libStatus==='planned'  ?'selected':''}>À lire</option>
                        <option value="paused"    ${libStatus==='paused'   ?'selected':''}>En pause</option>
                        <option value="dropped"   ${libStatus==='dropped'  ?'selected':''}>Abandonné</option>
                    </select>
                    <button class="btn btn-ghost btn-sm" id="btnCategory">${libCategory ? MH.esc(libCategory) : '+ Catégorie'}</button>
                    <button class="btn btn-ghost btn-sm" id="btnAddList">+ Liste</button>
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
            window.location.href = MH.readerHref(manga.id, first.id, API.sources.current);
        });

        document.getElementById('btnResume')?.addEventListener('click', () => {
            if (progress?.chapterId) {
                window.location.href = MH.readerHref(manga.id, progress.chapterId, API.sources.current);
            }
        });

        document.getElementById('btnNextUnread')?.addEventListener('click', () => {
            if (!chapters.length) { MH.toast('Chargement des chapitres en cours…'); return; }
            const asc = [...chapters].sort((a, b) => a.chapter - b.chapter);
            const next = asc.find(c => !readChapsSet.has(c.id));
            if (!next) { MH.toast('Tous les chapitres sont lus ✓'); return; }
            window.location.href = MH.readerHref(manga.id, next.id, API.sources.current);
        });

        document.getElementById('btnFavorite')?.addEventListener('click', async () => {
            if (!API.isLoggedIn()) { MH.toast('Connectez-vous pour ajouter des favoris'); return; }
            const btn = document.getElementById('btnFavorite');
            try {
                if (favorited) { await API.me.removeFavorite(manga.id); favorited = false; }
                else           { await API.me.addFavorite(manga.id, { title: manga.title, cover: manga.cover || manga.coverThumb }); favorited = true; }
                btn.classList.toggle('is-fav', favorited);
                btn.textContent = favorited ? 'Dans ma liste' : '♡ Ajouter à ma liste';
                MH.toast(favorited ? 'Ajouté à votre liste !' : 'Retiré de votre liste');
            } catch(err) { MH.toast('Erreur : ' + err.message); }
        });

        function updateFavBtn() {
            const b = document.getElementById('btnFavorite');
            if (b) { b.classList.toggle('is-fav', favorited); b.textContent = favorited ? 'Dans ma liste' : '♡ Ajouter à ma liste'; }
        }

        document.getElementById('serieStatus')?.addEventListener('change', async (e) => {
            if (!API.isLoggedIn()) { MH.toast('Connecte-toi pour suivre ta lecture'); e.target.value = libStatus || ''; return; }
            const status = e.target.value;
            try {
                if (status && !favorited) {
                    await API.me.addFavorite(manga.id, { title: manga.title, cover: manga.cover || manga.coverThumb });
                    favorited = true; updateFavBtn();
                }
                await API.me.setLibrary(manga.id, status || null);
                libStatus = status || null;
                if (status) { try { window.AniList?.syncByTitle(manga.title, { status }); } catch (e) {} }
                MH.toast(status ? 'Statut : ' + e.target.options[e.target.selectedIndex].text : 'Statut retiré');
            } catch (err) { MH.toast('Erreur : ' + err.message); }
        });

        document.getElementById('btnCategory')?.addEventListener('click', async () => {
            if (!API.isLoggedIn()) { MH.toast('Connecte-toi'); return; }
            const name = prompt('Catégorie (laisse vide pour aucune) :', libCategory || '');
            if (name === null) return;
            const cat = name.trim();
            try {
                await API.me.setCategory(manga.id, { category: cat || null, title: manga.title, cover: manga.cover || manga.coverThumb, source: API.sources.current });
                libCategory = cat || null; favorited = true; updateFavBtn();
                const b = document.getElementById('btnCategory'); if (b) b.textContent = libCategory || '+ Catégorie';
                MH.toast(libCategory ? 'Catégorie : ' + libCategory : 'Catégorie retirée');
            } catch (err) { MH.toast('Erreur : ' + err.message); }
        });

        document.getElementById('btnShare')?.addEventListener('click', async () => {
            const url = window.location.href;
            try {
                if (navigator.share) { await navigator.share({ title: manga.title, url }); return; }
                await navigator.clipboard.writeText(url);
                MH.toast('Lien copié !');
            } catch(e) { MH.toast(url); }
        });

        document.getElementById('btnAddList')?.addEventListener('click', openListPicker);
    }

    // ── Sélecteur "Ajouter à une liste" ──
    async function openListPicker() {
        if (!API.isLoggedIn()) { MH.toast('Connecte-toi pour utiliser les listes'); return; }
        let lists = [];
        try { lists = await API.me.lists(); } catch (e) { MH.toast('Erreur : ' + e.message); return; }
        const meta = { title: manga.title, cover: manga.cover || manga.coverThumb, source: API.sources.current };
        const inSet = new Set(lists.filter(l => (l.mangaIds || []).map(String).includes(String(manga.id))).map(l => l.id));
        document.getElementById('listPicker')?.remove();
        const wrap = document.createElement('div');
        wrap.id = 'listPicker';
        wrap.className = 'list-modal-backdrop';
        wrap.style.display = 'flex';
        wrap.innerHTML = `
            <div class="list-modal">
                <div class="list-modal-head"><span>Ajouter à une liste</span><button class="list-modal-close" id="lpClose">✕</button></div>
                <div class="lp-lists" id="lpLists">
                    ${lists.length ? lists.map(l => `
                        <label class="lp-row">
                            <input type="checkbox" data-list="${l.id}" ${inSet.has(l.id) ? 'checked' : ''}>
                            <span class="lp-name">${MH.esc(l.name)}</span>
                            <span class="lp-count">${(l.mangaIds || []).length}</span>
                        </label>`).join('') : '<div class="lp-empty">Aucune liste pour l’instant. Crée-en une ci-dessous.</div>'}
                </div>
                <div class="lp-new">
                    <input type="text" id="lpNewName" class="list-modal-input" maxlength="100" placeholder="Créer une nouvelle liste…">
                    <button class="btn btn-primary btn-sm" id="lpCreate">Créer</button>
                </div>
            </div>`;
        document.body.appendChild(wrap);
        const close = () => wrap.remove();
        wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
        wrap.querySelector('#lpClose').addEventListener('click', close);
        wrap.querySelectorAll('input[data-list]').forEach(cb => cb.addEventListener('change', async () => {
            const id = cb.dataset.list;
            cb.disabled = true;
            try {
                if (cb.checked) await API.me.addToList(id, manga.id, meta);
                else            await API.me.removeFromList(id, manga.id);
                MH.toast(cb.checked ? 'Ajouté à la liste' : 'Retiré de la liste');
            } catch (e) { MH.toast('Erreur : ' + e.message); cb.checked = !cb.checked; }
            finally { cb.disabled = false; }
        }));
        wrap.querySelector('#lpCreate').addEventListener('click', async () => {
            const name = wrap.querySelector('#lpNewName').value.trim();
            if (!name) { MH.toast('Donne un nom à la liste'); return; }
            try {
                const r = await API.me.createList({ name });
                await API.me.addToList(r.id, manga.id, meta);
                MH.toast(`Ajouté à « ${name} »`);
                close();
            } catch (e) { MH.toast('Erreur : ' + e.message); }
        });
        wrap.querySelector('#lpNewName')?.addEventListener('keydown', e => { if (e.key === 'Enter') wrap.querySelector('#lpCreate').click(); });
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
        if (meta) meta.innerHTML = `<span class="serie-meta-icon"></span> ${chapters.length} chapitres`;
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
        </div>
        <div class="chapters-block" id="similarBlock" style="display:none">
            <div class="chapters-block-header"><div class="chapters-block-title">Tu aimeras aussi</div></div>
            <div id="similarRow" style="display:flex;gap:12px;overflow-x:auto;padding:4px 2px 8px"></div>
        </div>`;
        el.querySelectorAll('[data-goto="chapitres"]').forEach(btn => {
            btn.addEventListener('click', e => {
                e.preventDefault();
                activeTab = 'chapitres';
                document.querySelectorAll('.serie-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === 'chapitres'));
                renderTab('chapitres');
            });
        });
        loadSimilar();
    }

    // ── Commentaires ──
    function commentTimeAgo(d) {
        const t = new Date(d).getTime();
        if (isNaN(t)) return '';
        const s = Math.floor((Date.now() - t) / 1000);
        if (s < 60) return "à l'instant";
        const m = Math.floor(s / 60); if (m < 60) return `il y a ${m} min`;
        const h = Math.floor(m / 60); if (h < 24) return `il y a ${h} h`;
        const j = Math.floor(h / 24); if (j < 30) return `il y a ${j} j`;
        return new Date(d).toLocaleDateString('fr-FR');
    }
    async function loadComments() {
        const listEl = document.getElementById('commentsList');
        const formEl = document.getElementById('commentForm');
        const countEl = document.getElementById('commentCount');
        if (!listEl) return;
        if (formEl) {
            if (API.isLoggedIn()) {
                formEl.innerHTML = `
                    <div class="comment-compose">
                        <textarea id="commentInput" class="comment-textarea" rows="2" maxlength="1000" placeholder="Partage ton avis sur ${MH.esc(manga.title || 'cette série')}…"></textarea>
                        <div class="comment-compose-foot">
                            <span class="comment-len" id="commentLen">0 / 1000</span>
                            <button class="btn btn-primary btn-sm" id="commentSend">Publier</button>
                        </div>
                    </div>`;
                const ta = formEl.querySelector('#commentInput');
                const len = formEl.querySelector('#commentLen');
                ta.addEventListener('input', () => { len.textContent = `${ta.value.length} / 1000`; });
                const send = async () => {
                    const text = ta.value.trim();
                    if (!text) return;
                    const btn = formEl.querySelector('#commentSend');
                    btn.disabled = true;
                    try {
                        await API.comments.add(manga.id, { text });
                        ta.value = ''; len.textContent = '0 / 1000';
                        await loadComments();
                        MH.toast?.('Commentaire publié');
                    } catch (e) { MH.toast?.('Erreur : ' + e.message); }
                    finally { btn.disabled = false; }
                };
                formEl.querySelector('#commentSend').addEventListener('click', send);
                ta.addEventListener('keydown', e => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send(); } });
            } else {
                formEl.innerHTML = `<div class="comment-login-hint">Connecte-toi pour laisser un commentaire.</div>`;
            }
        }
        let comments = [];
        try { comments = await API.comments.list(manga.id); } catch (e) { comments = []; }
        if (countEl) countEl.textContent = comments.length ? `· ${comments.length}` : '';
        if (!comments.length) {
            listEl.innerHTML = `<div class="comment-empty">Aucun commentaire pour l'instant. Sois le premier à donner ton avis.</div>`;
            return;
        }
        listEl.innerHTML = comments.map(c => `
            <div class="comment-item">
                <div class="comment-avatar">${MH.esc((c.user || '?').slice(0, 1).toUpperCase())}</div>
                <div class="comment-body">
                    <div class="comment-head">
                        <span class="comment-user">${MH.esc(c.user || 'Anonyme')}</span>
                        <span class="comment-date">${commentTimeAgo(c.createdAt)}</span>
                    </div>
                    <div class="comment-text">${MH.esc(c.text || '')}</div>
                </div>
            </div>`).join('');
    }

    // ── Similaires (AniList) ──
    let similarItems = null;   // null = pas encore chargé
    async function loadSimilar() {
        const block = document.getElementById('similarBlock');
        const row = document.getElementById('similarRow');
        if (!block || !row || !manga?.title) return;
        if (similarItems === null) {
            try { similarItems = (await API.art.similar(manga.title)).items || []; }
            catch (e) { similarItems = []; }
        }
        if (!similarItems.length) return;
        try {
            row.innerHTML = similarItems.slice(0, 12).map(m => `
                <a href="recherche.html?q=${encodeURIComponent(m.title)}" style="flex:0 0 116px;text-decoration:none;color:inherit">
                    <div style="aspect-ratio:3/4;border-radius:10px;overflow:hidden;background:var(--bg4)">
                        <img src="${MH.esc(m.cover || '')}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover" onerror="this.style.visibility='hidden'">
                    </div>
                    <div style="font-size:11.5px;margin-top:6px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${MH.esc(m.title)}</div>
                </a>`).join('');
            block.style.display = '';
        } catch (e) { /* silencieux */ }
    }

    function renderChapterRow(c) {
        const isRead = readChapsSet.has(c.id);
        const isBm = window.UserData?.hasBookmark?.(manga.id, c.id);
        return `
        <a href="${MH.readerHref(manga.id, c.id, API.sources.current)}" class="chapter-row${isRead ? ' chapter-row--read' : ''}">
            <div class="chapter-num">Chap. ${c.chapter}</div>
            <div class="chapter-title-text">${MH.esc(c.title || 'Chapitre ' + c.chapter)}</div>
            <div class="chapter-meta">
                <span class="chapter-date">${c.publishedAt ? new Date(c.publishedAt).toLocaleDateString('fr-FR') : ''}</span>
                <span class="chapter-time">${c.pages ? c.pages + ' p.' : ''}</span>
                <span class="chapter-time">${(c.lang || '').toUpperCase()}</span>
                <button class="chapter-bm${isBm ? ' on' : ''}" title="${isBm ? 'Retirer le signet' : 'Ajouter un signet'}"
                    data-bm="${MH.esc(c.id)}" data-bmnum="${MH.esc(c.chapter)}" data-bmtitle="${MH.esc(c.title || '')}">${MH.icon('bookmark', 14)}</button>
                <button class="chapter-read-dot ${isRead ? 'is-read' : ''}" title="${isRead ? 'Lu — clic pour marquer non lu' : 'Non lu — clic pour marquer lu'}"
                    data-read="${MH.esc(c.id)}" data-readnum="${MH.esc(c.chapter)}"></button>
            </div>
        </a>`;
    }

    // Handler délégué unique pour les signets de chapitre
    let _bmBound = false;
    function bindBookmarkHandler() {
        if (_bmBound) return; _bmBound = true;
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.chapter-bm');
            if (!btn) return;
            e.preventDefault(); e.stopPropagation();
            const chapterId = btn.dataset.bm;
            const exists = window.UserData?.hasBookmark?.(manga.id, chapterId);
            if (exists) {
                UserData.removeBookmark(manga.id, chapterId);
                btn.classList.remove('on'); btn.title = 'Ajouter un signet';
                MH.toast?.('Signet retiré');
            } else {
                UserData.addBookmark({
                    mangaId: manga.id, source: API.sources.current,
                    title: manga.title, cover: manga.cover || manga.coverThumb,
                    chapterId, chapterNum: btn.dataset.bmnum, label: btn.dataset.bmtitle,
                });
                btn.classList.add('on'); btn.title = 'Retirer le signet';
                MH.toast?.('Signet ajouté — retrouvé dans ta bibliothèque');
            }
        });
    }

    // Handler délégué : marquer un chapitre lu / non lu en un clic
    let _readBound = false;
    function bindReadToggle() {
        if (_readBound) return; _readBound = true;
        document.addEventListener('click', async (e) => {
            const btn = e.target.closest('.chapter-read-dot[data-read]');
            if (!btn) return;
            e.preventDefault(); e.stopPropagation();
            if (!API.isLoggedIn()) { MH.toast?.('Connecte-toi pour suivre ta lecture'); return; }
            const chapterId = btn.dataset.read;
            const willRead = !readChapsSet.has(chapterId);
            // MAJ optimiste de l'UI
            if (willRead) readChapsSet.add(chapterId); else readChapsSet.delete(chapterId);
            btn.classList.toggle('is-read', willRead);
            btn.title = willRead ? 'Lu — clic pour marquer non lu' : 'Non lu — clic pour marquer lu';
            btn.closest('.chapter-row')?.classList.toggle('chapter-row--read', willRead);
            renderSidebar();
            try {
                await API.me.markChapter({ mangaId: manga.id, chapterId, chapter: btn.dataset.readnum, read: willRead });
            } catch (err) {
                // rollback
                if (willRead) readChapsSet.delete(chapterId); else readChapsSet.add(chapterId);
                btn.classList.toggle('is-read', !willRead);
                renderSidebar();
                MH.toast?.('Erreur : ' + err.message);
            }
        });
    }

    // ── CHAPITRES ──
    function renderChapitres(el) {
        bindBookmarkHandler();
        bindReadToggle();
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
                    <button class="chap-sort-btn" id="chapRandom" title="Ouvrir un chapitre au hasard">🎲 Au hasard</button>
                    <button class="chap-sort-btn" id="chapMarkAll" title="Marquer tous les chapitres comme lus">✓ Tout lu</button>
                    <button class="chap-sort-btn" id="chapSortBtn">${chapSortAsc ? '↑ Ancien' : '↓ Récent'}</button>
                </div>
            </div>
            <div class="chapters-list" id="chapsList"></div>
        </div>`;

        const input   = el.querySelector('#chapSearch');
        const sortBtn = el.querySelector('#chapSortBtn');
        const markAll = el.querySelector('#chapMarkAll');
        const randBtn = el.querySelector('#chapRandom');
        const list    = el.querySelector('#chapsList');
        const countEl = el.querySelector('#chapCount');

        if (randBtn) randBtn.addEventListener('click', () => {
            if (!chapters.length) return;
            const c = chapters[Math.floor(Math.random() * chapters.length)];
            window.location.href = MH.readerHref(manga.id, c.id, API.sources.current);
        });

        if (markAll) markAll.addEventListener('click', async () => {
            if (!API.isLoggedIn()) { MH.toast?.('Connecte-toi pour suivre ta lecture'); return; }
            const items = chapters.map(c => ({ chapterId: c.id, chapter: c.chapter }));
            if (!items.length) return;
            markAll.disabled = true; const lbl = markAll.textContent; markAll.textContent = '…';
            try {
                await API.me.markChaptersBulk(manga.id, items);
                chapters.forEach(c => readChapsSet.add(c.id));
                render(); renderSidebar();
                MH.toast?.(`${items.length} chapitre(s) marqué(s) comme lus`);
            } catch (e) { MH.toast?.('Erreur : ' + e.message); }
            finally { markAll.disabled = false; markAll.textContent = lbl; }
        });

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
            <div class="progress-stat">
                <span class="progress-label">Restant à lire</span>
                <span class="progress-val">${Math.max(0, total - chapRead)}${total - chapRead <= 0 ? ' · à jour ✓' : ''}</span>
            </div>
            ${(() => {
                const remain = Math.max(0, total - chapRead);
                if (!remain) return '';
                const perChap = MH.isNovelSource(API.sources.current) ? 15 : 4; // minutes / chapitre
                const mins = remain * perChap;
                const h = Math.floor(mins / 60), m = mins % 60;
                const txt = h ? `${h} h${m ? ' ' + m + ' min' : ''}` : `${m} min`;
                return `<div class="progress-stat">
                    <span class="progress-label">Temps estimé</span>
                    <span class="progress-val">≈ ${txt}</span>
                </div>`;
            })()}
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
        </div>

        <!-- Notes personnelles (privées, synchronisées) -->
        <div class="sidebar-note card" id="noteCard" style="padding:14px">
            <div class="sidebar-block-header"><span class="sidebar-block-title">Ma note perso</span>
                <span id="noteStatus" style="font-size:11px;color:var(--text3)"></span></div>
            <textarea id="noteArea" placeholder="Note privée : où j'en suis, mon avis, à retenir…"
                style="width:100%;margin-top:8px;min-height:78px;resize:vertical;background:var(--bg3);border:1px solid var(--border2);border-radius:9px;color:var(--text);font-size:12.5px;padding:9px 11px;font-family:inherit;line-height:1.5"></textarea>
        </div>`;

        document.getElementById('sidebarResumeBtn')?.addEventListener('click', () => {
            if (resumeChap) window.location.href = MH.readerHref(manga.id, resumeChap, API.sources.current);
        });

        renderRating();
        renderNote();
    }

    // ── NOTE PERSONNELLE (UserData : sync + miroir local) ──
    async function renderNote() {
        const area = document.getElementById('noteArea');
        const status = document.getElementById('noteStatus');
        if (!area || !window.UserData) return;
        await UserData.ready();
        const src = API.sources.current;
        area.value = UserData.getNote(manga.id, src);
        let t = null;
        area.addEventListener('input', () => {
            if (status) status.textContent = 'Enregistrement…';
            clearTimeout(t);
            t = setTimeout(() => {
                UserData.setNote(manga.id, src, area.value);
                if (status) { status.textContent = 'Enregistré ✓'; setTimeout(() => { status.textContent = ''; }, 1500); }
            }, 500);
        });
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
                    MH.toast(`Noté ${n}/5 `);
                    renderRating();
                } catch (e) { MH.toast('Erreur : ' + e.message); }
            });
        });
    }
})();
