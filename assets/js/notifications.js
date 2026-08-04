// notifications.js — Page dédiée des notifications (audit §6.1 ; refonte Partie G)
(function () {
    'use strict';

    const FILTER_KEY = 'inko_notif_filter';   // filtre persisté (audit G.6)
    const PAGE_SIZE = 100;
    let items = [];
    let total = 0;                            // total serveur (pagination, audit N3)
    let loadError = false;                    // distinguer erreur réseau et vide (audit N9-notif / G.3)
    let loadedAt = null;
    let filter = 'all';
    try { filter = localStorage.getItem(FILTER_KEY) || 'all'; } catch (e) { window.MH?.err?.('notifications.js', e); }

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('');
        const list = document.getElementById('ntList');
        await (window.API?.ready || Promise.resolve());
        if (!API.isLoggedIn()) {
            // Audit N1 : message honnête (non connecté ≠ serveur en panne)
            list.innerHTML = `<div class="nt-empty">${MH.guestNotice()}</div>`;
            document.getElementById('ntMarkAll').style.display = 'none';
            return;
        }

        // Ré-applique le filtre persisté sur les pastilles
        // Audit A11Y-03 : l'etat n'existait que par une classe CSS - invisible
        // pour les lecteurs d'ecran. aria-pressed suit desormais la classe.
        document.querySelectorAll('.nt-pill').forEach(p => {
            const on = p.dataset.f === filter;
            p.classList.toggle('active', on);
            p.setAttribute('aria-pressed', String(on));
        });

        document.getElementById('ntFilters').addEventListener('click', (e) => {
            const b = e.target.closest('.nt-pill'); if (!b) return;
            filter = b.dataset.f;
            try { localStorage.setItem(FILTER_KEY, filter); } catch (e2) { window.MH?.err?.('notifications.js', e2); }
            document.querySelectorAll('.nt-pill').forEach(p => {
                p.classList.toggle('active', p === b);
                p.setAttribute('aria-pressed', String(p === b));
            });
            render();
        });
        document.getElementById('ntEnablePush')?.addEventListener('click', () => window.MH.enablePush?.());
        document.getElementById('ntMarkAll').addEventListener('click', async () => {
            try { await API.notifications.markAll(); items.forEach(n => { n.read = true; }); render(); MH.toast?.('Tout est lu ✓'); }
            catch (e) { MH.toast?.('Erreur : ' + e.message); }
        });
        // Bouton Actualiser (audit N8 / G.2) — état de chargement le temps de l'appel
        document.getElementById('ntRefresh')?.addEventListener('click', () => load());

        // Un push reçu pendant que la page est ouverte recharge la liste (audit G.4)
        try {
            navigator.serviceWorker?.addEventListener('message', (e) => {
                if (e.data && e.data.type === 'notif:new') load();
            });
        } catch (e) { window.MH?.err?.('notifications.js', e); }

        await load();
    });

    async function load() {
        const btn = document.getElementById('ntRefresh');
        if (btn) { btn.disabled = true; btn.textContent = '↻ …'; }
        try {
            const data = await API.notifications.list(PAGE_SIZE);
            items = data.items || [];
            total = data.total ?? items.length;
            loadError = false;
            loadedAt = Date.now();
        } catch (e) {
            loadError = true;   // on garde les items déjà affichés le cas échéant
        }
        if (btn) { btn.disabled = false; btn.textContent = '↻ Actualiser'; }
        renderFreshness();
        render();
        window.MH.refreshNotifBadge?.();
    }

    // Audit N3 : « charger plus » — l'historique au-delà des 100 plus
    // récentes était invisible sans aucun indicateur.
    async function loadMore() {
        try {
            const data = await API.notifications.list(PAGE_SIZE, items.length);
            items = items.concat(data.items || []);
            total = data.total ?? total;
            render();
        } catch (e) { MH.toast?.('Erreur : ' + e.message); }
    }

    function renderFreshness() {
        const el = document.getElementById('ntFreshness');
        if (!el) return;
        el.textContent = loadError ? '' : (loadedAt ? `Actualisé ${timeAgo(loadedAt)}` : '');
    }

    function timeAgo(d) {
        const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
        if (s < 60) return "à l'instant";
        const m = Math.floor(s / 60); if (m < 60) return `il y a ${m} min`;
        const h = Math.floor(m / 60); if (h < 24) return `il y a ${h} h`;
        const j = Math.floor(h / 24); if (j < 30) return `il y a ${j} j`;
        return new Date(d).toLocaleDateString('fr-FR');
    }

    function render() {
        const list = document.getElementById('ntList');
        // Erreur réseau ≠ « aucune notification » (audit G.3)
        if (loadError && !items.length) {
            list.innerHTML = `<div class="nt-empty">
                <div style="font-size:14px;color:var(--text);font-weight:600;margin-bottom:8px">Impossible de charger les notifications</div>
                <button class="btn btn-primary btn-sm" id="ntRetry">Réessayer</button></div>`;
            list.querySelector('#ntRetry')?.addEventListener('click', () => load());
            return;
        }
        // Audit BUG-08 : la pastille « Chapitres » filtrait sur type === 'chapter'
        // alors que lib/updates.js écrit 'new_chapter' — le filtre renvoyait donc
        // toujours 0, sur 52 notifications qui étaient TOUTES des nouveaux
        // chapitres. global.js:notifIconName connaissait déjà les deux
        // orthographes ; on aligne le filtre sur le même principe.
        const TYPE_ALIASES = {
            chapter: ['chapter', 'new_chapter'],
            reply:   ['reply'],
            mention: ['mention'],
            badge:   ['badge'],
            system:  ['system'],
        };
        let shown = items;
        if (filter === 'unread') shown = items.filter(n => !n.read);
        else if (filter !== 'all') {
            const accepted = TYPE_ALIASES[filter] || [filter];
            shown = items.filter(n => accepted.includes(n.type));
        }
        if (!shown.length) {
            list.innerHTML = `<div class="nt-empty">Aucune notification${filter !== 'all' ? ' dans ce filtre' : ''}.</div>`;
            return;
        }
        // Gabarit partagé avec la cloche du header (audit N2)
        list.innerHTML = shown.map(n => MH.notifItemHTML(n, { variant: 'page', timeAgo })).join('');
        // Pagination (audit N3) : bouton « charger plus » tant que le serveur
        // a plus de notifications que ce qui est chargé, avec compteur honnête.
        if (filter === 'all' && items.length < total) {
            list.innerHTML += `<div style="text-align:center;padding:14px">
                <div style="font-size:11.5px;color:var(--text3);margin-bottom:8px">${items.length} sur ${total}</div>
                <button class="btn btn-secondary btn-sm" id="ntMore">Charger plus</button></div>`;
            list.querySelector('#ntMore')?.addEventListener('click', loadMore);
        }
        list.querySelectorAll('[data-nid]').forEach(a => {
            a.addEventListener('click', () => { API.notifications.markRead(a.dataset.nid).catch(() => {}); });
        });
    }
})();
