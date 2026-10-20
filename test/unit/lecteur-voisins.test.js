// ============================================================
// test/unit/lecteur-voisins.test.js — un seul « chapitre suivant », qui
// saute les entrées vides
// ------------------------------------------------------------
// Trois endroits du lecteur calculaient le voisin d'un chapitre : la barre
// d'outils, le bloc « À suivre » et l'enchaînement automatique triaient par
// `a.chapter - b.chapter`, les touches N/P par un tri robuste. Sur une liste
// qui contient « Extra », le premier tri rend NaN et l'ordre devient celui
// du moteur JS : la flèche et le bloc « À suivre » pouvaient désigner deux
// chapitres différents.
//
// Et une entrée sans page (la source la liste, ne fournit rien) arrêtait la
// lecture sur un écran d'erreur, sans issue vers la suite. On ne peut le
// savoir qu'en l'ouvrant : le champ `pages` des listes vaut 0 pour
// « inconnu » chez la plupart des extensions.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'assets', 'js', 'chapitre.js'), 'utf8')
    .replace(/\r\n/g, '\n');

// Extrait une fonction de premier niveau du module (indentation de 4).
const fonction = (nom) => {
    const i = SRC.indexOf(`    function ${nom}(`);
    assert.notEqual(i, -1, `${nom} doit rester repérable`);
    return SRC.slice(i, SRC.indexOf('\n    }\n', i) + 6);
};

function lecteur(chapters, courant, vides = []) {
    const store = new Map([['inko_chapitres_vides', JSON.stringify(vides)]]);
    const sessionStorage = { getItem: k => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
    const code = `
        const CLE_VIDES = 'inko_chapitres_vides';
        ${fonction('chapitresTries')}
        ${fonction('neighborChapter')}
        ${fonction('chapitresVides')}
        return { neighborChapter, chapitresTries };`;
    // eslint-disable-next-line no-new-func
    return new Function('chapters', 'currentChap', 'sessionStorage', code)(
        chapters, chapters.find(c => c.id === courant), sessionStorage);
}

const LISTE = [
    { id: 'c3', chapter: '3' }, { id: 'x', chapter: 'Extra' },
    { id: 'c1', chapter: '1' }, { id: 'c2', chapter: '2' },
];

test('les numéros non numériques passent en fin de liste, sans casser l\'ordre', () => {
    const { chapitresTries } = lecteur(LISTE, 'c1');
    assert.deepStrictEqual(chapitresTries().map(c => c.id), ['c1', 'c2', 'c3', 'x']);
});

test('voisins dans les deux sens, null aux extrémités', () => {
    assert.equal(lecteur(LISTE, 'c1').neighborChapter(1).id, 'c2');
    assert.equal(lecteur(LISTE, 'c2').neighborChapter(-1).id, 'c1');
    assert.equal(lecteur(LISTE, 'c1').neighborChapter(-1), null);
    assert.equal(lecteur(LISTE, 'x').neighborChapter(1), null);
});

test('« pages: 0 » ne veut pas dire vide : les extensions l\'écrivent pour « inconnu »', () => {
    // weebcentral, sushiscan, chireads, novelbin… posent `pages: 0` sur
    // TOUS leurs chapitres. Les sauter rendrait la lecture impossible.
    const liste = [{ id: 'a', chapter: '1', pages: 0 }, { id: 'b', chapter: '2', pages: 0 }, { id: 'c', chapter: '3', pages: 0 }];
    assert.equal(lecteur(liste, 'a').neighborChapter(1).id, 'b');
    assert.equal(lecteur(liste, 'c').neighborChapter(-1).id, 'b');
    const ext = fs.readFileSync(path.join(__dirname, '..', '..', 'extensions-community', 'weebcentral', 'index.js'), 'utf8');
    assert.match(ext, /pages: 0,/, 'si weebcentral cesse d\'écrire pages: 0, ce test peut être revu');
});

test('une entrée déjà ouverte pour rien dans la session est sautée', () => {
    const liste = [{ id: 'a', chapter: '1' }, { id: 'b', chapter: '2' }, { id: 'c', chapter: '3' }];
    assert.equal(lecteur(liste, 'a', ['b']).neighborChapter(1).id, 'c');
});

test('le bloc « À suivre », la barre d\'outils et l\'enchaînement passent par le même voisin', () => {
    assert.ok(!/\.sort\(\(a, b\) => a\.chapter - b\.chapter\)/.test(SRC),
        'plus aucun tri par soustraction directe des numéros');
    assert.match(fonction('renderNextChapter'), /neighborChapter\(1\)/);
    assert.match(fonction('chapitreSuivant'), /neighborChapter\(1\)/);
    assert.match(fonction('renderToolbar'), /neighborChapter\(-1\)[\s\S]*neighborChapter\(1\)/);
});

test('au dernier chapitre, le lecteur dit pourquoi il n\'y a pas de suite', () => {
    const fin = fonction('finDeSerie');
    for (const statut of ['completed', 'cancelled', 'hiatus']) assert.ok(fin.includes(`'${statut}'`), statut);
    assert.match(fonction('renderNextChapter'), /el\.innerHTML = finDeSerie\(\)/);
});

test('un chapitre vide atteint en tournant les chapitres enchaîne dans le même sens', () => {
    const i = SRC.indexOf('if (!totalPages) {');
    const bloc = SRC.slice(i, SRC.indexOf('\n            }\n', i));
    assert.match(bloc, /retenirChapitreVide\(chapterId\)/);
    assert.match(bloc, /location\.replace\(urlChapitre\(suite, saut\)\)/);
    assert.match(bloc, /showError\('Ce chapitre ne contient aucune page', neighborChapter\(1\)\)/);
});
