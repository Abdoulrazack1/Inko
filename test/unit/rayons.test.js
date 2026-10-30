// ============================================================
// test/unit/rayons.test.js — cinq rayons, pas vingt-deux
// ------------------------------------------------------------
// MESURE AVANT : 22 valeurs distinctes pour 374 déclarations en dur,
// pendant que `--radius`, `--radius2` et `--radius3` existaient et se
// faisaient contourner 374 fois contre 72 usages.
//
//     2 · 3 · 4                           93 déclarations
//     5 · 6 · 7 · 8 · 9                  135
//     10 · 11 · 12 · 13 · 14             106
//     16 · 18 · 20 · 22 · 24 · 28 · 30    40
//     99 · 999                            15   (gélules)
//
// CINQ pas, et non quatre comme le chantier le prévoyait. Rien dans
// « pastille, contrôle, carte, feuille » ne couvre une barre de 4 px de
// haut — et il y en a 93 : jauges, squelettes, ascenseurs, vignettes. Leur
// imposer le rayon d'un bouton en ferait des losanges. C'est la mesure qui
// a imposé le cinquième pas, pas le goût.
//
// Vérifié dans le navigateur, accueil, en comparant le rendu AVANT et
// APRÈS sur les mêmes éléments :
//
//     330 éléments portent un rayon avant, 330 après — aucun perdu
//     89 déplacés, et le plus grand écart vaut 2 px
//         10 → 12  (60 cartes)      6 → 8   (12 contrôles)
//         4 → 3    (14 barres)      18 → 20 (3 grandes surfaces)
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const lire = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const CSS_DIR = path.join(RACINE, 'assets', 'css');
const GLOBAL = lire(path.join(CSS_DIR, 'global.css'));

const PAS = { 'r-trait': 3, 'r-controle': 8, 'r-carte': 12, 'r-feuille': 20, 'r-pastille': 999 };

test('les cinq pas existent et montent', () => {
    let precedent = 0;
    for (const [nom, attendu] of Object.entries(PAS)) {
        const m = new RegExp('--' + nom + ':\\s*(\\d+)px;').exec(GLOBAL);
        assert.ok(m, '--' + nom + ' doit être défini');
        assert.equal(Number(m[1]), attendu);
        assert.ok(Number(m[1]) > precedent, nom + ' doit dépasser le pas précédent');
        precedent = Number(m[1]);
    }
});

test('le pas le plus fin reste plus petit que ce qu’il habille', () => {
    // 93 déclarations portaient 2, 3 ou 4 px, sur des éléments de 3 à 4 px de
    // haut. Au-delà de 4 px, le rayon dépasserait la demi-hauteur de ces
    // barres et les transformerait en losanges.
    const m = /--r-trait:\s*(\d+)px;/.exec(GLOBAL);
    assert.ok(Number(m[1]) <= 4, 'le pas « trait » doit rester sous 4 px');
});

test('les anciens jetons deviennent des alias, pas une seconde vérité', () => {
    // 72 usages de --radius / --radius2 / --radius3 existaient. Les laisser
    // porter leur propre valeur aurait fait deux définitions du même rayon,
    // qui finissent toujours par diverger.
    assert.match(GLOBAL, /--radius:\s*var\(--r-carte\);/);
    assert.match(GLOBAL, /--radius2:\s*var\(--r-controle\);/);
    assert.match(GLOBAL, /--radius3:\s*var\(--r-feuille\);/);
});

test('aucune feuille ne porte plus de rayon littéral en pixels', () => {
    const coupables = [];
    for (const f of fs.readdirSync(CSS_DIR).filter((f) => f.endsWith('.css'))) {
        const restantes = lire(path.join(CSS_DIR, f)).match(/border-radius:\s*[0-9.]+px/g) || [];
        if (restantes.length) coupables.push(f + ' : ' + restantes.join(', '));
    }
    assert.deepEqual(coupables, [],
        'ces feuilles contournent encore l’échelle :\n' + coupables.join('\n'));
});

test('les cercles et les gélules restent ce qu’ils sont', () => {
    // `50%` n'est pas un rayon de l'échelle : c'est un cercle, et le ramener
    // à un pas en ferait un carré arrondi. Même chose pour les gélules.
    const tout = fs.readdirSync(CSS_DIR)
        .filter((f) => f.endsWith('.css'))
        .map((f) => lire(path.join(CSS_DIR, f))).join('\n');
    assert.ok(/border-radius:\s*50%/.test(tout), 'les cercles doivent survivre à la migration');
    assert.ok(/var\(--r-pastille\)/.test(tout), 'et les gélules passer par leur pas');
});

// ── Le cliquet ──
// Les pages et les styles en ligne ne sont pas migrés : 138 déclarations.
// Plafonnées à leur niveau du jour, elles ne peuvent que descendre.
const PLAFOND_PAGES = 138;

// `systeme.html` AFFICHE l’échelle : y écrire « 12px » est du CONTENU, pas
// de la dette. On l’exclut du décompte plutôt que de relever le plafond —
// un cliquet qu’on relâche n’en est plus un.
const VITRINE = ['systeme.html'];

test('la dette des pages et des scripts ne remonte pas', () => {
    const fichiers = [
        ...fs.readdirSync(RACINE).filter((f) => f.endsWith('.html') && !VITRINE.includes(f))
            .map((f) => path.join(RACINE, f)),
        ...fs.readdirSync(path.join(RACINE, 'assets', 'js')).filter((f) => f.endsWith('.js'))
            .map((f) => path.join(RACINE, 'assets', 'js', f)),
    ];
    const n = fichiers
        .map((f) => (lire(f).match(/border-radius:\s*[0-9.]+px/g) || []).length)
        .reduce((a, b) => a + b, 0);
    assert.ok(n <= PLAFOND_PAGES,
        n + ' rayons littéraux dans les pages et les scripts, plafond ' + PLAFOND_PAGES);
});
