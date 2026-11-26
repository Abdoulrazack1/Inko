// ux-parcours — les gestes quotidiens, joués comme un lecteur : combien d'appuis, combien
// de temps, et est-ce que ça aboutit ? Chaque tâche a un budget d'appuis assumé.
'use strict';
const U = require('./_ux');
const E = require('./_explore');

const TEXTE = (re) => `text=/${re.source}/${re.flags}`;

module.exports = {
    nom: 'ux-parcours',
    description: 'Dix tâches quotidiennes jouées au bureau et au téléphone : réussite, nombre d\'appuis, durée',
    async run(ctx) {
        const b = await U.banc(ctx, { base: 'inko_ux_par', port: 8133 });
        if (!b) return;
        const { J, donnees: d } = b;
        const resultats = [];
        try {
            const m = d.manga;
            const urlSerie = m ? `serie.html?id=${encodeURIComponent(m.id)}&source=${m.source}` : null;
            const urlChap = m ? `chapitre.html?manga=${encodeURIComponent(m.id)}&chapter=${encodeURIComponent(m.chapitres[Math.floor(m.chapitres.length / 2)].id)}&source=${m.source}` : null;
            const favoris = async () => { const r = await J.api('GET', '/me/favorites'); return Array.isArray(r.json) ? r.json : []; };
            const TACHES = [
                { id: 'reprendre', nom: 'Reprendre sa lecture depuis l\'accueil', budget: 1, depart: 'accueil.html', faire: async (p, a) => { await a.toucher('.mh-reprendre a, a:has-text("Reprendre"), button:has-text("Reprendre"), [data-reprendre]'); await p.waitForURL(/(chapitre|lecture)\.html/, { timeout: 8000 }); } },
                { id: 'trouver', nom: 'Retrouver une série dans sa bibliothèque', budget: 2, depart: 'accueil.html', faire: async (p, a) => { await a.toucher('header a[href$="bibliotheque.html"], .bottom-nav a[href$="bibliotheque.html"], nav a[href$="bibliotheque.html"]'); await p.waitForURL(/bibliotheque/, { timeout: 8000 }); await a.saisir('#libSearch, main input[type=search], main input[placeholder*="hercher"], main input[placeholder*="iltr"]', 'Dorohedoro'); await p.waitForFunction(() => { const c = [...document.querySelectorAll('#libGrid .lib2-card')].filter(e => e.getClientRects().length); return c.length && c.every(e => /Dorohedoro/i.test(e.textContent)); }, null, { timeout: 6000 }); } },
                { id: 'ajouter', nom: 'Chercher une œuvre et l\'ajouter', budget: 4, depart: 'accueil.html', reel: true, faire: async (p, a) => { await a.saisir('#headerSearch, header input[type=search]', 'berserk', { ouvrir: 'header [aria-label*="echerch"], .bottom-nav a[href$="recherche.html"], a[href$="recherche.html"]' }); await p.keyboard.press('Enter'); await p.waitForSelector('.se-card, .search-result-item', { timeout: 30000 }); await p.waitForTimeout(1500); if (await p.$('.se-card:not(a)')) ctx.trouver({ gravite: 'haute', id: 'UX-RESULTATS-SANS-LIEN', dimension: 'accessibilite', categorie: 'ux', titre: 'Les résultats de recherche ne sont pas des liens : impossibles à ouvrir au clavier ou dans un nouvel onglet', detail: 'recherche.js : <div class="se-card" data-href=…> avec un seul écouteur de clic, sans tabindex ni rôle.', correctif: 'Un <a href> couvrant la carte, les puces de sources en liens séparés.', fichier: 'assets/js/recherche.js', effort: 'S' }); await a.toucher('.se-card:not(.se-perso-card) .se-cover, .se-card .se-title, .search-result-item'); await p.waitForURL(/serie\.html/, { timeout: 15000 }); await a.toucher('#btnFavorite'); await p.waitForFunction(() => /dans ma|✓|in my/i.test((document.getElementById('btnFavorite') || {}).textContent || '') || !!document.querySelector('#btnFavorite.is-in'), null, { timeout: 8000 }); } },
                { id: 'retirer', nom: 'Retirer une série puis se raviser', budget: 4, depart: 'bibliotheque.html', faire: async (p, a) => { const n = (await favoris()).length; const carte = p.locator('.lib2-card').first(); await carte.hover().catch(() => { }); await a.toucher('.lib2-card .lib2-del'); await p.waitForTimeout(500); await a.siPresent('.mh-modal-btn:not(.ghost), [data-act="ok"]'); await a.toucher('.undo-bar-action, [class*=toast] button:has-text("Annuler")'); await p.waitForTimeout(1500); if ((await favoris()).length < n) throw new Error('la série n\'est pas revenue'); } },
                { id: 'theme', nom: 'Passer en thème clair', budget: 3, depart: 'accueil.html', faire: async (p, a) => { await a.toucher('a[href$="parametres.html"], [aria-label*="aramètres"], [role=option]:has-text("Paramètres"), [role=dialog] button:has-text("Paramètres"), .cmd-row:has-text("Paramètres")', { ouvrir: 'header [aria-haspopup]:has-text("Plus"), #mnavMore, header [aria-label*="rofil"]' }); await p.waitForURL(/parametres/, { timeout: 8000 }); await a.toucher('#segTheme [data-val="light"]'); await p.waitForFunction(() => document.documentElement.getAttribute('data-theme') === 'light' || /light/.test(document.documentElement.className + document.body.className), null, { timeout: 4000 }); } },
                { id: 'liste', nom: 'Créer une liste', budget: 3, depart: 'collections.html', faire: async (p, a) => { await a.toucher('#btnNewList'); await a.saisir('#listName', 'À emporter'); await a.toucher('#listSave, .list-modal button[type=submit], .list-modal-footer .btn-primary, [class*=list-modal] button:has-text("Créer"), [class*=list-modal] button:has-text("Enregistrer")'); await p.waitForFunction(() => /À emporter/.test((document.querySelector('main') || document.body).innerText), null, { timeout: 6000 }); } },
                { id: 'lu', nom: 'Marquer un chapitre lu depuis la fiche', budget: 1, depart: urlSerie, reel: true, faire: async (p, a) => { await p.waitForSelector('.chapter-read-dot', { timeout: 20000 }); const avant = await p.locator('.chapter-read-dot.is-read').count(); await a.toucher('.chapter-read-dot:not(.is-read)'); await p.waitForFunction((n) => document.querySelectorAll('.chapter-read-dot.is-read').length > n, avant, { timeout: 5000 }); } },
                { id: 'sens', nom: 'Trouver le réglage du sens de lecture', budget: 2, depart: 'parametres.html', faire: async (p, a) => { await a.saisir('#setSearch', 'sens'); await p.waitForFunction(() => [...document.querySelectorAll('button')].some(b => /RTL|LTR/.test(b.textContent) && b.getClientRects().length && b.getBoundingClientRect().top < innerHeight && b.getBoundingClientRect().top > 0), null, { timeout: 4000 }); } },
                { id: 'signet', nom: 'Poser un signet en lisant', budget: 2, depart: urlChap, reel: true, faire: async (p, a) => { await p.waitForSelector('.reader-page-img', { timeout: 25000 }); await p.waitForTimeout(1500); const n0 = JSON.stringify((await J.api('GET', '/me/bookmarks')).json || '').length; await a.toucher('#btnBookmark'); await p.waitForTimeout(600); await a.siPresent('.signet-pop button[type=submit], .signet-pop .btn-primary'); await p.waitForTimeout(4500); if (JSON.stringify((await J.api('GET', '/me/bookmarks')).json || '').length <= n0) throw new Error('signet non enregistré'); } },
                { id: 'hors-ligne', nom: 'Garder un chapitre pour le hors-ligne', budget: 1, depart: urlChap, reel: true, faire: async (p, a) => { await p.waitForSelector('.reader-page-img', { timeout: 25000 }); await p.waitForTimeout(1500); await a.toucher('#btnDownload'); await p.waitForFunction(() => /hors.ligne|téléchargé|téléchargement|%/i.test([...document.querySelectorAll('[class*=toast], #btnDownload, [role=status]')].map(e => e.textContent + (e.getAttribute('title') || '')).join(' ')), null, { timeout: 20000 }); } },
            ];
            for (const profil of ['bureau', 'mobile']) {
                for (const t of TACHES) {
                    if (!t.depart) { resultats.push({ id: t.id, nom: t.nom, profil, etat: 'non joué (source injoignable)' }); continue; }
                    const c = await E.contexte(b.nav, J, { ...U.PROFILS[profil], calme: true });
                    const p = await c.newPage(); const s = E.surveiller(p);
                    let appuis = 0, detours = 0;
                    const premierVisible = async (sel, delai = 6000) => { const fin = Date.now() + delai; do { for (const h of await p.$$(sel).catch(() => [])) if (await h.isVisible().catch(() => false)) return h; await p.waitForTimeout(150); } while (Date.now() < fin); return null; };
                    const a = {
                        async toucher(sel, { ouvrir } = {}) {
                            let h = await premierVisible(sel, ouvrir ? 1200 : 6000);
                            if (!h && ouvrir) { const o = await premierVisible(ouvrir, 2000); if (o) { await o.click({ timeout: 2000 }); appuis++; detours++; await p.waitForTimeout(400); h = await premierVisible(sel, 3000); } }
                            if (!h) throw new Error('introuvable à l\'écran : ' + sel.split(',')[0]);
                            if (profil === 'mobile') await h.tap({ timeout: 4000 }); else await h.click({ timeout: 4000 });
                            appuis++;
                        },
                        async saisir(sel, texte, { ouvrir } = {}) {
                            let h = await premierVisible(sel, ouvrir ? 1500 : 8000);
                            if (!h && ouvrir) { const o = await premierVisible(ouvrir, 2000); if (o) { await o.click({ timeout: 2000 }); appuis++; detours++; await p.waitForTimeout(500); h = await premierVisible(sel + ', main input[type=search], main input[type=text]', 4000); } }
                            if (!h) throw new Error('champ introuvable : ' + sel.split(',')[0]);
                            await h.click({ timeout: 3000 }); appuis++; await h.type(texte, { delay: 25 });
                        },
                        async siPresent(sel) { const h = await premierVisible(sel, 900); if (h) { await h.click({ timeout: 2000 }); appuis++; } },
                    };
                    let etat = 'réussi', note = ''; let ms = 0;
                    try {
                        // chaque passage repart sans signet : sinon le second profil trouve celui du premier
                        if (t.id === 'signet') await J.sql('DELETE FROM bookmarks');
                        if (t.id === 'theme') await J.api('PUT', '/me/settings', {});
                        await p.goto(`${J.url}/${t.depart}`, { waitUntil: 'load', timeout: 30000 }); await U.stabiliser(p, { max: 30 });
                        if (t.id === 'theme' && profil === 'mobile') { const o = await p.$('#mnavMore'); if (o) { await o.tap(); await p.waitForTimeout(500); if (await p.$('.cmd-row:not([role])')) ctx.trouver({ gravite: 'moyenne', id: 'UX-PALETTE-SANS-ROLE', dimension: 'accessibilite', categorie: 'ux', titre: 'Au téléphone, « Plus » ouvre une palette de commandes dont les lignes ne sont ni des liens ni des boutons', detail: 'global.js : <div class="cmd-row"> avec écouteur de clic, sans rôle ; un lecteur d\'écran ne les annonce pas comme activables.', correctif: 'Une feuille de navigation avec de vrais liens au téléphone ; role="option" dans la palette.', fichier: 'assets/js/global.js', effort: 'M' }); await p.keyboard.press('Escape'); await p.waitForTimeout(300); } }
                        const t0 = Date.now(); await t.faire(p, a); ms = Date.now() - t0;
                    } catch (e) { etat = 'échoué'; note = e.message.split('\n')[0].slice(0, 160); }
                    resultats.push({ id: t.id, nom: t.nom, profil, etat, appuis, budget: t.budget, ms, note });
                    const ou = profil === 'mobile' ? 'au téléphone' : 'au bureau';
                    if (etat === 'échoué') ctx.trouver({ gravite: 'haute', id: 'UX-PARCOURS-ECHEC', dimension: 'efficacite', categorie: 'ux', titre: `« ${t.nom} » n'aboutit pas ${ou}`, detail: `${note}\nParti de ${t.depart.split('?')[0]}, ${appuis} appui(s) avant l'échec.${s.exceptions.length ? '\nExceptions : ' + s.exceptions.slice(0, 2).join(' · ') : ''}`, correctif: 'Rejouer à la main, puis rendre le contrôle visible et son effet immédiat.', fichier: t.depart.split('?')[0], effort: 'M' });
                    else if (appuis > t.budget) ctx.trouver({ gravite: 'moyenne', id: 'UX-PARCOURS-LONG', dimension: 'efficacite', categorie: 'ux', titre: `« ${t.nom} » demande ${appuis} appuis ${ou} (budget ${t.budget})`, detail: detours ? `${detours} appui(s) pour déplier un menu.` : '', correctif: 'Sortir l\'action du menu ou ajouter un raccourci là où on en a besoin.', fichier: t.depart.split('?')[0], effort: 'S' });
                    else if (ms > 6000 && !t.reel) ctx.trouver({ gravite: 'basse', id: 'UX-PARCOURS-LENT', dimension: 'efficacite', categorie: 'ux', titre: `« ${t.nom} » prend ${(ms / 1000).toFixed(1)} s ${ou}`, detail: '', correctif: 'Réponse immédiate à l\'écran.', fichier: t.depart.split('?')[0], effort: 'S' });
                    await c.close();
                }
            }
            ctx.mesure('parcours_taches', resultats);
            ctx.mesure('parcours_reussite_pct', Math.round(100 * resultats.filter(r => r.etat === 'réussi').length / Math.max(1, resultats.filter(r => r.etat !== 'non joué (source injoignable)').length)));
        } finally { await b.fermer(); }
    },
};
