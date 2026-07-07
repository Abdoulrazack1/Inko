// admin.js — Dashboard d'administration (role=admin)
(function () {
    'use strict';

    let activeTab = 'reports';

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('admin');
        const body = document.getElementById('adBody');

        if (!API.isLoggedIn()) {
            body.innerHTML = deny('Connexion requise', 'Connecte-toi avec un compte administrateur.');
            return;
        }
        if (API.user?.role !== 'admin') {
            body.innerHTML = deny('Accès réservé', "Ton compte n'a pas les droits d'administration.");
            return;
        }
        try {
            const stats = await API.admin.stats();
            render(body, stats);
        } catch (e) {
            body.innerHTML = `<div class="ad-deny" style="color:#ef4444">Erreur : ${MH.esc(e.message)}</div>`;
        }
    });

    function deny(title, msg) {
        return `<div class="ad-deny">
            <div style="font-size:16px;color:var(--text);font-weight:600;margin-bottom:8px">${MH.esc(title)}</div>
            <div style="margin-bottom:16px">${MH.esc(msg)}</div>
            <a href="accueil.html" class="btn btn-primary">Retour à l'accueil</a></div>`;
    }

    function render(body, stats) {
        const t = stats.totals || {};
        const cards = [
            ['', t.users || 0, 'Utilisateurs'],
            ['', t.users_week || 0, 'Inscrits (7 j)'],
            [t.open_reports > 0 ? 'alert' : '', t.open_reports || 0, 'Signalements'],
            ['', t.comments || 0, 'Commentaires'],
            ['', t.reads_total || 0, 'Chapitres lus'],
            ['', t.banned || 0, 'Bannis'],
        ];
        body.innerHTML = `
            <div class="ad-cards">
                ${cards.map(([c, v, l]) => `<div class="ad-card ${c}"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('')}
            </div>
            <div class="ad-tabs">
                <button class="ad-tab ${activeTab === 'reports' ? 'active' : ''}" data-tab="reports">Modération ${t.open_reports ? `(${t.open_reports})` : ''}</button>
                <button class="ad-tab ${activeTab === 'users' ? 'active' : ''}" data-tab="users">Utilisateurs</button>
                <button class="ad-tab ${activeTab === 'sources' ? 'active' : ''}" data-tab="sources">Sources</button>
            </div>
            <div id="adTabBody"></div>`;
        body.querySelectorAll('.ad-tab').forEach(b => b.addEventListener('click', () => {
            activeTab = b.dataset.tab;
            body.querySelectorAll('.ad-tab').forEach(x => x.classList.toggle('active', x === b));
            loadTab();
        }));
        loadTab();
    }

    function loadTab() {
        if (activeTab === 'reports') loadReports();
        else if (activeTab === 'sources') loadSources();
        else loadUsers();
    }

    // ── Statut des sources (audit §7.3 rec 3) ──
    async function loadSources() {
        const el = document.getElementById('adTabBody');
        el.innerHTML = `<div class="ad-empty"><div class="spinner-inline"></div></div>`;
        let rows = [];
        try { rows = await API.sources.health(); } catch (e) {
            el.innerHTML = `<div class="ad-panel"><div class="ad-empty" style="color:#ef4444">Erreur : ${MH.esc(e.message)}</div></div>`;
            return;
        }
        if (!rows.length) { el.innerHTML = `<div class="ad-panel"><div class="ad-empty">Aucune source installée.</div></div>`; return; }
        // Cassées d'abord (échecs consécutifs), puis le reste
        rows.sort((a, b) => (b.streak || 0) - (a.streak || 0));
        const when = (ts) => ts ? MH.relTime(new Date(ts).toISOString?.() || ts) : '—';
        const dot = (r) => {
            if (r.streak >= 3) return ['#ef4444', 'cassée'];
            if (r.streak > 0)  return ['#f59e0b', 'instable'];
            if (r.okAt)        return ['#22c55e', 'OK'];
            return ['#9ca3af', 'jamais testée'];
        };
        el.innerHTML = `<div class="ad-panel">${rows.map(r => {
            const [color, label] = dot(r);
            return `
            <div class="ad-row" data-src="${MH.esc(r.id)}">
                <div class="grow">
                    <div style="font-weight:600;color:var(--text)">
                        <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${color};margin-right:7px"></span>
                        ${MH.esc(r.name || r.id)} <span class="ad-muted" style="font-weight:400">· ${label}</span>
                    </div>
                    <div class="ad-muted" style="margin-top:4px">
                        ${r.okAt ? `dernier succès ${when(r.okAt)}` : 'aucun succès enregistré'}
                        ${r.streak ? ` · <span style="color:#ef4444">${r.streak} échec(s) consécutif(s)</span>` : ''}
                        ${r.error ? `<br><span style="color:#ef4444">Dernière erreur : ${MH.esc(r.error)}</span>` : ''}
                    </div>
                </div>
                <button class="btn btn-sm" data-test="${MH.esc(r.id)}">Tester</button>
            </div>`;
        }).join('')}</div>`;
        el.querySelectorAll('[data-test]').forEach(btn => btn.addEventListener('click', async () => {
            btn.disabled = true; const prev = btn.textContent; btn.textContent = '…';
            try {
                const res = await API.sources.test(btn.dataset.test);
                MH.toast?.(res.ok ? `✓ ${btn.dataset.test} répond (${res.count})` : `✗ ${res.error || 'échec'}`);
                loadSources();   // rafraîchit la santé après le test
            } catch (e) { MH.toast?.('Erreur : ' + e.message); btn.disabled = false; btn.textContent = prev; }
        }));
    }

    // ── Modération ──
    async function loadReports() {
        const el = document.getElementById('adTabBody');
        el.innerHTML = `<div class="ad-empty"><div class="spinner-inline"></div></div>`;
        let reports = [];
        try { reports = await API.admin.reports('open'); } catch (e) {}
        if (!reports.length) {
            el.innerHTML = `<div class="ad-panel"><div class="ad-empty">Aucun signalement en attente. 🎉</div></div>`;
            return;
        }
        el.innerHTML = `<div class="ad-panel">${reports.map(r => `
            <div class="ad-row" data-report="${r.id}">
                <div class="grow">
                    <div style="white-space:pre-wrap">${r.commentText ? MH.esc(r.commentText) : '<em class="ad-muted">(commentaire supprimé)</em>'}</div>
                    <div class="ad-muted" style="margin-top:4px">
                        par <a href="u.html?u=${encodeURIComponent(r.author || '')}" style="color:var(--text2)">${MH.esc(r.author || '?')}</a>
                        · signalé par ${MH.esc(r.reporter || '?')}${r.reportCount > 1 ? ` · ${r.reportCount}×` : ''}
                        ${r.reason ? ` · motif : ${MH.esc(r.reason)}` : ''}
                    </div>
                </div>
                <button class="btn btn-sm" data-action="dismiss" title="Ignorer le signalement">Ignorer</button>
                <button class="btn btn-sm" data-action="delete" style="background:#ef4444;color:#fff;border-color:#ef4444" title="Supprimer le commentaire">Supprimer</button>
            </div>`).join('')}</div>`;
        el.querySelectorAll('.ad-row').forEach(row => {
            const id = row.dataset.report;
            row.querySelectorAll('[data-action]').forEach(btn => btn.addEventListener('click', async () => {
                btn.disabled = true;
                try {
                    await API.admin.resolveReport(id, btn.dataset.action);
                    row.style.transition = 'opacity .2s'; row.style.opacity = '0';
                    setTimeout(() => { row.remove(); if (!el.querySelector('.ad-row')) loadReports(); }, 200);
                    MH.toast?.(btn.dataset.action === 'delete' ? 'Commentaire supprimé' : 'Signalement ignoré');
                } catch (e) { MH.toast?.('Erreur : ' + e.message); btn.disabled = false; }
            }));
        });
    }

    // ── Utilisateurs ──
    let userSearchTimer = null;
    async function loadUsers(q = '') {
        const el = document.getElementById('adTabBody');
        if (!el.querySelector('#adUserSearch')) {
            el.innerHTML = `<input type="text" id="adUserSearch" class="ad-input" placeholder="Rechercher par nom ou email…"><div id="adUserList"></div>`;
            el.querySelector('#adUserSearch').addEventListener('input', (e) => {
                clearTimeout(userSearchTimer);
                userSearchTimer = setTimeout(() => loadUsers(e.target.value.trim()), 300);
            });
        }
        const list = el.querySelector('#adUserList');
        list.innerHTML = `<div class="ad-empty"><div class="spinner-inline"></div></div>`;
        let users = [];
        try { users = await API.admin.users(q); } catch (e) {}
        if (!users.length) { list.innerHTML = `<div class="ad-panel"><div class="ad-empty">Aucun utilisateur.</div></div>`; return; }
        const meId = API.user?.id;
        list.innerHTML = `<div class="ad-panel">${users.map(u => `
            <div class="ad-row" data-user="${u.id}">
                <div class="grow">
                    <div><a href="u.html?u=${encodeURIComponent(u.username)}" style="color:var(--text);font-weight:600">${MH.esc(u.username)}</a>
                        ${u.role === 'admin' ? '<span class="tag admin">admin</span>' : ''}
                        ${u.banned ? '<span class="tag ban">banni</span>' : ''}</div>
                    <div class="ad-muted">${MH.esc(u.email)} · ${u.chaptersRead} ch. lus · ${u.comments} com.</div>
                </div>
                ${u.id === meId ? '<span class="ad-muted">toi</span>' : `
                    <button class="btn btn-sm" data-role="${u.role === 'admin' ? 'user' : 'admin'}">${u.role === 'admin' ? 'Retirer admin' : 'Promouvoir'}</button>
                    <button class="btn btn-sm" data-ban="${u.banned ? '0' : '1'}" style="${u.banned ? '' : 'color:#ef4444'}">${u.banned ? 'Débannir' : 'Bannir'}</button>`}
            </div>`).join('')}</div>`;
        list.querySelectorAll('.ad-row').forEach(row => {
            const id = row.dataset.user;
            row.querySelector('[data-role]')?.addEventListener('click', async (e) => {
                e.target.disabled = true;
                try { await API.admin.setRole(id, e.target.dataset.role); MH.toast?.('Rôle mis à jour'); loadUsers(q); }
                catch (er) { MH.toast?.('Erreur : ' + er.message); e.target.disabled = false; }
            });
            row.querySelector('[data-ban]')?.addEventListener('click', async (e) => {
                const ban = e.target.dataset.ban === '1';
                if (ban && !confirm('Bannir cet utilisateur ? Il ne pourra plus se connecter.')) return;
                e.target.disabled = true;
                try { await API.admin.setBan(id, ban); MH.toast?.(ban ? 'Utilisateur banni' : 'Utilisateur débanni'); loadUsers(q); }
                catch (er) { MH.toast?.('Erreur : ' + er.message); e.target.disabled = false; }
            });
        });
    }
})();
