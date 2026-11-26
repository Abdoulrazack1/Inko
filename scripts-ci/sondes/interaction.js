// interaction — clavier, fenêtres et menus, saisies : ce que le clic simple ne voit pas
'use strict';
const fs = require('fs');
const path = require('path');
const E = require('./_explore');

const DIALOGUES = '[role=dialog],[aria-modal="true"],dialog[open],.mh-modal,.mh-feuille,[role=menu],.lib-pop,.mh-menu-carte,.mh-continue-menu,.reader-settings-pop,.novel-settings-pop,.novel-toc-pop,.signet-pop,.histo-menu';
const ouverts = (p) => p.evaluate((S) => [...document.querySelectorAll(S)].filter(e => { const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && e.getClientRects().length && +s.opacity > .1 && !e.closest('#inko-music'); }).length, DIALOGUES);

module.exports = {
    nom: 'interaction',
    description: 'Parcours au clavier (focus visible, pièges), ouverture de chaque menu et fenêtre, saisie dans chaque champ',
    async run(ctx) {
        const o = await E.ouvrir(ctx, { base: 'inko_s_inter', port: 8094 });
        if (!o) return;
        const { J, nav } = o;
        const axe = fs.readFileSync(path.join(ctx.racine, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
        try {
            const d = await E.semer(J);
            const oe = await E.oeuvresReelles(J);
            const liste = E.adresses(ctx, { ...d, ...oe }).filter(([f]) => f !== 'index.html');
            const totaux = { tabulations: 0, fenetres: 0, champs: 0 };
            for (const [f, u] of liste) {
                // « animations réduites » : sans cela, le défilement doux fait passer un élément
                // bien visible pour caché au moment de la mesure
                const c = await E.contexte(nav, J, { calme: true });
                const p = await c.newPage(); const s = E.surveiller(p);
                const aller = async () => { await p.goto(`${J.url}/${u}`, { waitUntil: 'load', timeout: 25000 }); await p.waitForTimeout(1800); };
                try {
                    await aller();
                    // ── 1. clavier ──
                    const vus = []; let invisibles = [], horsEcran = [];
                    for (let i = 0; i < 70; i++) {
                        await p.keyboard.press('Tab'); totaux.tabulations++;
                        await p.waitForTimeout(190);   // laisser finir les transitions d'apparition
                        const x = await p.evaluate(() => {
                            const e = document.activeElement; if (!e || e === document.body) return { k: 'body' };
                            const r = e.getBoundingClientRect(); const s = getComputedStyle(e);
                            const marque = (s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0) || s.boxShadow !== 'none' || getComputedStyle(e, '::after').boxShadow !== 'none';
                            const parent = e.parentElement && getComputedStyle(e.parentElement);
                            const marqueP = !!parent && ((parent.outlineStyle !== 'none' && parseFloat(parent.outlineWidth) > 0) || parent.boxShadow !== 'none');
                            let opacite = 1; for (let a = e; a && a !== document.documentElement; a = a.parentElement) opacite *= +getComputedStyle(a).opacity;
                            const visible = r.width > 1 && r.height > 1 && s.visibility !== 'hidden' && opacite > .05 && r.bottom > 0 && r.right > 0 && r.left < innerWidth && r.top < innerHeight;
                            const k = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/)[0] : '') + ' ' + (e.getAttribute('aria-label') || e.textContent || e.getAttribute('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 30);
                            return { k, marque: marque || marqueP, visible, id: [...document.querySelectorAll('*')].indexOf(e) };
                        });
                        if (x.k === 'body') continue;
                        if (vus.includes(x.id)) { if (new Set(vus.slice(-6)).size <= 3 && i > 6) { const reste = await p.evaluate(() => [...document.querySelectorAll('a[href],button:not([disabled]),input,select,textarea')].filter(e => e.getClientRects().length).length); if (reste > vus.length + 5) ctx.trouver({ gravite: 'haute', id: 'CLAVIER-PIEGE', categorie: 'accessibilité', titre: `${f} : le focus tourne en rond après ${new Set(vus).size} éléments (${reste} contrôles visibles)`, fichier: f, detail: x.k, effort: 'M' }); break; } }
                        vus.push(x.id);
                        if (!x.visible) horsEcran.push(x.k); else if (!x.marque) invisibles.push(x.k);
                    }
                    invisibles = [...new Set(invisibles)]; horsEcran = [...new Set(horsEcran)];
                    if (invisibles.length) ctx.trouver({ gravite: invisibles.length > 5 ? 'haute' : 'moyenne', id: 'CLAVIER-FOCUS-INVISIBLE', categorie: 'accessibilité', titre: `${f} : ${invisibles.length} contrôle(s) sans marque visible au focus clavier`, fichier: f, detail: invisibles.slice(0, 12).join('\n'), correctif: ':focus-visible avec contour.', effort: 'S' });
                    if (horsEcran.length) ctx.trouver({ gravite: 'moyenne', id: 'CLAVIER-FOCUS-CACHE', categorie: 'accessibilité', titre: `${f} : le focus passe sur ${horsEcran.length} élément(s) invisible(s)`, fichier: f, detail: horsEcran.slice(0, 12).join('\n'), correctif: 'inert, visibility:hidden ou tabindex=-1 sur les panneaux fermés.', effort: 'S' });
                    const clic = await p.evaluate(() => [...document.querySelectorAll('[onclick],[data-act],[data-href],.clickable,[style*="cursor: pointer"],[style*="cursor:pointer"]')].filter(e => e.getClientRects().length && !e.closest('a,button') && !/^(A|BUTTON|INPUT|SELECT|LABEL|SUMMARY)$/.test(e.tagName) && !e.hasAttribute('tabindex') && !e.querySelector('a,button')).slice(0, 8).map(e => e.tagName.toLowerCase() + '.' + String(e.className).split(/\s+/)[0]));
                    if (clic.length) ctx.trouver({ gravite: 'moyenne', id: 'CLAVIER-INATTEIGNABLE', categorie: 'accessibilité', titre: `${f} : ${clic.length} élément(s) cliquable(s) impossibles à atteindre au clavier`, fichier: f, detail: [...new Set(clic)].join('\n'), effort: 'S' });

                    // ── 2. chaque menu et fenêtre ──
                    await aller();
                    const declencheurs = await p.evaluate(() => [...document.querySelectorAll('button,[role=button],summary')].map((e, i) => ({ i, e })).filter(({ e }) => e.getClientRects().length && !e.disabled && (e.hasAttribute('aria-haspopup') || e.hasAttribute('aria-expanded') || /ajouter|créer|nouvel|modifier|filtre|options|plus|trier|partager|noter|note|réglage|importer|exporter|gérer|migrer|…|\.\.\./i.test((e.getAttribute('aria-label') || '') + ' ' + e.textContent))).map(({ i, e }) => ({ i, nom: ((e.getAttribute('aria-label') || '') || e.textContent).trim().replace(/\s+/g, ' ').slice(0, 40) })).filter((x, k, t) => t.findIndex(y => y.nom === x.nom) === k).slice(0, 14));
                    for (const t of declencheurs) try {
                        if (/installer|mise à jour de|quitter|déconnex|supprimer le compte/i.test(t.nom)) continue;
                        const avant = await ouverts(p); const exc = s.exceptions.length;
                        const h = (await p.$$('button,[role=button],summary'))[t.i]; if (!h) continue;
                        if (!(await h.click({ timeout: 900 }).then(() => true).catch(() => false))) continue;
                        await p.waitForTimeout(450);
                        if (s.exceptions.length > exc) ctx.trouver({ gravite: 'haute', id: 'FENETRE-EXCEPTION', categorie: 'bug', titre: `${f} : « ${t.nom} » lève une exception`, fichier: f, detail: s.exceptions.slice(exc).join('\n'), effort: 'S' });
                        if ((await ouverts(p)) <= avant) { if (p.url().split('?')[0] !== `${J.url}/${u}`.split('?')[0]) await aller(); continue; }
                        totaux.fenetres++;
                        const m = await p.evaluate((S) => { const d = [...document.querySelectorAll(S)].filter(e => e.getClientRects().length && !e.closest('#inko-music')).pop(); const r = d.getBoundingClientRect(); const modale = d.matches('[role=dialog],[aria-modal="true"],dialog,.mh-modal,.mh-feuille'); return { modale, focusDedans: d.contains(document.activeElement), nom: !!(d.getAttribute('aria-label') || d.getAttribute('aria-labelledby')), sortEcran: r.right > innerWidth + 2 || r.bottom > innerHeight + 2 || r.left < -2 || r.top < -2, defile: d.scrollHeight > d.clientHeight + 4, controles: [...d.querySelectorAll('button,a[href],input,select,textarea')].filter(e => e.getClientRects().length).length, brut: /undefined|NaN|\[object|\bnull\b/.test(d.innerText) ? d.innerText.slice(0, 160) : '' }; }, DIALOGUES);
                        if (m.modale && !m.focusDedans) ctx.trouver({ gravite: 'moyenne', id: 'FENETRE-FOCUS', categorie: 'accessibilité', titre: `${f} : la fenêtre « ${t.nom} » s'ouvre sans prendre le focus`, fichier: f, correctif: 'MH.piegerFocus.', effort: 'S' });
                        if (m.modale && !m.nom) ctx.trouver({ gravite: 'basse', id: 'FENETRE-SANS-NOM', categorie: 'accessibilité', titre: `${f} : la fenêtre « ${t.nom} » n'a pas de nom accessible`, fichier: f, correctif: 'aria-labelledby sur le titre.', effort: 'S' });
                        if (m.sortEcran && !m.defile) ctx.trouver({ gravite: 'moyenne', id: 'FENETRE-HORS-ECRAN', categorie: 'mise en page', titre: `${f} : « ${t.nom} » s'ouvre en partie hors de l'écran`, fichier: f, effort: 'S' });
                        if (m.brut) ctx.trouver({ gravite: 'moyenne', id: 'FENETRE-VALEUR-BRUTE', categorie: 'bug', titre: `${f} : valeur manquante dans « ${t.nom} »`, fichier: f, detail: m.brut, effort: 'S' });
                        await p.evaluate(axe);
                        const v = await p.evaluate(async (S) => { const d = [...document.querySelectorAll(S)].filter(e => e.getClientRects().length && !e.closest('#inko-music')).pop(); if (!d) return []; return (await window.axe.run(d, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } })).violations.map(v => v.id + ' × ' + v.nodes.length + ' (' + v.nodes[0].target.join(' ') + ')'); }, DIALOGUES).catch(() => []);
                        if (v.length) ctx.trouver({ gravite: 'moyenne', id: 'FENETRE-AXE', categorie: 'accessibilité', titre: `${f} : « ${t.nom} » — ${v.length} défaut(s) d'accessibilité`, fichier: f, detail: v.join('\n'), effort: 'S' });
                        await p.keyboard.press('Escape'); await p.waitForTimeout(350);
                        if ((await ouverts(p)) > avant) { ctx.trouver({ gravite: 'moyenne', id: 'FENETRE-ECHAP', categorie: 'accessibilité', titre: `${f} : Échap ne ferme pas « ${t.nom} »`, fichier: f, effort: 'S' }); await aller(); }
                    } catch (e) { await aller(); }   // le contrôle a changé de page : on revient et on continue
                    // ── 3. chaque champ : saisie longue, accents, validation ──
                    await aller();
                    const champs = await p.$$('input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([type=radio]):not([type=range]):not([type=color]),textarea');
                    for (let i = 0; i < Math.min(champs.length, 12); i++) {
                        const h = champs[i]; if (!(await h.isVisible().catch(() => false)) || !(await h.isEditable().catch(() => false))) continue;
                        totaux.champs++;
                        const exc = s.exceptions.length, ko = s.ko.length;
                        const type = await h.getAttribute('type'); const nom = (await h.getAttribute('id')) || (await h.getAttribute('placeholder')) || type;
                        await h.fill(type === 'number' ? '-999999999' : type === 'date' ? '2026-01-01' : type === 'email' ? 'pas-un-email' : 'Éàç « 漫画 » %_\\\' OR 1=1 -- ' + 'a'.repeat(400), { timeout: 1500 }).catch(() => { });
                        await h.press('Enter').catch(() => { }); await p.waitForTimeout(700);
                        if (s.exceptions.length > exc) ctx.trouver({ gravite: 'haute', id: 'SAISIE-EXCEPTION', categorie: 'bug', titre: `${f} : saisie inhabituelle dans « ${nom} » → exception`, fichier: f, detail: s.exceptions.slice(exc).join('\n'), effort: 'S' });
                        if (s.ko.length > ko) ctx.trouver({ gravite: 'haute', id: 'SAISIE-5XX', categorie: 'bug', titre: `${f} : saisie dans « ${nom} » → erreur serveur`, fichier: f, detail: s.ko.slice(ko).join('\n'), effort: 'S' });
                        const deb = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
                        if (deb > 4) ctx.trouver({ gravite: 'basse', id: 'SAISIE-DEBORDE', categorie: 'mise en page', titre: `${f} : un texte long dans « ${nom} » élargit la page de ${deb} px`, fichier: f, effort: 'S' });
                        if (p.url().split('?')[0] !== `${J.url}/${u}`.split('?')[0]) break;
                    }
                } catch (e) { ctx.trouver({ gravite: 'basse', id: 'INTERACTION-INTERROMPUE', titre: `${f} : ${e.message.slice(0, 90)}`, effort: 'S' }); }
                await c.close();
            }
            ctx.mesure('interaction_totaux', totaux);
        } finally { await o.fermer(); }
    },
};
