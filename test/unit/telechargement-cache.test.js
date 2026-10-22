// ============================================================
// test/unit/telechargement-cache.test.js — un téléchargement demande
// d'abord au hub s'il a déjà la planche
// ------------------------------------------------------------
// Le direct reste la voie par défaut (voir `corsRefuse` dans downloads.js :
// le volume ne doit pas transiter par le hub). Mais une planche déjà lue est
// en cache sur le hub : la redemander à la source coûtait 4 à 20 s et
// exposait l'adresse de l'utilisateur, pour un octet qu'on avait déjà.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'downloads.js'), 'utf8').replace(/\r\n/g, '\n');

function fetchPage(reponses, base = '/api') {
    const i = SRC.indexOf('async function fetchPage(url) {');
    assert.notEqual(i, -1);
    const corps = SRC.slice(i, SRC.indexOf('\n            }\n', i) + 14);
    const appels = [];
    const fetch = async (u) => { appels.push(u); const r = reponses(u); if (r instanceof Error) throw r; return r; };
    // eslint-disable-next-line no-new-func
    const f = new Function('fetch', 'base', 'corsRefuse', 'origineDe', 'location', `${corps}; return fetchPage;`)(
        fetch, base, new Set(), (u) => new URL(u).origin, { href: 'http://localhost/' });
    return { f, appels };
}

const ok = { ok: true, status: 200 };
const absent = { ok: false, status: 404 };

test('planche en cache sur le hub : servie par lui, la source n\'est pas contactée', async () => {
    const { f, appels } = fetchPage((u) => (u.includes('cache=seul') ? ok : new Error('ne devrait pas partir')));
    assert.equal(await f('https://cdn.test/p1.png'), ok);
    assert.equal(appels.length, 1);
    assert.match(appels[0], /^\/api\/img\?u=https%3A%2F%2Fcdn\.test%2Fp1\.png&cache=seul$/);
});

test('absente du cache : le chemin habituel (direct d\'abord) reprend', async () => {
    const { f, appels } = fetchPage((u) => (u.includes('cache=seul') ? absent : ok));
    assert.equal(await f('https://cdn.test/p1.png'), ok);
    assert.deepStrictEqual(appels, ['/api/img?u=https%3A%2F%2Fcdn.test%2Fp1.png&cache=seul', 'https://cdn.test/p1.png']);
});

test('sans hub (téléphone autonome) : aucune sonde, direct seulement', async () => {
    const { f, appels } = fetchPage(() => ok, '');
    await f('https://cdn.test/p1.png');
    assert.deepStrictEqual(appels, ['https://cdn.test/p1.png']);
});

test('hub injoignable : la sonde échoue sans bloquer le direct', async () => {
    const { f } = fetchPage((u) => (u.includes('cache=seul') ? new Error('hub coupé') : ok));
    assert.equal(await f('https://cdn.test/p1.png'), ok);
});
