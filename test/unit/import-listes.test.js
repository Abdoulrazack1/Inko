// ============================================================
// test/unit/import-listes.test.js — reprendre sa liste MyAnimeList / AniList
// ------------------------------------------------------------
// Vérifié de bout en bout (Chromium, serveur et MySQL réels, recherches de la
// source simulées) avec un vrai export MyAnimeList GZIPPÉ de trois séries :
//   aperçu « 3 séries dans l'export MyAnimeList » ; bilan « 2 série(s)
//   ajoutée(s) · 1 introuvable » ; en base : Berserk (en cours, note 9,
//   chapitres 1 à 3 lus, reprise au 3), ONE PIECE (à lire). « Berserk of
//   Gluttony », proposé par la recherche, n'a PAS été pris pour Berserk.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const { window } = new JSDOM('');
// eslint-disable-next-line no-new-func
new Function('window', 'document', 'DOMParser',
    fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'import-listes.js'), 'utf8'))(window, undefined, window.DOMParser);
const { lireExport, correspondance, noteSurDix } = window.MH.importListes;
const versJs = (x) => JSON.parse(JSON.stringify(x));   // tableaux d'un autre realm (jsdom)

const MAL = `<?xml version="1.0" encoding="UTF-8" ?>
<myanimelist>
  <myinfo><user_name>test</user_name></myinfo>
  <manga><series_title><![CDATA[Berserk]]></series_title><my_read_chapters>364</my_read_chapters><my_score>9</my_score><my_status>Reading</my_status></manga>
  <manga><series_title><![CDATA[Vagabond]]></series_title><my_read_chapters>0</my_read_chapters><my_score>0</my_score><my_status>On-Hold</my_status></manga>
  <manga><series_title><![CDATA[Plan]]></series_title><my_read_chapters>0</my_read_chapters><my_score>0</my_score><my_status>Plan to Read</my_status></manga>
</myanimelist>`;

test('export MyAnimeList : titre, statut, chapitres lus et note', () => {
    const r = versJs(lireExport(MAL));
    assert.equal(r.format, 'MyAnimeList');
    assert.deepStrictEqual(r.entrees[0], { titre: 'Berserk', titresAlt: [], statut: 'reading', chapitres: 364, note: 9 });
    assert.equal(r.entrees[1].statut, 'paused', 'On-Hold → en pause');
    assert.equal(r.entrees[1].note, null, 'score 0 = pas de note');
    assert.equal(r.entrees[2].statut, 'planned');
});

test('export AniList : titres alternatifs, progression, note sur 100 ramenée sur 10', () => {
    const r = versJs(lireExport(JSON.stringify({ data: { MediaListCollection: { lists: [{ name: 'Reading', entries: [
        { status: 'CURRENT', progress: 45, score: 85, media: { title: { romaji: 'Shingeki no Kyojin', english: 'Attack on Titan' }, synonyms: ['AoT'] } },
        { status: 'PLANNING', progress: 0, score: 0, media: { title: { romaji: 'Dandadan' } } },
    ] }] } } })));
    assert.equal(r.format, 'AniList');
    assert.deepStrictEqual(r.entrees[0], { titre: 'Shingeki no Kyojin', titresAlt: ['Attack on Titan', 'AoT'], statut: 'reading', chapitres: 45, note: 9 });
    assert.equal(r.entrees[1].statut, 'planned');
});

test('on ne devine pas : seul un titre identique (normalisé) est retenu', () => {
    const e = { titre: 'Berserk', titresAlt: [] };
    assert.equal(correspondance(e, [{ id: 'a', title: 'Berserk of Gluttony' }, { id: 'b', title: 'BERSERK' }]).id, 'b');
    assert.equal(correspondance(e, [{ id: 'a', title: 'Berserk of Gluttony' }]), null);
    assert.equal(correspondance({ titre: 'Shingeki no Kyojin', titresAlt: ['Attack on Titan'] }, [{ id: 'x', title: 'Attack on Titan' }]).id, 'x');
});

test('notes : échelle d\'Inko, rien quand il n\'y a pas de note', () => {
    assert.deepStrictEqual([noteSurDix(0), noteSurDix('7'), noteSurDix(73), noteSurDix(-1)], [null, 7, 7, null]);
});

test('un fichier qui n\'est ni l\'un ni l\'autre est refusé avec un message clair', () => {
    assert.throws(() => lireExport('bonjour'), /Ni un export MyAnimeList/);
});
