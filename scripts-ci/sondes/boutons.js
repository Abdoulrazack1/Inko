// boutons — le peigne fin : chaque contrôle de chaque page, cliqué pour de vrai
// ------------------------------------------------------------
// Tourne sur un serveur + une base JETABLES (jamais la vraie bibliothèque).
// 1. Inspection de recouvrement : pour chaque contrôle visible, qu'y a-t-il VRAIMENT
//    au point où l'on clique (document.elementFromPoint) ? C'est ce qui révèle un voile
//    ou une couche posée par-dessus un bouton.
// 2. Clic réel (souris) sur chaque contrôle, dédoublonné par famille : effet, erreurs,
//    requêtes en échec, fenêtres, navigation.
// 3. Scénarios de fonctionnalité : mise à jour de la bibliothèque (captures), lecture manga,
//    lecture roman.
// Variables : BOUTONS_PAGES=a.html,b.html   BOUTONS_MAX=60   BOUTONS_SANS_CLICS=1
'use strict';
const fs = require('fs');
const path = require('path');
const { lancerNavigateur } = require('./_navigateur');
const { demarrer } = require('./_jetable');

const SAUTER = /(installer la mise|mettre à jour l.app|mise à jour de l.app|quitter|fermer l.application|se déconnecter|déconnexion|désinstaller)/i;
const BLOQUE_ECRITURE = /\/api\/(app\/update|auth\/google-config|anilist\/config|extensions\/update|extensions\/[^/]+\/(uninstall|reinstall)|me\/avatar|spotify\/)/;
const SELECTEUR = 'a[href], button, [role=button], [role=tab], [role=menuitem], [role=switch], [role=checkbox], summary, input:not([type=hidden]), select, textarea, [onclick]';

module.exports = {
    nom: 'boutons',
    description: 'Chaque contrôle de chaque page : recouvrement, clic réel, effet, erreurs ; scénarios mise à jour et lecture',
    async run(ctx) {
        const J = await demarrer(ctx, { base: 'inko_sonde_b', port: 8096, local: true });
        if (!J) return;
        const nav = await lancerNavigateur();
        const captures = path.join(ctx.racine, 'docs', 'audit', 'captures'); fs.mkdirSync(captures, { recursive: true });
        try {
            // ── jeu de données ──
            const faux = Array.from({ length: 36 }, (_, i) => ({ mangaId: 'fixture-' + i, source: i % 3 === 0 ? 'weebcentral' : (i % 3 === 1 ? 'mangadex' : 'sushiscan'), title: ['Naruto', 'Berserk', 'Vagabond', 'Monster', 'Akira', 'Blame!', 'Gantz', 'Pluto', 'Planetes', 'Vinland Saga', 'Dorohedoro', 'Gon'][i % 12] + ' ' + (i + 1), cover: null }));
            await Promise.all(faux.map(f => J.api('POST', '/me/favorites', f)));
            await J.api('PUT', '/me/progress/fixture-1', { chapterId: 'c1', chapterNum: 12, page: 4, source: 'mangadex', mangaTitle: 'Berserk 2' });
            await J.api('PUT', '/me/library/fixture-2', { status: 'reading' });
            const liste = await J.api('POST', '/me/lists', { name: 'Ma liste' }); const listeId = liste.json && (liste.json.id || (liste.json.list && liste.json.list.id));
            if (listeId) await J.api('POST', `/me/lists/${listeId}/items`, { mangaId: 'fixture-1', source: 'mangadex', title: 'Berserk 2' });
            await J.api('POST', '/me/notes', { mangaId: 'fixture-1', body: 'Une note.', text: 'Une note.', kind: 'note' });
            // une vraie œuvre pour les pages série/lecteur (lecture seule côté source)
            let reelle = null;
            const rech = await J.api('GET', '/sources/weebcentral/mangas/search?q=one%20piece&limit=3');
            const liste0 = rech.json && (rech.json.results || rech.json); reelle = Array.isArray(liste0) && liste0[0];
            let chap = null;
            if (reelle) { const c = await J.api('GET', `/sources/weebcentral/mangas/${encodeURIComponent(reelle.id)}/chapters`); const cs = c.json && (c.json.results || c.json.chapters || c.json); chap = Array.isArray(cs) && (cs[cs.length - 1] || cs[0]); }
            let roman = null, chapRoman = null;
            const rr = await J.api('GET', '/sources/novelfull/mangas/search?q=shadow%20slave&limit=3');
            const lr = rr.json && (rr.json.results || rr.json); roman = Array.isArray(lr) && lr[0];
            if (roman) { const c = await J.api('GET', `/sources/novelfull/mangas/${encodeURIComponent(roman.id)}/chapters`); const cs = c.json && (c.json.results || c.json.chapters || c.json); chapRoman = Array.isArray(cs) && cs[0]; }
            ctx.mesure('boutons_jeu_de_donnees', { favoris: faux.length, oeuvreReelle: reelle && reelle.title, chapitre: !!chap, roman: roman && roman.title, chapitreRoman: !!chapRoman });

            const URLS = {
                'serie.html': reelle ? `serie.html?id=${encodeURIComponent(reelle.id)}&source=weebcentral` : 'serie.html?id=fixture-1&source=mangadex',
                'chapitre.html': reelle && chap ? `chapitre.html?manga=${encodeURIComponent(reelle.id)}&chapter=${encodeURIComponent(chap.id)}&source=weebcentral` : null,
                'lecture.html': roman && chapRoman ? `lecture.html?manga=${encodeURIComponent(roman.id)}&chapter=${encodeURIComponent(chapRoman.id)}&source=novelfull` : null,
                'liste.html': listeId ? `liste.html?id=${listeId}` : null,
                'collection-detail.html': listeId ? `collection-detail.html?id=${listeId}` : null,
                'u.html': 'u.html?u=Lecteur',
            };
            const toutes = fs.readdirSync(ctx.racine).filter(f => f.endsWith('.html') && f !== 'offline.html').sort();
            const filtre = (process.env.BOUTONS_PAGES || '').split(',').filter(Boolean);
            const pages = filtre.length ? toutes.filter(p => filtre.includes(p)) : toutes;
            const MAX = +(process.env.BOUTONS_MAX || 60);

            const inventaire = {};
            const externes = new Map();
            const profils = [['bureau', { viewport: { width: 1366, height: 800 } }], ['mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]];

            for (const [nomProfil, opts] of profils) {
                const contexte = await nav.newContext({ ...opts, serviceWorkers: 'block', locale: 'fr-FR', permissions: [] });
                await contexte.addInitScript(() => { try { localStorage.setItem('mh_eula_v2', '1'); localStorage.setItem('inko_consent', '1'); localStorage.setItem('inko_tour_done', '1'); localStorage.setItem('mh_install_dismissed', '1'); } catch (e) { /* stockage */ } });
                // le navigateur ne sort jamais : on note qui il aurait appelé (vie privée), on bloque les écritures sensibles
                await contexte.route('**/*', (route) => {
                    const u = route.request().url();
                    if (u.startsWith(J.url) || u.startsWith('data:') || u.startsWith('blob:')) {
                        if (route.request().method() !== 'GET' && BLOQUE_ECRITURE.test(u)) return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"bloque":"sonde"}' });
                        return route.continue();
                    }
                    try { const h = new URL(u).host; externes.set(h, (externes.get(h) || 0) + 1); } catch (e) { /* url */ }
                    return route.abort();
                });
                for (const f of pages) {
                    const cible = URLS[f] === undefined ? f : URLS[f];
                    if (cible === null) { inventaire[`${f}|${nomProfil}`] = { saute: 'pas de données réelles pour cette page' }; continue; }
                    const page = await contexte.newPage();
                    const evt = { console: [], exceptions: [], ko: [], reqs: 0, dialogues: 0, popups: 0, telechargements: 0 };
                    page.on('console', m => { if (m.type() === 'error' && !/net::ERR_FAILED|Failed to load resource|ERR_BLOCKED/.test(m.text())) evt.console.push(m.text().slice(0, 160)); });
                    page.on('pageerror', e => evt.exceptions.push(String(e.message).slice(0, 160)));
                    page.on('request', r => { if (/\/api\//.test(r.url()) && !/\/api\/img/.test(r.url())) evt.reqs++; });
                    page.on('response', r => { if (r.status() >= 400 && /\/api\//.test(r.url()) && !/\/api\/img/.test(r.url()) && !/fixture-/.test(r.url())) evt.ko.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`); });
                    page.on('dialog', d => { evt.dialogues++; d.dismiss().catch(() => { }); });
                    page.on('popup', p => { evt.popups++; p.close().catch(() => { }); });
                    page.on('download', () => { evt.telechargements++; });
                    const rel = { page: f, profil: nomProfil, controles: [], clics: 0 };
                    try {
                        await page.goto(`${J.url}/${cible}`, { waitUntil: 'load', timeout: 30000 });
                        await page.waitForTimeout(2200);
                        // ── 1. inspection de recouvrement ──
                        const liste = await page.evaluate((SEL) => {
                            const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
                            const nom = (e) => (e.getAttribute('aria-label') || e.getAttribute('title') || (e.labels && e.labels[0] && e.labels[0].textContent) || e.textContent || e.getAttribute('placeholder') || e.getAttribute('alt') || e.value || '').replace(/\s+/g, ' ').trim().slice(0, 60);
                            const sortie = [];
                            [...document.querySelectorAll(SEL)].forEach((e, i) => {
                                if (!vis(e)) return;
                                try { e.scrollIntoView({ block: 'center', inline: 'center' }); } catch (x) { /* ok */ }
                                const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return;
                                const cx = Math.min(Math.max(r.left + r.width / 2, 1), innerWidth - 1), cy = Math.min(Math.max(r.top + r.height / 2, 1), innerHeight - 1);
                                const top = document.elementFromPoint(cx, cy);
                                // le dock musique ouvert et les bulles d'astuce sont des couches VOULUES, pas des défauts
                                const voulu = !!top && !!top.closest('#inko-music,.itr-astuce,[class*=toast],[class*=astuce]');
                                const couvert = !!top && top !== e && !e.contains(top) && !top.contains(e) && !voulu;
                                let par = null;
                                if (couvert) { const s = getComputedStyle(top); par = { el: top.tagName.toLowerCase() + (top.id ? '#' + top.id : '') + (top.className && typeof top.className === 'string' ? '.' + top.className.trim().split(/\s+/).slice(0, 2).join('.') : ''), fond: s.backgroundColor, opacite: s.opacity, pos: s.position, z: s.zIndex }; }
                                const nomAcc = nom(e);
                                sortie.push({ i, tag: e.tagName.toLowerCase(), type: e.getAttribute('type') || '', role: e.getAttribute('role') || '', nom: nomAcc, href: e.getAttribute('href') || '', desactive: !!e.disabled || e.getAttribute('aria-disabled') === 'true', l: Math.round(r.width), h: Math.round(r.height), couvert, par, sansNom: !nomAcc && !/hidden|submit|reset/.test(e.getAttribute('type') || '') });
                            });
                            window.scrollTo(0, 0);
                            return sortie;
                        }, SELECTEUR);
                        rel.controles = liste;
                        // (un contrôle « couvert » n'est un défaut que si le clic ne passe pas : confirmé plus bas, BTN-RECOUVERT)
                        for (const c of liste.filter(c => c.sansNom)) ctx.trouver({ gravite: 'moyenne', id: 'BTN-SANS-NOM', categorie: 'accessibilité', titre: `${f} (${nomProfil}) : ${c.tag}${c.type ? '[' + c.type + ']' : ''} ${c.l}×${c.h} sans nom accessible`, fichier: f, correctif: 'aria-label ou texte visible.', effort: 'S' });
                        if (nomProfil === 'mobile') {
                            const petits = liste.filter(c => (c.l < 32 || c.h < 32) && !c.desactive && c.tag !== 'a' || ((c.l < 24 || c.h < 24) && c.tag === 'a' && c.nom));
                            if (petits.length > 4) ctx.trouver({ gravite: 'basse', id: 'BTN-CIBLE-PETITE', categorie: 'mobile', titre: `${f} : ${petits.length} cibles tactiles trop petites (< 32 px)`, fichier: f, detail: petits.slice(0, 8).map(c => `${c.nom || c.tag} ${c.l}×${c.h}`).join('\n'), correctif: 'Zone tactile ≥ 44×44 (padding ou ::before invisible).', effort: 'M' });
                        }
                        // liens : vides, ancres mortes
                        for (const c of liste.filter(c => c.tag === 'a')) {
                            if (c.href === '#' || /^javascript:/i.test(c.href) || c.href === '') ctx.trouver({ gravite: 'basse', id: 'LIEN-VIDE', categorie: 'bug', titre: `${f} : lien « ${c.nom} » sans destination (${c.href || 'href vide'})`, fichier: f, effort: 'S' });
                            else if (c.href.startsWith('#') && c.href.length > 1) { const ok = await page.evaluate((id) => !!document.getElementById(id) || !!document.getElementsByName(id)[0], c.href.slice(1)); if (!ok) ctx.trouver({ gravite: 'moyenne', id: 'LIEN-ANCRE-MORTE', categorie: 'bug', titre: `${f} : l'ancre ${c.href} (« ${c.nom} ») n'existe pas`, fichier: f, effort: 'S' }); }
                        }
                        const texte = await page.evaluate(() => document.body.innerText.trim().length);
                        rel.texte = texte;
                        if (texte < 40) ctx.trouver({ gravite: 'haute', id: 'PAGE-VIDE', categorie: 'bug', titre: `${f} (${nomProfil}) : page quasi vide (${texte} caractères)`, fichier: f, effort: 'M' });

                        // ── 2. clics réels (bureau seulement) ──
                        if (nomProfil === 'bureau' && !process.env.BOUTONS_SANS_CLICS) {
                            const vus = new Map(); const cibles = [];
                            for (const c of liste) {
                                if (c.desactive || c.type === 'file' || SAUTER.test(c.nom)) continue;
                                if (c.tag === 'a' && (/^https?:/i.test(c.href) && !c.href.startsWith(J.url))) continue;
                                if (c.tag === 'input' && /text|search|email|password|number|url|tel|date/.test(c.type || 'text') ) continue;
                                if (c.tag === 'textarea') continue;
                                const cle = [c.tag, c.type, c.role, c.nom.replace(/\d+/g, '#').slice(0, 30), c.href.replace(/[?#].*/, '').replace(/\d+/g, '#')].join('|');
                                vus.set(cle, (vus.get(cle) || 0) + 1);
                                if (vus.get(cle) <= 2) cibles.push(c);
                            }
                            const debut = Date.now();
                            for (const c of cibles.slice(0, MAX)) {
                                if (Date.now() - debut > 110000) { rel.tronque = true; break; }
                                // re-trouve le contrôle par son index d'origine (même DOM tant qu'on n'a pas navigué)
                                const avant = { url: page.url(), reqs: evt.reqs, ko: evt.ko.length, con: evt.console.length, exc: evt.exceptions.length, dlg: evt.dialogues, pop: evt.popups, dl: evt.telechargements };
                                let etat;
                                try {
                                    etat = await page.evaluate(({ SEL, i }) => {
                                        const e = document.querySelectorAll(SEL)[i]; if (!e) return null;
                                        e.scrollIntoView({ block: 'center', inline: 'center' });
                                        const r = e.getBoundingClientRect();
                                        window.__sondeMut = 0;
                                        if (!window.__sondeObs) { window.__sondeObs = new MutationObserver(m => { window.__sondeMut += m.length; }); window.__sondeObs.observe(document.documentElement, { subtree: true, childList: true, attributes: true, characterData: true }); }
                                        const dial = () => document.querySelectorAll('[role=dialog],[aria-modal="true"],dialog[open],.mh-modal,.mh-feuille,.mh-overlay').length;
                                        window.__sondeDialAvant = dial();
                                        return { x: r.left + r.width / 2, y: r.top + r.height / 2, attr: e.outerHTML.slice(0, 0) };
                                    }, { SEL: SELECTEUR, i: c.i });
                                } catch (e) { break; }
                                if (!etat) continue;
                                rel.clics++;
                                try { await page.mouse.click(etat.x, etat.y); } catch (e) { continue; }
                                await page.waitForTimeout(650);
                                const apres = await page.evaluate(() => ({ mut: window.__sondeMut || 0, dial: document.querySelectorAll('[role=dialog],[aria-modal="true"],dialog[open],.mh-modal,.mh-feuille,.mh-overlay').length, avant: window.__sondeDialAvant, y: scrollY })).catch(() => ({ mut: 0, dial: 0, avant: 0, y: 0 }));
                                const effet = {
                                    nav: page.url() !== avant.url, mut: apres.mut, dialogue: apres.dial > apres.avant, reqs: evt.reqs - avant.reqs, ko: evt.ko.slice(avant.ko), erreurs: evt.console.slice(avant.con).concat(evt.exceptions.slice(avant.exc)),
                                    fenetres: evt.dialogues - avant.dlg, popups: evt.popups - avant.pop, dl: evt.telechargements - avant.dl,
                                };
                                c.effet = effet;
                                const aEffet = effet.nav || effet.mut > 0 || effet.dialogue || effet.reqs > 0 || effet.fenetres || effet.popups || effet.dl;
                                if (!aEffet && /(play|lecture)\s*\/\s*pause/i.test(c.nom)) { /* lecteur sans piste : sans effet attendu */ }
                                else if (!aEffet && c.couvert && c.tag !== 'input' && c.tag !== 'select') ctx.trouver({ gravite: 'haute', id: 'BTN-RECOUVERT', categorie: 'bug', titre: `${f} : « ${c.nom || c.tag} » ne répond pas au clic — recouvert par ${c.par.el}`, fichier: f, detail: `fond ${c.par.fond}, opacité ${c.par.opacite}, position ${c.par.pos}, z-index ${c.par.z}`, correctif: 'Le clic atteint la couche et non le contrôle : pointer-events:none sur la couche, ou rehausser le contrôle.', effort: 'S' });
                                else if (!aEffet && c.tag !== 'input' && c.tag !== 'select') ctx.trouver({ gravite: 'moyenne', id: 'BTN-MORT', categorie: 'bug', titre: `${f} : « ${c.nom || c.tag} » ne produit aucun effet visible au clic`, fichier: f, detail: `${c.tag}${c.role ? '[role=' + c.role + ']' : ''} ${c.l}×${c.h} · aucun changement du DOM, aucune requête, aucune fenêtre`, correctif: 'Vérifier le gestionnaire : écouteur absent ou jeté par une erreur au chargement ; ou contrôle décoratif à retirer/griser.', effort: 'S' });
                                if (effet.erreurs.length) ctx.trouver({ gravite: 'haute', id: 'BTN-ERREUR-CLIC', categorie: 'bug', titre: `${f} : clic sur « ${c.nom || c.tag} » → erreur JavaScript`, fichier: f, detail: effet.erreurs.slice(0, 3).join('\n'), effort: 'S' });
                                if (effet.ko.length) ctx.trouver({ gravite: 'haute', id: 'BTN-RESEAU-KO', categorie: 'bug', titre: `${f} : clic sur « ${c.nom || c.tag} » → requête en échec (${effet.ko[0]})`, fichier: f, detail: effet.ko.join('\n'), effort: 'S' });
                                // le clic a pu ouvrir le dock musique (il persiste d'une page à l'autre) : on le retire
                                await page.evaluate(() => { document.getElementById('inko-music')?.remove(); document.querySelector('.itr-astuce')?.remove(); document.querySelectorAll('audio,video').forEach(m => { try { m.pause(); } catch (e) { /* rien */ } }); }).catch(() => { });
                                // remise en état
                                if (effet.nav) {
                                    if (/^https?:\/\/(?!127\.0\.0\.1)/.test(page.url())) { await page.goBack().catch(() => { }); }
                                    else { c.va = page.url().replace(J.url, ''); }
                                    await page.goto(`${J.url}/${cible}`, { waitUntil: 'load', timeout: 20000 }).catch(() => { });
                                    await page.waitForTimeout(1500);
                                } else if (effet.dialogue) {
                                    await page.keyboard.press('Escape').catch(() => { });
                                    await page.waitForTimeout(250);
                                    const encore = await page.evaluate(() => document.querySelectorAll('[role=dialog],[aria-modal="true"],dialog[open],.mh-modal,.mh-feuille,.mh-overlay').length);
                                    if (encore) { await page.goto(`${J.url}/${cible}`, { waitUntil: 'load', timeout: 20000 }).catch(() => { }); await page.waitForTimeout(1500); }
                                }
                            }
                        }
                    } catch (e) { rel.echec = e.message.slice(0, 160); ctx.trouver({ gravite: 'moyenne', id: 'BTN-PAGE-INTERROMPUE', categorie: 'bug', titre: `${f} (${nomProfil}) : exploration interrompue — ${e.message.slice(0, 100)}`, fichier: f, effort: 'S' }); }
                    inventaire[`${f}|${nomProfil}`] = { controles: rel.controles.length, clics: rel.clics, tronque: !!rel.tronque, texte: rel.texte, liste: rel.controles.map(c => ({ tag: c.tag, type: c.type, nom: c.nom, href: c.href, l: c.l, h: c.h, couvert: c.couvert, effet: c.effet ? { nav: c.effet.nav, mut: c.effet.mut, dialogue: c.effet.dialogue, reqs: c.effet.reqs, ko: c.effet.ko.length, err: c.effet.erreurs.length, va: c.va } : undefined })) };
                    await page.close();
                }
                await contexte.close();
            }
            ctx.mesure('boutons_inventaire_resume', Object.fromEntries(Object.entries(inventaire).map(([k, v]) => [k, v.saute ? 'sauté' : `${v.controles} contrôles, ${v.clics} clics`])));
            ctx.mesure('boutons_hotes_externes_demandes_par_le_navigateur', Object.fromEntries(externes));
            // passe partielle (BOUTONS_PAGES) : on FUSIONNE avec l'inventaire déjà établi au lieu de l'écraser
            const fichierInv = path.join(ctx.racine, 'docs', 'audit', 'inventaire-controles.json');
            let ancien = {}; if (filtre.length) { try { ancien = JSON.parse(fs.readFileSync(fichierInv, 'utf8')); } catch (e) { /* aucun inventaire antérieur */ } }
            fs.writeFileSync(fichierInv, JSON.stringify({ ...ancien, ...inventaire }, null, 1));
            if (externes.size) ctx.trouver({ gravite: 'basse', id: 'VIE-PRIVEE-HOTES-EXTERNES', categorie: 'confidentialité', titre: `Le navigateur contacte directement ${externes.size} hôte(s) externe(s) : ${[...externes.keys()].slice(0, 8).join(', ')}`, detail: [...externes].map(([h, n]) => `${h} ×${n}`).join('\n'), correctif: 'Chaque appel direct révèle l\'adresse IP et la page consultée au tiers ; passer par le proxy local (ou auto-héberger la police/icône) et le déclarer dans la page Confidentialité.', effort: 'S' });

            // ── 3a. scénario : « Mettre à jour » de la bibliothèque (le truc violet) ──
            try {
                const ctxM = await nav.newContext({ viewport: { width: 1366, height: 800 }, serviceWorkers: 'block', locale: 'fr-FR' });
                await ctxM.addInitScript(() => { try { localStorage.setItem('mh_eula_v2', '1'); localStorage.setItem('inko_consent', '1'); localStorage.setItem('inko_tour_done', '1'); localStorage.setItem('mh_install_dismissed', '1'); localStorage.removeItem('inko_lib_lastcheck'); } catch (e) { /* stockage */ } });
                await ctxM.route('**/*', (route) => { const u = route.request().url(); return (u.startsWith(J.url) || u.startsWith('data:') || u.startsWith('blob:')) ? route.continue() : route.abort(); });
                const p = await ctxM.newPage();
                await p.goto(`${J.url}/bibliotheque.html`, { waitUntil: 'load', timeout: 30000 });
                await p.waitForTimeout(2500);
                const analyse = () => p.evaluate(() => {
                    const b = document.getElementById('btnLibRefresh'); if (!b) return { absent: true };
                    const r = b.getBoundingClientRect(); const pts = [];
                    for (const fx of [0.1, 0.5, 0.9]) for (const fy of [0.2, 0.5, 0.8]) pts.push([r.left + r.width * fx, r.top + r.height * fy]);
                    const couches = new Map();
                    for (const [x, y] of pts) for (const e of document.elementsFromPoint(x, y)) { if (e === b || b.contains(e) || e.contains(b) || e === document.documentElement || e === document.body) continue; const s = getComputedStyle(e); const k = e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + (typeof e.className === 'string' && e.className ? '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.') : ''); if (!couches.has(k)) couches.set(k, { fond: s.backgroundColor, opacite: s.opacity, pos: s.position, z: s.zIndex, points: 0 }); couches.get(k).points++; }
                    const barre = document.querySelector('.lib-scan-bar'); const rb = barre && barre.getBoundingClientRect();
                    const st = document.getElementById('libRefreshStatus'); const rs = st && st.getBoundingClientRect();
                    const cs = getComputedStyle(b);
                    return { bouton: { x: Math.round(r.left), y: Math.round(r.top), l: Math.round(r.width), h: Math.round(r.height), fond: cs.backgroundColor, opacite: cs.opacity, desactive: b.disabled }, couches: [...couches].map(([k, v]) => ({ k, ...v })), barre: rb ? { x: Math.round(rb.left), y: Math.round(rb.top), l: Math.round(rb.width), h: Math.round(rb.height), chevauche: !(rb.right < r.left || rb.left > r.right || rb.bottom < r.top || rb.top > r.bottom) } : null, statut: st ? { x: Math.round(rs.left), y: Math.round(rs.top), l: Math.round(rs.width), h: Math.round(rs.height), texte: st.textContent.replace(/\s+/g, ' ').trim().slice(0, 80) } : null };
                });
                const temps = [];
                const avant = await analyse();
                await p.screenshot({ path: path.join(captures, 'maj-0-repos.jpg'), type: 'jpeg', quality: 62, clip: { x: 0, y: 0, width: 1366, height: 420 } }).catch(() => { });
                if (avant.absent) { ctx.trouver({ gravite: 'haute', id: 'MAJ-BOUTON-ABSENT', titre: 'Le bouton #btnLibRefresh est introuvable sur la page Bibliothèque', fichier: 'bibliotheque.html', effort: 'S' }); }
                else {
                    const b = await p.$('#btnLibRefresh'); const bb = await b.boundingBox();
                    // chronométrage : quand le premier retour visuel arrive, et de combien tout bouge
                    await p.evaluate(() => {
                        const btn = document.getElementById('btnLibRefresh'), st = document.getElementById('libRefreshStatus');
                        const grille = document.querySelector('.manga-grid, .lib-grid, #libGrid, [class*="grid"]');
                        const maj = window.__maj = { t0: null, ev: [], pos: [] };
                        const T = () => maj.t0 === null ? -1 : Math.round(performance.now() - maj.t0);
                        btn.addEventListener('click', () => { maj.t0 = performance.now(); maj.ev.push(['clic', 0]); }, true);
                        if (st) new MutationObserver(() => maj.ev.push(['statut', T(), st.textContent.replace(/\s+/g, ' ').trim().slice(0, 40)])).observe(st, { childList: true, subtree: true, characterData: true });
                        new MutationObserver(() => maj.ev.push(['bouton', T(), btn.disabled ? 'désactivé' : 'actif'])).observe(btn, { attributes: true });
                        const iv = setInterval(() => { if (maj.t0 === null) return; const r = btn.getBoundingClientRect(); const g = grille && grille.getBoundingClientRect(); maj.pos.push([T(), Math.round(r.left), Math.round(r.top), g ? Math.round(g.top) : null]); if (T() > 26000) clearInterval(iv); }, 100);
                    });
                    await p.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2); await p.mouse.down();
                    await p.screenshot({ path: path.join(captures, 'maj-1-appuye.jpg'), type: 'jpeg', quality: 62, clip: { x: 0, y: 0, width: 1366, height: 420 } }).catch(() => { });
                    temps.push({ t: 'appuyé (souris enfoncée)', ...await analyse() });
                    await p.mouse.up();
                    for (const [ms, nom] of [[400, 'maj-2-0s4'], [2500, 'maj-3-2s9'], [6000, 'maj-4-8s9']]) { await p.waitForTimeout(ms); await p.screenshot({ path: path.join(captures, nom + '.jpg'), type: 'jpeg', quality: 62, clip: { x: 0, y: 0, width: 1366, height: 420 } }).catch(() => { }); temps.push({ t: nom, ...await analyse() }); }
                    await p.waitForTimeout(14000);   // la fenêtre d'observation couvre jusqu'à ≈ 25 s : selon l'état des sources, le premier retour tarde de 7 à plus de 20 s
                    const chrono = await p.evaluate(() => window.__maj);
                    ctx.mesure('maj_analyse', temps);
                    ctx.mesure('maj_chronologie', chrono);
                    if (chrono && chrono.ev) {
                        // premier retour VISIBLE : un texte de statut, ou le bouton qui change d'état
                        const premier = chrono.ev.find(e => ((e[0] === 'statut' && e[2]) || e[0] === 'bouton') && e[1] >= 0);
                        const dsb = chrono.ev.find(e => e[0] === 'bouton' && e[1] >= 0);
                        const delai = premier ? premier[1] : null;
                        if (delai === null || delai > 700) ctx.trouver({ gravite: 'haute', id: 'MAJ-RETOUR-TARDIF', categorie: 'bug', titre: `« Mettre à jour » : le premier retour visuel arrive ${delai === null ? 'jamais' : 'après ' + delai + ' ms'} (bouton ${dsb ? 'désactivé à ' + dsb[1] + ' ms' : 'jamais désactivé'})`, fichier: 'assets/js/bibliotheque.js', ligne: 566, detail: 'Le gestionnaire écrit « Vérification… » et désactive le bouton au clic ; si l\'écran ne change pas, l\'utilisateur re-clique ou croit à un blocage.\nÉvénements : ' + JSON.stringify(chrono.ev.slice(0, 12)), correctif: 'Retour immédiat (< 100 ms) : bouton en état « en cours » avec icône qui tourne, avant tout appel réseau.', effort: 'S' });
                        const xs = chrono.pos.map(q => q[1]), gs = chrono.pos.map(q => q[3]).filter(v => v !== null);
                        const dx = xs.length ? Math.max(...xs) - Math.min(...xs) : 0, dg = gs.length ? Math.max(...gs) - Math.min(...gs) : 0;
                        ctx.mesure('maj_decalages', { bouton_px: dx, grille_px: dg });
                        if (dx > 6 || dg > 6) ctx.trouver({ gravite: 'haute', id: 'MAJ-DECALAGE-PENDANT-SCAN', categorie: 'mise en page', titre: `« Mettre à jour » : pendant le scan le bouton se déplace de ${dx} px et la grille de ${dg} px sous le pointeur`, fichier: 'assets/css/bibliotheque.css', ligne: 331, detail: 'La ligne de statut (#libRefreshStatus) apparaît dans le flux et pousse la barre d\'outils et la grille : le bouton bouge pendant qu\'on le clique, et la barre de progression violette surgit en dessous.', correctif: 'Réserver la hauteur de la ligne de statut (min-height) ou la superposer en position absolue ; mettre le compteur dans le bouton.', effort: 'S' });
                    }
                    for (const a of temps) {
                        const voile = (a.couches || []).filter(c => c.fond && c.fond !== 'rgba(0, 0, 0, 0)' && c.fond !== 'transparent' && c.points >= 3);
                        if (voile.length) ctx.trouver({ gravite: 'haute', id: 'MAJ-VOILE-SUR-BOUTON', categorie: 'bug', titre: `Bibliothèque « Mettre à jour » (${a.t}) : une couche colorée recouvre le bouton`, fichier: 'assets/js/bibliotheque.js', detail: voile.map(v => `${v.k} fond ${v.fond} opacité ${v.opacite} position ${v.pos} z ${v.z} (${v.points}/9 points)`).join('\n'), correctif: 'Identifier la couche et lui retirer pointer-events / la ranger sous le bouton ; voir §3.3.', effort: 'S' });
                        if (a.barre && a.barre.chevauche) ctx.trouver({ gravite: 'haute', id: 'MAJ-BARRE-CHEVAUCHE', categorie: 'bug', titre: `Bibliothèque « Mettre à jour » (${a.t}) : la barre de progression violette chevauche le bouton`, fichier: 'assets/css/bibliotheque.css', ligne: 283, detail: JSON.stringify({ bouton: a.bouton, barre: a.barre, statut: a.statut }), effort: 'S' });
                    }
                    const sizes = temps.map(a => a.statut && a.statut.l).filter(Boolean);
                    if (new Set(sizes).size > 2) ctx.trouver({ gravite: 'moyenne', id: 'MAJ-STATUT-REDIMENSIONNE', categorie: 'mise en page', titre: `Le statut voisin du bouton change de largeur pendant le scan (${[...new Set(sizes)].join(' → ')} px) : la mise en page bouge sous le doigt`, fichier: 'assets/js/bibliotheque.js', ligne: 283, correctif: 'Largeur fixe + tabular-nums ; compteur dans le bouton.', effort: 'S' });
                }
                await ctxM.close();
            } catch (e) { ctx.trouver({ gravite: 'info', id: 'MAJ-SCENARIO-INTERROMPU', titre: 'Scénario mise à jour interrompu : ' + e.message }); }
        } finally { await nav.close().catch(() => { }); await J.arreter(); }
    },
};
