#!/usr/bin/env node
// ============================================================
// sondes/fusionner.js — ajoute les résultats d'une passe partielle à sondes.json
// ------------------------------------------------------------
//   node scripts-ci/sondes/fusionner.js docs/audit/sondes-boutons.json
//
// Utile quand une sonde est longue (« boutons » : ≈ 25 min) : on la lance une
// fois, puis on la fusionne dans la passe rapide des autres sondes.
// La sonde fusionnée REMPLACE son ancienne version dans sondes.json.
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const C = require('./_commun');
const { ORDRE } = require('./lancer');

const cible = path.join(C.RACINE, 'docs', 'audit', 'sondes.json');
const base = JSON.parse(fs.readFileSync(cible, 'utf8'));
const ajout = JSON.parse(fs.readFileSync(path.resolve(process.argv[2]), 'utf8'));
for (const [nom, s] of Object.entries(ajout.sondes)) {
    base.sondes[nom] = s;
    base.trouvailles = base.trouvailles.filter(f => f.sonde !== nom);
}
base.trouvailles.push(...ajout.trouvailles);
base.trouvailles.sort((a, b) => ORDRE[a.gravite] - ORDRE[b.gravite]);
fs.writeFileSync(cible, JSON.stringify(require('./_propre').nettoyer(base), null, 1));
console.log(`✓ fusion : ${Object.keys(ajout.sondes).join(', ')} → ${base.trouvailles.length} trouvailles, ${Object.keys(base.sondes).length} sondes`);
