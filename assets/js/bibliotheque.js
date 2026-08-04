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

    // Audit A11Y-02 : ces pastilles portent du texte BLANC en 9px sur un aplat
    // plein — le contraste dépend donc entièrement du fond. Les teintes vives
    // d'origine donnaient 2.28:1 (vert), 2.15:1 (ambre) et 3.68:1 (bleu), pour
    // un seuil AA de 4.5:1. Teintes assombries jusqu'à franchir le seuil, en
    // gardant la même sémantique de couleur.
    const STATUS = {
        reading:   ['En cours',  '#15703a'],
        completed: ['Terminé',   '#1d4ed8'],
        planned:   ['À lire',    '#7e22ce'],
        paused:    ['En pause',  '#8a5108'],
        dropped:   ['Abandonné', '#b3261e'],
    };

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('bibliotheque');

        await (window.API?.ready || Promise.resolve());   // session locale auto
        if (!API.isLoggedIn()) {
            showLoggedOutLibrary();
            return;
        }

        initTabs();
        try { viewMode = window.Storage?.getPref?.('libView') === 'list' ? 'list' : 'grid'; } catch (e) { window.MH?.err?.('bibliotheque.js', e); }
        await loadLibrary();
        bindUpdates();
        wireNotifyButton();
        wireLibRefresh();
        wireLibRandom();
        wireLibExtras();
        wireViewToggle();
        wireSelect();
        wireGridDelegation();
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
            // Audit N1 : message honnête (non connecté ≠ serveur en panne)
            document.getElementById('tabLibrary').innerHTML = `<div class="lib2-empty">${MH.guestNotice()}</div>`;
            return;
        }

        // Bannière « hors connexion »
        const banner = document.createElement('div');
        banner.style.cssText = 'display:flex;align-items:center;gap:12px;flex-wrap:wrap;background:var(--bg2);border:1px solid var(--border);border-left:3px solid var(--orange);border-radius:10px;padding:11px 14px;margin-bottom:16px;font-size:13px;color:var(--text2)';
        const when = cache.at ? new Date(cache.at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
        banner.innerHTML = `<span style="flex:1;min-width:200px">Aperçu local de ta bibliothèque${when ? ` (sauvegardé le ${when})` : ''}. Le serveur est injoignable : aperçu hors-ligne.</span>
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
        let last = 0; try { last = +localStorage.getItem(KEY) || 0; } catch (e) { window.MH?.err?.('bibliotheque.js', e); }
        if (Date.now() - last < 6 * 3600 * 1000) return;
        const status = document.getElementById('libRefreshStatus');
        if (status) status.innerHTML = '<span class="spinner-inline" style="width:12px;height:12px;border-width:1px"></span> Recherche de nouveautés…';
        try {
            await fetchUpdates();
            render();
            try { localStorage.setItem(KEY, String(Date.now())); } catch (e) { window.MH?.err?.('bibliotheque.js', e); }
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
        try { localStorage.setItem('inko_lib_newcount', String(newCount)); } catch (e) { window.MH?.err?.('bibliotheque.js', e); }
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
        try { notified = JSON.parse(localStorage.getItem('inko_notified') || '{}'); } catch (e) { window.MH?.err?.('bibliotheque.js', e); }
        const fresh = updates.filter(u => u.hasNew && u.latest && notified[u.mangaId] !== u.latest.id).slice(0, 5);
        fresh.forEach(u => {
            try {
                const n = new Notification('Inko — nouveau chapitre', {
                    body: `${u.title} · Ch. ${u.latest.chapter}`,
                    icon: u.cover || '/assets/img/icon.svg', tag: 'inko-' + u.mangaId,
                });
                n.onclick = () => { window.focus(); window.location.href = MH.readerHref(u.mangaId, u.latest.id, u.source); };
            } catch (e) { window.MH?.err?.('bibliotheque.js', e); }
            notified[u.mangaId] = u.latest.id;
        });
        try { localStorage.setItem('inko_notified', JSON.stringify(notified)); } catch (e) { window.MH?.err?.('bibliotheque.js', e); }
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
            if (perm !== 'granted') { try { perm = await Notification.requestPermission(); } catch (e) { window.MH?.err?.('bibliotheque.js', e); } }
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
        try { compact = window.Storage?.getPref?.('libDensity') === 'compact'; } catch (e) { window.MH?.err?.('bibliotheque.js', e); }
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
                if (!await MH.confirm('Restaurer cette sauvegarde ? Tes favoris, progression et listes seront fusionnés avec les données importées.', { okText: 'Restaurer' })) { iFile.value = ''; return; }
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

        // Export CSV (audit N36) : format lisible ailleurs (tableur, migration)
        // en plus de la sauvegarde JSON complète. BOM + « ; » pour Excel FR.
        document.getElementById('btnLibExportCsv')?.addEventListener('click', () => {
            if (!favs.length) { MH.toast?.('Ta bibliothèque est vide'); return; }
            const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
            const rows = [
                ['titre', 'source', 'statut', 'note', 'dernier_chapitre', 'id'],
                ...favs.map(f => [f.title || f.mangaId, f.source || '', f.status || '', f.rating ?? '', f.last_chapter ?? '', f.mangaId]),
            ];
            const csv = '﻿' + rows.map(r => r.map(esc).join(';')).join('\r\n');
            const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
            const a = document.createElement('a');
            a.href = url;
            a.download = `inko-bibliotheque-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a); a.click(); a.remove();
            URL.revokeObjectURL(url);
            MH.toast?.('CSV téléchargé');
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
                // Audit A11Y-03 : aria-selected suit la classe active (l'etat n'existait
                // que visuellement - invisible pour les lecteurs d'ecran).
                document.querySelectorAll('.lib2-tab').forEach(t => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
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
            el.innerHTML = `<div class="lib2-empty"><div class="ico" style="color:var(--accent)">${MH.icon('bookmark', 40)}</div>
                <div style="font-size:14px;color:var(--text);font-weight:500;margin-bottom:6px">Aucun signet</div>
                Sur une fiche série, clique sur l'icône signet d'un chapitre pour le retrouver ici.</div>`;
            return;
        }
        el.innerHTML = items.map(b => {
            const href = MH.readerHref(b.mangaId, b.chapterId, b.source);
            return `
            <div class="upd-row">
                <a class="upd-cover" href="${href}">
                    <img src="${MH.cover(b.cover, MH.placeholderCover(b.mangaId))}" alt="" loading="lazy" onerror="this.src='${MH.placeholderCover(b.mangaId)}'">
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
                    <img src="${MH.cover(g.cover, MH.placeholderCover(g.mangaId))}" alt="" loading="lazy" onerror="this.src='${MH.placeholderCover(g.mangaId)}'">
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

        // Pour les favoris sans titre/cover stockés (anciens), on complète via
        // l'API en interrogeant LA SOURCE DU FAVORI (audit N49 : l'ancien code
        // passait par la source courante de l'app — mauvais catalogue dès que le
        // favori venait d'ailleurs, échec silencieux à chaque visite).
        const missing = favs.filter(f => !f.title || !f.cover);
        if (missing.length) {
            await Promise.allSettled(missing.map(async f => {
                try {
                    const m = f.source
                        ? await API.mangas.getFrom(f.source, f.mangaId)
                        : await API.mangas.get(f.mangaId);   // très ancien favori sans source : best-effort
                    f.title = f.title || m.title;
                    f.cover = f.cover || m.cover || m.coverThumb;
                } catch (e) { window.MH?.err?.('bibliotheque.js', e); }
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
            `<button class="lib2-chip ${on ? 'on' : ''}" aria-pressed="${!!on}" data-ftype="${type}" data-fval="${MH.esc(val == null ? '' : val)}">${MH.esc(label)}${count != null ? `<span class="cnt">${count}</span>` : ''}</button>`;

        // Segment Mangas / Romans (n'apparaît que si la biblio contient des deux)
        const nManga = favs.filter(f => !MH.isNovelSource(f.source)).length;
        const nNovel = favs.filter(f => MH.isNovelSource(f.source)).length;
        let kindHtml = '';
        if (nManga && nNovel) {
            const k = (val, label, count) =>
                `<button class="lib2-kind ${kindFilter === val ? 'on' : ''}" aria-pressed="${kindFilter === val}" data-kind="${val}">${label}<span class="cnt">${count}</span></button>`;
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
                `<button class="lib2-chip ${!sourceFilter ? 'on' : ''}" aria-pressed="${!sourceFilter}" data-src="">Toutes sources</button>` +
                sources.sort().map(s => `<button class="lib2-chip ${sourceFilter === s ? 'on' : ''}" aria-pressed="${sourceFilter === s}" data-src="${MH.esc(s)}">${MH.esc(s)}<span class="cnt">${srcCount[s]}</span></button>`).join('');
        }
        // Bascule « Non lus uniquement »
        const unreadHtml = `<button class="lib2-chip ${unreadOnly ? 'on' : ''}" aria-pressed="${!!unreadOnly}" id="chipUnread" style="margin-left:auto" title="N'afficher que les séries avec des chapitres non lus">● Non lus</button>`;
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
                        <img src="${MH.cover(f.cover, MH.placeholderCover(f.mangaId))}" alt="${MH.esc(f.title || '')}" loading="lazy"
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

        renderList = list;
        renderBmSet = bmSet;
        renderedCount = 0;
        // Le rendu repart de zéro : l'observateur pointe sur une sentinelle qui
        // va disparaître, et des tranches du rendu précédent peuvent encore être
        // en attente dans la file d'inactivité. Le jeton les neutralise, sans
        // quoi un tri rapidement suivi d'un autre mélangerait les deux listes.
        chunkObserver?.disconnect();
        const token = ++renderToken;
        grid.innerHTML = '';
        appendChunk(token);
    }

    // ── Rendu progressif (audit PERF-05) ─────────────────────
    // 373 séries produisaient 4 913 nœuds en un seul `innerHTML`, et chaque
    // changement de tri reconstruisait le tout (27 ms bloquants mesurés).
    //
    // Une pagination classique aurait été une régression d'usage : on parcourt
    // une bibliothèque en faisant défiler, pas en cliquant « page 4 ». Un
    // défilement infini pur, lui, fait dépendre l'accès au contenu d'un
    // déclencheur : si l'observateur ne se déclenche pas (conteneur défilant
    // inattendu, onglet en arrière-plan, recherche Ctrl+F du navigateur), la
    // bibliothèque paraît s'arrêter à 60 séries. Un défaut de performance
    // deviendrait un défaut de contenu — bien pire.
    //
    // On peint donc une première tranche tout de suite, et les suivantes se
    // posent d'elles-mêmes pendant les temps morts du navigateur. L'observateur
    // ne fait qu'accélérer les choses quand l'utilisateur descend vite : rien
    // ne dépend de lui. Tout finit rendu, mais réparti au lieu d'être bloquant.
    //
    // Aucun appel réseau supplémentaire : la liste est déjà entièrement en
    // mémoire, seul le travail DOM est étalé.
    const CHUNK = 60;
    const idle = window.requestIdleCallback
        ? (fn) => window.requestIdleCallback(fn, { timeout: 500 })
        : (fn) => setTimeout(fn, 32);
    let renderList = [];
    let renderBmSet = new Set();
    let renderedCount = 0;
    let renderToken = 0;          // invalide les tranches d'un rendu abandonné
    let chunkObserver = null;

    function appendChunk(token) {
        if (token !== renderToken) return;         // un nouveau tri a eu lieu
        const grid = document.getElementById('libGrid');
        if (!grid) return;
        const slice = renderList.slice(renderedCount, renderedCount + CHUNK);
        if (!slice.length) return;

        document.getElementById('libGridSentinel')?.remove();
        grid.insertAdjacentHTML('beforeend', slice.map(f => cardHTML(f, renderBmSet)).join(''));
        renderedCount += slice.length;
        if (renderedCount >= renderList.length) return;

        // La sentinelle vit DANS la grille : la sortir la placerait hors du
        // flux observé et l'observateur ne se déclencherait jamais.
        grid.insertAdjacentHTML('beforeend',
            '<div id="libGridSentinel" style="grid-column:1/-1;height:1px"></div>');
        const sentinel = document.getElementById('libGridSentinel');
        if (!chunkObserver) {
            chunkObserver = new IntersectionObserver((entries) => {
                if (entries.some(e => e.isIntersecting)) appendChunk(renderToken);
            }, { rootMargin: '600px' });
        }
        chunkObserver.observe(sentinel);
        idle(() => appendChunk(token));
    }

    function cardHTML(f, bmSet) {
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
                    <img src="${MH.cover(f.cover, MH.placeholderCover(f.mangaId))}" alt="${MH.esc(f.title || '')}" loading="lazy"
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
    }

    // ── Écouteurs délégués (audit PERF-05) ───────────────────
    // Chaque carte recevait jusqu'à trois écouteurs (épingle, retrait, et le
    // clic de sélection) : ~1 100 écouteurs pour 373 séries, recréés à chaque
    // tri ou changement de filtre. Avec un rendu par tranches, il aurait fallu
    // en plus les recâbler après chaque ajout. Un seul écouteur sur la grille
    // règle les deux problèmes, et vaut pour les cartes pas encore peintes.
    function wireGridDelegation() {
        const grid = document.getElementById('libGrid');
        if (!grid) return;

        grid.addEventListener('click', async (e) => {
            const pin = e.target.closest('.lib2-pin');
            if (pin) {
                e.preventDefault(); e.stopPropagation();
                const nowPinned = window.UserData?.togglePin?.(pin.dataset.pin, pin.dataset.src);
                MH.toast?.(nowPinned ? 'Épinglé en haut de la bibliothèque' : 'Désépinglé');
                render();
                return;
            }

            const del = e.target.closest('.lib2-del');
            if (del) {
                e.preventDefault(); e.stopPropagation();
                if (!API.isLoggedIn()) { MH.toast?.('Connecte-toi pour modifier ta bibliothèque'); return; }
                const id = del.dataset.del;
                if (!await MH.confirm(`Retirer « ${del.dataset.title || id} » de ta bibliothèque ?`, { danger: true, okText: 'Retirer' })) return;
                try {
                    await API.me.removeFavorite(id);
                    favs = favs.filter(f => f.mangaId !== id);
                    try { const set = await MH.getFavSet?.(); set?.delete(String(id)); } catch (er) { window.MH?.err?.('bibliotheque.js', er); }
                    window.Storage?.cacheLibrary?.(favs);
                    MH.toast?.('Retiré de ta bibliothèque');
                    renderSummary(); renderFilters(); render();
                } catch (err) { MH.toast?.('Erreur : ' + err.message); }
                return;
            }

            // En mode sélection : le clic sur une carte (dé)sélectionne au lieu de naviguer.
            const card = selectMode && e.target.closest('.lib2-card');
            if (card) {
                e.preventDefault();
                const id = card.dataset.mangaId;
                if (selected.has(id)) selected.delete(id); else selected.add(id);
                card.classList.toggle('selected', selected.has(id));
                const chk = card.querySelector('.lib2-check');
                if (chk) chk.textContent = selected.has(id) ? '✓' : '';
                renderBulkBar();
            }
        });
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
            try { window.Storage?.setPref?.('libView', viewMode); } catch (e) { window.MH?.err?.('bibliotheque.js', e); }
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
    // Progression des actions groupées (audit N50) — réutilise le compteur de la barre
    function bulkProgress(done, total) {
        const c = document.getElementById('bulkCount');
        if (c) c.textContent = `${done} / ${total}…`;
    }
    async function bulkDelete() {
        if (!selected.size) { MH.toast?.('Rien de sélectionné'); return; }
        if (!await MH.confirm(`Retirer ${selected.size} série(s) de ta bibliothèque ?`, { danger: true, okText: 'Retirer' })) return;
        const ids = [...selected];
        let done = 0;
        for (const id of ids) {
            bulkProgress(++done, ids.length);   // retour visuel (audit N50)
            try { await API.me.removeFavorite(id); favs = favs.filter(f => f.mangaId !== id); }
            catch (e) { /* on continue */ }
        }
        try { const set = await MH.getFavSet?.(); ids.forEach(id => set?.delete(String(id))); } catch (e) { window.MH?.err?.('bibliotheque.js', e); }
        window.Storage?.cacheLibrary?.(favs);
        MH.toast?.(`${ids.length} série(s) retirée(s)`);
        setSelectMode(false);
        renderSummary(); renderFilters(); render();
    }
    async function bulkStatus() {
        if (!selected.size) { MH.toast?.('Rien de sélectionné'); return; }
        const choices = Object.keys(STATUS).map((s, i) => `${i + 1}. ${STATUS[s][0]}`).join('\n');
        const keys = Object.keys(STATUS);
        const ans = await MH.prompt(`Nouveau statut pour ${selected.size} série(s)`, { message: choices, placeholder: `Numéro 1-${keys.length}`, okText: 'Appliquer' });
        const idx = parseInt(ans, 10) - 1;
        if (isNaN(idx) || idx < 0 || idx >= keys.length) return;
        const status = keys[idx];
        // Confirmation avant application en masse (audit N50 : bulkDelete
        // confirmait, bulkStatus s'appliquait instantanément sans retour arrière)
        if (!await MH.confirm(`Passer ${selected.size} série(s) en « ${STATUS[status][0]} » ?`, { okText: 'Appliquer' })) return;
        const ids = [...selected];
        let done = 0;
        for (const id of ids) {
            bulkProgress(++done, ids.length);   // retour visuel (audit N50)
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
                try { localStorage.setItem('inko_upd_all', e.target.checked ? '1' : '0'); } catch (er) { window.MH?.err?.('bibliotheque.js', er); }
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
                            <img src="${MH.cover(f.cover, MH.placeholderCover(f.mangaId))}" alt="" loading="lazy" onerror="this.src='${MH.placeholderCover(f.mangaId)}'">
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
                            <img src="${MH.cover(u.cover, MH.placeholderCover(u.mangaId))}" alt="" loading="lazy"
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
                            ${u.unreadCount > 0 ? `<button class="btn btn-secondary btn-sm" data-markread="${encodeURIComponent(u.mangaId)}" data-src="${MH.esc(src)}" title="Marquer toute la série comme lue">Tout lu</button>` : ''}
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
