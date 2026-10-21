// ============================================================
// test/unit/maj-extensions.test.js — mise à jour d'une extension : ce qui
// change, et ce qui sera vérifié
// ------------------------------------------------------------
// Vérifié sur la vraie page Sources (Chromium, réponse de mise à jour
// simulée) : « WeebCentral v1.4.1 → v1.5.0 · Ce qui change · v1.5.0 … ·
// v1.4.2 … · Empreinte vérifiée à l'installation : a3f9c2b1d4e5… ·
// [Mettre à jour] » ; une source sans empreinte publiée : bouton désactivé,
// « installation impossible tant qu'elle manque ». Le serveur est testé dans
// server/test/maj-extensions.test.js.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'sources.js'), 'utf8');

test('la page montre les notes et l\'empreinte, et n\'invite pas à une installation qui serait refusée', () => {
    assert.match(SRC, /\$\{notesVersion\(u\.notes\)\}/);
    assert.match(SRC, /\$\{empreinteLigne\(u\.empreinte\)\}/);
    assert.match(SRC, /\$\{u\.empreinte \? '' : 'disabled title="Aucune empreinte publiée/);
});

test('chaque extension a des notes pour sa version actuelle (contrôle de la CI)', () => {
    const sortie = execFileSync(process.execPath, [path.join(ROOT, 'scripts-ci', 'verifier-changelog-extensions.js')], { encoding: 'utf8' });
    assert.match(sortie, /changelog des extensions à jour/);
    assert.match(fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'ci.yml'), 'utf8'), /verifier-changelog-extensions\.js/);
});
