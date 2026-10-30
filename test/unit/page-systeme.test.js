// ============================================================
// test/unit/page-systeme.test.js — la page du système ne peut pas mentir
// ------------------------------------------------------------
// Une page de documentation qui récite des valeurs se périme au premier
// changement, sans que personne ne le voie. `systeme.html` est construite
// pour ne pas pouvoir : elle relit les feuilles réellement servies et
// demande au navigateur ce que chaque jeton vaut dans le thème courant.
//
// Ce test garde les deux propriétés qui rendent ça vrai :
//   1. aucune valeur en dur dans la page ;
//   2. tout jeton de `global.css` tombe dans une famille — sinon il
//      n'est documenté nulle part et la page le dit, mais autant le
//      savoir au moment où on l'ajoute.
//
// Vérifié dans le navigateur (Chromium, 15 feuilles et 54 scripts relus) :
// 10 familles rendues, un seul « appelé mais défini nulle part » — et c'est
// `--font-mono`, le défaut que cette page existe pour attraper. Bascule de
// thème : 40 valeurs sur 64 changent, le nombre de vignettes ne bouge pas.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const R = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');
const JS = R('assets', 'js', 'systeme.js');
const HTML = R('systeme.html');
const GLOBAL = R('assets', 'css', 'global.css');

test('la page lit les feuilles servies, elle ne porte pas leur liste', () => {
    assert.match(JS, /fetch\('\/service-worker\.js'/,
        'la liste des feuilles vient du précache, seul endroit qui les connaisse toutes');
    // Une liste codée ici se périmerait à la prochaine feuille ajoutée.
    const enDur = (JS.match(/['"][a-z-]+\.css['"]/g) || []);
    assert.deepEqual(enDur, [], `feuilles nommées en dur : ${enDur.join(', ')}`);
});

test('aucune valeur de jeton n\'est recopiée dans la page', () => {
    // Le seul endroit où une couleur a le droit d'apparaître, c'est la
    // feuille. Si la page en porte une, elle finira par démentir le thème.
    for (const [quoi, src] of [['systeme.js', JS], ['systeme.html', HTML]]) {
        // `theme-color` est la seule exception : le navigateur la lit
        // dans l'en-tête, avant toute feuille, et toutes les pages la portent.
        const sansMeta = src.replace(/<meta name="theme-color"[^>]*>/g, '');
        const couleurs = (sansMeta.match(/#[0-9a-f]{3,8}/gi) || []);
        assert.deepEqual(couleurs, [], `${quoi} : couleur en dur — ${couleurs.join(', ')}`);
    }
});

test('tout jeton de global.css relève d\'une famille de la page', () => {
    const bloc = JS.slice(JS.indexOf('const FAMILLES'), JS.indexOf('const ALIAS'));
    const nommes = new Set((bloc.match(/'--[a-z0-9-]+'/g) || []).map(s => s.slice(1, -1)));
    const prefixes = (bloc.match(/prefixe:\s*'(--[a-z0-9-]+)'/g) || [])
        .map(s => s.match(/'(--[a-z0-9-]+)'/)[1]);
    const alias = JS.slice(JS.indexOf('const ALIAS'), JS.indexOf('async function sources'));
    const connus = new Set([...(alias.match(/'--[a-z0-9-]+'/g) || []).map(s => s.slice(1, -1))]);

    const jetons = [...new Set((GLOBAL.match(/^\s*(--[a-z0-9-]+)\s*:/gm) || [])
        .map(l => l.trim().split(':')[0]))];
    const orphelins = jetons.filter(j =>
        !nommes.has(j) && !connus.has(j) && !prefixes.some(p => j.startsWith(p)));

    assert.deepEqual(orphelins, [],
        `jetons sans famille — ils ne seraient documentés nulle part :\n  ${orphelins.join('\n  ')}`);
});

test('la page redessine quand le thème change', () => {
    assert.match(JS, /MutationObserver/, 'sinon elle affiche les valeurs du thème précédent');
    assert.match(JS, /attributeFilter: \['data-theme'\]/);
});

test('ce que le script pose ou construit n\'est pas compté comme un trou', () => {
    // Deux fausses alertes trouvées en regardant la page tourner : les
    // variables posées à l'exécution (--pivot-*, --mc, --h) et les noms
    // fabriqués ('var(--graph-' + n + ')'). Sept cris au loup pour un vrai.
    assert.match(JS, /setProperty\(/, 'les variables posées par le script sont reconnues');
    assert.match(JS, /getPropertyValue\(/, 'et celles qu\'il lit comptent comme des appels');
    assert.match(JS, /j\.endsWith\('-'\)/, 'un nom fabriqué est un préfixe, pas un jeton');
});

test('la page est enregistrée là où les autres le sont', () => {
    assert.match(R('scripts-ci', 'gen-meta.js'), /'systeme\.html':/, 'métadonnées de partage');
    assert.match(R('test', 'e2e', 'csp.spec.js'), /systeme\.html/, 'couverture CSP');
    assert.match(R('assets', 'js', 'global.js'), /href="systeme\.html"/, 'atteignable depuis le pied de page');
});
