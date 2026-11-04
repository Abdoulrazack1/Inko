// ============================================================
// test/unit/gestes-personnalisables.test.js — un balayage se fait par
// réflexe, et le réflexe de chacun ne va pas dans le même sens
// ------------------------------------------------------------
// Les deux balayages étaient écrits en dur :
//
//     (dx > 0 ? marquerSerieLue : telechargerProchain)(contexte(carte))
//
// et l'icône du fond avec (`droite ? '✓' : '⤓'`). Les raccourcis
// CLAVIER, eux, étaient remappables depuis l'audit AMEL-82 — avec une
// liste déclarative, une préférence qui ne garde que les écarts au
// défaut, et une valeur vide qui désactive. Les gestes n'avaient rien
// de tout ça, alors qu'ils sont le seul moyen d'agir vite au doigt.
//
// Qui lit en ligne ne téléchargera presque jamais ; qui prépare un
// trajet ne marquera presque jamais une série lue d'un geste. C'est la
// même action pour tout le monde, et elle ne convient à personne en
// particulier.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const lire = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8')
    .replace(/\r\n/g, '\n');
const GLOBAL = lire('assets', 'js', 'global.js');
const GESTES = lire('assets', 'js', 'cartes-gestes.js');
const PARAM_JS = lire('assets', 'js', 'parametres.js');
const PARAM_HTML = lire('parametres.html');

test('le catalogue vit là où la page des réglages peut le lire', () => {
    // `cartes-gestes.js` n'est chargé que sur les pages qui ont des
    // cartes — pas sur les réglages. Si le catalogue y vivait, la page
    // qui sert à le régler serait précisément celle qui ne le voit pas.
    assert.match(GLOBAL, /window\.MH\.gestesCartes = \{/);
    assert.ok(!/window\.MH\.gestesCartes = \{/.test(GESTES),
        'le module des gestes ne redéclare pas le catalogue');
    // Et il ne garde ici que la DESCRIPTION : les implémentations
    // restent avec les gestes.
    assert.match(GESTES, /const ACTIONS_GESTE = \{\s*\n\s*lue:\s+\(c\) => marquerSerieLue\(c\)/);
});

test('les deux balayages sont décrits, pas écrits en dur', () => {
    const cat = /const GESTES_CARTE = \[([\s\S]*?)\];/.exec(GLOBAL);
    assert.ok(cat, 'la liste des gestes');
    assert.match(cat[1], /id: 'balayageDroite', defaut: 'lue'/);
    assert.match(cat[1], /id: 'balayageGauche', defaut: 'telecharger'/);
    // Les actions proposées sont celles que le menu d'appui long propose
    // déjà : on ne réassigne pas un geste vers quelque chose qui
    // n'existe nulle part ailleurs.
    const act = /const ACTIONS_GESTE = \[([\s\S]*?)\];/.exec(GLOBAL);
    assert.ok(act, 'la table des actions');
    for (const id of ['lue', 'telecharger', 'favori', 'liste', 'aucun']) {
        assert.match(act[1], new RegExp(`id: '${id}'`), `l’action « ${id} »`);
    }
    // Et l'ancien aiguillage en dur a disparu.
    assert.ok(!/dx > 0 \? marquerSerieLue : telechargerProchain/.test(GESTES),
        'plus d’aiguillage écrit en dur');
    assert.ok(!/droite \? '✓' : '⤓'/.test(GESTES),
        'ni d’icône écrite en dur');
});

test('l’icône du fond dit ce que CE balayage fera', () => {
    // Elle annonçait ce que le geste faisait quand elle a été écrite.
    assert.match(GESTES, /f\.firstChild\.textContent = actionGeste\(droite \? 'balayageDroite' : 'balayageGauche'\)\.ico/);
    assert.match(GESTES, /const a = actionGeste\(dx > 0 \? 'balayageDroite' : 'balayageGauche'\)/);
});

test('un geste réglé sur « Rien » ne s’arme pas', () => {
    // Sans ça, la carte se colorerait et vibrerait pour n'aboutir à rien.
    assert.match(GESTES, /g\.arme = Math\.abs\(dx\) >= seuil\s*\n\s*&& !!actionGeste\(/);
    assert.match(GESTES, /if \(a\.act\) a\.act\(contexte\(carte\)\)/);
});

test('une valeur inconnue retombe sur le défaut', () => {
    // Une action retirée d'une version à l'autre ne doit pas laisser un
    // geste mort : elle doit redevenir ce qu'elle était au départ.
    const choix = /choix\(id\) \{([\s\S]*?)\n        \}/.exec(GLOBAL);
    assert.ok(choix, 'la résolution du choix');
    assert.match(choix[1], /ACTIONS_GESTE\.some\(a => a\.id === v\) \? v : \(d \? d\.defaut : 'aucun'\)/);
    // Et un stockage illisible ne fait pas tomber la page.
    assert.match(choix[1], /catch \(e\) \{ perso = \{\}; \}/);
});

test('la préférence ne garde que les écarts au défaut', () => {
    // Une préférence qui recopie les défauts les fige : le jour où un
    // défaut change, elle garde l'ancien sans que personne l'ait voulu.
    assert.match(PARAM_JS, /if \(g && sel\.value === g\.defaut\) delete perso\[sel\.dataset\.geste\]/);
    assert.match(PARAM_JS, /else perso\[sel\.dataset\.geste\] = sel\.value/);
});

test('le réglage existe et se range avec les raccourcis', () => {
    assert.match(PARAM_HTML, /<div class="set-card" id="gesturesCard">/);
    assert.match(PARAM_HTML, /<div id="gesturesList"/);
    assert.match(PARAM_JS, /function renderGestes\(\)/);
    assert.match(PARAM_JS, /renderGestes\(\);/);
    // Sur une page sans carte, le module n'existe pas : la section n'a
    // alors rien à régler et ne s'affiche pas plutôt que de mentir.
    assert.match(PARAM_JS, /document\.getElementById\('gesturesCard'\)\?\.setAttribute\('hidden', ''\)/);
});
