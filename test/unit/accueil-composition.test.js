// ============================================================
// test/unit/accueil-composition.test.js — l'accueil est une étagère
// ------------------------------------------------------------
// La page posait trois compositions de même poids : une salutation de
// 36 px qui ne dit rien, trois tuiles de statistiques encadrées, et une
// bande de reprise dont les deux tiers étaient vides. L'objet qui répond
// à la question de l'écran — « où est-ce que je m'étais arrêté ? » —
// était le PLUS PETIT de la page.
//
// La première correction n'a fait que recomposer DANS le même langage :
// une carte arrondie plus grande, posée sur un gris. Mesuré, ce langage
// était le vrai défaut — 163 surfaces arrondies sur une seule page, dont
// 139 au même rayon de 12 px. Aucune palette ne corrige ça.
//
// On ne regarde pas une bibliothèque en vignettes : on la regarde par la
// TRANCHE, et on tire le volume qu'on veut. Sept conteneurs pour montrer
// sept couvertures sont devenus zéro : la couverture EST la latte, sa
// largeur dit si c'est celle qu'on lit, et le filet du bas porte la
// progression réelle.
//
// Mesure de l'inspecteur de direction artistique : 0 FAIL à 1440, 768 et
// 390, trois défenses écrites au rapport.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const lire = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');
const CSS = lire('assets', 'css', 'accueil.css').replace(/\r\n/g, '\n');
const GLOBAL = lire('assets', 'css', 'global.css').replace(/\r\n/g, '\n');
const JS = lire('assets', 'js', 'accueil.js');
const HTML = lire('accueil.html');

const regle = (src, sel) => {
    const m = new RegExp('(^|\\n)[^\\n{}]*\\' + sel + '(?![a-z0-9-])[^\\n{}]*\\{([^}]*)\\}').exec(src);
    return m ? m[2] : null;
};

test('le titre est celui d\'un écran, pas d\'une page d\'accroche', () => {
    const h = regle(CSS, '.home-hello');
    const m = /font-size:\s*clamp\(\s*([\d.]+)px[^)]*?([\d.]+)px\s*\)/.exec(h);
    assert.ok(m, 'la taille est fluide');
    assert.ok(Number(m[2]) <= 32,
        `un écran d'application titre entre 18 et 32 px — trouvé ${m[2]}px`);
});

test('les chiffres sont une phrase, plus des tuiles encadrées', () => {
    assert.ok(!/\.home-stat\b/.test(CSS), 'les tuiles ont disparu');
    assert.match(HTML, /<ul class="home-chiffres"/, 'remplacées par une vraie liste');
    assert.match(regle(CSS, '.home-chiffres'), /tabular-nums/,
        'des chiffres qui changent de largeur d’un chargement à l’autre dansent');
});

test('la reprise n\'a plus un seul conteneur', () => {
    // Sept cartes encadrées pour montrer sept couvertures. Ici, aucune :
    // la couverture est la latte.
    for (const mort of ['.cont-hero', '.cont-item', '.cont-row']) {
        assert.ok(!new RegExp('\\' + mort + '(?![a-z0-9-])').test(CSS),
            `${mort} appartient à l'ancienne grammaire`);
    }
    const latte = regle(CSS, '.latte');
    assert.ok(latte, '.latte doit exister');
    assert.ok(!/border-radius/.test(latte), 'un livre serré contre ses voisins n’a pas de rayon');
    assert.ok(!/box-shadow/.test(latte), 'ni d’ombre portée');
    assert.ok(!/border:/.test(latte), 'ni de cadre');
});

test('la largeur et la clarté d\'une latte sont des données, pas un décor', () => {
    assert.match(CSS, /\.latte--ouverte \{[^}]*flex-grow/,
        'celle qu’on lit est tirée de l’étagère');
    assert.match(CSS, /\.latte--ouverte \.latte-couv \{[^}]*filter: none/,
        'et elle est à sa vraie lumière ; les autres restent dans l’ombre du rang');
    assert.match(CSS, /\.latte-jauge > span \{[^}]*background: var\(--accent\)/,
        'le filet du bas porte la progression — la seule couleur d’accent de la page');
    assert.match(JS, /latte-jauge[^`]*width:\$\{pct\(e\)\}%/,
        'et cette progression est la vraie valeur');
});

test('le téléphone a sa propre composition', () => {
    // Sept lattes dans 375 px donnaient des tranches de 35 px dont le
    // rembourrage écrasait le titre.
    assert.match(CSS, /@media \(max-width: 560px\) \{[\s\S]*?\.latte:nth-child\(n\+6\) \{ display: none/,
        'cinq lattes au téléphone, pas sept');
    // `global.css` relève tous les enfants d'un lien au pointeur grossier,
    // pour la zone d'atteinte étendue : sans ce rattrapage, le dos de la
    // latte tombait SOUS l'étagère et le titre disparaissait.
    assert.match(CSS, /@media \(pointer: coarse\) \{[\s\S]*?\.latte > \.latte-dos \{ position: absolute/,
        'et les lattes gardent leur empilement au doigt');
});

test('ce que la direction artistique interdit a disparu', () => {
    assert.ok(!/box-shadow/.test(regle(GLOBAL, '.btn-primary') || ''),
        'un bouton principal est un aplat, sans relief');
    assert.ok(!/text-transform:\s*uppercase/.test(regle(GLOBAL, '.footer-col h4') || ''),
        'plus de petite capitale espacée en titre de colonne');
    assert.ok(!/text-shadow/.test(CSS),
        'la lisibilité sur une image vient du voile, pas d’une ombre portée sur le texte');
    assert.ok(!/font-size:\s*10px/.test(regle(GLOBAL, '.mnav-item') || ''),
        'rien sous 11 px, pas même un libellé d’onglet');
    // Une icône dans un rond teinté sur chaque couverture est le signe le
    // plus sûr d'une interface fabriquée en série.
    assert.match(GLOBAL, /@media \(hover: hover\) \{\s*\n\s*\.card-fav-btn \{ opacity: 0;/,
        'le cœur apparaît au survol');
    assert.match(CSS, /#shelfNew \.card-fav-btn \{ display: none; \}/,
        'et disparaît là où toutes les séries sont suivies — un marqueur qui vaut pour tout le rang ne marque rien');
});
