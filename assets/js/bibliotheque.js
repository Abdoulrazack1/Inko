// bibliotheque.js — Bibliothèque (favoris) + Mises à jour (façon Mihon)
(function () {
    'use strict';

    let favs = [];
    let readByManga = {};
    let progressByManga = {};
    let updatesByManga = {};   // mangaId -> { unreadCount, latest, hasNew } (depuis /me/updates)
    let filter = { type: 'all', value: null };
    let kindFilter = 'all';    // 'all' | 'manga' | 'novel' (sépare romans et mangas)
    let unreadOnly = false;    // n'afficher que les séries avec des chapitres non lus
    let sourceFilter = null;   // filtrer par source d'origine
    let viewMode = 'grid';     // 'grid' | 'list' (audit §10.3)
    let selectMode = false;    // mode sélection multiple (audit §10.3)
    const selected = new Set(); // mangaIds sélectionnés

    const STATUS = {
        reading:   ['En cours',  '#22c55e'],
        completed: ['Terminé',   '#3b82f6'],
        planned:   ['À lire',    '#a855f7'],
        paused:    ['En pause',  '#f59e0b'],
        dropped:   ['Abandonné', '#ef4444'],
    };

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('bibliotheque');

        await (window.API?.ready || Promise.resolve());   // session locale auto
        if (!API.isLoggedIn()) {
            showLoggedOutLibrary();
            return;
        }

        initTabs();
        try { viewMode = window.Storage?.getPref?.('libView') === 'list' ? 'list' : 'grid'; } catch (e) {}
        await loadLibrary();
        bindUpdates();
        wireNotifyButton();
        wireLibRefresh();
        wireLibRandom();
        wireLibExtras();
        wireViewToggle();
        wireSelect();
        maybeAutoCheck();
    });

    // Déconnecté : on affiche le miroir local de la bibliothèque (lecture seule)
    // pour que les séries ne « disparaissent » jamais. La synchro revient au login.
    function showLoggedOutLibrary() {
        const cache = window.Storage?.getCachedLibrary?.();
        const grid = document.getElementById('libGrid');
        // Onglets MAJ (nécessite le compte) masqués hors connexion ; Téléchargements reste local.
        document.querySelector('.lib2-tab[data-tab="updates"]')?.style.setProperty('display', 'none');
        document.getElementById('btnLibRefresh')?.style.setProperty('display', 'none');
        initTabs();

        if (!cache || !cache.favs.length) {
            document.getElementById('tabLibrary').innerHTML = `
                <div class="lib2-empty">
                    <div class="ico"></div>
                    <div style="font-size:16px;color:var(--text);font-weight:600;margin-bottom:6px">Serveur injoignable</div>
                    <div style="margin-bottom:18px">Impossible de joindre le serveur Inko. Vérifie que MySQL/le backend tournent.</div>
                    <button class="btn btn-primary" onclick="location.reload()">Réessayer</button>
                </div>`;
            return;
        }

        // Bannière « hors connexion »
        const banner = document.createElement('div');
        banner.style.cssText = 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:var(--bg2);border:1px solid var(--border);border-left:3px solid var(--orange);border-radius:10px;padding:11px 14px;margin-bottom:16px;font-size:13px;color:var(--text2)';
        const when = cache.at ? new Date(cache.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
        banner.innerHTML = `<span style="flex:1;min-width:200px">📚 Aperçu local de ta bibliothèque${when ? ` (sauvegardé le ${when})` : ''}. Le serveur est injoignable : aperçu hors-ligne.</span>
            <button class="btn btn-primary btn-sm" onclick="location.reload()">Réessayer</button>`;
        document.getElementById('tabLibrary').prepend(banner);

        favs = cache.favs.slice();
        renderSummary();
        renderFilters();
        render();
        wireLibExtras();
    }

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

    // ── Mise à jour des chapitres depuis l'onglet Bibliothèque (§15) ──
    // scope 'active' (défaut) ignore Terminé/Abandonné ; 'all' revérifie tout.
    async function fetchUpdates(scope) {
        const data = await API.me.updates({
            lang: window.Storage?.getPref('readingLang') || 'fr,en',
            scope: scope || (includeFinished() ? 'all' : 'active'),
        });
        (data.updates || []).forEach(u => {
            updatesByManga[u.mangaId] = { unreadCount: u.unreadCount, latest: u.latest, hasNew: u.hasNew };
            const f = favs.find(x => x.mangaId === u.mangaId);
            if (f && u.latest) f.lastChapter = u.latest.chapter;
        });
        // Badge de navigation : nombre de séries avec des chapitres non lus
        const newCount = (data.updates || []).filter(u => u.unreadCount > 0).length;
        try { localStorage.setItem('inko_lib_newcount', String(newCount)); } catch (e) {}
        window.MH?.updateLibBadge?.();
        maybeNotify(data.updates || []);
        return data;
    }

    // ── Notifications navigateur pour nouveaux chapitres ──
    function notifyEnabled() {
        try { return window.Storage?.getPref?.('notifyNewChapters') === true; } catch (e) { return false; }
    }
    function maybeNotify(updates) {
        if (!notifyEnabled() || !('Notification' in window) || Notification.permission !== 'granted') return;
        let notified = {};
        try { notified = JSON.parse(localStorage.getItem('inko_notified') || '{}'); } catch (e) {}
        const fresh = updates.filter(u => u.hasNew && u.latest && notified[u.mangaId] !== u.latest.id).slice(0, 5);
        fresh.forEach(u => {
            try {
                const n = new Notification('Inko — nouveau chapitre', {
                    body: `${u.title} · Ch. ${u.latest.chapter}`,
                    icon: u.cover || '/assets/img/icon.svg', tag: 'inko-' + u.mangaId,
                });
                n.onclick = () => { window.focus(); window.location.href = MH.readerHref(u.mangaId, u.latest.id, u.source); };
            } catch (e) {}
            notified[u.mangaId] = u.latest.id;
        });
        try { localStorage.setItem('inko_notified', JSON.stringify(notified)); } catch (e) {}
    }
    function wireNotifyButton() {
        const btn = document.getElementById('btnNotify');
        if (!btn) return;
        const supported = 'Notification' in window;
        const bell = MH.icon('bell', 14);
        const paint = () => {
            btn.classList.add('ic-btn');
            if (!supported) { btn.innerHTML = bell + 'Indisponible'; btn.disabled = true; return; }
            const on = notifyEnabled() && Notification.permission === 'granted';
            btn.innerHTML = bell + (on ? 'Notifications activées' : 'Activer les notifications');
            btn.classList.toggle('btn-primary', on);
            btn.classList.toggle('btn-secondary', !on);
        };
        paint();
        btn.addEventListener('click', async () => {
            if (!supported) return;
            if (notifyEnabled() && Notification.permission === 'granted') {
                window.Storage?.setPref?.('notifyNewChapters', false);
                MH.toast?.('Notifications désactivées');
                paint(); return;
            }
            let perm = Notification.permission;
            if (perm !== 'granted') { try { perm = await Notification.requestPermission(); } catch (e) {} }
            if (perm === 'granted') {
                window.Storage?.setPref?.('notifyNewChapters', true);
                MH.toast?.('Notifications activées — tu seras prévenu des nouveaux chapitres');
            } else {
                MH.toast?.('Autorisation refusée par le navigateur');
            }
            paint();
        });
    }
    // Résumé en-tête : nombre de séries + chapitres non lus
    function renderSummary() {
        const el = document.getElementById('libSummary');
        if (!el) return;
        const totalUnread = favs.reduce((n, f) => n + unreadCount(f), 0);
        const n = favs.length;
        el.textContent = `${n} série${n > 1 ? 's' : ''}${totalUnread > 0 ? ` · ${totalUnread} chapitre${totalUnread > 1 ? 's' : ''} non lu${totalUnread > 1 ? 's' : ''}` : ' · à jour'}`;
    }

    // Densité d'affichage (compact/confort) + Export de la bibliothèque
    function wireLibExtras() {
        const grid = document.getElementById('libGrid');
        const dBtn = document.getElementById('btnLibDensity');
        const gridIcon = MH.icon('grid', 15);
        const apply = (compact) => {
            grid?.classList.toggle('lib2-grid--compact', compact);
            if (dBtn) { dBtn.classList.add('ic-btn'); dBtn.innerHTML = gridIcon + (compact ? 'Confort' : 'Compact'); }
        };
        let compact = false;
        try { compact = window.Storage?.getPref?.('libDensity') === 'compact'; } catch (e) {}
        apply(compact);
        dBtn?.addEventListener('click', () => {
            compact = !compact;
            window.Storage?.setPref?.('libDensity', compact ? 'compact' : 'comfort');
            apply(compact);
        });

        // Import : restaure une sauvegarde JSON
        const iBtn = document.getElementById('btnLibImport');
        const iFile = document.getElementById('libImportFile');
        iBtn?.addEventListener('click', () => {
            if (!API.isLoggedIn()) { MH.toast?.('Connecte-toi pour importer'); return; }
            iFile?.click();
        });
        iFile?.addEventListener('change', async () => {
            const f = iFile.files?.[0];
            if (!f) return;
            try {
                const data = JSON.parse(await f.text());
                if (!confirm('Restaurer cette sauvegarde ? Tes favoris, progression et listes seront fusionnés avec les données importées.')) { iFile.value = ''; return; }
                await API.me.importData(data);
                MH.toast?.('Sauvegarde restaurée');
                setTimeout(() => window.location.reload(), 700);
            } catch (e) {
                MH.toast?.('Fichier invalide : ' + e.message);
            } finally { iFile.value = ''; }
        });

        const xBtn = document.getElementById('btnLibExport');
        xBtn?.addEventListener('click', async () => {
            xBtn.disabled = true; const lbl = xBtn.textContent; xBtn.textContent = '…';
            try {
                const data = await API.me.exportData();
                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `inko-bibliotheque-${new Date().toISOString().slice(0, 10)}.json`;
                document.body.appendChild(a); a.click(); a.remove();
                URL.revokeObjectURL(url);
                MH.toast?.('Sauvegarde téléchargée');
            } catch (e) { MH.toast?.('Erreur : ' + e.message); }
            finally { xBtn.disabled = false; xBtn.textContent = lbl; }
        });
    }

    function wireLibRandom() {
        const btn = document.getElementById('btnLibRandom');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const pool = favsOfKind();
            if (!pool.length) { MH.toast?.('Ta bibliothèque est vide'); return; }
            const f = pool[Math.floor(Math.random() * pool.length)];
            const prog = progressByManga[f.mangaId];
            const href = prog?.chapterId
                ? MH.readerHref(f.mangaId, prog.chapterId, f.source || prog.source)
                : `serie.html?id=${encodeURIComponent(f.mangaId)}&source=${encodeURIComponent(f.source || '')}`;
            MH.toast?.(`Au hasard : ${f.title || f.mangaId}`);
            setTimeout(() => { window.location.href = href; }, 400);
        });
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
        const panels = { library: 'tabLibrary', updates: 'tabUpdates', bookmarks: 'tabBookmarks', downloads: 'tabDownloads' };
        document.querySelectorAll('.lib2-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.lib2-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const t = tab.dataset.tab;
                Object.entries(panels).forEach(([k, id]) => {
                    const el = document.getElementById(id); if (el) el.style.display = (k === t) ? '' : 'none';
                });
                if (t === 'downloads') renderDownloads();
                if (t === 'bookmarks') renderBookmarks();
            });
        });
    }

    // ── SIGNETS (UserData) ──
    async function renderBookmarks() {
        const el = document.getElementById('bmList');
        if (!el) return;
        await window.UserData?.ready?.();
        const items = window.UserData?.getBookmarks?.() || [];
        if (!items.length) {
            el.innerHTML = `<div class="lib2-empty"><div class="ico">🔖</div>
                <div style="font-size:14px;color:var(--text);font-weight:500;margin-bottom:6px">Aucun signet</div>
                Sur une fiche série, clique sur le 🔖 d'un chapitre pour le retrouver ici.</div>`;
            return;
        }
        el.innerHTML = items.map(b => {
            const href = MH.readerHref(b.mangaId, b.chapterId, b.source);
            return `
            <div class="upd-row">
                <a class="upd-cover" href="${href}">
                    <img src="${b.cover || MH.placeholderCover(b.mangaId)}" alt="" loading="lazy" onerror="this.src='${MH.placeholderCover(b.mangaId)}'">
                </a>
                <div class="upd-info">
                    <a class="upd-name" href="${href}" style="color:inherit;text-decoration:none">${MH.esc(b.title || b.mangaId)}</a>
                    <div class="upd-meta">${MH.unitLabel(b.source, { short: true })} ${MH.esc(String(b.chapterNum || '?'))}${b.label ? ' · ' + MH.esc(b.label) : ''}${b.source ? ' · ' + MH.esc(b.source) : ''}</div>
                </div>
                <div style="display:flex;gap:6px;flex-shrink:0">
                    <a class="btn btn-primary btn-sm" href="${href}">Lire</a>
                    <button class="btn btn-sm" style="background:rgba(239,68,68,.12);color:#ef4444" data-bmdel="${MH.esc(b.mangaId)}" data-bmchap="${MH.esc(b.chapterId)}">Retirer</button>
                </div>
            </div>`;
        }).join('');
        el.querySelectorAll('[data-bmdel]').forEach(btn => btn.addEventListener('click', () => {
            window.UserData.removeBookmark(btn.dataset.bmdel, btn.dataset.bmchap);
            renderBookmarks();
        }));
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
        await window.UserData?.ready?.();   // épingles + données perso
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

        // Miroir local : la bibliothèque reste visible même déconnecté / hors-ligne.
        window.Storage?.cacheLibrary?.(favs);

        renderSummary();
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

        // Filtre par source (n'apparaît que si la biblio compte plusieurs sources)
        const srcCount = {};
        favsOfKind().forEach(f => { const s = f.source || 'mangadex'; srcCount[s] = (srcCount[s] || 0) + 1; });
        let srcHtml = '';
        const sources = Object.keys(srcCount);
        if (sources.length > 1) {
            srcHtml = `<span style="width:100%;height:1px"></span>` +
                `<button class="lib2-chip ${!sourceFilter ? 'on' : ''}" data-src="">Toutes sources</button>` +
                sources.sort().map(s => `<button class="lib2-chip ${sourceFilter === s ? 'on' : ''}" data-src="${MH.esc(s)}">${MH.esc(s)}<span class="cnt">${srcCount[s]}</span></button>`).join('');
        }
        // Bascule « Non lus uniquement »
        const unreadHtml = `<button class="lib2-chip ${unreadOnly ? 'on' : ''}" id="chipUnread" style="margin-left:auto" title="N'afficher que les séries avec des chapitres non lus">● Non lus</button>`;
        el.innerHTML = kindHtml + html + srcHtml + unreadHtml;

        el.querySelectorAll('[data-src]').forEach(ch => ch.addEventListener('click', () => {
            sourceFilter = ch.dataset.src || null;
            renderFilters(); render();
        }));

        el.querySelectorAll('.lib2-kind').forEach(ch => ch.addEventListener('click', () => {
            kindFilter = ch.dataset.kind;
            renderFilters(); render();
        }));
        el.querySelector('#chipUnread')?.addEventListener('click', () => {
            unreadOnly = !unreadOnly; renderFilters(); render();
        });
        el.querySelectorAll('.lib2-chip:not(#chipUnread)').forEach(ch => ch.addEventListener('click', () => {
            filter = { type: ch.dataset.ftype, value: ch.dataset.fval || null };
            renderFilters(); render();
        }));
    }

    // ── Rangée « Reprendre où j'en étais » (audit §10.3) ──
    // Les séries en cours de lecture, triées par lecture la plus récente. Remonte
    // l'info la plus utile là où l'œil regarde, au lieu de la cacher dans un onglet.
    function renderResume() {
        const box = document.getElementById('libResume');
        if (!box) return;
        // En mode sélection ou avec un filtre actif, on masque la rangée pour ne pas gêner.
        const active = selectMode || filter.type !== 'all' || unreadOnly || sourceFilter;
        const inProgress = favsOfKind()
            .filter(f => progressByManga[f.mangaId]?.chapterId)
            .sort((a, b) => new Date(progressByManga[b.mangaId]?.updatedAt || 0) - new Date(progressByManga[a.mangaId]?.updatedAt || 0))
            .slice(0, 12);
        if (active || inProgress.length < 2) { box.style.display = 'none'; box.innerHTML = ''; return; }
        box.style.display = '';
        box.innerHTML = `
            <div class="lib2-section-head"><span class="bar"></span><h2>Reprendre où j'en étais</h2></div>
            <div class="lib2-resume-row">${inProgress.map(f => {
                const prog = progressByManga[f.mangaId];
                const u = unreadCount(f);
                const href = MH.readerHref(f.mangaId, prog.chapterId, f.source || prog.source);
                const unit = MH.unitLabel(f.source, { short: true });
                return `
                <a class="lib2-card lib2-resume-card" href="${href}">
                    <div class="lib2-cover">
                        <img src="${f.cover || MH.placeholderCover(f.mangaId)}" alt="${MH.esc(f.title || '')}" loading="lazy"
                             onerror="this.src='${MH.placeholderCover(f.mangaId)}'">
                        ${u > 0 ? `<div class="lib2-badge">${u}</div>` : ''}
                    </div>
                    <div class="lib2-info">
                        <div class="lib2-title">${MH.esc(f.title || f.mangaId)}</div>
                        <div class="lib2-sub">${unit} ${MH.chapNum(prog.chapter)}</div>
                    </div>
                </a>`;
            }).join('')}</div>`;
    }

    // Favoris filtrés par type (manga/roman)
    function favsOfKind() {
        if (kindFilter === 'manga') return favs.filter(f => !MH.isNovelSource(f.source));
        if (kindFilter === 'novel') return favs.filter(f => MH.isNovelSource(f.source));
        return favs;
    }

    function render() {
        const grid = document.getElementById('libGrid');
        grid.classList.toggle('lib2-grid', viewMode !== 'list');
        grid.classList.toggle('lib2-list', viewMode === 'list');
        renderResume();
        const q = (document.getElementById('libSearch').value || '').toLowerCase();
        const sort = document.getElementById('libSort').value;
        // Set des mangas ayant au moins un signet (audit §10.3 : icône signet sur la carte)
        const bmSet = new Set((window.UserData?.getBookmarks?.() || []).map(b => b.mangaId));

        let list = favsOfKind().filter(f => !q || (f.title || '').toLowerCase().includes(q));
        if (filter.type === 'status')   list = list.filter(f => f.status === filter.value);
        if (filter.type === 'category') list = list.filter(f => f.category === filter.value);
        if (sourceFilter)               list = list.filter(f => (f.source || 'mangadex') === sourceFilter);
        if (unreadOnly)                 list = list.filter(f => unreadCount(f) > 0);

        if (sort === 'title')    list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        if (sort === 'unread')   list.sort((a, b) => unreadCount(b) - unreadCount(a));
        if (sort === 'progress') list.sort((a, b) => (progressByManga[b.mangaId]?.chapter || 0) - (progressByManga[a.mangaId]?.chapter || 0));
        if (sort === 'recent-read') list.sort((a, b) =>
            new Date(progressByManga[b.mangaId]?.updatedAt || 0) - new Date(progressByManga[a.mangaId]?.updatedAt || 0));
        // 'recent' = ordre par défaut (added_at desc)

        // Épingles toujours en tête (stable vis-à-vis du tri choisi)
        const pinned = (f) => window.UserData?.isPinned?.(f.mangaId, f.source) ? 0 : 1;
        list.sort((a, b) => pinned(a) - pinned(b));

        if (!list.length) {
            grid.innerHTML = `<div class="lib2-empty" style="grid-column:1/-1">${unreadOnly ? 'Aucune série avec des chapitres non lus.' : 'Aucun résultat.'}</div>`;
            return;
        }

        grid.innerHTML = list.map(f => {
            const prog = progressByManga[f.mangaId];
            const u = unreadCount(f);
            const isPin = window.UserData?.isPinned?.(f.mangaId, f.source);
            const st = f.status && STATUS[f.status]
                ? `<div class="lib2-status" style="background:${STATUS[f.status][1]}">${STATUS[f.status][0]}</div>` : '';
            // Progression de lecture : chapitres lus / total connu
            const readN = (readByManga[f.mangaId] || []).length;
            const total = Math.max(readN + u, readN, Math.round(f.lastChapter || 0));
            const pct = total > 0 ? Math.min(100, Math.round((readN / total) * 100)) : 0;
            const progBar = readN > 0
                ? `<div class="lib2-progress" title="${readN}/${total} lus (${pct}%)"><div class="lib2-progress-fill" style="width:${pct}%"></div></div>` : '';
            const href = prog?.chapterId
                ? MH.readerHref(f.mangaId, prog.chapterId, f.source || prog.source)
                : `serie.html?id=${encodeURIComponent(f.mangaId)}&source=${encodeURIComponent(f.source || '')}`;
            const hasBm = bmSet.has(f.mangaId);
            const isSel = selected.has(f.mangaId);
            const unit = MH.unitLabel(f.source, { short: true });
            return `
            <a class="lib2-card ${selectMode ? 'selectable' : ''} ${isSel ? 'selected' : ''}" href="${href}" data-manga-id="${f.mangaId}" data-src="${MH.esc(f.source || '')}">
                <div class="lib2-cover">
                    <img src="${f.cover || MH.placeholderCover(f.mangaId)}" alt="${MH.esc(f.title || '')}" loading="lazy"
                         onerror="this.src='${MH.placeholderCover(f.mangaId)}'">
                    ${selectMode ? `<div class="lib2-check">${isSel ? '✓' : ''}</div>` : ''}
                    ${st}
                    ${MH.isNovelSource(f.source) ? '<div class="lib2-kind-badge">ROMAN</div>' : ''}
                    ${u > 0 ? `<div class="lib2-badge">${u}</div>` : ''}
                    ${(hasBm || prog) ? `<div class="dog-ear ${MH.isNovelSource(f.source) ? 'novel' : ''}" title="${hasBm ? 'Contient un signet' : 'Reprise de lecture possible'}"></div>` : ''}
                    <button class="lib2-pin ${isPin ? 'on' : ''}" data-pin="${MH.esc(f.mangaId)}" data-src="${MH.esc(f.source || '')}"
                        title="${isPin ? 'Désépingler' : 'Épingler en haut'}" aria-label="Épingler">${MH.icon('pin', 15)}</button>
                    <button class="lib2-del" data-del="${MH.esc(f.mangaId)}" data-title="${MH.esc(f.title || '')}"
                        title="Retirer de ma bibliothèque" aria-label="Retirer">✕</button>
                    ${progBar}
                </div>
                <div class="lib2-info">
                    <div class="lib2-title">${MH.esc(f.title || f.mangaId)}</div>
                    <div class="lib2-sub">${prog ? unit + ' ' + MH.chapNum(prog.chapter) : 'Pas commencé'} · ${f.source || 'mangadex'}</div>
                    ${f.category ? `<div class="lib2-cat">${MH.esc(f.category)}</div>` : ''}
                </div>
            </a>`;
        }).join('');

        // En mode sélection : le clic sur une carte (de)sélectionne au lieu de naviguer.
        if (selectMode) {
            grid.querySelectorAll('.lib2-card').forEach(card => card.addEventListener('click', (e) => {
                e.preventDefault();
                const id = card.dataset.mangaId;
                if (selected.has(id)) selected.delete(id); else selected.add(id);
                card.classList.toggle('selected', selected.has(id));
                const chk = card.querySelector('.lib2-check');
                if (chk) chk.textContent = selected.has(id) ? '✓' : '';
                renderBulkBar();
            }));
        }

        grid.querySelectorAll('.lib2-pin').forEach(btn => btn.addEventListener('click', (e) => {
            e.preventDefault(); e.stopPropagation();
            const nowPinned = window.UserData?.togglePin?.(btn.dataset.pin, btn.dataset.src);
            MH.toast?.(nowPinned ? 'Épinglé en haut de la bibliothèque' : 'Désépinglé');
            render();
        }));

        grid.querySelectorAll('.lib2-del').forEach(btn => btn.addEventListener('click', async (e) => {
            e.preventDefault(); e.stopPropagation();
            if (!API.isLoggedIn()) { MH.toast?.('Connecte-toi pour modifier ta bibliothèque'); return; }
            const id = btn.dataset.del;
            if (!confirm(`Retirer « ${btn.dataset.title || id} » de ta bibliothèque ?`)) return;
            try {
                await API.me.removeFavorite(id);
                favs = favs.filter(f => f.mangaId !== id);
                try { const set = await MH.getFavSet?.(); set?.delete(String(id)); } catch (er) {}
                window.Storage?.cacheLibrary?.(favs);
                MH.toast?.('Retiré de ta bibliothèque');
                renderSummary(); renderFilters(); render();
            } catch (err) { MH.toast?.('Erreur : ' + err.message); }
        }));
    }

    // re-render on search (debounce, audit §2 — évite un render complet à chaque frappe) / sort
    let searchTimer = null;
    document.addEventListener('input', e => {
        if (e.target.id !== 'libSearch') return;
        clearTimeout(searchTimer);
        searchTimer = setTimeout(render, 200);
    });
    document.addEventListener('change', e => { if (e.target.id === 'libSort') render(); });

    // ── Vue Grille / Liste (audit §10.3) ──
    function wireViewToggle() {
        const box = document.getElementById('libViewToggle');
        if (!box) return;
        const paint = () => box.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.view === viewMode));
        paint();
        box.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
            viewMode = b.dataset.view;
            try { window.Storage?.setPref?.('libView', viewMode); } catch (e) {}
            paint(); render();
        }));
    }

    // ── Sélection multiple + actions groupées (audit §10.3) ──
    function wireSelect() {
        const btn = document.getElementById('btnLibSelect');
        document.getElementById('bulkCancel')?.addEventListener('click', () => setSelectMode(false));
        document.getElementById('bulkDelete')?.addEventListener('click', bulkDelete);
        document.getElementById('bulkStatus')?.addEventListener('click', bulkStatus);
        btn?.addEventListener('click', () => setSelectMode(!selectMode));
    }
    function setSelectMode(on) {
        selectMode = on;
        if (!on) selected.clear();
        const btn = document.getElementById('btnLibSelect');
        if (btn) btn.classList.toggle('btn-primary', on);
        render();
        renderBulkBar();
    }
    function renderBulkBar() {
        const bar = document.getElementById('libBulkBar');
        if (!bar) return;
        bar.classList.toggle('hidden', !selectMode);
        const c = document.getElementById('bulkCount');
        if (c) c.textContent = `${selected.size} sélectionné(s)`;
    }
    async function bulkDelete() {
        if (!selected.size) { MH.toast?.('Rien de sélectionné'); return; }
        if (!confirm(`Retirer ${selected.size} série(s) de ta bibliothèque ?`)) return;
        const ids = [...selected];
        for (const id of ids) {
            try { await API.me.removeFavorite(id); favs = favs.filter(f => f.mangaId !== id); }
            catch (e) { /* on continue */ }
        }
        try { const set = await MH.getFavSet?.(); ids.forEach(id => set?.delete(String(id))); } catch (e) {}
        window.Storage?.cacheLibrary?.(favs);
        MH.toast?.(`${ids.length} série(s) retirée(s)`);
        setSelectMode(false);
        renderSummary(); renderFilters(); render();
    }
    async function bulkStatus() {
        if (!selected.size) { MH.toast?.('Rien de sélectionné'); return; }
        const choices = Object.keys(STATUS).map((s, i) => `${i + 1}. ${STATUS[s][0]}`).join('\n');
        const keys = Object.keys(STATUS);
        const ans = prompt(`Nouveau statut pour ${selected.size} série(s) :\n${choices}\n\nEntre un numéro (1-${keys.length}) :`);
        const idx = parseInt(ans, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= keys.length) return;
        const status = keys[idx];
        const ids = [...selected];
        for (const id of ids) {
            try {
                await API.me.setLibrary(id, status);
                const f = favs.find(x => x.mangaId === id);
                if (f) f.status = status;
            } catch (e) { /* on continue */ }
        }
        MH.toast?.(`Statut mis à jour (${STATUS[status][0]})`);
        setSelectMode(false);
        renderFilters(); render();
    }

    // Case « Inclure terminé/abandonné » (§15.4-1) — persistée
    function includeFinished() {
        try { return localStorage.getItem('inko_upd_all') === '1'; } catch (e) { return false; }
    }

    // ── MISES À JOUR ──
    function bindUpdates() {
        const btn = document.getElementById('btnCheckUpdates');
        const status = document.getElementById('updStatus');
        const listEl = document.getElementById('updList');

        // Injecte la case à cocher à côté du bouton (évite de toucher au HTML)
        if (btn && !document.getElementById('updScopeAll')) {
            const label = document.createElement('label');
            label.style.cssText = 'display:inline-flex;align-items:center;gap:6px;font-size:12px;color:var(--text2);margin-left:4px;cursor:pointer';
            label.innerHTML = `<input type="checkbox" id="updScopeAll" ${includeFinished() ? 'checked' : ''}> Inclure terminé/abandonné`;
            btn.after(label);
            label.querySelector('input').addEventListener('change', (e) => {
                try { localStorage.setItem('inko_upd_all', e.target.checked ? '1' : '0'); } catch (er) {}
            });
        }

        btn.addEventListener('click', async () => {
            btn.disabled = true;
            status.innerHTML = '<span class="spinner-inline" style="width:12px;height:12px;border-width:1px"></span> Vérification en cours…';
            listEl.innerHTML = '';
            try {
                const data = await fetchUpdates();
                const ups = data.updates || [];
                const fails = data.failures || [];
                status.textContent = `${data.scanned ?? ups.length} vérifiée(s)`
                    + (data.skipped ? ` · ${data.skipped} ignorée(s) (terminé/abandonné)` : '')
                    + ` · ${ups.filter(u => u.unreadCount > 0).length} avec du non-lu`
                    + (fails.length ? ` · ${fails.length} échec(s)` : '');
                render(); // rafraîchit aussi les badges de l'onglet Bibliothèque

                if (!ups.length && !fails.length) {
                    listEl.innerHTML = `<div class="lib2-empty"><div class="ico"></div>Aucune série suivie. Ajoute des favoris pour suivre leurs mises à jour.</div>`;
                    return;
                }
                // §15.4-2 : les échecs de vérification sont visibles, plus jamais muets
                const failsHtml = fails.map(f => `
                    <div class="upd-row" style="border-left:3px solid var(--hanko)">
                        <a class="upd-cover" href="serie.html?id=${encodeURIComponent(f.mangaId)}&source=${encodeURIComponent(f.source || '')}">
                            <img src="${f.cover || MH.placeholderCover(f.mangaId)}" alt="" loading="lazy" onerror="this.src='${MH.placeholderCover(f.mangaId)}'">
                        </a>
                        <div class="upd-info">
                            <div class="upd-name">${MH.esc(f.title)} <span class="upd-new" style="background:rgba(168,50,50,.14);color:var(--hanko)">ÉCHEC</span></div>
                            <div class="upd-meta" style="color:var(--hanko)">${MH.esc(f.error || 'Vérification impossible')}</div>
                        </div>
                    </div>`).join('');
                listEl.innerHTML = failsHtml + ups.map(u => {
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
