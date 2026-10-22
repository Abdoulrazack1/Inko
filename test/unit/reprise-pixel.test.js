// ============================================================
// test/unit/reprise-pixel.test.js — reprise au pixel près en défilement
// ------------------------------------------------------------
// Vérifié dans le vrai lecteur (Chromium, 10 planches de 800 × 3000) : on
// quitte à 55 % de la planche 4, on rouvre → 55,0 %. Avant : 0 %, le haut de
// la planche, soit plus d'un écran en arrière.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'chapitre.js'), 'utf8');
const bloc = SRC.slice(SRC.indexOf('const CLE_POS_FINE'), SRC.indexOf('let posFineTimer'));

function monter({ planches, incognito = false, mode = 'scroll', stock = {} }) {
    const store = new Map(Object.entries(stock));
    const localStorage = { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => store.set(k, String(v)) };
    const document = { querySelectorAll: () => planches.map(([page, top, height]) => ({
        dataset: { page: String(page) }, getBoundingClientRect: () => ({ top, height, bottom: top + height }),
    })) };
    const window = { MH: { isIncognito: () => incognito } };
    // eslint-disable-next-line no-new-func
    const f = new Function('localStorage', 'document', 'window', 'manga', 'currentChap', 'readMode',
        bloc + '; return { lirePositionFine, noterPositionFine };');
    return { ...f(localStorage, document, window, { id: 'm1' }, { id: 'c1' }, mode), store };
}

test('on note la planche sous le haut de l\'écran et la part déjà lue', () => {
    const r = monter({ planches: [[3, -6000, 3000], [4, -1650, 3000], [5, 1350, 3000]] });
    r.noterPositionFine();
    assert.deepStrictEqual(r.lirePositionFine(), { p: 4, f: 0.55 });
});

test('lecture privée ou mode page : rien n\'est noté', () => {
    for (const opts of [{ incognito: true }, { mode: 'page' }]) {
        const r = monter({ planches: [[4, -1650, 3000]], ...opts });
        r.noterPositionFine();
        assert.equal(r.store.get('inko_pos_fine'), undefined);
    }
});

test('le stockage est borné : les positions les plus anciennes partent', () => {
    const vieux = {};
    for (let i = 0; i < 70; i++) vieux[`m${i}|c`] = { p: 1, f: 0.1 };
    const r = monter({ planches: [[2, -100, 1000]], stock: { inko_pos_fine: JSON.stringify(vieux) } });
    r.noterPositionFine();
    const cles = Object.keys(JSON.parse(r.store.get('inko_pos_fine')));
    assert.equal(cles.length, 60);
    assert.equal(cles.at(-1), 'm1|c1');
    assert.ok(!cles.includes('m0|c'));
});

test('une valeur abîmée est ignorée, pas appliquée', () => {
    const r = monter({ planches: [], stock: { inko_pos_fine: JSON.stringify({ 'm1|c1': { p: 4, f: 3 } }) } });
    assert.equal(r.lirePositionFine(), null);
    assert.equal(monter({ planches: [], stock: { inko_pos_fine: '{oups' } }).lirePositionFine(), null);
});

test('l\'ouverture vise la fraction notée, le changement de mode ne la lit pas', () => {
    assert.match(SRC, /const fine = page \? null : lirePositionFine\(\);/);
    assert.match(SRC, /const ecart = r\.top \+ frac \* r\.height;/);
});
