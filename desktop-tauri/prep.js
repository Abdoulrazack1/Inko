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

console.log('[prep] sidecar node…');
fs.mkdirSync(BIN, { recursive: true });
const nodeExe = process.execPath;
fs.copyFileSync(nodeExe, path.join(BIN, 'node-x86_64-pc-windows-msvc.exe'));

console.log('[prep] OK');
