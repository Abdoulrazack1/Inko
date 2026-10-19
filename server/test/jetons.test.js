// ============================================================
// server/test/jetons.test.js — borner ce qui part vers l'amont
// ------------------------------------------------------------
// Rien ne bornait le nombre de téléchargements simultanés vers une source.
// La protection n'existait que côté client, sous forme de constantes qui
// supposent chacune être seule : le lecteur s'autorise trois pages en
// parallèle, la file de téléchargement une de plus, et un second onglet
// recommence le compte à zéro.
//
// Deux faits déjà mesurés dans ce dépôt justifient la borne : une planche de
// 225 Ko met 3 700 à 9 000 ms seule et 17 000 à 25 000 ms quand plusieurs
// partent ensemble ; et une rafale simultanée est ce qui fait bannir une
// adresse IP.
//
// Un compteur de jetons est le genre de code où une erreur ne se voit pas :
// il laisse passer un de trop, ou il se bloque, et dans les deux cas rien ne
// le dit. Ces tests le mettent sous contrainte réelle.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { creerJetons } = require('../lib/jetons');

const attendre = (ms) => new Promise(r => setTimeout(r, ms));

test('jamais plus de jetons que le plafond, sous charge', async () => {
    const J = creerJetons(4);
    let actifs = 0, maxVu = 0, faits = 0;

    await Promise.all(Array.from({ length: 30 }, async () => {
        const rendre = await J.prendre();
        actifs++; maxVu = Math.max(maxVu, actifs);
        await attendre(5 + Math.random() * 10);
        actifs--; faits++;
        rendre();
    }));

    assert.equal(maxVu, 4, 'le plafond doit être atteint — sinon la borne bride pour rien');
    assert.equal(faits, 30, 'et les trente doivent passer');
    assert.deepEqual(J.etat(), { actifs: 0, enAttente: 0, plafond: 4 },
        'tout doit être rendu à la fin : un jeton perdu fige la file pour de bon');
});

test('un travail qui échoue rend quand même son jeton', async () => {
    // C'est le défaut qui fige un hub en silence : une source qui refuse,
    // quatre fois de suite, et plus aucune image ne part jamais.
    const J = creerJetons(2);
    for (let i = 0; i < 6; i++) {
        const rendre = await J.prendre();
        try { throw new Error('la source a refusé'); }
        catch (e) { /* le travail échoue */ }
        finally { rendre(); }
    }
    assert.deepEqual(J.etat(), { actifs: 0, enAttente: 0, plafond: 2 });

    // Et le compteur sert encore après.
    const r = await J.prendre();
    assert.equal(J.etat().actifs, 1);
    r();
});

test('rendre deux fois le même jeton n’en ouvre pas un de plus', async () => {
    // `finally` peut s'exécuter sur un chemin déjà passé par une autre sortie.
    // Un libérateur réentrant laisserait alors filer le plafond, et la borne
    // ne vaudrait plus rien précisément quand les erreurs s'accumulent.
    const J = creerJetons(1);
    const rendre = await J.prendre();
    rendre(); rendre(); rendre();
    assert.equal(J.etat().actifs, 0, 'le compte ne doit pas passer sous zéro');

    let actifs = 0, maxVu = 0;
    await Promise.all(Array.from({ length: 5 }, async () => {
        const r = await J.prendre();
        actifs++; maxVu = Math.max(maxVu, actifs);
        await attendre(3);
        actifs--; r();
    }));
    assert.equal(maxVu, 1, 'le plafond de 1 doit tenir après un double rendu');
});

test('l’attente est servie dans l’ordre d’arrivée', async () => {
    // Sans cet ordre, une page demandée en premier peut arriver en dernier :
    // le lecteur afficherait les planches dans le désordre de la file, pas
    // dans celui de la lecture.
    const J = creerJetons(1);
    const ordre = [];
    const premier = await J.prendre();

    const suite = [1, 2, 3].map(async (n) => {
        const r = await J.prendre();
        ordre.push(n);
        r();
    });
    await attendre(10);
    premier();
    await Promise.all(suite);

    assert.deepEqual(ordre, [1, 2, 3]);
});

test('un plafond absurde est ramené à un, jamais à zéro', async () => {
    // Un zéro bloquerait TOUT le proxy d'images, définitivement, sur une
    // variable d'environnement mal recopiée.
    for (const v of [0, -3, 'abc', null, undefined]) {
        const J = creerJetons(v);
        assert.equal(J.etat().plafond, 1, `plafond pour ${String(v)}`);
        const r = await J.prendre();   // doit rendre la main
        r();
    }
});
