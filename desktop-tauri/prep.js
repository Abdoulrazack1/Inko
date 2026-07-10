// ============================================================
// prep.js — Prépare les ressources embarquées de l'app Tauri
// ------------------------------------------------------------
// Copie (comme l'extraResources d'electron-builder) :
//   · ../server    → src-tauri/resources/server   (avec node_modules)
//   · le frontend  → src-tauri/resources/frontend (html + assets + PWA)
//   · node.exe     → src-tauri/binaries/node-x86_64-pc-windows-msvc.exe
// ============================================================
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const RES  = path.join(__dirname, 'src-tauri', 'resources');
const BIN  = path.join(__dirname, 'src-tauri', 'binaries');

function robocopy(src, dst, extra = []) {
    fs.mkdirSync(dst, { recursive: true });
    // robocopy : 0-7 = succès
    try {
        execSync(`robocopy "${src}" "${dst}" /E /NJH /NJS /NDL /NFL /NP ${extra.join(' ')}`, { stdio: 'inherit' });
    } catch (e) {
        if (!e.status || e.status >= 8) throw e;
    }
}

// Repart d'un dossier PROPRE : sans purge, les fichiers supprimés du repo
// (anciennes pages de connexion, admin…) resteraient embarqués dans l'app.
console.log('[prep] nettoyage…');
fs.rmSync(RES, { recursive: true, force: true });

console.log('[prep] serveur…');
robocopy(path.join(ROOT, 'server'), path.join(RES, 'server'),
    ['/XF', '.env', '.env.*', '/XD', 'test', 'uploads']);
// Les configs locales sensibles ne partent pas dans le bundle
for (const f of ['config/vapid.json', 'config/google.json', 'config/anilist.json', 'config/local-owner.json']) {
    const p = path.join(RES, 'server', f);
    if (fs.existsSync(p)) fs.unlinkSync(p);
}

console.log('[prep] frontend…');
fs.mkdirSync(path.join(RES, 'frontend'), { recursive: true });
for (const f of fs.readdirSync(ROOT)) {
    if (/\.(html|webmanifest)$/.test(f) || f === 'service-worker.js' || f === 'LICENSE' || f === 'NOTICE.md') {
        fs.copyFileSync(path.join(ROOT, f), path.join(RES, 'frontend', f));
    }
}
robocopy(path.join(ROOT, 'assets'), path.join(RES, 'frontend', 'assets'));

// ── MariaDB embarquée (l'app doit marcher sans MySQL sur le PC) ──
// Téléchargée une fois puis mise en cache ; seuls ~29 Mo utiles sont
// embarqués (mariadbd + server.dll + install-db + share minimal).
const MARIADB_VER = '11.8.8';
const CACHE = path.join(__dirname, '.cache');
const MDB_MIN = path.join(CACHE, 'mariadb-min-' + MARIADB_VER);
if (!fs.existsSync(path.join(MDB_MIN, 'bin', 'mariadbd.exe'))) {
    console.log('[prep] téléchargement MariaDB ' + MARIADB_VER + '…');
    fs.mkdirSync(CACHE, { recursive: true });
    const zip = path.join(CACHE, 'mariadb.zip');
    const url = 'https://downloads.mariadb.org/rest-api/mariadb/' + MARIADB_VER + '/mariadb-' + MARIADB_VER + '-winx64.zip';
    execSync('curl -sL -o "' + zip + '" "' + url + '"', { stdio: 'inherit' });
    execSync('tar -xf "' + zip + '" -C "' + CACHE + '"', { stdio: 'inherit' });
    const full = path.join(CACHE, 'mariadb-' + MARIADB_VER + '-winx64');
    fs.mkdirSync(path.join(MDB_MIN, 'bin'), { recursive: true });
    fs.mkdirSync(path.join(MDB_MIN, 'share'), { recursive: true });
    for (const f of fs.readdirSync(path.join(full, 'bin'))) {
        if (f === 'mariadbd.exe' || f === 'mariadb-install-db.exe' || f.endsWith('.dll')) {
            fs.copyFileSync(path.join(full, 'bin', f), path.join(MDB_MIN, 'bin', f));
        }
    }
    // mariadb-install-db cherche le binaire sous son nom historique
    fs.copyFileSync(path.join(MDB_MIN, 'bin', 'mariadbd.exe'), path.join(MDB_MIN, 'bin', 'mysqld.exe'));
    for (const d of ['english', 'charsets']) {
        robocopy(path.join(full, 'share', d), path.join(MDB_MIN, 'share', d));
    }
    for (const f of fs.readdirSync(path.join(full, 'share'))) {
        if (f.endsWith('.sql') && !f.startsWith('mariadb_test')) {
            fs.copyFileSync(path.join(full, 'share', f), path.join(MDB_MIN, 'share', f));
        }
    }
    fs.rmSync(full, { recursive: true, force: true });
    fs.rmSync(zip, { force: true });
    console.log('[prep] MariaDB min prête (cache)');
}
console.log('[prep] mariadb embarquée…');
robocopy(MDB_MIN, path.join(RES, 'mariadb'));

console.log('[prep] sidecar node…');
fs.mkdirSync(BIN, { recursive: true });
const nodeExe = process.execPath;
fs.copyFileSync(nodeExe, path.join(BIN, 'node-x86_64-pc-windows-msvc.exe'));

console.log('[prep] OK');
