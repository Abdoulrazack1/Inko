// ============================================================
// server/test/couverture-champs.test.js — « jamais fourni » est un fait
// ------------------------------------------------------------
// Un champ absent se présente toujours pareil : vide à l'écran, `undefined`
// dans les données. Rien ne disait si c'est la **source** qui ne publie pas
// l'information, ou l'**extension** qui ne l'a pas lue.
//
// La distinction a déjà coûté : l'extension WeebCentral écrivait
// `publishedAt: null` **en dur**, alors que la page portait 1 192 balises
// `<time datetime>`. Les dates n'apparaissaient nulle part, et rien ne
// permettait de deviner que c'était un oubli d'implémentation.
//
// ── Mesurer plutôt que déclarer ──
//
// On aurait pu demander aux extensions de déclarer ce qu'elles ne fournissent
// pas. Une déclaration que personne ne remplit ne vaut rien, et celle qui ment
// est pire — c'est précisément ce que faisait ce `null` en dur.
//
// Relevé en branchant la mesure sur les vraies sources :
//
//     weebcentral  liste   20 vus   « description » jamais fournie
//     chireads     liste   20 vus   « tags » et « status » jamais fournis
//     mangadex             absent du rapport : il fournit tout
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { noter, rapport, oublier, CHAMPS } = require('../lib/couverture-champs');

const liste = (n, modele) => ({ results: Array.from({ length: n }, () => ({ ...modele })) });

test('un champ jamais rempli est rapporté', () => {
    oublier();
    noter('s1', 'liste', liste(20, { id: 'a', title: 'T', cover: 'c.jpg', tags: ['x'], status: 'ongoing' }));
    const r = rapport('s1');
    assert.ok(r && r.liste, 'la source doit avoir un rapport');
    assert.deepEqual(r.liste.jamais, ['description'],
        'seul le champ absent doit être nommé');
    assert.equal(r.liste.vus, 20);
});

test('un champ parfois rempli est distingué d’un champ jamais rempli', () => {
    // Les deux cas n'appellent pas la meme conclusion : « jamais » accuse
    // l'extension ou la source, « parfois » decrit le catalogue.
    oublier();
    noter('s2', 'liste', liste(10, { id: 'a', cover: 'c.jpg', tags: [], status: 'x', description: 'd' }));
    noter('s2', 'liste', liste(10, { id: 'b', cover: 'c.jpg', tags: ['y'], status: 'x', description: 'd' }));
    const r = rapport('s2');
    assert.deepEqual(r.liste.jamais, [], 'aucun champ totalement absent');
    const tags = r.liste.parfois.find(p => p.champ === 'tags');
    assert.ok(tags, 'tags doit apparaître comme partiellement fourni');
    assert.equal(tags.vus, 10);
    assert.equal(tags.sur, 20);
});

test('un tableau vide ne compte pas comme fourni', () => {
    // `tags: []` est le piege : la cle existe, la valeur ne dit rien. La
    // compter comme fournie masquerait exactement ce qu'on cherche.
    oublier();
    noter('s3', 'liste', liste(15, { id: 'a', cover: 'c', tags: [], status: 's', description: 'd' }));
    assert.deepEqual(rapport('s3').liste.jamais, ['tags']);
});

test('on ne conclut pas sur un échantillon minuscule', () => {
    // « jamais fourni sur 1 resultat » n'apprend rien, et afficher cela
    // enverrait chercher un defaut inexistant.
    oublier();
    noter('s4', 'liste', liste(3, { id: 'a' }));
    assert.equal(rapport('s4'), null, 'sous dix éléments, aucun rapport');
    noter('s4', 'liste', liste(9, { id: 'a' }));
    assert.ok(rapport('s4'), 'au-delà, le rapport sort');
});

test('les chapitres sont échantillonnés sous leurs DEUX formes', () => {
    oublier();
    noter('s5', 'chapitres', { chapters: Array.from({ length: 6 }, () => ({ id: 'c', lang: 'fr' })) });
    noter('s5', 'chapitres', Array.from({ length: 6 }, () => ({ id: 'c', lang: 'fr' })));
    const r = rapport('s5');
    assert.equal(r.chapitres.vus, 12, 'les deux écritures doivent alimenter le même compte');
    assert.ok(r.chapitres.jamais.includes('publishedAt'),
        'c’est exactement le champ que WeebCentral codait en dur à null');
});

test('la table ne peut pas grossir avec les données', () => {
    // Une table indexee par ce qu'une extension rend serait une fuite de
    // memoire offerte a n'importe quel fichier installe.
    oublier();
    noter('s6', 'liste', { results: [{ id: 'a', champInvente: 1, autreChamp: 2 }] });
    for (const forme of Object.keys(CHAMPS)) {
        assert.ok(Array.isArray(CHAMPS[forme]), 'les champs suivis sont une liste fixe');
    }
    const r = rapport('s6');
    assert.equal(r, null, 'un seul élément : pas de rapport, et rien d’inventé retenu');
});

test('une valeur aberrante ne casse pas la lecture', () => {
    // Une statistique ne doit jamais pouvoir faire echouer une requete.
    oublier();
    assert.doesNotThrow(() => noter('s7', 'liste', null));
    assert.doesNotThrow(() => noter('s7', 'liste', { results: [null, 42, 'texte'] }));
    assert.doesNotThrow(() => noter('s7', 'formeInconnue', { results: [{}] }));
    assert.doesNotThrow(() => noter(undefined, 'liste', liste(3, {})));
});
