// ============================================================
// test/unit/reseau-perdu.test.js — perdre le réseau est UNE chose, pas
// dix échecs
// ------------------------------------------------------------
// Trois modules écoutaient déjà `online` : la file hors-ligne d'`api.js`,
// la synchro, la couche native. Pas un seul n'écoutait `offline`, et
// rien ne le disait à l'écran — vérifié en émettant l'événement dans une
// page de lecture : le document ne bougeait pas d'un caractère.
//
// Ce que ça donnait : on perd le réseau au milieu d'un chapitre, les
// planches encore à charger échouent une par une, et chacune affiche son
// propre « page introuvable ». Dix échecs séparés là où il s'est passé
// une seule chose — et aucun ne nomme la cause.
//
// Mesuré après, dans la page :
//   lecteur      « Réseau perdu. Les planches déjà chargées restent lisibles. »
//   ailleurs     « … Ta bibliothèque et tes chapitres téléchargés restent accessibles. »
//   deux `offline` d'affilée  → un seul bandeau
//   après 6 s                 → toujours là (un bandeau ordinaire meurt à 4 s)
//   `online`                  → refermé
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const lire = (...p) => fs.readFileSync(path.join(RACINE, ...p), 'utf8').replace(/\r\n/g, '\n');
const GLOBAL = lire('assets', 'js', 'global.js');
const BLOC = /\(function reseauPerdu\(\) \{([\s\S]*?)\n    \}\)\(\);/.exec(GLOBAL);

test('quelqu’un écoute enfin la perte du réseau', () => {
    assert.ok(BLOC, 'le bloc reseauPerdu');
    assert.match(BLOC[1], /window\.addEventListener\('offline', surPerte\)/);
    assert.match(BLOC[1], /window\.addEventListener\('online',/);
});

test('le message dit ce qui marche ENCORE', () => {
    // « Réseau perdu » tout seul n'est pas actionnable : on le voit bien
    // assez sans qu'on le dise. Ce qui aide, c'est ce qui reste possible.
    assert.match(BLOC[1], /Les planches déjà chargées restent lisibles/);
    assert.match(BLOC[1], /Ta bibliothèque et tes chapitres téléchargés restent accessibles/);
    // Et le message dépend de la page : dans un lecteur, parler de la
    // bibliothèque enverrait ailleurs quelqu'un qui est en train de lire.
    assert.match(BLOC[1], /dansUnLecteur\(\)/);
    assert.match(BLOC[1], /\.reader-page-img, \.novel-content, #readerPagesArea/);
});

test('il dure aussi longtemps que la panne', () => {
    // Un bandeau ordinaire s'efface à 4 s. Pour un état qui dure dix
    // minutes, il aurait disparu avant d'avoir servi.
    assert.match(BLOC[1], /const TRES_LONG = 86400000;/);
    assert.match(BLOC[1], /duree: TRES_LONG/);
    // Et c'est le retour du réseau qui le ferme, pas un minuteur.
    assert.match(BLOC[1], /bandeau\.fermer\(\); bandeau = null;/);
});

test('deux pertes de suite ne font qu’un bandeau', () => {
    assert.match(BLOC[1], /if \(bandeau\) return;/);
});

test('et on n’annonce pas un retour qui n’a jamais eu lieu', () => {
    // `online` se déclenche aussi sans perte préalable. Sans ce garde,
    // une page ouverte en ligne pourrait afficher « Réseau revenu ».
    assert.match(BLOC[1], /\('online', \(\) => \{ if \(bandeau\) surRetour\(\); \}\)/);
});

test('le chargement déjà hors ligne garde son propre traitement', () => {
    // `offline` ne se déclenche qu'à la TRANSITION. Le cas « on démarre
    // sans réseau » est traité depuis longtemps par le repli des
    // lecteurs, et ce bandeau ne doit pas s'y superposer.
    assert.match(lire('assets', 'js', 'chapitre.js'), /Lecture hors-ligne/);
});
