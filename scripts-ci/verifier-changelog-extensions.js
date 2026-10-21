#!/usr/bin/env node
// ============================================================
// verifier-changelog-extensions.js — chaque version a ses notes
// ------------------------------------------------------------
// La mise à jour d'une extension s'installe en un clic (page Sources), et
// cette page montre AVANT l'installation ce qui change. Ce que change une
// version n'existe que si quelqu'un l'a écrit : ce contrôle fait échouer la CI
// quand une extension annonce une version absente de changelog.json.
//
//   node scripts-ci/verifier-changelog-extensions.js
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', 'extensions-community');
const changelog = JSON.parse(fs.readFileSync(path.join(DIR, 'changelog.json'), 'utf8'));
const manquants = [];
for (const id of fs.readdirSync(DIR)) {
    const f = path.join(DIR, id, 'index.js');
    if (!fs.existsSync(f)) continue;
    const v = (/version:\s*'([^']+)'/.exec(fs.readFileSync(f, 'utf8')) || [])[1];
    const entrees = changelog[id] || [];
    const e = entrees.find(x => x.version === v);
    if (!v || !e || !Array.isArray(e.notes) || !e.notes.length) manquants.push(`${id} ${v || '(version introuvable)'}`);
}
if (manquants.length) {
    console.error('::error::Version d’extension sans notes dans extensions-community/changelog.json : ' + manquants.join(', '));
    console.error('Ajoute une entrée { version, date, notes: [...] } décrivant ce qui change.');
    process.exit(1);
}
console.log(`✔ changelog des extensions à jour (${Object.keys(changelog).length} extension(s))`);
