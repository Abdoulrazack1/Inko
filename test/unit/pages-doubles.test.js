// ============================================================
// test/unit/pages-doubles.test.js — une panoramique reste seule en mode double
// ------------------------------------------------------------
// Vérifié dans le vrai lecteur (Chromium, 1600 × 900, 6 pages dont la 3
// panoramique 1400 × 1000) :
//   avant : 1-2 · 3-4 (1114 + 557 = 1671 px dans 1600, ça déborde) · 5-6
//   après : 1-2 · 3 seule · 4-5 · 6, et le retour repasse exactement par les
//           mêmes planches.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'chapitre.js'), 'utf8');
const extraire = (debut) => {
    const i = SRC.indexOf(debut);
    let j = SRC.indexOf('{', i), n = 0;
    for (; j < SRC.length; j++) { if (SRC[j] === '{') n++; else if (SRC[j] === '}' && --n === 0) break; }
    return SRC.slice(i, j + 1);
};
// eslint-disable-next-line no-new-func
const { uniteDouble, uniteAvant } = new Function(
    extraire('function uniteDouble(') + extraire('function uniteAvant(') + 'return { uniteDouble, uniteAvant };')();

/** Les planches vues en avançant puis en reculant, comme le fait navStep. */
function parcours(total, larges) {
    const large = (n) => larges.includes(n);
    const avant = [];
    for (let b = 1; b <= total;) { const n = uniteDouble(b, total, large); avant.push(n === 2 ? `${b}-${b + 1}` : `${b}`); b += n; }
    const retour = [];
    let [b, n] = [total, 1];
    const der = avant.at(-1); if (der.includes('-')) { b = +der.split('-')[0]; n = 2; }
    retour.push(n === 2 ? `${b}-${b + 1}` : `${b}`);
    for (let u = uniteAvant(b, large); u; u = uniteAvant(u.base, large)) retour.push(u.n === 2 ? `${u.base}-${u.base + 1}` : `${u.base}`);
    return { avant, retour };
}

test('la panoramique s\'affiche seule, la suite se réapparie derrière', () => {
    assert.deepStrictEqual(parcours(6, [3]).avant, ['1-2', '3', '4-5', '6']);
});

test('la page juste avant une panoramique reste seule elle aussi', () => {
    assert.deepStrictEqual(parcours(6, [4]).avant, ['1-2', '3', '4', '5-6']);
});

test('le retour ne réaffiche jamais une page et repasse par les panoramiques seules', () => {
    for (const larges of [[], [3], [4], [1], [6], [2, 5]]) {
        const { retour } = parcours(7, larges);
        const vues = retour.flatMap(u => u.split('-').map(Number));
        assert.equal(new Set(vues).size, vues.length, `doublon pour ${larges} : ${retour}`);
        for (const l of larges) assert.ok(retour.includes(String(l)), `${l} doit être seule : ${retour}`);
        assert.ok(vues.includes(1), `le retour atteint la page 1 : ${retour}`);
    }
});

test('sans panoramique : rien ne change, deux par deux', () => {
    assert.deepStrictEqual(parcours(6, []).avant, ['1-2', '3-4', '5-6']);
});

test('le format est connu d\'avance (préchargement) et revérifié au chargement', () => {
    assert.match(extraire('function preloadPage('), /pageRatios\.set\(num - 1, im\.naturalHeight \/ im\.naturalWidth\)/);
    assert.match(extraire('function renderDouble('), /uniteDouble\(num, totalPages, pageLarge\) !== doubleCount\) renderDouble\(num\)/);
    assert.match(SRC, /const target = dir > 0 \? doubleBase \+ doubleCount : \(avant \? avant\.base : 0\);/);
});
