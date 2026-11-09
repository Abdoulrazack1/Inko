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
// Le harnais charge une fonction SEULE, hors de sa page : il doit donc
// fournir les quelques aides partagées qu'elle appelle. `date` reproduit
// `MH.date` à l'identique plutôt que de rendre une chaîne quelconque —
// sinon l'assertion « 3 mai 2026 » ne vérifierait plus rien.
const FORMATS_DATE = {
    courte:    { day: '2-digit', month: '2-digit', year: 'numeric' },
    longue:    { day: 'numeric', month: 'long', year: 'numeric' },
    mois:      { month: 'long', year: 'numeric' },
    moisCourt: { month: 'short', year: 'numeric' },
    jourHeure: { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' },
};
const MH = {
    esc: (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;'),
    date: (v, role = 'courte') => {
        if (v == null || v === '') return '';
        const d = v instanceof Date ? v : new Date(v);
        if (Number.isNaN(d.getTime())) return '';
        return d.toLocaleDateString('fr-FR', FORMATS_DATE[role] || FORMATS_DATE.courte);
    },
};
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
    const html = tableau({ months: ['2026-01', '2026-02'], bySource: { weebcentral: [3, 0], mangadex: [1, 2] } }, ['weebcentral', 'mangadex'], 'st-x');
    assert.match(html, /<div id="st-x" class="a11y-invisible st-chiffres" role="group"/);
    assert.match(html, /aria-label="Répartition par mois et par source, défilement horizontal"/);
    assert.match(html, /<caption>Chapitres lus par mois et par source<\/caption>/);
    // Le mois se lit, il ne se décode pas : le tableau est visible depuis
    // qu'un bouton l'ouvre, « 2026-01 » n'y a plus sa place.
    assert.match(html, /<tr><th scope="row">janv\. 2026<\/th><td>4<\/td><td>3<\/td><td>1<\/td><\/tr>/);
    assert.match(html, /<tr><th scope="row">févr\. 2026<\/th><td>2<\/td><td>0<\/td><td>2<\/td><\/tr>/);
});

// ── Le bouton ouvre le tableau aux yeux sans le fermer aux voix ──
//
// Le tableau est désormais affichable : un lecteur daltonien ne peut pas
// associer un aplat à une source, et jusqu'à SEPT paires de `--graph-*`
// se confondent sous daltonisme (mesuré en CIE76, voir
// `signaux-non-colores.test.js`). Mais il était déjà exposé aux lecteurs
// d'écran, et il doit le rester : c'est pour ça que ce n'est pas un
// `<details>`, dont le contenu replié sort de l'arbre d'accessibilité.
test('les chiffres s’ouvrent par un bouton, jamais par un <details>', () => {
    // `chargerRepartition` est `async`, donc hors de portee de `fn` : on
    // lit la source entiere, ces trois motifs n'existent qu'une fois.
    const rep = SRC;
    assert.match(rep, /<button type="button" class="st-chiffres-bouton" aria-expanded="false"/,
        'un bouton annoncé replié');
    assert.match(rep, /aria-controls="st-repartition-chiffres"/, 'le bouton doit désigner le tableau');
    assert.match(rep, /tableauRepartition\(d, sources, 'st-repartition-chiffres'\)/);
    // Sans les commentaires — ils PARLENT de `<details>`, justement pour
    // dire pourquoi il n'y en a pas.
    const code = SRC.split(/\n/).filter((l) => !/^\s*\/\//.test(l)).join('\n');
    assert.ok(!/<details/.test(code),
        'un <details> replié retire son contenu de l’arbre : le tableau y était déjà lu');

    // La bascule déplace `a11y-invisible`, elle ne détruit rien.
    const brancher = fn('brancherChiffres');
    assert.match(brancher, /aria-expanded', String\(!ouvert\)/, 'l’état doit être annoncé');
    assert.match(brancher, /classList\.toggle\('a11y-invisible', ouvert\)/,
        'replié = hors écran mais dans l’arbre, jamais display:none');
    assert.match(brancher, /Masquer les chiffres/, 'le libellé doit dire où mène le clic');
});

test('les graphiques portent leur nom ou se taisent', () => {
    assert.match(fn('heatmap'), /role="img" aria-label="\$\{MH\.esc\(resumeHeatmap\(map\)\)\}"/);
    // Le tableau double les colonnes : il doit vivre dans le même panneau,
    // après elles et après la légende — pas ailleurs sur la page.
    const panneau = SRC.slice(SRC.indexOf('${colonnes}</div>'), SRC.indexOf('</div>`;', SRC.indexOf('${colonnes}</div>')));
    assert.match(panneau, /\$\{legende\}/, 'la légende reste accolée au graphe');
    assert.ok(panneau.indexOf('${legende}') < panneau.indexOf('tableauRepartition(d, sources,'),
        'le tableau vient après la légende, pas entre le graphe et elle');
    assert.match(SRC, /margin:14px 0 4px" aria-hidden="true">\$\{colonnes\}/);
    assert.match(fn('statusPanel'), /aria-hidden="true">\$\{bar\}/);
    for (const id of ['goalFill', 'yearFill']) {
        assert.match(SRC, new RegExp(`aria-hidden="true">\\s*<div id="${id}"`), id);
    }
});
