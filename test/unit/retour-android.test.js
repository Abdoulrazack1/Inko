// ============================================================
// test/unit/retour-android.test.js — P2.7 / IX.7, le bouton retour
// ------------------------------------------------------------
// Le comportement a été éprouvé dans un vrai navigateur : le retour ferme la
// feuille sans quitter la page, trois cycles ouverture/fermeture ne laissent
// aucune entrée d'historique fantôme, et un retour sur une modale rend
// « annuler ».
//
// Ce fichier garde les INVARIANTS de câblage, ceux qui se défont en silence.
// Une surcouche qui se referme directement, sans passer par la pile, ne casse
// rien de visible : elle laisse simplement une entrée d'historique derrière
// elle. On ne s'en aperçoit qu'après quatre ou cinq ouvertures, quand « retour »
// ne quitte plus la page — et personne ne relie ce symptôme à cette cause.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const lire = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('une surcouche pousse une entrée d’historique en s’ouvrant', () => {
    // C'est ce que l'audit demande explicitement : sans entrée poussée, le
    // bouton retour QUITTE l'écran en laissant le panneau ouvert. On perd sa
    // page pour avoir voulu fermer une feuille.
    const feuille = lire('assets/js/feuille.js');
    assert.match(feuille, /MH\.retour\.pousser\(fermerReel\)/,
        'feuille.js ne s’inscrit plus dans la pile de retour.');
    assert.match(feuille, /const fermer = \(\) => \{ if \(rendre\) rendre\(\); else fermerReel\(\); \}/,
        'La fermeture par l’interface doit passer par la pile — sinon elle laisse '
        + 'son entrée d’historique derrière elle, et « retour » cesse de quitter la page.');
});

test('un retour sur une modale vaut ANNULATION, jamais confirmation', () => {
    // L'inverse serait une faute grave : valider une suppression parce que
    // quelqu'un a voulu revenir en arrière. Le geste de retour exprime le
    // renoncement, dans toutes les applications.
    const global = lire('assets/js/global.js');
    assert.match(global, /pousser\(\(\) => fermerReel\(input \? null : false\)\)/,
        'La fermeture par retour doit rendre la valeur d’annulation (null / false).');
});

test('la pile rend son entrée quand l’interface ferme la surcouche', () => {
    const global = lire('assets/js/global.js');
    const bloc = /function retirer\(entree\)\{?[\s\S]*?\n        \}/.exec(global);
    assert.ok(bloc, 'la fonction `retirer` de la pile de retour a disparu');
    assert.match(bloc[0], /pile\.splice\(i, 1\)/, 'l’entrée doit sortir de la pile');
    assert.match(bloc[0], /history\.back\(\)/,
        'sans `history.back()`, chaque ouverture laisse une entrée : après trois '
        + 'panneaux ouverts et refermés, il faut trois appuis sur « retour » pour '
        + 'quitter une page où plus rien n’est ouvert.');
    assert.match(bloc[0], /ignorerPop = true/,
        'ce retour ne doit pas refermer une seconde surcouche au passage');
});

test('la fermeture est idempotente', () => {
    // Une feuille peut être fermée par le voile, par Échap, par son bouton et
    // par le retour matériel — parfois dans la même seconde. Deux fermetures
    // concurrentes qui aboutiraient toutes deux à `history.back()` feraient
    // reculer d'une page de trop.
    const global = lire('assets/js/global.js');
    assert.match(global, /const i = pile\.indexOf\(entree\);\s*\n\s*if \(i === -1\) return;/,
        'retirer() doit sortir sans rien faire si l’entrée n’est plus dans la pile');
    const feuille = lire('assets/js/feuille.js');
    assert.match(feuille, /if \(ferme\) return;\s*\n\s*ferme = true;/,
        'feuille.js doit garder son verrou de fermeture unique');
});

test('l’onglet actif remonte avant de recharger', () => {
    // Recharger d'emblée coûte tout le contenu, les filtres et la position,
    // pour un geste dont l'intention la plus courante est « remonte ».
    const global = lire('assets/js/global.js');
    assert.match(global, /mnav-item\.active'\)\?\.addEventListener\('click'/,
        'l’appui sur l’onglet déjà actif n’est plus intercepté');
    assert.match(global, /if \(dejaEnHaut\) return;/,
        'le second appui, déjà en haut, doit laisser le rechargement se faire');
});
