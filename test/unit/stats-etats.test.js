// ============================================================
// test/unit/stats-etats.test.js — un graphique vide doit dire pourquoi
// ------------------------------------------------------------
// `chargerRepartition()` sortait en silence dans DEUX cas différents :
//
//     catch (e) { return; }           la requête a échoué
//     if (!d || !d.total) return;     il n'y a rien à montrer
//
// À l'écran, les deux donnaient la même zone vide. Impossible de savoir si la
// page était cassée ou si l'on n'avait simplement rien lu.
//
// C'est exactement la confusion que l'audit SRC-02 avait relevée pour la
// recherche, où « aucun résultat » et « la source est tombée » se
// ressemblaient trait pour trait — et on en concluait que l'œuvre n'existait
// pas.
//
// Vérifié dans le navigateur, les deux états rendus côte à côte :
//
//     vide    « Rien de lu sur les douze derniers mois »
//             + un lien vers la bibliothèque
//     erreur  « Chargement impossible » + un bouton Réessayer
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'assets', 'js', 'stats.js'), 'utf8')
    .replace(/\r\n/g, '\n');

const bloc = () => {
    const m = /async function chargerRepartition\(\) \{([\s\S]*?)\n    \}/.exec(SRC);
    assert.ok(m, 'chargerRepartition doit rester repérable');
    return m[1];
};

test('une requête échouée propose de relancer', () => {
    const b = bloc();
    assert.match(b, /poserEtatErreur\?\.\(hote, e, \{ onRetry: chargerRepartition \}\)/,
        'l’erreur doit porter une action, pas seulement un constat');
});

test('une absence de données dit pourquoi elle est vide', () => {
    const b = bloc();
    assert.match(b, /poserEtatVide/, 'un état vide doit être posé');
    assert.match(b, /Rien de lu sur les douze derniers mois/,
        'le titre doit nommer la fenêtre observée — « vide » tout court n’apprend rien');
    assert.match(b, /apparaîtra dès le premier chapitre lu/,
        'et dire ce qui le remplira');
});

test('les deux états restent DISTINCTS', () => {
    // Les confondre ramènerait le défaut : une panne lue comme une absence de
    // lecture, ou l'inverse. L'un propose de relancer, l'autre d'aller lire.
    const b = bloc();
    const iErreur = b.indexOf('poserEtatErreur');
    const iVide = b.indexOf('poserEtatVide');
    assert.ok(iErreur >= 0 && iVide >= 0, 'les deux doivent exister');
    assert.notEqual(iErreur, iVide);
    assert.ok(!/catch \(e\) \{ return; \}/.test(b),
        'plus aucune sortie silencieuse sur échec');
    assert.ok(!/if \(!d \|\| !d\.total\) return;/.test(b),
        'ni sur absence de données');
});

test('l’état vide mène quelque part', () => {
    // Un etat vide sans issue laisse l'utilisateur devant une impasse : il
    // sait que c'est vide, pas comment le remplir.
    assert.match(bloc(), /href: 'bibliotheque\.html'/,
        'une action doit mener à ce qui remplira le graphique');
});

test('l’hôte absent sort toujours en silence, et c’est normal', () => {
    // Celui-la n'est pas un defaut : si le bloc n'est pas dans la page, il n'y
    // a rien a dire a personne. Le distinguer des deux autres est le point.
    assert.match(bloc(), /if \(!hote\) return;/);
});
