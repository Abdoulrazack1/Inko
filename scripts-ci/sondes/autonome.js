// autonome — l'application du téléphone sans PC : l'interface réellement construite pour
// l'APK, servie seule, comme au premier lancement. Pages, gestes sur place, sources embarquées.
'use strict';
const cp = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { lancerNavigateur } = require('./_navigateur');
const E = require('./_explore');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };

module.exports = {
    nom: 'autonome',
    description: 'Interface construite pour l\'APK, sans PC : chaque page, bibliothèque locale, sources embarquées',
    async run(ctx) {
        const T = (gravite, id, titre, detail, correctif, extra = {}) => ctx.trouver({ gravite, id, categorie: 'téléphone autonome', titre, detail, correctif, effort: 'M', ...extra });
        // construire dans une copie : mobile/www du dépôt n'est pas touché
        const copie = fs.mkdtempSync(path.join(os.tmpdir(), 'inko-apk-'));
        const jonction = path.join(copie, 'node_modules');
        let serveur, nav;
        try {
            for (const e of fs.readdirSync(ctx.racine, { withFileTypes: true })) {
                if (['node_modules', '.git', 'android', 'desktop-tauri', 'promo', 'mobile', 'test', 'test-results', 'docs', '.claude', '.taste-skill'].includes(e.name)) continue;
                fs.cpSync(path.join(ctx.racine, e.name), path.join(copie, e.name), { recursive: true, filter: (s) => !/[\\/]server[\\/](node_modules|uploads|backups|config)([\\/]|$)|[\\/]server[\\/]\.env$/.test(s) });
            }
            fs.symlinkSync(ctx.abs('node_modules'), jonction, 'junction');
            const b = cp.spawnSync(process.execPath, ['scripts-ci/build-mobile-www.js'], { cwd: copie, encoding: 'utf8', timeout: 180000 });
            const www = path.join(copie, 'mobile', 'www');
            ctx.mesure('autonome_construction', { code: b.status, sortie: String(b.stdout || '').split('\n').slice(-8).join('\n') });
            if (b.status !== 0 || !fs.existsSync(path.join(www, 'accueil.html'))) { T('haute', 'AUT-CONSTRUCTION', 'La construction de l\'interface de l\'APK échoue', ((b.stderr || '') + (b.stdout || '')).slice(-700), '', { fichier: 'scripts-ci/build-mobile-www.js' }); return; }
            const ancienne = ctx.abs('mobile', 'www', 'assets', 'js', 'api.js');
            if (fs.existsSync(ancienne) && fs.readFileSync(ancienne, 'utf8') !== fs.readFileSync(path.join(www, 'assets', 'js', 'api.js'), 'utf8')) T('moyenne', 'AUT-WWW-PERIME', 'mobile/www du dépôt n\'est plus celui que produirait la construction', `Dernière écriture : ${fs.statSync(ancienne).mtime.toISOString().slice(0, 10)}. Un APK construit sans relancer le script embarquerait une interface ancienne.`, 'Construire mobile/www juste avant chaque APK, dans le même script.', { fichier: 'scripts-ci/build-mobile-www.js', effort: 'S' });
            serveur = http.createServer((req, res) => { const p = path.join(www, decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html'); if (!p.startsWith(www) || !fs.existsSync(p) || fs.statSync(p).isDirectory()) { res.statusCode = 404; return res.end(); } res.setHeader('content-type', TYPES[path.extname(p)] || 'application/octet-stream'); fs.createReadStream(p).pipe(res); });
            await new Promise(ok => serveur.listen(8150, '127.0.0.1', ok));
            const base = 'http://127.0.0.1:8150';
            nav = await lancerNavigateur();
            const c = await nav.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', locale: 'fr-FR' });
            await c.addInitScript(() => { try { for (const k of ['mh_eula_v2', 'inko_consent', 'inko_tour_done', 'mh_install_dismissed', 'inko_autonome_vu']) localStorage.setItem(k, '1'); } catch (e) { /* stockage */ } });
            // les sources embarquées sont interrogées directement par le téléphone : lecture seule autorisée
            const externes = new Map();
            await c.route('**/*', (q) => { const r = q.request(); const u = r.url(); if (u.startsWith(base) || /^(data|blob):/.test(u)) return q.continue(); try { const h = new URL(u).host; externes.set(h, (externes.get(h) || 0) + 1); } catch (e) { /* url */ } if (!/GET|OPTIONS/.test(r.method()) && !/graphql/.test(u)) return q.abort();
                // sur l'appareil, CapacitorHttp fait la requête en natif, sans règle d'origine : on l'imite
                if (r.resourceType() === 'fetch' || r.resourceType() === 'xhr') { const h = { ...r.headers() }; delete h.origin; delete h.referer; return q.fetch({ headers: h, timeout: 15000 }).then(x => q.fulfill({ response: x, headers: { ...x.headers(), 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } })).catch(() => q.abort()); }
                return q.continue(); });
            const fantomes = new Set();
            const releves = {};
            const parPage = {};           // appels sortants déclenchés par chaque ouverture de page
            const sortants = () => [...externes].filter(([h]) => /sushiscan/.test(h)).reduce((n, [, k]) => n + k, 0);
            for (const f of fs.readdirSync(www).filter(x => x.endsWith('.html') && x !== 'offline.html')) {
                const avant = sortants();
                const p = await c.newPage(); const s = E.surveiller(p);
                p.on('request', (q) => { if (q.url().startsWith(base + '/api') || /localhost:8088/.test(q.url())) fantomes.add(f + ' → ' + q.url().replace(base, '').slice(0, 90)); });
                try {
                    await p.goto(`${base}/${f}`, { waitUntil: 'load', timeout: 20000 }); await p.waitForTimeout(6000);
                    const x = await p.evaluate(() => { const m = document.querySelector('main') || document.body; return { texte: m.innerText.replace(/\s+/g, ' ').trim(), autonome: !!window.INKO_AUTONOME, attente: [...document.querySelectorAll('[class*=spinner],[class*=squelette],[class*=skeleton]')].filter(e => e.getClientRects().length && getComputedStyle(e).display !== 'none').length, deborde: document.documentElement.scrollWidth - innerWidth }; });
                    const brutes = await E.lireValeursBrutes(p);
                    releves[f] = { longueur: x.texte.length, attente: x.attente, exceptions: s.exceptions.length };
                    if (!x.autonome && f !== 'anilist.html') T('moyenne', 'AUT-DRAPEAU', `${f} : le mode autonome n'est pas activé`, '', 'Charger hub.js avant api.js.', { fichier: f });
                    if (s.exceptions.length) T('haute', 'AUT-EXCEPTION', `${f} : exception au téléphone sans PC`, [...new Set(s.exceptions)].slice(0, 3).join('\n'), 'Le magasin local doit répondre à tous les appels de la page.', { fichier: f });
                    if (brutes.length) T('moyenne', 'AUT-VALEUR-BRUTE', `${f} : valeur manquante affichée au téléphone sans PC`, brutes.join('\n'), '', { fichier: f, effort: 'S' });
                    if (x.texte.length < 30) T('haute', 'AUT-PAGE-VIDE', `${f} : page vide sans PC`, x.texte, 'Dire ce qui nécessite le PC.', { fichier: f });
                    if (x.attente) T('moyenne', 'AUT-ATTENTE', `${f} : chargement sans fin sans PC`, `${x.attente} indicateur(s) après 6 s`, '', { fichier: f, effort: 'S' });
                    if (x.deborde > 3) T('moyenne', 'AUT-DEBORDE', `${f} : défilement horizontal de ${x.deborde} px dans l'APK`, '', '', { fichier: f, effort: 'S' });
                } catch (e) { T('haute', 'AUT-PAGE', `${f} : ne se charge pas`, e.message.split('\n')[0].slice(0, 160), '', { fichier: f }); }
                await p.close();
                parPage[f] = sortants() - avant;
            }
            ctx.mesure('autonome_pages', releves);
            ctx.mesure('autonome_appels_par_page', parPage);
            const gourmandes = Object.entries(parPage).filter(([, n]) => n > 15);
            if (gourmandes.length > 3) T('moyenne', 'AUT-INDEX-PAR-PAGE', `Sans PC, chaque ouverture de page relance des dizaines d'appels à SushiScan (${gourmandes.length} pages concernées)`, gourmandes.slice(0, 12).map(([f, n]) => `${f} : ${n} appels en 6 s`).join('\n') + '\n\nLes sources sont rechargées à chaque page et la source reconstruit son index des titres pour adultes sans pouvoir le garder.', 'Garder l\'index dans le stockage de l\'appareil et ne le construire qu\'à l\'usage de la source.', { fichier: 'assets/js/extensions-navigateur.js' });
            // gestes sur place : ajouter, retrouver, progresser, noter — puis recharger
            const p = await c.newPage(); const s = E.surveiller(p);
            await p.goto(base + '/accueil.html'); await p.waitForTimeout(2500);
            const gestes = await p.evaluate(async () => {
                const A = window.API; const out = {};
                const essayer = async (n, f) => { try { out[n] = await f(); } catch (e) { out[n] = 'ERREUR ' + e.message.slice(0, 90); } };
                await essayer('favori', async () => { await A.me.addFavorite('auto-1', { title: 'Sur place', source: 'mangadex' }); return true; });
                await essayer('progression', async () => { await A.me.setProgress('auto-1', { chapterId: 'c1', chapter: 1, page: 2, source: 'mangadex' }); return true; });
                await essayer('chapitre lu', async () => { await A.me.markChapter({ mangaId: 'auto-1', chapterId: 'c1', chapter: 1 }); return true; });
                await essayer('note', async () => { await A.me.addNote({ mangaId: 'auto-1', body: 'note sur place' }); return true; });
                await essayer('signet', async () => { await A.me.addBookmark({ mangaId: 'auto-1', chapterId: 'c1', source: 'mangadex', page: 2 }); return true; });
                await essayer('liste', async () => { await A.me.createList({ name: 'Locale' }); return true; });
                await essayer('statistiques', async () => !!(await A.me.stats()));
                await essayer('export', async () => !!(await A.me.exportData()));
                return out;
            });
            await p.reload(); await p.waitForTimeout(2500);
            const relu = await p.evaluate(async () => { const A = window.API; const v = async (f) => { try { return JSON.stringify(await f()); } catch (e) { return 'ERREUR ' + e.message; } }; return { favori: /auto-1/.test(await v(() => A.me.favorites())), progression: /auto-1/.test(await v(() => A.me.progress())), note: /note sur place/.test(await v(() => (A.me.notes ? A.me.notes() : A.notes.list()))), signet: /auto-1/.test(await v(() => A.me.bookmarks())), liste: /Locale/.test(await v(() => A.me.lists())) }; });
            ctx.mesure('autonome_gestes', { gestes, apresRechargement: relu });
            const rates = Object.entries(gestes).filter(([, v]) => v !== true).map(([k, v]) => `${k} : ${v}`);
            if (rates.length) T('haute', 'AUT-GESTE', `Sans PC, ${rates.length} geste(s) courant(s) échouent`, rates.join('\n'), 'Les prendre en charge dans le magasin local (moi-local.js) ou les masquer.', { fichier: 'assets/js/moi-local.js' });
            const oublis = Object.entries(relu).filter(([k, v]) => !v && gestes[k] === true).map(([k]) => k);
            if (oublis.length) T('critique', 'AUT-OUBLI', `Sans PC, des gestes acceptés disparaissent au rechargement : ${oublis.join(', ')}`, JSON.stringify(relu), 'Écrire dans un stockage durable.', { fichier: 'assets/js/moi-local.js' });
            await p.goto(base + '/catalogue.html'); await p.waitForTimeout(9000);
            const cartes = await p.evaluate(() => document.querySelectorAll('.manga-card').length);
            ctx.mesure('autonome_catalogue', cartes);
            const ecran = await p.evaluate(() => (document.querySelector('main') || document.body).innerText.replace(/\s+/g, ' ').slice(0, 300));
            if (!cartes && /Unexpected token|not valid JSON/.test(ecran)) T('moyenne', 'AUT-ERREUR-BRUTE', 'Sans PC, une source qui répond par une page d\'erreur affiche « Unexpected token < … is not valid JSON »', ecran + '\n\nsources-embarquees.js analyse le corps en JSON avant de regarder le statut (ici MangaDex répond « Bot challenge not passed », 403, depuis ce réseau). Le catalogue embarqué ne dépend que de cette source : refusé, l\'écran est vide.', 'Contrôler le statut avant JSON.parse, afficher le message prévu, proposer les autres sources embarquées.', { fichier: 'assets/js/sources-embarquees.js', effort: 'S' });
            else if (!cartes) T('moyenne', 'AUT-CATALOGUE', 'Sans PC, le catalogue ne propose qu\'une source : si elle ne répond pas, l\'écran reste vide', (await p.evaluate(() => (document.querySelector('main') || document.body).innerText.slice(0, 300))) + '\n' + s.exceptions.slice(0, 3).join('\n') + '\n(Depuis ce réseau, MangaDex oppose un défi anti-robot : à confirmer sur un appareil.)', 'Message clair et proposition des autres sources embarquées.', { fichier: 'assets/js/sources-embarquees.js', effort: 'S' });
            if (fantomes.size) T('moyenne', 'AUT-APPEL-HUB', `Sans PC, l'application tente encore ${fantomes.size} appel(s) vers un serveur`, [...fantomes].slice(0, 15).join('\n'), 'Répondre localement ou ne pas appeler.', { fichier: 'assets/js/api.js' });
            ctx.mesure('autonome_hotes_contactes', Object.fromEntries(externes));
            await c.close();
        } finally {
            if (nav) await nav.close().catch(() => { });
            if (serveur) serveur.close();
            try { if (fs.lstatSync(jonction).isSymbolicLink()) fs.unlinkSync(jonction); } catch (e) { /* absente */ }
            try { fs.lstatSync(jonction); } catch (e) { try { fs.rmSync(copie, { recursive: true, force: true }); } catch (x) { /* verrou */ } }
        }
    },
};
