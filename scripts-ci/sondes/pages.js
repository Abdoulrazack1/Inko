// pages — chaque page réelle dans un vrai navigateur : erreurs, réseau, mise en page, axe, vitesse
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
const { lancerNavigateur } = require('./_navigateur');

module.exports = {
    nom: 'pages',
    description: 'Console/réseau/CLS/débordement/images cassées/axe/LCP sur toutes les pages, bureau et mobile',
    async run(ctx) {
        const base = process.env.INKO_URL || 'http://localhost:8088';
        const vivant = await new Promise(ok => { http.get(base + '/api/health', { timeout: 4000 }, r => { r.resume(); ok(r.statusCode < 500); }).on('error', () => ok(false)); });
        if (!vivant) { ctx.trouver({ gravite: 'info', id: 'PAGES-SKIP', titre: `Serveur injoignable sur ${base} : sonde des pages ignorée` }); return; }
        const pages = fs.readdirSync(ctx.racine).filter(f => f.endsWith('.html') && !/^(offline)/.test(f)).sort();
        const axeSrc = fs.readFileSync(path.join(ctx.racine, 'node_modules', 'axe-core', 'axe.min.js'), 'utf8');
        const nav = await lancerNavigateur();
        const releves = [];
        const profils = [['bureau', { viewport: { width: 1366, height: 800 } }], ['mobile', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }]];
        for (const [nomProfil, opts] of profils) {
            const contexte = await nav.newContext({ ...opts, serviceWorkers: 'block', locale: 'fr-FR' });
            // les dismissals connus : sans eux, la modale de consentement masque tout
            await contexte.addInitScript(() => {
                try { localStorage.setItem('mh_eula_v2', '1'); localStorage.setItem('inko_consent', '1'); localStorage.setItem('inko_tour_done', '1'); localStorage.setItem('mh_install_dismissed', '1'); } catch (e) { /* stockage */ }
                window.__cls = 0; window.__lcp = 0; window.__long = 0;
                try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true }); } catch (e) { /* non supporté */ }
                try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__lcp = e.startTime; }).observe({ type: 'largest-contentful-paint', buffered: true }); } catch (e) { /* non supporté */ }
                try { new PerformanceObserver(l => { for (const e of l.getEntries()) window.__long += e.duration; }).observe({ type: 'longtask', buffered: true }); } catch (e) { /* non supporté */ }
            });
            for (const f of pages) {
                const page = await contexte.newPage();
                const rel = { page: f, profil: nomProfil, erreursConsole: [], erreursPage: [], reseauKO: [], octets: 0, requetes: 0, hotes: new Set() };
                page.on('console', m => { if (m.type() === 'error') rel.erreursConsole.push(m.text().slice(0, 200)); });
                page.on('pageerror', e => rel.erreursPage.push(String(e.message).slice(0, 200)));
                page.on('requestfailed', r => { const u = r.url(); if (!/\/api\/img\?|fonts\.g|doubleclick|google-analytics/.test(u)) rel.reseauKO.push(`${r.failure() && r.failure().errorText} ${u.slice(0, 120)}`); });
                page.on('response', async r => { rel.requetes++; try { const h = new URL(r.url()).host; rel.hotes.add(h); } catch (e) { /* url */ } const s = r.status(); if (s >= 400 && !/\/api\/img\?/.test(r.url())) rel.reseauKO.push(`${s} ${r.url().slice(0, 120)}`); try { const l = +r.headers()['content-length']; if (l) rel.octets += l; } catch (e) { /* tête */ } });
                const t0 = Date.now();
                try {
                    await page.goto(`${base}/${f}`, { waitUntil: 'load', timeout: 30000 });
                    await page.waitForTimeout(1500);
                    // rendu progressif (la bibliothèque monte ses cartes par lots) : on attend que le DOM cesse de grossir
                    for (let k = 0, dernier = -1, stable = 0; k < 12 && stable < 2; k++) { const n = await page.evaluate(() => document.getElementsByTagName('*').length); stable = n === dernier ? stable + 1 : 0; dernier = n; await page.waitForTimeout(700); }
                    rel.chargeMs = Date.now() - t0;
                    const m = await page.evaluate(() => {
                        const de = document.documentElement;
                        const imgs = [...document.images];
                        const sansAlt = imgs.filter(i => !i.hasAttribute('alt')).length;
                        const cassees = imgs.filter(i => i.complete && i.naturalWidth === 0 && i.src && !i.src.startsWith('data:') && i.loading !== 'lazy').length;
                        const nav = performance.getEntriesByType('navigation')[0] || {};
                        const fcp = (performance.getEntriesByName('first-contentful-paint')[0] || {}).startTime;
                        // éléments plus larges que la fenêtre
                        const larges = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.right > de.clientWidth + 2 && getComputedStyle(e).position !== 'fixed' && !e.closest('[style*="overflow"], .scroll-x, [class*="scroll"], [class*="carousel"], [class*="rail"], pre, table'); }).slice(0, 3).map(e => (e.tagName + '.' + (e.className && e.className.baseVal === undefined ? String(e.className).slice(0, 40) : ''))).filter(Boolean);
                        const petitesCibles = [...document.querySelectorAll('a,button,[role=button],input,select')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24) && getComputedStyle(e).visibility !== 'hidden'; }).length;
                        return { debordeX: de.scrollWidth > de.clientWidth + 2, scrollW: de.scrollWidth, clientW: de.clientWidth, imgs: imgs.length, imgsSansAlt: sansAlt, imgsCassees: cassees, cls: window.__cls, lcp: Math.round(window.__lcp), fcp: Math.round(fcp || 0), longTasks: Math.round(window.__long), dcl: Math.round(nav.domContentLoadedEventEnd || 0), noeuds: document.getElementsByTagName('*').length, larges, petitesCibles, titre: document.title, h1: document.querySelectorAll('h1').length };
                    });
                    Object.assign(rel, m);
                    if (nomProfil === 'bureau') {
                        try { await page.evaluate(axeSrc); rel.axe = await page.evaluate(async () => { const r = await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] } }); return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, aide: v.help, ex: (v.nodes[0] && v.nodes[0].target || []).join(' ').slice(0, 100) })); }); } catch (e) { rel.axe = []; }
                    }
                } catch (e) { rel.echec = e.message.slice(0, 150); }
                rel.hotes = [...rel.hotes];
                releves.push(rel);
                await page.close();
            }
            await contexte.close();
        }
        await nav.close();
        ctx.mesure('pages_releve', releves.map(r => ({ page: r.page, profil: r.profil, chargeMs: r.chargeMs, lcp: r.lcp, fcp: r.fcp, cls: r.cls && +r.cls.toFixed(3), noeuds: r.noeuds, longTasks: r.longTasks, requetes: r.requetes, ko: r.reseauKO && r.reseauKO.length, erreursConsole: r.erreursConsole && r.erreursConsole.length, erreursPage: r.erreursPage && r.erreursPage.length })));
        for (const r of releves) {
            const f = r.page;
            if (r.echec) { ctx.trouver({ gravite: 'haute', id: 'PAGE-NE-CHARGE-PAS', categorie: 'bug', titre: `${f} (${r.profil}) : échec de chargement`, fichier: f, detail: r.echec, effort: 'M' }); continue; }
            if (r.erreursPage.length) ctx.trouver({ gravite: 'haute', id: 'PAGE-EXCEPTION-JS', categorie: 'bug', titre: `${f} (${r.profil}) : exception JavaScript non rattrapée`, fichier: f, detail: [...new Set(r.erreursPage)].join('\n'), effort: 'M' });
            if (r.erreursConsole.length) ctx.trouver({ gravite: 'moyenne', id: 'PAGE-ERREUR-CONSOLE', categorie: 'bug', titre: `${f} (${r.profil}) : ${r.erreursConsole.length} erreur(s) console`, fichier: f, detail: [...new Set(r.erreursConsole)].slice(0, 6).join('\n'), effort: 'S' });
            if (r.reseauKO.length) ctx.trouver({ gravite: 'moyenne', id: 'PAGE-RESEAU-KO', categorie: 'bug', titre: `${f} (${r.profil}) : ${r.reseauKO.length} requête(s) en échec`, fichier: f, detail: [...new Set(r.reseauKO)].slice(0, 8).join('\n'), effort: 'S' });
            if (r.debordeX) ctx.trouver({ gravite: r.profil === 'mobile' ? 'haute' : 'moyenne', id: 'PAGE-DEBORDEMENT-X', categorie: 'mise en page', titre: `${f} (${r.profil}) : défilement horizontal (${r.scrollW}px pour ${r.clientW}px)`, fichier: f, detail: 'Éléments fautifs : ' + (r.larges || []).join(', '), correctif: 'Repérer l\'élément le plus large (détail) : min-width, image sans max-width, flex sans min-width:0.', effort: 'S' });
            if (r.imgsCassees) ctx.trouver({ gravite: 'haute', id: 'PAGE-IMAGES-CASSEES', categorie: 'couvertures', titre: `${f} (${r.profil}) : ${r.imgsCassees} image(s) chargée(s) en échec`, fichier: f, correctif: 'Repli de couverture (voir plan covers).', effort: 'M' });
            if (r.cls > 0.1) ctx.trouver({ gravite: r.cls > 0.25 ? 'haute' : 'moyenne', id: 'PAGE-CLS', categorie: 'performance', titre: `${f} (${r.profil}) : décalage de mise en page CLS = ${r.cls.toFixed(2)}`, fichier: f, correctif: 'Réserver la place (aspect-ratio / min-height) des cartes et images avant leur arrivée.', effort: 'M' });
            if (r.lcp > 2500) ctx.trouver({ gravite: r.lcp > 4000 ? 'haute' : 'moyenne', id: 'PAGE-LCP', categorie: 'performance', titre: `${f} (${r.profil}) : LCP ${r.lcp} ms (cible < 2500)`, fichier: f, effort: 'M' });
            if (r.longTasks > 600) ctx.trouver({ gravite: 'moyenne', id: 'PAGE-TACHES-LONGUES', categorie: 'performance', titre: `${f} (${r.profil}) : ${r.longTasks} ms de tâches longues (fil principal bloqué)`, fichier: f, effort: 'M' });
            if (r.noeuds > 3000) ctx.trouver({ gravite: 'moyenne', id: 'PAGE-DOM-LOURD', categorie: 'performance', titre: `${f} (${r.profil}) : ${r.noeuds} nœuds DOM`, fichier: f, correctif: 'Virtualiser ou paginer les grilles ; content-visibility:auto sur les sections.', effort: 'M' });
            if (r.profil === 'mobile' && r.petitesCibles > 10) ctx.trouver({ gravite: 'basse', id: 'PAGE-CIBLES-PETITES', categorie: 'mobile', titre: `${f} : ${r.petitesCibles} cibles tactiles < 24 px`, fichier: f, correctif: 'Zone tactile minimale 44×44 (padding invisible).', effort: 'M' });
            for (const v of (r.axe || [])) ctx.trouver({ gravite: v.impact === 'critical' || v.impact === 'serious' ? 'haute' : 'moyenne', id: 'AXE-' + v.id.toUpperCase(), categorie: 'accessibilité', titre: `${f} : axe « ${v.id} » (${v.impact}) × ${v.n}`, fichier: f, detail: `${v.aide}\nex. ${v.ex}`, effort: 'S' });
        }
    },
};
