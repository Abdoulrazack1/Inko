// u.js — Profil public (u.html?u=username)
(function () {
    'use strict';

    document.addEventListener('DOMContentLoaded', async () => {
        MH.initPage('');
        const body = document.getElementById('upBody');
        const username = new URLSearchParams(location.search).get('u');
        if (!username) { body.innerHTML = msg('Profil introuvable', "Aucun nom d'utilisateur fourni."); return; }

        // ?preview=1 : voir son propre profil comme un inconnu (audit AMEL-62)
        const apercu = new URLSearchParams(location.search).get('preview') === '1';
        let p;
        try { p = await API.users.profile(username, { preview: apercu }); }
        catch (e) {
            body.innerHTML = msg('Profil introuvable', `Aucun utilisateur nommé « ${MH.esc(username)} ».`);
            return;
        }
        // A11Y-01 : le titre lu porte le pseudo. Sans ca, tous les profils
        // publics s'annoncent « Profil public ».
        const hA11y = document.getElementById('profilTitreA11y');
        if (hA11y) hA11y.textContent = `Profil de ${p.username || username}`;

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
            // Le bandeau d'apercu passe AVANT le cadenas : c'est justement
            // quand tout est masque qu'on a besoin de savoir pourquoi et
            // comment revenir.
            body.innerHTML = top + bandeauApercu(p)
                + `<div class="up-panel"><div class="up-msg" style="padding:30px 20px">🔒 Ce profil est privé.</div></div>`;
            return;
        }

        const s = p.stats;
        const cards = s ? [
            ['accent', s.chapters || 0, 'Chapitres lus'],
            ['', s.series || 0, 'Séries'],
            ['', s.favorites || 0, 'Favoris'],
            ['accent', s.streak || 0, "Jours d'affilée"],
            ['', s.ratings || 0, 'Notes'],
        ] : [];
        const badges = (p.badges || []);
        const pins = p.pins || [];
        const lists = p.lists || [];

        body.innerHTML = top + bandeauApercu(p) + `
            ${cards.length ? `<div class="up-cards">
                ${cards.map(([c, v, l]) => `<div class="up-card ${c}"><div class="v">${v}</div><div class="l">${l}</div></div>`).join('')}
            </div>` : ''}
            ${vitrine(pins)}
            ${s ? `<div class="up-panel">
                <h2>Badges ${badges.length ? `<span style="color:var(--text3);font-weight:400">${badges.length}</span>` : ''}</h2>
                ${badges.length
        ? `<div class="up-badges">${badges.map(b => `<div class="up-badge" title="${MH.esc(b.name)}"><span class="ic">${b.icon}</span><span class="nm">${MH.esc(b.name)}</span></div>`).join('')}</div>`
        : `<div class="up-msg" style="padding:20px">Aucun badge pour l'instant.</div>`}
            </div>` : ''}
            ${listesHtml(lists)}
            ${bibliothequeHtml(p.library)}
            ${sectionsMasquees(p)}`;
    }

    // Audit AMEL-62 : dire clairement qu'on regarde en tant qu'inconnu, et
    // comment en sortir. Sans ce bandeau, l'aperçu se confond avec la vraie
    // page et on croit avoir tout masqué alors qu'on n'a fait que regarder.
    function bandeauApercu(p) {
        if (!p.preview) return '';
        return `<div class="up-panel" style="border-color:var(--orange);display:flex;align-items:center;gap:12px;flex-wrap:wrap">
            <div style="flex:1;min-width:220px;font-size:13px;color:var(--text2)">
                <strong style="color:var(--text)">Aperçu public</strong> — voici exactement ce que voit une personne qui n'est pas connectée.
            </div>
            <a class="btn btn-sm" href="u.html?u=${encodeURIComponent(p.username)}">Revenir à ma vue</a>
        </div>`;
    }

    // Audit AMEL-63 : la vitrine passe AVANT les badges. C'est le seul contenu
    // choisi du profil ; les compteurs, eux, se remplissent tout seuls.
    function vitrine(pins) {
        if (!pins.length) return '';
        return `<div class="up-panel">
            <h2>Séries épinglées <span style="color:var(--text3);font-weight:400">${pins.length}</span></h2>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:12px;margin-top:12px">
                ${pins.map(m => `<a href="serie.html?id=${encodeURIComponent(m.mangaId)}&source=${encodeURIComponent(m.source)}"
                    style="text-decoration:none;color:inherit">
                    <img src="${MH.cover(m.cover)}" alt="" loading="lazy"
                         style="width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:8px;background:var(--bg3)">
                    <div style="font-size:11.5px;margin-top:5px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${MH.esc(m.title)}</div>
                </a>`).join('')}
            </div>
        </div>`;
    }

    // Les listes publiques étaient renvoyées par l'API depuis BUG-09 mais
    // cette page ne les affichait nulle part : marquer une liste « publique »
    // ne la rendait toujours visible sur aucun écran.
    function listesHtml(lists) {
        if (!lists.length) return '';
        return `<div class="up-panel">
            <h2>Listes publiques <span style="color:var(--text3);font-weight:400">${lists.length}</span></h2>
            <div style="display:flex;flex-direction:column;gap:8px;margin-top:12px">
                ${lists.map(l => `<a href="liste.html?id=${encodeURIComponent(l.id)}"
                    style="display:flex;justify-content:space-between;gap:12px;padding:11px 13px;background:var(--bg3);border:1px solid var(--border2);border-radius:10px;text-decoration:none;color:inherit">
                    <div style="min-width:0">
                        <div style="font-size:13.5px;font-weight:600">${MH.esc(l.name)}</div>
                        ${l.description ? `<div style="font-size:12px;color:var(--text3);margin-top:2px">${MH.esc(l.description)}</div>` : ''}
                    </div>
                    <div style="font-size:12px;color:var(--text3);white-space:nowrap">${l.items} série${l.items > 1 ? 's' : ''}</div>
                </a>`).join('')}
            </div>
        </div>`;
    }

    const ST = { reading: 'En cours', completed: 'Terminé', planned: 'À lire', paused: 'En pause', dropped: 'Abandonné' };
    function bibliothequeHtml(library) {
        if (!library || !library.length) return '';
        return `<div class="up-panel">
            <h2>Bibliothèque <span style="color:var(--text3);font-weight:400">${library.length}</span></h2>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(92px,1fr));gap:12px;margin-top:12px">
                ${library.map(m => `<a href="serie.html?id=${encodeURIComponent(m.mangaId)}&source=${encodeURIComponent(m.source)}"
                    style="text-decoration:none;color:inherit">
                    <img src="${MH.cover(m.cover)}" alt="" loading="lazy"
                         style="width:100%;aspect-ratio:2/3;object-fit:cover;border-radius:8px;background:var(--bg3)">
                    <div style="font-size:11.5px;margin-top:5px;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${MH.esc(m.title)}</div>
                    <div style="font-size:10px;color:var(--text3)">${ST[m.status] || ''}</div>
                </a>`).join('')}
            </div>
        </div>`;
    }

    // Audit AMEL-61 : le propriétaire doit savoir ce qu'il a masqué, sinon le
    // réglage devient invisible et on croit à une panne. Un visiteur, lui,
    // n'a pas à savoir qu'il existe des sections cachées.
    function sectionsMasquees(p) {
        if (!p.isOwner || !p.sections) return '';
        const noms = { stats: 'statistiques et badges', lists: 'listes publiques',
            library: 'bibliothèque', pins: 'séries épinglées' };
        const off = Object.keys(noms).filter(k => !p.sections[k]);
        if (!off.length) return '';
        return `<div class="up-panel" style="border-style:dashed">
            <div style="font-size:12.5px;color:var(--text3)">
                Masqué pour les autres : ${off.map(k => noms[k]).join(', ')}.
                <a href="profil.html#confidentialite" style="color:var(--orange)">Modifier</a>
            </div>
        </div>`;
    }
})();
