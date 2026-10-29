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

// ── Deuxième passe : ce que la première n'avait pas touché ───────────
// La grille réparée, l'inspecteur comptait encore 992 surfaces arrondies
// sur cette seule page — 496 × 2, soit l'épingle et la croix de retrait
// posées sur CHAQUE couverture, arrondies et floutées. Exactement la
// maladie retirée des cœurs de l'accueil, au même endroit, deux fois.
//
// Et en remontant la page zone par zone : la rangée « Reprendre » portait
// la classe des rangées de pastilles de filtre (le titre se posait à côté
// du rail au lieu d'être au-dessus, et son compteur de non-lus s'affichait
// nu puisque .lib2-badge n'existe plus) ; la vue liste et les rangées des
// trois autres onglets étaient des cartes bordées et arrondies ; la barre
// d'actions groupées était du verre posé sur la grille de couvertures.

const HTML = lire('bibliotheque.html');

test('ni l’épingle ni la croix ne se posent sur l’œuvre', () => {
    const r = regle('.lib2-pin, .lib2-del');
    assert.ok(r, 'les deux boutons partagent une règle');
    assert.ok(!/position:\s*absolute/.test(r), 'ils sont dans le flux, pas sur la couverture');
    assert.ok(!/backdrop-filter/.test(r), 'ni flou');
    assert.ok(!/background:\s*rgba\(0,\s*0,\s*0/.test(r), 'ni pastille noire');
    // Et le DOM les met dans la ligne du titre.
    assert.match(JS, /<div class="lib2-ligne">\s*\n\s*<div class="lib2-title">/,
        'la ligne du titre les accueille');
    assert.match(CSS, /\.lib2-ligne \{[^}]*display:flex/, 'et elle existe');
    // L'état épinglé se dit par l'encre, plus par un aplat d'accent.
    const on = regle('.lib2-pin.on');
    assert.ok(on && !/background/.test(on), 'épinglée, l’œuvre le dit par l’encre');
    assert.match(on, /color:var\(--accent-text/, 'et c’est une donnée, donc colorée');
});

test('la rangée « Reprendre » a son propre nom', () => {
    // .lib2-resume servait DEUX rôles : cette rangée, et les rangées de
    // pastilles de filtre actif. La seconde règle (flex wrap) écrasait la
    // première : le titre se posait à côté du rail.
    assert.match(HTML, /class="lib2-reprise" id="libResume"/, 'un nom par rôle');
    assert.match(CSS, /\.lib2-reprise \{/, 'et sa règle');
    assert.ok(!/\.lib2-resume \{[^}]*margin-bottom:22px/.test(CSS), 'plus de collision');
    // Son compteur de non-lus s'affichait nu : .lib2-badge n'existe plus.
    assert.ok(!/lib2-badge/.test(JS), 'la pastille orpheline a disparu du DOM');
    assert.equal((JS.match(/lib2-nonlus">\$\{u\}/g) || []).length, 2,
        'les deux rangées de couvertures affichent le compte de la même façon');
    // Un titre de section s'annonce par du texte, pas par un filet orange.
    assert.ok(!/\.lib2-section-head \.bar/.test(CSS), 'plus de filet d’accent');
    assert.ok(!/<span class="bar">/.test(JS), 'ni dans le DOM');
});

test('une rangée de liste n’est pas une carte', () => {
    for (const sel of ['.lib2-list .lib2-card', '.upd-row']) {
        const r = regle(sel);
        assert.ok(r, sel);
        assert.ok(!/border-radius/.test(r), `${sel} : trois cents rangées arrondies font trois cents objets`);
        assert.ok(!/border:1px solid/.test(r), `${sel} : un cheveu entre deux lignes suffit`);
        assert.match(r, /border-bottom:1px solid var\(--border\)/, `${sel} : et c’est ce cheveu`);
    }
    // Le survol était l'orange de la marque sur du mobilier.
    assert.ok(!/\.lib2-list \.lib2-card:hover \{[^}]*--orange/.test(CSS));
    assert.ok(!/\.upd-row:hover \{[^}]*--orange/.test(CSS));
});

test('la couleur reste sur les données, pas sur les filtres', () => {
    const chip = regle('.lib2-chip.on');
    assert.ok(chip && !/background:var\(--accent\)/.test(chip),
        'une pastille de filtre active est un état de mobilier');
    assert.ok(!/box-shadow:0 1px 3px color-mix\(in srgb, var\(--accent\)/.test(CSS),
        'et son ombre colorée avec elle');
    const kind = regle('.lib2-kind.on');
    assert.ok(kind && !/var\(--accent\)/.test(kind), 'le segment Mangas/Romans aussi');
    // Les deux boîtiers de bascule de la page sont le même objet.
    for (const sel of ['.lib2-view', '.lib2-kinds']) {
        assert.match(regle(sel), /border-radius:var\(--radius2\)/, `${sel} : même rayon`);
        assert.ok(!/border:1px solid/.test(regle(sel)), `${sel} : et pas de filet sur l’un seulement`);
    }
});

test('le verre a quitté la barre groupée', () => {
    const r = regle('.lib2-bulkbar');
    assert.ok(!/backdrop-filter/.test(r), 'le flou ramassait la grille en bouillie sous les boutons');
    assert.ok(!/glass/.test(r), 'ni les jetons de verre');
    assert.match(r, /box-shadow:var\(--shadow-3\)/, 'une barre flottante est un calque : l’ombre y est légitime');
});

test('plus de couleur codée en dur dans le JS de la page', () => {
    const fautes = (JS.match(/style="[^"]*(#[0-9a-fA-F]{3,6}|rgba?\()[^"]*"/g) || []);
    assert.deepEqual(fautes, [], `à passer en classe :\n  ${fautes.join('\n  ')}`);
});

test('plus de petite capitale dans les étiquettes', () => {
    // « NOUVEAU » et « ÉCHEC » étaient criés en capitales de 11,5 px.
    assert.ok(!/>NOUVEAU</.test(JS) && !/>ÉCHEC</.test(JS));
    assert.match(JS, />Nouveau</);
});
