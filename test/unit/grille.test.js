// ============================================================
// test/unit/grille.test.js — une grille unique pour les cartes de série
// ------------------------------------------------------------
// Dix grilles fluides dans les feuilles, et entre elles SEPT largeurs
// minimales de carte et CINQ gouttières : 96, 104, 120, 140, 150, 220,
// 260 px ; 10, 12, 14/12, 16, 18 px.
//
// Toutes ne tiennent pas la même chose — `.cont-row` porte des reprises
// de lecture et `.lists-grid` des cartes de liste, plus larges par
// nature. Mais `.lib2-grid` (140), `.cd-series-grid` (150) et `.se-grid`
// (150) posent la MÊME carte de série et ne s'accordaient pas.
//
// Et le catalogue était la seule grille de l'application à COLONNES
// FIXES — cinq, puis quatre sous 1024 px. Sa carte changeait donc de
// taille avec la fenêtre au lieu de changer de nombre. Mesuré :
//
//     avant   148 px dans un conteneur de 798, 229 dans un large  (±35 %)
//     après   188 px à 1100, 168 px à 1500, 4 puis 5 colonnes     (±6 %)
//
// C'est l'inverse de ce que font toutes les autres grilles : garder la
// carte stable et faire varier le nombre de colonnes.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const CSS = path.join(__dirname, '..', '..', 'assets', 'css');
// Les commentaires sont retirés avant l'analyse : une accolade citée dans
// une explication déséquilibrait la pile des requêtes média, et une règle
// gardée par `(hover: none)` se retrouvait comptée comme nue.
const FEUILLES = fs.readdirSync(CSS).filter(f => f.endsWith('.css'))
    .map(f => [f, fs.readFileSync(path.join(CSS, f), 'utf8')
        .replace(/\r\n/g, '\n').replace(/\/\*[\s\S]*?\*\//g, '')]);
const TOUT = FEUILLES.map(([, s]) => s).join('\n');

// Les grilles qui posent une carte de série. Les autres tiennent autre
// chose : `.cont-row` des reprises de lecture, `.lists-grid` des cartes
// de liste, `.im-grid` des stations de radio dans le panneau de musique.
const GRILLES = ['.lib2-grid', '.cd-series-grid', '.se-grid', '.sim-grid', '.results-grid'];

// Une règle, son corps, et la requête média qui la garde — car c'est elle
// qui décide si un nombre de colonnes fixe est un choix ou une dérive.
function regles(sel) {
    const out = [];
    for (const [f, s] of FEUILLES) {
        const re = new RegExp('(^|\\n)([^\\n{}]*\\' + sel + '(?![a-z0-9-])[^\\n{}]*)\\{([^}]*)\\}', 'g');
        let m;
        while ((m = re.exec(s))) {
            const avant = s.slice(0, m.index);
            // La dernière @media encore ouverte à cet endroit.
            // Toute accolade ouvrante empile, qu'elle vienne d'une @media ou
            // d'une règle ordinaire : sans ça, le `}` d'une règle fermait la
            // requête média qui la contient, et la suivante paraissait nue.
            const ouvertes = [];
            for (const q of avant.matchAll(/@media([^{]*)\{|([{}])/g)) {
                if (q[1] !== undefined) ouvertes.push(q[1].trim());
                else if (q[2] === '{') ouvertes.push('');
                else ouvertes.pop();
            }
            out.push([f, m[2].trim(), m[3], ouvertes.filter(Boolean).join(' ')]);
        }
    }
    return out;
}

test('la grille de cartes est déclarée une fois', () => {
    for (const j of ['--grille-carte', '--grille-carte-dense',
        '--grille-gouttiere', '--grille-gouttiere-dense']) {
        assert.match(TOUT, new RegExp(j + '\\s*:'), `${j} doit être défini`);
    }
});

test('aucune grille de cartes ne pose ses propres mesures', () => {
    const fautes = [];
    for (const sel of GRILLES) {
        for (const [f, s, corps, media] of regles(sel)) {
            if (AU_DOIGT(media)) continue;      // voir le cas suivant
            const c = /grid-template-columns\s*:\s*([^;}]+)/.exec(corps);
            // `minmax(0, 1fr)` ne pose aucune largeur : c'est l'idiome qui
            // autorise une colonne à rétrécir, pas une mesure de carte.
            if (c && /minmax\(\s*[1-9]/.test(c[1])) fautes.push(`${f} ${s} — ${c[1].trim()}`);
            const g = /(?:^|;|\n)\s*gap\s*:\s*([^;}]+)/.exec(corps);
            if (g && !/var\(--grille-/.test(g[1])) fautes.push(`${f} ${s} — gap: ${g[1].trim()}`);
        }
    }
    assert.deepEqual(fautes, [], `à router vers le contrat :\n  ${fautes.join('\n  ')}`);
});

// Un écran de téléphone : soit la requête vise le doigt, soit elle borne
// la largeur à une taille de téléphone. Les deux disent la même chose.
const AU_DOIGT = (media) => /hover:\s*none/.test(media)
    || [...media.matchAll(/max-width:\s*(\d+)px/g)].some(m => Number(m[1]) <= 768);

test('un nombre de colonnes fixe ne se justifie qu\'au doigt', () => {
    // Des colonnes fixes font varier la TAILLE de la carte avec la
    // fenêtre, au lieu de son nombre. Sur un téléphone c'est le bon
    // choix — la largeur est connue, et la bibliothèque dit pourquoi :
    // « plus il en tient à l'œil, plus vite on la trouve ». Sur un
    // bureau, où la fenêtre fait n'importe quelle largeur, c'est une
    // dérive : le catalogue y rendait la même carte à 148 px ou à 229.
    const fautes = [];
    for (const sel of GRILLES) {
        for (const [f, s, corps, media] of regles(sel)) {
            const c = /grid-template-columns\s*:\s*([^;}]+)/.exec(corps);
            // `1fr` seul est la vue en liste : une colonne, c'est une liste.
            if (c && /repeat\(\s*\d+\s*,/.test(c[1]) && !AU_DOIGT(media)) {
                fautes.push(`${f} ${s} — ${c[1].trim()}${media ? `  (@media ${media})` : '  (sans requête média)'}`);
            }
        }
    }
    assert.deepEqual(fautes, [],
        `colonnes imposées hors tactile :\n  ${fautes.join('\n  ')}`);
});

test('les densités de grille sont celles de la carte', () => {
    // Une grille dense va avec une carte dense : la bibliothèque
    // compacte, les œuvres proches d'une fiche, le détail d'une liste
    // sur téléphone. Les déclarer séparément les ferait diverger.
    for (const sel of ['.lib2-grid--compact', '.sim-grid', '.cd-series-grid']) {
        const trouve = regles(sel).some(([, , c]) => /--grille-carte-dense|--grille-carte: var\(--grille-carte-dense\)/.test(c));
        assert.ok(trouve, `${sel} doit prendre la densité dense`);
    }
});
