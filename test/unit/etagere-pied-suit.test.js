// ============================================================
// test/unit/etagere-pied-suit.test.js — le pied de l'étagère suit la
// latte qu'on regarde
// ------------------------------------------------------------
// Les trois contrôles sous l'étagère — « Reprendre X », « Voir la
// fiche », « Retirer » — pointaient la PREMIÈRE latte, quelle que soit
// celle qu'on survolait.
//
// Or survoler une latte l'ouvre DÉJÀ : elle s'élargit (`flex-grow` de
// 4.2 dans `accueil.css`), son titre grossit et sa position apparaît.
// L'étagère disait donc « voici One Piece » pendant que le bouton en
// dessous proposait de reprendre Blue Lock. Deux affirmations
// contradictoires, à dix pixels l'une de l'autre.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const lire = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8')
    .replace(/\r\n/g, '\n');
const JS = lire('assets', 'js', 'accueil.js');
const CSS = lire('assets', 'css', 'accueil.css');

test('la latte porte ce qu’il faut au pied', () => {
    // Le lien de reprise est déjà son `href` — et c'est lui qui sait si
    // l'œuvre s'ouvre dans le lecteur de planches ou celui de texte.
    assert.match(JS, /data-titre="\$\{MH\.esc\(e\.title\)\}" data-fiche="\$\{MH\.esc\(fiche\(e\)\)\}"/);
});

test('les trois contrôles se retrouvent et se mettent à jour', () => {
    // Le libellé du bouton vit dans son propre `span` : sans lui, le
    // remplacer effacerait l'icône de lecture qui l'accompagne.
    assert.match(JS, /<span class="etagere-cta-texte">Reprendre \$\{MH\.esc\(une\.title\)\}<\/span>/);
    assert.match(JS, /class="btn btn-ghost etagere-fiche"/);

    const viser = /function viser\(latte\) \{([\s\S]*?)\n        \}/.exec(JS);
    assert.ok(viser, 'la fonction qui vise une latte');
    assert.match(viser[1], /pied\.cta\.href = latte\.getAttribute\('href'\)/);
    assert.match(viser[1], /pied\.texte\.textContent = `Reprendre \$\{titre\}`/);
    assert.match(viser[1], /pied\.fiche\.href = latte\.dataset\.fiche/);
    assert.match(viser[1], /pied\.retirer\.dataset\.retirer = latte\.dataset\.id/);
    // « Retirer » est le seul des trois qui détruit quelque chose : son
    // nom accessible doit dire QUOI, sinon il annonce encore l'œuvre
    // précédente au moment où on le presse.
    assert.match(viser[1], /pied\.retirer\.setAttribute\('aria-label',/);
    // Et on ne repeint pas pour rien.
    assert.match(viser[1], /vise === latte\) return/);
});

test('au doigt, le pied ne bouge pas sous le pouce', () => {
    // `pointerenter` part au premier contact sur un écran tactile : sans
    // ce filtre, le pied changerait pendant le tap. Sans survol, il
    // garde l'œuvre en cours — le bon défaut quand on ne désigne rien.
    assert.match(JS, /latte\.addEventListener\('pointerenter', \(ev\) => \{\s*\n\s*if \(ev\.pointerType === 'mouse'\) viser\(latte\);/);
    assert.match(JS, /etagere\?\.addEventListener\('pointerleave', \(ev\) => \{\s*\n\s*if \(ev\.pointerType === 'mouse'\) defaut\(\);/);
});

test('au clavier, la latte qu’on atteint est celle qu’on regarde', () => {
    assert.match(JS, /latte\.addEventListener\('focusin', \(\) => viser\(latte\)\)/);
    // On ne remet le défaut que si le focus quitte l'étagère ENTIÈRE :
    // sinon passer d'une latte à l'autre le ferait clignoter.
    assert.match(JS, /if \(!etagere\.contains\(ev\.relatedTarget\)\) defaut\(\)/);
});

test('le défaut est la latte ouverte, pas la première venue', () => {
    // C'est l'œuvre en cours de lecture. Si la composition changeait et
    // qu'aucune latte n'était ouverte, on retombe sur la première.
    assert.match(JS, /querySelector\('\.latte--ouverte'\) \|\| etagere\?\.querySelector\('\.latte'\)/);
});

test('et c’est bien le survol qui ouvre une latte', () => {
    // La raison d'être de tout ceci : le survol change déjà ce que
    // l'étagère montre. Si cette règle disparaissait, le pied suivrait
    // quelque chose que rien ne désigne à l'écran.
    assert.match(CSS, /\.latte:hover, \.latte:focus-visible \{ flex-grow: 4\.2; \}/);
    assert.match(CSS, /\.latte:hover \.latte-ou, \.latte:focus-visible \.latte-ou \{ display: block; \}/);
});
