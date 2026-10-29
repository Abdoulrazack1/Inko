// ============================================================
// test/unit/bibliotheque-composition.test.js — 500 couvertures, pas
// 500 cartes
// ------------------------------------------------------------
// L'écran qui affiche le plus de couvertures de l'application posait
// une pastille rouge ombrée en haut à gauche de CHACUNE : la page était
// mouchetée de rouge, et l'inspecteur de direction artistique mesurait
// 12 % de surface fortement colorée pour une cible de 3 %.
//
// Le compte de non-lus est une donnée — il reste coloré. Mais il descend
// sous la couverture, où il se lit au lieu de masquer. Même décision que
// sur l'accueil, même raison : la couverture est le matériau visuel
// d'Inko, et rien n'a à se poser dessus.
//
// Et l'en-tête comptait QUATRE rangées avant la première couverture :
// titre, invitation à créer une catégorie, barre d'outils, ligne de
// vérification. Le chantier le disait déjà.
//
// Mesure de l'inspecteur : 7 FAIL → 0. Les cinq défauts restants sont
// globaux et corrigés dans la PR de l'accueil (dégradés de squelette,
// ombre du bouton principal, encre crème, capitales du pied de page) :
// les refaire ici produirait un conflit, pas une correction.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const lire = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');
const CSS = lire('assets', 'css', 'bibliotheque.css').replace(/\r\n/g, '\n');
const JS = lire('assets', 'js', 'bibliotheque.js');

const regle = (sel) => {
    const m = new RegExp('(^|\\n)[^\\n{}]*\\' + sel + '(?![a-z0-9-])[^\\n{}]*\\{([^}]*)\\}').exec(CSS);
    return m ? m[2] : null;
};

test('rien ne se pose sur la couverture', () => {
    // La pastille rouge et l'étiquette « ROMAN » étaient posées dessus.
    assert.ok(!/\.lib2-badge\b/.test(CSS), 'la pastille de non-lus a quitté l’œuvre');
    assert.ok(!/\.lib2-kind-badge\b/.test(CSS), 'l’étiquette de type aussi');
    assert.match(CSS, /\.lib2-nonlus \{[^}]*color: var\(--accent-text/,
        'le compte reste une donnée, donc coloré — mais sous la couverture');
    assert.match(JS, /lib2-nonlus">\$\{u\} à lire<\/b>/,
        'et il porte la vraie valeur');
    // La couverture est l'objet : ni rayon, ni ombre.
    const couv = regle('.lib2-cover');
    assert.ok(!/border-radius/.test(couv), 'cinq cents cartes arrondies font cinq cents objets');
    assert.ok(!/box-shadow/.test(couv), 'ni ombre');
});

test('la couleur ne va pas sur le mobilier', () => {
    // Quatre onglets dans un boîtier de verre bordé, dont l'actif est un
    // aplat orange ombré ; et la bascule de vue, pareil.
    const onglet = regle('.lib2-tab.active');
    assert.ok(onglet && !/background:\s*var\(--accent\)/.test(onglet),
        'un onglet actif se marque par son encre, pas par un aplat d’accent');
    assert.match(onglet, /border-bottom-color/, 'et par un filet');
    const vue = regle('.lib2-view button.on');
    assert.ok(vue && !/var\(--accent\)/.test(vue),
        'l’actif d’une bascule est un état de mobilier, pas une donnée');
    assert.ok(!/\.lib2-tabs \{[^}]*backdrop-filter/.test(CSS),
        'et le boîtier de verre autour des onglets n’a plus lieu d’être');
});

test('rien ne descend sous onze pixels', () => {
    // Une donnée qu'on n'arrive pas à lire ne sert personne.
    const fautes = [];
    for (const m of CSS.matchAll(/([^\n{}]*)\{([^}]*font-size:\s*([\d.]+)px[^}]*)\}/g)) {
        if (Number(m[3]) < 11) fautes.push(`${m[1].trim()} — ${m[3]}px`);
    }
    assert.deepEqual(fautes, [], `sous le plancher :\n  ${fautes.join('\n  ')}`);
});

test('plus de petite capitale espacée', () => {
    const fautes = [];
    for (const m of CSS.matchAll(/([^\n{}]*)\{([^}]*)\}/g)) {
        if (/text-transform:\s*uppercase/.test(m[2]) && /letter-spacing/.test(m[2])) {
            fautes.push(m[1].trim());
        }
    }
    assert.deepEqual(fautes, [], `à passer en bas de casse :\n  ${fautes.join('\n  ')}`);
});
