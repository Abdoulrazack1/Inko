// ============================================================
// update.controller.js — Mise à jour de l'app depuis l'app
// ------------------------------------------------------------
// Le backend Node tourne sur la machine de l'utilisateur : il peut
// télécharger le dernier installeur et le lancer. L'installeur NSIS
// (généré par Tauri) ferme l'app en cours, installe la nouvelle
// version puis la relance — mise à jour « en un clic », sans passer
// par le navigateur. N'est actif que dans l'app desktop (APP_VERSION).
// ============================================================
const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');

const INSTALLER_URL = 'https://github.com/Abdoulrazack1/Inko/releases/latest/download/Inko-Setup.exe';

// POST /api/app/update — télécharge le dernier installeur puis le lance.
// Réservé à l'app desktop (Windows) : ailleurs, le front retombe sur le
// téléchargement navigateur.
async function runUpdate(_req, res, next) {
    try {
        if (!process.env.APP_VERSION) {
            return res.status(400).json({ error: 'Mise à jour intégrée disponible uniquement dans l’app installée.' });
        }
        if (process.platform !== 'win32') {
            return res.status(400).json({ error: 'Mise à jour automatique disponible sur Windows uniquement.' });
        }

        const dest = path.join(os.tmpdir(), 'Inko-Setup.exe');

        // Téléchargement via curl (présent nativement Win10+), repli PowerShell.
        await new Promise((resolve, reject) => {
            execFile('curl', ['-s', '-L', '--fail', '-o', dest, INSTALLER_URL],
                { windowsHide: true, timeout: 180000 }, (err) => {
                    if (!err) return resolve();
                    // Repli PowerShell (Invoke-WebRequest suit la redirection GitHub)
                    execFile('powershell', ['-NoProfile', '-Command',
                        `Invoke-WebRequest -Uri '${INSTALLER_URL}' -OutFile '${dest}' -UseBasicParsing`],
                        { windowsHide: true, timeout: 180000 }, (e2) => e2 ? reject(e2) : resolve());
                });
        });

        if (!fs.existsSync(dest) || fs.statSync(dest).size < 1_000_000) {
            return res.status(502).json({ error: 'Téléchargement de la mise à jour échoué.' });
        }

        // Lance l'installeur en mode silencieux : NSIS ferme Inko, installe la
        // nouvelle version et la relance. Détaché pour survivre à la fermeture.
        const child = spawn(dest, ['/S'], { detached: true, stdio: 'ignore', windowsHide: false });
        child.unref();

        res.json({ ok: true, message: 'Installation en cours — Inko va redémarrer.' });
    } catch (e) {
        res.status(500).json({ error: 'Mise à jour impossible : ' + (e.message || e) });
    }
}

module.exports = { runUpdate };
