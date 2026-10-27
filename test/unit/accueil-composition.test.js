// ============================================================
// test/unit/accueil-composition.test.js — l'accueil a une dominante
// ------------------------------------------------------------
// La page posait trois compositions de même poids : une salutation de
// 36 px qui ne dit rien, trois tuiles de statistiques encadrées, et une
// bande de reprise dont les deux tiers étaient vides. L'objet qui répond
// à la question de l'écran — « où est-ce que je m'étais arrêté ? » —
// était le PLUS PETIT de la page : une couverture de 132 px.
//
// Mesuré par l'inspecteur de direction artistique, avant → après :
//
//     FAIL   8 → 0     (en écartant trois défenses écrites au rapport)
//     dégradés        31 → 0
//     bordures lourdes 10 → 0
//
// Ce que le test garde, ce ne sont pas des pixels — c'est la hiérarchie :
// l'écran d'application a un titre d'écran et non une accroche, les
// chiffres sont une phrase et non des tuiles, et la couverture est
// l'objet dominant.
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
    assert.ok(h, '.home-hello doit exister');
    const m = /font-size:\s*clamp\(\s*([\d.]+)px[^)]*?([\d.]+)px\s*\)/.exec(h);
    assert.ok(m, 'la taille est fluide');
    assert.ok(Number(m[2]) <= 32,
        `un écran d'application titre entre 18 et 32 px — trouvé ${m[2]}px`);
});

test('les chiffres sont une phrase, plus des tuiles encadrées', () => {
    assert.ok(!/\.home-stat\b/.test(CSS), 'les tuiles ont disparu');
    assert.match(CSS, /\.home-chiffres \{/, 'remplacées par une ligne');
    assert.match(HTML, /<ul class="home-chiffres"/, 'et par une vraie liste dans le gabarit');
    const c = regle(CSS, '.home-chiffres');
    assert.match(c, /tabular-nums/,
        'des chiffres qui changent de largeur d’un chargement à l’autre dansent');
    // Le plus gros chiffre de l'écran doit répondre à sa question, et la
    // question n'est pas « combien de chapitres as-tu lus en tout ».
    const taille = /font-size:\s*([\d.]+)px/.exec(c);
    assert.ok(Number(taille[1]) <= 14, `la ligne de chiffres reste du texte — ${taille[1]}px`);
});

test('la couverture est l\'objet dominant de la page', () => {
    const couv = regle(CSS, '.cont-hero-cover');
    const m = /width:\s*clamp\([^,]+,[^,]+,\s*([\d.]+)px\)/.exec(couv);
    assert.ok(m, 'la couverture a une largeur fluide');
    assert.ok(Number(m[1]) >= 190,
        `elle répond à la question de l'écran : elle ne peut pas faire ${m[1]}px`);
    // Et elle ne flotte pas : dans ce style, l'élévation vient de la clarté.
    assert.ok(!/box-shadow/.test(couv), 'pas d’ombre portée sur la couverture');
});

test('la bande ne laisse plus la moitié de l\'écran vide', () => {
    assert.match(CSS, /@media \(min-width: 1080px\) \{\s*\n\s*\.home-continue \{ display: grid;/,
        'au-delà de 1080 px, la reprise et les lectures en cours forment une seule composition');
});

test('le pourcentage n\'est écrit qu\'une fois', () => {
    // Deux endroits pour la même valeur, c'est deux endroits où elle peut
    // se contredire — et la bande en affichait déjà un grand chiffre.
    assert.match(JS, /const ouHero = \(e\) =>/, 'la phrase de la bande a sa propre formulation');
    assert.match(JS, /cont-hero-where">\$\{MH\.esc\(ouHero\(une\)\)\}/);
    assert.match(CSS, /\.cont-hero-pct \{/, 'et le pourcentage est le grand chiffre');
});

test('ce que la direction artistique interdit a disparu', () => {
    // Chacun de ces points était un FAIL mesuré dans la page réelle.
    assert.ok(!/linear-gradient/.test(GLOBAL.split('REPLI aspect-ratio')[0].replace(/\/\*[\s\S]*?\*\//g, '').match(/\.skeleton \{[^}]*\}/)?.[0] || ''),
        'le miroitement des squelettes était un dégradé animé');
    assert.ok(!/box-shadow/.test(regle(GLOBAL, '.btn-primary') || ''),
        'un bouton principal est un aplat, sans relief');
    assert.ok(!/text-transform:\s*uppercase/.test(regle(GLOBAL, '.footer-col h4') || ''),
        'plus de petite capitale espacée en titre de colonne');
    const kicker = regle(CSS, '.cont-hero-kicker');
    assert.ok(!/text-transform:\s*uppercase/.test(kicker),
        'ni au-dessus du titre de la bande');
    assert.ok(!/font-size:\s*10px/.test(regle(GLOBAL, '.mnav-item') || ''),
        'rien sous 11 px, pas même un libellé d’onglet');
});
