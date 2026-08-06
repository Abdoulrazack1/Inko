// serie.js — Page série dynamique (backend + MangaDex metadata)
(function () {
    'use strict';

    let manga       = null;
    let chapters    = [];
    let readChapsSet= new Set();
    let progress    = null;
    let activeTab   = 'apercu';
    // Audit AMEL-98 : sur One Piece (1 183 chapitres), la liste brute est
    // inexploitable — et le filtre comme le tri repartaient de zero a chaque
    // ouverture de fiche. Un reglage qu'il faut reposer a chaque visite n'est
    // pas un reglage. Ils sont persistes globalement (et non par serie) : c'est
    // une habitude de lecture, pas une propriete de l'oeuvre.
    const PREF_TRI    = 'serie_chap_tri_asc';
    const PREF_FILTRE = 'serie_chap_filtre';
    let chapSortAsc = window.Storage?.getPref(PREF_TRI) === '1';
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
        // §13 : accent fonctionnel selon le type de contenu (Kakishibu manga / Ai roman)
        document.body.dataset.content = MH.isNovelSource(API.sources.current) ? 'novel' : 'manga';
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
                    <img src="${MH.cover(manga.coverLarge, manga.cover)}" alt="${MH.esc(manga.title)}"
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
                    <!-- Audit AMEL-100 : « Lire depuis le début », « Reprendre
                         Ch.X » et « 1er non-lu » se présentaient comme trois
                         boutons de même poids. Trois façons de commencer, aucune
                         hiérarchie : il fallait les lire pour choisir.
                         L'action PRINCIPALE est désormais unique et nommée
                         d'après la situation réelle (reprendre si une lecture
                         est en cours, sinon commencer) ; les deux autres
                         deviennent des replis discrets. -->
                    ${resumeChap
                        ? `<button class="btn btn-primary btn-reprise" id="btnResume">
                               <span class="reprise-label">${resumeLabel.replace(/^↻\s*/, '')}</span>
                               <span class="reprise-sub">Reprendre où tu t'es arrêté·e</span>
                           </button>
                           <button class="btn btn-ghost btn-sm" id="btnReadStart" title="Repartir du chapitre 1">Depuis le début</button>`
                        : `<button class="btn btn-primary btn-reprise" id="btnReadStart">
                               <span class="reprise-label">Commencer la lecture</span>
                               <span class="reprise-sub">Premier chapitre disponible</span>
                           </button>`}
                    <button class="btn btn-ghost btn-sm" id="btnNextUnread" title="Ouvrir le premier chapitre non lu">1er non-lu</button>
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
                    <button class="btn btn-ghost btn-sm" id="btnAniList" title="Suivi AniList — pousse ta progression, ton statut et ta note">
                        <svg viewBox="0 0 24 24" fill="currentColor" width="13" height="13" style="vertical-align:-2px;margin-right:5px"><path d="M6.361 2.943 0 21.056h4.942l1.077-3.133H11.4l1.052 3.133H22.9c.71 0 1.1-.392 1.1-1.101V17.53c0-.71-.39-1.101-1.1-1.101h-6.483V4.045c0-.71-.392-1.102-1.101-1.102h-2.422c-.71 0-1.101.392-1.101 1.102v1.064l-.758-2.166zm2.324 5.948 1.688 5.018H7.144z"/></svg>AniList
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
                if (status) { try { window.AniList?.syncByTitle(manga.title, { status }); } catch (e) { window.MH?.err?.('serie.js', e); } }
                MH.toast(status ? 'Statut : ' + e.target.options[e.target.selectedIndex].text : 'Statut retiré');
            } catch (err) { MH.toast('Erreur : ' + err.message); }
        });

        document.getElementById('btnCategory')?.addEventListener('click', async () => {
            if (!API.isLoggedIn()) { MH.toast('Connecte-toi'); return; }
            const name = await MH.prompt('Catégorie', { message: 'Laisse vide pour aucune.', value: libCategory || '', okText: 'Enregistrer' });
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

        // ── Suivi AniList (façon Mihon) : lie le compte au besoin puis pousse
        //    progression (dernier chapitre lu) + statut + note vers AniList ──
        const alBtn = document.getElementById('btnAniList');
        if (alBtn && window.AniList?.isLinked?.()) alBtn.style.color = '#02a9ff';
        alBtn?.addEventListener('click', async () => {
            if (!window.AniList) { MH.toast('AniList indisponible'); return; }
            const label = alBtn.innerHTML;
            try {
                if (!AniList.isLinked()) {
                    alBtn.textContent = 'Redirection vers AniList…';
                    await AniList.connect();   // redirige la page ; au retour, re-cliquer synchronise
                    return;
                }
                alBtn.disabled = true;
                alBtn.textContent = 'Synchronisation…';
                let mid = await AniList.mediaId(manga.title);
                if (!mid) throw new Error('œuvre introuvable sur AniList');
                // Audit N56 : si le rattachement vient d'une correspondance
                // APPROXIMATIVE (pas de titre exact), on le fait valider une fois
                // — sinon la progression peut partir vers la mauvaise fiche sans
                // que rien ne le signale.
                const link = await AniList.getLink(manga.title);
                if (link && link.exact === false) {
                    const info = await AniList.mediaInfo(mid);
                    const name = info?.title?.romaji || info?.title?.english || ('fiche #' + mid);
                    const ok = await MH.confirm(
                        `Inko a lié cette série à « ${MH.esc(name)} » sur AniList (correspondance approximative). Est-ce la bonne fiche ?`,
                        { okText: 'Oui, c\'est elle', cancelText: 'Choisir la bonne', title: 'Rattachement AniList' });
                    if (ok) {
                        await AniList.setLink(manga.title, mid);   // confirme le lien
                    } else {
                        const chosen = await pickAniListMedia();
                        if (!chosen) { MH.toast('Synchronisation annulée'); return; }
                        mid = chosen;
                    }
                }
                let prog = null;
                for (const c of chapters) {
                    if (readChapsSet.has(c.id) && Number.isFinite(+c.chapter)) prog = Math.max(prog ?? 0, +c.chapter);
                }
                let score = null;
                try { const r = await API.ratings.get(manga.id); if (r.mine?.rating) score = r.mine.rating * 20; } catch (e) { window.MH?.err?.('serie.js', e); }
                const payload = { status: libStatus || 'reading' };
                if (prog != null) payload.progress = prog;
                if (score != null) payload.score = score;
                await AniList.syncEntry(mid, payload);
                MH.toast('Synchronisé avec AniList ✓');
            } catch (err) {
                MH.toast('AniList : ' + (err?.message || 'erreur'));
            } finally {
                alBtn.disabled = false;
                alBtn.innerHTML = label;
            }
        });
        // Clic droit sur le bouton AniList : voir / corriger le rattachement (audit N56)
        alBtn?.addEventListener('contextmenu', async (e) => {
            e.preventDefault();
            if (!window.AniList) return;
            const link = await AniList.getLink(manga.title);
            if (!link) { MH.toast('Pas encore de fiche AniList liée — lance une synchro d\'abord.'); return; }
            const info = await AniList.mediaInfo(link.id);
            const name = info?.title?.romaji || info?.title?.english || ('fiche #' + link.id);
            const keep = await MH.confirm(
                `Cette série est liée à « ${MH.esc(name)} » sur AniList${link.exact === false ? ' (correspondance approximative)' : ''}. Garder ce rattachement ?`,
                { okText: 'Garder', cancelText: 'Changer de fiche', title: 'Rattachement AniList' });
            if (!keep) await pickAniListMedia();
        });
    }

    // Sélecteur de fiche AniList (audit N56) : liste les meilleurs résultats,
    // l'utilisateur choisit, le lien est persisté pour toutes les synchros à venir.
    async function pickAniListMedia() {
        const media = await AniList.searchMedia(manga.title);
        if (!media.length) { MH.toast('Aucun résultat AniList pour ce titre'); return null; }
        const lines = media.map((m, i) => `${i + 1}. ${m.title?.romaji || m.title?.english || ('#' + m.id)}`).join('\n');
        const ans = await MH.prompt('Quelle est la bonne fiche AniList ?', {
            message: lines, placeholder: `Numéro 1-${media.length}`, okText: 'Lier' });
        const idx = parseInt(ans, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= media.length) return null;
        await AniList.setLink(manga.title, media[idx].id);
        MH.toast(`Liée à « ${media[idx].title?.romaji || media[idx].title?.english} » ✓`);
        return media[idx].id;
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
            <div class="chapters-block-header">
                <div>
                    <div class="chapters-block-title">Tu aimeras aussi</div>
                    <div id="similarSub" style="font-size:12px;color:var(--text3);margin-top:2px"></div>
                </div>
            </div>
            <div id="similarRow" style="display:flex;gap:12px;overflow-x:auto;padding:4px 2px 8px"></div>
        </div>
        <!-- Audit AMEL-102 : quand une source casse, l'utilisateur ne sait pas
             que le titre existe ailleurs — alors que la recherche sait déjà
             regrouper une œuvre entre plusieurs sources. -->
        <div class="chapters-block" id="autresSourcesBlock" style="display:none">
            <div class="chapters-block-header">
                <div>
                    <div class="chapters-block-title">Aussi disponible sur</div>
                    <div style="font-size:12px;color:var(--text3);margin-top:2px">Mêmes chapitres, autre source — utile si celle-ci est indisponible</div>
                </div>
            </div>
            <div id="autresSourcesRow" style="display:flex;gap:8px;flex-wrap:wrap;padding:4px 2px 8px"></div>
        </div>
        <!-- Audit AMEL-101 : l'auteur et les tags étaient affichés sans être
             cliquables au-delà des 4 premiers genres du titre. -->
        <div class="chapters-block" id="lieesBlock" style="display:none">
            <div class="chapters-block-header">
                <div class="chapters-block-title">Explorer</div>
            </div>
            <div id="lieesRow" style="display:flex;gap:8px;flex-wrap:wrap;padding:4px 2px 8px"></div>
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
        chargerAutresSources();
        rendreLiees();
    }

    // ── Annulation d'un marquage en masse (audit AMEL-40) ────
    // « Tout lu » touche des centaines de chapitres d'un coup et n'avait aucun
    // retour arrière. La frontière entre lu et non lu est pourtant la donnée la
    // plus longue à reconstituer à la main.
    //
    // Une barre visible et persistante, pas un simple message : un toast de
    // trois secondes ne laisse pas le temps de réaliser qu'on s'est trompé.
    // Elle reste jusqu'à ce qu'on l'utilise ou qu'on la ferme.
    function proposerAnnulation(nouveaux) {
        document.getElementById('undoMarkBar')?.remove();
        if (!nouveaux.length) { MH.toast?.('Tous les chapitres étaient déjà lus'); return; }

        const bar = document.createElement('div');
        bar.id = 'undoMarkBar';
        bar.className = 'undo-bar';
        bar.setAttribute('role', 'status');
        bar.innerHTML = `<span>${nouveaux.length} chapitre(s) marqué(s) comme lus.</span>
            <button type="button" class="undo-bar-action" id="undoMarkGo">Annuler</button>
            <button type="button" class="undo-bar-close" id="undoMarkClose" aria-label="Fermer">✕</button>`;
        document.body.appendChild(bar);

        bar.querySelector('#undoMarkClose').onclick = () => bar.remove();
        bar.querySelector('#undoMarkGo').onclick = async () => {
            const btn = bar.querySelector('#undoMarkGo');
            btn.disabled = true; btn.textContent = 'Annulation…';
            try {
                await API.me.unmarkChaptersBulk(manga.id, nouveaux);
                nouveaux.forEach(id => readChapsSet.delete(id));
                renderTab('chapitres'); renderSidebar();
                MH.toast?.(`${nouveaux.length} chapitre(s) remis en non-lus`);
                bar.remove();
            } catch (e) {
                btn.disabled = false; btn.textContent = 'Réessayer';
                MH.toast?.('Annulation impossible : ' + e.message);
            }
        };
    }

    // ── Téléchargement d'une plage (audit AMEL-99) ───────────
    // Le bouton n'existait que dans le lecteur, chapitre par chapitre :
    // préparer un trajet demandait d'ouvrir chaque chapitre l'un après l'autre.
    //
    // Choix de conception : les chapitres sont téléchargés UN PAR UN, en série.
    // Les paralléliser irait plus vite mais assommerait la source scrapée — et
    // c'est exactement ce qui fait bannir une adresse IP. La progression est
    // affichée et l'opération interruptible, parce qu'une plage un peu large
    // peut durer plusieurs minutes.
    async function telechargerPlage() {
        if (!window.Downloads) { MH.toast?.('Téléchargement hors-ligne indisponible'); return; }
        if (MH.isNovelSource(API.sources.current)) {
            MH.toast?.('Pour un roman, le téléchargement se fait depuis le lecteur.');
            return;
        }
        if (!chapters.length) { MH.toast?.('Aucun chapitre à télécharger'); return; }

        // Du plus ancien au plus récent : « les 10 premiers » veut dire le début
        // de la série, pas les dix derniers parus.
        const asc = [...chapters].sort((a, b) => (+a.chapter || 0) - (+b.chapter || 0));
        const nonTelecharges = [];
        for (const c of asc) if (!(await window.Downloads.has(c.id))) nonTelecharges.push(c);
        if (!nonTelecharges.length) { MH.toast?.('Tous les chapitres sont déjà téléchargés'); return; }

        const combien = await MH.prompt(
            `Combien de chapitres télécharger, à partir du plus ancien non téléchargé `
            + `(Ch. ${MH.chapNum(nonTelecharges[0].chapter)}) ? ${nonTelecharges.length} disponibles.`,
            { value: String(Math.min(5, nonTelecharges.length)), okText: 'Télécharger' });
        const n = Math.max(0, Math.min(nonTelecharges.length, parseInt(combien, 10) || 0));
        if (!n) return;

        const lot = nonTelecharges.slice(0, n);
        const btn = document.getElementById('chapDlRange');
        let annule = false;
        if (btn) {
            btn.dataset.libelle = btn.textContent;
            btn.title = 'Cliquer pour interrompre';
            btn.onclick = () => { annule = true; MH.toast?.('Interruption après le chapitre en cours…'); };
        }

        let ok = 0, echecs = 0, premiereErreur = null;
        for (let i = 0; i < lot.length; i++) {
            if (annule) break;
            const c = lot[i];
            if (btn) btn.textContent = `↓ ${i + 1}/${lot.length}…`;
            try {
                const d = await API.mangas.pages(c.id);
                const pages = d.pages || [];
                if (!pages.length) throw new Error('aucune page renvoyée par la source');
                await window.Downloads.download({
                    mangaId: manga.id, chapterId: c.id, chapterNum: c.chapter,
                    mangaTitle: manga.title, cover: manga.cover || manga.coverThumb,
                    source: API.sources.current,
                }, pages);
                ok++;
            } catch (e) {
                echecs++;
                // « 1 en échec » sans raison n'est pas exploitable : ni par
                // l'utilisateur (que faire ?), ni au diagnostic. On garde la
                // première cause pour la dire.
                if (!premiereErreur) premiereErreur = e.message || String(e);
                window.MH?.err?.('serie.js', e);
            }
        }

        if (btn) {
            btn.textContent = btn.dataset.libelle || '↓ Télécharger…';
            btn.title = 'Télécharger une plage de chapitres pour le hors-ligne';
            btn.onclick = telechargerPlage;
        }
        MH.toast?.(echecs
            ? `${ok} chapitre(s) téléchargé(s), ${echecs} en échec — ${premiereErreur}`
            : `${ok} chapitre(s) disponibles hors-ligne`);
    }

    // ── Disponibilité sur les autres sources (audit AMEL-102) ──
    // Quand une source tombe ou retire un titre, l'utilisateur se retrouve
    // devant une fiche vide sans savoir que la même œuvre est lisible ailleurs.
    // La recherche sait déjà rapprocher un titre entre sources ; on applique le
    // même rapprochement, restreint à CETTE œuvre.
    // Le cache est une PROMESSE, pas un tableau. Première version : je posais
    // `cache = []` avant les `await`, si bien qu'un second rendu d'onglet —
    // loadChapters() en déclenche un — voyait un cache « prêt mais vide » et
    // sortait aussitôt, tandis que le premier appel écrivait dans un élément
    // déjà remplacé. Le bloc n'apparaissait donc jamais, alors que les sources
    // répondaient correctement. Avec une promesse, tout appel attend le même
    // résultat puis écrit dans le DOM COURANT.
    let autresSourcesPromesse = null;

    async function chargerAutresSources() {
        if (!manga?.title) return;

        if (!autresSourcesPromesse) {
            autresSourcesPromesse = (async () => {
                const trouves = [];
                let sources = [];
                try { sources = (await API.sources.list()) || []; } catch (e) { return trouves; }
                const courante = API.sources.current;
                const candidates = sources.filter(s => s.id !== courante
                    && (MH.isSourceEnabled ? MH.isSourceEnabled(s.id) : true)
                    && (s.capabilities || []).includes('search'));

                const norm = (t) => (t || '').toLowerCase().normalize('NFD')
                    .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
                const cible = norm(manga.title);

                // En parallèle, et chaque échec est absorbé : ce bloc est un
                // bonus, il ne doit jamais retarder ni casser la fiche.
                await Promise.all(candidates.map(async (s) => {
                    try {
                        const r = await API.mangas.searchFor(s.id, { q: manga.title, limit: 6 });
                        const m = (r.results || []).find(x => norm(x.title) === cible);
                        if (m) trouves.push({ source: s.id, nom: s.name || s.id, id: m.id });
                    } catch (e) { /* source muette : simplement pas listée */ }
                }));
                return trouves;
            })();
        }

        const trouves = await autresSourcesPromesse;
        if (!trouves.length) return;   // rien à dire : pas de bloc vide
        // Éléments relus APRÈS l'attente : entre-temps l'onglet a pu être
        // reconstruit, et les anciens nœuds ne sont plus dans le document.
        const block = document.getElementById('autresSourcesBlock');
        const row   = document.getElementById('autresSourcesRow');
        if (!block || !row) return;
        row.innerHTML = trouves.map(a => `
            <a class="tag tag-link" style="padding:7px 13px;font-size:12.5px"
               href="serie.html?id=${encodeURIComponent(a.id)}&source=${encodeURIComponent(a.source)}">
                ${MH.esc(a.nom)}
            </a>`).join('');
        block.style.display = '';
    }

    // ── Explorer : auteur et genres (audit AMEL-101) ──────────
    function rendreLiees() {
        const block = document.getElementById('lieesBlock');
        const row   = document.getElementById('lieesRow');
        if (!block || !row) return;
        const liens = [];
        if (manga.author) {
            liens.push(`<a class="tag tag-link" style="padding:7px 13px;font-size:12.5px"
                href="recherche.html?q=${encodeURIComponent(manga.author)}">Du même auteur · ${MH.esc(manga.author)}</a>`);
        }
        // Tous les genres, pas seulement les 4 du titre : c'est ici qu'on
        // explore, la place ne manque pas.
        (manga.tags || []).slice(0, 12).forEach(t => {
            liens.push(`<a class="tag tag-link" style="padding:7px 13px;font-size:12.5px"
                href="catalogue.html?tags=${encodeURIComponent(t)}">${MH.esc(t)}</a>`);
        });
        if (!liens.length) return;
        row.innerHTML = liens.join('');
        block.style.display = '';
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
    // Pagination par fil (audit N51) : on garde en mémoire les fils déjà chargés,
    // et « Voir les commentaires précédents » va chercher les fils plus anciens.
    const COMMENTS_PAGE = 50;
    let commentItems = [];      // commentaires chargés (racines + réponses)
    let commentHasMore = false;
    let commentTotal = 0;

    async function loadComments(opts = {}) {
        const more = !!opts.more;
        const listEl = document.getElementById('commentsList');
        const formEl = document.getElementById('commentForm');
        const countEl = document.getElementById('commentCount');
        if (!listEl) return;
        if (!more && formEl) {
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
        const rootsLoaded = commentItems.filter(c => !c.parentId).length;
        let res;
        try {
            res = more
                ? await API.comments.list(manga.id, { limit: COMMENTS_PAGE, offset: rootsLoaded })
                // rafraîchissement : on recharge autant de fils qu'affichés pour ne pas rétrécir la vue
                : await API.comments.list(manga.id, { limit: Math.max(COMMENTS_PAGE, rootsLoaded) });
        } catch (e) { res = { items: [], total: 0, hasMore: false }; }
        // Tolère l'ancien format tableau (réponse encore en cache Service Worker)
        const items = Array.isArray(res) ? res : (res.items || []);
        commentHasMore = Array.isArray(res) ? false : !!res.hasMore;
        commentTotal   = Array.isArray(res) ? items.length : (res.total || 0);
        if (more) {
            const seen = new Set(commentItems.map(c => c.id));
            commentItems = commentItems.concat(items.filter(c => !seen.has(c.id)));
        } else {
            commentItems = items;
        }
        if (countEl) countEl.textContent = commentTotal ? `· ${commentTotal}` : '';
        if (!commentItems.length) {
            listEl.innerHTML = `<div class="comment-empty">Aucun commentaire pour l'instant. Sois le premier à donner ton avis.</div>`;
            return;
        }
        renderCommentTree(listEl, commentItems);
    }

    // Transforme @username en lien vers le profil public (sur texte déjà échappé)
    function linkifyMentions(escapedText) {
        return escapedText.replace(/@([A-Za-z0-9_]{2,50})/g,
            '<a href="u.html?u=$1" class="comment-user" style="font-weight:600">@$1</a>');
    }

    function renderCommentTree(listEl, comments) {
        const me      = API.user || {};
        const myName  = me.username;
        const isAdmin = me.role === 'admin';
        const loggedIn = API.isLoggedIn();

        // Regroupe chaque commentaire sous son ancêtre racine (2 niveaux visuels)
        const byId = new Map(comments.map(c => [c.id, c]));
        const rootOf = (c) => { let cur = c, guard = 0; while (cur.parentId && byId.get(cur.parentId) && guard++ < 50) cur = byId.get(cur.parentId); return cur; };
        const roots = comments.filter(c => !c.parentId);
        const repliesByRoot = new Map();
        comments.filter(c => c.parentId).forEach(c => {
            const r = rootOf(c).id;
            (repliesByRoot.get(r) || repliesByRoot.set(r, []).get(r)).push(c);
        });
        roots.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // récents en haut

        const one = (c, isReply) => {
            const canDel = loggedIn && (c.user === myName || isAdmin);
            const flagged = isAdmin && c.reports > 0 ? `<span title="${c.reports} signalement(s)" style="color:#ef4444;font-size:11px">⚑ ${c.reports}</span>` : '';
            return `
            <div class="comment-item" id="comment-${c.id}" data-cid="${c.id}" style="${isReply ? 'margin-left:42px;' : ''}">
                <div class="comment-avatar">${MH.esc((c.user || '?').slice(0, 1).toUpperCase())}</div>
                <div class="comment-body">
                    <div class="comment-head">
                        <a class="comment-user" href="u.html?u=${encodeURIComponent(c.user || '')}">${MH.esc(c.user || 'Anonyme')}</a>
                        <span class="comment-date">${commentTimeAgo(c.createdAt)}</span>
                        ${flagged}
                    </div>
                    <div class="comment-text">${linkifyMentions(MH.esc(c.text || ''))}</div>
                    <div class="comment-actions" style="display:flex;gap:14px;margin-top:5px;font-size:11.5px;color:var(--text3)">
                        ${loggedIn ? `<button type="button" data-reply="${c.id}" data-replyuser="${MH.esc(c.user || '')}" class="comment-act" style="background:none;border:none;color:var(--text3);cursor:pointer;padding:0">Répondre</button>` : ''}
                        ${loggedIn && c.user !== myName ? `<button type="button" data-report="${c.id}" class="comment-act" style="background:none;border:none;color:var(--text3);cursor:pointer;padding:0">Signaler</button>` : ''}
                        ${canDel ? `<button type="button" data-del="${c.id}" class="comment-act" style="background:none;border:none;color:#ef4444;cursor:pointer;padding:0">Supprimer</button>` : ''}
                    </div>
                    <div class="comment-replybox" data-replybox="${c.id}"></div>
                </div>
            </div>`;
        };

        listEl.innerHTML = roots.map(r => {
            const replies = (repliesByRoot.get(r.id) || []).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
            return one(r, false) + replies.map(rep => one(rep, true)).join('');
        }).join('');

        if (commentHasMore) {
            const moreBtn = document.createElement('button');
            moreBtn.type = 'button';
            moreBtn.className = 'btn btn-sm';
            moreBtn.style.cssText = 'display:block;margin:12px auto 0';
            moreBtn.textContent = 'Voir les commentaires précédents';
            moreBtn.onclick = () => { moreBtn.disabled = true; loadComments({ more: true }); };
            listEl.appendChild(moreBtn);
        }

        // Interactions (handler unique, ré-assigné à chaque rendu)
        listEl.onclick = async (e) => {
            const replyBtn  = e.target.closest('[data-reply]');
            const reportBtn = e.target.closest('[data-report]');
            const delBtn    = e.target.closest('[data-del]');
            if (replyBtn)  return openReplyBox(replyBtn.dataset.reply, replyBtn.dataset.replyuser);
            if (reportBtn) return reportComment(reportBtn.dataset.report);
            if (delBtn)    return deleteComment(delBtn.dataset.del);
        };
    }

    function openReplyBox(parentId, replyUser) {
        const box = document.querySelector(`[data-replybox="${parentId}"]`);
        if (!box) return;
        if (box.dataset.open) { box.innerHTML = ''; box.dataset.open = ''; return; }
        box.dataset.open = '1';
        box.innerHTML = `
            <div style="margin-top:8px">
                <textarea class="comment-textarea" rows="2" maxlength="1000" placeholder="Répondre à @${MH.esc(replyUser)}…"></textarea>
                <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:6px">
                    <button class="btn btn-sm" data-replycancel="${parentId}">Annuler</button>
                    <button class="btn btn-primary btn-sm" data-replysend="${parentId}">Répondre</button>
                </div>
            </div>`;
        // Audit S3 : le préfixe « @pseudo » est posé via .value (DOM), jamais
        // interpolé dans le HTML — un pseudo contenant </textarea> cassait le
        // parsing RCDATA et injectait un élément réel (XSS stocké).
        const ta = box.querySelector('textarea');
        ta.value = `@${replyUser} `;
        ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
        box.querySelector('[data-replycancel]').onclick = () => { box.innerHTML = ''; box.dataset.open = ''; };
        box.querySelector('[data-replysend]').onclick = async (ev) => {
            const text = ta.value.trim(); if (!text) return;
            ev.target.disabled = true;
            try { await API.comments.reply(manga.id, +parentId, text); await loadComments(); MH.toast?.('Réponse publiée'); }
            catch (e2) { MH.toast?.('Erreur : ' + e2.message); ev.target.disabled = false; }
        };
    }

    async function reportComment(id) {
        const reason = await MH.prompt('Signaler ce commentaire', { message: 'Raison (optionnel)', placeholder: 'Spam, spoiler…', okText: 'Signaler' });
        if (reason === null) return; // annulé
        try { await API.comments.report(+id, reason || ''); MH.toast?.('Commentaire signalé. Merci.'); }
        catch (e) { MH.toast?.('Erreur : ' + e.message); }
    }

    async function deleteComment(id) {
        if (!await MH.confirm('Supprimer ce commentaire ?', { danger: true, okText: 'Supprimer' })) return;
        try { await API.comments.remove(+id); await loadComments(); MH.toast?.('Commentaire supprimé'); }
        catch (e) { MH.toast?.('Erreur : ' + e.message); }
    }

    // ── Similaires (AniList) — refonte audit §12 (v2) ──
    // Chaque suggestion est cliquable DÈS LE DÉPART (vers la recherche améliorée,
    // qui dédoublonne par titre et affiche des vrais résultats) : jamais de carte
    // morte « pas sur tes sources ». En arrière-plan on cherche la correspondance
    // sur les sources installées (comparaison souple) et, si trouvée, on fait
    // pointer la carte directement sur la fiche + un badge « ✓ source ».
    let similarItems = null;   // null = pas encore chargé
    function normTitle(t) {
        return (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '');
    }
    // Comparaison souple : égalité normalisée, ou l'un contient l'autre (sous-titres,
    // éditions, saisons) — plus tolérant que l'égalité stricte qui ne matchait presque rien.
    function titleMatch(a, b) {
        const na = normTitle(a), nb = normTitle(b);
        if (!na || !nb) return false;
        if (na === nb) return true;
        if (na.length >= 5 && nb.length >= 5 && (na.includes(nb) || nb.includes(na))) return true;
        return false;
    }
    async function loadSimilar() {
        const block = document.getElementById('similarBlock');
        const row = document.getElementById('similarRow');
        const sub = document.getElementById('similarSub');
        if (!block || !row || !manga?.title) return;
        if (similarItems === null) {
            try { similarItems = (await API.art.similar(manga.title)).items || []; }
            catch (e) { similarItems = []; }
        }
        if (!similarItems.length) return;   // rien de pertinent : on ne montre pas un bloc vide
        const items = similarItems.slice(0, 12);
        if (sub) sub.textContent = `Parce que tu lis « ${manga.title} »`;

        row.innerHTML = items.map((m, i) => `
            <a class="sim-card" data-idx="${i}" href="recherche.html?q=${encodeURIComponent(m.title)}"
               style="flex:0 0 116px;text-decoration:none;color:inherit;display:block">
                <div style="aspect-ratio:3/4;border-radius:10px;overflow:hidden;background:var(--bg4);position:relative">
                    <img src="${MH.esc(m.cover || '')}" alt="" loading="lazy" style="width:100%;height:100%;object-fit:cover" onerror="this.style.visibility='hidden'">
                    <div class="sim-badge" data-badge="${i}" style="display:none;position:absolute;left:6px;bottom:6px;font-size:9px;font-weight:700;padding:2px 6px;border-radius:20px;background:#3f7d4e;color:#fff;box-shadow:0 2px 6px rgba(0,0,0,.4)"></div>
                </div>
                <div style="font-size:11.5px;margin-top:6px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${MH.esc(m.title)}</div>
            </a>`).join('');
        block.style.display = '';

        verifyExistence(items, row);
    }

    // Recherche silencieuse : si une correspondance existe sur une source installée,
    // on surclasse la carte en lien direct vers la fiche. Jamais de rétrogradation.
    async function verifyExistence(items, row) {
        let next = 0;
        const CONC = 3;
        const worker = async () => {
            while (next < items.length) {
                const i = next++;
                const card = row.querySelector(`.sim-card[data-idx="${i}"]`);
                if (!card) continue;
                try {
                    const data = await API.mangas.searchAll(items[i].title);
                    for (const g of (data.groups || [])) {
                        if (g.error || !g.items) continue;
                        const hit = g.items.find(m => titleMatch(items[i].title, m.title));
                        if (hit) { upgradeSimCard(card, { source: g.source, sourceName: g.sourceName, id: hit.id }); break; }
                    }
                } catch (e) { /* la carte garde son lien de recherche : toujours utile */ }
            }
        };
        await Promise.all(Array.from({ length: Math.min(CONC, items.length) }, worker));
    }

    function upgradeSimCard(card, match) {
        card.setAttribute('href', `serie.html?id=${encodeURIComponent(match.id)}&source=${encodeURIComponent(match.source)}`);
        const badge = card.querySelector('.sim-badge');
        if (badge) { badge.style.display = ''; badge.textContent = '✓ ' + MH.esc(match.sourceName || match.source); }
    }

    function renderChapterRow(c) {
        const isRead = readChapsSet.has(c.id);
        const isBm = window.UserData?.hasBookmark?.(manga.id, c.id);
        return `
        <a href="${MH.readerHref(manga.id, c.id, API.sources.current)}" class="chapter-row${isRead ? ' chapter-row--read' : ''}">
            <div class="chapter-num">${MH.unitLabel(API.sources.current, { short: true })} ${c.chapter}</div>
            <div class="chapter-title-text">${MH.esc(c.title || 'Chapitre ' + c.chapter)}</div>
            <div class="chapter-meta">
                <span class="chapter-date" title="${c.publishedAt ? MH.fullDate(c.publishedAt) : ''}">${c.publishedAt ? MH.relTime(c.publishedAt) : ''}</span>
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

        // Repris des preferences (audit AMEL-98). Une valeur inconnue —
        // preference ecrite par une version anterieure — retombe sur 'all'
        // plutot que de filtrer sur rien.
        const filtreEnregistre = window.Storage?.getPref(PREF_FILTRE);
        let readFilter = ['all', 'unread', 'read'].includes(filtreEnregistre) ? filtreEnregistre : 'all';
        el.innerHTML = `
        <div class="chapters-block">
            <div class="chapters-block-header">
                <div class="chapters-block-title">Tous les chapitres · <span id="chapCount">${chapters.length}</span></div>
                <div class="chapters-controls">
                    <input type="text" id="chapSearch" class="chap-search-input" placeholder="Chercher un chapitre…">
                    <select id="chapLang" class="chap-sort-btn" title="Langue des chapitres" style="cursor:pointer">
                        ${[['fr,en','🌐 Toutes'],['fr','🇫🇷 Français'],['en','🇬🇧 Anglais'],['fr,en,ja','+ 日本語']].map(([v,l]) =>
                            `<option value="${v}" ${(window.Storage?.getPref('readingLang')||'fr,en')===v?'selected':''}>${l}</option>`).join('')}
                    </select>
                    <button class="chap-sort-btn ic-btn" id="chapRandom" title="Ouvrir un chapitre au hasard">${MH.icon('dice', 14)} Au hasard</button>
                    <button class="chap-sort-btn" id="chapCheckNew" title="Vérifier maintenant s'il y a de nouveaux chapitres sur cette série">↻ Vérifier</button>
                    <button class="chap-sort-btn" id="chapMarkAll" title="Marquer tous les chapitres comme lus">✓ Tout lu</button>
                    <!-- Audit AMEL-99 : le téléchargement n'existait que DANS le
                         lecteur, chapitre par chapitre. Préparer un trajet
                         demandait d'ouvrir chaque chapitre l'un après l'autre. -->
                    <button class="chap-sort-btn" id="chapDlRange" title="Télécharger une plage de chapitres pour le hors-ligne">↓ Télécharger…</button>
                    <button class="chap-sort-btn" id="chapSortBtn">${chapSortAsc ? '↑ Ancien' : '↓ Récent'}</button>
                </div>
            </div>
            <div class="chap-filters" id="chapFilters" style="display:flex;gap:6px;margin-bottom:10px">
                <button class="chap-filter ${readFilter === 'all' ? 'on' : ''}" data-rf="all">Tous</button>
                <button class="chap-filter ${readFilter === 'unread' ? 'on' : ''}" data-rf="unread">Non lus</button>
                <button class="chap-filter ${readFilter === 'read' ? 'on' : ''}" data-rf="read">Lus</button>
            </div>
            <div class="chapters-list" id="chapsList"></div>
        </div>`;

        const input   = el.querySelector('#chapSearch');
        const sortBtn = el.querySelector('#chapSortBtn');
        const markAll = el.querySelector('#chapMarkAll');
        const randBtn = el.querySelector('#chapRandom');

        // Langue des chapitres (issue #3) : choisir FR / EN / toutes sur les
        // sources multilingues. Persiste readingLang puis recharge la liste.
        el.querySelector('#chapLang')?.addEventListener('change', (e) => {
            window.Storage?.setPref('readingLang', e.target.value);
            if (API.isLoggedIn()) API.me.saveSettings?.({ readingLang: e.target.value }).catch(() => {});
            MH.toast('Langue : ' + e.target.options[e.target.selectedIndex].text.replace(/^[^\s]+\s/, ''));
            chapters = [];
            renderTab('chapitres');   // spinner
            loadChapters();           // recharge avec la nouvelle langue
        });

        // §15.4-4 : vérification de CETTE série seulement (pas de cooldown côté serveur)
        el.querySelector('#chapCheckNew')?.addEventListener('click', async (e) => {
            if (!API.isLoggedIn()) { MH.toast('Connecte-toi pour vérifier tes séries'); return; }
            const b = e.currentTarget; b.disabled = true; const lbl = b.textContent; b.textContent = '…';
            try {
                const d = await API.me.updates({ manga: manga.id, lang: window.Storage?.getPref('readingLang') || 'fr,en' });
                const u = (d.updates || [])[0];
                const f = (d.failures || [])[0];
                if (f) MH.toast('Vérification impossible : ' + (f.error || 'source en échec'));
                else if (u?.hasNew) MH.toast(`Nouveau chapitre ! Dernier : Ch. ${u.latest?.chapter}`);
                else if (u) MH.toast(u.unreadCount > 0 ? `${u.unreadCount} chapitre(s) non lu(s)` : 'Série à jour');
                else MH.toast('Ajoute la série en favori pour la suivre');
            } catch (err) { MH.toast('Erreur : ' + err.message); }
            finally { b.disabled = false; b.textContent = lbl; }
        });
        const list    = el.querySelector('#chapsList');
        const countEl = el.querySelector('#chapCount');

        el.querySelector('#chapDlRange')?.addEventListener('click', telechargerPlage);

        el.querySelectorAll('.chap-filter').forEach(b => b.addEventListener('click', () => {
            readFilter = b.dataset.rf;
            window.Storage?.setPref(PREF_FILTRE, readFilter);   // audit AMEL-98
            el.querySelectorAll('.chap-filter').forEach(x => x.classList.toggle('on', x === b));
            render();
        }));

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
                // Audit AMEL-40 : on retient ce qui n'était PAS lu avant, et
                // seulement cela. Annuler en démarquant tout effacerait aussi
                // les chapitres lus de longue date — l'annulation ferait alors
                // plus de dégâts que l'action qu'elle répare.
                const nouveaux = chapters.filter(c => !readChapsSet.has(c.id)).map(c => c.id);
                await API.me.markChaptersBulk(manga.id, items);
                chapters.forEach(c => readChapsSet.add(c.id));
                render(); renderSidebar();
                proposerAnnulation(nouveaux);
            } catch (e) { MH.toast?.('Erreur : ' + e.message); }
            finally { markAll.disabled = false; markAll.textContent = lbl; }
        });

        function render() {
            const q = chapFilter.toLowerCase();
            let filtered = chapters.filter(c =>
                !q || String(c.chapter).includes(q) || (c.title || '').toLowerCase().includes(q)
            );
            if (readFilter === 'unread') filtered = filtered.filter(c => !readChapsSet.has(c.id));
            else if (readFilter === 'read') filtered = filtered.filter(c => readChapsSet.has(c.id));
            if (chapSortAsc) filtered = [...filtered].reverse();
            if (countEl) countEl.textContent = filtered.length;
            list.innerHTML = filtered.map(c => renderChapterRow(c)).join('')
                || `<div class="chapters-empty">${readFilter === 'unread' ? 'Tout est lu ✓' : (readFilter === 'read' ? 'Aucun chapitre lu' : 'Aucun chapitre trouvé')}</div>`;
        }

        if (input) {
            input.value = chapFilter;
            input.addEventListener('input', () => { chapFilter = input.value; render(); });
        }
        if (sortBtn) {
            sortBtn.addEventListener('click', () => {
                chapSortAsc = !chapSortAsc;
                window.Storage?.setPref(PREF_TRI, chapSortAsc ? '1' : '0');
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
        try { data = await API.ratings.get(manga.id); } catch (e) { window.MH?.err?.('serie.js', e); }

        const myStars = data.mine?.rating || 0;
        const avgTxt = data.average != null
            ? `<strong style="color:var(--text);font-size:15px">${data.average.toFixed(1)}</strong>/5 · ${MH.fmt(data.count)} note${data.count > 1 ? 's' : ''}`
            : 'Aucune note pour l\'instant';

        const myReview = data.mine?.review || '';
        body.innerHTML = `
            <div style="margin-bottom:10px">${avgTxt}</div>
            <div class="rate-stars" style="display:flex;gap:4px;font-size:24px;line-height:1">
                ${[1,2,3,4,5].map(n => `<span class="rate-star" data-n="${n}" style="cursor:pointer;color:${n <= myStars ? '#f59e0b' : 'var(--bg4)'}">★</span>`).join('')}
            </div>
            <div style="font-size:11px;color:var(--text3);margin-top:6px">${API.isLoggedIn() ? (myStars ? 'Ta note · clique pour changer' : 'Clique une étoile pour noter') : 'Connecte-toi pour noter'}</div>
            ${API.isLoggedIn() ? `
            <div class="my-review" style="margin-top:14px">
                <label style="display:block;font-size:12px;font-weight:600;color:var(--text2);margin-bottom:6px">Mon avis</label>
                <textarea id="reviewText" rows="4" maxlength="4000" placeholder="Qu'as-tu pensé de cette œuvre ? (ton avis reste privé pour l'instant)"
                    style="width:100%;background:var(--bg);border:1px solid var(--border2);color:var(--text);border-radius:var(--radius2);padding:10px 12px;font-size:13px;line-height:1.5;resize:vertical;font-family:var(--font-read)">${MH.esc(myReview)}</textarea>
                <div style="display:flex;justify-content:flex-end;margin-top:8px">
                    <button class="btn btn-primary btn-sm" id="btnSaveReview">Enregistrer mon avis</button>
                </div>
            </div>` : ''}`;

        if (!API.isLoggedIn()) return;

        let currentStars = myStars;
        const stars = [...body.querySelectorAll('.rate-star')];
        const paint = (n) => stars.forEach(s => s.style.color = (+s.dataset.n <= n) ? '#f59e0b' : 'var(--bg4)');
        stars.forEach(s => {
            s.addEventListener('mouseenter', () => paint(+s.dataset.n));
            s.addEventListener('mouseleave', () => paint(currentStars));
            s.addEventListener('click', async () => {
                const n = +s.dataset.n;
                try {
                    // On garde l'avis déjà saisi pour ne pas l'écraser en notant.
                    const review = document.getElementById('reviewText')?.value.trim() || null;
                    await API.ratings.set(manga.id, { rating: n, review });
                    currentStars = n; paint(n);
                    MH.toast(`Noté ${n}/5`);
                } catch (e) { MH.toast('Erreur : ' + e.message); }
            });
        });

        // Enregistrer « Mon avis » (§16) — s'appuie sur ratings.review déjà en base.
        document.getElementById('btnSaveReview')?.addEventListener('click', async (e) => {
            if (!currentStars) { MH.toast('Choisis d\'abord une note (les étoiles) pour publier ton avis'); return; }
            const review = document.getElementById('reviewText').value.trim();
            e.target.disabled = true; const lbl = e.target.textContent; e.target.textContent = '…';
            try {
                await API.ratings.set(manga.id, { rating: currentStars, review: review || null });
                MH.toast('Ton avis est enregistré');
            } catch (err) { MH.toast('Erreur : ' + err.message); }
            finally { e.target.disabled = false; e.target.textContent = lbl; }
        });
    }
})();
