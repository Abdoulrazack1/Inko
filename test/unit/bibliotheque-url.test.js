// ============================================================
// test/unit/bibliotheque-url.test.js — le tri se retient, et la vue a une adresse
// ------------------------------------------------------------
// Deux manques, de nature différente :
//
//   · les quatre filtres de la bibliothèque sont mémorisés depuis peu. Le
//     TRI, lui, ne l'était pas — et il avait été manqué pour une raison de
//     forme : ce n'est pas une variable du module, mais une valeur de
//     formulaire, lue dans le `<select>` à chaque rendu. Choisir « À
//     rattraper », ouvrir une série, revenir : retour aux « récemment
//     ajoutés » ;
//   · rien de tout cela ne vivait dans l'URL. Une vue qu'on refait souvent ne
//     pouvait pas devenir un favori, et le bouton Précédent ramenait à une
//     bibliothèque dont les réglages avaient changé sous les yeux.
//
// Le comportement a été vérifié EN SESSION, sur 399 séries réelles : écriture
// de l'adresse au changement de tri, lecture d'une adresse filtrée à
// l'ouverture, et nettoyage de l'adresse quand l'état revient au défaut. Ces
// tests tiennent les décisions que cette vérification ne protège pas d'une
// réécriture ultérieure.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

// Normalise les fins de ligne : git réécrit la copie de travail en CRLF sous
// Windows, et les expressions ci-dessous attendent « \n ».
const SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'assets', 'js', 'bibliotheque.js'), 'utf8')
    .replace(/\r\n/g, '\n');

const corps = (nom) => {
    const m = new RegExp(`function ${nom}\\(\\) \\{([\\s\\S]*?)\\n    \\}`).exec(SRC);
    assert.ok(m, `${nom} doit rester repérable`);
    return m[1];
};

// ── Le tri est un réglage, pas une valeur de formulaire ─────

test('le tri est mémorisé avec les autres filtres', () => {
    assert.match(corps('sauverFiltres'), /\btri,/,
        'le tri doit être écrit dans le même enregistrement que les filtres');
    assert.match(corps('restaurerFiltres'), /s\.tri/,
        'et relu avec eux');
});

test('la valeur restaurée n’est posée dans le select qu’une seule fois', () => {
    // Sans ce garde-fou, chaque rendu réécraserait le choix que l'utilisateur
    // vient de faire avec la valeur d'avant : le tri serait impossible à
    // changer. Défaut réellement écrit, puis corrigé avant d'être livré.
    assert.match(SRC, /let triPose = false;/, 'un drapeau de première pose doit exister');
    assert.match(SRC, /if \(!triPose\) \{ triPose = true;/,
        'le drapeau doit être levé AVANT toute condition sur la valeur');
});

// ── L'adresse ne doit pas mentir ────────────────────────────

test('l’URL n’écrit que ce qu’elle sait relire', () => {
    // Écrire `genre=all` alors que la lecture ne reconnaît que `manga` et
    // `novel` donnerait une adresse qui ment sur ce qu'elle rouvrira — et
    // salirait l'adresse de tout le monde pour ne rien dire.
    const ecrit = corps('ecrireURL');
    const lit = corps('lireURL');
    assert.match(ecrit, /kindFilter === 'manga' \|\| kindFilter === 'novel'/,
        'seules les valeurs relisibles sont écrites');
    assert.match(lit, /genre === 'manga' \|\| genre === 'novel'/,
        'et la lecture s’en tient aux mêmes');
});

test('la recherche ne passe PAS dans l’adresse', () => {
    // Même raison qu'elle n'est pas mémorisée : une requête de passage
    // s'oublie, et une adresse partagée ne doit pas transporter ce qu'on
    // tapait. Retrouver un champ rempli d'un mot de la veille se lit comme
    // une bibliothèque vide.
    const ecrit = corps('ecrireURL');
    assert.ok(!/libSearch|\bq\.set\('q'|recherche/.test(ecrit),
        'aucune trace de la recherche dans l’adresse');
});

test('un filtre n’est pas une navigation', () => {
    // `pushState` empilerait une entrée d'historique par changement de
    // filtre, et ferait du bouton Précédent une machine à défaire les
    // réglages un par un.
    const ecrit = corps('ecrireURL');
    assert.match(ecrit, /history\.replaceState/);
    assert.ok(!/pushState/.test(ecrit), 'jamais pushState');
});

test('réécrire la même adresse est évité', () => {
    // `render()` est appelé à tout bout de champ. Remplacer l'entrée courante
    // par elle-même est au mieux inutile, au pire un effet de bord sur tout
    // ce qui s'accroche à l'historique.
    assert.match(corps('ecrireURL'),
        /if \(cible === location\.pathname \+ location\.search\) return;/,
        'une sortie anticipée doit exister quand rien n’a changé');
});

// ── Le point d'accrochage ───────────────────────────────────

test('l’adresse est écrite depuis render(), pas depuis les dix-sept commandes', () => {
    // Même raison que pour `sauverFiltres` : `render()` est le seul point par
    // lequel TOUT changement de filtre passe. S'accrocher aux commandes
    // reviendrait à en oublier une au prochain ajout — c'est exactement ce
    // qui était arrivé au résumé des filtres.
    assert.match(SRC, /sauverFiltres\(\);\n        ecrireURL\(\);/,
        'ecrireURL doit suivre sauverFiltres dans render()');
    assert.equal((SRC.match(/ecrireURL\(\)/g) || []).length, 2,
        'une définition et un seul appel');
});

test('l’URL l’emporte sur le stockage, et pas l’inverse', () => {
    // Un lien mis en favori doit montrer ce qu'il promet, pas les derniers
    // réglages en date. Donc : stockage d'abord, adresse ensuite.
    const restaure = SRC.indexOf('\n    restaurerFiltres();');
    const url = SRC.indexOf('\n    lireURL();');
    assert.ok(restaure > 0 && url > 0, 'les deux doivent être appelés au démarrage');
    assert.ok(url > restaure,
        'lireURL doit passer APRÈS restaurerFiltres pour pouvoir l’emporter');
});
