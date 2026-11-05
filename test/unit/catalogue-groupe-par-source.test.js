// ============================================================
// test/unit/catalogue-groupe-par-source.test.js — en mode « Toutes les
// sources », on voyait un seul tas
// ------------------------------------------------------------
// Les résultats agrégés portaient déjà leur origine — mais en petit, sur
// chaque carte, au bout de la ligne de méta. Avec neuf sources actives,
// savoir d'où vient une œuvre demandait de lire vingt-quatre fois la
// même micro-étiquette.
//
// Ils étaient pourtant DÉJÀ groupés : `runSearchAggregate` fusionne
// source par source dans une `Map`, qui garde l'ordre d'insertion. Il ne
// manquait que la frontière.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const JS = fs.readFileSync(path.join(RACINE, 'assets', 'js', 'catalogue.js'), 'utf8')
    .replace(/\r\n/g, '\n');
const CSS = fs.readFileSync(path.join(RACINE, 'assets', 'css', 'catalogue.css'), 'utf8')
    .replace(/\r\n/g, '\n');

// On charge la vraie fonction, comme le fait la page.
const corps = (() => {
    const i = JS.indexOf('function grouperParSource(liste) {');
    assert.notEqual(i, -1, 'grouperParSource doit rester repérable');
    return JS.slice(i, JS.indexOf('\n    }', i) + 6);
})();
const MH = { esc: (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;') };
const mangaCardHTML = (m) => `<article data-id="${m.id}"></article>`;
// eslint-disable-next-line no-new-func
const grouper = new Function('MH', 'mangaCardHTML', `${corps}; return grouperParSource;`)(MH, mangaCardHTML);

test('un titre par source, avec son compte', () => {
    const html = grouper([
        { id: 1, _source: 'weebcentral', _sourceName: 'Weeb Central' },
        { id: 2, _source: 'weebcentral', _sourceName: 'Weeb Central' },
        { id: 3, _source: 'mangadex', _sourceName: 'MangaDex' },
    ]);
    const titres = [...html.matchAll(/<h2 class="cat-src-groupe">([^<]*)<span class="cat-src-compte">(\d+)<\/span>/g)]
        .map((m) => [m[1], m[2]]);
    assert.deepEqual(titres, [['Weeb Central', '2'], ['MangaDex', '1']]);
    assert.equal((html.match(/<article/g) || []).length, 3, 'toutes les cartes sont là');
});

test('l’ordre des sources est celui de la fusion', () => {
    // `runSearchAggregate` insère source par source dans une Map ; on ne
    // retrie pas derrière, sinon l'ordre de préférence des sources —
    // réglable dans la page Sources — ne voudrait plus rien dire.
    const html = grouper([
        { id: 1, _source: 'b', _sourceName: 'Bêta' },
        { id: 2, _source: 'a', _sourceName: 'Alpha' },
    ]);
    assert.ok(html.indexOf('Bêta') < html.indexOf('Alpha'), 'Bêta d’abord, comme reçu');
});

test('une seule source ne reçoit pas de titre', () => {
    // Il n'apprendrait rien, et sur une page de résultats il deviendrait
    // une ligne qu'on saute.
    const html = grouper([{ id: 1, _source: 'mangadex', _sourceName: 'MangaDex' }]);
    assert.ok(!html.includes('cat-src-groupe'));
    assert.equal((html.match(/<article/g) || []).length, 1);
});

test('une source sans nom ne casse pas le groupe', () => {
    const html = grouper([{ id: 1 }, { id: 2, _source: 'x', _sourceName: 'X' }]);
    assert.ok(html.includes('cat-src-groupe'), 'deux groupes, donc des titres');
    assert.equal((html.match(/<article/g) || []).length, 2);
});

test('le titre tient la largeur de la grille, sans sous-grille', () => {
    // `grid-column: 1 / -1` garde UNE seule grille : mêmes colonnes,
    // mêmes gouttières que partout, et la densité d'affichage continue
    // de les piloter. Une sous-grille par source les figerait.
    const r = /\.cat-src-groupe \{([\s\S]*?)\}/.exec(CSS);
    assert.ok(r, '.cat-src-groupe');
    assert.match(r[1], /grid-column: 1 \/ -1/);
    assert.ok(!/\.cat-src-groupe[^{]*\{[^}]*display: grid/.test(CSS),
        'le titre n’ouvre pas une grille à lui');
    // Et il est annoncé comme un titre : la page a son h1, les sources
    // sont ses sections.
    assert.match(JS, /<h2 class="cat-src-groupe">/);
});

test('le rendu agrégé passe bien par le groupement', () => {
    assert.match(JS, /grid\.innerHTML = grouperParSource\(lastResults\);/);
});
