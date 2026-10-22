// ============================================================
// test/unit/prechauffe.test.js — les prochains chapitres, sur secteur et Wi-Fi
// ------------------------------------------------------------
// Vérifié sur la vraie page (Chromium, batterie et réseau simulés, deux
// séries en cours : A au chapitre 10, B au 3) :
//   secteur + Wi-Fi     → file : Série A a11, a12 · Série B b4, b5
//   sur batterie        → file vide
//   secteur + mobile    → file vide
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const window = {};
// eslint-disable-next-line no-new-func
new Function('window', 'document', 'navigator', 'localStorage',
    fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'prechauffe.js'), 'utf8'))(window, undefined, {}, {});
const { conditionsReunies, chapitresAPrechauffer } = window.MH.prechauffe;
const versJs = (x) => JSON.parse(JSON.stringify(x));

test('sur secteur, hors réseau mobile, sans économie de données — et rien d\'autre', () => {
    assert.equal(conditionsReunies({ secteur: true, reseau: 'wifi' }), true);
    assert.equal(conditionsReunies({ secteur: true, reseau: 'ethernet' }), true);
    assert.equal(conditionsReunies({ secteur: true, reseau: 'inconnu' }), true, 'un ordinateur de bureau ne dit pas son réseau');
    assert.equal(conditionsReunies({ secteur: false, reseau: 'wifi' }), false);
    assert.equal(conditionsReunies({ secteur: null, reseau: 'wifi' }), false, 'batterie inconnue = non');
    assert.equal(conditionsReunies({ secteur: true, reseau: 'cellular' }), false);
    assert.equal(conditionsReunies({ secteur: true, reseau: 'wifi', economie: true }), false);
});

test('les deux chapitres qui suivent la position, dans l\'ordre, sans ce qui est déjà là', () => {
    const chaps = ['12', '9', '11', '10', '13', 'extra'].map(n => ({ id: `c${n}`, chapter: n }));
    assert.deepStrictEqual(versJs(chapitresAPrechauffer(chaps, 10, new Set())).map(c => c.id), ['c11', 'c12']);
    assert.deepStrictEqual(versJs(chapitresAPrechauffer(chaps, 10, new Set(['c11']))).map(c => c.id), ['c12', 'c13']);
    assert.deepStrictEqual(versJs(chapitresAPrechauffer(chaps, 13, new Set())), [], 'à jour : rien à préparer');
});

test('au plus une fois toutes les six heures, et désactivé par défaut', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'prechauffe.js'), 'utf8');
    assert.match(src, /const INTERVALLE = 6 \* 3600 \* 1000;/);
    assert.match(src, /getPref\?\.\('prechauffe'\) === '1'/);
});
