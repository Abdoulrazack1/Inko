// u.js — Profil public (u.html?u=username)
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('');
        const body = document.getElementById('upBody');
        const username = new URLSearchParams(location.search).get('u');
        if (!username) { body.innerHTML = msg('Profil introuvable', "Aucun nom d'utilisateur fourni."); return; }

        let p;
        try { p = await API.users.profile(username); }
        catch (e) {
            body.innerHTML = msg('Profil introuvable', `Aucun utilisateur nommé « ${MH.esc(username)} ».`);
            return;
        }
        render(body, p);
    });

    function msg(title, m) {
        return `<div class="up-msg">
            <div style="font-size:16px;color:var(--text);font-weight:600;margin-bottom:8px">${MH.esc(title)}</div>
            <div>${MH.esc(m)}</div></div>`;
    }

    function avatarHtml(p) {
        const a = p.avatar || (p.username || '?')[0].toUpperCase();
        return /^https?:\/\//.test(a) ? `<img src="${MH.esc(a)}" alt="">` : MH.esc(a);
    }

    function render(body, p) {
        const since = p.memberSince ? new Date(p.memberSince).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long' }) : '';
        const top = `
            <div class="up-top">
                <div class="up-avatar">${avatarHtml(p)}</div>
                <div>
                    <div class="up-name">${MH.esc(p.username)}${p.isOwner ? ' <span style="font-size:12px;color:var(--text3);font-weight:400">(toi)</span>' : ''}</div>
                    ${since ? `<div class="up-since">Membre depuis ${since}</div>` : ''}
                    ${p.bio ? `<div class="up-bio">${MH.esc(p.bio)}</div>` : ''}
                </div>
            </div>`;

        if (p.hidden) {
            body.innerHTML = top + `<div class="up-panel"><div class="up-msg" style="padding:30px 20px">🔒 Ce profil est privé.</div></div>`;
            return;
        }

        const s = p.stats || {};
        const cards = [
            ['accent', s.chapters || 0, 'Chapitres lus'],
            ['', s.series || 0, 'Séries'],
            ['', s.favorites || 0, 'Favoris'],
            ['accent', s.streak || 0, "Jours d'affilée"],
            ['', s.ratings || 0, 'Notes'],
        ];
        const badges = (p.badges || []);
        body.innerHTML = top + `
            <div class="up-cards">
                ${cards.map(([c, v, l]) => `<div class="up-card ${c}"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('')}
            </div>
            <div class="up-panel">
                <h2>Badges ${badges.length ? `<span style="color:var(--text3);font-weight:400">${badges.length}</span>` : ''}</h2>
                ${badges.length
                    ? `<div class="up-badges">${badges.map(b => `<div class="up-badge" title="${MH.esc(b.name)}"><span class="ic">${b.icon}</span><span class="nm">${MH.esc(b.name)}</span></div>`).join('')}</div>`
                    : `<div class="up-msg" style="padding:20px">Aucun badge pour l'instant.</div>`}
            </div>`;
    }
})();
