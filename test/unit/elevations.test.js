// ============================================================
// test/unit/elevations.test.js — cinq distances, une seule définition
// ------------------------------------------------------------
// MESURE AVANT : **60 ombres DISTINCTES pour 71 déclarations littérales** —
// presque une ombre unique par usage, réglée à l'œil, composant par
// composant. Pendant ce temps `--shadow-1/2/3` existaient et ne servaient
// que 16 fois.
//
// Pire que l'incohérence : **49 de ces 71 littérales sont en noir pur**,
// quand le jeton de l'édition claire porte `rgba(28,27,25)` — l'encre tiède
// du Washi. Sur fond de papier, une ombre noire ne tombe pas de la même
// lumière que le reste de la page.
//
// CINQ niveaux, et non quatre comme le chantier le prévoyait. En migrant,
// six badges — ceux qui flottent SUR une couverture — se retrouvaient
// aplatis par le niveau « posé » (1 px d'offset, 2 px de flou) alors qu'ils
// portaient 2 px / 8 px. Le niveau au-dessus leur donnait 18 px de flou
// pour 20 px de haut. Aucun des deux voisins ne convenait : une pastille
// colorée sur une photo chargée a besoin d'être décollée, là où une carte
// posée sur une page unie se contente d'un filet.
//
// Vérifié dans le navigateur, bibliothèque, 496 cartes :
//
//     le badge rend 0 2px 8px rgba(0,0,0,.4) — sa valeur d'origine,
//     désormais nommée
//     accueil : 38 éléments ombrés avant, 38 après, aucun perdu ;
//     10 ombres distinctes sur la page, puis 8
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const CSS_DIR = path.join(RACINE, 'assets', 'css');
const lire = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const GLOBAL = lire(path.join(CSS_DIR, 'global.css'));

const NIVEAUX = ['e-pose', 'e-detache', 'e-souleve', 'e-flottant', 'e-modal'];

test('les cinq niveaux existent dans les deux éditions', () => {
    // L'édition claire et l'édition sombre ne posent pas la même ombre : la
    // première la teinte d'encre, la seconde la pose sur du noir profond.
    for (const n of NIVEAUX) {
        const occurrences = GLOBAL.match(new RegExp('--' + n + ':\\s*0 ', 'g')) || [];
        assert.ok(occurrences.length >= 2,
            '--' + n + ' doit être défini pour le clair ET pour le sombre, vu '
            + occurrences.length + ' fois');
    }
});

test('l’édition claire teinte ses ombres d’encre, pas de noir', () => {
    // C'est le défaut de fond : 49 des 71 littérales étaient en noir pur sur
    // du papier. Le jeton, lui, a toujours su quelle couleur tombe sur un
    // Washi.
    const bloc = GLOBAL.slice(GLOBAL.indexOf('--e-pose:'), GLOBAL.indexOf('--shadow-1: var('));
    assert.ok(!/rgba\(0, ?0, ?0/.test(bloc),
        'aucun niveau de l’édition claire ne doit être en noir pur : ' + bloc.slice(0, 200));
    assert.match(bloc, /rgba\(28,27,25/, 'l’encre du Washi');
});

test('les anciens jetons deviennent des alias', () => {
    for (const [ancien, nouveau] of [['shadow-1', 'e-pose'], ['shadow-2', 'e-souleve'], ['shadow-3', 'e-flottant']]) {
        const m = GLOBAL.match(new RegExp('--' + ancien + ': var\\(--' + nouveau + '\\);', 'g')) || [];
        assert.ok(m.length >= 2,
            '--' + ancien + ' doit pointer sur --' + nouveau + ' dans les deux éditions');
    }
});

test('les niveaux montent, du filet à la feuille', () => {
    // Un escalier doit monter : si deux niveaux portent le même flou, l'un
    // des deux ne sert à rien.
    const flou = (n) => {
        const m = new RegExp('--' + n + ':\\s*0 \\d+px (\\d+)px').exec(GLOBAL);
        assert.ok(m, '--' + n + ' doit rester lisible');
        return Number(m[1]);
    };
    const valeurs = NIVEAUX.map(flou);
    for (let i = 1; i < valeurs.length; i++) {
        assert.ok(valeurs[i] > valeurs[i - 1],
            NIVEAUX[i] + ' (' + valeurs[i] + 'px) doit dépasser ' + NIVEAUX[i - 1] + ' (' + valeurs[i - 1] + 'px)');
    }
});

test('aucune ombre portée noire ne subsiste dans les feuilles', () => {
    const coupables = [];
    for (const f of fs.readdirSync(CSS_DIR).filter((x) => x.endsWith('.css'))) {
        for (const d of lire(path.join(CSS_DIR, f)).match(/box-shadow:[^;}]+/g) || []) {
            // On ne vise QUE l'ombre portée simple, descendante : un anneau
            // (`0 0 0 Npx`), un halo d'accent, un `inset` et l'ombre d'une
            // barre basse (offset négatif) ne sont pas des élévations.
            if (/box-shadow:\s*0 [1-9]\d*px \d+px rgba\(0, ?0, ?0/.test(d)) coupables.push(f + ' : ' + d);
        }
    }
    assert.deepEqual(coupables, [], coupables.join('\n'));
});

test('ce qui n’est pas une élévation reste intact', () => {
    const tout = fs.readdirSync(CSS_DIR).filter((f) => f.endsWith('.css'))
        .map((f) => lire(path.join(CSS_DIR, f))).join('\n');
    assert.match(tout, /box-shadow:\s*0 -10px 50px/,
        'l’ombre montante d’une barre basse ne se ramène pas à un niveau : elle serait retournée');
    assert.match(tout, /box-shadow:[^;}]*inset/,
        'les reflets intérieurs du verre doivent survivre');
    assert.match(tout, /box-shadow:\s*0 0 0 \d+px/,
        'les anneaux de focus et de sélection ne sont pas des ombres portées');
});
