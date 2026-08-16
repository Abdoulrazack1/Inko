// ============================================================
// test/unit/css-webview-android8.test.js — les propriétés que le WebView
// d'Android 8 IGNORE en silence
// ------------------------------------------------------------
// Trois fois dans la même journée, le même défaut : une propriété moderne,
// correcte, lue par tous les navigateurs de développement, et purement et
// simplement ignorée par le WebView d'Android 8 (Chrome 61) — la cible de
// l'APK. Aucune erreur, aucun avertissement, aucun test rouge.
//
//   `inset`         (Chrome 87)  → les surcouches ne couvraient rien
//   `aspect-ratio`  (Chrome 88)  → les couvertures faisaient 0 px de haut
//   `env()`         (Chrome 69)  → la déclaration ENTIÈRE est jetée
//
// Le dernier est le plus vicieux. `inset` et `aspect-ratio` sont des propriétés
// inconnues : le navigateur jette la ligne, et le reste de la règle survit.
// `env()` est une FONCTION inconnue dans une valeur : c'est la déclaration qui
// devient invalide. Écrire
//
//     bottom: calc(12px + env(safe-area-inset-bottom, 0px));
//
// ne donne pas « 12 px » sur Android 8 — cela ne donne AUCUN `bottom`. Un
// élément `position: fixed` sans `bottom` se place là où il serait tombé dans
// le flux : le bandeau « Hors ligne », censé s'ancrer au-dessus de la barre
// d'onglets, part se coller en haut de l'écran par-dessus l'en-tête.
//
// La parade tient en une ligne DOUBLÉE : une valeur simple d'abord, la version
// enrichie ensuite. Un navigateur qui sait lire la seconde l'applique ; les
// autres gardent la première. C'est ce que ce test exige, partout — feuilles de
// style comme CSS injecté depuis JavaScript.
//
// Ce test ne vérifie pas un correctif : il ferme la FAMILLE.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

function fichiers(dossier, ext) {
    const d = path.join(ROOT, dossier);
    if (!fs.existsSync(d)) return [];
    return fs.readdirSync(d)
        .filter(f => f.endsWith(ext))
        .map(f => ({ nom: path.join(dossier, f), code: fs.readFileSync(path.join(d, f), 'utf8') }));
}

// Une déclaration = « propriété : valeur ». On les extrait à plat : il ne
// s'agit pas d'analyser le CSS, seulement de repérer les valeurs contenant
// `env(` et de regarder ce qui les précède immédiatement.
function declarations(code) {
    const out = [];
    const re = /(^|[{;\n])\s*(-{0,2}[a-zA-Z][a-zA-Z-]*)\s*:\s*([^;{}]*)/g;
    let m;
    while ((m = re.exec(code))) out.push({ prop: m[2], valeur: m[3], index: m.index });
    return out;
}

test('aucun env() sans repli : sur Android 8 la déclaration entière est jetée', () => {
    const sources = [...fichiers('assets/css', '.css'), ...fichiers('assets/js', '.js')];
    const fautifs = [];

    for (const f of sources) {
        const decls = declarations(f.code);
        decls.forEach((d, i) => {
            if (!/\benv\s*\(/.test(d.valeur)) return;
            // Le repli doit porter sur la MÊME propriété et la précéder
            // immédiatement — sinon la cascade ne le garde pas.
            const precedente = decls[i - 1];
            const replie = precedente
                && precedente.prop === d.prop
                && !/\benv\s*\(/.test(precedente.valeur);
            if (!replie) fautifs.push(`${f.nom} — ${d.prop}: ${d.valeur.trim().slice(0, 70)}`);
        });
    }

    assert.deepStrictEqual(fautifs, [],
        'Ces déclarations utilisent env() sans valeur de repli juste avant. Sur le WebView '
        + 'd’Android 8 la propriété n’est PAS appliquée du tout — un élément fixe sans '
        + '`bottom` remonte en haut de l’écran. Doubler la ligne : valeur simple, puis env().');
});

// Pourquoi `inset` n'est PAS testé ici : les trois propriétés ne se traitent
// pas de la même façon, et cette asymétrie est le fond du sujet.
//
//   `inset`         esbuild sait l'abaisser en top/left/right/bottom, et le
//                   fait à la construction du paquet mobile. Le code source a
//                   donc parfaitement le droit de l'écrire — c'est le PAQUET
//                   qu'il faut contrôler, ce que fait `verifier-apk.js` sur
//                   l'artefact réel plutôt que sur son source.
//   `aspect-ratio`  aucun équivalent : rien à abaisser. D'où un repli généré.
//   `env()`         aucun équivalent non plus, et l'échec est pire — c'est la
//                   déclaration entière qui tombe. D'où la ligne doublée.
//
// Interdire `inset` à la source aurait été un test plus sévère que la réalité,
// donc un test qu'on finit par contourner.

test('chaque aspect-ratio a son repli généré dans global.css', () => {
    const global = fs.readFileSync(path.join(ROOT, 'assets', 'css', 'global.css'), 'utf8');
    const coupe = global.split(/@supports\s+not\s*\(\s*aspect-ratio/);
    assert.strictEqual(coupe.length, 2,
        'Le bloc de repli aspect-ratio a disparu de global.css (→ npm run gen-repli-ar). '
        + 'Sans lui, toutes les couvertures font 0 px de haut sur Android 8.');

    // Autant de déclarations à la source que de replis produits.
    let aLaSource = 0;
    for (const f of fichiers('assets/css', '.css')) {
        const avant = f.nom.endsWith('global.css')
            ? f.code.split(/@supports\s+not\s*\(\s*aspect-ratio/)[0]
            : f.code;
        aLaSource += (avant.match(/aspect-ratio\s*:/g) || []).length;
    }
    const replis = (coupe[1].match(/\{\s*(height|padding-top)/g) || []).length;
    assert.ok(replis >= aLaSource,
        `${aLaSource} déclaration(s) aspect-ratio pour seulement ${replis} repli(s) — `
        + 'une déclaration a été ajoutée sans régénérer (→ npm run gen-repli-ar).');
});

test('le module de gestes reste inerte au pointeur fin', () => {
    // Garde-fou de non-régression : les gestes remplacent des commandes qui,
    // sur bureau, EXISTENT DÉJÀ (le cœur au survol, la fiche série). S'ils
    // s'installaient aussi à la souris, un simple glissé sur une carte
    // marquerait une série entière comme lue.
    const code = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'cartes-gestes.js'), 'utf8');
    const sortie = code.indexOf("matchMedia('(hover: none)').matches");
    const premierEcouteur = code.indexOf('addEventListener');
    assert.ok(sortie > -1, 'cartes-gestes.js ne teste plus `hover: none`.');
    assert.ok(sortie < premierEcouteur,
        'Le test de `hover: none` doit précéder tout addEventListener : sinon le module '
        + 's’installe aussi à la souris, où un glissé sur une carte marquerait toute la '
        + 'série comme lue.');
});

test('un balayage destructif propose toujours son annulation', () => {
    const code = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'cartes-gestes.js'), 'utf8');
    // On ne marque QUE l'écart, et on ne démarque QUE ce même écart : c'est ce
    // qui rend l'annulation exacte. Le marquage en masse existant envoie tous
    // les chapitres sans regarder lesquels étaient déjà lus — l'annuler aurait
    // effacé des lectures antérieures au geste.
    assert.match(code, /const nouveaux = liste\.filter\(c => !lus\.has\(c\.id\)\)/,
        'Le marquage doit porter sur l’ÉCART entre les chapitres et ceux déjà lus.');
    assert.match(code, /unmarkChaptersBulk\(ctx\.id, nouveaux\.map\(c => c\.id\)\)/,
        'L’annulation doit démarquer exactement les chapitres que ce geste a marqués.');
    assert.match(code, /action: 'Annuler'[\s\S]{0,120}duree: 5000/,
        'IX.6 : les balayages sont annulables pendant cinq secondes.');
});
