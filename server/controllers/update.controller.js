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
const crypto = require('crypto');           // vérification d'empreinte (audit SEC-03)
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
            // `assets` et `name` sont remontés pour permettre la vérification
            // d'empreinte (audit SEC-03).
            return { url: chosen.browser_download_url, tag: r.data.tag_name || null,
                     assets, name: chosen.name };
        }
    } catch (e) { /* API injoignable → repli */ }
    return { url: FALLBACK_URL, tag: null, assets: [], name: 'Inko-Setup.exe' };
}

// ── Un téléchargement interrompu reprend où il s'est arrêté ──
//
// L'installeur pèse ~80 Mo. Avant, trois choses se liguaient pour faire
// recommencer de zéro :
//
//   · le fichier partiel était EFFACÉ avant chaque tentative ;
//   · `curl` était appelé sans `-C -`, donc sans reprise ;
//   · un plafond unique de 300 s coupait le transfert — la même faute
//     que le proxy d'images, où un seul délai ne distinguait pas
//     « hôte mort » de « hôte lent ».
//
// Sur une ligne lente, les 300 s tombaient en plein transfert valide, et
// la tentative suivante repartait de l'octet zéro : la mise à jour ne
// pouvait tout simplement jamais aboutir.
//
// Désormais le transfert vise `dest.part`, repris s'il existe. Deux
// délais séparés : dix secondes pour ÉTABLIR la connexion — au-delà
// l'hôte ne répond pas — puis une heure pour transférer, parce qu'une
// ligne lente finit par livrer, et que ce qu'elle a livré est gardé.
//
// UNE REPRISE N'EST PAS GRATUITE, et c'est ce qui demande le plus de
// soin : reprendre sur un morceau qui vient d'une AUTRE version donne un
// fichier cohérent en taille et faux en contenu. On écrit donc l'URL à
// côté du morceau, et un morceau d'une autre URL est jeté plutôt que
// repris. Le contrôle d'empreinte (audit SEC-03) reste la dernière
// barrière ; il efface aussi le morceau, sans quoi un téléchargement
// corrompu se reprendrait à l'infini.
const TRANSFERT_MAX_S = process.env.UPDATE_TIMEOUT_S || '3600';

function cheminMorceau(dest) { return dest + '.part'; }

function jeterMorceau(dest) {
    for (const f of [cheminMorceau(dest), cheminMorceau(dest) + '.url']) {
        try { if (fs.existsSync(f)) fs.unlinkSync(f); } catch (e) { /* déjà parti */ }
    }
}

/** Le morceau en cours vient-il de CETTE URL ? Sinon il ne vaut rien. */
function morceauUtilisable(dest, url) {
    const part = cheminMorceau(dest);
    if (!fs.existsSync(part)) return false;
    try {
        if (fs.readFileSync(part + '.url', 'utf8') === url) return true;
    } catch (e) { /* pas de marque : on ne devine pas */ }
    jeterMorceau(dest);
    return false;
}

function download(url, dest) {
    const part = cheminMorceau(dest);
    const repris = morceauUtilisable(dest, url);
    const deja = repris ? fs.statSync(part).size : 0;
    if (!repris) {
        try { fs.writeFileSync(part + '.url', url); } catch (e) { /* tant pis */ }
    } else {
        console.log('[update] reprise du telechargement a ' + Math.round(deja / 1048576) + ' Mo');
    }
    // `-C -` : curl demande la suite à partir de la taille du fichier. Un
    // serveur qui ignore les plages renvoie tout, et curl repart de zéro :
    // on ne perd rien à le demander.
    const args = ['-s', '-L', '--fail', '-C', '-', '--connect-timeout', '10',
        '-m', TRANSFERT_MAX_S, '-o', part, url];

    const fini = (resolve, reject) => {
        try {
            fs.renameSync(part, dest);
            try { fs.unlinkSync(part + '.url'); } catch (e) { /* déjà parti */ }
            resolve();
        } catch (e) { reject(e); }
    };

    return new Promise((resolve, reject) => {
        execFile('curl', args, { windowsHide: true, timeout: 0 }, (err) => {
            if (!err) return fini(resolve, reject);
            // Audit SEC-03 : l'URL et le chemin étaient INTERPOLÉS dans une
            // commande PowerShell. `url` vient de la réponse de l'API GitHub :
            // un guillemet simple refermait la chaîne et permettait d'enchaîner
            // une commande. Ils passent désormais par des paramètres liés.
            //
            // Ce repli ne sait pas reprendre : il repart du début, dans le
            // même morceau, qu'il écrase.
            execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command',
                'param($u,$o) Invoke-WebRequest -Uri $u -OutFile $o -UseBasicParsing',
                '-u', url, '-o', part],
                { windowsHide: true, timeout: 0 }, (e2) => (e2 ? reject(e2) : fini(resolve, reject)));
        });
    });
}

// ── Vérification de l'installeur (audit SEC-03) ──────────────
// L'installeur était lancé en mode silencieux après un SEUL contrôle : « le
// fichier pèse plus d'1 Mo ». Aucune signature, aucune empreinte, aucun
// pinning — alors que le canal des EXTENSIONS, bien moins dangereux, vérifie
// un SHA-256. Deux barrières désormais, dans cet ordre :
//   1. SHA256SUMS publié dans la release (source de vérité côté projet) ;
//   2. signature Authenticode valide (source de vérité côté Windows).
// Il faut au moins l'une des deux. INSTALLER_ALLOW_UNVERIFIED=1 pour passer
// outre en connaissance de cause (déconseillé).
const ALLOW_UNVERIFIED = process.env.INSTALLER_ALLOW_UNVERIFIED === '1';

function sha256File(file) {
    return new Promise((resolve, reject) => {
        const h = crypto.createHash('sha256');
        const s = fs.createReadStream(file);
        s.on('data', d => h.update(d));
        s.on('end', () => resolve(h.digest('hex')));
        s.on('error', reject);
    });
}

// Récupère l'empreinte attendue depuis l'asset SHA256SUMS de la release.
async function expectedSha(assets, assetName) {
    const sums = (assets || []).find(a => /^SHA256SUMS(\.txt)?$/i.test(a.name));
    if (!sums || !sums.browser_download_url) return null;
    try {
        const r = await axios.get(sums.browser_download_url, { timeout: 12000, responseType: 'text',
            transformResponse: [d => d], headers: { 'User-Agent': 'Inko' } });
        // Format standard : "<sha256>  <nom de fichier>"
        for (const line of String(r.data).split(/\r?\n/)) {
            const m = line.trim().match(/^([a-f0-9]{64})\s+\*?(.+)$/i);
            if (m && m[2].trim() === assetName) return m[1].toLowerCase();
        }
    } catch (e) { /* asset absent ou injoignable */ }
    return null;
}

// Signature Authenticode : `Valid` seulement si le binaire est signé ET que la
// chaîne de certification est de confiance sur cette machine.
function authenticodeValid(file) {
    return new Promise((resolve) => {
        execFile('powershell', ['-NoProfile', '-NonInteractive', '-Command',
            'param($p) (Get-AuthenticodeSignature -LiteralPath $p).Status', '-p', file],
            { windowsHide: true, timeout: 30000 }, (err, stdout) => {
                if (err) return resolve({ ok: false, status: 'erreur de vérification' });
                const status = String(stdout || '').trim();
                resolve({ ok: status === 'Valid', status: status || 'inconnu' });
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

        const { url, assets, name } = await resolveInstallerUrl();
        const dest = path.join(os.tmpdir(), 'Inko-Setup.exe');
        // L'installeur COMPLET d'une tentative précédente part ; le morceau
        // en cours, lui, reste : c'est tout l'objet de la reprise.
        try { if (fs.existsSync(dest)) fs.unlinkSync(dest); } catch (e) { /* on écrasera */ }

        try { await download(url, dest); }
        catch (e) {
            return res.status(502).json({ error: 'Installeur introuvable en ligne (la publication est peut-être en cours). Réessaie dans quelques minutes.' });
        }

        if (!fs.existsSync(dest) || fs.statSync(dest).size < 1_000_000) {
            return res.status(502).json({ error: 'Téléchargement de la mise à jour incomplet — réessaie dans un moment, la reprise repartira d’où elle s’est arrêtée.' });
        }

        // ── Vérification avant exécution (audit SEC-03) ──
        const want = await expectedSha(assets, name);
        const got  = await sha256File(dest);
        let verifiedBy = null;

        if (want) {
            if (got !== want) {
                try { fs.unlinkSync(dest); } catch (e) { /* déjà parti */ }
                // Et le morceau avec : sans ça, la tentative suivante
                // reprendrait le même téléchargement corrompu, indéfiniment.
                jeterMorceau(dest);
                console.error(`[update] empreinte invalide — attendu ${want}, obtenu ${got}`);
                return res.status(502).json({
                    error: 'La mise à jour téléchargée ne correspond pas à l\'empreinte publiée. Installation annulée par sécurité.' });
            }
            verifiedBy = 'SHA-256';
        }

        const sig = await authenticodeValid(dest);
        if (sig.ok) verifiedBy = verifiedBy ? `${verifiedBy} + signature` : 'signature Authenticode';

        if (!verifiedBy) {
            if (!ALLOW_UNVERIFIED) {
                try { fs.unlinkSync(dest); } catch (e) { /* déjà parti */ }
                jeterMorceau(dest);
                return res.status(502).json({
                    error: 'Mise à jour non vérifiable : ni empreinte SHA256SUMS publiée, ni signature valide ' +
                           `(statut : ${sig.status}). Installation refusée. Télécharge l'installeur depuis la page des releases, ` +
                           'ou définis INSTALLER_ALLOW_UNVERIFIED=1 si tu sais ce que tu fais.' });
            }
            console.warn('[update] ⚠ installeur NON VÉRIFIÉ exécuté (INSTALLER_ALLOW_UNVERIFIED=1)');
            verifiedBy = 'aucune (forcé)';
        }
        console.log(`[update] installeur vérifié par : ${verifiedBy}`);

        // Lance l'installeur en mode silencieux : NSIS ferme Inko, installe la
        // nouvelle version et la relance. Détaché pour survivre à la fermeture.
        const child = spawn(dest, ['/S'], { detached: true, stdio: 'ignore', windowsHide: false });
        child.unref();

        res.json({ ok: true, message: 'Installation en cours — Inko va redémarrer.' });
    } catch (e) {
        res.status(500).json({ error: 'Mise à jour impossible : ' + (e.message || e) });
    }
}

module.exports = { runUpdate, download, cheminMorceau, jeterMorceau, morceauUtilisable };
