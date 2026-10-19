// ============================================================
// test/unit/note-position.test.js — une note sait où elle a été prise
// ------------------------------------------------------------
// Une note portait sa page depuis toujours. Trois choses la perdaient.
//
//   1. Le lien du journal l'oubliait :
//
//          MH.readerHref(n.mangaId, n.chapterId, n.source)
//
//      alors que `readerHref` accepte un quatrième argument `page` depuis
//      le correctif AMEL-114, et que l'historique s'en sert déjà. Cliquer
//      « Chap. 12 · page 7 » rouvrait le chapitre à la page 1.
//
//   2. Le lecteur de ROMANS ne capturait aucune position :
//
//          chapterId: currentChap.id, chapterNum: ..., page: null
//
//      Sur un chapitre de roman qui fait quarante écrans, toutes les notes
//      pointaient donc au même endroit : le début. `scrollPct()` existait
//      dans le même fichier, et « citer un passage », vingt lignes plus
//      bas, s'en servait déjà.
//
//   3. Le champ `page` ne veut pas dire la même chose des deux côtés — un
//      NUMÉRO de planche côté images, un POURCENTAGE de défilement côté
//      romans. Trois endroits l'écrivaient « page 53 » sans distinction.
//      Remplir le champ pour les romans sans toucher à l'affichage aurait
//      donc créé une page qui n'existe pas.
//
// Vérifié dans le navigateur :
//
//     MH.notePosLabel('weebcentral', 12)              page 12
//     MH.notePosLabel('weebcentral', 12, {short:1})   p. 12
//     MH.notePosLabel('gutenberg', 53)                53 %
//     MH.readerHref('m','c','weebcentral', 12)        …&page=12
//     MH.readerHref('n','c','gutenberg', 53)          lecture.html?…&page=53
//
// Le journal de ce compte est vide : le lien d'une note réelle n'a donc pas
// été observé en situation, seulement ses deux moitiés.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const lire = (f) => fs.readFileSync(
    path.join(__dirname, '..', '..', 'assets', 'js', f), 'utf8').replace(/\r\n/g, '\n');
const GLOBAL = lire('global.js');
const NOTES = lire('notes.js');
const NOTES_UI = lire('notes-ui.js');
const LECTURE = lire('lecture.js');

/** Extrait `notePosLabel` de global.js et l'exécute pour de vrai. */
function posLabel() {
    const m = /window\.MH\.notePosLabel = function \(source, page, opts\) \{\n([\s\S]*?)\n    \};/
        .exec(GLOBAL);
    assert.ok(m, 'notePosLabel doit rester repérable');
    const fn = new Function('window', 'source', 'page', 'opts', m[1]);
    const w = { MH: { isNovelSource: (s) => s === 'gutenberg' } };
    return (source, page, opts) => fn(w, source, page, opts);
}

test('une planche se dit en page, un roman en pourcentage', () => {
    const L = posLabel();
    assert.equal(L('weebcentral', 12), 'page 12');
    assert.equal(L('weebcentral', 12, { short: true }), 'p. 12');
    // Espace fine insécable : « 53 % » ne doit pas se couper en fin de ligne.
    assert.equal(L('gutenberg', 53), '53 %');
    assert.equal(L('gutenberg', 53, { short: true }), '53 %',
        'la forme courte d’un pourcentage est le pourcentage lui-même');
});

test('un pourcentage de défilement est arrondi', () => {
    // `scrollPct()` rend un entier, mais une note ancienne peut porter autre
    // chose, et « 53.47058823529412 % » n’est pas une position, c’est un bug
    // à l’écran.
    assert.equal(posLabel()('gutenberg', 53.47), '53 %');
});

test('une note sans position ne dit rien plutôt que « page null »', () => {
    const L = posLabel();
    assert.equal(L('weebcentral', null), '');
    assert.equal(L('weebcentral', undefined), '');
    assert.equal(L('weebcentral', ''), '');
});

// ── Le lien du journal ──
test('le lien d’une note emporte sa page', () => {
    assert.match(NOTES, /MH\.readerHref\(n\.mangaId, n\.chapterId, n\.source, n\.page\)/,
        'la page connue de la note doit passer dans le lien');
});

test('le lecteur accepte bien cette page', () => {
    // Sans ça, le point précédent ne serait qu’un paramètre d’URL ignoré.
    assert.match(GLOBAL, /const pos = Number\(page\) > 1 \? `&page=\$\{Math\.floor\(Number\(page\)\)\}` : '';/,
        'readerHref doit écrire &page=');
    assert.match(lire('chapitre.js'), /new URLSearchParams\(location\.search\)\.get\('page'\)/,
        'le lecteur d’images doit lire ?page=');
    assert.match(LECTURE, /new URLSearchParams\(location\.search\)\.get\('page'\)/,
        'le lecteur de romans aussi');
});

// ── Le lecteur de romans capture enfin une position ──
test('une note prise dans un roman retient où on en était', () => {
    const m = /function notesContext\(\) \{([\s\S]*?)\n    \}/.exec(LECTURE);
    assert.ok(m, 'notesContext doit rester repérable');
    assert.match(m[1], /page: scrollPct\(\)/,
        'le contexte doit porter le pourcentage de défilement');
    // Hors commentaires : celui qui explique le correctif cite le code d’avant.
    const code = m[1].split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    assert.ok(!/page: null/.test(code),
        'plus de position nulle : toutes les notes d’un chapitre pointaient au même endroit');
});

// ── Une seule façon d’écrire la position ──
test('les trois affichages passent par le même libellé', () => {
    for (const [nom, src] of [['notes.js', NOTES], ['notes-ui.js', NOTES_UI]]) {
        assert.match(src, /notePosLabel/, nom + ' doit utiliser le libellé partagé');
        assert.ok(!/`p(age)?\.? \$\{n\.page\}`/.test(src),
            nom + ' ne doit plus formater la position lui-même');
        assert.ok(!/`p\.\$\{n\.page\}`/.test(src),
            nom + ' non plus en forme courte');
    }
});

test('l’export Markdown dit la position dans la même unité', () => {
    // Un journal exporté se relit ailleurs, souvent plus tard : « p. 53 »
    // pour un roman y serait indéchiffrable.
    const m = /const contexte = \[([\s\S]*?)\]\n?\s*\.filter/.exec(NOTES)
        || /const contexte = \[([\s\S]*?)\.filter/.exec(NOTES);
    assert.ok(m, 'le contexte de l’export doit rester repérable');
    assert.match(m[1], /notePosLabel/,
        'l’export aussi doit passer par le libellé partagé');
});
