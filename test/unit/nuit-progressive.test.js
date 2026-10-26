// ============================================================
// test/unit/nuit-progressive.test.js — assombrir et réchauffer selon l'heure
// ------------------------------------------------------------
// Vérifié dans le vrai lecteur (Chromium, horloge simulée, lumière chaude
// manuelle à 10 %) :
//   14 h 00 → voile 0,    chaleur 0,06 (le réglage manuel, intact)
//   21 h 30 → voile 0,072, chaleur 0,15 (chaleur 25 %, luminosité −10 %)
//   0 h 30  → voile 0,144, chaleur 0,30 (le plein : 50 %, −20 %)
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
const nuitProgressive = new Function('const NUIT_CHALEUR_MAX = 50, NUIT_ASSOMBRI_MAX = 20;'
    + extraire('function nuitProgressive(') + 'return nuitProgressive;')();
const a = (hh, mm = 0) => nuitProgressive(new Date(2026, 9, 20, hh, mm));

test('de jour : rien', () => {
    for (const h of [7, 10, 14, 19]) assert.deepStrictEqual(a(h), { chaleur: 0, assombri: 0 }, `${h} h`);
    assert.deepStrictEqual(a(19, 59), { chaleur: 0, assombri: 0 });
});

test('le soir : une montée douce de 20 h à 23 h', () => {
    assert.deepStrictEqual(a(21, 30), { chaleur: 25, assombri: 10 });
    const suite = [20, 21, 22, 23].map(h => a(h).chaleur);
    assert.deepStrictEqual(suite, [...suite].sort((x, y) => x - y), 'jamais de recul');
    // Réévaluée chaque minute : d'une minute à l'autre, l'écart est imperceptible.
    for (let m = 0; m < 180; m++) {
        const t = new Date(2026, 9, 20, 20, m), u = new Date(2026, 9, 20, 20, m + 1);
        assert.ok(nuitProgressive(u).chaleur - nuitProgressive(t).chaleur <= 1);
    }
});

test('la nuit : le plein ; le matin : la redescente jusqu\'à 7 h', () => {
    for (const h of [23, 0, 2, 4]) assert.deepStrictEqual(a(h), { chaleur: 50, assombri: 20 }, `${h} h`);
    assert.deepStrictEqual(a(6), { chaleur: 25, assombri: 10 });
    assert.deepStrictEqual(a(7), { chaleur: 0, assombri: 0 });
});

test('la nuit progressive renforce les curseurs, elle ne les remplace pas', () => {
    const f = extraire('function applyReaderSettings(');
    assert.match(f, /Math\.min\(rs\.brightness, 100 - nuit\.assombri\)/);
    assert.match(f, /Math\.max\(\+rs\.warm \|\| 0, nuit\.chaleur\)/);
    assert.match(SRC, /setInterval\(\(\) => \{ if \(rs\.nuitAuto === '1'\) applyReaderSettings\(\); \}, 60 \* 1000\)/);
    assert.match(SRC, /rs\.nuitAuto = window\.Storage\?\.getPref\('reader_nuitAuto'\) === '1'/);
});
