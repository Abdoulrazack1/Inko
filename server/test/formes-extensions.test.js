// ============================================================
// server/test/formes-extensions.test.js — refuser une forme, et le dire
// ------------------------------------------------------------
// Une extension est un fichier JavaScript que l'on peut installer soi-même :
// le hub l'exécute et relaie ce qu'elle rend. Jusqu'ici, il le relayait sans
// rien vérifier.
//
// Le coût est déjà inscrit dans l'historique de ce dépôt : « six pages
// cassées par une forme de réponse » — le moteur embarqué rendait un objet là
// où le hub rend un tableau, le catalogue levait une exception, et les romans
// s'ouvraient dans le lecteur d'images.
//
// Ce qui manquait n'était pas un correctif mais une PHRASE. « Cannot read
// properties of undefined » au fond d'un contrôleur ne dit ni quelle source,
// ni ce qu'elle a rendu, ni qu'elle est en cause.
//
// ── Éprouvé contre les vraies sources avant d'être activé ──
//
// Les neuf extensions installées ont été interrogées en mode observation :
// quinze réponses valides, aucune refusée. Les trois autres étaient des
// échecs amont (HTTP 502), où il n'y a pas de forme à juger. Ce n'est qu'après
// cela que la validation a été branchée — un garde-fou qui casse ce qui
// marche est pire que pas de garde-fou.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { valider, decrire } = require('../lib/formes-extensions');

test('une liste bien formée passe', () => {
    const v = { results: [{ id: 'a' }], total: 1 };
    assert.equal(valider('liste', 'test', v), v, 'la valeur doit être rendue telle quelle');
});

test('une liste sans results est refusée, et le message nomme la source', () => {
    assert.throws(() => valider('liste', 'maSource', { items: [] }), (e) => {
        assert.match(e.message, /maSource/, 'la source doit être nommée');
        assert.match(e.message, /results/, 'la forme attendue doit être dite');
        assert.match(e.message, /items/, 'et ce qui a été reçu, décrit');
        return true;
    });
});

test('l’erreur est imputée à la SOURCE, pas au hub', () => {
    // `source-health` lit `upstream` pour compter l'echec au debit de la
    // source. Sans cela, une extension cassee ferait passer le hub pour
    // fautif, et le diagnostic partirait dans la mauvaise direction.
    try { valider('pages', 'x', {}); assert.fail('aurait dû lever'); }
    catch (e) {
        assert.equal(e.status, 502);
        assert.equal(e.upstream, 'x');
    }
});

test('les chapitres acceptent les DEUX formes qui circulent', () => {
    // Le code appelant lit tantot `{ chapters }`, tantot un tableau nu.
    // Resserrer ici casserait des sources qui fonctionnent, pour une purete
    // dont personne ne beneficie.
    assert.doesNotThrow(() => valider('chapitres', 's', [{ id: '1' }]));
    assert.doesNotThrow(() => valider('chapitres', 's', { chapters: [] }));
    assert.doesNotThrow(() => valider('chapitres', 's', { results: [] }));
    assert.throws(() => valider('chapitres', 's', { data: [] }));
});

test('une fiche doit porter de quoi l’identifier', () => {
    assert.doesNotThrow(() => valider('fiche', 's', { id: 'x' }));
    assert.doesNotThrow(() => valider('fiche', 's', { title: 'Un titre' }));
    assert.throws(() => valider('fiche', 's', { cover: 'x.jpg' }),
        /id. ou .title/, 'une fiche anonyme ne sert à rien');
    assert.throws(() => valider('fiche', 's', [{ id: 'x' }]),
        /au lieu de/, 'un tableau n’est pas une fiche');
});

test('une forme inconnue laisse passer', () => {
    // Ce module ne doit jamais devenir un obstacle a l'ajout d'une capacite :
    // une capacite nouvelle sans regle passe, elle n'echoue pas.
    const v = { nimporte: true };
    assert.equal(valider('capaciteFuture', 's', v), v);
    assert.equal(valider(undefined, 's', v), v);
});

test('null et undefined sont refusés, pas confondus', () => {
    // Une source qui rend `undefined` et une qui rend `{}` n'ont pas le meme
    // defaut : la description doit les distinguer.
    assert.equal(decrire(null), 'null');
    assert.equal(decrire(undefined), 'undefined');
    assert.equal(decrire({}), 'un objet vide');
    assert.match(decrire([1, 2]), /tableau de 2/);
    assert.throws(() => valider('liste', 's', null), /null/);
    assert.throws(() => valider('liste', 's', undefined), /undefined/);
});
