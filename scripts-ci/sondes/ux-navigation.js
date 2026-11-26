// ux-navigation — se repérer et revenir : pages inatteignables, profondeur, repère de la page
// courante, titres, retour en arrière (position, filtres), bouton Retour du téléphone.
'use strict';
const U = require('./_ux');
const E = require('./_explore');

const SECONDAIRES = /^(serie|liste|collection-detail|u|comparer|localreader|anilist|confidentialite)\.html$/;

module.exports = {
    nom: 'ux-navigation',
    description: 'Atteignabilité et profondeur des pages, repères, titres, retour (position et filtres), bouton Retour du téléphone',
    async run(ctx) {
        const b = await U.banc(ctx, { base: 'inko_ux_nav', port: 8132 });
        if (!b) return;
        const T = (gravite, id, titre, detail, correctif, extra = {}) => ctx.trouver({ gravite, id, dimension: 'navigation', categorie: 'ux', titre, detail, correctif, effort: 'S', ...extra });
        try {
            // ── liens, repères, titres ──
            const liens = {}, titres = {};
            await U.visiter(b, 'bureau', async (f, p) => {
                // les menus repliés comptent aussi : on ouvre ceux de l'en-tête
                for (const h of await p.$$('header [aria-haspopup], header [aria-expanded="false"]')) { await h.click({ timeout: 600 }).catch(() => { }); await p.waitForTimeout(150); }
                await U.outiller(p);
                const r = await p.evaluate((f) => {
                    const u = window.__ux;
                    const l = [...document.querySelectorAll('a[href]')].map(a => ({ vers: (a.getAttribute('href') || '').split(/[?#]/)[0].replace(/^\.?\//, ''), zone: a.closest('footer,#footer-slot') ? 'pied' : a.closest('header,nav,#header-slot') ? 'entete' : 'corps' })).filter(x => /\.html$/.test(x.vers));
                    const nav = [...document.querySelectorAll('header a[href], nav a[href], .bottom-nav a[href]')].filter(a => (a.getAttribute('href') || '').split(/[?#]/)[0].endsWith(f) && !a.matches('.logo,[class*=logo]'));
                    const marque = nav.some(a => a.getAttribute('aria-current') || /\b(active|on|current|actif)\b/.test(a.className) || (a.parentElement && /\b(active|current)\b/.test(a.parentElement.className)));
                    const retour = [...document.querySelectorAll('main a, main button, .toolbar-back, .breadcrumb, [class*=fil], a.back, [aria-label*="etour"]')].filter(e => u.vis(e) && !u.hors(e) && /←|‹|retour|revenir|toutes mes|ma bibliothèque|back|breadcrumb/i.test(e.textContent + ' ' + (e.getAttribute('aria-label') || '') + ' ' + e.className) && e.id !== 'btnBackTop').length;
                    const h1 = [...document.querySelectorAll('h1')].find(u.vis);
                    return { l, dansNav: nav.length > 0, marque, retour, titre: document.title, h1: h1 ? h1.textContent.trim().replace(/\s+/g, ' ').slice(0, 60) : '' };
                }, f);
                liens[f] = r.l; titres[f] = r.titre;
                if (r.dansNav && !r.marque) T('moyenne', 'UX-NAV-REPERE', `${f} : la navigation n'indique pas qu'on est sur cette page`, '', 'aria-current="page" et style actif.', { fichier: f });
                if (SECONDAIRES.test(f) && !r.retour) T('moyenne', 'UX-NAV-SANS-RETOUR', `${f} : aucun moyen visible de revenir au niveau supérieur`, '', 'Lien « ← … » ou fil d\'Ariane.', { fichier: f });
                if (!r.titre || /^inko$/i.test(r.titre.trim())) T('basse', 'UX-NAV-TITRE-VAGUE', `${f} : titre d'onglet « ${r.titre} »`, '', '« Page — Inko ».', { fichier: f });
            });
            const doubles = Object.entries(Object.entries(titres).reduce((m, [f, t]) => ((m[t] = (m[t] || []).concat(f)), m), {})).filter(([, l]) => l.length > 1);
            if (doubles.length) T('basse', 'UX-NAV-TITRES-DOUBLES', `${doubles.length} titre(s) d'onglet partagés par plusieurs pages`, doubles.map(([t, l]) => `« ${t} » : ${l.join(', ')}`).join('\n'), 'Un titre propre à chaque page.');
            const toutes = E.pages(ctx).filter(f => !/^(index|offline)\.html$/.test(f));
            const profondeur = { 'accueil.html': 0 }; const file = ['accueil.html'];
            while (file.length) { const f = file.shift(); for (const x of liens[f] || []) { if (x.zone === 'pied') continue; if (profondeur[x.vers] === undefined && toutes.includes(x.vers)) { profondeur[x.vers] = profondeur[f] + 1; file.push(x.vers); } } }
            const viaPied = new Set(Object.values(liens).flat().filter(x => x.zone === 'pied').map(x => x.vers));
            const codes = [...ctx.parcourir(ctx.abs('assets', 'js'), ctx.ext('.js'))].map(ctx.lire).join('\n');
            const orphelines = toutes.filter(f => profondeur[f] === undefined);
            for (const f of orphelines) { const pied = viaPied.has(f), code = codes.includes(f); T(pied ? 'basse' : code ? 'basse' : 'haute', 'UX-NAV-ORPHELINE', `${f} : ${pied ? 'accessible seulement par le pied de page' : code ? 'aucun lien permanent (seulement atteinte par une action)' : 'aucun chemin ne mène à cette page'}`, '', 'Lui donner une place dans la navigation, ou la retirer.', { fichier: f }); }
            const loin = Object.entries(profondeur).filter(([, d]) => d > 2);
            if (loin.length) T('basse', 'UX-NAV-PROFONDE', `${loin.length} page(s) à plus de deux clics de l'accueil`, loin.map(([f, d]) => `${f} : ${d}`).join('\n'), 'Raccourcir le chemin.');
            ctx.mesure('navigation_profondeur', profondeur);
            ctx.mesure('navigation_orphelines', orphelines);

            // ── revenir en arrière : retrouve-t-on sa place et ses choix ? ──
            const c = await E.contexte(b.nav, b.J, { calme: true });
            const retours = {};
            for (const [f, url, preparer, lien] of [
                ['bibliotheque.html', 'bibliotheque.html', null, '.lib2-card'],
                ['catalogue.html', 'catalogue.html', null, '.manga-card a, a.manga-card-link'],
                ['accueil.html', 'accueil.html', null, '.shelf-card a, .manga-card a, a.manga-card-link'],
                ['recherche.html', 'recherche.html?q=one', null, 'a.se-card'],
                ['profil.html', 'profil.html', null, 'a.fav-item'],
            ]) {
                const p = await c.newPage();
                try {
                    await p.goto(`${b.J.url}/${url}`, { waitUntil: 'load' }); await U.stabiliser(p, { max: 60 });
                    const y0 = await p.evaluate(() => { window.scrollTo(0, Math.min(1400, document.documentElement.scrollHeight - innerHeight)); return Math.round(scrollY); });
                    await p.waitForTimeout(500);
                    const cible = await p.evaluate((sel) => { const e = [...document.querySelectorAll(sel)].find(e => { const r = e.getBoundingClientRect(); return r.top > 80 && r.bottom < innerHeight && r.width > 20; }); if (!e) return false; (e.tagName === 'A' ? e : e.closest('a') || e).click(); return true; }, lien);
                    if (!cible || y0 < 300) { retours[f] = 'non éprouvé (page courte ou aucune carte)'; await p.close(); continue; }
                    await p.waitForTimeout(2200); await p.goBack({ waitUntil: 'load' }); await U.stabiliser(p, { max: 60 });
                    const y1 = await p.evaluate(() => Math.round(scrollY));
                    retours[f] = `${y0} → ${y1}`;
                    if (y1 < y0 * .6) T('haute', 'UX-NAV-POSITION-PERDUE', `${f} : revenir d'une fiche ramène en haut de page`, `Position avant : ${y0} px ; après le retour : ${y1} px.`, 'Mémoriser la position et la restaurer après le rendu (history.scrollRestoration = \'manual\').', { fichier: f, effort: 'M' });
                } catch (e) { retours[f] = 'interrompu : ' + e.message.slice(0, 80); }
                await p.close();
            }
            ctx.mesure('navigation_retour', retours);
            for (const [f, url, geste, lire, nom] of [
                ['bibliotheque.html', 'bibliotheque.html', async (p) => p.click('#btnViewList, [data-view="list"]', { timeout: 1500 }), () => !!document.querySelector('#btnViewList[aria-pressed="true"], [data-view="list"].on, [data-view="list"].active, .lib2-grid.list, .lib2-liste'), 'la vue en liste'],
                ['bibliotheque.html', 'bibliotheque.html', async (p) => p.click('[data-tab="bookmarks"]', { timeout: 1500 }), () => !!document.querySelector('[data-tab="bookmarks"].on, [data-tab="bookmarks"].active, [data-tab="bookmarks"][aria-selected="true"]'), 'l\'onglet « Signets »'],
                ['catalogue.html', 'catalogue.html', async (p) => { await p.fill('#catSearch, input[type=search], main input[type=text]', 'naruto', { timeout: 1500 }); await p.keyboard.press('Enter'); await p.waitForTimeout(1500); }, () => [...document.querySelectorAll('main input')].some(i => /naruto/i.test(i.value)), 'la recherche saisie'],
                ['notes.html', 'notes.html', async (p) => p.getByText('Par série', { exact: true }).click({ timeout: 1500 }), () => [...document.querySelectorAll('button')].some(b => b.textContent.trim() === 'Par série' && /on|active/.test(b.className + (b.getAttribute('aria-selected') || b.getAttribute('aria-pressed') || '').replace('true', 'on'))), 'la vue « Par série »'],
                ['parametres.html', 'parametres.html', async (p) => p.evaluate(() => window.scrollTo(0, 1500)), () => scrollY > 800, 'la section consultée'],
            ]) {
                const p = await c.newPage();
                try {
                    await p.goto(`${b.J.url}/${url}`, { waitUntil: 'load' }); await U.stabiliser(p);
                    await geste(p); await p.waitForTimeout(600);
                    if (!(await p.evaluate(lire))) { await p.close(); continue; }
                    await p.reload({ waitUntil: 'load' }); await U.stabiliser(p);
                    if (!(await p.evaluate(lire))) T('moyenne', 'UX-NAV-ETAT-PERDU', `${f} : ${nom} est oubliée au rechargement`, '', 'Garder le choix dans l\'adresse (partageable) ou les préférences.', { fichier: f });
                } catch (e) { /* contrôle absent : une autre sonde le dira */ }
                await p.close();
            }
            await c.close();

            // ── application de bureau : la fenêtre est sans cadre, la page doit dessiner ses boutons ──
            if (/"decorations"\s*:\s*false/.test(ctx.lire(ctx.abs('desktop-tauri', 'src-tauri', 'tauri.conf.json')))) {
                const t = await E.contexte(b.nav, b.J, { calme: true });
                await t.addInitScript(() => { const w = { minimize() { }, toggleMaximize() { }, close() { } }; window.__TAURI__ = { window: { getCurrentWindow: () => w, appWindow: w }, core: { invoke: async () => null }, event: { listen: async () => () => { } } }; });
                const sansBarre = [];
                for (const f of E.pages(ctx).filter(x => x !== 'index.html')) {
                    const p = await t.newPage();
                    try { await p.goto(`${b.J.url}/${f}`, { waitUntil: 'load', timeout: 20000 }); await p.waitForTimeout(1500); const r = await p.evaluate(() => ({ barre: !!document.querySelector('#inko-titlebar'), sorties: [...document.querySelectorAll('a[href]')].filter(a => a.getClientRects().length && /\.html/.test(a.getAttribute('href'))).length, chemin: location.pathname })); if (!r.barre && r.chemin.endsWith(f)) sansBarre.push(`${f}${r.sorties ? '' : ' (aucun lien de sortie)'}`); } catch (e) { /* page lente */ }
                    await p.close();
                }
                await t.close();
                ctx.mesure('navigation_pages_sans_barre_fenetre', sansBarre);
                if (sansBarre.length) T('haute', 'DSK-FENETRE-SANS-BARRE', `Application Windows : ${sansBarre.length} page(s) sans boutons de fenêtre (ni réduire, ni fermer, ni déplacer)`, sansBarre.join('\n') + '\n\nLa fenêtre est configurée sans cadre et la barre n\'est ajoutée que par MH.initPage. Constaté en simulant l\'environnement Tauri dans un navigateur.', 'Injecter la barre depuis un script commun à toutes les pages.', { categorie: 'application de bureau', fichier: 'assets/js/global.js' });
            }

            // ── bouton Retour du téléphone avec un panneau ouvert ──
            const m = await E.contexte(b.nav, b.J, { mobile: true, calme: true });
            const panneaux = '[role=dialog],[aria-modal="true"],.mh-modal,.mh-feuille,[role=menu],.lib-pop,.reader-settings-pop,.novel-settings-pop';
            const ouverts = (p) => p.evaluate((S) => [...document.querySelectorAll(S)].filter(e => !e.closest('#inko-music') && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').length, panneaux);
            const essais = {};
            for (const [f, url] of b.liste.filter(([f]) => /bibliotheque|catalogue|serie|chapitre|lecture|accueil|collections|sources/.test(f))) {
                const p = await m.newPage();
                try {
                    await p.goto(`${b.J.url}/accueil.html`); await p.goto(`${b.J.url}/${url}`, { waitUntil: 'load' }); await U.stabiliser(p);
                    const avant = await ouverts(p);
                    let ouvreur = null;
                    for (const sel of ['#btnLibFilters', '#btnFilters', '#btnReaderSettings', '[aria-label*="églages"]', '#btnLibMore', 'main [aria-haspopup]', '.bottom-nav [aria-haspopup]', 'button:has-text("Filtres")', 'button:has-text("Nouvelle liste")', '[aria-label*="Plus"]']) {
                        const h = await p.$(sel).catch(() => null); if (h && await h.isVisible() && await h.tap({ timeout: 700 }).then(() => true).catch(() => false)) { await p.waitForTimeout(500); if ((await ouverts(p)) > avant) { ouvreur = sel; break; } }
                    }
                    if (!ouvreur) { await p.close(); continue; }
                    const ici = p.url();
                    await p.goBack({ timeout: 4000 }).catch(() => { }); await p.waitForTimeout(700);
                    const reste = p.url().split('?')[0] === ici.split('?')[0];
                    essais[f] = reste ? 'le panneau se ferme' : 'la page est quittée';
                    if (!reste) T('haute', 'UX-NAV-RETOUR-PANNEAU', `${f} (téléphone) : le bouton Retour quitte la page au lieu de fermer le panneau ouvert`, `Panneau ouvert par ${ouvreur}.`, 'history.pushState à l\'ouverture, fermeture sur popstate — dans le composant commun.', { fichier: f, effort: 'M' });
                } catch (e) { /* page particulière */ }
                await p.close();
            }
            ctx.mesure('navigation_bouton_retour', essais);
            await m.close();
        } finally { await b.fermer(); }
    },
};
