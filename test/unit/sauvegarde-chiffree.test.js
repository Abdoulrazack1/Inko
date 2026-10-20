// ============================================================
// test/unit/sauvegarde-chiffree.test.js — un fichier, une phrase de passe
// ------------------------------------------------------------
// Vérifié de bout en bout (Chromium, serveur et MySQL réels, 495 favoris) :
// phrase de 6 caractères refusée ; fichier exporté = enveloppe { format,
// version, creeLe, kdf, chiffrement, donnees } où aucun titre n'apparaît en
// clair ; mauvaise phrase → rien n'est importé ; bonne phrase → l'import
// envoyé est l'export, à l'horodatage près.
// Ici, le vrai module chiffre et déchiffre avec le WebCrypto de Node.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const contexte = { crypto: globalThis.crypto, TextEncoder, TextDecoder, btoa, atob, Uint8Array, JSON, Error, Date, String };
contexte.globalThis = contexte;
// eslint-disable-next-line no-new-func
new Function('globalThis', 'document', fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'sauvegarde-chiffree.js'), 'utf8'))(contexte, undefined);
const { chiffrer, dechiffrer, estChiffree } = contexte.MH.sauvegardeChiffree;

const DONNEES = { favorites: [{ mangaId: 'b1', title: 'Berserk — mon avis très personnel' }], progress: { b1: { chapter: 364 } } };

test('aller-retour : ce qu\'on chiffre est exactement ce qu\'on retrouve', async () => {
    const env = await chiffrer(DONNEES, 'le chat dort sur la planche');
    assert.ok(estChiffree(env));
    assert.deepStrictEqual(await dechiffrer(env, 'le chat dort sur la planche'), DONNEES);
});

test('rien n\'est lisible dans le fichier, et deux exports diffèrent (sel et vecteur aléatoires)', async () => {
    const a = await chiffrer(DONNEES, 'le chat dort sur la planche');
    const b = await chiffrer(DONNEES, 'le chat dort sur la planche');
    assert.ok(!JSON.stringify(a).includes('Berserk'));
    assert.notEqual(a.donnees, b.donnees);
    assert.notEqual(a.kdf.sel, b.kdf.sel);
    assert.deepStrictEqual([a.kdf.nom, a.kdf.iterations, a.chiffrement.nom], ['PBKDF2-SHA-256', 310000, 'AES-GCM-256']);
});

test('mauvaise phrase ou fichier altéré : refus, jamais de données corrompues', async () => {
    const env = await chiffrer(DONNEES, 'le chat dort sur la planche');
    await assert.rejects(dechiffrer(env, 'le chien dort'), /Phrase de passe incorrecte, ou fichier abîmé/);
    const abime = { ...env, donnees: env.donnees.slice(0, -6) + 'AAAAAA' };
    await assert.rejects(dechiffrer(abime, 'le chat dort sur la planche'), /Phrase de passe incorrecte/);
});

test('phrase trop courte, fichier ordinaire, version inconnue : messages clairs', async () => {
    await assert.rejects(chiffrer(DONNEES, 'court'), /au moins 8 caractères/);
    await assert.rejects(dechiffrer({ favorites: [] }, 'x'), /pas une sauvegarde chiffrée/);
    const env = await chiffrer(DONNEES, 'le chat dort sur la planche');
    await assert.rejects(dechiffrer({ ...env, version: 9 }, 'le chat dort sur la planche'), /Version de sauvegarde inconnue/);
});
