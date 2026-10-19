// ============================================================
// test/unit/graphiques-themes.test.js — un graphique doit être lisible dans
// le thème où on le regarde
// ------------------------------------------------------------
// Les couleurs des graphiques étaient écrites en dur dans stats.js et
// profil.js : huit teintes Tailwind, identiques dans les quatre thèmes.
// Mesuré contre le fond de carte, le plus faible aplat donnait :
//
//     clair      1,69      contraste renforcé  1,92      sombre  4,52
//
// La WCAG 1.4.11 demande 3:1 pour un objet graphique porteur de sens.
// L'édition sombre passait — elle avait été travaillée — les deux éditions
// claires non. C'est le même schéma que l'audit du thème clair avait déjà
// relevé ailleurs : ce qui n'est exercé par aucun test dérive.
//
// Deux couleurs de TEXTE traînaient dans le même lot, et celles-là relèvent
// du seuil de 4,5:1 :
//
//     les étoiles d'une note, #f59e0b   1,69 sur --bg2 clair, 1,52 sur --bg3
//     « Erreur de chargement », #ef4444 2,96 sur --bg2 clair
//
// Elles passent désormais par --amber-text et --red-text, qui existaient
// déjà et que chaque thème redéfinit.
//
// Vérifié dans le navigateur : les onze segments du graphe de répartition,
// mesurés contre le fond réel de leur carte, donnent 3,89 à 3,91 en clair,
// 7,45 à 7,53 en contraste renforcé, et 4,52 à 8,32 en sombre — inchangé.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const lire = (...p) => fs.readFileSync(path.join(RACINE, ...p), 'utf8').replace(/\r\n/g, '\n');
const CSS = lire('assets', 'css', 'global.css');

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

function bloc(selecteur) {
    const aiguille = selecteur + ' {';
    for (let i = CSS.indexOf(aiguille); i !== -1; i = CSS.indexOf(aiguille, i + 1)) {
        const corps = CSS.slice(i, CSS.indexOf('\n}', i));
        if (corps.includes('--bg4:')) return corps;
    }
    assert.fail('bloc de palette introuvable : ' + selecteur);
}

function jeton(corps, nom, selecteur) {
    const m = new RegExp('--' + nom + ':\\s*(#[0-9a-f]{6})\\s*;', 'i').exec(corps);
    assert.ok(m, selecteur + ' doit définir --' + nom + ' en couleur littérale');
    return hex(m[1]);
}

const THEMES = [
    [':root', 'édition claire (Washi)'],
    ['html[data-theme="dark"]', 'édition sombre (Sumi)'],
    ['html[data-theme="amoled"]', 'AMOLED'],
    ['html[data-theme="contrast"]', 'contraste renforcé'],
];

// WCAG 1.4.11 pour un aplat qui porte du sens ; 1.4.3 pour du texte.
const SEUIL_APLAT = 3.0;
const SEUIL_TEXTE = 4.5;

for (const [selecteur, nom] of THEMES) {
    test('graphiques ' + nom + ' : chaque série se détache de la carte', () => {
        const corps = bloc(selecteur);
        const fond = jeton(corps, 'bg2', selecteur);
        for (let n = 1; n <= 8; n++) {
            const c = jeton(corps, 'graph-' + n, selecteur);
            const r = rapport(c, fond);
            assert.ok(r >= SEUIL_APLAT,
                '--graph-' + n + ' à ' + r.toFixed(2) + ' sur --bg2 : un aplat qu’on devine');
        }
    });

    test('graphiques ' + nom + ' : les couleurs de texte tiennent le seuil de lecture', () => {
        // Étoiles d'une note et messages d'erreur. Mesurés sur les DEUX fonds
        // où ils apparaissent : --bg2 est plus clément que --bg3, et c'est
        // sur --bg3 que l'ancien #f59e0b tombait le plus bas (1,52).
        const corps = bloc(selecteur);
        for (const surface of ['bg2', 'bg3']) {
            const fond = jeton(corps, surface, selecteur);
            for (const t of ['amber-text', 'red-text']) {
                const r = rapport(jeton(corps, t, selecteur), fond);
                assert.ok(r >= SEUIL_TEXTE,
                    '--' + t + ' à ' + r.toFixed(2) + ' sur --' + surface);
            }
        }
    });
}

test('les critères rejettent bien les couleurs remplacées', () => {
    // Sans ceci, les tests ci-dessus prouvent seulement que les jetons
    // existent. On repasse les valeurs d'avant dans le même critère, contre
    // le fond de l'édition claire, et on exige qu'elles soient rejetées.
    const fond = jeton(bloc(':root'), 'bg2', ':root');
    const AVANT = ['#ff8c42', '#3b82f6', '#22c55e', '#a855f7', '#f59e0b', '#ef4444', '#14b8a6', '#ec4899'];
    const faibles = AVANT.filter((c) => rapport(hex(c), fond) < SEUIL_APLAT);
    assert.ok(faibles.length >= 4,
        'seulement ' + faibles.length + ' ancienne(s) couleur(s) sous ' + SEUIL_APLAT
        + ' — le seuil ne protège rien');
    assert.ok(rapport(hex('#f59e0b'), fond) < SEUIL_TEXTE, 'l’ancien jaune des étoiles doit échouer');
    assert.ok(rapport(hex('#ef4444'), fond) < SEUIL_TEXTE, 'l’ancien rouge des erreurs doit échouer');
});

// ── Les pages prennent les jetons ──
test('stats.js ne porte plus sa propre palette', () => {
    const src = lire('assets', 'js', 'stats.js');
    assert.match(src, /const PALETTE = \[1, 2, 3, 4, 5, 6, 7, 8\]\.map/,
        'la palette des sources doit être dérivée des jetons');
    for (const statut of ['reading', 'completed', 'planned', 'paused', 'dropped']) {
        const m = new RegExp(statut + ": \\['[^']+', 'var\\(--graph-[1-8]\\)'\\]").exec(src);
        assert.ok(m, 'le statut « ' + statut + ' » doit prendre un jeton');
    }
    assert.ok(!/color:#[0-9a-f]{3,6}/i.test(src),
        'aucune couleur de texte littérale ne doit rester');
});

test('profil.js ne porte plus de couleur littérale de texte', () => {
    const src = lire('assets', 'js', 'profil.js');
    assert.ok(!/color:#[0-9a-f]{3,6}/i.test(src),
        'étoiles et messages d’erreur passent par --amber-text et --red-text');
    assert.match(src, /var\(--amber-text\)/, 'les étoiles doivent prendre --amber-text');
    assert.match(src, /var\(--red-text\)/, 'les erreurs doivent prendre --red-text');
});
