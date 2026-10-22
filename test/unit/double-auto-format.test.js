// ============================================================
// test/unit/double-auto-format.test.js — double page selon le format réel
// ------------------------------------------------------------
// Vérifié dans le vrai lecteur (Chromium, planches 700 × 1000, réglage
// « double page automatique » coché) :
//   1100 × 1000 → simple (avant : double, 627 + 627 px dans 1100, ça débordait —
//                  et en réalité « simple » aussi, le réglage n'étant jamais relu)
//   1600 × 800  → double, 487 + 487 px
//   800 × 1100  → simple
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
const { formatPlanches, doubleTient } = new Function(
    'const RATIO_DEFAUT = 1.45; const DOUBLE_HAUTEUR_MIN = 0.98;' +
    extraire('function formatPlanches(') + extraire('function doubleTient(') +
    'return { formatPlanches, doubleTient };')();

const MANGA = [1000 / 700, 1000 / 700, 1000 / 700];   // hauteur / largeur, comme pageRatios

test('fenêtre en paysage où deux planches débordent : on reste en simple', () => {
    assert.equal(doubleTient(1100, 909, MANGA), false);
});

test('écran large : deux planches tiennent à pleine hauteur → double', () => {
    assert.equal(doubleTient(1600, 709, MANGA), true);
});

test('portrait : simple', () => {
    assert.equal(doubleTient(800, 1009, MANGA), false);
});

test('le format compte, pas l\'orientation : planches étroites en fenêtre presque carrée → double', () => {
    assert.equal(doubleTient(1100, 1000, [2, 2, 2]), true);
});

test('les planches doubles (panoramiques) ne faussent pas le format typique', () => {
    assert.ok(Math.abs(formatPlanches([1000 / 700, 1000 / 700, 1000 / 1400]) - 0.7) < 1e-9);
});

test('avant toute mesure : format typique supposé, pas l\'orientation (sinon ça clignote)', () => {
    assert.equal(formatPlanches([]), null);
    assert.equal(doubleTient(1100, 909, []), false);
    assert.equal(doubleTient(1600, 709, []), true);
});

test('la première planche mesurée relance la décision', () => {
    assert.match(SRC, /const premiere = !ratiosConnus\(\);[\s\S]{0,120}if \(premiere\) rotation\(\);/);
});

test('les réglages orientation, découpe et double auto sont relus à l\'ouverture', () => {
    const prefs = { reader_autoDouble: '1', reader_decouper: '1', reader_orientation: 'portrait' };
    const rs = { bg: 'dark', brightness: 100, gap: 8, autospeed: 1.4, warm: 0, orientation: 'libre', decouper: '0', autoDouble: '0' };
    // eslint-disable-next-line no-new-func
    new Function('rs', 'window', extraire('function loadReaderSettings(') + 'loadReaderSettings();')(
        rs, { Storage: { getPref: k => prefs[k] } });
    assert.deepStrictEqual([rs.autoDouble, rs.decouper, rs.orientation], ['1', '1', 'portrait']);
});
