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

const IS_DEV  = process.argv.includes('--dev');
const PORT    = 8088;
const ROOT    = app.isPackaged
    ? path.join(process.resourcesPath)             // resources/server, resources/frontend
    : path.join(__dirname, '..');                  // dev : ../server, ../

const SERVER_DIR = path.join(ROOT, 'server');
const SERVER_ENTRY = path.join(SERVER_DIR, 'server.js');
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

// ── Backend lifecycle (in-process via require) ──────────
async function startBackend() {
    if (!fs.existsSync(SERVER_ENTRY)) {
        throw new Error(`Backend introuvable : ${SERVER_ENTRY}`);
    }
    ensureEnv();
    process.env.PORT = String(PORT);

    // Le server.js a une IIFE qui démarre l'app au require — on l'utilise.
    // Si le serveur plante au démarrage, l'erreur sera attrapée par le catch global.
    try {
        require(SERVER_ENTRY);
    } catch (e) {
        throw new Error(`Échec require backend : ${e.message}`);
    }

    // Poll healthcheck pour confirmer que le serveur écoute
    const deadline = Date.now() + 20_000;
    return new Promise((resolve, reject) => {
        const tick = () => {
            const req = http.get(`http://127.0.0.1:${PORT}/api/health`, res => {
                if (res.statusCode === 200) return resolve();
                retry();
            });
            req.on('error', retry);
            req.setTimeout(1500, () => req.destroy());
            function retry() {
                if (Date.now() > deadline)
                    return reject(new Error('Backend timeout (20s) — MySQL est-il lancé sur 127.0.0.1:3306 ?'));
                setTimeout(tick, 400);
            }
        };
        tick();
    });
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
