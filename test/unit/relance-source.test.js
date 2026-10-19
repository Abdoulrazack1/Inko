// ============================================================
// test/unit/relance-source.test.js — relancer UNE source, pas les quatre
// ------------------------------------------------------------
// Quand une source ne répond pas, la bannière la nommait déjà (AMEL-11) :
// « MangaDex (502 Bad Gateway). Les résultats ci-dessous sont donc
// incomplets. » Elle ne proposait rien. Le seul recours était de relancer
// toute la recherche — donc de refaire attendre les trois sources qui, elles,
// avaient répondu.
//
// Or une source tombe surtout pour des raisons passagères : délai dépassé,
// 502, réseau coupé une seconde.
//
// Vérifié dans le navigateur, en faisant tomber MangaDex sur un 502 pendant
// une vraie recherche « Blue Lock » :
//
//     bannière   « 2 sources n'ont pas répondu : MangaDex (502 Bad Gateway),
//                  Royal Road (HTTP 403) »
//     boutons    « Réessayer MangaDex », « Réessayer Royal Road »
//     clic       libellé « MangaDex… », bouton désactivé
//     après      14 résultats au lieu de 2, MangaDex retiré de la bannière,
//                les autres sources jamais réinterrogées
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'assets', 'js', 'recherche.js'), 'utf8')
    .replace(/\r\n/g, '\n');
const CSS = fs.readFileSync(
    path.join(__dirname, '..', '..', 'assets', 'css', 'recherche.css'), 'utf8')
    .replace(/\r\n/g, '\n');

const handler = () => {
    const m = /out\.querySelectorAll\('\.se-fail-retry'\)\.forEach\(b => b\.addEventListener\('click', async \(\) => \{\n([\s\S]*?)\n        \}\)\);/
        .exec(SRC);
    assert.ok(m, 'le câblage du bouton doit rester repérable');
    return m[1];
};

test('une source tombée garde son identifiant, pas seulement son nom', () => {
    // Sans l'identifiant il n'y a rien à relancer : le nom affiché
    // (« Weeb Central ») n'est pas celui qu'attend l'API (« weebcentral »).
    const lignes = SRC.match(/sourcesEnEchec[^;]*?\{ *id:[^}]*\}/g) || [];
    assert.equal(lignes.length, 2,
        'les deux chemins — recherche groupée et source par source — doivent le garder');
    for (const l of lignes) {
        assert.match(l, /nom:/, 'le nom reste, c’est lui qu’on affiche');
        assert.match(l, /raison:/, 'et la raison, c’est elle qui dit quoi faire');
    }
});

test('un bouton par source tombée, nommé', () => {
    assert.match(SRC, /sourcesEnEchec\.filter\(s => s\.id\)\.map/,
        'une source sans identifiant ne peut pas être relancée : pas de bouton');
    assert.match(SRC, /class="se-fail-retry" data-retry-src="\$\{MH\.esc\(s\.id\)\}"/);
    assert.match(SRC, /Réessayer \$\{MH\.esc\(s\.nom\)\}/,
        '« Réessayer » seul ne dirait pas laquelle, et il peut y en avoir plusieurs');
});

test('la relance n’interroge que cette source', () => {
    const h = handler();
    assert.match(h, /API\.mangas\.searchFor\(id, \{ q, limit: 36 \}\)/,
        'searchFor et non searchAll : c’est tout l’intérêt');
    assert.ok(!/searchAll/.test(h), 'relancer tout le monde serait l’inverse du besoin');
});

test('une relance en retard ne doit pas écraser une recherche plus récente', () => {
    // On peut retaper pendant que la relance est en vol. Sans cette garde,
    // les résultats de l'ancienne requête remplaceraient les nouveaux.
    const h = handler();
    assert.match(h, /const my = reqSeq;/, 'la séquence doit être capturée au clic');
    const gardes = h.match(/if \(my !== reqSeq\) return;/g) || [];
    assert.equal(gardes.length, 2, 'au succès ET à l’échec : les deux écrivent');
});

test('la source qui répond remplace son groupe et quitte la bannière', () => {
    const h = handler();
    assert.match(h, /groupesRecus = groupesRecus\.filter\(g => g\.source !== id\);/,
        'sans cela, deux groupes pour la même source compteraient double');
    assert.match(h, /sourcesEnEchec = sourcesEnEchec\.filter\(x => x\.id !== id\);/);
    assert.match(h, /lastMerged = mergeByTitle\(groupesRecus, q\);/,
        'le regroupement par titre doit être refait : l’œuvre peut déjà être là');
});

test('une relance qui échoue remplace la raison au lieu de l’empiler', () => {
    const h = handler();
    assert.match(h, /const ligne = sourcesEnEchec\.find\(x => x\.id === id\);/);
    assert.match(h, /ligne\.raison = e\.message \|\| 'indisponible';/);
    assert.ok(!/sourcesEnEchec\.push/.test(h),
        'repousser la même source la ferait apparaître deux fois dans la bannière');
});

test('l’état du bouton dit ce qui se passe', () => {
    const h = handler();
    assert.match(h, /b\.disabled = true;/, 'deux clics ne doivent pas lancer deux requêtes');
    assert.match(h, /MH\.announce\?\.\(/,
        'à la voix, la grille qui se remplit toute seule ne se remarque pas');
});

test('le bouton reste atteignable au doigt et au clavier', () => {
    const i = CSS.indexOf('.se-fail-retry {');
    assert.notEqual(i, -1, 'le bouton doit avoir un style');
    const bloc = CSS.slice(i, CSS.indexOf('}', i));
    assert.match(bloc, /min-height: 24px;/, 'WCAG 2.5.8 : 24 × 24 au minimum');
    assert.match(CSS, /\.se-fail-retry:focus-visible \{ outline:/,
        'le contour de focus ne doit pas disparaître sur un bouton sans fond');
    assert.match(CSS, /\.se-fail \{[\s\S]*?flex-wrap: wrap;/,
        'la bannière doit pouvoir passer à la ligne : les boutons s’y ajoutent');
});
