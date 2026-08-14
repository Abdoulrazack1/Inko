// ============================================================
// server/test/securite-p02.test.js — les garde-fous de la phase P0.2
// ------------------------------------------------------------
// Ces trois correctifs partagent un trait : ils ne se voient PAS. Rien ne
// change à l'écran, et une régression ne casse aucun parcours — elle rouvre
// simplement la porte, en silence. C'est exactement ce qu'un test doit tenir.
//
//   · SEC-01 — `POST /api/auth/local` rendait un jeton ADMIN à qui atteignait
//     le port, sans mot de passe ni limite de débit. Vérifié pendant l'audit
//     depuis l'adresse réseau de la machine : 201 et jeton en main.
//   · SEC-02 — le secret JWT retombait sur une constante lisible dans le
//     dépôt, identique sur TOUTES les installations desktop.
//   · SEC-04 — la sauvegarde quotidienne (email + bibliothèque de tous les
//     comptes) restait en clair tant que personne ne posait de passphrase,
//     c'est-à-dire toujours, en desktop.
//
// Ces tests vivent dans `server/test/` et NON dans `test/unit/`, malgré le
// nom du second. Les deux dossiers sont couverts par deux jobs différents :
//
//   · `test/unit/` → job `frontend-lint`, qui fait `npm install` à la RACINE
//     seulement. `server/node_modules` n'y existe pas : requérir un module du
//     serveur y échoue en MODULE_NOT_FOUND.
//   · `server/test/` → job `backend`, qui installe les dépendances du serveur
//     et démarre un MySQL. C'est le seul endroit où ces tests peuvent tourner.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Réponse express minimale : on veut le code et le corps, rien d'autre.
function fakeRes() {
    return {
        statusCode: null,
        body: null,
        status(c) { this.statusCode = c; return this; },
        json(b) { this.body = b; return this; },
    };
}

// ── SEC-01 : le mode local ne sort pas de la machine ─────────
// `POST /auth/local` rendait un jeton ADMIN à qui atteignait le port, sans
// authentification ni limitation de débit — vérifié pendant l'audit depuis
// l'adresse réseau de la machine, pas la boucle locale. Le mode « sans écran
// de connexion » reste, mais il ne franchit plus la machine.
const { localOnly } = require('../middleware/auth');

function fauxReq(ip, socketIp) {
    return { ip, socket: { remoteAddress: socketIp === undefined ? ip : socketIp }, headers: {} };
}

for (const ip of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
    test(`localOnly : ${ip} passe`, () => {
        const res = fakeRes(); let suite = false;
        localOnly(fauxReq(ip), res, () => { suite = true; });
        assert.equal(suite, true);
        assert.equal(res.statusCode, null);
    });
}

for (const ip of ['192.168.1.34', '10.0.0.5', '::ffff:192.168.1.34', '2001:db8::1']) {
    test(`localOnly : ${ip} est refusé (403)`, () => {
        const res = fakeRes(); let suite = false;
        localOnly(fauxReq(ip), res, () => { suite = true; });
        assert.equal(suite, false);
        assert.equal(res.statusCode, 403);
        assert.equal(res.body.code, 'LOCAL_ONLY');
    });
}

test('localOnly : une adresse locale sur UN seul des deux champs ne suffit pas', () => {
    // Avec TRUST_PROXY, `req.ip` vient de `X-Forwarded-For` — que l'appelant
    // écrit. Un client distant qui annonce 127.0.0.1 doit rester dehors.
    const res = fakeRes(); let suite = false;
    localOnly(fauxReq('127.0.0.1', '192.168.1.34'), res, () => { suite = true; });
    assert.equal(suite, false, 'X-Forwarded-For usurpé : la socket trahit l’appelant');
    assert.equal(res.statusCode, 403);

    // Symétrique : derrière un reverse proxy local, la socket vaut toujours
    // 127.0.0.1. C'est `req.ip` qui porte alors le vrai client.
    const res2 = fakeRes(); let suite2 = false;
    localOnly(fauxReq('203.0.113.9', '127.0.0.1'), res2, () => { suite2 = true; });
    assert.equal(suite2, false, 'reverse proxy local : la socket ne prouve rien');
    assert.equal(res2.statusCode, 403);
});

test('localOnly : INKO_LOCAL_ANY_HOST=1 rouvre explicitement', () => {
    const avant = process.env.INKO_LOCAL_ANY_HOST;
    process.env.INKO_LOCAL_ANY_HOST = '1';
    const res = fakeRes(); let suite = false;
    localOnly(fauxReq('192.168.1.34'), res, () => { suite = true; });
    if (avant === undefined) delete process.env.INKO_LOCAL_ANY_HOST; else process.env.INKO_LOCAL_ANY_HOST = avant;
    assert.equal(suite, true);
});

// ── SEC-02 / SEC-04 : des secrets propres à l'installation ───
const secretsLocaux = require('../lib/secrets-locaux');

test('secrets-locaux : le secret est stable entre deux appels', () => {
    const a = secretsLocaux.obtenir('test-jeton-unitaire', 16);
    const b = secretsLocaux.obtenir('test-jeton-unitaire', 16);
    assert.equal(typeof a, 'string');
    assert.ok(a.length >= 32, 'un secret trop court ne vaut rien');
    assert.equal(a, b, 'régénérer à chaque appel invaliderait toutes les sessions');
    // Nettoyage : ce fichier n'a rien à faire dans le profil de l'utilisateur.
    try {
        fs.unlinkSync(path.join(secretsLocaux.dossier(), 'test-jeton-unitaire.json'));
    } catch (e) { /* déjà absent */ }
});

test('couverture : le proxy n’est jamais stocké', () => {
    const { brute } = require('../lib/couverture');
    const source = 'https://temp.compsci88.com/cover/normal/01J76.webp';
    assert.equal(brute(`http://127.0.0.1:8088/api/img?u=${encodeURIComponent(source)}`), source);
    assert.equal(brute(`/api/img?u=${encodeURIComponent(source)}`), source);
    assert.equal(brute(source), source, 'une URL déjà propre passe telle quelle');
    assert.equal(brute(null), null);
    assert.equal(brute(''), null);
});

// SEC-04 se prouve mal en process : `lib/backup.js` fige sa passphrase au
// chargement, et `require` met le module en cache. On interroge donc un
// processus neuf par cas — c'est aussi ce que fait le sidecar au démarrage.
function chiffrementActif(env) {
    const r = require('child_process').execFileSync(process.execPath,
        ['-e', "const b=require('./lib/backup.js');process.stdout.write(String(b.chiffrementActif()));process.exit(0);"],
        {
            cwd: path.join(__dirname, '..'),
            env: { ...process.env, APP_VERSION: '', BACKUP_PASSPHRASE: '', ...env },
            encoding: 'utf8',
            timeout: 30_000,
        });
    return r.trim().endsWith('true');
}

test('SEC-04 : une installation desktop chiffre ses sauvegardes sans rien configurer', () => {
    // C'est TOUT l'enjeu : le dump contient l'email et la bibliothèque de
    // chaque compte. Personne ne pose jamais BACKUP_PASSPHRASE à la main.
    assert.equal(chiffrementActif({ APP_VERSION: 'test-sec04' }), true);
});

test('SEC-04 : une passphrase explicite reste prioritaire', () => {
    assert.equal(chiffrementActif({ BACKUP_PASSPHRASE: 'phrase-choisie-par-l-admin' }), true);
});

test('SEC-04 : hors desktop et sans passphrase, le comportement serveur ne change pas', () => {
    // Un administrateur qui n'a rien demandé garde ses dumps lisibles : les
    // chiffrer d'office rendrait irrécupérables ceux qu'il restaure déjà.
    assert.equal(chiffrementActif({}), false);
});

// Même contrainte que ci-dessus : `lib/secret.js` résout au chargement.
function secretResolu(env) {
    return require('child_process').execFileSync(process.execPath,
        ['-e', "process.stdout.write(require('./lib/secret.js'));"],
        {
            cwd: path.join(__dirname, '..'),
            env: { ...process.env, APP_VERSION: '', JWT_SECRET: '', NODE_ENV: 'development', ...env },
            encoding: 'utf8',
            timeout: 30_000,
        }).trim();
}

test('SEC-02 : le desktop n’utilise plus le secret codé en dur', () => {
    const s = secretResolu({ APP_VERSION: 'test-sec02' });
    assert.notEqual(s, 'inko-dev-secret-change-me',
        'ce secret est lisible dans le dépôt : un jeton s’y forge hors ligne');
    assert.ok(!/change-me/i.test(s), `secret encore au placeholder : ${s.slice(0, 24)}…`);
    assert.ok(s.length >= 64, `secret trop court (${s.length})`);
    // Et il ne bouge pas : un secret régénéré déconnecterait l'utilisateur
    // à chaque démarrage, sans qu'il comprenne pourquoi.
    assert.equal(s, secretResolu({ APP_VERSION: 'test-sec02' }));
});

test('SEC-02 : un JWT_SECRET fourni garde la priorité', () => {
    const impose = 'a'.repeat(64);
    assert.equal(secretResolu({ APP_VERSION: 'test-sec02', JWT_SECRET: impose }), impose);
});
