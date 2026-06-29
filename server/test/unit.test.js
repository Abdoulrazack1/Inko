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
