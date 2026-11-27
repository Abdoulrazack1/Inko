// SEC-29 : les requêtes AniList publiques passent par le serveur, qui n'en
// relaie que trois, fixées par nom. Ces cas ne touchent pas le réseau.
'use strict';
const test = require('node:test');
const assert = require('node:assert');

const A = require('../controllers/anilist.controller');

function appeler(nom, query) {
    return new Promise((resolve, reject) => {
        const res = {
            statut: 200,
            status(c) { this.statut = c; return this; },
            json(b) { resolve({ statut: this.statut, corps: b }); },
            set() { return this; },
        };
        A.publique({ params: { nom }, query }, res, reject);
    });
}

test('une requête inconnue est refusée : le client ne fournit jamais de GraphQL', async () => {
    const r = await appeler('Viewer', { query: 'query { Viewer { id } }' });
    assert.strictEqual(r.statut, 404);
});

test('les paramètres sont bornés et validés', async () => {
    assert.strictEqual((await appeler('note', { id: 'abc' })).statut, 400);
    assert.strictEqual((await appeler('fiche', { id: '-3' })).statut, 400);
    assert.strictEqual((await appeler('recherche', {})).statut, 400);
    const P = A._internes.PUBLIQUES;
    assert.strictEqual(P.recherche.variables({ s: 'x'.repeat(5000) }).s.length, 200);
    assert.deepStrictEqual(P.note.variables({ id: '42', autre: 'ignoré' }), { id: 42 });
});

test('les trois requêtes relayées ne demandent rien de personnel', () => {
    for (const [nom, def] of Object.entries(A._internes.PUBLIQUES)) {
        assert.ok(!/Viewer|MediaList|mediaListEntry|User\b/.test(def.query), nom + ' : requête publique seulement');
    }
});
