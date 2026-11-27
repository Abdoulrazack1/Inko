// ============================================================
// lib/dossiers.js — où vivent les données que l'utilisateur ne doit pas perdre
// ------------------------------------------------------------
// DAT-24 : dans l'application Windows, les sauvegardes et les fichiers
// importés étaient rangés DANS le dossier d'installation (resources\server\…),
// à côté du programme — constaté sur une installation réelle —, alors que le
// code de la base annonçait que les données ne vivent jamais là. Ce dossier
// appartient à l'installeur : il le remplace à chaque mise à jour et
// l'efface à la désinstallation.
//
// Installée (APP_VERSION), l'application les range désormais avec la base et
// les secrets, dans le profil de l'utilisateur. Une variable d'environnement
// explicite garde la main ; depuis les sources, rien ne change.
// Au premier démarrage après la mise à jour, ce qui se trouve à l'ancien
// endroit est déplacé.
'use strict';
const fs = require('fs');
const path = require('path');

const SERVEUR = path.join(__dirname, '..');

function dossierDonnees(nom, variable) {
    if (process.env[variable]) return process.env[variable];
    if (process.env.APP_VERSION) return path.join(require('./secrets-locaux').dossier(), nom);
    return path.join(SERVEUR, nom);
}

/**
 * Déplace le contenu de `ancien` vers `cible`, sans rien écraser.
 * Un élément qui ne peut pas être déplacé reste où il est : rien n'est perdu.
 * @returns {number} le nombre d'éléments déplacés
 */
function deplacer(ancien, cible) {
    if (path.resolve(ancien) === path.resolve(cible) || !fs.existsSync(ancien)) return 0;
    const contenu = fs.readdirSync(ancien);
    if (!contenu.length) return 0;
    fs.mkdirSync(cible, { recursive: true });
    let n = 0;
    for (const e of contenu) {
        const de = path.join(ancien, e), vers = path.join(cible, e);
        if (fs.existsSync(vers)) continue;                  // rien n'est écrasé
        try { fs.renameSync(de, vers); }
        catch (err) {
            // Autre volume (EXDEV) ou fichier tenu : on copie, et on n'efface
            // l'original qu'une fois la copie faite.
            fs.cpSync(de, vers, { recursive: true });
            fs.rmSync(de, { recursive: true, force: true });
        }
        n++;
    }
    return n;
}

const deplaces = new Set();
/** Une fois par démarrage : rapatrie l'ancien dossier server/<nom> vers `cible`. */
function rapatrier(nom, cible) {
    // Seulement pour l'app installée : sur un serveur, un BACKUP_DIR posé à la
    // main ne doit pas aspirer ce qui se trouve dans server/.
    if (!process.env.APP_VERSION || deplaces.has(nom)) return;
    deplaces.add(nom);
    try {
        const n = deplacer(path.join(SERVEUR, nom), cible);
        if (n) console.log(`[donnees] ${n} élément(s) de « ${nom} » déplacé(s) hors du dossier d'installation → ${cible}`);
    } catch (e) {
        console.warn(`[donnees] ⚠ déplacement de « ${nom} » impossible (${e.code || e.message}) : l'ancien dossier reste en place.`);
    }
}

function dossierSauvegardes() { const d = dossierDonnees('backups', 'BACKUP_DIR'); rapatrier('backups', d); return d; }
function dossierImports() { const d = dossierDonnees('uploads', 'INKO_UPLOADS_DIR'); rapatrier('uploads', d); return d; }

module.exports = { dossierSauvegardes, dossierImports, dossierDonnees, _internes: { deplacer } };
