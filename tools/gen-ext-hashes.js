#!/usr/bin/env node
// ============================================================
// gen-ext-hashes.js — Génère extensions-community/hashes.json (audit S-2)
// ------------------------------------------------------------
// Empreinte SHA-256 de chaque <id>/index.js. Le serveur vérifie ce hash
// avant d'écrire une extension mise à jour sur disque : une source altérée
// (CDN raw compromis, commit malveillant) est rejetée.
// À relancer chaque fois qu'une extension change, AVANT de taguer une release :
//   node tools/gen-ext-hashes.js
// ============================================================
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DIR = path.join(__dirname, '..', 'extensions-community');
const out = {};
for (const id of fs.readdirSync(DIR)) {
    const file = path.join(DIR, id, 'index.js');
    if (!fs.existsSync(file)) continue;
    out[id] = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}
fs.writeFileSync(path.join(DIR, 'hashes.json'), JSON.stringify(out, null, 2) + '\n');
console.log(`✔ hashes.json : ${Object.keys(out).length} extension(s)`);
