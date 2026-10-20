// ============================================================
// test/unit/integrite-telechargements.test.js — un chapitre téléchargé dit
// s'il a perdu des planches depuis
// ------------------------------------------------------------
// « Complet » n'était constaté qu'au téléchargement. Le Cache API peut être
// évincé ensuite par le système : un chapitre complet hier perdait des
// planches sans que rien ne le signale, et on le découvrait en le lisant
// hors ligne — trop tard pour réparer.
//
// Parcours vérifié dans Chromium (5 planches, 2 effacées du cache) :
//     main        aucun avertissement, aucun bouton
//     correctif   « ⚠ 2 page(s) manquante(s) » + Relancer ; la relance répare
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'downloads.js'), 'utf8');

// Extrait `verifier` et l'exécute contre un magasin et un cache simulés.
function verifierAvec(meta, presentes) {
    const i = SRC.indexOf('        async verifier(chapterId) {');
    assert.notEqual(i, -1, 'Downloads.verifier doit exister');
    const corps = SRC.slice(i, SRC.indexOf('\n        },\n', i) + 10).replace('async verifier(', 'async function verifier(');
    let ecrit = null;
    const dom = new JSDOM('', { runScripts: 'outside-only' });
    const w = dom.window;
    w.caches = { open: async () => ({ match: async (u) => presentes.includes(u) }) };
    w.__meta = meta;
    w.__ecrire = (m) => { ecrit = m; };
    w.eval(`const CACHE = 'inko-offline';
        const getMeta = async () => window.__meta;
        const putMeta = async (m) => window.__ecrire(m);
        ${corps.replace(/\n        },\n$/, '\n        }\n')}
        window.__verifier = verifier;`);
    return { appel: () => w.__verifier('c1'), ecrit: () => ecrit };
}

const pages = ['u0', 'u1', 'u2', 'u3'];

test('toutes les planches en cache : rien à signaler, rien d\'écrit', async () => {
    const v = verifierAvec({ chapterId: 'c1', pages, incomplete: false, failed: 0 }, pages);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(await v.appel())), { total: 4, manquantes: 0 });
    assert.equal(v.ecrit(), null);
});

test('des planches évincées sont comptées et le constat est écrit', async () => {
    const v = verifierAvec({ chapterId: 'c1', pages, incomplete: false, failed: 0 }, ['u0', 'u3']);
    assert.equal((await v.appel()).manquantes, 2);
    assert.equal(v.ecrit().incomplete, true);
    assert.equal(v.ecrit().failed, 2);
});

test('une planche copiée dans le stockage privé de l\'APK compte comme présente', async () => {
    const v = verifierAvec({ chapterId: 'c1', pages, fichiers: [null, 'file://a', 'file://b', null] }, ['u0', 'u3']);
    assert.equal((await v.appel()).manquantes, 0);
});

test('un chapitre réparé redevient complet', async () => {
    const v = verifierAvec({ chapterId: 'c1', pages, incomplete: true, failed: 2 }, pages);
    await v.appel();
    assert.equal(v.ecrit().incomplete, false);
    assert.equal(v.ecrit().failed, 0);
});

test('la page des téléchargements vérifie après affichage, un chapitre à la fois', () => {
    const page = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'downloads-page.js'), 'utf8');
    assert.match(page, /mesurerPoids\(\);\n\s+verifierIntegrite\(groups\);/);
    assert.match(page, /for \(const c of g\.chapters \|\| \[\]\) \{[\s\S]*?await window\.Downloads\.verifier\(c\.chapterId\)/);
});
