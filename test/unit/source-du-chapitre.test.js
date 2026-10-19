// ============================================================
// test/unit/source-du-chapitre.test.js — savoir d'où vient ce qu'on lit
// ------------------------------------------------------------
// Deux sources peuvent porter la même série, avec des traductions, des
// découpages et des numérotations différentes. Le lecteur n'affichait nulle
// part laquelle il servait : on pouvait lire un chapitre entier sans savoir
// d'où il venait, et donc sans savoir quoi faire quand la traduction partait
// de travers.
//
// En posant la pastille, un second défaut s'est vu : le lien de retour du
// lecteur d'IMAGES pointait sur
//
//     serie.html?id=...            (sans source)
//
// alors que celui des romans porte bien `&source=`. C'est la classe BUG-01 —
// un identifiant sans sa source part à la source COURANTE, qui répond 200
// avec une fiche vide. Ça tenait ici parce que l'initialisation pose la
// source depuis l'URL, pas parce que le lien était juste : le jour où un
// autre chemin mène au lecteur, il casse en silence.
//
// Vérifié dans le navigateur, les deux lecteurs :
//
//     Blue Lock, chap. 2    pastille « Weeb Central »
//     Moby Dick             pastille « Project Gutenberg »
//     lien de retour        serie.html?id=...&source=weebcentral
//     contraste de la pastille sur la barre : 5,44:1 (texte de 11 px)
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const lire = (...p) => fs.readFileSync(path.join(RACINE, ...p), 'utf8').replace(/\r\n/g, '\n');
const IMAGES = lire('assets', 'js', 'chapitre.js');
const ROMANS = lire('assets', 'js', 'lecture.js');
const CSS = lire('assets', 'css', 'chapitre.css');

const barreGauche = (src, nom) => {
    const i = src.indexOf('<div class="toolbar-left">');
    assert.notEqual(i, -1, nom + ' doit garder sa barre de gauche');
    return src.slice(i, src.indexOf('</div>', i));
};

for (const [nom, src] of [['le lecteur d’images', IMAGES], ['le lecteur de romans', ROMANS]]) {
    test(nom + ' nomme la source du chapitre', () => {
        const barre = barreGauche(src, nom);
        assert.match(barre, /class="toolbar-source"/,
            'la pastille doit être dans la barre, pas dans un panneau à ouvrir');
        assert.match(barre, /MH\.sourceName\?\.\(API\.sources\.current\)/,
            'le NOM de la source, pas son identifiant : « weebcentral » ne se lit pas');
        assert.match(barre, /\|\| API\.sources\.current/,
            'et l’identifiant en repli, plutôt qu’une pastille vide');
        assert.match(barre, /title="Source de ce chapitre"/,
            'un nom seul ne dit pas ce qu’il désigne');
    });
}

test('le retour vers la fiche emporte la source, des deux côtés', () => {
    // BUG-01 : sans elle, l'identifiant part à la source courante.
    for (const [nom, src] of [['images', IMAGES], ['romans', ROMANS]]) {
        const barre = barreGauche(src, nom);
        const m = /href="serie\.html\?id=\$\{encodeURIComponent\(manga\.id\)\}([^"]*)"/.exec(barre);
        assert.ok(m, 'le lien de retour doit rester repérable (' + nom + ')');
        assert.match(m[1], /&source=\$\{encodeURIComponent\(API\.sources\.current\)\}/,
            'le lien de retour du lecteur ' + nom + ' doit porter la source');
    }
});

test('la pastille est stylée, et disparaît avec le reste sur écran étroit', () => {
    assert.match(CSS, /\.toolbar-source \{/, 'la pastille doit avoir un style');
    // Sans cette règle, la barre de 480 px garderait la pastille après avoir
    // jeté le numéro de chapitre — l'information la moins utile des deux.
    const i = CSS.indexOf('@media (max-width: 480px)');
    assert.notEqual(i, -1);
    const etroit = CSS.slice(i);
    assert.match(etroit, /\.toolbar-chap \{ display: none; \}/);
    assert.match(etroit, /\.toolbar-source \{ display: none; \}/);
});

test('la pastille ne réintroduit pas de couleur en dur', () => {
    // La barre du lecteur est sombre dans les quatre thèmes ; la pastille doit
    // quand même passer par les jetons, comme le reste.
    const i = CSS.indexOf('.toolbar-source {');
    const bloc = CSS.slice(i, CSS.indexOf('}', i));
    assert.ok(!/#[0-9a-f]{3,6}|rgba?\(/i.test(bloc),
        'couleur littérale dans .toolbar-source : ' + bloc.replace(/\s+/g, ' '));
    assert.match(bloc, /var\(--text3\)/);
    assert.match(bloc, /var\(--border\)/);
});
