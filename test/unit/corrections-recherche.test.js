// ============================================================
// test/unit/corrections-recherche.test.js — « Voulais-tu dire … ? »
// ------------------------------------------------------------
// Une recherche sans résultat ne disait que « essaie un autre titre ou
// vérifie tes sources ». Or la faute de frappe est le cas le plus courant, et
// on a de quoi la rattraper SANS réseau : la bibliothèque est en cache local,
// 496 séries sur ce compte.
//
// La correction ne vient donc QUE de ce qu'on possède déjà. Proposer un titre
// qu'on n'a pas serait deviner à la place de la source, et une suggestion
// fausse coûte plus cher qu'une absence de suggestion.
//
// Damerau et non Levenshtein simple : la faute la plus courante au clavier est
// l'inversion de deux lettres, et Levenshtein la compte pour deux.
//
//     « blu lok »   vs « blue lock »   2   (deux omissions)
//     « bleu lock » vs « blue lock »   1   (une transposition)
//
// Vérifié dans le navigateur, sur la vraie bibliothèque :
//
//     recherche « blu lok »   0 résultat sur quatre sources
//                             « Voulais-tu dire Blue Lock ? »
//     clic                    champ rempli, 14 résultats, Blue Lock en tête
//
// Un défaut trouvé à ce moment-là, et invisible autrement : cinq favoris de
// cette bibliothèque ont un titre vide. Le balayage sortait sur le premier
// d'entre eux (`return` au lieu de `continue`), donc la correction ne
// s'affichait JAMAIS — sans erreur nulle part.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const JS = path.join(__dirname, '..', '..', 'assets', 'js');
const lire = (f) => fs.readFileSync(path.join(JS, f), 'utf8').replace(/\r\n/g, '\n');
const GLOBAL = lire('global.js');
const RECHERCHE = lire('recherche.js');

/** Extrait `MH.distanceMots` et l'exécute. */
function distance() {
    const m = /window\.MH\.distanceMots = function \(a, b, max\) \{\n([\s\S]*?)\n    \};/.exec(GLOBAL);
    assert.ok(m, 'distanceMots doit rester repérable');
    const fn = new Function('a', 'b', 'max', m[1]);
    return (a, b, max) => fn(a, b, max);
}

/** Extrait `corrigerRequete` et l'exécute sur une bibliothèque donnée. */
function correcteur(favs) {
    const m = /function corrigerRequete\(q\) \{\n([\s\S]*?)\n    \}/.exec(RECHERCHE);
    assert.ok(m, 'corrigerRequete doit rester repérable');
    const normMots = (t) => (t || '').toLowerCase().normalize('NFD')
        .replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const SEUIL_FAUTE = (n) => (n <= 3 ? 0 : n <= 6 ? 1 : 2);
    const MH = { distanceMots: distance() };
    const fn = new Function('q', 'normMots', 'SEUIL_FAUTE', 'titresConnus', 'MH', 'window', m[1]);
    return (q) => fn(q, normMots, SEUIL_FAUTE, () => favs, MH, { MH });
}

// ── La distance ──
test('une lettre oubliée coûte un, deux lettres inversées aussi', () => {
    const d = distance();
    assert.equal(d('blue lock', 'blue lock', 2), 0);
    assert.equal(d('blu lok', 'blue lock', 2), 2, 'deux omissions');
    assert.equal(d('bleu lock', 'blue lock', 2), 1,
        'une transposition : c’est tout l’intérêt de Damerau sur Levenshtein');
});

test('la distance est bornée, et le dit', () => {
    const d = distance();
    // Au-delà du plafond on rend plafond + 1 : la valeur exacte ne servirait
    // à rien et se paierait sur 496 titres à chaque frappe.
    assert.equal(d('naruto', 'blue lock', 2), 3);
    assert.equal(d('abc', 'abcdefghij', 2), 3, 'écart de longueur : sortie immédiate');
});

test('les cas vides ne lèvent pas', () => {
    const d = distance();
    assert.equal(d('', 'abc', 5), 3);
    assert.equal(d('abc', '', 5), 3);
    assert.equal(d(null, undefined, 5), 0);
});

// ── La correction ──
const BIBLIO = [
    { title: 'Blue Lock' }, { title: 'Blue Giant' }, { title: 'Naruto' },
    { title: '' }, { title: null },          // les cinq titres vides du compte réel
];

test('une faute de frappe retrouve le titre connu', () => {
    assert.equal(correcteur(BIBLIO)('blu lok'), 'Blue Lock');
    assert.equal(correcteur(BIBLIO)('narutoo'), 'Naruto');
});

test('un titre vide n’interrompt plus le balayage', () => {
    // Le défaut exact : `return null` au lieu de `continue`. Avec les titres
    // vides AVANT la bonne réponse, la correction ne sortait jamais.
    const ordreHostile = [{ title: '' }, { title: null }, { title: 'Blue Lock' }];
    assert.equal(correcteur(ordreHostile)('blu lok'), 'Blue Lock');
});

test('une requête déjà exacte ne se fait pas corriger', () => {
    assert.equal(correcteur(BIBLIO)('blue lock'), null);
    assert.equal(correcteur(BIBLIO)('Blue Lock'), null, 'la casse ne doit rien changer');
});

test('une requête trop courte ou trop loin ne propose rien', () => {
    assert.equal(correcteur(BIBLIO)('blu'), null, 'trois lettres : tout est à distance 2');
    assert.equal(correcteur(BIBLIO)('xylophone'), null, 'rien d’assez proche');
});

test('rien n’est proposé quand la bibliothèque est vide', () => {
    assert.equal(correcteur([])('blu lok'), null);
});

// ── Le branchement ──
test('la correction attend la fin de la recherche', () => {
    // La proposer pendant qu'une source répond encore ferait renoncer pour
    // rien : la source lente a peut-être la réponse.
    assert.match(RECHERCHE, /const correction = opts\.enCours \? null : corrigerRequete\(q\);/);
});

test('le titre proposé est un bouton qui relance la recherche', () => {
    assert.match(RECHERCHE, /class="se-corr-btn" data-corr="\$\{MH\.esc\(correction\)\}"/,
        'le titre doit être échappé : il vient de la bibliothèque');
    const m = /out\.querySelector\('\.se-corr-btn'\)\?\.addEventListener\('click', \(e\) => \{([\s\S]*?)\}\);/
        .exec(RECHERCHE);
    assert.ok(m, 'le bouton doit être câblé');
    assert.match(m[1], /champ\.value = t;/, 'le champ doit refléter ce qu’on cherche désormais');
    assert.match(m[1], /run\(t\);/);
});
