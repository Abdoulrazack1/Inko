// ============================================================
// test/unit/vue-chronologique.test.js — ce qui est sorti, tous titres confondus
// ------------------------------------------------------------
// Vérifié dans la vraie bibliothèque (Chromium, serveur et MySQL réels) :
// onglet « Mises à jour », SANS lancer de vérification →
// « Sorti récemment | AUJOURD'HUI 1 | Série 0 | Chap. 101 · il y a 1 h |
//   HIER 1 | … | CETTE SEMAINE 1 | … il y a 3 j | CE MOIS-CI 1 | … il y a
//   2 sem » ; la série sortie il y a 40 j n'y figure pas.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'bibliotheque.js'), 'utf8');
const i = SRC.indexOf('    const TRANCHES = [');
const j = SRC.indexOf('    function renderChronologie(');
// eslint-disable-next-line no-new-func
const grouper = new Function(SRC.slice(i, j) + 'return grouperParSortie;')();
const MAINTENANT = new Date(2026, 9, 20, 15, 0);
const il_y_a = (h) => new Date(MAINTENANT.getTime() - h * 3600000).toISOString();

test('les sorties se rangent par tranche, la plus récente d\'abord', () => {
    const g = grouper([
        { mangaId: 'mois', latestAt: il_y_a(24 * 20) },
        { mangaId: 'auj2', latestAt: il_y_a(1) },
        { mangaId: 'auj1', latestAt: il_y_a(5) },
        { mangaId: 'hier', latestAt: il_y_a(20) },
        { mangaId: 'sem', latestAt: il_y_a(24 * 4) },
    ], MAINTENANT);
    assert.deepStrictEqual(g.map(x => [x.libelle, x.items.map(f => f.mangaId)]), [
        ['Aujourd’hui', ['auj2', 'auj1']],
        ['Hier', ['hier']],
        ['Cette semaine', ['sem']],
        ['Ce mois-ci', ['mois']],
    ]);
});

test('au-delà de 30 jours, sans date ou daté dans le futur : hors de la chronologie', () => {
    assert.deepStrictEqual(grouper([
        { mangaId: 'vieux', latestAt: il_y_a(24 * 40) },
        { mangaId: 'sansdate', latestAt: null },
        { mangaId: 'abime', latestAt: 'pas une date' },
        { mangaId: 'futur', latestAt: new Date(MAINTENANT.getTime() + 86400000).toISOString() },
    ], MAINTENANT), []);
});

test('la vue s\'affiche dès l\'ouverture de l\'onglet et suit la vérification', () => {
    assert.match(SRC, /if \(t === 'updates'\) renderChronologie\(\);/);
    assert.match(SRC, /if \(f && u\.latest\?\.publishedAt\) \{ f\.latestAt = u\.latest\.publishedAt;/);
});
