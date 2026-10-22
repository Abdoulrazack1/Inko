// ============================================================
// test/unit/rotation-paysage.test.js — planche paysage, écran en portrait
// ------------------------------------------------------------
// Vérifié dans le vrai lecteur (Chromium, 390 × 844, planche 1600 × 1100
// dans un chapitre en portrait, option cochée) :
//   avant : 390 × 268 px à l'écran, le reste vide ;
//   après : 382 × 556 px (deux fois la surface), sans débordement ;
//   droite à gauche → quart de tour à gauche : la moitié DROITE, lue en
//   premier, arrive en haut ; gauche à droite → quart de tour à droite.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'chapitre.js'), 'utf8');
const extraire = (debut) => {
    const i = SRC.indexOf(debut);
    let j = SRC.indexOf('{', i), n = 0;
    for (; j < SRC.length; j++) { if (SRC[j] === '{') n++; else if (SRC[j] === '}' && --n === 0) break; }
    return SRC.slice(i, j + 1);
};
// eslint-disable-next-line no-new-func
const taillePivot = new Function(extraire('function taillePivot(') + 'return taillePivot;')();

test('la planche pivotée tient dans l\'écran, dans les deux dimensions', () => {
    // Téléphone : 382 de large disponible, 651 de haut ; planche 1600 × 1100.
    const t = taillePivot(382, 651, 1600 / 1100);
    assert.ok(t.h <= 382, 'sa hauteur affichée devient sa largeur à l\'écran');
    assert.ok(t.l <= 651, 'sa largeur affichée devient sa hauteur à l\'écran');
    assert.deepStrictEqual(t, { l: 556, h: 382 });
});

test('quand la hauteur manque, c\'est elle qui borne', () => {
    const t = taillePivot(382, 400, 2);    // planche très large, écran court
    assert.deepStrictEqual(t, { l: 400, h: 200 });
});

test('pivot seulement en mode page, écran en portrait, planche large, option cochée, sans découpe', () => {
    const f = extraire('function appliquerPivot(');
    assert.match(f, /rs\.pivoter === '1' && readMode === 'page' && portrait && estDouble\(img\)\s*&& !\(rs\.decouper === '1'\)/);
    assert.match(f, /rs\.direction === 'rtl' \? '-90deg' : '90deg'/, 'sens de lecture : la moitié lue en premier en haut');
    assert.match(SRC, /setTimeout\(\(\) => \{ surRotation\(\); appliquerPivot\(\); \}, 150\)/, 'réévalué quand on tourne l\'appareil');
});

test('le CSS ramène la boîte à son empreinte pivotée', () => {
    const css = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'css', 'chapitre.css'), 'utf8');
    const i = css.lastIndexOf('.reader-page-img.pivotee {');
    assert.ok(i > css.lastIndexOf('.fit-height .reader-page-img'), 'après les règles d\'ajustement en !important');
    assert.match(css.slice(i), /margin: calc\(\(var\(--pivot-l\) - var\(--pivot-h\)\) \/ 2\) calc\(\(var\(--pivot-h\) - var\(--pivot-l\)\) \/ 2\);/);
});
