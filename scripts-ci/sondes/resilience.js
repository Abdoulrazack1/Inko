// resilience — quand l'environnement lâche : base coupée en pleine session puis revenue,
// démarrages impossibles, arrêt propre, stockage du navigateur interdit ou plein, et une
// longue séance d'appuis au hasard.
'use strict';
const cp = require('child_process');
const { demarrer } = require('./_jetable');
const { requete } = require('./_http');
const E = require('./_explore');

module.exports = {
    nom: 'resilience',
    description: 'Coupure de la base, démarrages impossibles, stockage navigateur bloqué ou plein, navigation au hasard prolongée',
    async run(ctx) {
        const o = await E.ouvrir(ctx, { base: 'inko_s_res', port: 8153 });
        if (!o) return;
        const { J, nav } = o;
        const T = (gravite, id, titre, detail, correctif, extra = {}) => ctx.trouver({ gravite, id, categorie: 'robustesse', titre, detail, correctif, effort: 'S', ...extra });
        const releves = {};
        try {
            const d = await E.semer(J, { favoris: 24 });
            // ── toutes les connexions à la base sont coupées d'un coup ──
            const couper = async () => { const lignes = await J.sql("SELECT id FROM information_schema.processlist WHERE db = 'inko_s_res' AND id <> CONNECTION_ID()"); for (const l of lignes) await J.sql('KILL ' + Number(l.id)).catch(() => { }); return lignes.length; };
            await Promise.all(Array.from({ length: 20 }, () => J.api('GET', '/me/favorites')));
            releves.connexionsCoupees = await couper();
            const apres = []; for (let i = 0; i < 8; i++) { apres.push((await J.api('GET', '/me/favorites')).statut); await new Promise(r => setTimeout(r, 400)); }
            releves.apresCoupure = apres.join(',');
            if (apres[apres.length - 1] !== 200) T('haute', 'RES-RECONNEXION', 'Après une coupure des connexions à la base, le serveur ne se rétablit pas', apres.join(', '), 'Le pool doit recréer ses connexions.', { fichier: 'server/config/db.js' });
            else if (apres.some(x => x >= 500)) T('basse', 'RES-RECONNEXION-ERREURS', `Après une coupure de la base, ${apres.filter(x => x >= 500).length} requête(s) échouent avant le rétablissement`, apres.join(', '), 'Un nouvel essai sur « connexion perdue ».', { fichier: 'server/config/db.js' });
            // coupure pendant des écritures
            const ecritures = Array.from({ length: 40 }, (_, i) => J.api('POST', '/me/favorites', { mangaId: 'coupe-' + i, source: 'mangadex', title: 'c' }));
            await new Promise(r => setTimeout(r, 25)); await couper();
            const res = await Promise.all(ecritures); const [n] = await J.sql("SELECT COUNT(*) AS n FROM favorites WHERE manga_id LIKE 'coupe-%'");
            releves.ecrituresPendantCoupure = { acceptees: res.filter(r => r.statut === 200).length, enBase: n.n };
            if (res.filter(r => r.statut === 200).length > n.n) T('haute', 'RES-ACCUSE-MENSONGER', 'Des écritures sont annoncées réussies sans être en base', JSON.stringify(releves.ecrituresPendantCoupure), 'Ne répondre 200 qu\'après validation.');
            // ── la base disparaît (serveur de base arrêté) ──
            await J.sql('DROP DATABASE inko_s_res'); await couper(); await new Promise(r => setTimeout(r, 6000));
            const h = await requete(J.url, '/api/health'); const f = await J.api('GET', '/me/favorites');
            releves.sansBase = { sante: h.statut, favoris: f.statut, message: f.texte.slice(0, 120) };
            if (h.statut === 200) T('haute', 'RES-SANTE-MENTEUSE', 'La sonde de santé répond « tout va bien » alors que la base a disparu', h.texte.slice(0, 160), 'Interroger une table, pas seulement la connexion.', { fichier: 'server/routes/index.js' });
            if (f.statut === 401) T('haute', 'RES-SESSION-PERDUE', 'Quand la base tombe, le serveur répond « non authentifié » : l\'application déconnecte l\'utilisateur', f.texte.slice(0, 160), 'Répondre 503 et garder la session côté client.', { fichier: 'server/middleware/auth.js' });
            if (/ER_|SQL|Table '/.test(f.texte)) T('basse', 'RES-MESSAGE-SQL', 'L\'erreur de base est renvoyée telle quelle au client', f.texte.slice(0, 160), 'Message neutre.', { fichier: 'server/middleware/errorHandler.js' });
            // ── stockage du navigateur interdit, puis plein ──
            await J.sql('CREATE DATABASE inko_s_res CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        } finally { await o.fermer(); }
        const p2 = await E.ouvrir(ctx, { base: 'inko_s_res2', port: 8154 });
        if (!p2) return;
        try {
            const d = await E.semer(p2.J, { favoris: 24 });
            const liste = E.adresses(ctx, d).filter(([f]) => !/index/.test(f));
            for (const [cle, nom, script] of [
                ['interdit', 'le stockage du navigateur est interdit', () => { for (const k of ['localStorage', 'sessionStorage']) Object.defineProperty(window, k, { configurable: true, get() { throw new DOMException('Access is denied for this document.', 'SecurityError'); } }); }],
                ['plein', 'le stockage du navigateur est plein', () => { Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; }],
                ['corrompu', 'les données locales sont corrompues', () => { try { for (const k of ['mh_prefs', 'mh_session', 'mh_library_cache', 'inko_offline_queue_v1', 'mh_userdata', 'inko_incognito_series', 'inko_lang', 'mh_cache_sources']) localStorage.setItem(k, '{pas du json'); } catch (e) { /* refus */ } }],
            ]) {
                const c = await p2.nav.newContext({ viewport: { width: 1366, height: 800 }, serviceWorkers: 'block', locale: 'fr-FR' });
                await c.addInitScript(script);
                await c.route('**/*', (r) => (r.request().url().startsWith(p2.J.url) ? r.continue() : r.abort()));
                const touchees = [];
                for (const [f, u] of liste) {
                    const p = await c.newPage(); const s = E.surveiller(p);
                    try {
                        await p.goto(`${p2.J.url}/${u}`, { waitUntil: 'load', timeout: 20000 }); await p.waitForTimeout(2000);
                        const t = await p.evaluate(() => ({ n: (document.querySelector('main') || document.body).innerText.trim().length, entete: !!document.querySelector('header a') }));
                        // ces pages n'ont pas d'en-tête même en temps normal (voir ux-navigation)
                        const entete = t.entete || /^(anilist|confidentialite|localreader|systeme|offline)\.html$/.test(f);
                        if (s.exceptions.length || t.n < 40 || !entete) touchees.push(`${f} : ${s.exceptions[0] || (entete ? `contenu ${t.n} caractères` : 'sans en-tête')}`);
                    } catch (e) { touchees.push(`${f} : ${e.message.split('\n')[0].slice(0, 80)}`); }
                    await p.close();
                }
                releves['stockage ' + cle] = touchees.length + ' page(s) touchée(s)';
                if (touchees.length) T(touchees.length > 5 ? 'haute' : 'moyenne', 'RES-STOCKAGE-' + cle.toUpperCase(), `Quand ${nom}, ${touchees.length} page(s) cassent`, touchees.slice(0, 14).join('\n'), 'Un seul accès au stockage, protégé (storage.js), pour toute l\'application.', { fichier: 'assets/js/storage.js', effort: 'M' });
                await c.close();
            }
            // ── navigation au hasard ──
            const c = await E.contexte(p2.nav, p2.J); const p = await c.newPage(); const s = E.surveiller(p);
            let graine = 12345; const alea = (n) => { graine = (graine * 48271) % 2147483647; return graine % n; };
            const trouvees = new Map(); let gestes = 0;
            const fin = Date.now() + 150000;
            await p.goto(`${p2.J.url}/accueil.html`);
            while (Date.now() < fin) {
                const avant = s.exceptions.length; let quoi = '';
                try {
                    const tirage = alea(100);
                    if (tirage < 6) { const [, u] = liste[alea(liste.length)]; quoi = 'ouvre ' + u; await p.goto(`${p2.J.url}/${u}`, { timeout: 15000 }); }
                    else if (tirage < 10) { quoi = 'retour'; await p.goBack({ timeout: 5000 }); }
                    else if (tirage < 22) { const k = ['Escape', 'Enter', 'Tab', 'ArrowDown', 'ArrowRight', 'ArrowLeft', 'n', 'p', 's', 'b', '?', 'j', 'f', 'a', 'i', '/', 'Control+k', 'Control+z', 'Space'][alea(19)]; quoi = 'touche ' + k; await p.keyboard.press(k); }
                    else if (tirage < 28) { quoi = 'saisie'; await p.keyboard.type(['naruto', '   ', '%%%', '漫画', '<b>', '999999'][alea(6)]); }
                    else { const l = await p.$$('a[href]:not([target=_blank]),button:not([disabled]),[role=tab],input[type=checkbox],select'); if (l.length) { const h = l[alea(l.length)]; quoi = 'touche un contrôle ' + (await h.evaluate(e => (e.getAttribute('aria-label') || e.textContent || e.id || e.tagName).trim().slice(0, 40)).catch(() => '')); if (!/déconnex|supprimer le compte|quitter|mise à jour/i.test(quoi)) await h.click({ timeout: 500 }); } }
                    gestes++;
                } catch (e) { /* élément disparu : normal au hasard */ }
                await p.waitForTimeout(60);
                if (!p.url().startsWith(p2.J.url)) await p.goto(`${p2.J.url}/accueil.html`).catch(() => { });
                if (s.exceptions.length > avant) for (const x of s.exceptions.slice(avant)) if (!trouvees.has(x)) trouvees.set(x, `${p.url().replace(p2.J.url, '').split('?')[0]} après « ${quoi} »`);
            }
            releves.hasard = { gestes, exceptionsDifferentes: trouvees.size, serveurVivant: (await requete(p2.J.url, '/api/health')).statut === 200 };
            for (const [x, ou] of [...trouvees].slice(0, 15)) T('moyenne', 'RES-HASARD', `Navigation au hasard : « ${x.slice(0, 100)} »`, ou, 'Rejouer la suite de gestes et garder le cas en test.', { fichier: (ou.match(/\/([\w-]+\.html)/) || [])[1] });
            await c.close();
            // ── démarrages impossibles ──
            // profil utilisateur et base embarquée isolés : jamais le dossier réel de l'application
            const profil = require('fs').mkdtempSync(require('path').join(require('os').tmpdir(), 'inko-res-'));
            const lancer = (env, ms = 25000) => new Promise((ok) => { if (!/^inko_s_/.test(env.DB_NAME || '')) throw new Error('base non jetable'); const q = cp.spawn(process.execPath, ['server.js'], { cwd: ctx.abs('server'), env: { ...process.env, APPDATA: profil, INKO_MARIADB_DIR: require('path').join(profil, 'absente'), DISABLE_BACKUPS: '1', INKO_MDNS: '0', LOCAL_MODE: '1', ...env }, windowsHide: true }); let j = ''; q.stdout.on('data', x => j += x); q.stderr.on('data', x => j += x); const t = setTimeout(() => { q.kill(); ok({ code: 'toujours en vie', journal: j }); }, ms); q.on('exit', (code) => { clearTimeout(t); ok({ code, journal: j }); }); });
            const occupe = await lancer({ PORT: '8154', DB_NAME: 'inko_s_res2' });
            releves.portOccupe = { code: occupe.code, message: (occupe.journal.split('\n').find(l => /EADDRINUSE|port|occup|déjà/i.test(l)) || '').slice(0, 160) };
            if (occupe.code === 'toujours en vie') T('moyenne', 'RES-PORT-OCCUPE', 'Port déjà pris : le serveur reste lancé sans écouter', occupe.journal.slice(-400), 'Quitter avec un message clair.', { fichier: 'server/app.js' });
            else if (!/EADDRINUSE|déjà|occup/i.test(occupe.journal)) T('basse', 'RES-PORT-MESSAGE', 'Port déjà pris : le journal ne le dit pas', occupe.journal.slice(-400), '', { fichier: 'server/app.js' });
            const injoignable = await lancer({ PORT: '8155', DB_NAME: 'inko_s_absente', DB_PORT: '1' }, 30000);
            releves.baseInjoignable = { code: injoignable.code, fin: injoignable.journal.slice(-300) };
            if (injoignable.code === 0) T('moyenne', 'RES-SORTIE-SILENCIEUSE', 'Base injoignable : le serveur s\'arrête avec un code de succès', injoignable.journal.slice(-400), 'Code de sortie non nul.', { fichier: 'server/server.js' });
            if (!/base|database|mysql|mariadb|ECONNREFUSED/i.test(injoignable.journal)) T('moyenne', 'RES-BASE-MUETTE', 'Base injoignable : aucun message exploitable', injoignable.journal.slice(-400), '', { fichier: 'server/server.js' });
            ctx.mesure('resilience_releves', releves);
        } finally { await p2.fermer(); const x = await require(ctx.abs('server', 'node_modules', 'mysql2', 'promise')).createConnection({ host: process.env.DB_HOST || '127.0.0.1', user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '' }); await x.query('DROP DATABASE IF EXISTS inko_s_res'); await x.end(); }
    },
};
