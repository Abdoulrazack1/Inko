#!/usr/bin/env node
// ============================================================
// notes-release.js — le titre et les notes d'une release, depuis le CHANGELOG
// ------------------------------------------------------------
// Ils étaient posés À LA MAIN après chaque publication. Donc oubliables, et
// oubliés : la v2.6.0 est sortie intitulée « v2.6.0 », avec un corps vide,
// alors que le CHANGELOG contenait déjà les cinquante-sept lignes qu'il
// fallait.
//
// Ce script les en extrait. Il ne réécrit rien : le CHANGELOG reste le seul
// endroit où ces textes sont rédigés, et la release en devient un reflet.
//
// ── Pourquoi un fichier, et pas trois lignes dans le YAML ───
//
// La version précédente vivait dans un `run: |` de workflow. Le texte
// traversait alors YAML, puis bash, puis `node -e` — trois niveaux
// d'échappement, où un `\n` finit par devenir un vrai saut de ligne et casse
// le YAML. C'est arrivé du premier coup. Ici, il n'y en a aucun.
//
// Usage : node scripts-ci/notes-release.js 2.6.0
//   → écrit RELEASE_TITLE.txt et RELEASE_NOTES.md, et sort 0 même sans entrée
//     (une release sans notes vaut mieux qu'une publication qui échoue).
'use strict';

const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..');
const version = (process.argv[2] || '').replace(/^v/, '');

if (!version) {
    console.error('::error::usage : node scripts-ci/notes-release.js <version>');
    process.exit(1);
}

const md = fs.readFileSync(path.join(RACINE, 'CHANGELOG.md'), 'utf8');

// L'entrée va de son titre `## <version> — …` jusqu'au `##` suivant, ou la fin
// du fichier pour la toute première publication.
//
// ⚠ La fin se cherche à l'INDEX, pas par une alternative `|$` dans la
// lookahead. En mode `m`, `$` matche la fin de chaque LIGNE : l'alternative
// coupait l'entrée après son premier paragraphe. Mesuré : 2 lignes extraites
// au lieu de 57, et une release publiée quasi vide — exactement le défaut que
// ce script existe pour supprimer.
const echappee = version.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const debut = new RegExp(`^## (${echappee}[^\\n]*)\\n`, 'm').exec(md);

let bloc = null;
if (debut) {
    const apres = debut.index + debut[0].length;
    const suivant = md.indexOf('\n## ', apres);
    bloc = [null, debut[1], md.slice(apres, suivant === -1 ? undefined : suivant)];
}

if (!bloc) {
    // Pas une erreur : un tag peut précéder la rédaction du journal, et faire
    // échouer la publication pour ça coûterait bien plus que des notes vides.
    console.error(`::warning::aucune entrée « ${version} » dans CHANGELOG.md — release sans notes détaillées.`);
    fs.writeFileSync(path.join(RACINE, 'RELEASE_TITLE.txt'), `Inko ${version}`);
    fs.writeFileSync(path.join(RACINE, 'RELEASE_NOTES.md'),
        `Voir [CHANGELOG.md](https://github.com/Abdoulrazack1/Inko/blob/main/CHANGELOG.md).\n`);
    process.exit(0);
}

const titre = `Inko ${bloc[1].trim()}`;
const notes = bloc[2].trim() + '\n';

fs.writeFileSync(path.join(RACINE, 'RELEASE_TITLE.txt'), titre);
fs.writeFileSync(path.join(RACINE, 'RELEASE_NOTES.md'), notes);

console.log(`titre : ${titre}`);
console.log(`notes : ${notes.split('\n').length} lignes`);
