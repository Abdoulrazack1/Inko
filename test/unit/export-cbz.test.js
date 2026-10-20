// ============================================================
// test/unit/export-cbz.test.js — exporter une série en CBZ
// ------------------------------------------------------------
// Vérifié sur la vraie page (Chromium, trois chapitres réellement téléchargés,
// 6 pages PNG) : « Exporter en CBZ » → archive ouverte avec Python :
//   Chapitre 0001.0/001.png … 003.png · Chapitre 0002.0/001.png, 002.png ·
//   Chapitre 0010.5/001.png · ComicInfo.xml (Series « Ma Série : édition »).
// PNG intacts (signature vérifiée), stockés sans recompression.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DL = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'downloads.js'), 'utf8');
const methode = (debut) => {
    const i = DL.indexOf(debut);
    let j = DL.indexOf('{', DL.indexOf(') {', i)), n = 0;
    for (; j < DL.length; j++) { if (DL[j] === '{') n++; else if (DL[j] === '}' && --n === 0) break; }
    return DL.slice(i, j + 1).trim();
};
// eslint-disable-next-line no-new-func
const o = new Function(`return { ${methode('nomPage(chapitre, index, type)')}, ${methode('comicInfo(titre, chapitres)')} };`)();

test('un dossier par chapitre, dans l\'ordre (zéros en tête), une page par fichier', () => {
    assert.equal(o.nomPage(1, 0, 'image/png'), 'Chapitre 0001.0/001.png');
    assert.equal(o.nomPage('12', 9, 'image/jpeg'), 'Chapitre 0012.0/010.jpg');
    assert.equal(o.nomPage(10.5, 0, 'image/webp'), 'Chapitre 0010.5/001.webp', 'un chapitre bis se range entre le 10 et le 11');
    assert.equal(o.nomPage('Extra/1', 0, ''), 'Chapitre Extra_1/001.jpg', 'pas de dossier fantôme');
    // L'ordre alphabétique des CHEMINS COMPLETS est l'ordre de lecture — c'est
    // ainsi que trient beaucoup de liseuses. Ma première version (« 0010 »)
    // rangeait le 10.5 avant le 10 : le « . » précède le « / ».
    const chemins = [2, 10, 10.5, 1, 100].map(n => o.nomPage(n, 0, '')).sort();
    assert.deepStrictEqual(chemins.map(d => d.split('/')[0]), ['Chapitre 0001.0', 'Chapitre 0002.0', 'Chapitre 0010.0', 'Chapitre 0010.5', 'Chapitre 0100.0']);
});

test('ComicInfo.xml porte le titre, échappé', () => {
    const x = o.comicInfo('Tom & Jerry <2>', 3);
    assert.match(x, /<Series>Tom &amp; Jerry &lt;2&gt;<\/Series>/);
    assert.match(x, /3 chapitre\(s\)/);
});

test('rien n\'est retéléchargé ni inventé : les pages viennent du cache, les absentes sont comptées', () => {
    const f = methode('async exporterCbz(');
    assert.match(f, /await cache\.match\(c\.pages\[i\]\)/);
    assert.match(f, /else manquantes\+\+;/);
    assert.match(f, /compression: 'STORE'/);
});
