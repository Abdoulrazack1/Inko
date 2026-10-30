// ============================================================
// test/unit/texte-sur-couleur.test.js — nommer le blanc posé sur un aplat
// ------------------------------------------------------------
// LE CHANTIER SE TROMPAIT, ET LA MESURE LE DIT.
//
// Il annonçait « les 86 `#fff` en dur garantissent que le thème clair ne
// tient pas ». Vérifié dans le navigateur, édition claire, pages
// Bibliothèque et Série : **937 textes blancs examinés, contraste calculé
// contre leur fond réel, zéro illisible**. Les aplats qui portent du blanc
// — accent, hanko, ai, voiles noirs sur couverture — sont sombres dans les
// quatre éditions. Le blanc y est juste.
//
// Deux fausses pistes écartées en chemin, chacune par une mesure :
//
//   · `--amber` ne tient que 3,77 avec du blanc. Mais il n'est utilisé en
//     fond qu'une fois, sur une barre de progression, SANS texte dessus.
//   · `--badge-grey` tombe à 1,68 en édition sombre. Mais il sert de
//     couleur de TEXTE sur un voile gris, jamais de fond.
//
// CE QUI EST VRAI : il y avait 77 copies d'une même intention, et le blanc
// sur accent tient à **4,65** — la marge la plus mince de l'application.
// Le jour où un accent s'éclaircit de quelques pour cent, 77 règles passent
// sous le seuil sans que rien ne le dise.
//
// D'où `--sur-couleur`. Le test ne vérifie pas une couleur : il vérifie la
// PAIRE, aplat par aplat, édition par édition.
//
// Après migration, mesuré sur la bibliothèque (931 textes blancs) :
//     claire 4,65 · sombre 4,65 · contraste renforcé 6,16
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const CSS_DIR = path.join(RACINE, 'assets', 'css');
const lire = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const GLOBAL = lire(path.join(CSS_DIR, 'global.css'));

const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const lum = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const rapport = (a, b) => {
    const x = lum(a), y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};

/** Le corps du bloc de thème qui porte la palette. */
function bloc(selecteur) {
    const aiguille = selecteur + ' {';
    for (let i = GLOBAL.indexOf(aiguille); i !== -1; i = GLOBAL.indexOf(aiguille, i + 1)) {
        const corps = GLOBAL.slice(i, GLOBAL.indexOf('\n}', i));
        if (corps.includes('--bg4:')) return corps;
    }
    assert.fail('bloc de palette introuvable : ' + selecteur);
}

/** Résout un jeton dans un thème, en suivant un alias éventuel vers :root. */
function couleur(corps, nom) {
    let m = new RegExp('--' + nom + ':\\s*([^;]+);').exec(corps);
    if (!m) m = new RegExp('--' + nom + ':\\s*([^;]+);').exec(bloc(':root'));
    assert.ok(m, 'jeton introuvable : --' + nom);
    let v = m[1].trim();
    const alias = /^var\(--([a-z0-9-]+)\)$/.exec(v);
    if (alias) return couleur(corps, alias[1]);
    // `#fff` est une écriture légitime : on la développe plutôt que de la
    // refuser. Le premier jet rejetait --sur-couleur pour cette seule raison.
    if (/^#[0-9a-f]{3}$/i.test(v)) v = '#' + v[1] + v[1] + v[2] + v[2] + v[3] + v[3];
    assert.match(v, /^#[0-9a-f]{6}$/i, '--' + nom + ' doit être une couleur littérale, vu « ' + v + ' »');
    return hex(v);
}

const THEMES = [
    [':root', 'édition claire (Washi)'],
    ['html[data-theme="dark"]', 'édition sombre (Sumi)'],
    ['html[data-theme="amoled"]', 'AMOLED'],
    ['html[data-theme="contrast"]', 'contraste renforcé'],
];

// Les aplats qui portent VRAIMENT du texte blanc, relevés règle par règle :
//   var(--orange) / var(--accent)   37 règles
//   var(--hanko)                     2
//   var(--ai)                        1
// `--amber`, `--green`, `--blue` n'en portent pas : les ajouter ici
// créerait une alarme pour un cas qui n'existe pas.
const APLATS = ['accent', 'hanko', 'ai'];
const SEUIL = 4.5;

for (const [selecteur, nom] of THEMES) {
    test('le texte sur aplat reste lisible — ' + nom, () => {
        const corps = bloc(selecteur);
        const blanc = couleur(corps, 'sur-couleur');
        for (const a of APLATS) {
            const r = rapport(blanc, couleur(corps, a));
            assert.ok(r >= SEUIL,
                '--sur-couleur sur --' + a + ' : ' + r.toFixed(2)
                + ', il faut ' + SEUIL + '. Éclaircir un aplat casse toutes les règles qui y posent du texte.');
        }
    });
}

test('le jeton existe, et c’est bien du blanc', () => {
    assert.match(GLOBAL, /--sur-couleur:\s*#fff;/);
});

test('plus aucune feuille ne pose un blanc littéral en couleur de texte', () => {
    const coupables = [];
    for (const f of fs.readdirSync(CSS_DIR).filter((x) => x.endsWith('.css'))) {
        const restantes = lire(path.join(CSS_DIR, f)).match(/[^-\w]color:\s*#fff(f{3})?\b/gi) || [];
        if (restantes.length) coupables.push(f + ' (' + restantes.length + ')');
    }
    assert.deepEqual(coupables, [], coupables.join(', '));
});

test('le blanc en FOND n’est pas touché', () => {
    // `background: #fff` et `rgba(255,255,255,.06)` ne sont pas la même
    // intention : l'un est une surface, l'autre un voile. Les confondre avec
    // la couleur du texte aurait repeint des fonds.
    const tout = fs.readdirSync(CSS_DIR).filter((f) => f.endsWith('.css'))
        .map((f) => lire(path.join(CSS_DIR, f))).join('\n');
    assert.match(tout, /rgba\(255, ?255, ?255/, 'les voiles blancs doivent survivre');
    assert.ok(!/background[^;]*var\(--sur-couleur\)/.test(tout),
        'aucun fond ne doit avoir été remplacé par la couleur de texte');
});

test('la marge la plus mince est connue, et nommée', () => {
    // 4,65 sur l'accent : c'est le pire cas de l'application, et il passe.
    // Le test le fige pour qu'un éclaircissement de l'accent fasse échouer
    // la construction plutôt que l'interface.
    const r = rapport(couleur(bloc(':root'), 'sur-couleur'), couleur(bloc(':root'), 'accent'));
    assert.ok(r >= 4.5 && r < 5.2,
        'le blanc sur accent vaut ' + r.toFixed(2)
        + ' : s’il a bougé, c’est que la palette a changé, et il faut le regarder');
});
