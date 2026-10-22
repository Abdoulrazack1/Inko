// ============================================================
// test/unit/planche-en-route.test.js — une planche qui arrive se voit
// arriver
// ------------------------------------------------------------
// Une planche restait à opacité 0 jusqu'à son arrivée. Sur une source qui
// met 4 à 20 s par page, l'écran montrait un cadre vide : rien ne
// distinguait « ça arrive » de « c'est cassé ». Le marque-place du
// défilement posait en plus un `background` en ligne, qui aurait écrasé
// tout indicateur venu de la feuille.
//
// Vérifié dans Chromium (styles calculés) :
//     en route   opacity 1 · animation plancheEnRoute · dégradé · texte alt transparent
//     arrivée    animation pageIn · fond aucun
//     mouvement réduit demandé → aucune animation pendant l'attente
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const lire = (f) => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8').replace(/\r\n/g, '\n');
const CSS = lire('assets/css/chapitre.css');
const JS = lire('assets/js/chapitre.js');

test('une planche en attente n\'est plus invisible', () => {
    assert.ok(!/\.reader-page-img \{ opacity: 0;/.test(CSS), 'plus d\'opacité 0 en attente');
    assert.match(CSS, /\.reader-page-img \{[^}]*animation: plancheEnRoute/);
    assert.match(CSS, /@keyframes plancheEnRoute/);
});

test('l\'arrivée retire l\'indicateur et garde le fondu', () => {
    assert.match(CSS, /\.reader-page-img\.loaded \{[^}]*background: none;[^}]*animation: pageIn/);
});

test('le mouvement réduit coupe le reflet', () => {
    assert.match(CSS, /@media \(prefers-reduced-motion: reduce\) \{ \.reader-page-img:not\(\.loaded\) \{ animation: none; \} \}/);
});

test('le marque-place ne pose plus de fond en ligne qui masquerait l\'indicateur', () => {
    const i = JS.indexOf('function placeholderImg(');
    const corps = JS.slice(i, JS.indexOf('\n    }\n', i));
    assert.ok(!/background/.test(corps), corps);
});
