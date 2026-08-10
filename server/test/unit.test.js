// test/unit.test.js — tests unitaires des fonctions pures (sans DB, CI-safe)
// Lancé par `npm test` (node --test). Adresse le « 0 test » de l'audit.
const { test } = require('node:test');
const assert = require('node:assert');

const { validateSource } = require('../lib/source-interface');
const { encrypt, decrypt } = require('../lib/crypto');
const { parseMentions } = require('../lib/notify');

test('validateSource : rejette un objet vide', () => {
    const r = validateSource({});
    assert.equal(r.ok, false);
    assert.ok(r.errors.length > 0);
});

test('validateSource : accepte une source manga minimale valide', () => {
    const src = {
        id: 'x', name: 'X', version: '1.0.0', type: 'manga',
        popular() {}, latest() {}, search() {}, getManga() {}, getChapters() {}, getPages() {},
    };
    assert.equal(validateSource(src).ok, true);
});

test('validateSource : une source novel exige getText()', () => {
    const base = {
        id: 'n', name: 'N', version: '1.0.0', type: 'novel',
        popular() {}, latest() {}, search() {}, getManga() {}, getChapters() {},
    };
    assert.equal(validateSource(base).ok, false);                    // getText manquant
    assert.equal(validateSource({ ...base, getText() {} }).ok, true);
});

test('crypto : encrypt/decrypt fait un aller-retour', () => {
    const enc = encrypt('mon-token-secret');
    assert.ok(enc.startsWith('enc:v1:'));
    assert.equal(decrypt(enc), 'mon-token-secret');
});

test('crypto : decrypt laisse passer le texte clair hérité', () => {
    assert.equal(decrypt('ancien-token-en-clair'), 'ancien-token-en-clair');
    assert.equal(decrypt(null), null);
});

test('parseMentions : extrait les @username uniques', () => {
    assert.deepEqual(parseMentions('salut @kaito et @luna, re @kaito'), ['kaito', 'luna']);
    assert.deepEqual(parseMentions('aucune mention ici'), []);
    assert.deepEqual(parseMentions('@a trop court'), []); // < 2 caractères
});

// ── Chemins sensibles (audit v3 F.14 : zones ex-failles de sécurité) ──
const { adminRequired } = require('../middleware/admin');

function fakeRes() {
    const res = { statusCode: null, body: null };
    res.status = (c) => { res.statusCode = c; return res; };
    res.json = (b) => { res.body = b; return res; };
    return res;
}

test('adminRequired : 403 sans utilisateur', () => {
    const res = fakeRes(); let passed = false;
    adminRequired({ user: null }, res, () => { passed = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(passed, false);
});

test('adminRequired : 403 pour un simple utilisateur', () => {
    const res = fakeRes(); let passed = false;
    adminRequired({ user: { id: 2, role: 'user' } }, res, () => { passed = true; });
    assert.equal(res.statusCode, 403);
    assert.equal(passed, false);
});

test('adminRequired : 403 même avec un role approchant (pas de laxisme)', () => {
    const res = fakeRes(); let passed = false;
    adminRequired({ user: { id: 3, role: 'Admin' } }, res, () => { passed = true; }); // casse différente
    assert.equal(res.statusCode, 403);
    assert.equal(passed, false);
});

test('adminRequired : laisse passer un admin', () => {
    const res = fakeRes(); let passed = false;
    adminRequired({ user: { id: 1, role: 'admin' } }, res, () => { passed = true; });
    assert.equal(passed, true);
    assert.equal(res.statusCode, null);
});

// ── CORS : l'app desktop doit pouvoir parler a son propre serveur ──
// L'ecran de demarrage de l'app est servi par la webview, donc depuis
// `tauri://localhost` : vis-a-vis du serveur embarque c'est une origine
// tierce. SEC-09 a ferme le mode permissif cote desktop pour empecher
// n'importe quelle page web d'interroger 127.0.0.1:8088 — et a ferme du meme
// coup le demarrage de l'app, qui affichait « Impossible de demarrer » apres
// 150 s pendant que le serveur repondait 200.
//
// Ce defaut ne pouvait etre attrape ni par les tests e2e (qui visent le
// serveur web, en same-origin) ni par les tests d'API (sans en-tete Origin) :
// il ne se voit qu'ici, sur la decision elle-meme.
function decisionCors(origin, env = {}) {
    const sauvegarde = { ...process.env };
    Object.assign(process.env, env);
    // Le module lit son environnement au chargement.
    delete require.cache[require.resolve('../middleware/security')];
    const { corsOptions } = require('../middleware/security');
    let autorise = null;
    corsOptions().origin(origin, (_e, ok) => { autorise = ok; });
    for (const k of Object.keys(process.env)) if (!(k in sauvegarde)) delete process.env[k];
    Object.assign(process.env, sauvegarde);
    delete require.cache[require.resolve('../middleware/security')];
    return autorise;
}

for (const origine of ['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost']) {
    test(`CORS : la webview desktop (${origine}) est autorisee`, () => {
        assert.equal(decisionCors(origine, { APP_VERSION: '9.9.9' }), true);
    });
}

test('CORS : un site tiers reste refuse en desktop (SEC-09 intact)', () => {
    assert.equal(decisionCors('https://exemple-malveillant.test', { APP_VERSION: '9.9.9' }), false);
});

test('CORS : une origine qui imite la webview sans en etre une est refusee', () => {
    // `https://tauri.localhost.exemple.test` contient la bonne sous-chaine :
    // une comparaison laxiste l'accepterait.
    assert.equal(decisionCors('https://tauri.localhost.exemple.test', { APP_VERSION: '9.9.9' }), false);
});

test('CORS : sans Origin (app native, curl, same-origin) on laisse passer', () => {
    assert.equal(decisionCors(undefined, { APP_VERSION: '9.9.9' }), true);
});

test('CORS : une liste blanche explicite reste prioritaire pour les autres', () => {
    assert.equal(decisionCors('https://inko.exemple.test', {
        APP_VERSION: '9.9.9', CORS_ORIGINS: 'https://inko.exemple.test',
    }), true);
    assert.equal(decisionCors('https://autre.exemple.test', {
        APP_VERSION: '9.9.9', CORS_ORIGINS: 'https://inko.exemple.test',
    }), false);
});
