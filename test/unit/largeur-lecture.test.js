// ============================================================
// test/unit/largeur-lecture.test.js — une colonne se mesure en caractères
// ------------------------------------------------------------
// Le lecteur de romans réglait sa colonne en PIXELS : `--novel-width: 720px`,
// curseur de 540 à 980, étiquette « 720px ».
//
// Le chiffre n'était pas le défaut. L'UNITÉ l'était. Une largeur en pixels
// ne suit pas la taille du texte : mesuré sur Moby Dick, nombre de
// caractères réellement rendus par ligne —
//
//     taille du texte     720 px (avant)     60 ch (après)
//     15 px                    80                 65
//     17 px                    71                 65
//     22 px                    55                 65
//     26 px                    46                 65
//
// L'ancien réglage donnait entre **46 et 80** caractères selon la taille
// choisie — les deux extrêmes hors de la plage confortable (60–70), et dans
// des sens opposés. Le lecteur qui grossissait son texte pour mieux voir
// rétrécissait sa ligne sans le vouloir ; celui qui le réduisait héritait de
// lignes interminables. Et le curseur affichait « 720px » dans les deux cas,
// un nombre qui ne dit rien de la lecture.
//
// En `ch`, la colonne suit la police : 65 caractères à toutes les tailles.
//
// `ch` est la largeur du glyphe zéro, pas celle du caractère moyen. Écart
// mesuré sur les trois polices proposées : 0,93 (Bitter), 1,025 (Segoe UI),
// 1,00 (mono). Le libellé « caractères » est donc juste à 7 % près, et
// corriger par un facteur par police coûterait plus de machinerie que
// l'écart n'en vaut pour un réglage qu'on ajuste à l'œil.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'assets', 'js', 'lecture.js'), 'utf8')
    .replace(/\r\n/g, '\n');

test('la colonne est posée en ch, plus en px', () => {
    assert.match(SRC, /setProperty\('--novel-width', ns\.width \+ 'ch'\)/);
    assert.ok(!/setProperty\('--novel-width', ns\.width \+ 'px'\)/.test(SRC));
});

test('le défaut tombe dans la plage confortable', () => {
    const m = /const ns = \{ size: (\d+), lh: [\d.]+, width: (\d+),/.exec(SRC);
    assert.ok(m, 'les réglages par défaut doivent rester repérables');
    const largeur = Number(m[2]);
    assert.ok(largeur >= 55 && largeur <= 70,
        'une colonne de ' + largeur + ' caractères sort de la plage 55–70');
});

test('le curseur propose des caractères, pas des pixels', () => {
    assert.match(SRC, /min="45" max="100" step="5"/,
        'les bornes doivent être des nombres de caractères');
    assert.match(SRC, /nsWidthVal.*\$\{ns\.width\} caract/,
        'l’étiquette initiale doit dire l’unité');
    assert.match(SRC, /textContent = e\.target\.value \+ ' caract/,
        'et l’étiquette suivie aussi');
    // Viser `nsWidthVal` et lui seul : la TAILLE du texte, elle, s'exprime
    // bien en pixels, et une interdiction globale du suffixe « px » la
    // condamnait avec le reste.
    const bloc = SRC.slice(SRC.indexOf("#nsWidth'"), SRC.indexOf("#nsWidth'") + 400);
    assert.ok(!/nsWidthVal.*\+ 'px'/.test(bloc),
        'la largeur ne doit plus s’afficher en pixels');
});

test('un réglage écrit avant le changement d’unité est converti', () => {
    // Sans ça, un 720 enregistré serait relu comme 720 CARACTÈRES : une
    // colonne dix fois trop large, et un curseur qui bute à 100 sans pouvoir
    // y revenir. Le seuil de 140 sépare sans ambiguïté les deux mondes : le
    // curseur d'avant commençait à 540, celui d'aujourd'hui s'arrête à 100.
    const m = /if \(ns\.width > (\d+)\) \{([\s\S]*?)\n        \}/.exec(SRC);
    assert.ok(m, 'la conversion doit exister');
    const seuil = Number(m[1]);
    assert.ok(seuil > 100 && seuil < 540,
        'le seuil doit séparer les deux échelles, vu ' + seuil);
    assert.match(m[2], /Math\.max\(45, Math\.min\(100,/,
        'le résultat doit retomber dans les bornes du curseur');
    assert.match(m[2], /setPref\('novel_width'/,
        'et être réécrit, pour ne pas reconvertir à chaque ouverture');
});

test('la conversion garde au lecteur la colonne qu’il avait', () => {
    // On ne profite pas du changement d'unité pour lui imposer notre défaut :
    // 720 px à 17 px de texte valaient ~80 caractères, il les garde, et peut
    // descendre à 60 s'il le veut.
    const m = /const parCaractere = ns\.size \* ([\d.]+);/.exec(SRC);
    assert.ok(m, 'le facteur de conversion doit rester lisible');
    const facteur = Number(m[1]);
    const converti = (px, taille) =>
        Math.max(45, Math.min(100, Math.round(px / (taille * facteur) / 5) * 5));
    assert.equal(converti(720, 17), 80, '720 px à 17 px rendaient ~80 caractères');
    assert.equal(converti(540, 17), 60);
    assert.equal(converti(980, 17), 100);
});
