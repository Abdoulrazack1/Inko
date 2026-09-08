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

// ── Le repli hors ligne doit VOYAGER avec le worker ─────────
//
// Le service worker part dans l'APK. Sa liste `STATIC_ASSETS` est generee
// depuis la RACINE du depot, ou toutes les pages existent — mais le paquet
// mobile, lui, est une COPIE choisie fichier par fichier. Rien ne reliait les
// deux listes.
//
// `offline.html` etait ainsi precache par le worker et absent du paquet. Hors
// ligne, une navigation vers une page non mise en cache tombait sur le dernier
// recours de `networkFirst` et l'utilisateur recevait `{"error":"Hors ligne"}`
// en texte brut — a l'endroit precis ou une page avait ete ecrite pour lui.
// Aucune exception, aucun test rouge : juste un 404 dans la console du
// telephone, releve par l'audit des controles.
const SW = fs.readFileSync(path.join(__dirname, '..', '..', 'service-worker.js'), 'utf8');
const BUILD = fs.readFileSync(
    path.join(__dirname, '..', '..', 'scripts-ci', 'build-mobile-www.js'), 'utf8');

/** Les pages HTML que le service worker declare precacher. */
function pagesPrecachees() {
    const bloc = /const STATIC_ASSETS = \[([\s\S]*?)\];/.exec(SW);
    assert.ok(bloc, 'STATIC_ASSETS doit rester lisible dans service-worker.js');
    return [...bloc[1].matchAll(/'\/([^']+\.html)'/g)].map((m) => m[1]);
}

/** Les pages que le build retire explicitement du paquet. */
function pagesExclues() {
    const bloc = /const PAGES_EXCLUES = new Set\(\[([\s\S]*?)\]\)/.exec(BUILD);
    assert.ok(bloc, 'PAGES_EXCLUES doit rester lisible dans build-mobile-www.js');
    return [...bloc[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

test('le repli hors ligne du worker est bien dans sa liste de pré-cache', () => {
    const repli = /const OFFLINE_FALLBACK = '\/([^']+)'/.exec(SW);
    assert.ok(repli, 'OFFLINE_FALLBACK doit rester lisible');
    assert.ok(pagesPrecachees().includes(repli[1]),
        `${repli[1]} est le repli de navigation : il doit être pré-caché`);
});

test('aucune page pré-cachée par le worker n’est retirée du paquet mobile', () => {
    const precachees = pagesPrecachees();
    const exclues = pagesExclues();
    const orphelines = exclues.filter((f) => precachees.includes(f));
    assert.deepEqual(orphelines, [],
        'ces pages sont pré-cachées par le service worker mais exclues du paquet mobile — '
        + 'dans l’APK elles répondront 404 : ' + orphelines.join(', '));
});

test('chaque page pré-cachée existe réellement à la racine', () => {
    const racine = path.join(__dirname, '..', '..');
    const absentes = pagesPrecachees().filter((f) => !fs.existsSync(path.join(racine, f)));
    assert.deepEqual(absentes, [],
        'le worker pré-cache des pages qui n’existent pas : ' + absentes.join(', '));
});
