// ============================================================
// lib/secrets-locaux.js — un secret par INSTALLATION
// ------------------------------------------------------------
// Généralise ce que `embedded-db.js` fait déjà pour le mot de passe de la base
// (audit S12/SEC-13) : un aléa tiré au premier démarrage, écrit dans le profil
// de l'utilisateur courant, avec des droits restreints à lui seul.
//
// Pourquoi ce module : deux secrets étaient jusqu'ici des CONSTANTES.
//
//   · SEC-02 — `lib/secret.js` retombait sur la chaîne littérale
//     `inko-dev-secret-change-me` dès que `JWT_SECRET` n'était pas défini. En
//     production le processus refuse de démarrer, mais le sidecar desktop ne
//     tourne pas avec `NODE_ENV=production` : **toutes les installations
//     partageaient donc le même secret**, et un jeton s'y forge hors ligne,
//     sans jamais toucher au serveur.
//
//   · SEC-04 — `lib/backup.js` ne chiffre que si `BACKUP_PASSPHRASE` est
//     défini. Sans elle, le dump quotidien contient l'email et la bibliothèque
//     de TOUS les comptes, en clair.
//
// Dans les deux cas, une variable d'environnement explicite reste prioritaire :
// un déploiement serveur garde la main. Ce module ne sert qu'au cas où
// personne n'a rien posé — c'est-à-dire l'installation desktop.
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');

function dossier() {
    const base = process.env.APPDATA || path.join(os.homedir(), '.config');
    return path.join(base, 'Inko');
}

// Droits : lisible par le service (il doit relire le secret à chaque
// démarrage), fermé aux autres comptes de la machine. `mode` suffit sur POSIX ;
// sur Windows il faut casser l'héritage d'ACL, comme le fait déjà
// `embedded-db.js` pour le mot de passe de la base.
function ecrireRestreint(fichier, contenu) {
    fs.mkdirSync(path.dirname(fichier), { recursive: true });
    fs.writeFileSync(fichier, contenu, { mode: 0o600 });
    try { fs.chmodSync(fichier, 0o600); } catch (e) { /* système de fichiers sans permissions */ }
    if (process.platform === 'win32') {
        try {
            require('child_process').execFileSync('icacls',
                [fichier, '/inheritance:r', '/grant:r', `${process.env.USERNAME}:F`],
                { stdio: 'ignore', windowsHide: true, timeout: 10_000 });
        } catch (e) { /* ACL non restreinte : le secret reste dans le profil utilisateur */ }
    }
}

/**
 * Rend le secret nommé, en le créant au premier appel.
 * @param {string} nom   nom de fichier, sans extension
 * @param {number} octets  longueur de l'aléa (64 octets = 128 caractères hex)
 * @returns {string|null} le secret, ou null si le disque refuse l'écriture
 */
function obtenir(nom, octets = 48) {
    const fichier = path.join(dossier(), `${nom}.json`);
    try {
        const brut = JSON.parse(fs.readFileSync(fichier, 'utf8'));
        if (brut && typeof brut.valeur === 'string' && brut.valeur.length >= 32) return brut.valeur;
    } catch (e) { /* absent ou illisible : on en génère un */ }
    try {
        const valeur = crypto.randomBytes(octets).toString('hex');
        ecrireRestreint(fichier, JSON.stringify({ valeur, at: new Date().toISOString() }));
        return valeur;
    } catch (e) {
        // Disque en lecture seule, profil inaccessible : on ne peut pas
        // persister. L'appelant décidera — mais il ne doit SURTOUT pas
        // fabriquer un secret volatil, qui invaliderait toutes les sessions à
        // chaque redémarrage.
        return null;
    }
}

module.exports = { obtenir, dossier };
