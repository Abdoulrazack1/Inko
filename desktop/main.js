// ============================================================
// desktop/main.js — Process principal Electron
// ============================================================
// Lance le backend Node.js en sous-process puis ouvre une fenêtre
// Chromium sur l'app. Ferme tout proprement à la sortie.
//
// Pré-requis : MySQL (Laragon, MAMP, Docker, etc.) sur 127.0.0.1:3306
// avec un user `root` sans mot de passe (ou modifier server/.env).
// ============================================================
const { app, BrowserWindow, Menu, shell, dialog } = require('electron');
const path = require('path');
const fs   = require('fs');
const http = require('http');
const net  = require('net');
const { spawn } = require('child_process');

// ── Single instance lock ─────────────────────────────────
// Si une autre Inko tourne déjà, on focus sa fenêtre et on quitte.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
    app.quit();
    process.exit(0);
}
app.on('second-instance', () => {
    if (mainWindow) {
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
    }
});

const IS_DEV  = process.argv.includes('--dev');
const PORT    = 8088;
const ROOT    = app.isPackaged
    ? path.join(process.resourcesPath)             // resources/server, resources/frontend
    : path.join(__dirname, '..');                  // dev : ../server, ../

const SERVER_DIR = path.join(ROOT, 'server');
const SERVER_ENTRY = path.join(SERVER_DIR, 'server.js');
// En prod : resources/frontend/. En dev : ../ (dossier inko/ avec les HTML).
const FRONTEND_DIR = app.isPackaged
    ? path.join(ROOT, 'frontend')
    : path.join(__dirname, '..');
const USER_DATA = app.getPath('userData');

let mainWindow = null;

// ── Crée un .env minimal dans userData si absent ──
function ensureEnv() {
    const envPath = path.join(SERVER_DIR, '.env');
    if (fs.existsSync(envPath)) return;
    try {
        // On NE peut PAS écrire dans resources/ (lecture seule en prod).
        // Mais dotenv lira aussi process.env, donc on les set juste ici.
        process.env.PORT          = process.env.PORT          || String(PORT);
        process.env.DB_HOST       = process.env.DB_HOST       || '127.0.0.1';
        process.env.DB_PORT       = process.env.DB_PORT       || '3306';
        process.env.DB_USER       = process.env.DB_USER       || 'root';
        process.env.DB_PASSWORD   = process.env.DB_PASSWORD   || '';
        process.env.DB_NAME       = process.env.DB_NAME       || 'inko';
        process.env.JWT_SECRET    = process.env.JWT_SECRET    || `inko-${USER_DATA.slice(-12)}-secret`;
        process.env.JWT_EXPIRES   = process.env.JWT_EXPIRES   || '30d';
        process.env.NODE_ENV      = 'production';
    } catch (e) {}
}

// ── Vérifie qu'un port TCP répond ──
function tcpOpen(host, port, timeout = 800) {
    return new Promise(resolve => {
        const sock = new net.Socket();
        sock.setTimeout(timeout);
        sock.once('connect', () => { sock.destroy(); resolve(true); });
        sock.once('timeout', () => { sock.destroy(); resolve(false); });
        sock.once('error',   () => { sock.destroy(); resolve(false); });
        sock.connect(port, host);
    });
}

// ── Démarre MySQL si nécessaire (best-effort, multi-installs) ──
// L'app dépend d'un MySQL local. S'il est éteint, on tente de le
// lancer depuis les emplacements courants (Laragon, MAMP, XAMPP, WAMP).
async function ensureMySQL() {
    const host = process.env.DB_HOST || '127.0.0.1';
    const port = parseInt(process.env.DB_PORT || '3306', 10);
    if (await tcpOpen(host, port)) return true; // déjà up

    // Cherche un binaire mysqld + son datadir
    const candidates = [
        // Laragon (versions variables → on scanne le dossier bin/mysql)
        ...scanLaragon(),
        // MAMP / XAMPP / WAMP classiques
        { bin: 'C:\\xampp\\mysql\\bin\\mysqld.exe',                 args: [] },
        { bin: 'C:\\wamp64\\bin\\mysql\\mysql8.0.31\\bin\\mysqld.exe', args: [] },
        { bin: 'C:\\MAMP\\bin\\mysql\\bin\\mysqld.exe',            args: [] },
    ];

    for (const c of candidates) {
        if (!c.bin || !fs.existsSync(c.bin)) continue;
        try {
            spawn(c.bin, c.args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
            // Attend que le port s'ouvre (max 12s)
            const deadline = Date.now() + 12_000;
            while (Date.now() < deadline) {
                if (await tcpOpen(host, port, 600)) return true;
                await new Promise(r => setTimeout(r, 500));
            }
        } catch (e) { /* essaie le suivant */ }
    }
    return await tcpOpen(host, port);
}

// Scanne C:\laragon\bin\mysql\* pour trouver mysqld + sa config
function scanLaragon() {
    const out = [];
    try {
        const binRoot = 'C:\\laragon\\bin\\mysql';
        if (!fs.existsSync(binRoot)) return out;
        for (const dir of fs.readdirSync(binRoot)) {
            const baseDir = path.join(binRoot, dir);
            const bin = path.join(baseDir, 'bin', 'mysqld.exe');
            if (!fs.existsSync(bin)) continue;

            // Préfère un démarrage via my.ini (exactement comme Laragon) :
            // évite l'erreur de composant manquant liée au lancement bare-args.
            const myIni = path.join(baseDir, 'my.ini');
            if (fs.existsSync(myIni)) {
                out.push({ bin, args: [`--defaults-file=${myIni}`] });
                continue;
            }

            // Fallback : datadir explicite si pas de my.ini
            const args = [];
            const dataRoot = 'C:\\laragon\\data';
            if (fs.existsSync(dataRoot)) {
                const dd = fs.readdirSync(dataRoot).find(d => d.startsWith('mysql'));
                if (dd) args.push(`--datadir=${path.join(dataRoot, dd)}`);
            }
            args.push('--port=3306');
            out.push({ bin, args });
        }
    } catch (e) {}
    return out;
}

// ── Check si un backend Inko répond déjà sur le port ──
function probeExisting() {
    return new Promise(resolve => {
        const req = http.get(`http://127.0.0.1:${PORT}/api/health`, res => {
            resolve(res.statusCode === 200);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(800, () => { req.destroy(); resolve(false); });
    });
}

// ── Backend lifecycle (in-process via require) ──────────
async function startBackend() {
    // Si un backend Inko écoute déjà → on le réutilise (cas multi-fenêtres
    // ou ancienne instance pas tout à fait nettoyée).
    if (await probeExisting()) {
        return; // ok, on continue avec le backend existant
    }

    if (!fs.existsSync(SERVER_ENTRY)) {
        throw new Error(`Backend introuvable : ${SERVER_ENTRY}`);
    }
    ensureEnv();
    process.env.PORT         = String(PORT);
    process.env.FRONTEND_DIR = FRONTEND_DIR;

    // S'assure que MySQL est démarré (le lance si besoin)
    await ensureMySQL();

    // Intercepte EADDRINUSE proprement (sinon Electron crash sur l'exception)
    let listenError = null;
    const origUncaught = process.listeners('uncaughtException').slice();
    const captureErr = (err) => {
        if (err && err.code === 'EADDRINUSE') {
            listenError = err;
        } else {
            // Re-throw vers les autres handlers (Electron par défaut)
            origUncaught.forEach(h => { try { h(err); } catch(e) {} });
        }
    };
    process.removeAllListeners('uncaughtException');
    process.on('uncaughtException', captureErr);

    // Le server.js a une IIFE qui démarre l'app au require.
    try {
        require(SERVER_ENTRY);
    } catch (e) {
        process.removeAllListeners('uncaughtException');
        origUncaught.forEach(h => process.on('uncaughtException', h));
        throw new Error(`Échec require backend : ${e.message}`);
    }

    // Poll healthcheck pour confirmer que le serveur écoute
    const deadline = Date.now() + 20_000;
    const ok = await new Promise(resolve => {
        const tick = () => {
            if (listenError) return resolve(false);
            const req = http.get(`http://127.0.0.1:${PORT}/api/health`, res => {
                if (res.statusCode === 200) return resolve(true);
                retry();
            });
            req.on('error', retry);
            req.setTimeout(1500, () => req.destroy());
            function retry() {
                if (Date.now() > deadline) return resolve(false);
                setTimeout(tick, 400);
            }
        };
        tick();
    });

    // Restore les handlers d'origine
    process.removeAllListeners('uncaughtException');
    origUncaught.forEach(h => process.on('uncaughtException', h));

    if (listenError) {
        throw new Error(
            `Le port ${PORT} est déjà utilisé par un autre programme.\n\n` +
            'Soit une autre instance d\'Inko tourne (vérifier la barre des tâches),\n' +
            'soit un autre logiciel occupe ce port. Ferme-le puis relance Inko.'
        );
    }
    if (!ok) {
        throw new Error(
            `Backend timeout (20s).\n\n` +
            '✓ Vérifie que MySQL tourne (Laragon, MAMP, etc.) sur 127.0.0.1:3306\n' +
            '✓ Vérifie qu\'aucun firewall ne bloque le port ' + PORT
        );
    }
}

function stopBackend() {
    // Backend in-process : il sera tué avec le main process Electron.
}

// ── Window ──────────────────────────────────────────────
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        minWidth: 900,
        minHeight: 600,
        title: 'Inko',
        backgroundColor: '#0d0d0f',
        autoHideMenuBar: !IS_DEV,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            spellcheck: false,
        },
    });

    mainWindow.loadURL(`http://127.0.0.1:${PORT}/accueil.html`);

    // Liens externes → navigateur système
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        try {
            const u = new URL(url);
            if (u.origin !== `http://127.0.0.1:${PORT}` && u.origin !== `http://localhost:${PORT}`) {
                shell.openExternal(url);
                return { action: 'deny' };
            }
        } catch (e) {}
        return { action: 'allow' };
    });

    if (IS_DEV) mainWindow.webContents.openDevTools({ mode: 'detach' });
    mainWindow.on('closed', () => { mainWindow = null; });
}

// ── Menu minimal ────────────────────────────────────────
function setMenu() {
    const isMac = process.platform === 'darwin';
    const template = [
        ...(isMac ? [{ role: 'appMenu' }] : []),
        {
            label: 'Fichier',
            submenu: [
                { label: 'Recharger', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.webContents.reload() },
                { type: 'separator' },
                isMac ? { role: 'close' } : { role: 'quit' },
            ],
        },
        { role: 'editMenu' },
        {
            label: 'Affichage',
            submenu: [
                { role: 'togglefullscreen' },
                { role: 'zoomIn' },
                { role: 'zoomOut' },
                { role: 'resetZoom' },
            ],
        },
        {
            label: 'Aide',
            submenu: [
                { label: "À propos d'Inko", click: () => dialog.showMessageBox(mainWindow, {
                    type: 'info',
                    title: 'Inko',
                    message: 'Inko — Lecteur de mangas',
                    detail: `Version ${app.getVersion()}\n\nFramework de lecture open-source.\nUsage strictement personnel.\n\nVoir LICENSE et NOTICE.md pour les conditions.`,
                    buttons: ['OK'],
                }) },
                { label: 'GitHub', click: () => shell.openExternal('https://github.com/Abdoulrazack1/Inko') },
                { label: 'Issues', click: () => shell.openExternal('https://github.com/Abdoulrazack1/Inko/issues') },
            ],
        },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Lifecycle ───────────────────────────────────────────
app.whenReady().then(async () => {
    setMenu();
    try {
        await startBackend();
    } catch (err) {
        dialog.showErrorBox(
            'Inko — démarrage impossible',
            `Le serveur backend n'a pas pu démarrer.\n\n${err.message}\n\n` +
            '✓ Vérifie que MySQL tourne (Laragon, MAMP, etc.) sur 127.0.0.1:3306\n' +
            '✓ Vérifie le fichier server/.env\n' +
            '✓ Lance manuellement « npm run init-db » dans le dossier server/'
        );
        app.quit();
        return;
    }
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => {
    stopBackend();
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', stopBackend);
process.on('exit', stopBackend);
