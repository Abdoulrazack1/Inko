// ============================================================
// test/unit/bascule-mode-position.test.js — changer de mode ne doit pas
// renvoyer au début du chapitre
// ------------------------------------------------------------
// Mesuré sur Blue Lock, chapitre 2, 73 pages, fenêtre 1100 × 900 :
//
//     page 20 en mode page, bascule en défilement
//         AVANT   scrollY = 0, « 1 % lu »        — dix-neuf pages en arrière
//         APRÈS   scrollY = 15 286, écart 0 px, « 27 % lu »
//     page 50, même geste
//         APRÈS   scrollY = 39 275, écart −2 px, « 68 % lu »
//
// Le sens inverse marchait déjà : l'observateur de défilement tient
// `currentPage`, et le mode page le reprend.
//
// TROIS choses s'étaient liguées, et les deux premières n'ont été trouvées
// qu'en mesurant — chacune rendait la précédente invisible.
//
//  1. La position n'était tout simplement pas reportée. Correctif évident,
//     sans effet : l'observateur de défilement repose `currentPage` à 1 dès
//     que les premières planches entrent dans la fenêtre, AVANT que le
//     minuteur ne parte. D'où `pageAvant`, retenu avant le rendu.
//
//  2. Une garde « le lecteur a défilé lui-même, on lâche » comparait
//     `scrollY` à ce qu'on venait de poser. Or les images qui arrivent
//     au-dessus déplacent `scrollY` toutes seules : la garde abandonnait dès
//     la première planche chargée. On écoute donc un GESTE (molette, touche,
//     doigt, clic), pas un mouvement.
//
//  3. La vraie cause, dessous. Le marque-place d'une planche était
//     `width:100%` + `aspect-ratio`, dans une colonne flex en
//     `align-items:center`. La largeur de ligne y est INDÉFINIE : le
//     pourcentage n'a rien contre quoi se résoudre, la largeur repasse en
//     auto, et c'est le `min-height:120px` de la feuille qui pilote la boîte,
//     par l'aspect-ratio, en sens inverse.
//
//         marque-place     84 × 120 px
//         planche chargée  559 × 796 px
//
//     La barre de défilement annonçait 20 012 px pour un chapitre qui en fait
//     59 578. Viser une page dans ce document-là ne pouvait pas marcher — et
//     la reprise « rouvrir à la page où l'on s'était arrêté », qui existait
//     déjà, visait tout aussi faux depuis le début.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'assets', 'js', 'chapitre.js'), 'utf8')
    .replace(/\r\n/g, '\n');

const corps = (entete) => {
    const i = SRC.indexOf(entete);
    assert.notEqual(i, -1, entete + ' doit rester repérable');
    return SRC.slice(i, SRC.indexOf('\n    }', i));
};

// ── 1. La page est retenue avant que le rendu ne la perde ──
test('la bascule retient la page AVANT de redessiner', () => {
    const bloc = corps("const btn = e.target.closest('[data-mode]')");
    const iRetenue = bloc.indexOf('const pageAvant = currentPage;');
    const iMode = bloc.indexOf('readMode = btn.dataset.mode;');
    assert.ok(iRetenue >= 0, 'la page courante doit être retenue');
    assert.ok(iRetenue < iMode,
        'elle doit l’être avant le changement de mode : le rendu la remet à 1');
    assert.match(bloc, /applyInitialScroll\(pageAvant\)/,
        'et c’est CETTE page qu’on vise, pas `currentPage` relu après coup');
});

test('le mode page garde sa remise à zéro', () => {
    // Le mode paginé défile DANS la planche : y revenir en haut est juste.
    assert.match(corps("const btn = e.target.closest('[data-mode]')"),
        /else resetPagedScroll\(1\);/);
});

// ── 2. L'ancrage ──
test('la page visée est un argument, pas une variable relue', () => {
    const f = corps('function applyInitialScroll(page)');
    assert.match(f, /const cible = page \|\| currentPage;/,
        'l’appelant doit pouvoir imposer la page');
    assert.match(f, /data-page="\$\{cible\}"/,
        'et c’est elle qu’on cherche dans le DOM');
});

test('l’ancrage lâche sur un GESTE, pas sur un mouvement du défilement', () => {
    // C'est la deuxième erreur, et elle rendait le correctif inopérant sans
    // rien casser de visible : la garde se déclenchait toute seule.
    const f = corps('function applyInitialScroll(page)');
    assert.match(f, /\['wheel', 'touchstart', 'keydown', 'mousedown'\]/,
        'les quatre façons de reprendre la main doivent être écoutées');
    assert.ok(!/Math\.abs\(window\.scrollY - /.test(f),
        'comparer scrollY à ce qu’on a posé abandonne dès la première image chargée');
    assert.match(f, /removeEventListener/,
        'les écouteurs doivent être retirés : ils survivraient au chapitre');
});

test('l’ancrage est borné', () => {
    // Rectifier sans fin lutterait contre le lecteur ; une seule fois ne
    // suffit pas. Quatorze passes de 130 ms, soit moins de deux secondes.
    const f = corps('function applyInitialScroll(page)');
    assert.match(f, /if \(\+\+essais < 14\) setTimeout\(viser, 130\);/);
});

// ── 3. La boîte réservée ──
test('un marque-place réserve la place d’une planche, en pixels', () => {
    const f = corps('function boiteReservee(idx)');
    assert.match(f, /window\.innerHeight \* PLAFOND_VH/,
        'la hauteur est bornée par le max-height de la feuille');
    assert.match(f, /Math\.round\(h \/ ratio\)/,
        'et la largeur en découle, comme object-fit: contain la calcule');

    const ph = corps('function placeholderImg(idx)');
    assert.match(ph, /width:\$\{b\.w\}px;height:\$\{b\.h\}px/,
        'le marque-place doit porter une boîte en pixels');
    assert.ok(!/aspect-ratio:1\/\$\{ratioOf\(idx\)\}/.test(ph),
        'width:100% + aspect-ratio ne réservait que 120 px de haut');
});

test('le plafond suit la feuille de style, et on le dit', () => {
    // Si `max-height` change dans chapitre.css sans que cette constante
    // suive, la réserve redevient fausse — en silence.
    assert.match(SRC, /const PLAFOND_VH = 0\.88;/);
    const css = fs.readFileSync(
        path.join(__dirname, '..', '..', 'assets', 'css', 'chapitre.css'), 'utf8');
    assert.match(css, /\.reader-page-img \{[\s\S]*?max-height: 88vh;/,
        'la feuille doit toujours plafonner à 88vh');
});

test('une planche chargée repose sa boîte avec son vrai ratio', () => {
    // Sans ça, décharger une page lointaine lui rendrait la boîte par défaut
    // et ferait sauter tout ce qui est en dessous.
    const i = SRC.indexOf('pageRatios.set(idx, r);');
    assert.notEqual(i, -1);
    const suite = SRC.slice(i, i + 400);
    assert.match(suite, /const b = boiteReservee\(idx\);/);
    assert.match(suite, /img\.style\.height = b\.h \+ 'px';/);
});
