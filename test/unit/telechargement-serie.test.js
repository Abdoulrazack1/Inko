// ============================================================
// test/unit/telechargement-serie.test.js — toute la série, et son poids
// ------------------------------------------------------------
// Vérifié sur la vraie fiche (Chromium, 30 chapitres simulés) : « Les 5
// prochains ≈ 30 Mo · Les 20 prochains ≈ 120 Mo · Toute la série (30
// chapitres) ≈ 180 Mo · estimation prudente : aucun téléchargement pour
// comparer · espace libre : 808 Mo » ; « Toute la série » → 30 chapitres en
// file. Avec 100 Mo libres, l'alerte « plus que l'espace libre » s'affiche.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const lire = (f) => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
const DL = lire('assets/js/downloads.js');
const i = DL.indexOf('        async poidsChapitre(mangaId) {');
let j = DL.indexOf('{', i), n = 0;
for (; j < DL.length; j++) { if (DL[j] === '{') n++; else if (DL[j] === '}' && --n === 0) break; }
const corps = DL.slice(i, j + 1).replace('async poidsChapitre(mangaId)', 'async function poidsChapitre(mangaId)');
const avec = (tailles) => {
    // eslint-disable-next-line no-new-func
    const f = new Function(corps + 'return poidsChapitre;')();
    return (id) => f.call({ sizeByManga: async () => tailles }, id);
};
const Mo = 1048576;

test('les chapitres déjà téléchargés de la série font foi', async () => {
    const r = await avec([{ mangaId: 's', chapters: 4, bytes: 40 * Mo }, { mangaId: 'x', chapters: 10, bytes: 10 * Mo }])('s');
    assert.deepStrictEqual(r, { octets: 10 * Mo, base: 'serie' });
});

test('sinon la moyenne de tous les téléchargements, sinon une valeur prudente annoncée', async () => {
    assert.deepStrictEqual(await avec([{ mangaId: 'a', chapters: 2, bytes: 6 * Mo }, { mangaId: 'b', chapters: 2, bytes: 2 * Mo }])('z'),
        { octets: 2 * Mo, base: 'moyenne' });
    assert.deepStrictEqual(await avec([{ mangaId: 'a', chapters: 1, bytes: 9 * Mo }])('z'), { octets: 6 * Mo, base: 'defaut' },
        'un seul chapitre ne fait pas une moyenne');
    assert.equal((await avec([])('z')).base, 'defaut');
});

test('la fiche propose toute la série, le poids de chaque choix et l\'espace libre', () => {
    const s = lire('assets/js/serie.js');
    assert.match(s, /`Toute la série \(\$\{total\} chapitre/);
    assert.match(s, /≈ \$\{fmt\(v \* poids\.octets\)\}/);
    assert.match(s, /valeur\(\) \* poids\.octets > libre \* 0\.9/);
    assert.ok(!/Combien de chapitres télécharger/.test(s), 'plus d\'invite à nombre tapé');
});
