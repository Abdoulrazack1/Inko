// ============================================================
// test/unit/bibliotheque-miroir-local.test.js — serveur eteint, la
// bibliotheque qu'on a
// ------------------------------------------------------------
// Mesure du 9 novembre, serveur arrete, service worker en place. La
// coquille de la page revenait du cache — en-tete, onglets, pied — et la
// grille affichait :
//
//     🌐 La source ne repond pas
//        Hors ligne
//        [Reessayer]  [Changer de source]
//
// Deux erreurs dans une seule phrase. Ce n'est pas la SOURCE qui manque,
// c'est le hub ; et « changer de source » ne peut rien y faire. Pendant
// ce temps, le miroir local des 495 favoris dormait dans `Storage`.
//
// LE MECANISME EXISTAIT. `showLoggedOutLibrary` affichait deja ce miroir,
// avec la bonne banniere — « Le serveur est injoignable : apercu
// hors-ligne » — et la date de la derniere sauvegarde. Il n'etait
// simplement pas appele dans ce cas-la : il etait enferme dans le cas
// « deconnecte », qui n'en est qu'un usage. C'est le defaut de l'etape 2,
// pour la sixieme fois cette semaine, et toujours le meme remede : sortir
// le mecanisme du cas particulier qui l'avait vu naitre.
//
// Verifie dans le navigateur, serveur arrete : 495 cartes affichees, la
// banniere datee, et plus aucune mention de « La source ne repond pas »
// ni de « Changer de source ».
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const lire = (...p) => fs.readFileSync(path.join(RACINE, ...p), 'utf8').replace(/\r\n/g, '\n');
const SRC = lire('assets', 'js', 'bibliotheque.js');

function fn(nom) {
    const i = SRC.indexOf('    function ' + nom + '(');
    assert.notEqual(i, -1, nom + ' doit rester reperable');
    return SRC.slice(i, SRC.indexOf('\n    }\n', i) + 6);
}

test('le miroir local est une fonction a part, pas un cas de la deconnexion', () => {
    const m = fn('afficherMiroirLocal');
    assert.match(m, /getCachedLibrary/, 'il lit le miroir');
    assert.match(m, /if \(!cache \|\| !cache\.favs\.length\) return false;/,
        'pas de miroir : il le dit, et laisse l’appelant decider');
    assert.match(m, /return true;/, 'miroir affiche : il le dit aussi');
});

test('les DEUX cas qui en ont besoin l’appellent', () => {
    // Le defaut etait exactement la : un seul des deux.
    assert.match(fn('showLoggedOutLibrary'), /if \(afficherMiroirLocal\(\)\) return;/,
        'deconnecte : le miroir d’abord, le message d’invite ensuite');
    const charge = SRC.slice(SRC.indexOf('    async function loadLibrary()'));
    const i = charge.indexOf('} catch (e) {');
    assert.notEqual(i, -1);
    const attrape = charge.slice(i, i + 700);
    assert.match(attrape, /if \(afficherMiroirLocal\(\)\) return;/,
        'serveur injoignable : le miroir avant l’etat d’erreur');
    assert.ok(attrape.indexOf('afficherMiroirLocal') < attrape.indexOf('poserEtatErreur'),
        'annoncer une panne avant d’avoir regarde ce qu’on peut montrer, c’est'
        + ' donner la panne qu’on croit avoir a la place de celle qu’on a');
});

test('la banniere dit le vrai motif, et quand remonte la copie', () => {
    const m = fn('afficherMiroirLocal');
    assert.match(m, /Le serveur est injoignable/,
        'le motif doit nommer le serveur, jamais la source');
    assert.ok(!/source/i.test(m.replace(/Le serveur est injoignable[^`]*/g, '')),
        'le mot « source » n’a rien a faire dans ce message');
    assert.match(m, /MH\.date\(cache\.at, 'jourHeure'\)/,
        'la date de la sauvegarde : un apercu sans age ne se juge pas');
    assert.match(m, /Reessayer|Réessayer/);
});

test('la banniere n’est pas posee deux fois, et son bouton est un vrai bouton', () => {
    const m = fn('afficherMiroirLocal');
    assert.match(m, /hote\.querySelector\('\.lib2-miroir'\)\?\.remove\(\);/,
        'deux appels ne doivent pas empiler deux bannieres');
    // `onclick=""` est refuse par la CSP de l'app installee (DESK-02) : le
    // gestionnaire se POSE. L'ancien code l'ecrivait en attribut.
    assert.ok(!/onclick=/.test(m), 'la CSP de l’app installee refuse onclick');
    assert.match(m, /addEventListener\('click', \(\) => location\.reload\(\)\)/);
    assert.match(m, /type="button"/, 'sans type, un bouton dans un formulaire soumet');
});

test('le style du miroir vit dans la feuille, pas dans une chaine', () => {
    // L'ancienne banniere portait 11 declarations en `style.cssText`, donc
    // hors de portee des jetons et des themes.
    const m = fn('afficherMiroirLocal');
    assert.ok(!/cssText/.test(m), 'plus de style en dur');
    assert.match(m, /banner\.className = 'lib2-miroir';/);
    const css = lire('assets', 'css', 'bibliotheque.css');
    assert.match(css, /\.lib2-miroir \{/);
    assert.match(css, /border-left: 3px solid var\(--orange\)/);
    assert.ok(!/#[0-9a-f]{3,6}/i.test(css.slice(css.indexOf('.lib2-miroir'), css.indexOf('.lib2-miroir') + 400)),
        'aucune couleur litterale : le miroir suit le theme comme le reste');
});
