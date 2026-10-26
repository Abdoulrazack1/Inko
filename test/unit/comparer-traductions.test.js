// ============================================================
// test/unit/comparer-traductions.test.js — deux sources côte à côte
// ------------------------------------------------------------
// Vérifié dans Chromium (sources simulées) : « Blue Lock », chapitre 12 chez
// la source A (10 pages) ; la source B le titre « BLUE LOCK » (même œuvre,
// proposée), la source C « Blue Lock: Episode Nagi » (autre œuvre, écartée),
// la source de romans n'est pas proposée. Chapitre « 12.0 » chez B retrouvé,
// 13 pages. À 40 % de la colonne A, la colonne B est à 40 %.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const lire = (f) => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
const window = {};
// eslint-disable-next-line no-new-func
new Function('window', 'document', lire('assets/js/comparer.js'))(window, undefined);
const { norm, chapitreEquivalent, positionCorrespondante } = window.MH.comparer;

test('la même œuvre est reconnue malgré la casse, les accents et la ponctuation', () => {
    assert.equal(norm('BLUE LOCK'), norm('Blue Lock'));
    assert.equal(norm('Kimetsu no Yaiba'), norm('kimetsu-no-yaiba'));
    assert.equal(norm('Pokémon'), norm('Pokemon'));
    assert.notEqual(norm('Blue Lock: Episode Nagi'), norm('Blue Lock'), 'un spin-off n\'est pas la même série');
});

test('le chapitre se retrouve par son NUMÉRO, pas par son identifiant', () => {
    const chez = [{ id: 'x1', chapter: '11' }, { id: 'x2', chapter: '12.0' }, { id: 'x3', chapter: '12.5' }];
    assert.equal(chapitreEquivalent(chez, '12').id, 'x2');
    assert.equal(chapitreEquivalent(chez, '12.5').id, 'x3');
    assert.equal(chapitreEquivalent(chez, '13'), null);
    assert.equal(chapitreEquivalent(chez, '?'), null, 'numéro inconnu : rien plutôt qu\'un faux chapitre');
});

test('le défilement suit la PROPORTION du chapitre, d\'une colonne à l\'autre', () => {
    // A : 10 000 px pour 800 de vue ; B : 14 300 px.
    assert.equal(positionCorrespondante(0, 10000, 800, 14300, 800), 0);
    assert.equal(positionCorrespondante(9200, 10000, 800, 14300, 800), 13500, 'fin → fin');
    assert.equal(positionCorrespondante(3680, 10000, 800, 14300, 800), 5400, '40 % → 40 %');
    assert.equal(positionCorrespondante(100, 500, 800, 14300, 800), 0, 'colonne sans défilement');
});

test('la page est branchée : sources d\'images seulement, retour au lecteur, entrée dans le lecteur', () => {
    const js = lire('assets/js/comparer.js');
    assert.match(js, /!MH\.isNovelSource\?\.\(s\.id\)/);
    assert.match(js, /API\.mangas\.pagesFor\(/);
    assert.match(lire('assets/js/api.js'), /pagesFor: \(source, chapterId\) =>/);
    assert.match(lire('assets/js/chapitre.js'), /href="comparer\.html\?manga=\$\{encodeURIComponent\(manga\.id\)\}&chapter=/);
    assert.match(lire('comparer.html'), /<script src="assets\/js\/comparer\.js"><\/script>/);
});
