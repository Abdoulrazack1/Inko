// ============================================================
// test/unit/catalogue-composition.test.js — un filtre s'allume d'une
// seule façon, et rien ne se pose sur l'œuvre
// ------------------------------------------------------------
// Mesure de départ, page réelle, 24 couvertures : 274 surfaces arrondies
// pour 855 éléments — une sur trois —, huit rayons différents (50, 30,
// 20, 18, 12, 8, 6, 4), 50 `backdrop-filter`, 113 filets.
//
// Deux causes, et une seule phrase pour chacune.
//
// 1. La carte portait SEPT surfaces arrondies : la carte, son lien, le
//    cœur, le « + », le bouton « Lire » du calque de survol, la pastille
//    de genre et celle de statut. Vingt-quatre cartes par page.
//
// 2. Cette page avait QUATRE grammaires pour le même geste — allumer un
//    filtre : le genre (rayon 30, bordé, actif en orange pâle), le
//    statut (rayon 20, bordé, actif en aplat orange), la langue (idem),
//    les filtres rapides (idem). Et `.view-btn.active`, seul de son
//    espèce, le faisait déjà correctement : un pas de clarté.
//
// Le cœur (.card-fav-btn) appartient à la PR de l'accueil (#151), qui le
// descend dans la légende : ce fichier ne l'assertionne pas, pour ne pas
// produire un conflit là où il n'y a pas de désaccord.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const lire = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');
const CAT = lire('assets', 'css', 'catalogue.css').replace(/\r\n/g, '\n');
const GLOBAL = lire('assets', 'css', 'global.css').replace(/\r\n/g, '\n');
const JS = lire('assets', 'js', 'catalogue.js').replace(/\r\n/g, '\n');

const regle = (css, sel) => {
    const m = new RegExp('\\n' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}').exec(css);
    return m ? m[1] : null;
};

test('la couverture est l’objet, pas la carte autour', () => {
    const c = regle(GLOBAL, '.manga-card');
    assert.ok(c, '.manga-card');
    assert.ok(!/border-radius/.test(c), 'vingt-quatre cartes arrondies font vingt-quatre objets');
    assert.ok(!/border:/.test(c), 'ni filet');
    assert.ok(!/background:/.test(c), 'ni fond relevé');
    assert.ok(!/box-shadow/.test(regle(GLOBAL, '.manga-card:hover')), 'ni ombre au survol');
    // Le lien étendu portait le rayon de la carte, invisible mais compté.
    assert.ok(!/border-radius/.test(regle(GLOBAL, '.manga-card-link')));
});

test('le calque de survol a disparu', () => {
    // La carte ENTIÈRE est déjà un lien vers la série : un voile noir qui
    // se lève pour offrir un bouton « Lire » n'offrait rien de neuf.
    for (const sel of ['.manga-card-overlay', '.btn-read-overlay', '.btn-add-overlay']) {
        assert.ok(!new RegExp('\\' + sel + '\\b').test(GLOBAL), `${sel} n’a plus de règle`);
    }
    assert.ok(!/manga-card-overlay|btn-read-overlay/.test(JS), 'ni de DOM');
    assert.match(GLOBAL, /\.manga-card-link \{[^}]*inset: 0/, 'le lien couvre toujours la carte');
});

test('le « + » suit le cœur dans la légende', () => {
    const b = regle(GLOBAL, '.card-list-btn');
    assert.ok(b, '.card-list-btn');
    assert.ok(!/position: absolute/.test(b), 'il n’est plus posé sur la couverture');
    assert.ok(!/border-radius: 50%/.test(b), 'ni rond');
    assert.ok(!/backdrop-filter/.test(b), 'ni flouté');
    assert.ok(!/background: rgba\(0,0,0/.test(b), 'ni noir translucide');
    // Le bouton vit dans la légende — et désormais c'est la légende
    // ELLE-MÊME qui le rend. Ce n'est pas un détail de rangement :
    // `enrichSparseCards` remplace le contenu de `.manga-card-info` par
    // le retour de `cardInfoHTML`. Tant que celui-ci ne rendait que du
    // texte, l'enrichissement d'arrière-plan SUPPRIMAIT le « + » et le
    // cœur — vérifié dans la page. Les œuvres touchées étaient justement
    // celles dont la source ne donne ni auteur ni statut.
    assert.match(JS, /<div class="manga-card-info">\$\{cardInfoHTML\(m\)\}<\/div>/,
        'la légende est rendue d’un seul tenant');
    const legende = /function cardInfoHTML\(m\) \{[\s\S]*?\n    \}/.exec(JS);
    assert.ok(legende, 'cardInfoHTML');
    assert.match(legende[0], /cardActionsHTML\(m, src\)/, 'et elle rend ses actions');
    const actions = /function cardActionsHTML\(m, src\) \{[\s\S]*?\n    \}/.exec(JS);
    assert.ok(actions, 'cardActionsHTML');
    assert.match(actions[0], /<button class="card-list-btn"/);
    assert.match(actions[0], /<button class="card-fav-btn"/);
    // Et l'état du cœur est remis après chaque reconstruction, sinon une
    // œuvre en favori repasserait en « pas en favori » sous les yeux.
    assert.match(JS, /info\.innerHTML = cardInfoHTML\(full\);[\s\S]{0,260}?MH\.markFavorites\?\.\(card\)/);
});

test('les actions ne se posent plus sur la ligne de méta', () => {
    // Mesuré sur le catalogue servi, à 1280 px : les 24 cartes sur 24
    // avaient une collision. Le cœur, en absolu à `right: 8px`,
    // recouvrait la fin du statut — « En co♥ » — et le « + », à
    // `right: 34px`, mordait 48 px dessus. Deux objets, les mêmes pixels.
    //
    // La page des rayons l'avait déjà résolu : `.shelf-nom` est une
    // RANGÉE. La carte de grille n'avait jamais reçu la correction — elle
    // avait reçu un `position: absolute`.
    assert.ok(!/\.manga-card-info \.card-fav-btn \{[^}]*position: absolute/.test(GLOBAL),
        'le cœur n’est plus en absolu sur la légende');
    assert.ok(!/\.manga-card-info \.card-list-btn \{[^}]*position: absolute/.test(GLOBAL),
        'le « + » non plus');
    const pied = regle(GLOBAL, '.manga-card-pied');
    assert.ok(pied, '.manga-card-pied');
    assert.match(pied, /display: flex/);
    assert.match(pied, /justify-content: space-between/);
    // Le pied se colle en bas : les légendes d'une rangée alignent alors
    // leur dernière ligne, quelle que soit la longueur du titre.
    assert.match(pied, /margin-top: auto/);
    assert.match(regle(GLOBAL, '.manga-card-info'), /flex-direction: column/);
    // Une cible qui rétrécit n'est plus une cible : c'est la méta qui cède.
    assert.match(regle(GLOBAL, '.manga-card-actions'), /flex: 0 0 auto/);
});

test('la méta garde ses faits groupés', () => {
    // `.manga-card-meta` écarte ses enfants (`space-between`). Invisible
    // dans une carte de 144 px — mais en VUE LISTE la légende fait 824 px,
    // et le statut se retrouvait à un bout, l'année à l'autre. C'est le
    // pied qui sépare la méta des actions ; la méta ne sépare rien.
    assert.match(regle(GLOBAL, '.manga-card-pied .manga-card-meta'),
        /justify-content: flex-start/);
});

test('sur une carte étroite, on choisit — et on le dit', () => {
    // Mesuré à 375 px, grille à trois colonnes : la carte tombe à 109 px,
    // le pied à 93, les deux actions en prennent 46 — il reste 39 px de
    // méta pour 83 demandés. Tout ne rentre pas.
    const etroit = /@media \(max-width: 640px\) \{\s*\.manga-card-actions \.card-list-btn[\s\S]*?\n\}/.exec(GLOBAL);
    assert.ok(etroit, 'la règle des cartes étroites');
    assert.match(etroit[0], /\.card-list-btn \{ display: none; \}/);
    assert.match(etroit[0], /\.mc-year \{ display: none; \}/);
    // Le cœur RESTE : c'est le seul des deux boutons qui porte un état,
    // donc le seul qui dit quelque chose sans être pressé.
    assert.ok(!/\.card-fav-btn \{ display: none/.test(etroit[0]),
        'le cœur reste');
    // Et le « + » est MASQUÉ, jamais retiré du balisage : le menu d'appui
    // long propose « Ajouter à une liste » en cliquant ce bouton-là.
    const gestes = lire('assets', 'js', 'cartes-gestes.js');
    assert.match(gestes, /\.card-list-btn\[data-addlist\]/);
    assert.match(gestes, /libelle: 'Ajouter à une liste', act: \(\) => listes\.click\(\)/);
});

test('le squelette réserve exactement ce que la carte occupera', () => {
    // Il portait deux rangées quand la carte en a trois, et des hauteurs
    // écrites en dur (11 px, 16 px) qui ne correspondaient plus. Mesuré
    // avant : 300 px réservés pour une carte de 344 — la grille sautait
    // de 44 px au remplacement. Après : 344 contre 344, et 236 contre 236
    // à 375 px.
    const js = lire('assets', 'js', 'global.js');
    const sq = /: '<div class="manga-card mh-sq"[\s\S]*?'<\/div><\/div>';/.exec(js);
    assert.ok(sq, 'le gabarit du squelette');
    for (const rangee of ['manga-card-title', 'manga-card-author', 'manga-card-pied']) {
        assert.ok(sq[0].includes(rangee), `${rangee} est réservée`);
    }
    // `&nbsp;` : sans contenu, un span n'a aucune hauteur et la rangée
    // s'écrase. Avec, elle prend la ligne de SA rangée réelle.
    assert.match(sq[0], /<span class="skeleton">&nbsp;<\/span>/);
    // Et plus une seule hauteur recopiée.
    assert.ok(!/\.mh-sq \.manga-card-title span \{[^}]*height:/.test(GLOBAL),
        'plus de hauteur en dur sur les barres du squelette');
    // Le pied fait au moins la hauteur d'une action, qu'il en porte ou non.
    assert.match(regle(GLOBAL, '.manga-card-pied'),
        /min-height: calc\(var\(--carte-action\) \+ var\(--sp-1\)\)/);
    assert.match(GLOBAL, /--carte-action:\s*22px;/);
});

test('un nom d’auteur ne fait pas danser la grille', () => {
    // Mesuré : « KANESHIRO Munayuki, NOMURA Yuusuke » repliait sur deux
    // lignes quand « ODA Eiichiro » tenait sur une. La ligne de méta de la
    // carte voisine se retrouvait 17 px plus haut, et la grille portait
    // DEUX hauteurs de carte — 337 et 353 px — dans la même rangée.
    const a = regle(GLOBAL, '.manga-card-author');
    assert.ok(a, '.manga-card-author');
    assert.match(a, /white-space: nowrap/);
    assert.match(a, /text-overflow: ellipsis/);
});

test('le statut n’est plus dit deux fois sur la même carte', () => {
    // « TERMINÉ » en capitales sur la couverture, et « Terminé » dans la
    // ligne de légende juste en dessous. La même donnée, deux fois.
    assert.ok(!/manga-card-badges/.test(JS), 'les trois pastilles ont quitté l’œuvre');
    assert.ok(!/>TERMINÉ</.test(JS) && !/>PAUSE</.test(JS) && !/>ROMAN</.test(JS),
        'et avec elles les capitales');
    assert.match(JS, /if \(isNovel\) metaBits\.push\('<span class="mc-demo">Roman<\/span>'\)/,
        '« Roman » descend dans la légende, comme dans la bibliothèque');
    assert.match(JS, /mc-status mc-\$\{m\.status\}/, 'le statut y était déjà');
});

test('genre et statut ont la même forme', () => {
    // Rayon 4 pour l'un, rayon 20 pour l'autre, sur la même ligne.
    const demo = regle(GLOBAL, '.manga-card-meta .mc-demo');
    const stat = regle(GLOBAL, '.manga-card-meta .mc-status');
    assert.ok(demo && !/border-radius/.test(demo) && !/background/.test(demo),
        'le genre n’est pas une donnée colorée : c’est du texte');
    assert.ok(stat && !/border-radius/.test(stat), 'et le statut prend la forme qu’il a dans la bibliothèque');
    assert.match(GLOBAL, /\.manga-card-meta \.mc-status::before \{[^}]*width: 5px/,
        'un point de 5 px et un mot');
    // Le statut garde sa couleur — c'est sa donnée — mais plus son aplat.
    for (const e of ['ongoing', 'completed', 'hiatus', 'cancelled']) {
        const r = new RegExp('\\.mc-status\\.mc-' + e + '\\s*\\{([^}]*)\\}').exec(GLOBAL);
        assert.ok(r, e);
        assert.match(r[1], /color: var\(--\w+-text\)/, `${e} garde sa couleur`);
        assert.ok(!/background/.test(r[1]), `${e} perd son aplat`);
    }
});

test('un filtre s’allume d’une seule façon', () => {
    // Quatre familles de boutons pour le même geste. Elles partagent
    // désormais une règle, et une seule.
    const fam = ['.filter-tag', '.filter-status-btn', '.lang-btn', '.quick-filter-btn'];
    const commune = /\n\.filter-tag, \.filter-status-btn, \.lang-btn, \.quick-filter-btn \{([^}]*)\}/.exec(CAT);
    assert.ok(commune, 'une règle les porte toutes les quatre');
    // Depuis #149, le rayon d’une puce vient de SA famille (--puce-rayon)
    // et non de l’échelle générale. Ce test avait été écrit avant elle.
    assert.match(commune[1], /border-radius: var\(--puce-rayon\)/, 'un seul rayon, celui de la famille');
    assert.ok(!/border: 1px/.test(commune[1]), 'et pas de filet');
    // Plus aucune d'entre elles ne garde sa propre géométrie.
    for (const sel of fam) {
        const seule = new RegExp('\\n\\' + sel + ' \\{').test(CAT);
        assert.ok(!seule, `${sel} n’a plus de règle à elle seule`);
    }
    // L'actif se marque par la clarté et un filet d'accent, jamais par un aplat.
    const actif = /\n\.filter-tag\.active, \.filter-status-btn\.active,\n\.lang-btn\.active, \.quick-filter-btn\.active \{([^}]*)\}/.exec(CAT);
    assert.ok(actif, 'et une règle pour leur état actif');
    assert.match(actif[1], /background: var\(--bg4\)/, 'un pas de clarté');
    assert.ok(!/var\(--orange\)|var\(--accent\)(?!\))/.test(actif[1].replace(/inset 2px 0 0 var\(--accent\)/, '')),
        'pas d’aplat d’accent');
    // La pagination rejoint .view-btn.active, qui le faisait déjà bien.
    assert.ok(!/\.page-btn\.active \{[^}]*var\(--orange\)/.test(CAT));
});

test('un panneau est un fond OU un filet, pas les deux', () => {
    for (const sel of ['.filters-sidebar', '.catalogue-focus', '.team-pick-card', '.collection-mini-card']) {
        const r = regle(CAT, sel);
        assert.ok(r, sel);
        assert.match(r, /background: var\(--bg[23]\)/, `${sel} : un pas de clarté`);
        assert.ok(!/border: 1px solid/.test(r), `${sel} : et pas en plus un filet`);
    }
});

test('rien ne descend sous onze pixels dans le catalogue', () => {
    const fautes = [];
    for (const m of CAT.matchAll(/([^\n{}]*)\{([^}]*font-size:\s*([\d.]+)px[^}]*)\}/g)) {
        if (Number(m[3]) < 11) fautes.push(`${m[1].trim()} — ${m[3]}px`);
    }
    assert.deepEqual(fautes, [], `sous le plancher :\n  ${fautes.join('\n  ')}`);
});

test('plus de petite capitale espacée dans le catalogue', () => {
    const fautes = [];
    for (const m of CAT.matchAll(/([^\n{}]*)\{([^}]*)\}/g)) {
        if (/text-transform:\s*uppercase/.test(m[2])) fautes.push(m[1].trim());
    }
    assert.deepEqual(fautes, [], `à passer en bas de casse :\n  ${fautes.join('\n  ')}`);
});
