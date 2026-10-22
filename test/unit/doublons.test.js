// ============================================================
// test/unit/doublons.test.js — la même œuvre suivie sur deux sources
// ------------------------------------------------------------
// Vérifié dans la vraie bibliothèque (Chromium, serveur et MySQL réels) :
// « Fusion Test » chez WeebCentral (pas commencée) et « FUSION TEST! » chez
// MangaDex (chapitre 42) → bandeau « 1 série suivie sur deux sources à la
// fois », la modale propose de garder MangaDex en premier ; « Garder
// celle-ci » envoie la migration WeebCentral → MangaDex avec tout à reporter.
// Le côté serveur (la plus avancée gagne, l'annulation rend la cible intacte)
// est vérifié contre MySQL dans server/test/integration.db.test.js.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const lire = (f) => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
const window = {};
// eslint-disable-next-line no-new-func
new Function('window', 'document', lire('assets/js/doublons.js'))(window, undefined);
const { detecterDoublons } = window.MH.doublons;

test('même titre, sources différentes : un doublon, le plus avancé en tête', () => {
    const g = detecterDoublons([
        { mangaId: 'a', source: 'weebcentral', title: 'One Piece' },
        { mangaId: 'b', source: 'mangadex', title: 'ONE PIECE' },
        { mangaId: 'c', source: 'mangadex', title: 'Blue Lock' },
    ], { b: { chapter: '1120' }, a: { chapter: '30' } });
    assert.equal(g.length, 1);
    assert.deepStrictEqual(g[0].entrees.map(e => e.mangaId), ['b', 'a']);
    assert.equal(g[0].entrees[0].chapitre, 1120);
});

test('même titre sur la MÊME source n\'est pas un doublon de source', () => {
    assert.deepStrictEqual(detecterDoublons([
        { mangaId: 'a', source: 'mangadex', title: 'Berserk' },
        { mangaId: 'b', source: 'mangadex', title: 'Berserk' },
    ]), []);
});

test('un spin-off n\'est pas la même série, un titre trop court ne rapproche rien', () => {
    assert.deepStrictEqual(detecterDoublons([
        { mangaId: 'a', source: 'weebcentral', title: 'Blue Lock' },
        { mangaId: 'b', source: 'mangadex', title: 'Blue Lock: Episode Nagi' },
        { mangaId: 'c', source: 'weebcentral', title: 'X' },
        { mangaId: 'd', source: 'mangadex', title: 'X' },
    ]), []);
});

test('la bibliothèque signale, la fusion passe par la migration avec tout à reporter', () => {
    assert.match(lire('assets/js/bibliotheque.js'), /MH\?\.doublons\?\.signaler\(document\.getElementById\('libDoublons'\), favs, progressByManga\)/);
    assert.match(lire('bibliotheque.html'), /id="libDoublons" hidden/);
    assert.match(lire('assets/js/doublons.js'), /conserver: \['favori', 'progression', 'chapitres_lus', 'notes', 'notation', 'signets'\]/);
});
