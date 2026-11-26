// ux-coherence — le design system est-il respecté À L'ÉCRAN ? Les styles calculés de chaque
// page sont comparés aux échelles du projet : textes, rayons, espacements, durées, polices,
// et le nombre de formes différentes qu'un même composant prend d'une page à l'autre.
'use strict';
const U = require('./_ux');

module.exports = {
    nom: 'ux-coherence',
    description: 'Respect à l\'écran des échelles de design et nombre de variantes d\'un même composant',
    async run(ctx) {
        const ech = U.echelles(ctx);
        const b = await U.banc(ctx, { base: 'inko_ux_coh', port: 8130 });
        if (!b) return;
        const T = (gravite, id, titre, detail, correctif, extra = {}) => ctx.trouver({ gravite, id, dimension: 'coherence', categorie: 'ux', titre, detail, correctif, effort: 'M', ...extra });
        const boutons = new Map(), champs = new Map(), couleurs = new Map(), ombres = new Map(), polices = new Map(), titres = new Map();
        const horsEchelle = { texte: new Map(), rayon: new Map(), espace: new Map(), duree: new Map() };
        const noter = (m, k, page, ex) => { const x = m.get(k) || { n: 0, pages: new Set(), ex: new Set() }; x.n++; x.pages.add(page); if (ex && x.ex.size < 4) x.ex.add(ex); m.set(k, x); };
        const parPage = {};
        try {
            for (const profil of ['bureau', 'mobile']) {
                await U.visiter(b, profil, async (f, p) => {
                    await U.outiller(p);
                    const r = await p.evaluate((ech) => {
                        const u = window.__ux; const s = { texte: [], rayon: [], espace: [], duree: [], boutons: [], champs: [], couleurs: [], ombres: [], polices: [], titres: [], n: { textes: 0, boites: 0 } };
                        const proche = (v, l, t = .6) => l.some(x => Math.abs(x - v) <= t);
                        for (const e of document.querySelectorAll('body *')) {
                            if (u.hors(e) || !u.vis(e)) continue;
                            const c = getComputedStyle(e);
                            if (u.texte(e)) {
                                s.n.textes++; const t = parseFloat(c.fontSize);
                                if (!proche(t, ech.textes)) s.texte.push([Math.round(t * 10) / 10 + 'px', u.nom(e)]);
                                s.couleurs.push(c.color); s.polices.push(c.fontFamily.split(',')[0].replace(/["']/g, '').trim().toLowerCase());
                                if (/^H[1-3]$/.test(e.tagName)) s.titres.push([e.tagName + ' ' + Math.round(t) + 'px ' + c.fontWeight, u.nom(e)]);
                            }
                            const boite = c.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(c.borderTopWidth) > 0 || c.boxShadow !== 'none';
                            if (boite) {
                                s.n.boites++; const ray = c.borderTopLeftRadius; const v = parseFloat(ray);
                                if (!ray.includes('%') && v < 99 && !proche(v, ech.rayons, .4)) s.rayon.push([v + 'px', u.nom(e)]);
                                if (c.boxShadow !== 'none') s.ombres.push(c.boxShadow.replace(/color\([^)]*\)|rgba?\([^)]*\)/g, '·').trim());
                            }
                            for (const k of ['paddingTop', 'paddingLeft', 'rowGap', 'columnGap']) { const v = parseFloat(c[k]); if (v > 0 && v < 100 && !proche(v, ech.espaces, .5)) s.espace.push([Math.round(v * 10) / 10 + 'px', u.nom(e)]); }
                            for (const d of c.transitionDuration.split(',')) { const ms = Math.round(parseFloat(d) * (d.includes('ms') ? 1 : 1000)); if (ms > 1 && !proche(ms, ech.durees, 1)) s.duree.push([ms + ' ms', u.nom(e)]); }
                            if (e.matches('button,a.btn,[role=button],input[type=submit]') && e.textContent.trim()) { const r = e.getBoundingClientRect(); s.boutons.push([`${Math.round(r.height)} px · rayon ${c.borderTopLeftRadius} · ${Math.round(parseFloat(c.fontSize))} px/${c.fontWeight} · ${c.textTransform === 'uppercase' ? 'majuscules' : 'bas de casse'}`, u.nom(e) + ' « ' + e.textContent.trim().slice(0, 20) + ' »']); }
                            if (e.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]):not([type=file]),select,textarea')) { const r = e.getBoundingClientRect(); s.champs.push([`${Math.round(r.height)} px · rayon ${c.borderTopLeftRadius} · ${Math.round(parseFloat(c.fontSize))} px`, u.nom(e)]); }
                        }
                        return s;
                    }, ech);
                    const ou = `${f} (${profil})`;
                    for (const [k, v] of Object.entries(horsEchelle)) for (const [val, ex] of r[k]) noter(v, val, f, ex);
                    for (const [k, ex] of r.boutons) noter(boutons, k, f, ex);
                    for (const [k, ex] of r.champs) noter(champs, k, f, ex);
                    for (const k of r.couleurs) noter(couleurs, k, f);
                    for (const k of r.ombres) noter(ombres, k, f);
                    for (const k of r.polices) noter(polices, k, f);
                    for (const [k, ex] of r.titres) noter(titres, k, f, ex);
                    const taux = { texte: r.n.textes ? r.texte.length / r.n.textes : 0, rayon: r.n.boites ? r.rayon.length / r.n.boites : 0, espace: r.espace.length, duree: r.duree.length };
                    parPage[ou] = { textesHorsEchelle: Math.round(taux.texte * 100) + ' %', rayonsHorsEchelle: Math.round(taux.rayon * 100) + ' %', espacements: taux.espace };
                    if (taux.texte > .08 && r.texte.length > 5) T(taux.texte > .25 ? 'haute' : 'moyenne', 'UX-COH-TEXTE', `${f} (${profil}) : ${Math.round(taux.texte * 100)} % des textes hors de l'échelle typographique`, [...new Map(r.texte.map(([v, e]) => [e, v]))].slice(0, 12).map(([e, v]) => `${v} — ${e}`).join('\n') + `\n\nÉchelle : ${ech.textes.join(', ')} px`, 'Utiliser les jetons --t-*.', { fichier: f, effort: 'S' });
                    if (taux.rayon > .1 && r.rayon.length > 4) T('basse', 'UX-COH-RAYON', `${f} (${profil}) : ${Math.round(taux.rayon * 100)} % des rayons hors de l'échelle`, [...new Map(r.rayon.map(([v, e]) => [e, v]))].slice(0, 10).map(([e, v]) => `${v} — ${e}`).join('\n') + `\n\nÉchelle : ${ech.rayons.join(', ')} px`, 'Utiliser les jetons --r-*.', { fichier: f, effort: 'S' });
                });
            }
            const classer = (m) => [...m].sort((a, b) => b[1].n - a[1].n);
            const lignes = (m, n = 18) => classer(m).slice(0, n).map(([k, x]) => `${k} — ${x.n} fois, ${x.pages.size} page(s)${x.ex.size ? ' · ex. ' + [...x.ex].slice(0, 2).join(' ; ') : ''}`).join('\n');
            if (horsEchelle.espace.size > 10) T('moyenne', 'UX-COH-ESPACEMENT', `${horsEchelle.espace.size} valeurs d'espacement hors de l'échelle`, lignes(horsEchelle.espace) + `\n\nÉchelle : ${ech.espaces.join(', ')} px`, 'Ramener chaque valeur au jeton --sp-* le plus proche.', { effort: 'L' });
            if (horsEchelle.duree.size > 3) T('basse', 'UX-COH-DUREE', `${horsEchelle.duree.size} durées d'animation hors des trois rythmes du projet`, lignes(horsEchelle.duree), 'Utiliser --transition, --transition2, --transition3.');
            if (boutons.size > 14) T(boutons.size > 30 ? 'haute' : 'moyenne', 'UX-COH-BOUTONS', `Les boutons prennent ${boutons.size} formes différentes`, lignes(boutons, 24), 'Trois tailles et quatre variantes, un seul composant.', { effort: 'L' });
            if (champs.size > 5) T('moyenne', 'UX-COH-CHAMPS', `Les champs de saisie prennent ${champs.size} formes différentes`, lignes(champs), 'Deux tailles de champ.', { effort: 'M' });
            const hTitres = [...titres.keys()].filter(k => k.startsWith('H1')); if (hTitres.length > 2) T('moyenne', 'UX-COH-TITRES', `Le titre principal change de taille ou de graisse selon la page (${hTitres.length} formes)`, lignes(titres), 'Un seul style de titre de page.', { effort: 'S' });
            if (couleurs.size > 18) T('basse', 'UX-COH-COULEURS', `${couleurs.size} couleurs de texte différentes à l'écran`, lignes(couleurs, 25), 'Se limiter aux encres du thème et aux accents.');
            if (ombres.size > 7) T('basse', 'UX-COH-OMBRES', `${ombres.size} ombres différentes (le projet en définit cinq)`, lignes(ombres, 14), 'Utiliser les jetons --e-*.');
            const etrangeres = [...polices.keys()].filter(x => !ech.polices.some(y => x.includes(y) || y.includes(x)) && !/system-ui|ui-monospace|segoe|cascadia|consolas|georgia|sans-serif|serif|monospace|-apple/.test(x));
            if (etrangeres.length) T('moyenne', 'UX-COH-POLICE', `Police hors du projet à l'écran : ${etrangeres.join(', ')}`, etrangeres.map(x => x + ' — ' + [...polices.get(x).pages].join(', ')).join('\n'), 'Hériter de --font-body.', { effort: 'S' });
            ctx.mesure('coherence_echelles', ech);
            ctx.mesure('coherence_variantes', { boutons: boutons.size, champs: champs.size, couleursDeTexte: couleurs.size, ombres: ombres.size, polices: [...polices.keys()], espacementsHorsEchelle: horsEchelle.espace.size, taillesHorsEchelle: horsEchelle.texte.size });
            ctx.mesure('coherence_par_page', parPage);
        } finally { await b.fermer(); }
    },
};
