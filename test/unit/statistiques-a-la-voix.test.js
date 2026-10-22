// ============================================================
// test/unit/statistiques-a-la-voix.test.js — les graphiques de la page de
// statistiques se lisent aussi à la voix
// ------------------------------------------------------------
// Deux graphiques ne portaient leurs valeurs que dans des `title` :
//   · la carte de l'année, 365 <i> vides, que les lecteurs d'écran ignorent ;
//   · la répartition sur 12 mois, douze <div> sans nom.
// Les barres d'objectif et de statut, elles, sont accompagnées d'un texte qui
// dit déjà la valeur : on les masque pour ne pas annoncer deux fois.
//
// Vérifié dans l'arbre d'accessibilité de Chromium, 141 chapitres en base :
//     img "Activité sur l'année : 141 chapitre(s) lu(s) en 111 jour(s) de
//          lecture. Meilleur jour : 19 mai 2026, 3 chapitre(s)."
//     table "Chapitres lus par mois et par source" — une ligne par mois
// axe : aucune violation nouvelle (13 contrastes préexistants, identiques).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'stats.js'), 'utf8').replace(/\r\n/g, '\n');
const fn = (nom) => {
    const i = SRC.indexOf(`    function ${nom}(`);
    assert.notEqual(i, -1, `${nom} doit rester repérable`);
    return SRC.slice(i, SRC.indexOf('\n    }\n', i) + 6);
};
const MH = { esc: (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;') };
// eslint-disable-next-line no-new-func
const charger = (nom) => new Function('MH', `${fn(nom)}; return ${nom};`)(MH);

test('la carte de l\'année se résume en une phrase', () => {
    const resume = charger('resumeHeatmap');
    const t = resume({ '2026-05-03': 4, '2026-05-04': 1, '2026-06-01': 0 });
    assert.match(t, /5 chapitre\(s\) lu\(s\) en 2 jour\(s\) de lecture/);
    assert.match(t, /Meilleur jour : 3 mai 2026, 4 chapitre\(s\)/);
    assert.match(resume({}), /aucun chapitre lu/);
});

test('la répartition existe aussi en vrai tableau, une ligne par mois', () => {
    const tableau = charger('tableauRepartition');
    const html = tableau({ months: ['2026-01', '2026-02'], bySource: { weebcentral: [3, 0], mangadex: [1, 2] } }, ['weebcentral', 'mangadex']);
    assert.match(html, /<table class="a11y-invisible"><caption>Chapitres lus par mois et par source<\/caption>/);
    assert.match(html, /<tr><th scope="row">2026-01<\/th><td>4<\/td><td>3<\/td><td>1<\/td><\/tr>/);
    assert.match(html, /<tr><th scope="row">2026-02<\/th><td>2<\/td><td>0<\/td><td>2<\/td><\/tr>/);
});

test('les graphiques portent leur nom ou se taisent', () => {
    assert.match(fn('heatmap'), /role="img" aria-label="\$\{MH\.esc\(resumeHeatmap\(map\)\)\}"/);
    assert.match(SRC, /\$\{colonnes\}<\/div>\n\s+\$\{tableauRepartition\(d, sources\)\}/);
    assert.match(SRC, /margin:14px 0 4px" aria-hidden="true">\$\{colonnes\}/);
    assert.match(fn('statusPanel'), /aria-hidden="true">\$\{bar\}/);
    for (const id of ['goalFill', 'yearFill']) {
        assert.match(SRC, new RegExp(`aria-hidden="true">\\s*<div id="${id}"`), id);
    }
});
