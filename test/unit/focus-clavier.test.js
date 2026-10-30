// ============================================================
// test/unit/focus-clavier.test.js — l'anneau existait déjà
// ------------------------------------------------------------
// Le chantier demandait « un focus clavier dessiné, pas l'anneau par
// défaut du navigateur ». Mesuré avant d'écrire quoi que ce soit :
// c'était DÉJÀ FAIT. Une règle `:focus-visible` globale pose un contour
// de 2 px plus un anneau, et trente éléments parcourus à la tabulation
// sur la bibliothèque rendent trente anneaux — zéro élément muet.
//
// (Le `.focus()` appelé depuis un script ne déclenche PAS `:focus-visible`
// dans Chrome : une première mesure, faite ainsi, concluait à tort que
// treize familles d'éléments n'avaient aucun indicateur. La mesure qui
// compte est faite à la vraie touche Tab.)
//
// Restaient deux défauts réels, et ils sont corrigés ici.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const CSS = fs.readdirSync(path.join(RACINE, 'assets', 'css'))
    .filter(f => f.endsWith('.css'))
    .map(f => [f, fs.readFileSync(path.join(RACINE, 'assets', 'css', f), 'utf8')
        .replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '')]);

test('l’anneau du système est posé une fois, et il l’est', () => {
    const global = CSS.find(([f]) => f === 'global.css')[1];
    const m = /\n:focus-visible \{([^}]*)\}/.exec(global);
    assert.ok(m, 'la règle globale existe');
    assert.match(m[1], /outline: 2px solid var\(--accent\)/);
    assert.match(m[1], /outline-offset: 2px/);
    assert.match(m[1], /box-shadow: var\(--ring\)/);
});

test('aucune règle ne retire l’anneau sans le remplacer', () => {
    // Trois menus — bibliothèque, lecteur, fiche série — posaient
    // `outline: none` SUR `:focus-visible`, et leur seul signal restant
    // était le fond du SURVOL : au clavier, l’entrée visée devenait
    // indiscernable de celle que la souris effleure.
    //
    // Retirer le contour n’est pas interdit en soi — les champs de saisie
    // le font, et le remplacent par un filet d’accent plus l’anneau. Ce
    // qui est interdit, c’est de le retirer sans rien mettre à la place.
    const fautes = [];
    for (const [f, src] of CSS) {
        for (const m of src.matchAll(/([^\n{}]*:focus-visible[^\n{}]*)\{([^}]*)\}/g)) {
            if (!/outline:\s*none/.test(m[2])) continue;
            const compense = /box-shadow:\s*(?!none)/.test(m[2])
                || /border-color:/.test(m[2])
                || /outline:\s*\d/.test(m[2]);
            if (!compense) fautes.push(`${f} — ${m[1].trim()}`);
        }
    }
    assert.deepEqual(fautes, [], `anneau retiré sans rien à la place :\n  ${fautes.join('\n  ')}`);
});

// Un troisième essai avait interdit de GROUPER `:hover` et
// `:focus-visible`. Le test était faux : un bouton caché doit apparaître
// dans les deux cas, et sept règles correctes tombaient avec. Ce qui
// distingue les deux états est l’anneau, pas le fond — c’est donc
// l’anneau qu’on vérifie, ci-dessus.

test('une seule écriture de la couleur de l’anneau', () => {
    // Elle était posée de trois façons : var(--orange), var(--accent) et
    // var(--orange,#ff6b1a) — trois noms pour la même valeur.
    const fautes = [];
    for (const [f, src] of CSS) {
        for (const m of src.matchAll(/outline:\s*\d+px solid ([^;}]+)/g)) {
            const couleur = m[1].trim();
            // `--orange` reste légitime hors anneau de focus (sélection d'une
            // carte, par exemple) : on ne juge que les règles de focus.
            const avant = src.slice(Math.max(0, m.index - 200), m.index);
            if (!/:focus/.test(avant.split('{').pop() + avant.split('\n').pop())) continue;
            if (couleur !== 'var(--accent)') fautes.push(`${f} — outline: … ${couleur}`);
        }
    }
    assert.deepEqual(fautes, [], `écritures concurrentes :\n  ${fautes.join('\n  ')}`);
});
