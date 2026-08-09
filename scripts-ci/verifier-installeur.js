#!/usr/bin/env node
// ============================================================
// verifier-installeur.js — Controle du .exe REELLEMENT produit
// ------------------------------------------------------------
// Pourquoi ce script existe :
//
// prep.js verifie le dossier de PREPARATION. Ce n'est pas ce qu'on
// distribue. Entre les deux, Tauri ne prend que ce que `bundle.resources`
// declare — une liste blanche. La 2.5.1 et la 2.5.2 sont parties avec zero
// source parce que le dossier de reference etait bien prepare et jamais
// declare : le controle regardait au mauvais endroit, et il etait vert.
//
// Un installeur ne se verifie donc pas par ce qu'on a voulu y mettre, mais
// par ce qu'il contient. On ouvre l'archive NSIS et on regarde.
//
// Usage :
//   node scripts-ci/verifier-installeur.js <chemin-du-setup.exe>
// ============================================================
'use strict';

const fs = require('fs');
const { execFileSync } = require('child_process');

const exe = process.argv[2];
if (!exe || !fs.existsSync(exe)) {
    console.error(`::error::Installeur introuvable : ${exe || '(aucun chemin donne)'}`);
    process.exit(1);
}

// 7-Zip lit les archives NSIS. Present sur les runners windows-latest ; en
// local on tente aussi les emplacements d'installation habituels.
const CANDIDATS = [
    '7z',
    'C:\\Program Files\\7-Zip\\7z.exe',
    'C:\\Program Files (x86)\\7-Zip\\7z.exe',
];
let liste = null;
for (const bin of CANDIDATS) {
    try {
        liste = execFileSync(bin, ['l', exe], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
        break;
    } catch (e) { /* binaire absent ou archive illisible : on tente le suivant */ }
}
if (liste === null) {
    console.error('::error::7-Zip introuvable — impossible d’inspecter l’installeur.');
    process.exit(1);
}

// Les chemins sont en style Windows dans la liste 7z.
const fichiers = liste.split(/\r?\n/)
    .map(l => (l.match(/^\d{4}-\d{2}-\d{2}\s+\S+\s+\S+\s+\S*\s+\S*\s+(.+)$/) || [])[1])
    .filter(Boolean)
    .map(f => f.trim().replace(/\\/g, '/'));

if (!fichiers.length) {
    console.error('::error::Aucun fichier lu dans l’installeur — format inattendu.');
    process.exit(1);
}

const echecs = [];
const dire = (ok, msg) => console.log(`${ok ? '  ok  ' : '  NON '} ${msg}`);

// 1) Des sources, et leurs empreintes. Sans elles l'app demarre sur
//    « Impossible de demarrer » : il n'y a rien a lire.
const sources = fichiers.filter(f => /^resources\/extensions-community\/[^/]+\/index\.js$/.test(f));
const empreintes = fichiers.includes('resources/extensions-community/hashes.json');
dire(sources.length >= 5, `${sources.length} source(s) de reference embarquee(s)`);
dire(empreintes, 'hashes.json (controle d’integrite des sources)');
if (sources.length < 5) echecs.push(`seulement ${sources.length} source(s) dans l’installeur`);
if (!empreintes) echecs.push('hashes.json absent : les sources seraient refusees au demarrage');

// 2) De quoi demarrer.
for (const attendu of [
    'resources/server/server.js',
    'resources/server/extensions/loader.js',
    'resources/frontend/accueil.html',
    'resources/mariadb/bin/mariadbd.exe',
]) {
    const present = fichiers.includes(attendu);
    dire(present, attendu);
    if (!present) echecs.push(`${attendu} absent`);
}

// 3) Rien de personnel. Le build 2.5.0 avait embarque server/backups :
//    12 dumps, 26 comptes avec email et bibliotheque en clair.
const FUITES = [
    [/^resources\/server\/backups\//, 'sauvegardes de la machine de build'],
    [/^resources\/server\/uploads\//, 'fichiers televerses'],
    [/^resources\/server\/\.env/, 'variables d’environnement'],
    [/^resources\/server\/test\//, 'tests'],
    [/^resources\/server\/config\/(vapid|google|anilist|local-owner)\.json$/, 'secrets de configuration'],
];
for (const [re, quoi] of FUITES) {
    const trouves = fichiers.filter(f => re.test(f));
    dire(!trouves.length, `aucune fuite : ${quoi}`);
    if (trouves.length) echecs.push(`${trouves.length} fichier(s) — ${quoi} : ${trouves.slice(0, 3).join(', ')}`);
}

console.log(`\n${fichiers.length} fichier(s) inspecte(s) dans ${exe}`);
if (echecs.length) {
    for (const e of echecs) console.error(`::error::${e}`);
    console.error('\nInstalleur REFUSE — il ne doit pas etre publie.');
    process.exit(1);
}
console.log('Installeur conforme.');
