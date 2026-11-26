// _propre.js — ce qui part dans un fichier de résultats versionné ne doit rien dire de la
// machine qui a joué les sondes : ni dossier personnel, ni adresse du réseau local, ni jeton.
'use strict';
const path = require('path');

const RACINE = path.resolve(__dirname, '..', '..');
const echapper = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
// le dépôt, écrit avec des barres simples ou doublées (texte JSON) et dans les deux sens
const SEP = '[\\\\/]{1,2}';
const DEPOT = new RegExp(RACINE.split(/[\\/]+/).map(echapper).join(SEP) + SEP, 'gi');

function propre(texte) {
    return String(texte)
        .replace(DEPOT, '')
        .replace(/[A-Z]:(\\\\|\\|\/)+Users(\\\\|\\|\/)+[^\\/"'\s]+/gi, '~')
        .replace(/\/(home|Users)\/[^/"'\s]+/g, '~')
        .replace(/\b(192\.168|10\.\d{1,3}|172\.(1[6-9]|2\d|3[01]))\.\d{1,3}\.\d{1,3}\b(?!\/\d)/g, '(adresse locale)')
        .replace(/eyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/g, '(jeton)')
        .replace(new RegExp(echapper(require('os').hostname()), 'gi'), '(machine)');
}

/** Rend un objet sérialisable débarrassé de ce qui identifie la machine. */
const nettoyer = (objet) => JSON.parse(propre(JSON.stringify(objet)));

module.exports = { propre, nettoyer };

// node scripts-ci/sondes/_propre.js fichier.json… : nettoie des résultats déjà écrits
if (require.main === module) {
    const fs = require('fs');
    for (const f of process.argv.slice(2)) {
        const avant = fs.readFileSync(f, 'utf8');
        const apres = propre(avant);
        JSON.parse(apres);
        if (apres !== avant) { fs.writeFileSync(f, apres); console.log('nettoyé', f); }
    }
}
