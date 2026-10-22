// ============================================================
// test/unit/position-par-appareil.test.js — reprendre là où l'autre
// appareil s'est arrêté
// ------------------------------------------------------------
// Vérifié de bout en bout (Chromium, serveur et MySQL réels, deux contextes
// aux agents différents) : le « PC » (Chrome sur Windows) lit le chapitre 2
// jusqu'à la page 5 ; le « téléphone » (Android) rouvre le chapitre 1 →
// « Sur Chrome sur Windows : Chap. 2, page 5 · à l'instant [Reprendre là] » ;
// le bouton ouvre le chapitre 2 page 5. Le PC, lui, n'affiche rien.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const lire = (f) => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
const SRC = lire('assets/js/chapitre.js');
const extraire = (src, debut) => {
    const i = src.indexOf(debut);
    let j = src.indexOf('{', i), n = 0;
    for (; j < src.length; j++) { if (src[j] === '{') n++; else if (src[j] === '}' && --n === 0) break; }
    return src.slice(i, j + 1);
};
// eslint-disable-next-line no-new-func
const enAvance = new Function(extraire(SRC, 'function autreAppareilEnAvance(') + 'return autreAppareilEnAvance;')();
const maintenant = Date.now();
const ici = { chapter: '1', chapterId: 'c1', page: 1 };

test('un autre appareil plus loin dans la série est proposé', () => {
    const o = enAvance([{ nom: 'PC', chapterId: 'c2', chapter: '2.00', page: 5, at: maintenant - 60000, courant: false }], ici);
    assert.equal(o.nom, 'PC');
});

test('cet appareil-ci, un appareil en retard ou une position trop ancienne : rien', () => {
    assert.equal(enAvance([{ chapterId: 'c2', chapter: '2', page: 5, at: maintenant, courant: true }], ici), null);
    assert.equal(enAvance([{ chapterId: 'c1', chapter: '1', page: 2, at: maintenant, courant: false }], ici), null,
        'une page d\'écart sur le même chapitre ne mérite pas d\'interrompre');
    assert.equal(enAvance([{ chapterId: 'c3', chapter: '3', page: 1, at: maintenant - 40 * 86400000, courant: false }], ici), null);
    assert.equal(enAvance([{ chapterId: 'c0', chapter: '0', page: 9, at: maintenant, courant: false }], ici), null);
});

test('même chapitre, nettement plus loin : proposé ; plusieurs appareils : le plus récent', () => {
    assert.ok(enAvance([{ chapterId: 'c1', chapter: '1', page: 7, at: maintenant, courant: false }], ici));
    const o = enAvance([
        { nom: 'Tablette', chapterId: 'c4', chapter: '4', page: 1, at: maintenant - 3600000, courant: false },
        { nom: 'PC', chapterId: 'c3', chapter: '3', page: 2, at: maintenant - 60000, courant: false },
    ], ici);
    assert.equal(o.nom, 'PC');
});

test('la proposition est demandée AVANT d\'écrire notre propre position, jamais en lecture privée', () => {
    assert.match(SRC, /proposerAutreAppareil\(\);[^\n]*\n\s*saveProgress\(\);/);
    assert.match(extraire(SRC, 'async function proposerAutreAppareil('), /isIncognito\?\.\(manga\?\.id\)/);
});

test('chaque écriture de progression dit de quel appareil elle vient', () => {
    const api = lire('assets/js/api.js');
    assert.match(api, /clientAt: new Date\(\)\.toISOString\(\), appareil: idAppareil\(\), \.\.\.payload/);
    assert.match(lire('server/routes/index.js'), /'\/me\/progress\/:mangaId\/appareils'/);
});

test('les migrations appliquées sont comptées une à une, plus par la plus haute', () => {
    const m = lire('server/db/migrate.js');
    assert.match(m, /if \(appliquees\.has\(m\.version\)\) continue;/);
    assert.ok(!/MAX\(version\)/.test(m.replace(/\/\/.*$/gm, '')), 'plus de MAX(version) dans le code');
});
