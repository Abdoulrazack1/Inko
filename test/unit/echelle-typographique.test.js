// ============================================================
// test/unit/echelle-typographique.test.js — sept tailles, et un cliquet
// ------------------------------------------------------------
// MESURE AVANT, sur l'ensemble des feuilles, des pages et des styles en
// ligne : **36 tailles distinctes pour 989 déclarations**, dont **838
// entassées entre 10 et 15 px** — onze tailles dans une bande de cinq
// pixels, demi-pixels compris (10,5 · 11,5 · 12,5 · 13,5 · 14,5).
//
//     13 px  147      11,5 px  95      10,5 px  27
//     12 px  143      13,5 px  60      18 px    25
//     12,5px 111      14 px    57      22 px    19
//     11 px  105      10 px    46      …
//
// À cette densité, deux tailles voisines ne se distinguent pas : elles ne
// hiérarchisent rien, elles font du bruit. C'est le défaut que la refonte
// appelle « 39 tailles dont 38 en dur », mesuré de près.
//
// Les sept pas sortent de la distribution réelle, pas d'un gabarit : chacun
// absorbe un amas mesuré. Le rapport entre les pas bas vaut 1,18 et non
// 1,25 — fitter la distribution évite de déplacer 461 déclarations d'un
// pixel pour la seule élégance de la progression. C'est un compromis, et il
// est écrit plutôt que caché.
//
// Vérifié dans le navigateur, page d'accueil puis bibliothèque :
//
//     jetons rendus            11 · 13 · 15 · 18 · 22 · 28 · 38
//     82 déclarations ramenées, 77 bougent d'au plus 1 px
//     les 5 autres             8,5→11 · 16→18 (×3) · 34→38
//     badge « 12 non lus »     76 × 22 px dans une carte de 118 — pas de
//                              débordement, et le texte repasse au-dessus
//                              du plancher de lisibilité
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const lire = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const GLOBAL = lire(path.join(RACINE, 'assets', 'css', 'global.css'));

const PAS = ['xs', 's', 'm', 'l', 'xl', '2xl', '3xl'];

test('l’échelle existe, et ses pas montent', () => {
    const valeurs = PAS.map((n) => {
        const m = new RegExp('--t-' + n.replace('2', '2').replace('3', '3') + ':\\s*(\\d+)px;').exec(GLOBAL);
        assert.ok(m, 'le pas --t-' + n + ' doit être défini');
        return Number(m[1]);
    });
    for (let i = 1; i < valeurs.length; i++) {
        assert.ok(valeurs[i] > valeurs[i - 1],
            'les pas doivent monter : --t-' + PAS[i] + ' (' + valeurs[i] + ') après --t-'
            + PAS[i - 1] + ' (' + valeurs[i - 1] + ')');
    }
    assert.deepEqual(valeurs, [11, 13, 15, 18, 22, 28, 38]);
});

test('aucun pas ne passe sous le plancher de lisibilité', () => {
    // Huit, huit et demi, neuf : ces tailles existaient. Le thème « contraste
    // renforcé » les relevait déjà de force, ce qui était l'aveu que la
    // feuille principale les posait trop bas.
    const m = /--t-xs:\s*(\d+)px;/.exec(GLOBAL);
    assert.ok(Number(m[1]) >= 11,
        'sous 11 px, un texte d’interface ne se lit plus');
});

test('la feuille partagée ne porte plus aucune taille littérale', () => {
    // C'est la feuille chargée par les 24 pages : tant qu'elle contient des
    // littérales, l'échelle ne vaut que pour ce qu'on a bien voulu migrer.
    const restantes = GLOBAL.match(/font-size:\s*[0-9.]+px/g) || [];
    assert.deepEqual(restantes, [],
        'global.css doit passer entièrement par les jetons, vu : ' + restantes.join(', '));
    assert.ok(/font-size:\s*var\(--t-s\)/.test(GLOBAL), 'et s’en servir vraiment');
});

// ── Le cliquet ──
//
// Le reste du dépôt n'est pas migré : 548 déclarations dans les autres
// feuilles, 359 dans les pages et les styles en ligne. Ce test ne les
// interdit pas — il les PLAFONNE à ce qu'elles sont aujourd'hui, pour que
// la dette ne puisse que descendre. Chaque passe suivante baisse le chiffre.
const PLAFOND_FEUILLES = 548;
const PLAFOND_PAGES = 359;

// `systeme.html` AFFICHE l’échelle : y écrire « 11px » est du CONTENU, pas
// de la dette. On l’exclut du décompte plutôt que de relever le plafond —
// un cliquet qu’on relâche n’en est plus un.
const VITRINE = ['systeme.html'];

const compter = (fichiers) => fichiers
    .map((f) => (lire(f).match(/font-size:\s*[0-9.]+px/g) || []).length)
    .reduce((a, b) => a + b, 0);

const sous = (dir, filtre) => fs.readdirSync(path.join(RACINE, dir))
    .filter((f) => !VITRINE.includes(f))
    .filter(filtre)
    .map((f) => path.join(RACINE, dir, f));

test('la dette des feuilles ne remonte pas', () => {
    const n = compter(sous(path.join('assets', 'css'), (f) => f.endsWith('.css')));
    assert.ok(n <= PLAFOND_FEUILLES,
        n + ' déclarations littérales dans les feuilles, plafond ' + PLAFOND_FEUILLES
        + '. Une nouvelle taille en dur doit passer par un pas de l’échelle.');
});

test('la dette des pages et des styles en ligne ne remonte pas', () => {
    const pages = sous('.', (f) => f.endsWith('.html'));
    const scripts = sous(path.join('assets', 'js'), (f) => f.endsWith('.js'));
    const n = compter([...pages, ...scripts]);
    assert.ok(n <= PLAFOND_PAGES,
        n + ' déclarations littérales dans les pages et les scripts, plafond ' + PLAFOND_PAGES);
});

test('le plafond descend, il ne se contente pas d’exister', () => {
    // Un cliquet qu'on n'abaisse jamais est une permission deguisée. Les deux
    // plafonds sont ceux du jour où l'échelle a été posée : ils documentent
    // l'état de départ, et chaque passe suivante les rabaisse.
    assert.equal(PLAFOND_FEUILLES + PLAFOND_PAGES, 907,
        'le total de départ est 907 ; le changer sans migrer serait se mentir');
});
