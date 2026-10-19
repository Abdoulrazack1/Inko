// ============================================================
// test/unit/heatmap-echelle.test.js — un dégradé séquentiel doit progresser
// ------------------------------------------------------------
// La heatmap de lecture existait en QUATRE copies de la même échelle : les
// cases de stats.html, la légende de stats.js, les cases et la légende du
// profil. Aucune ne progressait régulièrement. Pas de contraste WCAG mesurés
// entre paliers voisins, AVANT :
//
//     stats, sombre   1,11   1,78   2,10   1,57
//     stats, clair    8,44   1,78   2,10   1,57
//     profil, clair   1,06   1,19   1,28   2,00
//
// Les deux bouts du défaut :
//
//   — à 1,11, « rien lu » et « un peu lu » sont la même case. L'information
//     que la grille existe pour porter — ai-je lu ce jour-là — disparaît.
//   — à 8,44, le premier palier fait une falaise : l'œil y lit deux
//     catégories, pas deux degrés d'une même mesure.
//
// Un dégradé séquentiel se lit par la RÉGULARITÉ de ses pas, pas par la
// vivacité de ses couleurs. C'est ce que ce test vérifie, thème par thème,
// sur les jetons --hm0..--hm4 : chaque pas visible, et tous du même ordre.
//
// Vérifié dans le navigateur avant d'écrire ces seuils : les quatre thèmes
// rendent bien les jetons (une case .hm i.l2 calculée à rgb(161,82,28)).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const lire = (...p) => fs.readFileSync(path.join(RACINE, ...p), 'utf8').replace(/\r\n/g, '\n');
const CSS = lire('assets', 'css', 'global.css');

// ── Contraste WCAG ──
const lin = (c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
};
const luminance = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const rapport = (a, b) => {
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));

// ── Lecture des jetons, bloc de thème par bloc de thème ──
function bloc(selecteur) {
    // Un même sélecteur apparaît plusieurs fois (les ombres sont groupées en
    // « dark, amoled »). On retient le bloc qui porte la palette.
    const aiguille = selecteur + ' {';
    for (let i = CSS.indexOf(aiguille); i !== -1; i = CSS.indexOf(aiguille, i + 1)) {
        const corps = CSS.slice(i, CSS.indexOf('\n}', i));
        if (corps.includes('--bg4:')) return corps;
    }
    assert.fail('bloc de palette introuvable : ' + selecteur);
}

function echelle(selecteur) {
    const b = bloc(selecteur);
    return [0, 1, 2, 3, 4].map((n) => {
        const m = new RegExp('--hm' + n + ':\\s*([^;]+);').exec(b);
        assert.ok(m, selecteur + ' doit définir --hm' + n);
        const v = m[1].trim();
        if (v === 'var(--bg4)') {
            const f = /--bg4:\s*(#[0-9a-f]{6});/i.exec(b);
            assert.ok(f, selecteur + ' : --bg4 doit être une couleur littérale');
            return hex(f[1]);
        }
        assert.match(v, /^#[0-9a-f]{6}$/i, selecteur + ' --hm' + n + ' : couleur attendue, vu « ' + v + ' »');
        return hex(v);
    });
}

const THEMES = [
    [':root', 'édition claire (Washi)'],
    ['html[data-theme="dark"]', 'édition sombre (Sumi)'],
    ['html[data-theme="amoled"]', 'AMOLED'],
    ['html[data-theme="contrast"]', 'contraste renforcé'],
];

// Seuils. Le plancher dit « ce pas se voit » ; le plafond dit « ce pas ne
// fait pas rupture ». Les deux ensemble disent « c'est un dégradé ».
const PAS_MIN = 1.35;
const PAS_MAX = 2.20;
const IRREGULARITE_MAX = 1.20;  // pas le plus large / pas le plus étroit

for (const [selecteur, nom] of THEMES) {
    test('échelle ' + nom + ' : chaque palier se distingue du précédent', () => {
        const pal = echelle(selecteur);
        for (let i = 1; i < pal.length; i++) {
            const r = rapport(pal[i - 1], pal[i]);
            assert.ok(r >= PAS_MIN,
                'pas ' + (i - 1) + '→' + i + ' à ' + r.toFixed(2) + ' : deux paliers qu’on ne sépare pas');
            assert.ok(r <= PAS_MAX,
                'pas ' + (i - 1) + '→' + i + ' à ' + r.toFixed(2) + ' : rupture, l’œil y lit deux catégories');
        }
    });

    test('échelle ' + nom + ' : les pas sont du même ordre', () => {
        // Le vrai défaut n'était pas la valeur d'un pas mais leur écart entre
        // eux : 1,11 puis 2,10 dans la même grille.
        const pal = echelle(selecteur);
        const pas = [];
        for (let i = 1; i < pal.length; i++) pas.push(rapport(pal[i - 1], pal[i]));
        const ecart = Math.max(...pas) / Math.min(...pas);
        assert.ok(ecart <= IRREGULARITE_MAX,
            'pas ' + JSON.stringify(pas.map((p) => +p.toFixed(2))) + ' — écart ' + ecart.toFixed(2)
            + ' : un dégradé séquentiel se lit par la régularité de ses pas');
    });

    test('échelle ' + nom + ' : elle monte, elle ne fait pas d’aller-retour', () => {
        const pal = echelle(selecteur).map(luminance);
        const sens = Math.sign(pal[1] - pal[0]);
        assert.notEqual(sens, 0, 'le premier palier doit quitter le fond');
        for (let i = 1; i < pal.length; i++) {
            assert.equal(Math.sign(pal[i] - pal[i - 1]), sens,
                'palier ' + i + ' : la luminance repart en arrière — « plus » doit toujours aller du même côté');
        }
    });
}

// ── Les seuils ont-ils des dents ? ──
// Sans ce test, les trois précédents prouvent seulement que les jetons
// existent : lancés contre l'ancien code ils échouent sur « --hm0 absent »,
// ce qui ne dit rien de la régularité. Ici on repasse les échelles
// REMPLACÉES dans les mêmes critères, et on exige qu'elles soient rejetées.
const AVANT = [
    ['stats, sombre', ['#26262c', '#4a2410', '#8a3d12', '#d2691e', '#ff8c42']],
    ['stats, clair', ['#d1ccbe', '#4a2410', '#8a3d12', '#d2691e', '#ff8c42']],
    // profil : rgba(255,107,26,α) composé sur la carte (--bg2), déjà aplati.
    ['profil, clair', ['#d1ccbe', '#ecccb4', '#f1b48d', '#f88f54', '#c1531b']],
    ['profil, sombre', ['#26262c', '#45281b', '#74391b', '#b9521a', '#c1531b']],
];

for (const [nom, pal] of AVANT) {
    test('les critères rejettent bien l’échelle « ' + nom + ' »', () => {
        const c = pal.map(hex);
        const pas = [];
        for (let i = 1; i < c.length; i++) pas.push(rapport(c[i - 1], c[i]));
        const rejets = [];
        pas.forEach((r, i) => {
            if (r < PAS_MIN) rejets.push('pas ' + i + '→' + (i + 1) + ' à ' + r.toFixed(2) + ' (invisible)');
            if (r > PAS_MAX) rejets.push('pas ' + i + '→' + (i + 1) + ' à ' + r.toFixed(2) + ' (rupture)');
        });
        const ecart = Math.max(...pas) / Math.min(...pas);
        if (ecart > IRREGULARITE_MAX) rejets.push('écart ' + ecart.toFixed(2));
        assert.ok(rejets.length > 0,
            nom + ' passerait les critères — ils ne protègent rien : '
            + JSON.stringify(pas.map((p) => +p.toFixed(2))));
    });
}

// ── Une seule échelle, pas quatre ──
const CONSOMMATEURS = [
    ['stats.html', ['stats.html'], 4],
    ['la légende de stats.js', ['assets', 'js', 'stats.js'], 5],
    ['la légende du profil', ['profil.html'], 5],
    ['les deux grilles du profil', ['assets', 'js', 'profil.js'], 10],
];

for (const [nom, chemin, minimum] of CONSOMMATEURS) {
    test(nom + ' prend les jetons, ne recopie pas l’échelle', () => {
        const src = lire(...chemin);
        const jetons = (src.match(/var\(--hm[0-4]\)/g) || []).length;
        assert.ok(jetons >= minimum,
            nom + ' : ' + jetons + ' référence(s) à var(--hm*), ' + minimum + ' attendues');
        // Les valeurs exactes des quatre copies d'origine. Qu'une seule
        // revienne et l'échelle recommence à diverger d'un écran à l'autre.
        // #ff8c42 n'y figure pas : contrairement aux trois bruns et aux
        // alphas, il sert ailleurs pour de bon (dégradé de l'objectif
        // hebdomadaire, palette catégorielle des sources).
        for (const copie of ['#4a2410', '#8a3d12', '#d2691e',
            'rgba(255,107,26,.2)', 'rgba(255,107,26,.4)', 'rgba(255,107,26,.45)',
            'rgba(255,107,26,.7)', 'rgba(255,107,26,.75)']) {
            assert.ok(!src.includes(copie),
                nom + ' contient encore « ' + copie + ' » — l’échelle est définie dans global.css');
        }
    });
}
