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
const axios = require('axios');

const REPO = 'Abdoulrazack1/Inko';
// Repli si l'API GitHub est injoignable : le lien « nom stable ».
const FALLBACK_URL = `https://github.com/${REPO}/releases/latest/download/Inko-Setup.exe`;

// Résout l'URL de l'installeur .exe de la dernière release (robustesse) :
// on ne dépend plus du seul asset « Inko-Setup.exe » (qui peut manquer si une
// publication a partiellement échoué). On interroge l'API GitHub et on prend le
// meilleur .exe disponible — priorité au nom stable, sinon l'installeur versionné.
async function resolveInstallerUrl() {
    try {
        const r = await axios.get(`https://api.github.com/repos/${REPO}/releases/latest`,
            { timeout: 12000, headers: { 'User-Agent': 'Inko', Accept: 'application/vnd.github+json' } });
        const assets = (r.data && r.data.assets) || [];
        const exes = assets.filter(a => /\.exe$/i.test(a.name));
        const stable = exes.find(a => /^Inko-Setup\.exe$/i.test(a.name));
        const setup  = exes.find(a => /setup/i.test(a.name));
        const chosen = stable || setup || exes[0];
        if (chosen && chosen.browser_download_url) {
            return { url: chosen.browser_download_url, tag: r.data.tag_name || null };
        }
    } catch (e) { /* API injoignable → repli */ }
    return { url: FALLBACK_URL, tag: null };
}

function download(url, dest) {
    return new Promise((resolve, reject) => {
        execFile('curl', ['-s', '-L', '--fail', '-o', dest, url],
            { windowsHide: true, timeout: 300000 }, (err) => {
                if (!err) return resolve();
                execFile('powershell', ['-NoProfile', '-Command',
                    `Invoke-WebRequest -Uri '${url}' -OutFile '${dest}' -UseBasicParsing`],
                    { windowsHide: true, timeout: 300000 }, (e2) => e2 ? reject(e2) : resolve());
            });
    });
}

// POST /api/app/update — télécharge le dernier installeur puis le lance.
async function runUpdate(_req, res, next) {
    try {
        if (!process.env.APP_VERSION) {
            return res.status(400).json({ error: 'Mise à jour intégrée disponible uniquement dans l’app installée.' });
        }
        if (process.platform !== 'win32') {
            return res.status(400).json({ error: 'Mise à jour automatique disponible sur Windows uniquement.' });
        }

        const { url } = await resolveInstallerUrl();
        const dest = path.join(os.tmpdir(), 'Inko-Setup.exe');
        try { if (fs.existsSync(dest)) fs.unlinkSync(dest); } catch (e) { /* on écrasera */ }

        try { await download(url, dest); }
        catch (e) {
            return res.status(502).json({ error: 'Installeur introuvable en ligne (la publication est peut-être en cours). Réessaie dans quelques minutes.' });
        }

        if (!fs.existsSync(dest) || fs.statSync(dest).size < 1_000_000) {
            return res.status(502).json({ error: 'Téléchargement de la mise à jour incomplet — réessaie dans un moment.' });
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
