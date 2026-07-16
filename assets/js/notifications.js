// notifications.js — Page dédiée des notifications (audit §6.1 ; refonte Partie G)
(function () {
    'use strict';

    const ICONS = { reply: 'comment', mention: 'comment', chapter: 'book', new_chapter: 'book', badge: 'award', system: 'bell' };
    const FILTER_KEY = 'inko_notif_filter';   // filtre persisté (audit G.6)
    let items = [];
    let loadError = false;                    // distinguer erreur réseau et vide (audit N9-notif / G.3)
    let loadedAt = null;
    let filter = 'all';
    try { filter = localStorage.getItem(FILTER_KEY) || 'all'; } catch (e) {}

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('');
        const list = document.getElementById('ntList');
        await (window.API?.ready || Promise.resolve());
        if (!API.isLoggedIn()) {
            list.innerHTML = `<div class="nt-empty">
                <div style="font-size:15px;color:var(--text);font-weight:600;margin-bottom:8px">Serveur injoignable</div>
                <button class="btn btn-primary" style="margin-top:10px" onclick="location.reload()">Réessayer</button></div>`;
            document.getElementById('ntMarkAll').style.display = 'none';
            return;
        }

        // Ré-applique le filtre persisté sur les pastilles
        document.querySelectorAll('.nt-pill').forEach(p => p.classList.toggle('active', p.dataset.f === filter));

        document.getElementById('ntFilters').addEventListener('click', (e) => {
            const b = e.target.closest('.nt-pill'); if (!b) return;
            filter = b.dataset.f;
            try { localStorage.setItem(FILTER_KEY, filter); } catch (e2) {}
            document.querySelectorAll('.nt-pill').forEach(p => p.classList.toggle('active', p === b));
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
        } catch (e) {}

        await load();
    });

    async function load() {
        const btn = document.getElementById('ntRefresh');
        if (btn) { btn.disabled = true; btn.textContent = '↻ …'; }
        try {
            items = (await API.notifications.list(100)).items || [];
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
        let shown = items;
        if (filter === 'unread') shown = items.filter(n => !n.read);
        else if (filter !== 'all') shown = items.filter(n => n.type === filter);
        if (!shown.length) {
            list.innerHTML = `<div class="nt-empty">Aucune notification${filter !== 'all' ? ' dans ce filtre' : ''}.</div>`;
            return;
        }
        list.innerHTML = shown.map(n => `
            <a class="nt-item ${n.read ? '' : 'unread'}" href="${MH.esc(n.link || '#')}" data-nid="${n.id}">
                ${n.image
                    ? `<img class="nt-cover" src="${MH.esc(n.image)}" alt="" loading="lazy" style="width:38px;height:52px;object-fit:cover;border-radius:7px;background:var(--bg3);flex:0 0 auto" onerror="this.style.display='none'">`
                    : `<div class="nt-ico" style="color:var(--accent)">${MH.icon(ICONS[n.type] || 'bell', 18)}</div>`}
                <div class="nt-body">
                    <div class="nt-title">${MH.esc(n.title || '')}</div>
                    ${n.body ? `<div class="nt-text">${MH.esc(n.body)}</div>` : ''}
                    <div class="nt-when">${timeAgo(n.at)}</div>
                </div>
            </a>`).join('');
        list.querySelectorAll('[data-nid]').forEach(a => {
            a.addEventListener('click', () => { API.notifications.markRead(a.dataset.nid).catch(() => {}); });
        });
    }
})();
