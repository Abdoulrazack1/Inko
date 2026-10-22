// ============================================================
// test/unit/longueur-restante.test.js — « ce que je peux finir ce week-end »
// ------------------------------------------------------------
// Vérifié dans la vraie bibliothèque (Chromium, serveur et MySQL réels, trois
// séries à 3, 20 et 100 chapitres non lus ; rythme mesuré sur la base de
// test : 1 min par chapitre) :
//   « Une soirée » (≤ 1 h)  → Courte, Moyenne        — adresse ?finir=60
//   « Un week-end » (≤ 5 h) → Courte, Moyenne, Longue — adresse ?finir=300
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'bibliotheque.js'), 'utf8');
const extraire = (debut) => {
    const i = SRC.indexOf(debut);
    let j = SRC.indexOf('{', i), n = 0;
    for (; j < SRC.length; j++) { if (SRC[j] === '{') n++; else if (SRC[j] === '}' && --n === 0) break; }
    return SRC.slice(i, j + 1);
};
// eslint-disable-next-line no-new-func
const { minutesPourFinir, tientDans } = new Function(
    extraire('function minutesPourFinir(') + extraire('function tientDans(') + 'return { minutesPourFinir, tientDans };')();

test('le temps restant suit le rythme, pas une constante', () => {
    assert.equal(minutesPourFinir(10, 6), 60);
    assert.equal(minutesPourFinir(10, 3), 30, 'un lecteur rapide finit plus vite');
    assert.equal(minutesPourFinir(0, 6), null, 'rien à lire : rien à finir');
});

test('une soirée, un week-end : la série tient-elle dans le budget ?', () => {
    assert.equal(tientDans(8, 6, 60), true);       // 48 min
    assert.equal(tientDans(12, 6, 60), false);     // 72 min
    assert.equal(tientDans(40, 6, 300), true);     // 4 h
    assert.equal(tientDans(0, 6, 300), false, 'une série à jour n\'est pas « à finir »');
});

test('le budget se mémorise, se partage par l\'adresse, s\'affiche et se relâche comme les autres filtres', () => {
    assert.match(SRC, /if \(budget\) q\.set\('finir', String\(budget\)\);/);
    assert.match(SRC, /BUDGETS\.some\(b => String\(b\.min\) === q\.get\('finir'\)\)/);
    assert.match(SRC, /budget, tri,/);
    assert.match(SRC, /if \(budget\) out\.push\(\{ l: `À finir : /);
    assert.match(SRC, /list = list\.filter\(f => tientDans\(unreadCount\(f\), minutesParChapitre, budget\)\)/);
});

test('le rythme mesuré n\'est retenu qu\'avec assez de chapitres lus', () => {
    const f = extraire('async function mesurerRythme(');
    assert.match(f, /if \(!t\?\.mesure \|\| lus < 10\) return;/);
    assert.match(f, /Math\.min\(60, Math\.max\(1, Math\.round\(t\.totalSecondes \/ 60 \/ lus\)\)\)/);
});
