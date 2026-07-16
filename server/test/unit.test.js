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
