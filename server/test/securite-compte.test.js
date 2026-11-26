// test/securite-compte.test.js — failles de compte relevées par l'audit du 26/11
// (SEC-14, SEC-27, SEC-30, SEC-31, SEC-32). Chacune a été rejouée sur un serveur
// d'essai avant correction ; ces tests en gardent le comportement attendu.
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const os = require('os');
const { estLocale, hoteAdmis } = require('../lib/reseau');
const { ecritureDeLApplication } = require('../middleware/security');
const { pasDepuisUnAppareil } = require('../middleware/admin');

const req = (headers = {}, ip = '127.0.0.1') => ({ ip, socket: { remoteAddress: ip }, headers });
const reponse = () => ({ statusCode: null, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } });

// ── SEC-30 : un relais sur la même machine ne rend pas la requête locale ──
test('SEC-30 : une requête relayée par un programme local n’est pas locale', () => {
    const avant = process.env.TRUST_PROXY; delete process.env.TRUST_PROXY;
    try {
        assert.equal(estLocale(req()), true, 'la machine elle-même reste locale');
        for (const h of ['x-forwarded-for', 'forwarded', 'x-real-ip', 'x-forwarded-host']) {
            assert.equal(estLocale(req({ [h]: '203.0.113.9' })), false, `${h} : un client du relais devenait administrateur`);
        }
    } finally { if (avant !== undefined) process.env.TRUST_PROXY = avant; }
});

test('SEC-30 : avec TRUST_PROXY, c’est l’adresse du client réel qui décide', () => {
    const avant = process.env.TRUST_PROXY; process.env.TRUST_PROXY = '1';
    try {
        const r = req({ 'x-forwarded-for': '203.0.113.9' }); r.ip = '203.0.113.9';
        assert.equal(estLocale(r), false);
    } finally { if (avant === undefined) delete process.env.TRUST_PROXY; else process.env.TRUST_PROXY = avant; }
});

// ── SEC-31 : noms d'hôte ──
test('SEC-31 : adresses, localhost et nom de la machine sont admis', () => {
    for (const h of ['127.0.0.1:8088', '[::1]:8088', '192.168.1.34:8088', 'localhost:8088', 'tauri.localhost', os.hostname(), os.hostname() + '.local:8088', '']) {
        assert.equal(hoteAdmis(h), true, h);
    }
});

test('SEC-31 : un domaine redirigé vers la machine est refusé, sauf s’il est déclaré', () => {
    assert.equal(hoteAdmis('piege.exemple.test:8088'), false);
    const avant = process.env.INKO_HOTES; process.env.INKO_HOTES = 'inko.maison.test';
    try { assert.equal(hoteAdmis('inko.maison.test:8088'), true); }
    finally { if (avant === undefined) delete process.env.INKO_HOTES; else process.env.INKO_HOTES = avant; }
});

// ── SEC-32 : écritures par cookie ──
test('SEC-32 : un formulaire venu d’un autre port est refusé', () => {
    assert.equal(ecritureDeLApplication(req({ host: '127.0.0.1:8088', origin: 'http://127.0.0.1:8162', 'content-type': 'application/x-www-form-urlencoded' })), false);
    assert.equal(ecritureDeLApplication(req({ host: '127.0.0.1:8088', origin: 'http://localhost:3000' })), false, 'la boucle locale à un autre port ne suffit pas');
});

test('SEC-32 : l’application, la webview et le téléphone passent', () => {
    assert.equal(ecritureDeLApplication(req({ host: '127.0.0.1:8088', origin: 'http://127.0.0.1:8088' })), true);
    assert.equal(ecritureDeLApplication(req({ host: '127.0.0.1:8088', origin: 'http://tauri.localhost' })), true);
    assert.equal(ecritureDeLApplication(req({ host: '192.168.1.34:8088', origin: 'http://localhost' })), true);
});

test('SEC-32 : sans Origin, seul un corps JSON passe', () => {
    assert.equal(ecritureDeLApplication(req({ 'content-type': 'application/json; charset=utf-8' })), true);
    assert.equal(ecritureDeLApplication(req({ 'content-type': 'text/plain' })), false);
    assert.equal(ecritureDeLApplication(req({})), false);
});

// ── SEC-27 : un téléphone appairé ──
test('SEC-27 : un téléphone appairé n’émet pas de code d’appairage', () => {
    const r = reponse(); let suite = false;
    pasDepuisUnAppareil({ deviceId: 4 }, r, () => { suite = true; });
    assert.equal(suite, false); assert.equal(r.statusCode, 403);
    let suite2 = false;
    pasDepuisUnAppareil({}, reponse(), () => { suite2 = true; });
    assert.equal(suite2, true, 'l’ordinateur garde la main');
});
