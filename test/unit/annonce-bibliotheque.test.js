// ============================================================
// test/unit/annonce-bibliotheque.test.js — filtrer doit se dire
// ------------------------------------------------------------
// Filtrer la bibliothèque ne disait RIEN à un lecteur d'écran : la grille se
// vidait ou se remplissait en silence. Le seul retour — un compte quelque
// part dans l'en-tête — n'est pas annoncé, puisque rien ne signale qu'il a
// changé.
//
// Le catalogue et la recherche le font depuis l'audit A11Y-06. La
// bibliothèque, qui est la plus grande liste de l'application (496 séries
// ici), ne le faisait pas.
//
// Vérifié dans le navigateur, région `aria-live="polite"` :
//
//     « blue »    → 13 séries pour « blue »
//     « zzzqqq »  → Aucune série pour « zzzqqq »
//     effacé      → 496 séries
//
// Quatre frappes n'ont produit qu'UNE annonce, et cinq rendus identiques
// aucune.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'assets', 'js', 'bibliotheque.js'), 'utf8')
    .replace(/\r\n/g, '\n');

const corps = () => {
    const m = /function annoncerResultats\(n, q\) \{([\s\S]*?)\n    \}/.exec(SRC);
    assert.ok(m, 'annoncerResultats doit rester repérable');
    return m[1];
};

test('le compte filtré est annoncé', () => {
    assert.match(corps(), /window\.MH\?\.announce\?\.\(texte\)/,
        'l’annonce doit passer par la région live partagée');
    assert.match(corps(), /série\$\{n > 1 \? 's' : ''\}/,
        'le pluriel doit s’accorder — « 1 série(s) » se lit comme un formulaire');
});

test('une annonce identique n’est pas répétée', () => {
    // `render()` est appelé à tout bout de champ : chaque épingle, chaque
    // retrait, chaque tranche de rendu progressif. Réannoncer « 496 séries »
    // sans cesse rendrait la page inutilisable à la voix.
    assert.match(corps(), /if \(texte === derniereAnnonce\) return;/,
        'une garde contre la répétition doit exister');
    assert.match(corps(), /derniereAnnonce = texte;/,
        'et la dernière annonce doit être retenue');
});

test('l’annonce attend que la frappe se pose', () => {
    // La recherche filtre à chaque touche. Annoncer lettre par lettre
    // noierait le résultat sous le bruit de la frappe.
    assert.match(corps(), /clearTimeout\(annonceTimer\)/,
        'le minuteur précédent doit être annulé');
    assert.match(corps(), /setTimeout\(\(\) => window\.MH\?\.announce\?\.\(texte\), 500\)/,
        'une demi-seconde d’attente');
});

test('la branche VIDE annonce aussi', () => {
    // Défaut trouvé en vérifiant dans le navigateur : la branche vide sortait
    // avant l'annonce. Le cas qui mérite le plus d'être dit — « il n'y a plus
    // rien » — était le seul à ne rien dire, et la région live gardait
    // « 496 séries » sur une grille vidée.
    const vide = /if \(!list\.length\) \{([\s\S]*?)\n        \}/.exec(SRC);
    assert.ok(vide, 'la branche vide doit rester repérable');
    assert.match(vide[1], /annoncerResultats\(0, q\)/,
        'elle doit annoncer avant de sortir');
});

test('l’annonce passe par le même entonnoir que le reste', () => {
    // `render()` est le seul point par lequel TOUT changement de filtre
    // passe : s'accrocher aux dix-sept commandes reviendrait à en oublier une
    // au prochain ajout, comme c'était arrivé au résumé des filtres.
    const appels = (SRC.match(/^\s*annoncerResultats\(/gm) || []).length;
    assert.equal(appels, 2,
        'deux appels exactement : la liste pleine et la liste vide');
});
