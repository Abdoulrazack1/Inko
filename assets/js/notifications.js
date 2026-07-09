// notifications.js — Page dédiée des notifications (audit §6.1)
(function () {
    'use strict';

    const ICONS = { reply: '💬', mention: '@', chapter: '📖', badge: '🏅', system: '🔔' };
    let items = [];
    let filter = 'all';

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

        document.getElementById('ntFilters').addEventListener('click', (e) => {
            const b = e.target.closest('.nt-pill'); if (!b) return;
            filter = b.dataset.f;
            document.querySelectorAll('.nt-pill').forEach(p => p.classList.toggle('active', p === b));
            render();
        });
        document.getElementById('ntEnablePush')?.addEventListener('click', () => window.MH.enablePush?.());
        document.getElementById('ntMarkAll').addEventListener('click', async () => {
            try { await API.notifications.markAll(); items.forEach(n => { n.read = true; }); render(); MH.toast?.('Tout est lu ✓'); }
            catch (e) { MH.toast?.('Erreur : ' + e.message); }
        });

        await load();
    });

    async function load() {
        try { items = (await API.notifications.list(100)).items || []; }
        catch (e) { items = []; }
        render();
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
        let shown = items;
        if (filter === 'unread') shown = items.filter(n => !n.read);
        else if (filter !== 'all') shown = items.filter(n => n.type === filter);
        if (!shown.length) {
            list.innerHTML = `<div class="nt-empty">Aucune notification${filter !== 'all' ? ' dans ce filtre' : ''}.</div>`;
            return;
        }
        list.innerHTML = shown.map(n => `
            <a class="nt-item ${n.read ? '' : 'unread'}" href="${MH.esc(n.link || '#')}" data-nid="${n.id}">
                <div class="nt-ico">${ICONS[n.type] || '🔔'}</div>
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
