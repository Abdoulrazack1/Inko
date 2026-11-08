// ============================================================
// test/unit/lecture-redimensionnement.test.js — redimensionner ne doit
// pas tourner les pages à votre place
// ------------------------------------------------------------
// Dans le lecteur de texte, la position de lecture est un POURCENTAGE :
// `scrollPct()` le calcule, `positionner()` le restitue, et c'est lui
// qu'on enregistre dans la progression. Le navigateur, lui, garde un
// `scrollTop` en PIXELS.
//
// Les deux ne survivent pas ensemble à une recomposition. Élargir la
// fenêtre, tourner le téléphone, ou changer la largeur de lecture dans
// les réglages : le texte se recompose, `scrollHeight` change, le pixel
// ne bouge pas — et il désigne un autre endroit du livre.
//
// MESURÉ sur « Pride and Prejudice » (720 994 caractères), fenêtre
// ramenée de 1100 à 600 px :
//
//     avant     50 %   204 334 px   document 409 567 px
//     après     50 %   224 041 px   document 448 982 px
//
// Le pourcentage tient, et le pixel est recalculé pour lui. Sans le
// correctif, le pixel serait resté à 204 334 dans un document de
// 448 982 — soit 45,6 %, un recul de 4,4 points : une trentaine de
// pages du livre, sans avoir rien touché.
//
// `chapitre.js` écoutait `resize` et `orientationchange` depuis
// longtemps, et posait même un `ResizeObserver`. Le lecteur de texte
// n'écoutait rien : c'est l'asymétrie que ce correctif comble.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, 'assets', 'js', f), 'utf8')
    .replace(/\r\n/g, '\n');
const LECTURE = lire('lecture.js');

test('le lecteur de texte écoute enfin le redimensionnement', () => {
    assert.match(LECTURE, /window\.addEventListener\('resize', differer\)/);
    assert.match(LECTURE, /window\.addEventListener\('orientationchange', differer\)/);
    // Et le branchement est réellement appelé.
    assert.match(LECTURE, /function bindScrollProgress\(\) \{\s*\n\s*brancherRedimensionnement\(\);/);
});

test('on ne repositionne qu’une fois le redimensionnement posé', () => {
    // Un redimensionnement à la souris émet des dizaines d'événements ;
    // repositionner à chacun ferait vibrer la page.
    const f = /function brancherRedimensionnement\(\) \{([\s\S]*?)\n    \}/.exec(LECTURE);
    assert.ok(f, 'brancherRedimensionnement');
    assert.match(f[1], /clearTimeout\(tempoResize\)/);
    assert.match(f[1], /setTimeout\(surRedimensionnement, 150\)/);
});

test('le pourcentage est retenu partout où il change', () => {
    // Les deux écouteurs de défilement — la fenêtre, et le conteneur en
    // mode pages — plus `positionner`, pour qu'une lecture reprise à
    // 60 % puis redimensionnée sans toucher à la molette ne reparte pas
    // de zéro.
    assert.equal((LECTURE.match(/retenirPct\(pct\);/g) || []).length, 2,
        'les deux écouteurs de défilement');
    const pos = /function positionner\(pct\) \{([\s\S]*?)\n    \}/.exec(LECTURE);
    assert.ok(pos, 'positionner');
    assert.match(pos[1], /dernierPct = pct;/);
});

test('repositionner ne se mord pas la queue', () => {
    // `positionner` déclenche un `scroll`, qui réécrirait le pourcentage
    // qu'on vient tout juste de restaurer.
    assert.match(LECTURE, /function retenirPct\(pct\) \{ if \(!enRepositionnement\) dernierPct = pct; \}/);
    const f = /function surRedimensionnement\(\) \{([\s\S]*?)\n    \}/.exec(LECTURE);
    assert.ok(f, 'surRedimensionnement');
    assert.match(f[1], /enRepositionnement = true;/);
    assert.match(f[1], /enRepositionnement = false;/);
    // Deux images : la recomposition peut s'achever après le premier cadre.
    assert.match(f[1], /requestAnimationFrame\(\(\) => \{/);
    assert.equal((f[1].match(/positionner\(dernierPct\)/g) || []).length, 2);
});

test('en haut de chapitre, on ne touche à rien', () => {
    // Sans ce garde, `positionner(0)` ramènerait en haut une page qui y
    // est déjà — et volerait un défilement en cours.
    const f = /function surRedimensionnement\(\) \{([\s\S]*?)\n    \}/.exec(LECTURE);
    assert.match(f[1], /if \(dernierPct <= 0\) return;/);
});

test('et les deux modes passent par le même chemin', () => {
    // `positionner` traite le défilement vertical ET le conteneur
    // horizontal du mode pages, où une repagination rend le `scrollLeft`
    // en pixels encore plus arbitraire.
    const pos = /function positionner\(pct\) \{([\s\S]*?)\n    \}/.exec(LECTURE)[1];
    assert.match(pos, /estPagine\(\)/);
    assert.match(pos, /scrollLeft/);
    assert.match(pos, /window\.scrollTo/);
});
