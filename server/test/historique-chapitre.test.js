// ============================================================
// server/test/historique-chapitre.test.js — « Chapitre ? » n'était pas inconnu
// ------------------------------------------------------------
// L'historique affichait « Chapitre ? » sur certaines lignes. Mesuré sur un
// compte réel avant d'écrire une ligne de correctif :
//
//     437 lectures, 14 sans numéro de chapitre  (3,2 %)
//     ces 14 chapitres, dans read_chapters      14 / 14, avec leur numéro
//
// Le numéro n'avait jamais été inconnu. Il était à côté.
//
// LA CAUSE. `pushEvent` ne lit que `mangaId`, `chapterId`, `source` et
// `metadata`. Un appelant passait le numéro à PLAT :
//
//     pushEvent(uid, 'read', { mangaId, chapterId, chapter })
//                                                  ^^^^^^^ jeté, sans un mot
//
// C'est le chemin « cocher un chapitre depuis la liste de la série ». Lu dans
// le lecteur, le même chapitre passait par un autre appel, qui lui met bien
// `metadata: { chapter, page }`. D'où un historique juste pour ce qu'on lit,
// faux pour ce qu'on coche — et rien pour le signaler.
//
// LES ENTRÉES DÉJÀ ÉCRITES. Elles ne sont pas perdues : `read_chapters`
// porte le numéro du même chapitre. `getEvents` le joint, plutôt que de
// réécrire la table — la donnée est déjà juste, c'est sa copie dans
// l'événement qui manquait.
//
// Vérifié sur le compte réel, serveur relancé avec le correctif :
//
//     437 lectures, 0 sans numéro
//     l'entrée témoin               « Chapitre ? » → « Chapitre 1190 »
//     un événement ayant sa méta    { page: 1, chapter: 2 }, intact
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const CTRL = fs.readFileSync(
    path.join(__dirname, '..', 'controllers', 'user.controller.js'), 'utf8')
    .replace(/\r\n/g, '\n');

/**
 * Extrait la projection de `getEvents` et l'exécute pour de vrai, sur des
 * lignes fabriquées. C'est la seule logique du correctif : la priorité entre
 * ce que l'événement dit de lui-même et ce que la jointure apporte.
 */
function projection() {
    const m = /res\.json\(rows\.map\(r => \{\n([\s\S]*?)\n        \}\)\);/.exec(CTRL);
    assert.ok(m, 'la projection de getEvents doit rester repérable');
    const fn = new Function('r', m[1].replace(/^\s*return \{/m, 'return {'));
    return (ligne) => fn(ligne);
}

const ligne = (extra) => Object.assign({
    id: 1, type: 'read', manga_id: 'm1', source: 'weebcentral',
    chapter_id: 'c1', metadata: null, created_at: '2026-10-14T22:37:05.000Z',
    rc_chapter: null,
}, extra);

test('une lecture sans numéro le reprend de read_chapters', () => {
    const r = projection()(ligne({ rc_chapter: 1190 }));
    assert.deepEqual(r.metadata, { chapter: 1190 },
        '« Chapitre ? » devient « Chapitre 1190 » sans rien réécrire en base');
});

test('ce que l’événement dit de lui-même reste prioritaire', () => {
    // Si les deux divergent, l'événement est la trace de CE QUI S'EST PASSÉ ;
    // read_chapters est l'état courant. Laisser l'état courant réécrire
    // l'histoire rendrait l'historique inutilisable comme preuve.
    const r = projection()(ligne({ metadata: { chapter: 2, page: 1 }, rc_chapter: 999 }));
    assert.deepEqual(r.metadata, { chapter: 2, page: 1 });
});

test('la page déjà connue n’est pas perdue en complétant le chapitre', () => {
    const r = projection()(ligne({ metadata: { page: 7 }, rc_chapter: 42 }));
    assert.deepEqual(r.metadata, { page: 7, chapter: 42 },
        'compléter ne doit pas remplacer');
});

test('sans rien des deux côtés, la métadonnée reste nulle', () => {
    const r = projection()(ligne({}));
    assert.equal(r.metadata, null,
        'inventer un numéro serait pire que l’absence : « Chapitre ? » est au moins honnête');
});

test('la métadonnée stockée en texte est relue', () => {
    // MySQL rend la colonne JSON tantôt en objet, tantôt en chaîne selon le
    // pilote : les deux chemins doivent donner le même résultat.
    const r = projection()(ligne({ metadata: '{"chapter":5}' }));
    assert.deepEqual(r.metadata, { chapter: 5 });
});

test('la jointure se fait sur la clé primaire de read_chapters', () => {
    // PRIMARY KEY (user_id, chapter_id) : sans les deux colonnes, la
    // jointure deviendrait un balayage, et sans user_id elle rendrait le
    // numéro lu par QUELQU'UN D'AUTRE.
    assert.match(CTRL, /LEFT JOIN read_chapters rc\s*\n\s*ON rc\.user_id = e\.user_id AND rc\.chapter_id = e\.chapter_id/,
        'la jointure doit porter sur user_id ET chapter_id');
});

test('le numéro n’est plus posé à côté de metadata', () => {
    // La cause elle-même. Qu'un seul appelant repasse le numéro à plat et les
    // « Chapitre ? » reviennent, sans que rien ne le signale.
    const appels = CTRL.match(/pushEvent\([^;]*?\)/gs) || [];
    assert.ok(appels.length >= 5, 'les appels à pushEvent doivent rester repérables');
    for (const a of appels) {
        if (!/\bchapter\b/.test(a)) continue;
        assert.match(a, /metadata:\s*\{[^}]*\bchapter\b/,
            'un numéro de chapitre doit voyager DANS metadata : ' + a.replace(/\s+/g, ' ').slice(0, 90));
    }
});
