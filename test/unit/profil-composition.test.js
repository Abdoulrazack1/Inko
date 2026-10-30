// ============================================================
// test/unit/profil-composition.test.js — la bande la plus décorée de
// l'application
// ------------------------------------------------------------
// Dans une seule bande de 190 px, le profil empilait : un dégradé
// diagonal à trois arrêts codé en dur (brun → noir → bleu nuit), DEUX
// ellipses de lueur par-dessus (une orange, une bleue), un avatar en
// dégradé avec un halo de 4 px et une ombre portée de 28, un second
// anneau qui pulsait SANS FIN, une pastille de niveau en aplat d'accent
// avec son ombre colorée, et deux boutons en verre dépoli.
//
// Cinq dégradés, deux anneaux, une animation perpétuelle, une feuille de
// verre et une ombre colorée — et rien de tout cela ne portait de donnée.
//
// Les seules données de cette bande sont trois chiffres. Ce sont eux qui
// la portent désormais.
//
// Ce lot ne touche pas aux rayons : la PR #133 les remplace par
// l'échelle. Le compte de surfaces arrondies est donc inchangé, et ce
// n'est pas ce qu'on mesure ici.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const lire = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');
const CSS = lire('assets', 'css', 'profil.css').replace(/\r\n/g, '\n');
const HTML = lire('profil.html').replace(/\r\n/g, '\n');
const SANS_COMMENTAIRES = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

const regle = (sel) => {
    const m = new RegExp('\\n' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}').exec(CSS);
    return m ? m[1] : null;
};

test('plus un dégradé décoratif sur cette page', () => {
    const fautes = [];
    for (const m of SANS_COMMENTAIRES.matchAll(/([^\n{}]*)\{([^}]*)\}/g)) {
        if (/(linear|radial)-gradient/.test(m[2])) fautes.push(m[1].trim());
    }
    assert.deepEqual(fautes, [], `dégradés restants :\n  ${fautes.join('\n  ')}`);
    // Et le calque qui ne servait qu'à les porter a quitté le DOM.
    assert.ok(!/profil-hero-bg/.test(HTML) && !/profil-hero-bg/.test(SANS_COMMENTAIRES));
});

test('plus d’anneau qui pulse sans fin', () => {
    assert.ok(!/ringPulse/.test(CSS), 'l’animation n’existe plus');
    assert.ok(!/profil-avatar-ring/.test(CSS) && !/profil-avatar-ring/.test(HTML),
        'ni l’élément qu’elle animait');
    // L'avatar garde la couleur de la marque — c'est le seul endroit où
    // elle désigne la personne — mais à plat.
    const av = regle('.profil-avatar');
    assert.match(av, /background: var\(--accent\)/);
    assert.ok(!/box-shadow/.test(av), 'sans halo ni ombre portée');
});

test('la bande suit le thème', () => {
    // Elle se forçait en sombre parce que son fond était un dégradé codé
    // en dur : elle redéfinissait --text, --text2, --text3, --bg3, --bg4,
    // --border et --border2 pour que l'encre reste lisible dessus. Le fond
    // parti, tout ce bloc n'a plus lieu d'être.
    const h = regle('.profil-hero');
    assert.ok(h, '.profil-hero');
    assert.match(h, /background: var\(--bg\)/);
    assert.ok(!/--text:/.test(h), 'plus de palette forcée');
    assert.ok(!/--border:/.test(h));
    // Et les deux boutons en verre dépoli posés dessus.
    assert.ok(!/\.profil-hero \.btn-secondary/.test(CSS));
    assert.ok(!/backdrop-filter: blur\(14px\) saturate\(1\.5\)/.test(CSS));
});

test('trois chiffres portent la bande', () => {
    // Ils étaient enfermés dans un boîtier bordé et arrondi, avec un
    // survol orange sur une zone qui n'est même pas cliquable.
    const box = regle('.profil-stats');
    assert.ok(box && !/border:/.test(box) && !/border-radius/.test(box) && !/background/.test(box));
    assert.ok(!/\.profil-stat:hover/.test(CSS), 'ni survol sur du non-cliquable');
    const num = regle('.profil-stat-num');
    assert.match(num, /font-size: clamp\(26px, 2\.6vw, 34px\)/, 'ce sont les données : qu’on les voie');
    assert.match(num, /font-variant-numeric: tabular-nums/);
    // Le niveau est une donnée : il garde sa couleur, en encre.
    const lvl = regle('.profil-level');
    assert.ok(lvl && !/background/.test(lvl) && !/box-shadow/.test(lvl));
    assert.match(lvl, /color: var\(--accent-text/);
});

test('la couleur de marque ne va pas sur le mobilier du profil', () => {
    // Huitième écran : l'élément actif de la navigation était une tuile
    // d'accent, comme les filtres de quatre autres pages.
    const nav = regle('.sidebar-nav-item.active');
    assert.ok(nav && !/rgba\(255,107,26/.test(nav));
    assert.match(nav, /background: var\(--bg3\)/);
    assert.match(nav, /inset 2px 0 0 var\(--accent\)/, 'un filet à gauche');
    for (const sel of ['.pref-btn.active', '.lib-filter-btn.active']) {
        assert.ok(!/rgba\(255,107,26/.test(regle(sel)), `${sel}`);
    }
    // Deux cartes se distinguaient par la COULEUR de leur filet.
    assert.match(regle('.footer-mini-card.orange-border'), /inset 3px 0 0/);
    assert.match(regle('.footer-mini-card.green-border'), /inset 3px 0 0/);
});

test('un panneau est un fond OU un filet', () => {
    const c = regle('.card');
    assert.ok(c, '.card');
    assert.ok(!/border: 1px solid/.test(c), 'dix-huit cartes portaient les deux');
    assert.match(c, /background: var\(--bg2\)/);
});

test('plus de capitale écrite à la main ni par le style', () => {
    const caps = [];
    for (const m of SANS_COMMENTAIRES.matchAll(/([^\n{}]*)\{([^}]*)\}/g)) {
        if (/text-transform:\s*uppercase/.test(m[2])) caps.push(m[1].trim());
    }
    assert.deepEqual(caps, [], `à passer en bas de casse :\n  ${caps.join('\n  ')}`);
    // Les libellés des trois chiffres et les trois titres de section
    // étaient écrits en capitales DANS le gabarit, par-dessus le
    // text-transform : deux fois la même décision.
    for (const faute of ['>CHAPITRES<', 'SÉRIES COMMENCÉES', 'EN BIBLIOTHÈQUE',
        '>MENU PRINCIPAL<', '>AVIS<', '>SUCCÈS<']) {
        assert.ok(!HTML.includes(faute), `« ${faute} » était crié dans le gabarit`);
    }
    assert.match(HTML, /<div class="profil-stat-label">Chapitres lus<\/div>/);
});

test('rien ne descend sous onze pixels sur le profil', () => {
    const fautes = [];
    for (const m of CSS.matchAll(/([^\n{}]*)\{([^}]*font-size:\s*([\d.]+)px[^}]*)\}/g)) {
        if (Number(m[3]) < 11) fautes.push(`${m[1].trim()} — ${m[3]}px`);
    }
    assert.deepEqual(fautes, [], `sous le plancher :\n  ${fautes.join('\n  ')}`);
});
