// ============================================================
// lib/embedded-db.js — Base de données garantie sur n'importe quel PC
// ------------------------------------------------------------
// L'app desktop doit marcher sans AUCUN environnement de dev :
//   1. Si le MySQL configuré (env DB_*, défaut 127.0.0.1:3306) répond,
//      on l'utilise — c'est le cas du dev (Laragon) et des self-hosts.
//   2. Sinon, on démarre la MariaDB EMBARQUÉE dans l'app (port 3406,
//      données dans %APPDATA%\Inko\db), on crée la base + le schéma.
// Appelé par server.js AVANT tout require de l'app : le pool MySQL lit
// process.env au moment du require, il faut fixer DB_* d'abord.
// ============================================================
const fs   = require('fs');
const os   = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn, spawnSync } = require('child_process');
const mysql = require('mysql2/promise');

const EMBEDDED_PORT = parseInt(process.env.INKO_EMBEDDED_DB_PORT || '3406', 10);
const DB_NAME = process.env.DB_NAME || 'inko';

function log(msg) { console.log('[db] ' + msg); }

// Dossier de la MariaDB embarquée : env explicite, sinon resources/mariadb
// (déposé par prep.js à côté de resources/server dans le bundle Tauri).
function mariadbDir() {
    if (process.env.INKO_MARIADB_DIR) return process.env.INKO_MARIADB_DIR;
    return path.join(__dirname, '..', '..', 'mariadb');
}

// Les données de l'utilisateur SURVIVENT aux mises à jour et à la
// désinstallation : %APPDATA%\Inko\db, jamais dans le dossier d'install.
// Marqueur du dernier mode utilisé : si l'app tournait sur MySQL externe et
// qu'il ne répond plus (Laragon pas démarré…), on bascule quand même sur
// l'embarquée MAIS on lève un drapeau que le frontend affiche en bandeau —
// sinon l'utilisateur croit avoir « perdu » sa bibliothèque.
function modeMarkerPath() {
    const base = process.env.APPDATA || path.join(os.homedir(), '.config');
    return path.join(base, 'Inko', 'db-mode.json');
}
function readModeMarker() {
    try { return JSON.parse(fs.readFileSync(modeMarkerPath(), 'utf8')).mode || null; }
    catch (e) { return null; }
}
function writeModeMarker(mode) {
    try {
        fs.mkdirSync(path.dirname(modeMarkerPath()), { recursive: true });
        fs.writeFileSync(modeMarkerPath(), JSON.stringify({ mode, at: new Date().toISOString() }));
    } catch (e) {}
}

function dataDir() {
    const base = process.env.APPDATA || path.join(os.homedir(), '.config');
    return path.join(base, 'Inko', 'db');
}

// ── Audit S12 : mot de passe root de la base embarquée ───────
// root/mot de passe vide protégeait d'un accès réseau (bind 127.0.0.1)
// mais pas d'un AUTRE compte Windows du même PC familial. Un mot de passe
// aléatoire est généré au premier lancement et stocké dans le profil de
// l'utilisateur courant (%APPDATA%\Inko) — illisible pour les autres
// comptes non-admin de la machine.
function credsPath() {
    const base = process.env.APPDATA || path.join(os.homedir(), '.config');
    return path.join(base, 'Inko', 'db-credentials.json');
}
function readDbPassword() {
    try { return JSON.parse(fs.readFileSync(credsPath(), 'utf8')).password || ''; }
    catch (e) { return ''; }
}
function writeDbPassword(pw) {
    const p = credsPath();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    // Audit SEC-13 : le fichier était écrit avec les droits par défaut. Le mot
    // de passe doit rester lisible par le service (il faut bien se reconnecter),
    // mais on restreint l'accès au seul propriétaire — c'est tout l'intérêt de
    // le placer dans %APPDATA%. mode 0600 est honoré sur POSIX ; sur Windows on
    // retire l'héritage d'ACL et on ne laisse que l'utilisateur courant.
    fs.writeFileSync(p, JSON.stringify({ password: pw, at: new Date().toISOString() }), { mode: 0o600 });
    try { fs.chmodSync(p, 0o600); } catch (e) { /* système de fichiers sans permissions */ }
    if (process.platform === 'win32') {
        try {
            require('child_process').execFileSync('icacls',
                [p, '/inheritance:r', '/grant:r', `${process.env.USERNAME}:F`],
                { stdio: 'ignore', windowsHide: true, timeout: 10000 });
        } catch (e) { log('⚠ ACL non restreinte sur le fichier de credentials'); }
    }
}

// Pose (ou re-pose) le mot de passe sur le compte root effectivement utilisé.
// BEST-EFFORT : un échec ici ne DOIT jamais empêcher le backend de démarrer
// (sinon écran noir pour tout desktop sur base embarquée). En cas d'échec on
// repart en mot de passe vide — le bind 127.0.0.1 reste la protection de base.
async function secureEmbedded(conn) {
    try {
        const existing = readDbPassword();
        const pw  = existing || crypto.randomBytes(24).toString('hex');
        const esc = conn.escape(pw);   // littéral échappé (placeholders refusés par SET PASSWORD sur certaines versions)
        // ALTER USER = forme portable (MariaDB 10.2+/MySQL 8) ; repli SET PASSWORD
        // pour les serveurs plus anciens où PASSWORD() existe encore.
        try {
            await conn.query(`ALTER USER 'root'@'localhost' IDENTIFIED BY ${esc}`);
        } catch (e1) {
            await conn.query(`SET PASSWORD = PASSWORD(${esc})`);
        }
        if (!existing) writeDbPassword(pw);   // n'écrit le fichier qu'après un succès RÉEL
        log('mot de passe root de la base embarquée posé ✓ (audit S12)');
        return pw;
    } catch (e) {
        log(`⚠ mot de passe embarqué non posé (${e.code || e.message}) — démarrage en mot de passe vide, bind 127.0.0.1 conservé`);
        return '';   // le backend démarre quand même
    }
}

// Connexion à l'embarquée : essaie le mot de passe stocké, sinon l'héritage
// « mot de passe vide » (anciennes installations) qu'on sécurise au passage.
async function connectEmbedded(timeout = 2500) {
    const stored = readDbPassword();
    if (stored) {
        try {
            const conn = await tryConnect({ host: '127.0.0.1', port: EMBEDDED_PORT, user: 'root', password: stored, timeout });
            return { conn, password: stored };
        } catch (e) { /* datadir recréé sans le fichier de creds : tente vide */ }
    }
    const conn = await tryConnect({ host: '127.0.0.1', port: EMBEDDED_PORT, user: 'root', password: '', timeout });
    const password = await secureEmbedded(conn);   // migration douce des installs existantes
    return { conn, password };
}

async function tryConnect({ host, port, user, password, timeout = 2500 }) {
    const conn = await mysql.createConnection({
        host, port, user, password, connectTimeout: timeout,
    });
    await conn.query('SELECT 1');
    return conn;
}

async function ensureSchemaOn(conn) {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    const [[t]] = await conn.query(
        'SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_schema = ? AND table_name = ?',
        [DB_NAME, 'users']
    );
    if (t.n) return;
    log('base vierge : application du schéma complet…');
    const sqlPath = path.join(__dirname, '..', 'db', 'schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const multi = await mysql.createConnection({
        host: conn.config.host, port: conn.config.port,
        user: conn.config.user, password: conn.config.password,
        multipleStatements: true,
    });
    try { await multi.query(sql); } finally { await multi.end(); }
    log('schéma appliqué ✓');
}

async function waitForDb(opts, totalMs) {
    const until = Date.now() + totalMs;
    let lastErr;
    while (Date.now() < until) {
        try { return await tryConnect(opts); }
        catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 700)); }
    }
    throw lastErr || new Error('délai dépassé');
}

let mariadbChild = null;

async function startEmbedded() {
    const dir = mariadbDir();
    const exe = path.join(dir, 'bin', 'mariadbd.exe');
    if (!fs.existsSync(exe)) {
        throw new Error(`MySQL injoignable et MariaDB embarquée absente (${exe})`);
    }
    const data = dataDir();

    // Premier lancement : initialisation du datadir
    if (!fs.existsSync(path.join(data, 'mysql'))) {
        log('premier lancement : initialisation de la base embarquée…');
        fs.mkdirSync(data, { recursive: true });
        const install = path.join(dir, 'bin', 'mariadb-install-db.exe');
        const r = spawnSync(install, [`--datadir=${data}`, '--password='], {
            windowsHide: true, timeout: 120000, encoding: 'utf8',
        });
        if (r.status !== 0 || !fs.existsSync(path.join(data, 'mysql'))) {
            throw new Error('initialisation MariaDB échouée : ' + ((r.stderr || r.stdout || '').slice(-400)));
        }
        log('base embarquée initialisée ✓');
    }

    log(`démarrage de MariaDB embarquée (port ${EMBEDDED_PORT})…`);
    mariadbChild = spawn(exe, [
        `--datadir=${data}`,
        `--port=${EMBEDDED_PORT}`,
        '--bind-address=127.0.0.1',
        '--skip-networking=0',
        '--skip-name-resolve',
        '--console',
    ], { windowsHide: true, stdio: 'ignore' });
    mariadbChild.on('exit', (code) => log(`mariadbd terminé (code ${code})`));

    // Le serveur embarqué meurt avec le process Node
    const stop = () => { try { mariadbChild && mariadbChild.kill(); } catch (e) {} };
    process.on('exit', stop);
    process.on('SIGINT', () => { stop(); process.exit(0); });
    process.on('SIGTERM', () => { stop(); process.exit(0); });

    // Attend que l'embarquée réponde, avec le mot de passe stocké ou
    // l'héritage vide (sécurisé au passage — audit S12).
    const until = Date.now() + 45000;
    let lastErr;
    while (Date.now() < until) {
        try { return await connectEmbedded(1500); }
        catch (e) { lastErr = e; await new Promise(r => setTimeout(r, 700)); }
    }
    throw lastErr || new Error('délai dépassé');
}

// Point d'entrée : garantit une base joignable et fixe process.env.DB_*
// AVANT que config/db.js ne crée le pool.
async function ensureDatabase() {
    const cfg = {
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '3306', 10),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
    };

    // 1. MySQL configuré (dev / self-host) — les données existantes priment
    try {
        const conn = await tryConnect(cfg);
        await ensureSchemaOn(conn);
        await conn.end();
        log(`MySQL externe utilisé (${cfg.host}:${cfg.port})`);
        writeModeMarker('external');
        return { mode: 'external' };
    } catch (e) {
        log(`MySQL ${cfg.host}:${cfg.port} injoignable (${e.code || e.message}) → base embarquée`);
    }

    // 2. Une MariaDB embarquée tourne déjà (instance précédente) ? On la réutilise.
    let embeddedPassword = '';
    try {
        const { conn, password } = await connectEmbedded(1200);
        embeddedPassword = password;
        await ensureSchemaOn(conn);
        await conn.end();
        log(`MariaDB embarquée déjà active (port ${EMBEDDED_PORT})`);
    } catch (e) {
        // 3. Démarrage de l'embarquée
        const { conn, password } = await startEmbedded();
        embeddedPassword = password;
        await ensureSchemaOn(conn);
        await conn.end();
        log('MariaDB embarquée prête ✓');
    }

    process.env.DB_HOST = '127.0.0.1';
    process.env.DB_PORT = String(EMBEDDED_PORT);
    process.env.DB_USER = 'root';
    process.env.DB_PASSWORD = embeddedPassword;   // audit S12 : plus jamais vide
    if (readModeMarker() === 'external') {
        // La base habituelle de cet utilisateur est ailleurs : bandeau côté UI.
        process.env.INKO_DB_FALLBACK = '1';
        log('⚠ repli : la base habituelle (MySQL externe) est injoignable');
    } else {
        writeModeMarker('embedded');
    }
    return { mode: 'embedded' };
}

module.exports = { ensureDatabase, secureEmbedded, __test: { secureEmbedded } };
