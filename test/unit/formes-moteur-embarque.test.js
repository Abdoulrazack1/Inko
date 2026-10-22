// ============================================================
// test/unit/formes-moteur-embarque.test.js — sans hub, le téléphone rend
// les mêmes formes que le hub
// ------------------------------------------------------------
// Le moteur embarqué (mode autonome, téléphone sans ordinateur) a déjà cassé
// six pages en rendant un objet là où le hub rend un tableau, pour
// `/sources`. Deux autres routes divergeaient encore :
//
//   chapitres   hub : { total, results } — c'est ce que rendent les neuf
//               extensions de référence, relayées telles quelles.
//               embarqué : { total, chapters } — une clé que PERSONNE ne lit.
//               serie.js, chapitre.js et lecture.js font `data.results || []` :
//               une série MangaDex s'ouvrait donc sans aucun chapitre.
//
//   tags        hub : un tableau (getTags des extensions, ou [] sans getTags).
//               embarqué : { tags: [...] }. catalogue.js fait
//               `allTags = await API.mangas.tags() || []` puis le traite en
//               tableau : les filtres du catalogue ne se dessinaient pas.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'sources-embarquees.js'), 'utf8');
const lire = (f) => fs.readFileSync(path.join(ROOT, 'assets', 'js', f), 'utf8');

function charger(reponse) {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', runScripts: 'outside-only' });
    const w = dom.window;
    w.fetch = async () => ({ ok: true, json: async () => reponse });
    w.eval(SRC);
    return w.INKO_SOURCES_EMBARQUEES;
}

const chapitreMD = (id, n) => ({ id, attributes: { chapter: String(n), translatedLanguage: 'fr', pages: 20 } });

test('les appelants lisent bien `.results` sur les chapitres (le contrat à tenir)', () => {
    assert.match(lire('serie.js'), /chapters = data\.results \|\| \[\]/);
    assert.match(lire('chapitre.js'), /chapters = chapsData\.results \|\| \[\]/);
    assert.match(lire('lecture.js'), /chapters = chapsData\.results \|\| \[\]/);
});

test('MangaDex embarqué rend ses chapitres sous `results`', async () => {
    const M = charger({ total: 2, data: [chapitreMD('c1', 1), chapitreMD('c2', 2)] });
    const r = JSON.parse(JSON.stringify(await M.defaut.chapters('m1')));   // hors du realm jsdom
    assert.ok(Array.isArray(r.results), `reçu : ${JSON.stringify(Object.keys(r))}`);
    assert.deepStrictEqual(r.results.map(c => c.id), ['c1', 'c2']);
    assert.equal(r.total, 2);
});

test('MangaDex embarqué rend ses tags en tableau, comme le hub', async () => {
    const M = charger({ data: [{ id: 't1', attributes: { name: { en: 'Action' } } }] });
    const brut = await M.defaut.tags();
    // Tableau d'un autre realm (jsdom) : Array.isArray le reconnaît, deepStrictEqual non.
    assert.ok(Array.isArray(brut), `reçu : ${JSON.stringify(brut)}`);
    const r = JSON.parse(JSON.stringify(brut));
    assert.deepStrictEqual(r, [{ id: 't1', name: 'Action' }]);
});

test('une extension jouée sur le téléphone : chapitres en tableau nu → `results`, pas de getTags → []', async () => {
    const M = charger({});
    const ext = M.adapter({
        id: 'x', name: 'X',
        popular: async () => ({ results: [] }), search: async () => ({ results: [] }),
        getManga: async () => ({ id: 'm' }), getPages: async () => ({ pages: [] }),
        getChapters: async () => [{ id: 'a', chapter: 1 }, { id: 'b', chapter: 2 }],
    });
    const c = JSON.parse(JSON.stringify(await ext.chapters('m')));
    assert.deepStrictEqual(c.results.map(x => x.id), ['a', 'b']);
    assert.equal(c.total, 2);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(await ext.tags())), []);
});

test('une extension qui rend déjà `{ total, results }` passe telle quelle', async () => {
    const M = charger({});
    const forme = { total: 1, results: [{ id: 'a' }] };
    const ext = M.adapter({ id: 'y', name: 'Y', popular: async () => ({ results: [] }), search: async () => ({ results: [] }),
        getManga: async () => ({ id: 'm' }), getPages: async () => ({ pages: [] }), getChapters: async () => forme });
    assert.deepStrictEqual(await ext.chapters('m'), forme);
});
