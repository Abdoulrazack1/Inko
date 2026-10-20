// ============================================================
// test/unit/lecture-continue.test.js — le chapitre suivant s'enchaîne
// en défilement, sans rechargement
// ------------------------------------------------------------
// Vérifié dans le vrai lecteur (Chromium, deux chapitres de 6 planches
// 800 × 1800, enchaînement automatique coché) :
//   · à la fin du chapitre 1, « Chap. 2 » s'accroche dessous, l'adresse
//     reste celle du chapitre 1 ;
//   · le titre passé, bascule sur place : adresse, titre de l'onglet, titre
//     lu (h1), compteur et pourcentage passent au chapitre 2 ; pas de compte
//     à rebours « chapitre suivant dans 5 s » ;
//   · la planche 3 de la suite était à −150 px du haut de l'écran avant la
//     bascule ; après, la planche 3 du chapitre courant est à −151 px. Même
//     hauteur (696 px) : aucun saut.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'chapitre.js'), 'utf8');
const extraire = (debut) => {
    const i = SRC.indexOf(debut);
    let j = SRC.indexOf('{', i), n = 0;
    for (; j < SRC.length; j++) { if (SRC[j] === '{') n++; else if (SRC[j] === '}' && --n === 0) break; }
    return SRC.slice(i, j + 1);
};

test('la suite se prépare à l\'avant-dernière planche, en défilement seulement, si l\'option est active', () => {
    assert.match(SRC, /if \(readMode === 'scroll' && rs\.continu === '1' && p >= totalPages - 1\) preparerSuite\(\);/);
    const f = extraire('async function preparerSuite(');
    assert.match(f, /if \(suite \|\| readMode !== 'scroll'\) return;/, 'une seule suite à la fois');
    assert.match(f, /if \(readMode !== 'scroll' \|\| currentChap\.id !== pourChap \|\| !suite \|\| suite\.chap !== chap\) return;/,
        'une réponse arrivée après un changement de mode ou de chapitre est ignorée');
});

test('le compte à rebours « chapitre suivant » ne double pas la lecture continue', () => {
    assert.match(SRC, /autoNextActif\(\) && !\(readMode === 'scroll' && rs\.continu === '1'\)\) armerEnchainement/);
});

test('la bascule garde la planche lue au même pixel', () => {
    const f = extraire('function basculerSurSuite(');
    assert.match(f, /const k = \+ancre\.dataset\.i, haut = ancre\.getBoundingClientRect\(\)\.top;/);
    assert.match(f, /pageRatios\.clear\(\);\s*s\.ratios\.forEach\(\(r, i\) => \{ if \(r\) pageRatios\.set\(i, r\); \}\);/,
        'les marque-places reçoivent les formats déjà mesurés');
    assert.match(f, /window\.scrollBy\(\{ top: img\.getBoundingClientRect\(\)\.top - haut, behavior: 'instant' \}\)/,
        'compensation instantanée : le document défile en douceur');
    // Mêmes classes, donc même CSS et même boîte que les marque-places.
    assert.match(extraire('async function preparerSuite('), /class="reader-page-img reader-suite-img"/);
});

test('la bascule met à jour tout ce qui nomme le chapitre, sans rechargement', () => {
    const f = extraire('function basculerSurSuite(');
    for (const attendu of ['history.replaceState(', "getElementById('pageTitle')", "getElementById('readerTitreA11y')",
        'renderToolbar();', 'renderPage(currentPage);', 'renderNavigation();', 'renderNextChapter();', 'saveProgress();', 'preloadNextChapter();']) {
        assert.ok(f.includes(attendu), `manque : ${attendu}`);
    }
    assert.ok(!/location\.href\s*=/.test(f), 'pas de navigation');
});

test('un nouveau rendu (zoom, mode) oublie la suite accrochée', () => {
    assert.match(extraire('function renderScroll('), /suite = null;/);
    assert.match(SRC, /rs\.continu = window\.Storage\?\.getPref\('reader_continu'\) === '0' \? '0' : '1';/);
});
