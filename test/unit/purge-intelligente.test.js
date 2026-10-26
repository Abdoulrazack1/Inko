// ============================================================
// test/unit/purge-intelligente.test.js — le déjà lu d'abord, jamais ce qui
// reste à lire
// ------------------------------------------------------------
// Vérifié sur la vraie page (Chromium, sept chapitres réellement téléchargés
// dans IndexedDB + Cache API) : série A en cours au chapitre 5, A3 à A7
// téléchargés, A3 marqué lu ; série B jamais commencée, B1 et B2.
// « Libérer de la place » → « Supprimer 2 chapitres déjà lus ? … Les 3
// chapitre(s) qui te restent à lire sont gardés » → restent A5, A6, A7, B1, B2.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const lire = (f) => fs.readFileSync(path.join(__dirname, '..', '..', f), 'utf8');
const DL = lire('assets/js/downloads.js');
const i = DL.indexOf('        planPurge(chapitres, contexte,');
let j = DL.indexOf('{', DL.indexOf(') {', i)), n = 0;
for (; j < DL.length; j++) { if (DL[j] === '{') n++; else if (DL[j] === '}' && --n === 0) break; }
// eslint-disable-next-line no-new-func
const planPurge = new Function('return function ' + DL.slice(i, j + 1).trim())();

const ch = (mangaId, num, savedAt) => ({ chapterId: `${mangaId}${num}`, mangaId, chapterNum: num, savedAt });
const CHAPITRES = [ch('A', 3, 5), ch('A', 4, 1), ch('A', 5, 2), ch('A', 6, 3), ch('A', 7, 4), ch('B', 1, 0), ch('B', 2, 6)];
const CONTEXTE = { lus: new Set(['A3']), position: { A: 5 } };
const ids = (r) => r.aSupprimer.map(c => c.chapterId);

test('le déjà lu part, du plus anciennement téléchargé au plus récent ; la suite d\'une série en cours reste', () => {
    const r = planPurge(CHAPITRES, CONTEXTE);
    assert.deepStrictEqual(ids(r), ['A4', 'A3']);
    assert.equal(r.proteges, 3);
});

test('les séries jamais commencées ne partent que si on le demande, et après le lu', () => {
    assert.deepStrictEqual(ids(planPurge(CHAPITRES, CONTEXTE, { inclureNonCommencees: true })), ['A4', 'A3', 'B1', 'B2']);
});

test('avec un objectif de place, on s\'arrête dès qu\'il est atteint', () => {
    const r = planPurge(CHAPITRES, CONTEXTE, { octets: 10, poidsDe: () => 10 });
    assert.deepStrictEqual(ids(r), ['A4']);
    assert.equal(r.octets, 10);
});

test('jamais le chapitre en cours ni ce qui le suit, quel que soit l\'objectif', () => {
    const r = planPurge(CHAPITRES, CONTEXTE, { octets: Infinity, inclureNonCommencees: true });
    assert.ok(!ids(r).some(id => ['A5', 'A6', 'A7'].includes(id)));
});

test('hors ligne, la page ne devine pas ce qui a été lu : elle ne supprime rien', () => {
    const page = lire('assets/js/downloads-page.js');
    assert.match(page, /try \{ contexte = await contextePurge\(\); \} catch \(e\) \{[\s\S]{0,160}rien n’a été supprimé/);
});
