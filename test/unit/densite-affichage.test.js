// ============================================================
// test/unit/densite-affichage.test.js — une préférence, toutes les
// grilles
// ------------------------------------------------------------
// Encore le défaut de l'étape 2, et c'est la troisième fois : le
// composant existait, personne ne s'en servait.
//
// Les trois jeux de jetons étaient là depuis l'étape 2 — la carte dense
// (`--carte-titre`, `--carte-lignes`, `--carte-ecart`…) et les quatre
// jetons de grille (`--grille-carte`, `--grille-carte-dense`,
// `--grille-gouttiere`, `--grille-gouttiere-dense`). `[data-densite]`
// était STYLÉ dans `global.css`. Et rien, nulle part, ne posait jamais
// l'attribut : mesuré, zéro occurrence hors des règles elles-mêmes.
//
// Il ne manquait donc ni le dessin ni la mécanique — seulement le moyen
// de choisir.
//
// Ce qui rend l'affaire courte : toutes les grilles de l'application
// consomment DÉJÀ `--grille-carte` et `--grille-gouttiere` —
// bibliothèque, catalogue, recherche, collections, détail de liste.
// Redéfinir ces deux jetons sur `<html>` les déplace toutes d'un coup,
// sans récrire une seule règle de grille.
//
// Mesuré à 1400 px, catalogue puis bibliothèque :
//
//            colonnes      carte       gouttière
//   compact    8 / 10      104 px        10 px
//   confort.   5 /  7      168 px        16 px
//   spacieux   4 /  5      208 px        24 px
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const lire = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8')
    .replace(/\r\n/g, '\n');
const CSS = lire('assets', 'css', 'global.css');
const THEME = lire('assets', 'js', 'theme.js');
const PARAM_JS = lire('assets', 'js', 'parametres.js');
const PARAM_HTML = lire('parametres.html');

const regle = (sel) => {
    const m = new RegExp('\\n' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}').exec(CSS);
    return m ? m[1] : null;
};

test('les trois densités redéfinissent les jetons de grille', () => {
    // C'est tout le mécanisme : les grilles ne sont pas touchées, les
    // jetons qu'elles lisent le sont.
    const compact = regle('html[data-densite="compact"],\nhtml[data-densite="dense"]');
    assert.ok(compact, 'la densité compacte');
    assert.match(compact, /--grille-carte:\s*var\(--grille-carte-dense\)/);
    assert.match(compact, /--grille-gouttiere:\s*var\(--grille-gouttiere-dense\)/);

    const spacieux = regle('html[data-densite="spacieux"]');
    assert.ok(spacieux, 'la densité spacieuse');
    assert.match(spacieux, /--grille-carte:\s*190px/);
    assert.match(spacieux, /--grille-gouttiere:\s*var\(--sp-5\)/);
});

test('« confortable » est l’absence d’attribut', () => {
    // Un défaut qui doit s'écrire quelque part finit par s'écrire deux
    // fois — et les deux finissent par diverger.
    assert.ok(!/\[data-densite="confortable"\]/.test(CSS),
        'aucune règle ne décrit le défaut');
    assert.match(THEME, /v === 'confortable'\) root\.removeAttribute\('data-densite'\)/);
});

test('la densité est posée AVANT la première peinture', () => {
    // Comme le thème, et pour la même raison : elle change la taille des
    // cartes et l'écart des grilles. Appliquée après coup, toute la page
    // se réorganiserait sous les yeux.
    assert.match(THEME, /applyDensite\(\);/, 'appelée au chargement du module');
    const i = THEME.indexOf('applyDensite();');
    const j = THEME.indexOf('window.Theme = {');
    assert.ok(i > 0 && i < j, 'avant l’export, donc à l’exécution du module');
    // Et une valeur inconnue ne pose rien plutôt que de poser n'importe quoi.
    assert.match(THEME, /if \(!DENSITES\.includes\(v\)/);
});

test('le réglage existe, et il s’applique en le regardant', () => {
    assert.match(PARAM_HTML, /<div class="seg" id="segDensite">/);
    for (const v of ['compact', 'confortable', 'spacieux']) {
        assert.match(PARAM_HTML, new RegExp(`data-val="${v}"`), `le choix « ${v} »`);
    }
    assert.match(PARAM_JS, /\{ id: 'segDensite', key: 'densite',\s+def: 'confortable' \}/);
    // Appliquée tout de suite : on choisit une densité en la regardant,
    // pas en imaginant ce qu'elle donnera.
    assert.match(PARAM_JS, /if \(key === 'densite'\) window\.Theme\.applyDensite\(b\.dataset\.val\)/);
    // Et une densité arrivée par la synchro s'applique aussi.
    assert.match(PARAM_JS, /if \(s\.densite && !TOUCHEES\.has\('densite'\)\) window\.Theme\.applyDensite\(s\.densite\)/);
});

test('en compact, la carte renonce à ce qui ne tient pas', () => {
    // La contrainte est la largeur de la CARTE, pas celle de la fenêtre :
    // compact ramène la carte à 104 px sur un écran de 1400. Sans ces
    // règles, la méta était coupée sur les 72 cartes mesurées.
    const bloc = /html\[data-densite="compact"\] \.manga-card-actions[\s\S]*?display: none; \}/.exec(CSS);
    assert.ok(bloc, 'les règles de la carte compacte');
    assert.match(bloc[0], /\.card-list-btn/);
    assert.match(bloc[0], /\.mc-year/);

    // Le statut garde sa pastille de couleur et perd son mot — c'est la
    // même information, et c'est elle qu'on lit du coin de l'œil.
    const st = /html\[data-densite="compact"\] \.manga-card-pied \.mc-status[\s\S]*?\{([^}]*)\}/.exec(CSS);
    assert.ok(st, 'le statut compact');
    assert.match(st[1], /font-size: 0/);
    // `font-size: 0` et NON `display: none` : le mot reste dans le
    // document, donc un lecteur d'écran l'annonce toujours. Une densité
    // est un choix de place à l'écran, jamais un retrait d'information.
    assert.ok(!/display: none/.test(st[1]),
        'le mot reste lisible pour les technologies d’assistance');
    // Et la pastille de couleur est bien portée par le statut lui-même.
    assert.match(CSS, /\.manga-card-meta \.mc-status::before \{ content: ''; width: 5px/);
});

test('toutes les grilles lisent les mêmes deux jetons', () => {
    // C'est ce qui rend « une seule préférence » vrai. Si une grille
    // écrivait sa largeur en dur, elle resterait seule dans son coin.
    const grilles = [
        ['bibliotheque.css', '.lib2-grid'],
        ['catalogue.css', '.results-grid'],
        ['collection-detail.css', '.cd-series-grid'],
    ];
    for (const [f, sel] of grilles) {
        const src = lire('assets', 'css', f);
        const m = new RegExp(sel.replace('.', '\\.') + '\\s*\\{[^}]*\\}').exec(src);
        assert.ok(m, `${f} — ${sel}`);
        assert.match(m[0], /var\(--grille-carte/, `${sel} prend la largeur au jeton`);
        assert.match(m[0], /var\(--grille-gouttiere/, `${sel} prend la gouttière au jeton`);
    }
});
