// ============================================================
// test/unit/budget-stockage.test.js — un plafond, l'excédent s'évince seul
// ------------------------------------------------------------
// Vérifié sur la vraie page (Chromium, téléchargements réels) : A3–A7 et B1
// téléchargés (A en cours au 5, A3 lu), plafond 350 Ko, puis B2 téléchargé →
// restent A5, A6, A7, B2. Le lu d'abord, puis la série jamais commencée ;
// jamais la suite de la série en cours, ni le chapitre qu'on vient d'obtenir.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DL = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'downloads.js'), 'utf8');
const methode = (debut) => {
    const i = DL.indexOf(debut);
    let j = DL.indexOf('{', DL.indexOf(') {', i)), n = 0;
    for (; j < DL.length; j++) { if (DL[j] === '{') n++; else if (DL[j] === '}' && --n === 0) break; }
    return DL.slice(i, j + 1).trim();
};

function monter({ plafond, chapitres, lus = [], position = {}, horsLigne = false }) {
    const supprimes = [];
    const ko = 100000;
    const window = {
        Storage: { getPref: () => String(plafond) },
        API: { me: { readChapters: async () => { if (horsLigne) throw new Error('hors ligne'); return { X: lus.map(id => ({ chapterId: id })) }; }, progress: async () => Object.fromEntries(Object.entries(position).map(([k, v]) => [k, { chapter: v }])) } },
        MH: { toast: () => {} },
    };
    // eslint-disable-next-line no-new-func
    const objet = new Function('window', `return { ${methode('budget() {')}, ${methode('async appliquerBudget(')}, ${methode('planPurge(chapitres, contexte,')} };`)(window);
    let restants = chapitres.slice();
    Object.assign(objet, {
        list: async () => restants,
        remove: async (id) => { supprimes.push(id); restants = restants.filter(c => c.chapterId !== id); },
        sizeByManga: async () => {
            const g = {};
            restants.forEach(c => { (g[c.mangaId] = g[c.mangaId] || { mangaId: c.mangaId, chapters: 0, bytes: 0 }); g[c.mangaId].chapters++; g[c.mangaId].bytes += ko; });
            return Object.values(g);
        },
    });
    return { objet, supprimes };
}
const ch = (m, n, t) => ({ chapterId: `${m}${n}`, mangaId: m, chapterNum: n, savedAt: t });
const SIX = [ch('A', 3, 1), ch('A', 4, 2), ch('A', 5, 3), ch('A', 6, 4), ch('A', 7, 5), ch('B', 1, 6), ch('B', 2, 7)];

test('au-delà du plafond : le lu d\'abord, puis les séries jamais commencées, jamais la suite d\'une série en cours', async () => {
    const { objet, supprimes } = monter({ plafond: 350000, chapitres: SIX, lus: ['A3'], position: { A: 5 } });
    const r = await objet.appliquerBudget({ garder: 'B2' });
    assert.deepStrictEqual(supprimes, ['A3', 'A4', 'B1']);
    assert.equal(r.evinces, 3);
});

test('sous le plafond, ou sans plafond : rien ne bouge', async () => {
    for (const plafond of [10e6, 0]) {
        const { objet, supprimes } = monter({ plafond, chapitres: SIX, lus: ['A3'], position: { A: 5 } });
        await objet.appliquerBudget();
        assert.deepStrictEqual(supprimes, []);
    }
});

test('sans connexion pour savoir ce qui a été lu : l\'éviction échoue, elle ne devine pas', async () => {
    const { objet, supprimes } = monter({ plafond: 1, chapitres: SIX, horsLigne: true });
    await assert.rejects(objet.appliquerBudget(), /hors ligne/);
    assert.deepStrictEqual(supprimes, []);
    assert.match(DL, /this\.appliquerBudget\(\{ garder: info\.chapterId \}\)\.catch\(/, 'appliqué après chaque téléchargement, un échec n\'évince rien');
});
