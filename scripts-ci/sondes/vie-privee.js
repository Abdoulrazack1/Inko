// vie-privee — ce qui sort réellement : chaque hôte contacté par le navigateur ET par le
// serveur pendant qu'on parcourt toute l'application, comparé à ce que dit la page
// « Confidentialité ». Le serveur sort par un relais qui note les noms, rien d'autre.
'use strict';
const http = require('http');
const net = require('net');
const { demarrer } = require('./_jetable');
const { lancerNavigateur } = require('./_navigateur');
const E = require('./_explore');

const racine = (h) => { const p = String(h).toLowerCase().split('.'); return p.length <= 2 ? p.join('.') : p.slice(-2).join('.'); };

module.exports = {
    nom: 'vie-privee',
    description: 'Hôtes réellement contactés (navigateur et serveur) comparés à la page Confidentialité ; traces gardées',
    async run(ctx) {
        const T = (gravite, id, titre, detail, correctif, extra = {}) => ctx.trouver({ gravite, id, categorie: 'vie privée', titre, detail, correctif, effort: 'S', fichier: 'confidentialite.html', ...extra });
        const serveur = new Map(), navigateur = new Map();
        const noter = (m, h, quoi) => { if (!m.has(h)) m.set(h, new Set()); if (quoi) m.get(h).add(quoi); };
        // relais : note le nom demandé et transmet, sans lire le contenu
        const relais = http.createServer((q, r) => { try { const u = new URL(q.url); noter(serveur, u.hostname, 'http'); const s = http.request({ host: u.hostname, port: u.port || 80, path: u.pathname + u.search, method: q.method, headers: q.headers }, (x) => { r.writeHead(x.statusCode, x.headers); x.pipe(r); }); s.on('error', () => { r.statusCode = 502; r.end(); }); q.pipe(s); } catch (e) { r.statusCode = 400; r.end(); } });
        relais.on('connect', (q, client, tete) => { const [h, port] = q.url.split(':'); noter(serveur, h, 'https'); const s = net.connect(+port || 443, h, () => { client.write('HTTP/1.1 200 Connection Established\r\n\r\n'); s.write(tete); s.pipe(client); client.pipe(s); }); s.on('error', () => client.destroy()); client.on('error', () => s.destroy()); });
        await new Promise(ok => relais.listen(8157, '127.0.0.1', ok));
        const P = 'http://127.0.0.1:8157';
        const J = await demarrer(ctx, { base: 'inko_s_vp', port: 8156, env: { HTTP_PROXY: P, HTTPS_PROXY: P, http_proxy: P, https_proxy: P, NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost' } });
        if (!J) { relais.close(); return; }
        const nav = await lancerNavigateur();
        try {
            const d = await E.semer(J, { favoris: 9 });
            const oe = await E.oeuvresReelles(J);
            if (oe.manga) await J.api('POST', '/me/favorites', { mangaId: oe.manga.id, source: oe.manga.source, title: oe.manga.titre });
            const c = await nav.newContext({ viewport: { width: 1366, height: 800 }, serviceWorkers: 'block', locale: 'fr-FR' });
            await c.addInitScript(() => { try { for (const k of ['mh_eula_v2', 'inko_consent', 'inko_tour_done', 'mh_install_dismissed']) localStorage.setItem(k, '1'); } catch (e) { /* stockage */ } });
            await c.route('**/*', (r) => { const u = r.request().url(); if (u.startsWith(J.url) || /^(data|blob):/.test(u)) return r.continue(); try { noter(navigateur, new URL(u).hostname, r.request().resourceType()); } catch (e) { /* url */ } return r.abort(); });
            for (const [f, u] of E.adresses(ctx, { ...d, ...oe })) { const p = await c.newPage(); try { await p.goto(`${J.url}/${u}`, { waitUntil: 'load', timeout: 25000 }); await p.waitForTimeout(f === 'chapitre.html' ? 7000 : 3000); } catch (e) { /* lenteur */ } await p.close(); }
            // gestes qui font sortir : recherche partout, vérification des nouveautés, mises à jour
            await J.api('GET', '/search-all?q=naruto&limit=3'); await J.api('POST', '/me/updates/scan', {}); await J.api('GET', '/extensions/updates'); await J.api('GET', '/artwork?title=Naruto'); await J.api('GET', '/anilist/similar?title=Naruto');
            await new Promise(r => setTimeout(r, 15000));
            const page = ctx.lire(ctx.abs('confidentialite.html')).toLowerCase();
            const dit = (h) => page.includes(racine(h)) || page.includes(racine(h).split('.')[0]);
            const liste = (m) => Object.fromEntries([...m].map(([h, s]) => [h, [...s].join(', ')]));
            ctx.mesure('vie_privee_navigateur', liste(navigateur));
            ctx.mesure('vie_privee_serveur', liste(serveur));
            const sansNom = (m) => [...m.keys()].filter(h => !/^(127\.|192\.168\.|10\.|localhost)/.test(h) && !dit(h)).sort();
            const nn = sansNom(navigateur), ns = sansNom(serveur);
            const direct = [...navigateur.keys()].filter(h => !/fonts\.g|localhost|^127\./.test(h)).sort();
            if (direct.length) T('moyenne', 'VP-NAVIGATEUR-DIRECT', `Le navigateur contacte directement ${direct.length} hôte(s) extérieur(s) : ils voient ton adresse`, direct.map(h => `${h} (${[...navigateur.get(h)].join(', ')})`).join('\n'), 'Passer par le relais du hub, au moins sur option (« mode strict »), et le dire.', { effort: 'M' });
            if (nn.length) T('haute', 'VP-NON-DECLARE-NAVIGATEUR', `${nn.length} hôte(s) contacté(s) par le navigateur ne figurent pas dans la page Confidentialité`, nn.map(h => `${h} (${[...navigateur.get(h)].join(', ')})`).join('\n'), 'Compléter la page, ou ne plus les contacter.');
            if (ns.length) T('moyenne', 'VP-NON-DECLARE-SERVEUR', `${ns.length} hôte(s) contacté(s) par le serveur ne figurent pas dans la page Confidentialité`, ns.join('\n'), 'Compléter la page à partir des extensions installées.');
            if ([...navigateur.keys()].some(h => /fonts\.g/.test(h))) T('moyenne', 'VP-POLICES-DISTANTES', 'Des polices sont demandées à Google', [...navigateur.keys()].filter(h => /fonts\.g/.test(h)).join(', '), 'Les polices sont déjà fournies avec l\'application : retirer les liens distants.', { fichier: 'assets/css/fonts.css' });
            // traces laissées par la lecture privée
            const p = await c.newPage(); await p.goto(J.url + '/accueil.html'); await p.waitForTimeout(2000);
            const avant = (await J.sql('SELECT (SELECT COUNT(*) FROM events) AS e, (SELECT COUNT(*) FROM read_chapters) AS r, (SELECT COUNT(*) FROM progress) AS p, (SELECT COALESCE(SUM(seconds),0) FROM reading_time) AS t'))[0];
            await p.evaluate(() => { localStorage.setItem('inko_incognito', '1'); window.MH && window.MH.setIncognito && window.MH.setIncognito(true); });
            const estPrive = await p.evaluate(() => !!(window.MH && window.MH.isIncognito && window.MH.isIncognito()));
            if (estPrive && oe.manga) {
                const ch = oe.manga.chapitres[Math.floor(oe.manga.chapitres.length / 3)];
                await p.goto(`${J.url}/chapitre.html?manga=${encodeURIComponent(oe.manga.id)}&chapter=${encodeURIComponent(ch.id)}&source=${oe.manga.source}`); await p.waitForSelector('.reader-page-img', { timeout: 25000 }).catch(() => { }); await p.waitForTimeout(3000);
                for (let i = 0; i < 25; i++) { await p.keyboard.press('ArrowRight'); await p.waitForTimeout(220); }
                await p.keyboard.press('End'); await p.keyboard.press('ArrowRight'); await p.waitForTimeout(5000);
                const apres = (await J.sql('SELECT (SELECT COUNT(*) FROM events) AS e, (SELECT COUNT(*) FROM read_chapters) AS r, (SELECT COUNT(*) FROM progress) AS p, (SELECT COALESCE(SUM(seconds),0) FROM reading_time) AS t'))[0];
                const traces = ['e', 'r', 'p', 't'].filter(k => Number(apres[k]) > Number(avant[k])).map(k => ({ e: 'activité', r: 'chapitres lus', p: 'progression', t: 'temps de lecture' }[k] + ` : ${avant[k]} → ${apres[k]}`));
                ctx.mesure('vie_privee_lecture_privee', { traces });
                if (traces.length) T('haute', 'VP-LECTURE-PRIVEE', 'La lecture privée laisse des traces sur le serveur', traces.join('\n'), 'Vérifier chaque écriture du lecteur contre MH.isIncognito().', { fichier: 'assets/js/chapitre.js' });
            } else ctx.mesure('vie_privee_lecture_privee', 'non éprouvée');
            await c.close();
        } finally { await nav.close().catch(() => { }); await J.arreter(); relais.close(); relais.closeAllConnections && relais.closeAllConnections(); }
    },
};
