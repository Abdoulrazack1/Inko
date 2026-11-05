// ============================================================
// test/unit/modules-selon-le-pointeur.test.js — un garde qui arrive
// après le téléchargement n'a rien gardé
// ------------------------------------------------------------
// `une-main.js` et `tirer-rafraichir.js` commencent tous deux par
//
//     if (!matchMedia('(hover: none)').matches) return;
//
// Ils ne servent qu'au tactile. Mais le garde s'exécutait DANS le
// fichier : sur un bureau, celui-ci était demandé, reçu, analysé et
// exécuté pour rendre la main aussitôt — et cela sur VINGT pages.
//
// La même condition décide désormais du chargement.
//
// Mesuré dans la page, réglages ouverts :
//   bureau   14 scripts, les deux modules absents
//   tactile  15 scripts, les deux chargés (9 + 8 Ko) et actifs
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const lire = (...p) => fs.readFileSync(path.join(RACINE, ...p), 'utf8').replace(/\r\n/g, '\n');
const GLOBAL = lire('assets', 'js', 'global.js');

const CONDITIONNELS = ['une-main.js', 'tirer-rafraichir.js'];

test('aucun gabarit ne les déclare plus', () => {
    const pages = fs.readdirSync(RACINE).filter((f) => f.endsWith('.html'));
    const fautifs = [];
    for (const p of pages) {
        const src = lire(p);
        for (const m of CONDITIONNELS) {
            if (src.includes(`assets/js/${m}`)) fautifs.push(`${p} — ${m}`);
        }
    }
    assert.deepEqual(fautifs, [],
        `déclarés en dur, donc chargés partout :\n  ${fautifs.join('\n  ')}`);
});

test('c’est la même condition que leur propre garde', () => {
    // Si le chargeur et le module ne s'accordaient pas, on aurait soit
    // un module chargé pour rien, soit un module absent là où il sert.
    const bloc = /function modulesDuDoigt\(\) \{([\s\S]*?)\n    \}\)\(\);/.exec(GLOBAL);
    assert.ok(bloc, 'le chargeur');
    assert.match(bloc[1], /!matchMedia\('\(hover: none\)'\)\.matches\) return/);
    for (const m of CONDITIONNELS) {
        assert.match(lire('assets', 'js', m), /!matchMedia\('\(hover: none\)'\)\.matches\) return/,
            `${m} garde la même condition`);
    }
    assert.match(bloc[1], /\['une-main\.js', 'tirer-rafraichir\.js'\]/);
});

test('le précache les garde, lui', () => {
    // Ce qui est conditionnel est le CHARGEMENT, pas la disponibilité
    // hors ligne : un téléphone en a besoin, et il ne doit pas dépendre
    // du réseau pour l'obtenir. Un scan du HTML ne les voit plus.
    const gen = lire('scripts-ci', 'gen-precache.js');
    for (const m of CONDITIONNELS) {
        assert.match(gen, new RegExp(`'/assets/js/${m.replace('.', '\\.')}'`),
            `${m} est listé explicitement`);
    }
    const sw = lire('service-worker.js');
    for (const m of CONDITIONNELS) {
        assert.ok(sw.includes(`/assets/js/${m}`), `${m} est dans le service worker`);
    }
});

test('une page qui l’inclurait quand même n’est pas servie deux fois', () => {
    // Le garde interne des modules protège de la double exécution ; ce
    // test protège du double TÉLÉCHARGEMENT.
    const bloc = /function modulesDuDoigt\(\) \{([\s\S]*?)\n    \}\)\(\);/.exec(GLOBAL)[1];
    assert.match(bloc, /document\.querySelector\(`script\[src\$="\$\{f\}"\]`\)\) continue/);
});

test('les deux modules à cartes restent déclarés par les pages', () => {
    // `cartes-gestes.js` (tactile) et `card-hover.js` (pointeur) ont le
    // même garde, et pourtant ils ne bougent pas : ils ne concernent que
    // les écrans à cartes, quatre ou cinq sur vingt-six. Les charger
    // depuis `global.js` les poserait aussi sur les réglages ou la
    // confidentialité, où il n'y a pas une carte à toucher.
    const bloc = /function modulesDuDoigt\(\) \{([\s\S]*?)\n    \}\)\(\);/.exec(GLOBAL)[1];
    for (const m of ['cartes-gestes.js', 'card-hover.js']) {
        assert.ok(!bloc.includes(m), `${m} n’est pas chargé globalement`);
    }
    const pages = fs.readdirSync(RACINE).filter((f) => f.endsWith('.html'));
    const avecCartes = pages.filter((p) => lire(p).includes('assets/js/cartes-gestes.js'));
    assert.ok(avecCartes.length > 0 && avecCartes.length < pages.length / 2,
        `déclaré sur ${avecCartes.length} pages des ${pages.length} — les pages à cartes`);
});
