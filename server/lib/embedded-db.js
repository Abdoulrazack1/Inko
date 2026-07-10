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

    return waitForDb({ host: '127.0.0.1', port: EMBEDDED_PORT, user: 'root', password: '' }, 45000);
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
    try {
        const conn = await tryConnect({ host: '127.0.0.1', port: EMBEDDED_PORT, user: 'root', password: '', timeout: 1200 });
        await ensureSchemaOn(conn);
        await conn.end();
        log(`MariaDB embarquée déjà active (port ${EMBEDDED_PORT})`);
    } catch (e) {
        // 3. Démarrage de l'embarquée
        const conn = await startEmbedded();
        await ensureSchemaOn(conn);
        await conn.end();
        log('MariaDB embarquée prête ✓');
    }

    process.env.DB_HOST = '127.0.0.1';
    process.env.DB_PORT = String(EMBEDDED_PORT);
    process.env.DB_USER = 'root';
    process.env.DB_PASSWORD = '';
    if (readModeMarker() === 'external') {
        // La base habituelle de cet utilisateur est ailleurs : bandeau côté UI.
        process.env.INKO_DB_FALLBACK = '1';
        log('⚠ repli : la base habituelle (MySQL externe) est injoignable');
    } else {
        writeModeMarker('embedded');
    }
    return { mode: 'embedded' };
}

module.exports = { ensureDatabase };
