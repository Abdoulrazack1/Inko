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

const { test, after } = require('node:test');
const assert = require('node:assert');
const { pool } = require('../config/db');
const identite = require('../lib/identite-hub');

// Chaque fichier de test tourne dans SON processus (`--test-concurrency=1`) :
// une connexion laissee ouverte empeche ce processus de se terminer, et la
// suite entiere reste suspendue sans jamais echouer. C'est le pire des modes
// de panne — on attend, on ne sait pas quoi.
after(async () => {
    try { await pool.end(); } catch (e) { /* deja fermee */ }
});

test('l’identité est créée une fois, puis ne bouge plus', async () => {
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

test('douze premiers démarrages simultanés ne produisent qu’une identité', async () => {
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

test('une base injoignable ne fait pas échouer /api/health', async () => {
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
