// ============================================================
// test/unit/echelle-espacement.test.js — huit pas, et plus un seul impair
// ------------------------------------------------------------
// MESURE AVANT : **1 448 valeurs en pixels** dans les marges, remplissages
// et gouttières des feuilles, pour **35 valeurs distinctes — dont 183
// impaires**.
//
//     8px  186     12px 156     16px  92     5px 43
//     10px 178     14px 110      2px  78     7px 34
//     6px  162      4px 109     20px  55     9px 31
//
// Un 7 px n'est pas un choix : c'est un réglage à l'œil qu'on ne sait plus
// justifier six mois plus tard, et qui oblige le suivant à régler le sien
// juste à côté.
//
// CETTE PASSE ne déplace presque rien, et c'est voulu :
//
//     660 déclarations déjà sur l'échelle  →  jeton, 0 px de mouvement
//     156 déclarations impaires            →  jeton, 1 px exactement
//
// Vérifié dans le navigateur, accueil, en comparant la géométrie de chaque
// élément AVANT et APRÈS :
//
//     541 éléments, 62 déplacés
//     écart maximal : x 0 · y 2 · largeur 2 · hauteur 2 pixels
//     hauteur de page : 2 630 px avant, 2 630 px après
//
// Restent 629 valeurs paires hors échelle (6 · 10 · 14 · 18 · 20 · 22…).
// Les rabattre est une décision de mise en page, pas un renommage : 10 px
// devient 8 ou 12, et l'écart se cumule dans une rangée de six enfants. Ça
// se fait à vue, pas au script — et ce test les plafonne en attendant.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const CSS_DIR = path.join(RACINE, 'assets', 'css');
const lire = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const GLOBAL = lire(path.join(CSS_DIR, 'global.css'));
const FEUILLES = fs.readdirSync(CSS_DIR).filter((f) => f.endsWith('.css'));

const ECHELLE = [2, 4, 8, 12, 16, 24, 32, 48];
const PROP = /\b(?:padding|margin|gap|row-gap|column-gap)(?:-top|-right|-bottom|-left)?:[^;}]+/g;

test('les huit pas existent et montent', () => {
    let precedent = 0;
    ECHELLE.forEach((attendu, i) => {
        const m = new RegExp('--sp-' + i + ':\\s*(\\d+)px;').exec(GLOBAL);
        assert.ok(m, '--sp-' + i + ' doit être défini');
        assert.equal(Number(m[1]), attendu);
        assert.ok(Number(m[1]) > precedent, 'les pas doivent monter');
        precedent = Number(m[1]);
    });
});

test('le plus petit pas reste un filet, pas un espace', () => {
    // 2 px sert entre deux éléments collés — une pastille contre son texte,
    // deux puces d'une même ligne. Rien de plus fin n'a de sens à l'écran,
    // et le supprimer obligerait à écrire 1px ou 3px en dur à 78 endroits.
    assert.match(GLOBAL, /--sp-0:\s*2px;/);
});

test('aucune feuille ne porte plus de valeur impaire', () => {
    // C'est le vrai apport de cette passe : 3, 5, 7, 9, 11, 13 et 17 ne sont
    // pas des choix, ce sont des restes.
    const coupables = [];
    for (const f of FEUILLES) {
        for (const d of lire(path.join(CSS_DIR, f)).match(PROP) || []) {
            for (const v of d.match(/\b(\d+)px/g) || []) {
                const n = Number(v.slice(0, -2));
                if (n >= 3 && n % 2 === 1) coupables.push(f + ' : ' + d.trim().slice(0, 70));
            }
        }
    }
    assert.deepEqual([...new Set(coupables)], [], [...new Set(coupables)].join('\n'));
});

test('les valeurs déjà sur l’échelle passent par leur jeton', () => {
    // Sinon l'échelle existe sans servir, et la prochaine main écrira 8px.
    const coupables = [];
    for (const f of FEUILLES) {
        for (const d of lire(path.join(CSS_DIR, f)).match(PROP) || []) {
            // Une marge NÉGATIVE n'est pas un pas de l'échelle : elle tire un
            // élément en arrière. L'écrire `calc(-1 * var(--sp-1))` serait plus
            // bruyant que `-4px` pour les deux cas du dépôt, et mélanger un
            // jeton et un littéral dans le même raccourci serait pire encore.
            if (/calc\(/.test(d) || /:\s*[^;]*-\d/.test(d)) continue;
            for (const v of d.match(/\b(\d+)px/g) || []) {
                if (ECHELLE.includes(Number(v.slice(0, -2)))) coupables.push(f + ' : ' + d.trim().slice(0, 70));
            }
        }
    }
    assert.deepEqual([...new Set(coupables)].slice(0, 5), [],
        'ces déclarations écrivent une valeur de l’échelle au lieu de son jeton');
});

// ── Le cliquet ──
// Les paires hors échelle (6 · 10 · 14 · 18 · 20 · 22…) restent, plafonnées.
const PLAFOND_HORS_ECHELLE = 629;

test('les valeurs hors échelle ne se multiplient pas', () => {
    let n = 0;
    for (const f of FEUILLES) {
        for (const d of lire(path.join(CSS_DIR, f)).match(PROP) || []) {
            for (const v of d.match(/\b(\d+)px/g) || []) {
                const x = Number(v.slice(0, -2));
                if (!ECHELLE.includes(x)) n++;
            }
        }
    }
    assert.ok(n <= PLAFOND_HORS_ECHELLE,
        n + ' valeurs hors échelle, plafond ' + PLAFOND_HORS_ECHELLE
        + '. Une nouvelle valeur doit venir de l’échelle.');
});

test('le calc() n’est pas touché', () => {
    // `calc(100% - 24px)` n'est pas un espacement de l'échelle : c'est une
    // soustraction de mise en page, et y substituer un jeton la rendrait
    // illisible sans rien gagner.
    const tout = FEUILLES.map((f) => lire(path.join(CSS_DIR, f))).join('\n');
    assert.match(tout, /calc\([^)]*\d+px/, 'les calculs de mise en page doivent survivre');
});
