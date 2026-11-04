// ============================================================
// test/unit/defauts-releves-au-navigateur.test.js
// ------------------------------------------------------------
// Quatre défauts qu'aucun des 816 tests ne voyait, relevés en ouvrant
// les vingt-six pages dans un navigateur et en les mesurant.
//
// Le point commun : aucun n'est une erreur de code. Le code fait
// exactement ce qu'il dit. C'est le RÉSULTAT à l'écran qui est faux, et
// il n'y avait rien pour le regarder.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const lire = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8')
    .replace(/\r\n/g, '\n');
const GLOBAL_JS = lire('assets', 'js', 'global.js');
const GLOBAL_CSS = lire('assets', 'css', 'global.css');
const SERIE_JS = lire('assets', 'js', 'serie.js');

test('le plan de la page ne saute pas de niveau de titre', () => {
    // Mesuré sur les 24 pages qui portent le pied de page commun :
    // chacune passait de `h1` ou `h2` directement à `h4`. Un lecteur
    // d'écran qui navigue par titre entend un trou de deux ou trois
    // niveaux, à chaque page, et ne peut pas savoir s'il a manqué
    // quelque chose. Les colonnes du pied sont au PREMIER niveau du plan,
    // à côté du titre de la page : `h2`.
    for (const titre of ['Tes fichiers', 'Projet', 'Légal']) {
        assert.ok(GLOBAL_JS.includes(`<h2>${titre}</h2>`),
            `« ${titre} » est un h2`);
        assert.ok(!GLOBAL_JS.includes(`<h4>${titre}</h4>`),
            `« ${titre} » n’est plus un h4`);
    }
    // Et la feuille suit, sinon le titre perdrait sa mise en forme.
    assert.match(GLOBAL_CSS, /\.footer-col h2 \{/);
    assert.ok(!/\.footer-col h4 \{/.test(GLOBAL_CSS));
});

test('un placeholder n’est pas un nom accessible', () => {
    // Quatre zones de saisie de la fiche série n'avaient que lui. Un
    // placeholder disparaît dès qu'on tape — au moment précis où l'on
    // voudrait vérifier dans quel champ on est — et plusieurs lecteurs
    // d'écran ne l'annoncent pas du tout.
    const zones = SERIE_JS.match(/<textarea[^>]*>/g) || [];
    assert.ok(zones.length >= 4, `${zones.length} zones de saisie trouvées`);
    const sansNom = zones.filter((z) => !/aria-label=|aria-labelledby=/.test(z));
    assert.deepEqual(sansNom, [],
        `zones de saisie sans nom accessible :\n  ${sansNom.join('\n  ')}`);
});

test('une cible se touche ET se clique', () => {
    // Le bloc MOB-02 étendait les zones à 44 px, mais seulement sous
    // `pointer: coarse` : la souris restait sans rien. WCAG 2.2 AA (2.5.8)
    // demande 24x24 px CSS pour TOUT pointeur.
    //
    // Relevé sur l'application servie, à 1280 px : .chapter-read-dot
    // 15x15, .itr-astuce-x 14x17, .filters-reset 60x14, .se-hist-clear
    // 57x14, .chapter-bm 22x18, .section-link 67x18, et une quarantaine
    // de .filter-tag à 23 px — un pixel de trop peu.
    assert.match(GLOBAL_CSS, /@media \(pointer: coarse\)/, 'le doigt');
    assert.match(GLOBAL_CSS, /@media \(pointer: fine\)/, 'et la souris');

    const bloc = /@media \(pointer: fine\) \{([\s\S]*?)\n\}/.exec(GLOBAL_CSS);
    assert.ok(bloc, 'le bloc « pointer: fine »');
    assert.match(bloc[1], /min-width: 24px; min-height: 24px/,
        'la zone ne descend pas sous 24 px');
    // On agrandit la ZONE, jamais le dessin : si ce bloc posait une
    // largeur ou une hauteur sur le contrôle lui-même, la mise en page
    // bougerait. Il ne pose que des pseudo-éléments.
    assert.ok(!/^\s{2}(button|a\[href\])[^:{]*\{[^}]*\b(width|height):\s*\d/m.test(bloc[1]),
        'aucune dimension posée sur le contrôle lui-même');
    // Les mêmes exceptions qu'au doigt, pour la même raison : un lien
    // dans un paragraphe volerait les clics de ses lignes voisines.
    assert.match(bloc[1], /p a\[href\]::after, li a\[href\]::after/);
    assert.match(bloc[1], /content: none/);
});

test('le titre d’un état vide est un vrai titre', () => {
    // Il était rendu en `<div>`. Mesuré : trente et un états vides dans
    // treize fichiers, et pas un seul n'apparaissait dans le plan de sa
    // page. Pour qui navigue par titre, « Aucune note pour cette série »
    // n'existait pas — et sur les pages dont l'état vide EST tout le
    // contenu (`lecture.html` et `chapitre.html` avec un lien incomplet),
    // la page n'avait aucun titre du tout.
    assert.match(GLOBAL_JS, /const h = `h\$\{Math\.min\(6, Math\.max\(1, Number\(niveau\) \|\| 2\)\)\}`/,
        'le niveau est borné entre 1 et 6');
    assert.match(GLOBAL_JS, /<\$\{h\} class="mh-vide-titre">/, 'et il sert');
    assert.ok(!/<div class="mh-vide-titre">/.test(GLOBAL_JS));
    // Le défaut est `2` : un état vide remplit en général une SECTION.
    // Mettre `h1` partout créerait autant de titres de page qu'il y a de
    // sections vides.
    assert.match(GLOBAL_JS, /niveau = 2 \} = \{\}\) \{/);
    // Un titre porte la structure, pas le corps : sa taille reste celle
    // de l'échelle, et la marge que le navigateur donne aux titres part.
    assert.match(GLOBAL_CSS, /\.mh-vide-titre \{[^}]*margin: 0;? \}/);

    // Les deux lecteurs remplacent TOUTE leur surface : là, c'est le h1.
    for (const f of ['lecture.js', 'chapitre.js']) {
        const src = lire('assets', 'js', f);
        assert.match(src, /m\.niveau = 1;/, `${f} — branche « Error »`);
        assert.match(src, /niveau: 1,\n\s+icone: '\\u\{1F517\}'/, `${f} — branche littérale`);
    }
});

test('une couverture qui échoue montre quand même quelque chose', () => {
    // `MH.placeholderCover` existait, mais n'était appelé qu'au RENDU,
    // quand l'URL est ABSENTE. Quand elle existe et échoue, l'image
    // gardait `img-echec` — c'est-à-dire un rectangle gris — et rien
    // d'autre. Mesuré sur le journal de lecture : une couverture sur onze.
    assert.match(GLOBAL_JS, /if \(echec\) poserSecours\(img\);/,
        'l’échec appelle le secours');
    const f = /function poserSecours\(img\) \{([\s\S]*?)\n        \}/.exec(GLOBAL_JS);
    assert.ok(f, 'la fonction de secours');
    assert.match(f[1], /img\.src = window\.MH\.placeholderCover\(graine\)/);
    // Pas de boucle : si le secours échouait, on n'en poserait pas un autre.
    assert.match(f[1], /if \(img\.dataset\.secoursPose\) return;/);
    assert.match(f[1], /startsWith\('data:'\)\) return;/);
    // La graine est stable : la même œuvre garde la même couleur et la
    // même initiale d'une page à l'autre. C'est tout l'intérêt.
    assert.match(f[1], /img\.dataset\.seed[\s\S]{0,120}dataset\.id[\s\S]{0,60}img\.alt/);
    // Et l'on ne colore pas n'importe quelle image : une icône cassée
    // remplacée par un rectangle coloré serait un mensonge.
    assert.match(f[1], /manga-card|lib2-card|latte/);
});
