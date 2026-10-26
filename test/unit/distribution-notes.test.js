// ============================================================
// test/unit/distribution-notes.test.js — notes sur 10 et leur répartition
// ------------------------------------------------------------
// Vérifié sur le vrai profil (Chromium, serveur et MySQL réels, six notes :
// 8, 8, 10, 6, 7, 3) :
//   main   : « Chargement impossible — Invalid count value: -3 » (RangeError
//            de '☆'.repeat(5 - 8), les notes étant sur 10 depuis AMEL-47) ;
//   branche: dix barres (0 0 1 0 0 1 1 2 0 1), « 6 notes · moyenne 7 ·
//            médiane 7,5 · la plus donnée : 8/10 », avis en « ★★★★☆ 8/10 ».
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'profil.js'), 'utf8');
const extraire = (debut) => {
    const i = SRC.indexOf(debut);
    let j = SRC.indexOf('{', i), n = 0;
    for (; j < SRC.length; j++) { if (SRC[j] === '{') n++; else if (SRC[j] === '}' && --n === 0) break; }
    return SRC.slice(i, j + 1);
};
// eslint-disable-next-line no-new-func
const { distributionNotes, etoilesSurDix } = new Function('MH',
    extraire('function etoilesSurDix(') + extraire('function distributionNotes(') + 'return { distributionNotes, etoilesSurDix };')(
    { stars: (x) => `[${x}★]` });

test('répartition sur dix niveaux, moyenne, médiane, note la plus donnée', () => {
    const d = distributionNotes([8, 8, 10, 6, 7, 3].map(rating => ({ rating })));
    assert.deepStrictEqual(d.comptes, [0, 0, 1, 0, 0, 1, 1, 2, 0, 1]);
    assert.deepStrictEqual([d.total, d.moyenne, d.mediane, d.mode], [6, 7, 7.5, 8]);
});

test('les valeurs hors échelle sont ignorées, une liste vide ne casse rien', () => {
    assert.equal(distributionNotes([{ rating: 0 }, { rating: 11 }, { rating: 'x' }]).total, 0);
    assert.deepStrictEqual(distributionNotes([]).moyenne, null);
});

test('une note sur 10 s\'affiche en cinq étoiles avec demis, jamais en RangeError', () => {
    assert.equal(etoilesSurDix(8), '[4★] <span class="note-sur-dix">8/10</span>');
    assert.equal(etoilesSurDix(7), '[3.5★] <span class="note-sur-dix">7/10</span>');
    assert.doesNotThrow(() => etoilesSurDix(10));
    assert.ok(!/'☆'\.repeat\(5 - r\.rating\)/.test(SRC), 'plus de calcul sur 5');
});
