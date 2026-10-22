// ============================================================
// test/unit/rythme-parution.test.js — hebdomadaire, mensuel, irrégulier,
// à l'arrêt
// ------------------------------------------------------------
// L'enregistrement par le scan est vérifié contre MySQL dans
// server/test/integration.db.test.js (série hebdo → « hebdo », 7 j ; série
// muette depuis 200 j → « arret »).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const lire = (f) => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
const SRC = lire('server/lib/updates.js');
const debut = SRC.indexOf('const ARRET_JOURS');
const fin = SRC.indexOf('async function scanUserUpdates(');
// eslint-disable-next-line no-new-func
const rythmeDe = new Function(SRC.slice(debut, fin) + 'return rythmeDe;')();
const MAINTENANT = Date.UTC(2026, 9, 20, 12);
const chap = (...joursAvant) => joursAvant.map(j => ({ publishedAt: new Date(MAINTENANT - j * 86400000).toISOString() }));

test('chaque semaine, chaque mois', () => {
    assert.deepStrictEqual(rythmeDe(chap(2, 9, 16, 23, 30), MAINTENANT), { rythme: 'hebdo', jours: 7 });
    assert.deepStrictEqual(rythmeDe(chap(5, 35, 65, 96, 125), MAINTENANT), { rythme: 'mensuel', jours: 30 });
    assert.equal(rythmeDe(chap(2, 9, 16, 30, 37), MAINTENANT).rythme, 'hebdo', 'une semaine sautée reste une cadence hebdomadaire');
});

test('à l\'arrêt : rien depuis quatre mois, quelle qu\'ait été la cadence', () => {
    assert.equal(rythmeDe(chap(130, 137, 144, 151), MAINTENANT).rythme, 'arret');
});

test('irrégulier : pas de cadence, ou des écarts de plusieurs mois', () => {
    assert.equal(rythmeDe(chap(1, 3, 40, 42, 100, 101), MAINTENANT).rythme, 'irregulier');
    assert.equal(rythmeDe(chap(10, 70, 75, 140), MAINTENANT)?.rythme, 'irregulier');
});

test('une sortie groupée ne fausse pas l\'écart ; trop peu de dates : on ne dit rien', () => {
    assert.deepStrictEqual(rythmeDe(chap(2, 2, 2, 9, 16, 23), MAINTENANT), { rythme: 'hebdo', jours: 7 });
    assert.equal(rythmeDe(chap(2, 9), MAINTENANT), null);
    assert.equal(rythmeDe([{ publishedAt: null }, {}], MAINTENANT), null);
});

test('la bibliothèque propose le tri et l\'ordre attendu', () => {
    assert.match(lire('bibliotheque.html'), /<option value="rythme">Rythme de parution<\/option>/);
    const js = lire('assets/js/bibliotheque.js');
    assert.match(js, /hebdo: \[0, 'Chaque semaine'\], mensuel: \[1, 'Chaque mois'\], irregulier: \[2, 'Irrégulier'\], arret: \[3, 'À l’arrêt'\]/);
    assert.match(js, /if \(sort === 'rythme'\) list\.sort\(\(a, b\) => ordreRythme\(a\) - ordreRythme\(b\)/);
});
