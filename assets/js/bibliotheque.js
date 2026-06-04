// bibliotheque.js — Bibliothèque (favoris) + Mises à jour (façon Mihon)
(function () {
    'use strict';

    let favs = [];
    let readByManga = {};
    let progressByManga = {};
    let filter = { type: 'all', value: null };

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
    });

    function initTabs() {
        document.querySelectorAll('.lib2-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.lib2-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const t = tab.dataset.tab;
                document.getElementById('tabLibrary').style.display = t === 'library' ? '' : 'none';
                document.getElementById('tabUpdates').style.display = t === 'updates' ? '' : 'none';
            });
        });
    }

    // ── BIBLIOTHÈQUE ──
    async function loadLibrary() {
        const grid = document.getElementById('libGrid');
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
        // approximation : dernier chapitre connu - nb de chapitres lus
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

        let html = chip('all', '', 'Tout', favs.length, filter.type === 'all');
        Object.keys(STATUS).forEach(s => { if (sc[s]) html += chip('status', s, STATUS[s][0], sc[s], filter.type === 'status' && filter.value === s); });
        Object.keys(cc).sort().forEach(c => { html += chip('category', c, c, cc[c], filter.type === 'category' && filter.value === c); });
        el.innerHTML = html;

        el.querySelectorAll('.lib2-chip').forEach(ch => ch.addEventListener('click', () => {
            filter = { type: ch.dataset.ftype, value: ch.dataset.fval || null };
            renderFilters(); render();
        }));
    }

    function render() {
        const grid = document.getElementById('libGrid');
        const q = (document.getElementById('libSearch').value || '').toLowerCase();
        const sort = document.getElementById('libSort').value;

        let list = favs.filter(f => !q || (f.title || '').toLowerCase().includes(q));
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
                ? `chapitre.html?manga=${encodeURIComponent(f.mangaId)}&chapter=${encodeURIComponent(prog.chapterId)}&source=${encodeURIComponent(f.source || '')}`
                : `serie.html?id=${encodeURIComponent(f.mangaId)}&source=${encodeURIComponent(f.source || '')}`;
            return `
            <a class="lib2-card" href="${href}" data-manga-id="${f.mangaId}">
                <div class="lib2-cover">
                    <img src="${f.cover || MH.placeholderCover(f.mangaId)}" alt="${MH.esc(f.title || '')}" loading="lazy"
                         onerror="this.src='${MH.placeholderCover(f.mangaId)}'">
                    ${st}
                    ${u > 0 ? `<div class="lib2-badge">${u}</div>` : ''}
                </div>
                <div class="lib2-title">${MH.esc(f.title || f.mangaId)}</div>
                <div class="lib2-sub">${prog ? 'Ch. ' + prog.chapter : 'Pas commencé'} · ${f.source || 'mangadex'}</div>
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
                const data = await API.me.updates(window.Storage?.getPref('readingLang') || 'fr,en');
                const ups = data.updates || [];
                status.textContent = `${ups.length} série(s) suivie(s) · ${ups.filter(u => u.unreadCount > 0).length} avec des chapitres non lus`;

                if (!ups.length) {
                    listEl.innerHTML = `<div class="lib2-empty"><div class="ico"></div>Aucune série suivie. Ajoute des favoris pour suivre leurs mises à jour.</div>`;
                    return;
                }
                listEl.innerHTML = ups.map(u => `
                    <div class="upd-row">
                        <a class="upd-cover" href="serie.html?id=${encodeURIComponent(u.mangaId)}">
                            <img src="${u.cover || MH.placeholderCover(u.mangaId)}" alt="" loading="lazy"
                                 onerror="this.src='${MH.placeholderCover(u.mangaId)}'">
                        </a>
                        <div class="upd-info">
                            <div class="upd-name">${MH.esc(u.title)} ${u.hasNew ? '<span class="upd-new">NOUVEAU</span>' : ''}</div>
                            <div class="upd-meta">
                                ${u.latest ? `Dernier : Ch. ${u.latest.chapter}` : ''}
                                ${u.unreadCount > 0 ? ` · <strong style="color:var(--orange)">${u.unreadCount} non lu(s)</strong>` : ' · à jour ✓'}
                            </div>
                        </div>
                        ${u.latest ? `<a class="btn btn-primary btn-sm" href="chapitre.html?manga=${encodeURIComponent(u.mangaId)}&chapter=${encodeURIComponent(u.latest.id)}">Lire →</a>` : ''}
                    </div>`).join('');
            } catch (e) {
                status.textContent = '';
                listEl.innerHTML = `<div class="lib2-empty" style="color:#ef4444">Erreur : ${MH.esc(e.message)}</div>`;
            } finally {
                btn.disabled = false;
            }
        });
    }
})();
