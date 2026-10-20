// Mesures de santé d'une source : latence médiane et taux d'échec, calculés
// sur les dernières requêtes réelles (le journal de source-health.js).
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const health = require('../lib/source-health');

test('latence médiane des succès et part des échecs, sur le journal', async () => {
    const id = 'mesure-' + Date.now();
    const attendre = (ms) => new Promise(r => setTimeout(r, ms));
    for (const ms of [20, 60, 40]) await health.track(id, async () => { await attendre(ms); return {}; });
    await assert.rejects(health.track(id, async () => { throw new Error('timeout'); }));
    const m = health.mesures(id);
    assert.equal(m.requetes, 4);
    assert.equal(m.tauxEchec, 25);
    assert.ok(m.latenceMs >= 38 && m.latenceMs < 120, `médiane ≈ 40 ms, mesuré ${m.latenceMs}`);
    const snap = health.snapshot().find(h => h.id === id);
    assert.deepStrictEqual([snap.requetes, snap.tauxEchec], [4, 25], 'l’instantané les expose');
});

test('une source jamais appelée n’a pas de mesure inventée', () => {
    assert.deepStrictEqual(health.mesures('jamais-vue'), { requetes: 0, latenceMs: null, tauxEchec: null });
});

test('le test de connexion rend sa durée', async () => {
    const r = await health.test({ id: 'test-ms', capabilities: ['popular'], popular: async () => ({ results: [1] }) });
    assert.ok(Number.isFinite(r.ms) && r.ms >= 0);
    assert.equal(r.count, 1);
});
