// ux-ecrans — chaque écran vu comme un lecteur le voit en arrivant : hiérarchie, place
// perdue avant le contenu, longueur des lignes, images abîmées, densité, mouvement.
'use strict';
const U = require('./_ux');

module.exports = {
    nom: 'ux-ecrans',
    description: 'Premier écran de chaque page : titre, action principale, place avant le contenu, lisibilité, images, densité, mouvement',
    async run(ctx) {
        const b = await U.banc(ctx, { base: 'inko_ux_ecr', port: 8131 });
        if (!b) return;
        const releves = {};
        const T = (dimension, gravite, id, f, titre, detail, correctif, effort = 'S') => ctx.trouver({ gravite, id, dimension, categorie: 'ux', titre, detail, correctif, effort, fichier: f });
        try {
            for (const profil of ['bureau', 'mobile']) {
                await U.visiter(b, profil, async (f, p) => {
                    await U.outiller(p);
                    const r = await p.evaluate(() => {
                        const u = window.__ux; const H = innerHeight;
                        const premier = (e) => { const r = e.getBoundingClientRect(); return r.top < H && r.bottom > 0 && r.width > 4; };
                        const tous = [...document.querySelectorAll('body *')].filter(e => !u.hors(e) && u.vis(e));
                        const h1 = tous.filter(e => e.tagName === 'H1');
                        const principales = tous.filter(e => e.matches('.btn-primary') && premier(e)).map(e => e.textContent.trim().slice(0, 28));
                        const main = document.querySelector('main') || document.body;
                        const contenu = [...main.querySelectorAll('img,.manga-card,.lib2-card,p,li,table,.reader-page-wrapper,input,article')].filter(e => !u.hors(e) && u.vis(e) && e.getBoundingClientRect().height > 12 && !e.closest('header,nav,.reader-toolbar,.toolbar,#header-slot'));
                        const debut = contenu.length ? Math.min(...contenu.map(e => e.getBoundingClientRect().top + scrollY)) : null;
                        const longues = [], serrees = [];
                        for (const e of tous) {
                            if (!u.texte(e)) continue; const t = e.textContent.trim(); if (t.length < 100) continue;
                            const c = getComputedStyle(e), r = e.getBoundingClientRect(), fs = parseFloat(c.fontSize);
                            const parLigne = Math.round(r.width / (fs * .5));
                            if (parLigne > 95 && r.height > fs * 2) longues.push(`${parLigne} signes — ${u.nom(e)}`);
                            const lh = parseFloat(c.lineHeight); if (lh && r.height > lh * 1.8 && lh / fs < 1.32) serrees.push(`${(lh / fs).toFixed(2)} — ${u.nom(e)}`);
                        }
                        const deformees = [], floues = [];
                        for (const i of document.images) {
                            if (!u.vis(i) || !i.naturalWidth || u.hors(i) || /^data:image\/svg/.test(i.currentSrc)) continue;
                            const r = i.getBoundingClientRect(); if (r.width < 24) continue; const c = getComputedStyle(i);
                            const ecart = Math.abs((r.width / r.height) / (i.naturalWidth / i.naturalHeight) - 1);
                            if (c.objectFit === 'fill' && ecart > .06) deformees.push(`${Math.round(ecart * 100)} % — ${u.nom(i)}`);
                            if (i.naturalWidth < r.width * .85) floues.push(`${i.naturalWidth} px affichés sur ${Math.round(r.width)} — ${u.nom(i)}`);
                        }
                        const tailles = new Set(tous.filter(e => u.texte(e) && premier(e)).map(e => Math.round(parseFloat(getComputedStyle(e).fontSize))));
                        const interactifs = tous.filter(e => e.matches('a[href],button,input,select,textarea,[role=button]') && premier(e)).length;
                        const mouvement = document.getAnimations().filter(a => { const t = a.effect && a.effect.getTiming(); return a.playState === 'running' && t && t.iterations === Infinity && t.duration > 1; }).map(a => (a.animationName || 'animation') + ' — ' + (a.effect.target ? u.nom(a.effect.target) : '?'));
                        const tronques = tous.filter(e => premier(e) && e.matches('h1,h2,h3,.manga-card-title,.lib2-title,button') && getComputedStyle(e).textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 4).map(u.nom);
                        return { h1: h1.length, h1Visible: h1.some(premier), principales, debut, H, longues: longues.slice(0, 5), serrees: serrees.slice(0, 5), deformees: deformees.slice(0, 6), floues: floues.slice(0, 6), tailles: [...tailles].sort((a, b) => a - b), interactifs, mouvement: [...new Set(mouvement)].slice(0, 6), tronques: tronques.length, hauteur: document.documentElement.scrollHeight };
                    });
                    releves[`${f} (${profil})`] = r;
                    const lecteur = /chapitre|lecture|localreader/.test(f);
                    if (!lecteur && !r.h1Visible) T('hierarchie', 'moyenne', 'UX-ECR-SANS-TITRE', f, `${f} (${profil}) : aucun titre de page visible à l'arrivée`, `${r.h1} titre(s) de niveau 1 dans la page`, 'Un h1 visible qui dit où l\'on est.');
                    if (r.principales.length > 1) T('hierarchie', r.principales.length > 3 ? 'haute' : 'moyenne', 'UX-ECR-ACTIONS', f, `${f} (${profil}) : ${r.principales.length} actions « principales » se disputent le premier écran`, r.principales.join('\n'), 'Une seule action pleine par écran ; les autres en secondaire.');
                    if (!lecteur && r.debut !== null && r.debut > r.H * (profil === 'mobile' ? .5 : .45)) T('hierarchie', r.debut > r.H * .75 ? 'haute' : 'moyenne', 'UX-ECR-CONTENU-BAS', f, `${f} (${profil}) : le contenu commence à ${Math.round(r.debut)} px, soit ${Math.round(r.debut / r.H * 100)} % de l'écran`, '', 'Réduire les en-têtes, regrouper les filtres, faire remonter le contenu.', 'M');
                    if (r.longues.length) T('hierarchie', 'basse', 'UX-ECR-LIGNE-LONGUE', f, `${f} (${profil}) : lignes de plus de 95 signes`, r.longues.join('\n'), 'max-width: 70ch sur le texte courant.');
                    if (r.serrees.length) T('hierarchie', 'basse', 'UX-ECR-INTERLIGNE', f, `${f} (${profil}) : paragraphes serrés (interligne < 1,32)`, r.serrees.join('\n'), 'line-height: 1.5.');
                    if (r.deformees.length) T('rendu', 'moyenne', 'UX-ECR-IMAGE-DEFORMEE', f, `${f} (${profil}) : ${r.deformees.length} image(s) étirée(s)`, r.deformees.join('\n'), 'object-fit: cover.');
                    if (r.floues.length) T('rendu', 'basse', 'UX-ECR-IMAGE-FLOUE', f, `${f} (${profil}) : image(s) affichée(s) plus grande(s) que leur définition`, r.floues.join('\n'), 'Demander la bonne taille de couverture.');
                    if (r.tailles.length > 7) T('hierarchie', 'basse', 'UX-ECR-TAILLES', f, `${f} (${profil}) : ${r.tailles.length} tailles de texte sur un seul écran`, r.tailles.join(', ') + ' px', 'Quatre ou cinq niveaux suffisent.');
                    if (profil === 'mobile' && r.interactifs > 45) T('hierarchie', 'moyenne', 'UX-ECR-DENSITE', f, `${f} : ${r.interactifs} éléments touchables sur un seul écran de téléphone`, '', 'Regrouper dans des menus, agrandir les cibles.', 'M');
                    if (r.mouvement.length) T('accessibilite', 'moyenne', 'UX-ECR-MOUVEMENT', f, `${f} (${profil}) : animation(s) sans fin malgré « réduire les animations »`, r.mouvement.join('\n'), 'Les arrêter sous prefers-reduced-motion.');
                    if (r.hauteur > r.H * 25) T('navigation', 'basse', 'UX-ECR-INTERMINABLE', f, `${f} (${profil}) : page de ${Math.round(r.hauteur / r.H)} écrans de haut`, '', 'Pagination, sections repliables ou retour en haut toujours accessible.', 'M');
                });
            }
            ctx.mesure('ecrans_releves', releves);
        } finally { await b.fermer(); }
    },
};
