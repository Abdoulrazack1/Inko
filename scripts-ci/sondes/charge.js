// charge — ce que devient l'application quand la bibliothèque grossit, ce que chaque page
// télécharge réellement, et ce qui s'accumule quand on répète les mêmes gestes.
'use strict';
const zlib = require('zlib');
const http = require('http');
const E = require('./_explore');

const brut = (url, jeton) => new Promise((ok) => { const t0 = Date.now(); http.get(url, { headers: { 'accept-encoding': 'gzip, br', ...(jeton ? { authorization: 'Bearer ' + jeton } : {}) } }, (r) => { const m = []; r.on('data', d => m.push(d)); r.on('end', () => { const b = Buffer.concat(m); ok({ ms: Date.now() - t0, octets: b.length, codage: r.headers['content-encoding'] || '', cache: r.headers['cache-control'] || '', etag: !!r.headers.etag, statut: r.statusCode }); }); }).on('error', () => ok({ ms: 0, octets: 0 })); });

module.exports = {
    nom: 'charge',
    description: '2 000 et 10 000 favoris, poids réel de chaque page, requêtes en double, code inutilisé, fuites après gestes répétés',
    async run(ctx) {
        const o = await E.ouvrir(ctx, { base: 'inko_s_charge', port: 8103 });
        if (!o) return;
        const { J, nav } = o;
        const T = (gravite, id, titre, detail, correctif, extra = {}) => ctx.trouver({ gravite, id, categorie: 'performance', titre, detail, correctif, effort: 'M', ...extra });
        try {
            const d = await E.semer(J, { favoris: 12 });
            const [u] = await J.sql('SELECT id FROM users ORDER BY id LIMIT 1'); const uid = u.id;
            const remplir = async (n) => {
                for (let i = 0; i < n; i += 1000) {
                    const lot = Array.from({ length: Math.min(1000, n - i) }, (_, k) => { const x = i + k; return [uid, `vol-${x}`, ['mangadex', 'weebcentral', 'sushiscan'][x % 3], `Série volumineuse numéro ${x} — un titre assez long pour ressembler à un vrai`, `https://uploads.mangadex.org/covers/x/${x}.jpg`]; });
                    await J.sql('INSERT IGNORE INTO favorites (user_id, manga_id, source, title, cover) VALUES ?', [lot]);
                    await J.sql('INSERT IGNORE INTO progress (user_id, manga_id, chapter_id, chapter_number, page, source) VALUES ?', [lot.map(l => [uid, l[1], 'c', 5, 1, l[2]])]);
                    await J.sql('INSERT INTO events (user_id, type, manga_id, source) VALUES ?', [lot.flatMap(l => [[uid, 'read', l[1], l[2]], [uid, 'favorite', l[1], l[2]], [uid, 'read', l[1], l[2]]])]);
                    await J.sql('INSERT IGNORE INTO read_chapters (user_id, manga_id, chapter_id, chapter_number) VALUES ?', [lot.flatMap(l => Array.from({ length: 8 }, (_, c) => [uid, l[1], 'r' + c, c + 1]))]);
                }
            };
            const volumes = {};
            const API_LOURDES = ['/me/favorites', '/me/progress', '/me/read-chapters', '/me/stats', '/me/stats/distribution', '/me/events', '/me/export', '/me/library', '/me/updates?cached=1', '/me/notifications'];
            for (const [nom, ajout] of [['12', 0], ['2000', 2000], ['10000', 10000]]) {
                if (ajout) await remplir(ajout);
                const api = {};
                for (const c of API_LOURDES) { const r = await brut(J.url + '/api' + c, J.jeton); api[c] = { ms: r.ms, ko: Math.round(r.octets / 1024), statut: r.statusCode || r.statut }; }
                const pages = {};
                const c = await E.contexte(nav, J);
                for (const f of ['accueil.html', 'bibliotheque.html', 'stats.html', 'profil.html', 'catalogue.html', 'collections.html']) {
                    const p = await c.newPage(); const s = E.surveiller(p);
                    await p.addInitScript(() => { window.__long = 0; window.__pire = 0; try { new PerformanceObserver(l => { for (const e of l.getEntries()) { window.__long += e.duration; window.__pire = Math.max(window.__pire, e.duration); } }).observe({ type: 'longtask', buffered: true }); } catch (e) { /* non supporté */ } });
                    const cdp = await c.newCDPSession(p); await cdp.send('Performance.enable');
                    const t0 = Date.now();
                    try {
                        await p.goto(`${J.url}/${f}`, { waitUntil: 'load', timeout: 60000 });
                        let n0 = -1, stable = 0; for (let i = 0; i < 80 && stable < 4; i++) { await p.waitForTimeout(400); const n = await p.evaluate(() => document.getElementsByTagName('*').length); stable = n === n0 ? stable + 1 : 0; n0 = n; }
                        const total = Date.now() - t0 - 1600;
                        const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value]));
                        const l = await p.evaluate(() => ({ long: Math.round(window.__long), pire: Math.round(window.__pire), images: document.images.length }));
                        // un geste : saisir dans le filtre
                        let saisie = null;
                        if (f === 'bibliotheque.html') { const h = await p.$('input[type=search], #libSearch, input[placeholder*="ilt"], input[placeholder*="herch"]'); if (h && await h.isVisible()) { await p.evaluate(() => { window.__long = 0; }); const t = Date.now(); await h.type('numéro 19', { delay: 30 }); await p.waitForTimeout(900); saisie = { ms: Date.now() - t - 900 - 270, long: await p.evaluate(() => Math.round(window.__long)) }; } }
                        pages[f] = { ms: total, noeuds: n0, tas: Math.round(m.JSHeapUsedSize / 1048576), ecouteurs: m.JSEventListeners, long: l.long, pire: l.pire, images: l.images, saisie };
                        if (ajout) {
                            if (n0 > 8000) T(n0 > 20000 ? 'haute' : 'moyenne', 'VOL-DOM', `${f} avec ${nom} favoris : ${n0.toLocaleString('fr-FR')} éléments dans la page`, `Rendu en ${total} ms, ${l.long} ms de tâches longues (pire : ${l.pire} ms), ${pages[f].tas} Mo de mémoire.`, 'Liste virtualisée ou pagination ; ne construire que ce qui est à l\'écran.', { fichier: f });
                            if (l.pire > 400) T(l.pire > 1500 ? 'haute' : 'moyenne', 'VOL-BLOCAGE', `${f} avec ${nom} favoris : l'écran se fige ${l.pire} ms d'un coup`, `Total des tâches longues : ${l.long} ms.`, 'Découper le rendu (par lots, requestIdleCallback).', { fichier: f });
                            if (saisie && saisie.long > 500) T('moyenne', 'VOL-SAISIE', `${f} avec ${nom} favoris : filtrer bloque ${saisie.long} ms`, '', 'Différer le filtrage (150 ms) et ne pas reconstruire la grille.', { fichier: f });
                        }
                        if (s.exceptions.length) T('haute', 'VOL-EXCEPTION', `${f} avec ${nom} favoris : exception`, s.exceptions.slice(0, 3).join('\n'), '', { fichier: f, categorie: 'bug' });
                    } catch (e) { T('haute', 'VOL-ECHEC', `${f} avec ${nom} favoris : la page n'aboutit pas`, e.message.slice(0, 200), 'Pagination côté serveur.', { fichier: f }); }
                    await p.close();
                }
                await c.close();
                volumes[nom] = { api, pages };
                if (ajout) for (const [route, r] of Object.entries(api)) {
                    if (r.ms > 800) T(r.ms > 3000 ? 'haute' : 'moyenne', 'VOL-API-LENTE', `GET /api${route} : ${r.ms} ms avec ${nom} favoris`, `${r.ko} Ko transférés (compressés).`, 'Pagination, index, ou agrégats calculés à l\'écriture.', { fichier: 'server/controllers/user.controller.js' });
                    if (r.ko > 300) T('moyenne', 'VOL-API-LOURDE', `GET /api${route} : ${r.ko} Ko compressés avec ${nom} favoris`, '', 'Pagination ; ne renvoyer que les champs affichés.', { fichier: 'server/controllers/user.controller.js' });
                }
            }
            ctx.mesure('charge_volumes', volumes);
            await J.sql("DELETE FROM events WHERE user_id = ?", [uid]); for (const t of ['favorites', 'progress', 'read_chapters']) await J.sql(`DELETE FROM ${t} WHERE user_id = ? AND manga_id LIKE 'vol-%'`, [uid]);

            // ── poids réel, requêtes en double, compression, cache, code inutilisé ──
            const reseau = {}; const nonCompresses = new Map(); const sansCache = new Map(); const couverture = new Map();
            const c = await E.contexte(nav, J);
            for (const [f, url] of E.adresses(ctx, d)) {
                const p = await c.newPage(); const req = [];
                p.on('request', r => { if (r.url().startsWith(J.url)) req.push(r.method() + ' ' + r.url().slice(J.url.length)); });
                await p.coverage.startJSCoverage({ resetOnNavigation: false }); await p.coverage.startCSSCoverage({ resetOnNavigation: false });
                try { await p.goto(`${J.url}/${url}`, { waitUntil: 'load', timeout: 25000 }); await p.waitForTimeout(2500); } catch (e) { /* signalé ailleurs */ }
                const js = await p.coverage.stopJSCoverage(), css = await p.coverage.stopCSSCoverage();
                let total = 0, utile = 0;
                for (const e of js) { if (!e.url.startsWith(J.url) || !e.source) continue; const vus = new Uint8Array(e.source.length); for (const fn of e.functions) for (const r of fn.ranges) vus.fill(r.count ? 1 : 0, r.startOffset, r.endOffset); let n = 0; for (const x of vus) n += x; const k = e.url.slice(J.url.length).split('?')[0]; total += e.source.length; utile += n; const cur = couverture.get(k) || { taille: e.source.length, vus: new Uint8Array(e.source.length), pages: 0 }; for (let i = 0; i < vus.length && i < cur.vus.length; i++) cur.vus[i] |= vus[i]; cur.pages++; couverture.set(k, cur); }
                let ct = 0, cu = 0; for (const e of css) { if (!e.url.startsWith(J.url)) continue; ct += (e.text || '').length; cu += e.ranges.reduce((n, r) => n + r.end - r.start, 0); }
                const compte = {}; for (const r of req) compte[r] = (compte[r] || 0) + 1;
                const doubles = Object.entries(compte).filter(([k, n]) => n > 1 && /^GET \/api\//.test(k) && !/\/api\/img/.test(k));
                const perf = await p.evaluate(() => performance.getEntriesByType('resource').filter(r => r.name.startsWith(location.origin)).map(r => ({ u: r.name.slice(location.origin.length), t: r.transferSize, d: r.decodedBodySize, e: r.encodedBodySize })));
                const poids = perf.reduce((n, r) => n + r.t, 0), decode = perf.reduce((n, r) => n + r.d, 0);
                for (const r of perf) if (r.d > 4096 && r.e >= r.d * 0.97 && /\.(js|css|html|json|svg)(\?|$)|\/api\/(?!img)/.test(r.u)) nonCompresses.set(r.u.split('?')[0], Math.round(r.d / 1024));
                reseau[f] = { requetes: req.length, api: req.filter(r => /\/api\//.test(r)).length, koTransferes: Math.round(poids / 1024), koDecodes: Math.round(decode / 1024), jsKo: Math.round(total / 1024), jsUtilise: total ? Math.round(utile / total * 100) : 0, cssKo: Math.round(ct / 1024), cssUtilise: ct ? Math.round(cu / ct * 100) : 0 };
                if (doubles.length) T('basse', 'NET-DOUBLON', `${f} : ${doubles.length} lecture(s) d'API demandée(s) plusieurs fois`, doubles.map(([k, n]) => `${n} × ${k.slice(0, 100)}`).join('\n'), 'Mutualiser la requête (SHARED_GET).', { fichier: f, effort: 'S' });
                if (decode > 1500 * 1024) T('moyenne', 'NET-POIDS', `${f} : ${Math.round(decode / 1024)} Ko à analyser au chargement`, JSON.stringify(reseau[f]), 'Charger à la demande les modules secondaires.', { fichier: f });
                if (total > 300 * 1024 && utile / total < 0.4) T('basse', 'NET-JS-INUTILE', `${f} : ${100 - reseau[f].jsUtilise} % des ${reseau[f].jsKo} Ko de JavaScript ne servent pas au chargement`, '', 'Découper global.js ; import à la demande.', { fichier: f });
                await p.close();
            }
            ctx.mesure('charge_reseau', reseau);
            const jamais = [...couverture].map(([k, v]) => { let n = 0; for (const x of v.vus) n += x; return { k, ko: Math.round(v.taille / 1024), pct: Math.round(n / v.taille * 100), pages: v.pages }; }).sort((a, b) => b.ko - a.ko);
            ctx.mesure('charge_couverture_js', jamais);
            for (const x of jamais) if (x.ko > 80) T('basse', 'NET-GROS-FICHIER', `${x.k} : ${x.ko} Ko, ${x.pct} % exécutés au chargement (${x.pages} pages)`, '', 'Découper par fonction ; ce fichier pèse sur chaque page qui le charge.', { fichier: x.k.slice(1), effort: 'L' });
            if (nonCompresses.size) T('moyenne', 'NET-NON-COMPRESSE', `${nonCompresses.size} réponse(s) textuelle(s) envoyée(s) sans compression`, [...nonCompresses].slice(0, 20).map(([k, n]) => `${k} (${n} Ko)`).join('\n'), 'compression() sur ces types.', { fichier: 'server/app.js', effort: 'S' });
            for (const f of ['/assets/js/global.js', '/assets/css/global.css', '/accueil.html', '/service-worker.js', '/assets/i18n/en.json']) { const r = await brut(J.url + f); if (r.statut === 200) { sansCache.set(f, `${r.cache || 'aucun Cache-Control'}${r.etag ? ' · ETag' : ''} · ${r.codage || 'non compressé'} · ${Math.round(r.octets / 1024)} Ko`); if (!r.cache && !r.etag) T('basse', 'NET-CACHE', `${f} : ni Cache-Control ni ETag`, '', '', { effort: 'S' }); } }
            ctx.mesure('charge_entetes', Object.fromEntries(sansCache));

            // ── fuites : le même geste 25 fois ──
            const fuites = {};
            for (const [f, gestes] of [['bibliotheque.html', ['#btnLibFilters', '[data-tab="bookmarks"]', '[data-tab="updates"]', '[data-tab="all"], [data-tab="favorites"]']], ['accueil.html', ['#ongletLatest', '#ongletPopular']], ['parametres.html', ['.settings-nav a:nth-child(2)', '.settings-nav a:nth-child(3)', '.settings-nav a:nth-child(1)']], ['catalogue.html', ['#btnFilters', '[data-view="list"]', '[data-view="grid"]']], ['notes.html', ['.notes-filtres button:nth-child(2)', '.notes-filtres button:nth-child(1)']], ['stats.html', ['[data-range="7"]', '[data-range="30"]']]]) {
                const p = await c.newPage(); const cdp = await c.newCDPSession(p); await cdp.send('Performance.enable');
                await p.goto(`${J.url}/${f}`, { waitUntil: 'load' }); await p.waitForTimeout(2500);
                const mesurer = async () => { await cdp.send('HeapProfiler.collectGarbage'); const m = Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(x => [x.name, x.value])); return { ecouteurs: m.JSEventListeners, noeuds: m.Nodes, tas: Math.round(m.JSHeapUsedSize / 1024) }; };
                const tour = async () => { let faits = 0; for (const g of gestes) { const h = await p.$(g); if (h && await h.isVisible()) { await h.click({ timeout: 800 }).then(() => faits++).catch(() => { }); await p.waitForTimeout(120); } } return faits; };
                for (let i = 0; i < 3; i++) await tour();
                const a = await mesurer(); let faits = 0; for (let i = 0; i < 25; i++) faits += await tour(); await p.waitForTimeout(1000); const b = await mesurer();
                fuites[f] = { gestes: faits, avant: a, apres: b };
                if (faits > 10 && (b.ecouteurs - a.ecouteurs > 60 || b.noeuds - a.noeuds > 1500 || b.tas - a.tas > 8000)) T('moyenne', 'MEM-FUITE', `${f} : ${b.ecouteurs - a.ecouteurs} écouteurs, ${b.noeuds - a.noeuds} nœuds et ${b.tas - a.tas} Ko de plus après ${faits} gestes`, JSON.stringify(fuites[f]), 'Délégation d\'événements ; retirer les écouteurs avant de reconstruire.', { fichier: f });
                await p.close();
            }
            ctx.mesure('charge_fuites', fuites);
            await c.close();
            // débit
            const salve = async (chemin, n, para) => { const t = []; for (let i = 0; i < n; i += para) { const r = await Promise.all(Array.from({ length: para }, () => brut(J.url + chemin, J.jeton))); t.push(...r); } const ms = t.map(x => x.ms).sort((a, b) => a - b); return { n: t.length, p50: ms[Math.floor(ms.length * .5)], p95: ms[Math.floor(ms.length * .95)], echecs: t.filter(x => x.statut !== 200 && x.statut !== 429).length }; };
            ctx.mesure('charge_debit', { favoris: await salve('/api/me/favorites', 300, 30), sante: await salve('/api/health', 300, 50), statique: await salve('/assets/js/global.js', 200, 40) });
        } finally { await o.fermer(); }
    },
};
