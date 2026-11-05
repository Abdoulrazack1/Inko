// ============================================================
// test/unit/echelle-dates.test.js — une date absolue a un rôle, pas une
// mise en forme improvisée
// ------------------------------------------------------------
// `MH.relTime` tenait le relatif (« il y a 3 j ») depuis longtemps. Les
// dates ABSOLUES, elles, s'écrivaient à la main. Relevé sur
// `assets/js/` : HUIT formes distinctes, quatorze fichiers, vingt-quatre
// appels.
//
// Et deux de ces formes rendent exactement la même chaîne :
//
//     toLocaleDateString('fr-FR')                               → 05/11/2026
//     { day:'2-digit', month:'2-digit', year:'numeric' }        → 05/11/2026
//
// soit dix-sept appels écrits de deux façons pour un résultat identique.
// Ce n'est pas une divergence visible ; c'est une divergence qui n'attend
// qu'un changement d'avis.
//
// C'est le raisonnement des échelles de l'étape 1, appliqué au temps :
// ce qui n'a pas de nom se réinvente. Quatre rôles suffisent.
//
// Au passage, `dateCourte` — dupliquée MOT POUR MOT dans les deux
// lecteurs — disparaît dans le premier. C'était le seul vrai doublon des
// deux lecteurs : mesuré, `bindKeyboard` se ressemble à 3 % et
// `renderToolbar` à 26 %. Un lecteur d'images et un lecteur de texte
// n'ont ni le même clavier ni la même barre, et c'est normal.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const JS = path.join(RACINE, 'assets', 'js');
const lire = (f) => fs.readFileSync(path.join(JS, f), 'utf8').replace(/\r\n/g, '\n');
const GLOBAL = lire('global.js');

// Les formes que `MH.date` ne couvre pas et qui restent légitimes, avec
// la raison. Toute autre forme écrite à la main fait tomber le test.
const EXCEPTIONS = {
    'notes.js': 1,   // « Aujourd'hui »/« Hier », puis jour de semaine et
                     // année SEULEMENT si ce n'est pas l'année courante :
                     // de la logique, pas une mise en forme.
};

test('les rôles sont déclarés une fois, et nommés', () => {
    const bloc = /const FORMATS_DATE = \{([\s\S]*?)\n    \};/.exec(GLOBAL);
    assert.ok(bloc, 'la table des formats');
    for (const role of ['courte', 'longue', 'mois', 'moisCourt', 'jourHeure']) {
        assert.match(bloc[1], new RegExp(`${role}:`), `le rôle « ${role} »`);
    }
    assert.match(GLOBAL, /window\.MH\.date = function \(v, role = 'courte'\)/);
});

test('une date absente ou illisible ne rend pas « Invalid Date »', () => {
    // Elle s'est déjà affichée telle quelle dans des interfaces.
    const f = /window\.MH\.date = function[\s\S]*?\n    \};/.exec(GLOBAL)[0];
    assert.match(f, /if \(v == null \|\| v === ''\) return '';/);
    assert.match(f, /if \(Number\.isNaN\(d\.getTime\(\)\)\) return '';/);
    // Et un rôle inconnu retombe sur le plus courant plutôt que sur rien.
    assert.match(f, /FORMATS_DATE\[role\] \|\| FORMATS_DATE\.courte/);
});

test('plus personne ne met une date en forme dans son coin', () => {
    const fautes = [];
    for (const f of fs.readdirSync(JS).filter((x) => x.endsWith('.js'))) {
        const src = lire(f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
        const n = (src.match(/toLocaleDateString\('fr-FR'/g) || []).length;
        // `global.js` en contient une : celle de `MH.date` lui-même.
        const permis = f === 'global.js' ? 1 : (EXCEPTIONS[f] || 0);
        if (n > permis) fautes.push(`${f} — ${n} écriture(s), ${permis} permise(s)`);
    }
    assert.deepEqual(fautes, [],
        `mises en forme à router vers MH.date :\n  ${fautes.join('\n  ')}`);
});

test('les deux lecteurs partagent enfin leur format de date', () => {
    // Six lignes identiques au caractère près dans `chapitre.js` et
    // `lecture.js`, et un format qui pouvait dériver de l'un à l'autre
    // sans que rien ne le dise.
    for (const f of ['chapitre.js', 'lecture.js']) {
        const src = lire(f);
        const m = /function dateCourte\(c\) \{([\s\S]*?)\n    \}/.exec(src);
        assert.ok(m, `${f} — dateCourte`);
        assert.match(m[1], /window\.MH\.date\(c && c\.publishedAt, 'courte'\)/,
            `${f} passe par le rôle nommé`);
        assert.ok(!/toLocaleDateString/.test(m[1]),
            `${f} ne remet pas le format à la main`);
    }
});

test('et le harnais de test fournit la vraie mise en forme', () => {
    // `statistiques-a-la-voix` charge une fonction SEULE, hors de sa
    // page : il doit lui fournir `MH.date`. S'il rendait une chaîne
    // quelconque, son assertion « 3 mai 2026 » ne vérifierait plus rien.
    const t = fs.readFileSync(
        path.join(RACINE, 'test', 'unit', 'statistiques-a-la-voix.test.js'), 'utf8');
    assert.match(t, /date: \(v, role = 'courte'\) =>/);
    assert.match(t, /longue:\s+\{ day: 'numeric', month: 'long', year: 'numeric' \}/);
});
