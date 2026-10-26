// ============================================================
// test/unit/reco-tags.test.js — recommandations par tags croisés
// ------------------------------------------------------------
// Vérifié sur l'accueil (Chromium, historique simulé : trois lectures
// action/fantasy/aventure récentes dont une notée 10, une romance ancienne
// notée 2) → « Fantasy + Adventure, d'après tes 4 dernières lectures » ;
// recherches croisées Fantasy+Adventure, Fantasy+Action, Adventure+Action ;
// classement c-af, c-aa, c-fad, c-afa ; la romance, le candidat à un seul
// genre et la série déjà lue sont écartés.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const lire = (f) => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
const store = {};
const window = {};
// eslint-disable-next-line no-new-func
new Function('window', 'localStorage', lire('assets/js/reco-tags.js'))(window,
    { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } });
const { profilTags, pairesCroisees, affinite, tagsDe } = window.MH.recoTags;

test('le profil vient de tout l\'historique, pas de la dernière lecture', () => {
    const p = profilTags([
        { tags: ['Shoujo', 'Romance'], joursDepuis: 0 },           // la dernière, isolée
        { tags: ['Seinen', 'Action'], joursDepuis: 2 },
        { tags: ['Seinen', 'Action', 'Drama'], joursDepuis: 5 },
        { tags: ['Seinen', 'Mystery'], joursDepuis: 9 },
    ]);
    assert.equal(p[0].tag, 'Seinen');
    assert.ok(p.findIndex(x => x.tag === 'Action') < p.findIndex(x => x.tag === 'Shoujo'));
});

test('une série notée bas fait baisser ses genres, une lecture ancienne pèse moins', () => {
    const p = profilTags([
        { tags: ['Romance'], note: 2 },
        { tags: ['Action'], note: 10 },
        { tags: ['Horreur'], joursDepuis: 730 },
        { tags: ['Comédie'], joursDepuis: 0 },
    ]);
    assert.ok(!p.some(x => x.tag === 'Romance'), 'notée 2/10 : le genre sort du profil');
    const poids = Object.fromEntries(p.map(x => [x.tag, x.poids]));
    assert.ok(Math.abs(poids['Horreur'] / poids['Comédie'] - 0.25) < 1e-9, 'demi-vie d\'un an : deux ans → un quart');
});

test('on cherche les paires des trois genres les plus forts', () => {
    assert.deepStrictEqual(pairesCroisees([{ tag: 'A' }, { tag: 'B' }, { tag: 'C' }, { tag: 'D' }]),
        [['A', 'B'], ['A', 'C'], ['B', 'C']]);
});

test('« croisés » : au moins deux genres du profil, et un genre noyé dans douze compte moins', () => {
    const profil = [{ tag: 'Action', poids: 3 }, { tag: 'Fantasy', poids: 2 }, { tag: 'Adventure', poids: 1 }];
    assert.equal(affinite(['Action'], profil).score, 0);
    const pur = affinite(['Action', 'Fantasy'], profil).score;
    const dilue = affinite(['Action', 'Fantasy', 'X', 'Y', 'Z', 'W'], profil).score;
    assert.ok(pur > dilue);
    assert.deepStrictEqual(affinite(['Adventure', 'Action'], profil).communs, ['Action', 'Adventure']);
});

test('les genres d\'une fiche ouverte sont mis en cache par api.js et relus ici', () => {
    store.inko_tags_series = JSON.stringify({ 'mangadex|42': ['Action', 'Drama'] });
    assert.deepStrictEqual(tagsDe('mangadex', '42'), ['Action', 'Drama']);
    const api = lire('assets/js/api.js');
    assert.match(api, /\.then\(mapManga\)\.then\(m => noterTagsSerie\(m, source\)\)/);
    assert.match(lire('assets/js/accueil.js'), /if \(await rendreRecoCroisee\(prog, section, track, sub\)\) return;/);
});
