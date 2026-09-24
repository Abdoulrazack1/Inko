// Ordonnanceur par source : concurrence bornée, priorités, frein sur 429.
const test = require('node:test');
const assert = require('node:assert');
const o = require('../lib/ordonnanceur');

const attendre = (ms) => new Promise(r => setTimeout(r, ms));

test('ne dépasse jamais la concurrence par source', async () => {
    let actifs = 0, pic = 0;
    const tache = async () => { actifs++; pic = Math.max(pic, actifs); await attendre(20); actifs--; };
    await Promise.all(Array.from({ length: 12 }, () => o.planifier('conc', 'normale', tache)));
    assert.ok(pic <= o.CONCURRENCE, `pic ${pic} > ${o.CONCURRENCE}`);
});

test('une requête haute passe devant les tâches de fond en attente', async () => {
    const ordre = [];
    const lente = () => attendre(30);
    // On occupe toutes les places, puis on empile du fond et une requête haute.
    const occupe = Array.from({ length: o.CONCURRENCE }, () => o.planifier('prio', 'normale', lente));
    const fond = Array.from({ length: 3 }, (_, i) => o.planifier('prio', 'basse', async () => { ordre.push('fond' + i); }));
    const haute = o.planifier('prio', 'haute', async () => { ordre.push('haute'); });
    await Promise.all([...occupe, ...fond, haute]);
    assert.strictEqual(ordre[0], 'haute');
});

test('un 429 met la source en pause puis espace les appels', async () => {
    await assert.rejects(o.planifier('lim', 'normale', async () => {
        throw new Error('Source momentanement limitee - reessaie dans un instant');
    }));
    assert.ok(o.etat().lim.espacementMs >= 400, 'espacement posé après le 429');
    // L'appel suivant n'a pas lieu avant la fin de la pause.
    const t0 = Date.now();
    await o.planifier('lim', 'haute', async () => 1);
    assert.ok(Date.now() - t0 >= 2500, 'la pause a été respectée');
});

test('une erreur ordinaire ne freine pas la source', async () => {
    await assert.rejects(o.planifier('ok', 'normale', async () => { throw new Error('Site source indisponible (HTTP 404)'); }));
    assert.strictEqual(o.etat().ok.espacementMs, 0);
});

test('blocage durable : les tâches non urgentes échouent vite, la haute attend', async () => {
    const lim = () => { throw new Error('Source momentanement limitee'); };
    // Trois refus d'affilée : pause 3 s, 6 s, puis 12 s (> seuil de 10 s).
    for (let i = 0; i < 3; i++) await assert.rejects(o.planifier('sat', 'haute', async () => lim()));
    const t0 = Date.now();
    await assert.rejects(o.planifier('sat', 'normale', async () => 1), /saturée/);
    assert.ok(Date.now() - t0 < 200, 'échec immédiat, pas d\'attente');
});

test('une tâche patiente n\'est pas abandonnée pendant un blocage', async () => {
    const lim = () => { throw new Error('Source momentanement limitee'); };
    for (let i = 0; i < 3; i++) await assert.rejects(o.planifier('pat', 'haute', async () => lim()));
    const t0 = Date.now();
    const v = await o.planifier('pat', 'normale', async () => 'ok', { patient: true });
    assert.strictEqual(v, 'ok');
    assert.ok(Date.now() - t0 > 5000, 'elle a attendu la fin de la pause');
});
