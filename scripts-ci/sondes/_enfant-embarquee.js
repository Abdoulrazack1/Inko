// Scénario : démarrer la base embarquée de l'application, seule, sur un port et un profil
// d'essai, puis regarder qui peut s'y connecter. Aucun rapport avec la base de l'utilisateur.
'use strict';
const path = require('path');
const cp = require('child_process');
const racine = process.argv[2];
const dire = (o) => process.stdout.write('@@' + JSON.stringify(o) + '@@fin');
const PORT = +process.env.INKO_EMBEDDED_DB_PORT;

(async () => {
    if (PORT === 3406 || !process.env.APPDATA.includes('inko-embarquee-')) throw new Error('profil ou port non isolés');
    const mysql = require(path.join(racine, 'server', 'node_modules', 'mysql2', 'promise'));
    const base = require(path.join(racine, 'server', 'lib', 'embedded-db.js'));
    const sortie = {};
    const t0 = Date.now();
    try { const r = await base.ensureDatabase(); sortie.mode = r.mode; }
    catch (e) { sortie.installationNeuve = e.message; }          // la base est lancée : on l'examine quand même
    sortie.demarrageS = Math.round((Date.now() - t0) / 1000);
    const fichier = path.join(process.env.APPDATA, 'Inko', 'db-credentials.json');
    const motDePasse = process.env.DB_PASSWORD || JSON.parse(require('fs').readFileSync(fichier, 'utf8')).password;
    // l'application se connecte ensuite avec le mot de passe qu'elle vient de poser : est-ce que ça passe ?
    let admin;
    try { admin = await mysql.createConnection({ host: '127.0.0.1', port: PORT, user: 'root', password: motDePasse }); sortie.connexionAvecMotDePasse = true; }
    catch (e) { sortie.connexionAvecMotDePasse = e.message; admin = await mysql.createConnection({ host: '127.0.0.1', port: PORT, user: 'root', password: '' }); }
    try {
        const [comptes] = await admin.query("SELECT User AS u, Host AS h, JSON_VALUE(Priv, '$.authentication_string') AS s FROM mysql.global_priv");
        sortie.comptes = comptes.map((c) => ({ utilisateur: c.u, hote: c.h === 'localhost' || /^(127\.0\.0\.1|::1|%)$/.test(c.h) ? c.h : '(nom de la machine)', motDePasse: !!c.s }));
        try { const x = await mysql.createConnection({ host: '127.0.0.1', port: PORT, user: 'root', password: '', connectTimeout: 3000 }); await x.query('SELECT 1'); sortie.rootSansMotDePasse = true; await x.end(); }
        catch (e) { sortie.rootSansMotDePasse = false; sortie.refus = e.code; }
        try { const x = await mysql.createConnection({ host: '127.0.0.1', port: PORT, user: '', password: '', connectTimeout: 3000 }); const [[q]] = await x.query('SELECT CURRENT_USER() AS moi'); sortie.anonyme = q.moi; const [bases] = await x.query('SHOW DATABASES'); sortie.basesVuesParAnonyme = bases.map((b) => b.Database); await x.end(); }
        catch (e) { sortie.anonyme = false; }
        const ecoute = cp.spawnSync('netstat', ['-ano', '-p', 'TCP'], { encoding: 'utf8', windowsHide: true }).stdout || '';
        sortie.ecoute = [...new Set(ecoute.split('\n').filter((l) => new RegExp(':' + PORT + '\\s').test(l) && /LISTEN|COUTE/i.test(l)).map((l) => l.trim().split(/\s+/)[1]))];
        sortie.autreBase = (await admin.query("SHOW DATABASES LIKE 'test'"))[0].length > 0;
        // et si la création de la structure réussissait ? on la pose à la main, puis second démarrage
        if (sortie.installationNeuve) {
            const fsx = require('fs');
            const m = await mysql.createConnection({ host: '127.0.0.1', port: PORT, user: 'root', password: '', database: process.env.DB_NAME, multipleStatements: true });
            await m.query(fsx.readFileSync(path.join(racine, 'server', 'db', 'schema.sql'), 'utf8')); await m.end();
            process.env.DB_HOST = '127.0.0.1'; process.env.DB_PORT = '1'; process.env.DB_PASSWORD = '';
            try { await base.ensureDatabase(); const x = await mysql.createConnection({ host: process.env.DB_HOST, port: +process.env.DB_PORT, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME }); await x.query('SELECT COUNT(*) FROM users'); await x.end(); sortie.secondDemarrage = 'l’application se connecte'; }
            catch (e) { sortie.secondDemarrage = e.message; }
        }
    } finally {
        await admin.query('SHUTDOWN').catch(() => { });
        await admin.end().catch(() => { });
    }
    dire(sortie);
    setTimeout(() => process.exit(0), 1500);
})().catch((e) => { dire({ erreur: e.stack }); process.exit(0); });
