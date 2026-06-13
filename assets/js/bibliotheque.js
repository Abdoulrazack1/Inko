// bibliotheque.js — Bibliothèque (favoris) + Mises à jour (façon Mihon)
(function () {
    'use strict';

    let favs = [];
    let readByManga = {};
    let progressByManga = {};
    let updatesByManga = {};   // mangaId -> { unreadCount, latest, hasNew } (depuis /me/updates)
    let filter = { type: 'all', value: null };
    let kindFilter = 'all';    // 'all' | 'manga' | 'novel' (sépare romans et mangas)

    const STATUS = {
        reading:   ['En cours',  '#22c55e'],
        completed: ['Terminé',   '#3b82f6'],
        planned:   ['À lire',    '#a855f7'],
        paused:    ['En pause',  '#f59e0b'],
        dropped:   ['Abandonné', '#ef4444'],
    };

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('bibliotheque');

        if (!API.isLoggedIn()) {
            document.querySelector('.lib2-wrap').innerHTML = `
                <div class="lib2-empty">
                    <div class="ico"></div>
                    <div style="font-size:16px;color:var(--text);font-weight:600;margin-bottom:6px">Connexion requise</div>
                    <div style="margin-bottom:18px">Connecte-toi pour retrouver ta bibliothèque synchronisée.</div>
                    <a href="page_login.html" class="btn btn-primary">Se connecter</a>
                </div>`;
            return;
        }

        initTabs();
        await loadLibrary();
        bindUpdates();
        wireLibRefresh();
        maybeAutoCheck();
    });

    // Vérification automatique des nouveaux chapitres (au plus une fois / 6 h)
    async function maybeAutoCheck() {
        if (!favs.length) return;
        const KEY = 'inko_lib_lastcheck';
        let last = 0; try { last = +localStorage.getItem(KEY) || 0; } catch (e) {}
        if (Date.now() - last < 6 * 3600 * 1000) return;
        const status = document.getElementById('libRefreshStatus');
        if (status) status.innerHTML = '<span class="spinner-inline" style="width:12px;height:12px;border-width:1px"></span> Recherche de nouveautés…';
        try {
            await fetchUpdates();
            render();
            try { localStorage.setItem(KEY, String(Date.now())); } catch (e) {}
            if (status) status.textContent = `À jour · ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
        } catch (e) { if (status) status.textContent = ''; }
    }

    // ── Mise à jour des chapitres depuis l'onglet Bibliothèque ──
    async function fetchUpdates() {
        const data = await API.me.updates(window.Storage?.getPref('readingLang') || 'fr,en');
        (data.updates || []).forEach(u => {
            updatesByManga[u.mangaId] = { unreadCount: u.unreadCount, latest: u.latest, hasNew: u.hasNew };
            const f = favs.find(x => x.mangaId === u.mangaId);
            if (f && u.latest) f.lastChapter = u.latest.chapter;
        });
        // Badge de navigation : nombre de séries avec des chapitres non lus
        const newCount = (data.updates || []).filter(u => u.unreadCount > 0).length;
        try { localStorage.setItem('inko_lib_newcount', String(newCount)); } catch (e) {}
        window.MH?.updateLibBadge?.();
        return data;
    }
    function wireLibRefresh() {
        const btn = document.getElementById('btnLibRefresh');
        const status = document.getElementById('libRefreshStatus');
        if (!btn) return;
        btn.addEventListener('click', async () => {
            btn.disabled = true;
            if (status) status.innerHTML = '<span class="spinner-inline" style="width:12px;height:12px;border-width:1px"></span> Vérification…';
            try {
                const data = await fetchUpdates();
                const ups = data.updates || [];
                const totalNew = ups.reduce((n, u) => n + (u.hasNew ? 1 : 0), 0);
                const totalUnread = ups.reduce((n, u) => n + (u.unreadCount || 0), 0);
                render();
                if (status) status.textContent = `À jour · ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`;
                MH.toast(totalNew ? `${totalNew} série(s) avec de nouveaux chapitres` : (totalUnread ? `${totalUnread} chapitre(s) non lu(s)` : 'Bibliothèque à jour'));
            } catch (e) {
                if (status) status.textContent = '';
                MH.toast('Erreur : ' + e.message);
            } finally { btn.disabled = false; }
        });
    }

    function initTabs() {
        const panels = { library: 'tabLibrary', updates: 'tabUpdates', downloads: 'tabDownloads' };
        document.querySelectorAll('.lib2-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.lib2-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const t = tab.dataset.tab;
                Object.entries(panels).forEach(([k, id]) => {
                    const el = document.getElementById(id); if (el) el.style.display = (k === t) ? '' : 'none';
                });
                if (t === 'downloads') renderDownloads();
            });
        });
    }

    async function renderDownloads() {
        const listEl = document.getElementById('dlList');
        const storEl = document.getElementById('dlStorage');
        if (!window.Downloads) { listEl.innerHTML = '<div class="lib2-empty">Téléchargement hors-ligne non disponible sur ce navigateur.</div>'; return; }
        const groups = await window.Downloads.byManga();
        const st = await window.Downloads.storage();
        const fmtMB = b => (b / 1048576).toFixed(1) + ' Mo';
        storEl.textContent = groups.length
            ? `${groups.reduce((n, g) => n + g.chapters.length, 0)} chapitre(s) téléchargé(s) · ${fmtMB(st.usage)} utilisés`
            : '';
        if (!groups.length) {
            listEl.innerHTML = `<div class="lib2-empty"><div class="ico"></div>
                <div style="font-size:14px;color:var(--text);font-weight:500;margin-bottom:6px">Aucun chapitre téléchargé</div>
                Ouvre un chapitre et appuie sur l'icône de téléchargement pour le lire hors-ligne.</div>`;
            return;
        }
        listEl.innerHTML = groups.map(g => {
            // Lien direct vers le 1er chapitre téléchargé (lecture hors-ligne possible)
            const firstChap = [...g.chapters].sort((a, b) => (a.chapterNum || 0) - (b.chapterNum || 0))[0];
            const readHref = firstChap ? MH.readerHref(g.mangaId, firstChap.chapterId, g.source) : '#';
            return `
            <div class="upd-row">
                <a class="upd-cover" href="${readHref}">
                    <img src="${g.cover || MH.placeholderCover(g.mangaId)}" alt="" loading="lazy" onerror="this.src='${MH.placeholderCover(g.mangaId)}'">
                </a>
                <div class="upd-info">
                    <a class="upd-name" href="${readHref}" style="color:inherit;text-decoration:none">${MH.esc(g.title || g.mangaId)}</a>
                    <div class="upd-meta">${g.chapters.length} chapitre(s) · ${g.chapters.slice(0, 5).map(c => 'Ch.' + c.chapterNum).join(', ')}${g.chapters.length > 5 ? '…' : ''}</div>
                </div>
                <button class="btn btn-sm" style="background:rgba(239,68,68,.12);color:#ef4444" data-dlmanga="${g.mangaId}">Supprimer</button>
            </div>`;
        }).join('');
        listEl.querySelectorAll('[data-dlmanga]').forEach(b => b.addEventListener('click', async () => {
            await window.Downloads.removeManga(b.dataset.dlmanga);
            renderDownloads();
        }));
    }

    // ── BIBLIOTHÈQUE ──
    async function loadLibrary() {
        const grid = document.getElementById('libGrid');
        await MH.loadSourceTypes();   // pour séparer mangas/romans
        try {
            const [favoris, allRead, allProg] = await Promise.all([
                API.me.favorites(),
                API.me.readChapters(),
                API.me.progress(),
            ]);
            favs = favoris;
            readByManga = allRead;
            progressByManga = allProg;
        } catch (e) {
            grid.innerHTML = `<div class="lib2-empty" style="grid-column:1/-1;color:#ef4444">Erreur : ${MH.esc(e.message)}</div>`;
            return;
        }

        if (!favs.length) {
            grid.innerHTML = `<div class="lib2-empty" style="grid-column:1/-1">
                <div class="ico"></div>
                <div style="font-size:15px;color:var(--text);font-weight:500;margin-bottom:6px">Ta bibliothèque est vide</div>
                <div style="margin-bottom:16px">Ajoute des mangas en favoris (♡) depuis le catalogue.</div>
                <a href="catalogue.html" class="btn btn-primary btn-sm">Explorer le catalogue →</a>
            </div>`;
            return;
        }

        // Pour les favoris sans titre/cover stockés (anciens), on complète via l'API
        const missing = favs.filter(f => !f.title || !f.cover);
        if (missing.length) {
            await Promise.allSettled(missing.map(async f => {
                try {
                    const id = API.sources.current; // restore après
                    const m = await API.mangas.get(f.mangaId); // utilise source courante (best-effort)
                    f.title = f.title || m.title;
                    f.cover = f.cover || m.cover || m.coverThumb;
                } catch (e) {}
            }));
        }

        renderFilters();
        render();
    }

    function unreadCount(f) {
        // Données serveur précises (après « Mettre à jour ») si dispo
        const srv = updatesByManga[f.mangaId];
        if (srv && typeof srv.unreadCount === 'number') return srv.unreadCount;
        // sinon approximation : dernier chapitre connu - nb de chapitres lus
        const read = (readByManga[f.mangaId] || []).length;
        const last = f.lastChapter || 0;
        return Math.max(0, Math.round(last) - read);
    }

    function renderFilters() {
        const el = document.getElementById('libFilters');
        if (!el) return;
        const sc = {}, cc = {};
        favs.forEach(f => { if (f.status) sc[f.status] = (sc[f.status] || 0) + 1; });
        favs.forEach(f => { if (f.category) cc[f.category] = (cc[f.category] || 0) + 1; });

        const chip = (type, val, label, count, on) =>
            `<button class="lib2-chip ${on ? 'on' : ''}" data-ftype="${type}" data-fval="${MH.esc(val == null ? '' : val)}">${MH.esc(label)}${count != null ? `<span class="cnt">${count}</span>` : ''}</button>`;

        // Segment Mangas / Romans (n'apparaît que si la biblio contient des deux)
        const nManga = favs.filter(f => !MH.isNovelSource(f.source)).length;
        const nNovel = favs.filter(f => MH.isNovelSource(f.source)).length;
        let kindHtml = '';
        if (nManga && nNovel) {
            const k = (val, label, count) =>
                `<button class="lib2-kind ${kindFilter === val ? 'on' : ''}" data-kind="${val}">${label}<span class="cnt">${count}</span></button>`;
            kindHtml = `<div class="lib2-kinds">${k('all', 'Tout', favs.length)}${k('manga', 'Mangas', nManga)}${k('novel', 'Romans', nNovel)}</div>`;
        }

        let html = chip('all', '', 'Tout', favsOfKind().length, filter.type === 'all');
        Object.keys(STATUS).forEach(s => { if (sc[s]) html += chip('status', s, STATUS[s][0], sc[s], filter.type === 'status' && filter.value === s); });
        Object.keys(cc).sort().forEach(c => { html += chip('category', c, c, cc[c], filter.type === 'category' && filter.value === c); });
        el.innerHTML = kindHtml + html;

        el.querySelectorAll('.lib2-kind').forEach(ch => ch.addEventListener('click', () => {
            kindFilter = ch.dataset.kind;
            renderFilters(); render();
        }));
        el.querySelectorAll('.lib2-chip').forEach(ch => ch.addEventListener('click', () => {
            filter = { type: ch.dataset.ftype, value: ch.dataset.fval || null };
            renderFilters(); render();
        }));
    }

    // Favoris filtrés par type (manga/roman)
    function favsOfKind() {
        if (kindFilter === 'manga') return favs.filter(f => !MH.isNovelSource(f.source));
        if (kindFilter === 'novel') return favs.filter(f => MH.isNovelSource(f.source));
        return favs;
    }

    function render() {
        const grid = document.getElementById('libGrid');
        const q = (document.getElementById('libSearch').value || '').toLowerCase();
        const sort = document.getElementById('libSort').value;

        let list = favsOfKind().filter(f => !q || (f.title || '').toLowerCase().includes(q));
        if (filter.type === 'status')   list = list.filter(f => f.status === filter.value);
        if (filter.type === 'category') list = list.filter(f => f.category === filter.value);

        if (sort === 'title')    list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        if (sort === 'unread')   list.sort((a, b) => unreadCount(b) - unreadCount(a));
        if (sort === 'progress') list.sort((a, b) => (progressByManga[b.mangaId]?.chapter || 0) - (progressByManga[a.mangaId]?.chapter || 0));
        // 'recent' = ordre par défaut (added_at desc)

        if (!list.length) {
            grid.innerHTML = `<div class="lib2-empty" style="grid-column:1/-1">Aucun résultat.</div>`;
            return;
        }

        grid.innerHTML = list.map(f => {
            const prog = progressByManga[f.mangaId];
            const u = unreadCount(f);
            const st = f.status && STATUS[f.status]
                ? `<div class="lib2-status" style="background:${STATUS[f.status][1]}">${STATUS[f.status][0]}</div>` : '';
            const href = prog?.chapterId
                ? MH.readerHref(f.mangaId, prog.chapterId, f.source || prog.source)
                : `serie.html?id=${encodeURIComponent(f.mangaId)}&source=${encodeURIComponent(f.source || '')}`;
            return `
            <a class="lib2-card" href="${href}" data-manga-id="${f.mangaId}">
                <div class="lib2-cover">
                    <img src="${f.cover || MH.placeholderCover(f.mangaId)}" alt="${MH.esc(f.title || '')}" loading="lazy"
                         onerror="this.src='${MH.placeholderCover(f.mangaId)}'">
                    ${st}
                    ${MH.isNovelSource(f.source) ? '<div class="lib2-kind-badge">ROMAN</div>' : ''}
                    ${u > 0 ? `<div class="lib2-badge">${u}</div>` : ''}
                </div>
                <div class="lib2-title">${MH.esc(f.title || f.mangaId)}</div>
                <div class="lib2-sub">${prog ? 'Ch. ' + MH.chapNum(prog.chapter) : 'Pas commencé'} · ${f.source || 'mangadex'}</div>
                ${f.category ? `<div class="lib2-cat">${MH.esc(f.category)}</div>` : ''}
            </a>`;
        }).join('');
    }

    // re-render on search/sort
    document.addEventListener('input', e => { if (e.target.id === 'libSearch') render(); });
    document.addEventListener('change', e => { if (e.target.id === 'libSort') render(); });

    // ── MISES À JOUR ──
    function bindUpdates() {
        const btn = document.getElementById('btnCheckUpdates');
        const status = document.getElementById('updStatus');
        const listEl = document.getElementById('updList');

        btn.addEventListener('click', async () => {
            btn.disabled = true;
            status.innerHTML = '<span class="spinner-inline" style="width:12px;height:12px;border-width:1px"></span> Vérification en cours…';
            listEl.innerHTML = '';
            try {
                const data = await fetchUpdates();
                const ups = data.updates || [];
                status.textContent = `${ups.length} série(s) suivie(s) · ${ups.filter(u => u.unreadCount > 0).length} avec des chapitres non lus`;
                render(); // rafraîchit aussi les badges de l'onglet Bibliothèque

                if (!ups.length) {
                    listEl.innerHTML = `<div class="lib2-empty"><div class="ico"></div>Aucune série suivie. Ajoute des favoris pour suivre leurs mises à jour.</div>`;
                    return;
                }
                listEl.innerHTML = ups.map(u => {
                    const src = encodeURIComponent(u.source || '');
                    return `
                    <div class="upd-row">
                        <a class="upd-cover" href="serie.html?id=${encodeURIComponent(u.mangaId)}&source=${src}">
                            <img src="${u.cover || MH.placeholderCover(u.mangaId)}" alt="" loading="lazy"
                                 onerror="this.src='${MH.placeholderCover(u.mangaId)}'">
                        </a>
                        <div class="upd-info">
                            <div class="upd-name">${MH.esc(u.title)} ${u.hasNew ? '<span class="upd-new">NOUVEAU</span>' : ''}</div>
                            <div class="upd-meta">
                                ${u.latest ? `Dernier : Ch. ${u.latest.chapter}` : ''}
                                ${u.unreadCount > 0 ? ` · <strong style="color:var(--orange)">${u.unreadCount} non lu(s)</strong>` : ' · à jour'}
                            </div>
                        </div>
                        <div style="display:flex;gap:6px;flex-shrink:0">
                            ${u.unreadCount > 0 ? `<button class="btn btn-secondary btn-sm" data-markread="${encodeURIComponent(u.mangaId)}" data-src="${src}" title="Marquer toute la série comme lue">Tout lu</button>` : ''}
                            ${u.latest ? `<a class="btn btn-primary btn-sm" href="${MH.readerHref(u.mangaId, u.latest.id, u.source || decodeURIComponent(src))}">Lire</a>` : ''}
                        </div>
                    </div>`;
                }).join('');
                listEl.querySelectorAll('[data-markread]').forEach(b => b.addEventListener('click', async () => {
                    const mangaId = decodeURIComponent(b.dataset.markread);
                    const source = decodeURIComponent(b.dataset.src || '');
                    b.disabled = true; b.textContent = '…';
                    try {
                        const data = await API.mangas.chaptersFor(source, mangaId, { lang: window.Storage?.getPref('readingLang') || 'fr,en' });
                        const chaps = (data.results || []).map(c => ({ chapterId: c.id, chapter: c.chapter }));
                        if (chaps.length) await API.me.markChaptersBulk(mangaId, chaps);
                        updatesByManga[mangaId] = { unreadCount: 0, latest: updatesByManga[mangaId]?.latest, hasNew: false };
                        MH.toast('Série marquée comme lue');
                        render(); // rafraîchit les badges de l'onglet Bibliothèque
                        const row = b.closest('.upd-row');
                        if (row) {
                            const meta = row.querySelector('.upd-meta');
                            const lc = updatesByManga[mangaId]?.latest;
                            if (meta) meta.innerHTML = (lc ? `Dernier : Ch. ${lc.chapter}` : '') + ' · à jour';
                            row.querySelector('.upd-new')?.remove();
                            b.remove();
                        }
                    } catch (e) { MH.toast('Erreur : ' + e.message); b.disabled = false; b.textContent = 'Tout lu'; }
                }));
            } catch (e) {
                status.textContent = '';
                listEl.innerHTML = `<div class="lib2-empty" style="color:#ef4444">Erreur : ${MH.esc(e.message)}</div>`;
            } finally {
                btn.disabled = false;
            }
        });
    }
})();
