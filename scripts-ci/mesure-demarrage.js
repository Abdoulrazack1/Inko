#!/usr/bin/env node
'use strict';
// ============================================================
// mesure-demarrage.js — où part le temps de démarrage du serveur ?
// ------------------------------------------------------------
// Le chantier affirmait : « réduire le temps de premier lancement —
// l'initialisation de la base domine ». Personne ne l'avait mesuré.
//
// Relevé du 9 novembre, base déjà en service (démarrage À CHAUD) :
//
//     44 ms    7 %   checkCurl, synchrone et bloquant
//     86 ms   15 %   require embedded-db
//     73 ms   12 %   ensureDatabase
//    387 ms   66 %   require app
//    590 ms  100 %   total
//
// La base fait 12 %. Ce qui domine, c'est le CHARGEMENT DES MODULES, et
// il n'y a pas de coupable : 400 ms répartis sur des centaines de
// fichiers, le plus gros à 31 ms (`mime-types`), puis 24 (`axios`).
// Il n'y a donc rien à retirer d'un coup — seulement un cas net, le
// contrôle de `curl`, qui bloquait 44 ms pour imprimer un avertissement
// que rien n'attend.
//
// CE QUE CE RELEVÉ NE DIT PAS, et il faut le dire. C'est un démarrage à
// CHAUD : la base existe, les migrations sont déjà appliquées. Au
// PREMIER lancement, `ensureDatabase` doit créer et initialiser la
// MariaDB embarquée et jouer toutes les migrations — et là, la base
// domine probablement. Mesurer ce cas demande de détruire une base
// existante ; ce script ne le fera pas tout seul, et moi non plus sur
// la machine de quelqu'un.
//
//   node scripts-ci/mesure-demarrage.js          relève et affiche
//   node scripts-ci/mesure-demarrage.js --modules  détaille les requires

const path = require('path');
const { performance } = require('perf_hooks');

const SERVEUR = path.join(__dirname, '..', 'server');
const DETAIL = process.argv.includes('--modules');

process.chdir(SERVEUR);
require(path.join(SERVEUR, 'node_modules', 'dotenv')).config({ path: path.join(SERVEUR, '.env') });

// ── Temps PROPRE de chaque module (hors enfants) ────────────
// Un simple chronomètre autour de `require` compterait le coût des
// enfants dans celui du parent, et tout remonterait au premier module
// chargé. On soustrait donc ce que chaque appel a passé dans ses
// propres requires.
const Module = require('module');
const propre = new Map();
const pile = [];
const vrai = Module.prototype.require;
function instrumenter() {
    Module.prototype.require = function (id) {
        const debut = process.hrtime.bigint();
        const cadre = { enfants: 0n };
        pile.push(cadre);
        try {
            return vrai.apply(this, arguments);
        } finally {
            pile.pop();
            const total = process.hrtime.bigint() - debut;
            if (pile.length) pile[pile.length - 1].enfants += total;
            let nom = id;
            try {
                if (id.startsWith('.')) nom = path.relative(SERVEUR, Module._resolveFilename(id, this));
            } catch (e) { /* non résolu : on garde le nom tel quel */ }
            propre.set(nom, (propre.get(nom) || 0n) + (total - cadre.enfants));
        }
    };
}
const rendre = () => { Module.prototype.require = vrai; };

const etapes = [];
async function chrono(nom, f) {
    const t = performance.now();
    const r = await f();
    etapes.push([nom, performance.now() - t]);
    return r;
}

(async () => {
    const t0 = performance.now();
    if (DETAIL) instrumenter();

    // Les chemins sont ABSOLUS : `process.chdir` ne deplace pas la
    // resolution des modules, qui part du fichier appelant.
    const EMB = path.join(SERVEUR, 'lib', 'embedded-db.js');
    const APP = path.join(SERVEUR, 'app.js');
    await chrono('require embedded-db', () => require(EMB));
    const { ensureDatabase } = require(EMB);
    await chrono('ensureDatabase', () => ensureDatabase());
    await chrono('require app', () => require(APP));

    const total = performance.now() - t0;
    rendre();

    console.log('');
    for (const [nom, ms] of etapes) {
        console.log('  ' + ms.toFixed(0).padStart(6) + ' ms  '
            + String(Math.round((ms / total) * 100)).padStart(3) + ' %  ' + nom);
    }
    console.log('  ' + total.toFixed(0).padStart(6) + ' ms  100 %  TOTAL (démarrage à CHAUD)');

    if (DETAIL) {
        const lignes = [...propre.entries()]
            .map(([n, ns]) => [n, Number(ns) / 1e6])
            .filter(([, ms]) => ms >= 4)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 20);
        console.log('\n  Modules les plus coûteux (temps propre, ≥ 4 ms) :');
        for (const [n, ms] of lignes) console.log('    ' + ms.toFixed(0).padStart(5) + ' ms  ' + n);
        if (!lignes.length) console.log('    (aucun au-dessus de 4 ms)');
    }

    console.log('\n  À chaud, la base n’est pas le poste dominant : c’est le chargement');
    console.log('  des modules. Le PREMIER lancement, lui, crée la base et joue les');
    console.log('  migrations — ce relevé ne le couvre pas.');

    // Le serveur écoute maintenant : on le ferme, c'est une mesure, pas un run.
    setTimeout(() => process.exit(0), 150);
})().catch((e) => {
    console.error('Mesure impossible :', e.message);
    process.exit(1);
});
