// ============================================================
// server/test/identite-hub.test.js — VIII.44 / P2.8
// ------------------------------------------------------------
// Le PC reçoit son adresse en DHCP. Au redémarrage de la box, `192.168.1.34`
// devient `192.168.1.52` — et l'appareil qui avait mémorisé cette adresse ne
// peut pas distinguer « mon hub a déménagé » de « une autre machine occupe son
// ancienne place ». Sur un Wi-Fi partagé, la seconde suffit à récupérer une
// bibliothèque entière.
//
// L'audit est explicite sur l'ordre des choses : « Sans le point 1, le point 2
// est dangereux » — le point 2 étant la découverte automatique par mDNS. Une
// découverte sans identité revient à faire confiance à la première machine qui
// annonce le bon service. L'identité doit donc exister d'abord.
//
// Ce qui se teste ici, c'est ce qui rend cette identité UTILISABLE : elle ne
// change jamais, et elle ne se dédouble pas.
'use strict';

// La base JETABLE, posée avant tout `require` de la configuration — c'est elle
// qui lit `DB_NAME` à son chargement, et `node --test` donne à ce fichier son
// propre processus.
//
// Sans cette ligne, ces tests visaient la base de DÉVELOPPEMENT. Ils passaient
// sur ma machine, où elle existe, et échouaient en intégration continue avec
// « Unknown database 'inko' » — le pire cas : vert par accident là où on
// regarde, rouge là où on ne regarde pas.
process.env.DB_NAME = 'inko_test';
process.env.NODE_ENV = 'test';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

let pool = null;
let identite = null;
let disponible = false;

before(async () => {
    try {
        const mysql = require('mysql2/promise');
        const admin = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            port: parseInt(process.env.DB_PORT || '3306', 10),
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            multipleStatements: true,
            connectTimeout: 2500,
        });
        // On ne SUPPRIME pas la base : un autre fichier de test la construit
        // peut-être en parallèle. `IF NOT EXISTS` suffit — ce qui compte ici
        // est que `app_settings` existe, ce dont les migrations se chargent.
        await admin.query('CREATE DATABASE IF NOT EXISTS inko_test '
            + 'CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        await admin.query('USE inko_test');
        await admin.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
        await admin.end();

        ({ pool } = require('../config/db'));
        await require('../db/migrate').ensureSchema();
        identite = require('../lib/identite-hub');
        disponible = true;
    } catch (e) {
        // Même règle que les autres suites d'intégration : en CI, une base
        // injoignable est un ÉCHEC et non un saut silencieux — sinon ces tests
        // seraient « verts par abstention ».
        if (process.env.REQUIRE_DB_TESTS === '1') {
            throw new Error('MySQL est requis pour ces tests (REQUIRE_DB_TESTS=1) : ' + e.message);
        }
        console.warn('[identite-hub] MySQL indisponible — tests sautés :', e.message);
    }
});

// Chaque fichier de test tourne dans SON processus (`--test-concurrency=1`) :
// une connexion laissee ouverte empeche ce processus de se terminer, et la
// suite entiere reste suspendue sans jamais echouer. C'est le pire des modes
// de panne — on attend, on ne sait pas quoi.
after(async () => {
    try { await pool.end(); } catch (e) { /* deja fermee */ }
});

test('l’identité est créée une fois, puis ne bouge plus', async (t) => {
    if (!disponible) return t.skip('MySQL indisponible');
    await pool.query('DELETE FROM app_settings WHERE k = ?', [identite.CLE]);
    identite._viderCache();

    const premier = await identite.hubId();
    assert.match(premier, /^[0-9a-f]{32}$/,
        '16 octets d’aléa cryptographique : un compteur ou un horodatage seraient '
        + 'devinables, et deux installations faites la même seconde pourraient collider.');

    // Une nouvelle lecture, cache vidé : c'est la base qui fait foi, pas la
    // mémoire du processus. Un identifiant qui changerait au redémarrage du
    // serveur déconnecterait tous les téléphones appairés d'un coup.
    identite._viderCache();
    assert.strictEqual(await identite.hubId(), premier);
});

test('douze premiers démarrages simultanés ne produisent qu’une identité', async (t) => {
    if (!disponible) return t.skip('MySQL indisponible');
    // Le vrai risque n'est pas théorique : au tout premier lancement, plusieurs
    // requêtes arrivent ensemble (la page d'accueil, le service worker, le
    // téléphone qui teste `/api/health`). Deux `INSERT` concurrents écriraient
    // deux valeurs, et la seconde écraserait la première — APRÈS qu'un appareil
    // ait pu mémoriser celle-ci. Il se retrouverait définitivement à refuser
    // son propre hub.
    await pool.query('DELETE FROM app_settings WHERE k = ?', [identite.CLE]);

    const rendus = await Promise.all(Array.from({ length: 12 }, () => {
        identite._viderCache();
        return identite.hubId();
    }));

    const [[ligne]] = await pool.query('SELECT v FROM app_settings WHERE k = ?', [identite.CLE]);
    const [[n]] = await pool.query('SELECT COUNT(*) AS c FROM app_settings WHERE k = ?', [identite.CLE]);

    assert.strictEqual(n.c, 1, 'une seule ligne en base');
    assert.strictEqual(new Set(rendus).size, 1, 'une seule identité rendue');
    assert.ok(rendus.every(v => v === ligne.v),
        'tous les appelants doivent recevoir la valeur RÉELLEMENT en base, pas celle '
        + 'qu’ils ont tirée — c’est le premier écrivain qui gagne.');
});

test('une base injoignable ne fait pas échouer /api/health', async (t) => {
    if (!disponible) return t.skip('MySQL indisponible');
    // `/api/health` sert précisément à DIRE que la base est tombée. S'il
    // échouait faute d'identité, il ne dirait plus rien du tout, et le
    // téléphone conclurait à un hub absent alors qu'il répond.
    identite._viderCache();
    const vraiQuery = pool.query;
    pool.query = () => Promise.reject(new Error('base injoignable'));
    try {
        assert.strictEqual(await identite.hubId(), null);
    } finally {
        pool.query = vraiQuery;
        identite._viderCache();
    }
});
