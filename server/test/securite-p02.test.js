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

// ── SRC-02 / BUG-06 : la panne qui répond 200 ──
// Une source dont le site a changé de balisage ne lève AUCUNE erreur : elle
// analyse une page qu'elle ne comprend plus et rend une liste vide. Pour
// `health.track`, tout va bien. C'est ainsi que novelbin est restée « saine »
// côté serveur pendant que le job hebdomadaire la déclarait morte depuis
// quatre lundis — et que l'écran affichait « Modifiez les filtres ».
const sante = require('../lib/source-health');

test('source-health : une liste vide se compte à part (audit SRC-02)', () => {
    const id = 'source-de-test-vide';
    sante.recordVide(id);
    sante.recordVide(id);
    const h = sante.snapshot().find(x => x.id === id);
    assert.ok(h, 'la source doit apparaître dans l’instantané');
    assert.equal(h.vides, 2);
    assert.ok(h.videAt, 'la date du dernier vide doit être posée');
    // Ni succès ni échec : écraser le vide dans l’une des deux catégories est
    // exactement ce qui rendait la panne invisible.
    assert.equal(h.oks, 0, 'un vide n’est pas un succès');
    assert.equal(h.fails, 0, 'un vide n’est pas une erreur non plus');
    assert.equal(h.streak, 0, 'et il ne doit pas déclencher l’alarme des erreurs consécutives');
});

test('source-health : succès et vides coexistent sans se contredire', () => {
    const id = 'source-de-test-mixte';
    sante.recordOk(id);
    sante.recordVide(id);
    const h = sante.snapshot().find(x => x.id === id);
    assert.equal(h.oks, 1);
    assert.equal(h.vides, 1);
});

test('source-health : une erreur reste une erreur (aucune régression)', () => {
    const id = 'source-de-test-erreur';
    sante.recordFail(id, new Error('site injoignable'));
    sante.recordFail(id, new Error('site injoignable'));
    const h = sante.snapshot().find(x => x.id === id);
    assert.equal(h.fails, 2);
    assert.equal(h.streak, 2, 'les échecs CONSÉCUTIFS restent le signal d’une source cassée');
    assert.match(h.error, /injoignable/);
    sante.recordOk(id);
    const h2 = sante.snapshot().find(x => x.id === id);
    assert.equal(h2.streak, 0, 'un succès remet la série à zéro');
});

// ── BUG-13 : le limiteur ne doit pas brider l'app elle-même ──
// Relevé pendant l'audit : `429` sur 12 pages sur 20 en navigation NORMALE.
// Deux mécanismes distincts s'y cachaient, et il a fallu les séparer :
//   · le garde de 15 min entre deux scans de bibliothèque, qui répondait 429
//     — un code d'ERREUR pour un état parfaitement normal ;
//   · les limiteurs de relais, calibrés pour un client distant hostile et
//     appliqués tels quels à l'application installée.
const { plafond } = require('../middleware/security');

function req(ip, socketIp) {
    return { ip, socket: { remoteAddress: socketIp === undefined ? ip : socketIp }, headers: {} };
}

test('plafond : la boucle locale obtient un plafond relevé (audit BUG-13)', () => {
    const p = plafond(180);
    assert.equal(p(req('127.0.0.1')), 1800, 'l’app installée ne doit pas se brider elle-même');
    assert.equal(p(req('::1')), 1800);
});

test('plafond : un client distant garde le plafond de protection', () => {
    const p = plafond(180);
    assert.equal(p(req('192.168.1.34')), 180, 'un hub exposé reste protégé');
    assert.equal(p(req('203.0.113.9')), 180);
});

test('plafond : X-Forwarded-For ne donne pas droit au plafond haut', () => {
    // Sans cette exigence, il suffirait d’annoncer 127.0.0.1 pour obtenir dix
    // fois la limite — et le garde-fou anti-amplification tomberait.
    const p = plafond(180);
    assert.equal(p(req('127.0.0.1', '203.0.113.9')), 180, 'la socket trahit l’appelant');
    assert.equal(p(req('203.0.113.9', '127.0.0.1')), 180, 'reverse proxy local : req.ip fait foi');
});

test('plafond : le plafond n’est jamais SUPPRIMÉ, seulement relevé', () => {
    // Une boucle folle du logiciel doit encore rencontrer un mur : sans
    // plafond du tout, elle martèlerait un site tiers sans rien pour l’arrêter.
    const p = plafond(30);
    assert.ok(Number.isFinite(p(req('127.0.0.1'))));
    assert.ok(p(req('127.0.0.1')) > 0);
});
