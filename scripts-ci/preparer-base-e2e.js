#!/usr/bin/env node
// ============================================================
// preparer-base-e2e.js — crée la base JETABLE des parcours e2e
// ------------------------------------------------------------
// La suite e2e ÉCRIT : favoris ajoutés et retirés, réglages, listes. Jouée
// contre la base `inko` d'un poste de développement, elle touche à la vraie
// bibliothèque — et la table `users` en portait la preuve : 25 comptes de test
// à côté du seul compte réel (audit DAT-04, incident du 9 novembre).
//
// playwright.config.js lance ce script AVANT le serveur. Il est idempotent
// (CREATE IF NOT EXISTS + migrations) et refuse de préparer autre chose
// qu'une base dont le nom commence par `inko_e2e`.
//
//   DB_NAME=inko_e2e node scripts-ci/preparer-base-e2e.js
// ============================================================
'use strict';

const path = require('path');
const { spawnSync } = require('child_process');

const BASE = process.env.DB_NAME || 'inko_e2e';

// En CI, la base `inko` du job est elle-même jetable : init.js l'a déjà préparée.
if (process.env.CI) process.exit(0);

if (!/^inko_e2e[A-Za-z0-9_]*$/.test(BASE)) {
    console.error(`[e2e] refus : « ${BASE} » n'est pas une base d'essai (son nom doit commencer par inko_e2e).`);
    process.exit(1);
}
const r = spawnSync(process.execPath, [path.join(__dirname, '..', 'server', 'db', 'init.js')], {
    cwd: path.join(__dirname, '..', 'server'),
    env: { ...process.env, DB_NAME: BASE },
    stdio: 'inherit',
    timeout: 120000,
});
process.exit(r.status === null ? 1 : r.status);
