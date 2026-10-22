// ============================================================
// test/unit/reprise-abandonnees.test.js — une série qui revient de pause
// ------------------------------------------------------------
// Le scan et la tâche de fond sont vérifiés contre MySQL, avec une source
// factice, dans server/test/integration.db.test.js : en pause depuis 200 j →
// « De retour après 7 mois · En Pause reprend : chap. 101 — tu l'avais mise
// de côté » ; abandonnée qui revient → signalée ; abandonnée qui paraît
// normalement → muette ; série en cours → « Nouveau chapitre » inchangé.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'server', 'lib', 'updates.js'), 'utf8');
const debut = SRC.indexOf('function contenuNotification(');
let j = SRC.indexOf('{', debut), n = 0;
for (; j < SRC.length; j++) { if (SRC[j] === '{') n++; else if (SRC[j] === '}' && --n === 0) break; }
// eslint-disable-next-line no-new-func
const contenu = new Function(SRC.slice(debut, j + 1) + 'return contenuNotification;')();

test('un retour après une pause se dit comme tel, en mois', () => {
    const c = contenu({ title: 'Berserk', status: 'paused', retour: { jours: 410 }, unreadCount: 1 }, { chapter: 375 });
    assert.equal(c.title, 'De retour après 14 mois');
    assert.equal(c.body, 'Berserk reprend : chap. 375 — tu l’avais mise de côté');
});

test('une série suivie normalement garde ses notifications d\'avant', () => {
    assert.deepStrictEqual(contenu({ title: 'X', unreadCount: 1 }, { chapter: 14 }), { title: 'Nouveau chapitre', body: 'X · Chap. 14' });
    assert.equal(contenu({ title: 'X', unreadCount: 3 }, { chapter: 12 }).title, '3 nouveaux chapitres');
    assert.ok(!/mise de côté/.test(contenu({ title: 'X', status: 'reading', retour: { jours: 90 } }, { chapter: 5 }).body));
});

test('la tâche de fond revoit les abandonnées (une fois par semaine) et ne les signale qu\'à leur retour', () => {
    assert.match(SRC, /scanUserUpdates\(u\.user_id, \{ scope: 'active', notifyOnly: true, abandonnees: true \}\)/);
    assert.match(SRC, /x\.status !== 'dropped' \|\| x\.retour/);
    assert.match(SRC, /Date\.now\(\) - new Date\(f\.checked_at\)\.getTime\(\) > SEMAINE/);
});
