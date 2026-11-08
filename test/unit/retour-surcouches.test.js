// ============================================================
// test/unit/retour-surcouches.test.js — le bouton retour ferme ce qui est
// ouvert, il ne quitte pas l'ecran
// ------------------------------------------------------------
// Le mecanisme existait. `MH.retour`, dans `global.js`, avec son
// raisonnement ecrit : une surcouche n'existe que dans le DOM,
// l'historique l'ignore, et le bouton retour d'Android QUITTE la page en
// la laissant ouverte — « on perd son ecran pour avoir voulu fermer un
// panneau ». La parade : chaque surcouche pousse une entree d'historique,
// le retour la consomme, `popstate` ferme.
//
// Mesure du 9 novembre. Hors de `global.js`, ONZE endroits fermaient
// quelque chose sur Echap. ZERO poussait une entree. Le mecanisme etait
// la, ecrit avec soin, et personne ne s'en servait — c'est le defaut qui
// revient depuis l'etape 2, et pour la meme raison : `pousser` demande au
// site d'appel de garder la fonction rendue, de ne l'appeler qu'une fois
// et de ne jamais fermer par un autre chemin. Trois regles a tenir a la
// main, dans six fichiers.
//
// `MH.surcouche` fait les trois d'un coup et rend UNE fonction : fermer.
// La parade au defaut, c'est de rendre le bon geste plus court que le
// mauvais.
//
// ── Les onze, classes un par un ──
//
// Six sont de vraies surcouches, et sont converties :
//     chapitre.js   le menu « ... » du lecteur
//     chapitre.js   la note de signet (role="dialog")
//     profil.js     le menu de filtre de l'historique
//     notes-ui.js   le panneau des notes
//     lecture.js    la barre de recherche du lecteur de romans
//     bibliotheque.js  le panneau de filtres ET le menu « ... »
//
// Quatre ne sont pas des surcouches, et ne doivent rien pousser : Echap y
// VIDE UN CHAMP de recherche (profil, parametres, catalogue) ou annule une
// capture de raccourci (parametres). Leur faire consommer une entree
// d'historique serait un bug, pas une correction.
//
// Le onzieme est une infobulle au survol (`card-hover.js`). Elle se ferme
// deja au defilement et n'a jamais ete « ouverte » par un geste qu'on
// voudrait defaire : lui donner une entree d'historique ferait du bouton
// retour la reponse a un mouvement de souris.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const lire = (...p) => fs.readFileSync(path.join(RACINE, ...p), 'utf8').replace(/\r\n/g, '\n');

// ── Le comportement de l'aide, charge depuis la source reelle ──
function charger() {
    const src = lire('assets', 'js', 'global.js');
    const i = src.indexOf('        window.MH.surcouche = function (fermerReel) {');
    assert.notEqual(i, -1, 'MH.surcouche doit rester reperable');
    const bloc = src.slice(i, src.indexOf('\n        };', i) + 11);

    // Un `MH.retour` fidele au vrai : une pile, un `popstate`, et le
    // retour d'entree a la fermeture demandee par l'interface.
    const journal = [];
    const pile = [];
    let ignorer = false;
    const window = {
        MH: {
            retour: {
                pousser(fermerReel) {
                    const e = { fermerReel };
                    pile.push(e);
                    journal.push('push');
                    return () => {
                        const k = pile.indexOf(e);
                        if (k === -1) return;
                        pile.splice(k, 1);
                        e.fermerReel();
                        ignorer = true;
                        journal.push('back');
                        // Le navigateur emet un `popstate` pour CE
                        // `history.back()`. Ne pas le simuler laisserait
                        // `ignorer` arme et fausserait la suite.
                        popstate();
                    };
                },
                taille: () => pile.length,
            },
        },
    };
    function popstate() {
        if (ignorer) { ignorer = false; return; }
        if (!pile.length) { journal.push('sortie-de-page'); return; }
        pile.pop().fermerReel();
        journal.push('pop');
    }
    // eslint-disable-next-line no-new-func
    new Function('window', bloc)(window);
    return { MH: window.MH, journal, pile, popstate };
}

test('le bouton retour ferme la surcouche, il ne quitte pas la page', () => {
    const { MH, journal, popstate } = charger();
    let ouvert = true;
    MH.surcouche(() => { ouvert = false; });
    assert.deepEqual(journal, ['push'], 'ouvrir pousse une entree');
    popstate();
    assert.equal(ouvert, false, 'le retour a ferme');
    assert.deepEqual(journal, ['push', 'pop']);
    // Et la page n'a pas ete quittee : aucune sortie enregistree.
    assert.ok(!journal.includes('sortie-de-page'));
});

test('fermer par l’interface rend l’entree, au lieu de l’abandonner', () => {
    // Sans ca, apres trois ouvertures et trois fermetures il faudrait
    // appuyer trois fois sur « retour » pour quitter une page ou rien
    // n'est ouvert. C'est ecrit dans le commentaire de MH.retour, et c'est
    // ce que ce test tient.
    const { MH, journal, pile, popstate } = charger();
    for (let i = 0; i < 3; i++) {
        let ouvert = true;
        const fermer = MH.surcouche(() => { ouvert = false; });
        fermer();
        assert.equal(ouvert, false, 'fermeture ' + i);
    }
    assert.equal(pile.length, 0, 'rien ne traine dans la pile');
    assert.deepEqual(journal, ['push', 'back', 'push', 'back', 'push', 'back']);
    popstate();
    assert.ok(journal.includes('sortie-de-page'),
        'rien d’ouvert : le retour doit enfin quitter la page');
});

test('une surcouche ne se ferme qu’une fois, d’ou que vienne l’ordre', () => {
    // Les sites d'appel ferment souvent par plusieurs chemins — un clic
    // dehors, Echap, une action du menu — et parfois deux arrivent coup
    // sur coup. Un double appel ne doit pas consommer deux entrees.
    const { MH, journal, pile } = charger();
    let n = 0;
    const fermer = MH.surcouche(() => { n++; });
    fermer(); fermer(); fermer();
    assert.equal(n, 1, 'fermee une seule fois');
    assert.equal(journal.filter((x) => x === 'back').length, 1, 'une seule entree rendue');
    assert.equal(pile.length, 0);

    // Et apres une fermeture par le retour, l'interface qui ferme a son
    // tour ne doit rien consommer.
    const b = charger();
    let m = 0;
    b.MH.surcouche(() => { m++; });
    b.popstate();
    assert.equal(m, 1);
    assert.equal(b.pile.length, 0);
});

test('sans MH.retour, la surcouche se ferme quand meme', () => {
    // `global.js` peut etre charge sans que le bloc d'historique ait tourne
    // (page minimale, test, WebView bride). La fermeture ne doit pas
    // dependre de lui.
    const src = lire('assets', 'js', 'global.js');
    const i = src.indexOf('        window.MH.surcouche = function (fermerReel) {');
    const bloc = src.slice(i, src.indexOf('\n        };', i) + 11);
    const window = { MH: {} };
    // eslint-disable-next-line no-new-func
    new Function('window', bloc)(window);
    let ouvert = true;
    window.MH.surcouche(() => { ouvert = false; })();
    assert.equal(ouvert, false);
});

// ── L'inventaire : les six converties, et les cinq qui ne doivent pas l'etre ──
test('les six vraies surcouches passent par MH.surcouche', () => {
    const ATTENDU = {
        'chapitre.js': 2,       // le menu « ... » et la note de signet
        'profil.js': 1,         // le menu de filtre de l'historique
        'notes-ui.js': 1,       // le panneau des notes
        'lecture.js': 1,        // la barre de recherche du lecteur de romans
        'bibliotheque.js': 1,   // filtres et menu « ... » partagent la fermeture
    };
    for (const [f, n] of Object.entries(ATTENDU)) {
        const src = lire('assets', 'js', f);
        const trouve = (src.match(/MH\.surcouche\(/g) || []).length;
        assert.equal(trouve, n, f + ' : ' + trouve + ' appel(s) a MH.surcouche, ' + n + ' attendu(s)');
    }
});

test('les fermetures qui ne sont pas des surcouches n’en deviennent pas', () => {
    // Echap qui VIDE UN CHAMP n'ouvre rien : lui faire consommer une entree
    // d'historique rendrait le bouton retour imprevisible dans l'autre sens.
    for (const [f, motif] of [
        ['profil.js', /if \(e\.key === 'Escape' && champ\.value\)/],
        ['parametres.js', /if \(e\.key === 'Escape' && champ\.value\)/],
        ['catalogue.js', /if \(e\.key === 'Escape' && input\.value\)/],
    ]) {
        assert.match(lire('assets', 'js', f), motif, f + ' : le vidage de champ doit rester tel quel');
    }
    // L'infobulle de survol ne se declare pas non plus.
    assert.ok(!lire('assets', 'js', 'card-hover.js').includes('MH.surcouche'),
        'une infobulle au survol n’est pas un ecran qu’on a ouvert');
});

test('MH.surcouche est declaree a cote de MH.retour, pas ailleurs', () => {
    // Les deux forment un seul mecanisme ; les separer rouvrirait la porte
    // a une troisieme facon de faire.
    const src = lire('assets', 'js', 'global.js');
    const iRetour = src.indexOf('window.MH.retour = {');
    const iSur = src.indexOf('window.MH.surcouche = function');
    assert.ok(iRetour !== -1 && iSur > iRetour, 'MH.surcouche suit MH.retour');
    assert.ok(iSur - iRetour < 2000, 'et reste dans le meme bloc');
    assert.equal((src.match(/window\.MH\.surcouche = /g) || []).length, 1,
        'une seule definition');
});
