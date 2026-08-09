#!/usr/bin/env node
// ============================================================
// run-unit-tests.js — Lance les tests unitaires du frontend
// ------------------------------------------------------------
// Pourquoi un script plutôt que `node --test test/unit/` :
//
// Le script npm était `node --test test/unit/`. Il passait en local
// (Node 20, Git Bash) et ÉCHOUAIT en CI (Node 22, Linux) avec
// « Cannot find module .../test/unit » : selon la version, le runner traite
// un argument RÉPERTOIRE soit comme un dossier à parcourir, soit comme un
// fichier de test à exécuter.
//
// Et le remplacer par un glob `test/unit/*.test.js` déplace seulement le
// problème : bash l'étend, `cmd` non — et Node ne sait étendre un glob qu'à
// partir de la v21. Le script npm serait alors cassé pour tout contributeur
// Windows en Node 20.
//
// On énumère donc les fichiers ici, et on passe des chemins EXPLICITES au
// runner : plus rien ne dépend du shell ni de la version de Node.
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DIR = path.join(__dirname, '..', 'test', 'unit');

let fichiers = [];
try {
    fichiers = fs.readdirSync(DIR)
        .filter(f => f.endsWith('.test.js'))
        .sort()
        .map(f => path.join(DIR, f));
} catch (e) {
    console.error(`::error::Dossier de tests introuvable : ${DIR}`);
    process.exit(1);
}

// Zéro fichier = échec, pas succès. Un renommage de dossier ou une
// suite supprimée par erreur ne doit pas donner une CI verte.
if (!fichiers.length) {
    console.error(`::error::Aucun fichier *.test.js dans ${DIR}`);
    process.exit(1);
}

const r = spawnSync(process.execPath, ['--test', ...fichiers], { stdio: 'inherit' });
process.exit(r.status === null ? 1 : r.status);
