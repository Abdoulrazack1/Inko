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
    assert.match(JS, /<div class="manga-card-info">\$\{cardInfoHTML\(m\)\}\n\s*<button class="card-list-btn"/,
        'et il vit dans la légende');
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
    assert.match(commune[1], /border-radius: var\(--radius2\)/, 'un seul rayon, pris dans l’échelle');
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
