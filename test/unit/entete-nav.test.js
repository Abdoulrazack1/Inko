// ============================================================
// test/unit/entete-nav.test.js — les deux surfaces qui se superposent
// à toute l'application
// ------------------------------------------------------------
// L'en-tête fixe et la barre de navigation du bas étaient en verre
// liquide : `blur(24px) saturate(1.9)` — EXACTEMENT la feuille retirée
// de la barre du lecteur, et pour la même raison. Elles passent au-dessus
// des mêmes planches et des mêmes couvertures, et saturer à 1,9 y étale
// la couleur du dessin à chaque défilement.
//
// Et un défaut mesuré que personne ne pouvait voir en édition sombre :
//
//   --glass-border: color-mix(in srgb, #ffffff 30%, transparent);
//
// était posé sur `:root` NU, à l'intérieur du @supports, sans garde de
// thème. Sur tout navigateur qui lit color-mix — c'est-à-dire tous les
// navigateurs modernes — l'arête du verre valait donc 30 % de blanc dans
// les DEUX éditions. Mesuré au navigateur : `color(srgb 1 1 1 / 0.3)` en
// clair comme en sombre. Sur le Washi crème (#eeece6), c'est un trait
// blanc sur du blanc cassé : l'en-tête n'avait aucune arête visible, et
// le contenu passait dessous sans rien pour l'en séparer.
//
// Après correction, mesuré sur la même page :
//   clair  → arête rgba(28, 27, 25, 0.13) sur un fond rgb(231, 228, 218)
//   sombre → arête rgba(233, 231, 224, 0.09) sur un fond rgb(23, 23, 27)
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const CSS = fs.readFileSync(
    path.join(__dirname, '..', '..', 'assets', 'css', 'global.css'), 'utf8'
).replace(/\r\n/g, '\n');
const SANS_COMMENTAIRES = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

const regle = (sel) => {
    const m = new RegExp('(^|\\n)\\s*' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}').exec(CSS);
    return m ? m[2] : null;
};

test('le blanc du verre ne vaut plus pour les deux éditions', () => {
    // La valeur blanche doit vivre sous une garde de thème sombre, jamais
    // sur :root nu — sinon elle s'applique aussi au Washi crème.
    const supports = /@supports \(background: color-mix[\s\S]*?\n\}\n/.exec(CSS);
    assert.ok(supports, 'le bloc @supports');
    const racineNue = /:root \{([^}]*)\}/.exec(supports[0]);
    assert.ok(racineNue, ':root dans le @supports');
    assert.ok(!/#ffffff/.test(racineNue[1]),
        'plus de blanc pur sur :root nu : il s’appliquait aux deux éditions');
    assert.match(supports[0],
        /html\[data-theme="dark"\], html\[data-theme="amoled"\] \{\s*\n\s*--glass-border: color-mix\(in srgb, #ffffff 30%/,
        'il descend avec les autres valeurs sombres');
    // Même défaut pour l'arête spéculaire intérieure.
    assert.match(CSS, /--glass-inner:\s*inset 0 -1px 0 rgba\(28,27,25,\.09\)/,
        'en clair, un filet bas discret');
    assert.match(CSS, /html\[data-theme="dark"\], html\[data-theme="amoled"\] \{\n\s*--glass-inner: inset 0 1px 0 rgba\(255,255,255,\.32\)/,
        'le liseré blanc reste au sombre');
});

test('plus de verre au-dessus de toute l’application', () => {
    // `.mobile-nav` a deux règles : `display:none` hors media query, et la
    // vraie sous 1024 px. C'est la seconde qui portait le verre.
    const navMobile = /\n\s*\.mobile-nav \{([^}]*position: fixed[^}]*)\}/.exec(CSS);
    assert.ok(navMobile, 'la règle de la barre du bas');
    for (const [sel, r] of [['.site-header', regle('.site-header')],
        ['.mobile-nav', navMobile[1]]]) {
        assert.ok(r, sel);
        assert.ok(!/backdrop-filter/.test(r), `${sel} : c’est la feuille retirée du lecteur`);
        assert.ok(!/glass/.test(r), `${sel} : ni les jetons de verre`);
        assert.ok(!/rgba\(255,255,255,\.14\)/.test(r), `${sel} : ni le liseré blanc codé en dur`);
        assert.match(r, /background: var\(--bg2\)/, `${sel} : un aplat opaque`);
        assert.match(r, /border-(bottom|top): 1px solid var\(--border\)/, `${sel} : et un cheveu`);
    }
});

test('le lien actif de l’en-tête n’est pas une tuile d’accent', () => {
    // Neuvième écran, et le plus visible de tous : il est sur chaque page.
    const a = regle('.header-nav a.active');
    assert.ok(a, '.header-nav a.active');
    assert.ok(!/rgba\(255,107,26/.test(a), 'plus de tuile orange');
    assert.ok(!/border:/.test(a), 'ni de filet orange autour');
    assert.match(a, /background: var\(--bg3\)/, 'un pas de clarté');
    assert.match(a, /font-weight: 600/, 'et le poids');
    // « Mes listes » criait en couleur de marque, avec deux !important.
    assert.ok(!/\.nav-mes-listes/.test(SANS_COMMENTAIRES));
    // Allumé, un bouton d'outil porte une donnée : la couleur en encre.
    const on = regle('.header-icon-btn.on');
    assert.ok(on && !/background: var\(--orange\)/.test(on));
    assert.match(on, /color: var\(--accent-text/);
});

test('le mobilier de l’en-tête suit la même grammaire', () => {
    // Un panneau (ou un bouton) se détache par UNE chose.
    const u = regle('.header-user');
    assert.ok(u && !/border: 1px solid/.test(u), 'fond relevé OU filet');
    assert.match(u, /background: var\(--bg3\)/);
    // Le champ de recherche était la seule saisie en pilule de 20 px.
    assert.match(CSS, /\.header-search input \{[\s\S]*?border-radius: var\(--radius2\)/);
    // Rien sous 11 px.
    assert.ok(!/\.user-sublabel \{[^}]*font-size: 10px/.test(CSS));
});
