// ============================================================
// server/test/exemples-extensions.test.js — la documentation qui s'exécute
// ------------------------------------------------------------
// Le contrat d'une extension était décrit en prose dans
// `lib/source-interface.js`. De la prose ne peut pas être exécutée : elle
// dérive du code au premier changement, et personne ne s'en aperçoit avant
// qu'une extension tierce casse six pages — ce qui est déjà arrivé dans ce
// dépôt.
//
// `extensions/exemples.js` donne le même contrat sous forme de **valeurs**.
// Ce fichier les fait passer par le validateur réel. Deux garanties en
// découlent :
//
//   · un exemple qui cesse d'être valide fait échouer la CI. La
//     documentation ne peut plus mentir ;
//   · un contre-exemple qui cesserait d'être refusé le ferait échouer aussi.
//     C'est la moitié qu'on oublie : une documentation qui dit « ceci sera
//     refusé » doit le prouver, sinon elle promet une protection absente.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { valider } = require('../lib/formes-extensions');
const { EXEMPLES, CONTRE_EXEMPLES, UNE_OEUVRE } = require('../extensions/exemples');

// Quel exemple répond à quelle forme. `chapitresFormeTableau` est la seconde
// écriture acceptée pour les chapitres : elle doit passer la même règle.
const CORRESPONDANCE = {
    liste: 'liste',
    fiche: 'fiche',
    chapitres: 'chapitres',
    chapitresFormeTableau: 'chapitres',
    pages: 'pages',
    texte: 'texte',
};

test('chaque exemple du contrat est réellement accepté', () => {
    const noms = Object.keys(EXEMPLES);
    assert.ok(noms.length >= 6, 'le contrat doit couvrir toutes les capacités');
    for (const nom of noms) {
        const forme = CORRESPONDANCE[nom];
        assert.ok(forme, `l’exemple « ${nom} » doit être rattaché à une forme`);
        assert.doesNotThrow(() => valider(forme, 'exemple', EXEMPLES[nom]),
            `l’exemple « ${nom} » devrait être accepté — la documentation a dérivé`);
    }
});

test('chaque contre-exemple est réellement refusé, pour la raison annoncée', () => {
    assert.ok(CONTRE_EXEMPLES.length >= 4, 'les pièges courants doivent être couverts');
    for (const c of CONTRE_EXEMPLES) {
        assert.throws(() => valider(c.forme, 'exemple', c.valeur),
            `le contre-exemple « ${c.pourquoi.slice(0, 50)}… » devrait être refusé`);
        assert.ok(c.pourquoi && c.pourquoi.length > 30,
            'un contre-exemple sans explication n’apprend rien');
    }
});

test('le tableau nu reste refusé pour une liste, accepté pour des chapitres', () => {
    // Cette asymétrie est volontaire et vaut d'être tenue : les chapitres
    // circulent réellement sous les deux formes dans le code appelant, les
    // listes non. Quelqu'un qui « harmoniserait » casserait des sources.
    assert.throws(() => valider('liste', 'x', [UNE_OEUVRE]));
    assert.doesNotThrow(() => valider('chapitres', 'x', EXEMPLES.chapitresFormeTableau));
});

test('l’exemple d’œuvre porte ce dont l’application se sert', () => {
    // Un exemple minimal enseignerait le minimum. Celui-ci montre aussi les
    // champs facultatifs, parce qu'une extension qui ne les remplit pas prive
    // l'application de ses filtres sans que son auteur le sache.
    for (const champ of ['id', 'title', 'cover', 'tags', 'status']) {
        assert.ok(champ in UNE_OEUVRE, `l’exemple doit montrer « ${champ} »`);
    }
    assert.ok(Array.isArray(UNE_OEUVRE.tags), 'tags est un tableau');
});

test('les chapitres de l’exemple montrent les conventions qui comptent', () => {
    const c = EXEMPLES.chapitres.chapters[0];
    assert.equal(typeof c.chapter, 'number',
        'le numéro doit être un nombre : un tri sur des chaînes met 10 avant 2');
    assert.equal(c.title, null,
        'null plutôt qu’une chaîne vide — « pas de titre » et « titre vide » diffèrent');
    assert.match(c.publishedAt, /^\d{4}-\d{2}-\d{2}T/,
        'une date ISO 8601, ou null : jamais un format local');
});
