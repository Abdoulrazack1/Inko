// ============================================================
// test/unit/sante-sources.test.js — latence et taux d'échec dans Sources
// ------------------------------------------------------------
// Vérifié sur la vraie page (Chromium, serveur réel ; les sources sont
// bloquées depuis la machine de travail) : « Ne repond plus — Request failed
// with status code 403 · 100 % d'échecs sur 8 requêtes ». Le calcul côté
// serveur est testé dans server/test/sante-mesures.test.js.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'sources.js'), 'utf8');
const extraire = (debut) => {
    const i = SRC.indexOf(debut);
    let j = SRC.indexOf('{', i), n = 0;
    for (; j < SRC.length; j++) { if (SRC[j] === '{') n++; else if (SRC[j] === '}' && --n === 0) break; }
    return SRC.slice(i, j + 1);
};
// eslint-disable-next-line no-new-func
const { mesuresSante, formaterMs } = new Function('MH', extraire('function formaterMs(') + extraire('function mesuresSante(') + 'return { mesuresSante, formaterMs };')(
    { esc: (s) => String(s) });
const texte = (h) => mesuresSante(h).replace(/<[^>]+>/g, '');

test('vitesse et part des échecs, avec la base de calcul', () => {
    assert.equal(texte({ requetes: 40, latenceMs: 420, tauxEchec: 3 }), '420 ms · 3 % d’échecs sur 40 requêtes');
    assert.equal(texte({ requetes: 12, latenceMs: 4200, tauxEchec: 0 }), '4,2 s · 0 % d’échecs sur 12 requêtes');
});

test('une source lente ou qui perd des requêtes est signalée', () => {
    assert.match(mesuresSante({ requetes: 20, latenceMs: 3500, tauxEchec: 5 }), /<span class="src-mesure-alerte">3,5 s<\/span>/);
    assert.match(mesuresSante({ requetes: 20, latenceMs: 300, tauxEchec: 25 }), /<span class="src-mesure-alerte">25 % d’échecs<\/span>/);
});

test('moins de trois requêtes : pas de chiffre qui ne voudrait rien dire', () => {
    assert.equal(mesuresSante({ requetes: 2, latenceMs: 100, tauxEchec: 50 }), '');
    assert.equal(mesuresSante(undefined), '');
    assert.equal(formaterMs(999), '999 ms');
});
