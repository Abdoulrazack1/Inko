// test/image-redirections.test.js — SEC-18 : chaque redirection est revérifiée.
// `curl -L` suivait les sauts sans repasser par la liste blanche ni par la
// vérification d'adresse : un hôte autorisé qui redirige vers les métadonnées
// d'un hébergeur ou le réseau interne emmenait le relais d'images où il voulait.
'use strict';
process.env.IMG_DISK_CACHE = '0';
process.env.NODE_ENV = 'test';

const { test, beforeEach } = require('node:test');
const assert = require('node:assert');
const childProcess = require('child_process');
const dns = require('dns');

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]), Buffer.alloc(120, 1)]);
const MARQUE = '\n@@INKO-PROXY@@';
let reponses = [];
let appels = [];
let derniersArgs = null;
childProcess.execFile = (cmd, args, opts, cb) => {
    appels.push(args[args.length - 1]);
    derniersArgs = args;
    const [corps, code, vers] = reponses.shift() || [PNG, 200, ''];
    cb(null, Buffer.concat([corps, Buffer.from(`${MARQUE}${code} ${vers}`)]));
};
const ADRESSES = { 'uploads.mangadex.org': '93.184.216.34', 'cdn.mangadex.org': '93.184.216.35', 'piege.mangadex.org': '169.254.169.254' };
dns.promises.lookup = async (h) => [{ address: ADRESSES[h] || '93.184.216.40', family: 4 }];

const { proxy } = require('../controllers/image.controller');
async function appeler(url) {
    const r = { statut: 200, entetes: {}, corps: null };
    r.status = (s) => { r.statut = s; return r; };
    r.set = (k, v) => { r.entetes[k] = v; return r; };
    r.end = (b) => { r.corps = b ?? null; return r; };
    await proxy({ query: { u: url } }, r);
    return r;
}
beforeEach(() => { reponses = []; appels = []; });

test('SEC-18 : curl ne suit plus les redirections lui-même', async () => {
    await appeler('https://uploads.mangadex.org/covers/a1.png');
    const args = derniersArgs;
    assert.ok(args, 'curl appelé');
    assert.ok(!args.includes('-L') && !args.includes('--location'), 'le suivi automatique des redirections est retiré');
});

test('SEC-18 : une redirection vers une adresse interne est refusée, sans la contacter', async () => {
    reponses = [[Buffer.alloc(0), 302, 'https://piege.mangadex.org/latest/meta-data']];
    const r = await appeler('https://uploads.mangadex.org/covers/a2.png');
    assert.notStrictEqual(r.statut, 200);
    assert.deepStrictEqual(appels, ['https://uploads.mangadex.org/covers/a2.png'], 'le second saut ne doit jamais partir');
});

test('SEC-18 : une redirection hors liste blanche est refusée', async () => {
    reponses = [[Buffer.alloc(0), 301, 'https://ailleurs.exemple.test/a.png']];
    const r = await appeler('https://uploads.mangadex.org/covers/a3.png');
    assert.notStrictEqual(r.statut, 200);
    assert.strictEqual(appels.length, 1);
});

test('SEC-18 : une redirection légitime est suivie, et l’image servie', async () => {
    reponses = [[Buffer.alloc(0), 302, 'https://cdn.mangadex.org/covers/a4.png'], [PNG, 200, '']];
    const r = await appeler('https://uploads.mangadex.org/covers/a4.png');
    assert.strictEqual(r.statut, 200);
    assert.deepStrictEqual(appels, ['https://uploads.mangadex.org/covers/a4.png', 'https://cdn.mangadex.org/covers/a4.png']);
});

test('SEC-18 : au-delà de quatre sauts, on abandonne', async () => {
    reponses = Array.from({ length: 6 }, (_, i) => [Buffer.alloc(0), 302, `https://cdn.mangadex.org/boucle-${i}.png`]);
    const r = await appeler('https://uploads.mangadex.org/covers/a5.png');
    assert.notStrictEqual(r.statut, 200);
    assert.strictEqual(appels.length, 5);
});
