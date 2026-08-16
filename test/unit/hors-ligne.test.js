// ============================================================
// test/unit/hors-ligne.test.js — la règle du mode hors ligne (P2.3)
// ------------------------------------------------------------
// La règle tient en une phrase, et elle est subtile : **on ne bloque QUE s'il
// n'y a rien à lire**. Se tromper de côté donne deux défauts opposés, tous
// deux graves :
//
//   · bloquer alors qu'il y a des chapitres → l'app est inutilisable dans le
//     métro, c'est-à-dire exactement là où on l'a téléchargée pour ;
//   · ne pas bloquer alors qu'il n'y a rien → l'utilisateur erre dans des
//     pages vides sans comprendre, et sans moyen de reconfigurer.
//
// Ces tests portent sur la DÉCISION, pas sur le DOM : la décision est ce qui
// se casse en silence quand on touche à `hub.js`.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SOURCE = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'hub.js'), 'utf8');

// Les commentaires de ce module CITENT les pièges qu'il évite — dont
// « indexedDB.open(nom) sans version ». Les analyser reviendrait à échouer sur
// sa propre explication : premier passage de ces tests, faux positif immédiat.
// On lit donc le CODE, pas ce qu'il dit de lui-même.
const HUB = SOURCE
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .split('\n').map(l => l.replace(/(^|[^:])\/\/.*$/, '$1')).join('\n');

test('hub.js n’ouvre JAMAIS IndexedDB sans numéro de version', () => {
    // `indexedDB.open(nom)` sans version CRÉE la base si elle n'existe pas —
    // vide, en version 1. `downloads.js` l'ouvre ensuite en version 1, ne
    // déclenche donc aucune mise à niveau, et son magasin `chapters` n'est
    // jamais créé : plus aucun téléchargement possible, définitivement, sur
    // une installation neuve.
    //
    // Défaut réellement introduit puis constaté (« version=1 stores= »), et
    // qu'aucun test d'interface n'aurait vu : tout se passe bien jusqu'au
    // premier téléchargement, des jours plus tard.
    const ouvertures = [...HUB.matchAll(/indexedDB\.open\(([^)]*)\)/g)].map(m => m[1]);
    assert.ok(ouvertures.length > 0, 'le module doit bien consulter la base');
    for (const args of ouvertures) {
        assert.match(args, /,\s*\d+/, `open(${args}) sans version : créerait une base vide et non réparable`);
    }
});

test('hub.js crée le magasin `chapters` comme downloads.js', () => {
    // Puisqu'il ouvre la base avec une version, il peut déclencher la
    // migration. Il doit alors créer la MÊME structure — sinon c'est lui qui
    // laisse la base dans un état que `downloads.js` ne peut plus réparer.
    assert.match(HUB, /onupgradeneeded/, 'la migration doit être prise en charge');
    assert.match(HUB, /createObjectStore\('chapters',\s*\{\s*keyPath:\s*'chapterId'\s*\}\)/,
        'même magasin et même clé que downloads.js');
    assert.match(HUB, /createIndex\('mangaId'/, 'même index que downloads.js');
});

test('le mur n’est posé que s’il n’y a rien à lire', () => {
    // On vérifie la FORME de la décision : `ecran(...)` bloquant seulement
    // dans la branche « aucun chapitre », bandeau sinon.
    const i = HUB.indexOf('const n = await chapitresHorsLigne()');
    assert.ok(i > 0, 'la décision doit consulter les chapitres hors ligne');
    const suite = HUB.slice(i, i + 400);
    assert.match(suite, /if\s*\(!n\)/, 'le blocage doit être conditionné à l’absence de chapitre');
    assert.match(suite, /bandeauHorsLigne/, 'avec des chapitres, on affiche un bandeau');
});

test('le bandeau propose une sortie, il n’informe pas seulement', () => {
    // Un bandeau qui constate sans rien proposer est un cul-de-sac décoré.
    const i = HUB.indexOf('function bandeauHorsLigne');
    const bloc = HUB.slice(i, i + 2200);
    assert.match(bloc, /downloads\.html/, 'accès aux téléchargements');
    assert.match(bloc, /data-hl="config"/, 'possibilité de corriger l’adresse');
    assert.match(bloc, /data-hl="fermer"/, 'et de le refermer — il informe, il n’interrompt pas');
    assert.match(bloc, /min-height:44px/, 'cibles tactiles à 44 px (MOB-02)');
});

test('aucun gestionnaire en ligne dans hub.js (DESK-01)', () => {
    // La CSP de l'application installée bloque `onclick=` en attribut : c'est
    // ce qui a rendu le lecteur inutilisable en 2.5.7. Le bandeau est
    // construit en chaîne, donc le piège est à portée de main.
    assert.doesNotMatch(HUB, /\son[a-z]+\s*=\s*["'][^"']*["']/i,
        'les gestionnaires doivent passer par addEventListener');
});
