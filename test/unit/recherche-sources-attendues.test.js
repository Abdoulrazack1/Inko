// ============================================================
// test/unit/recherche-sources-attendues.test.js — dire QUI on attend
// ------------------------------------------------------------
// Les sources sont interrogées séparément et les résultats s'affichent au fil
// des réponses. Pendant ce temps, un bandeau disait « D'autres sources
// répondent encore… » — sans jamais nommer lesquelles.
//
// Devant une page à moitié vide, cela ne permet aucune décision : on ne sait
// ni combien de temps attendre, ni si le catalogue qu'on visait est déjà
// passé. Une source de livres qui traîne et une source de mangas qui traîne
// n'appellent pas la même patience quand on cherche un manga.
//
// Vérifié dans le navigateur sur une vraie recherche : d'abord « Project
// Gutenberg, Livres en français et SushiScan répondent encore… », puis, une
// fois SushiScan revenu, « Project Gutenberg et Livres en français répondent
// encore… ». La liste rétrécit à mesure.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'assets', 'js', 'recherche.js'), 'utf8')
    .replace(/\r\n/g, '\n');

test('la liste d’attente est tenue, et vidée au fil des réponses', () => {
    assert.match(SRC, /let enAttente = actives\.map\(s => s\.name \|\| s\.id\)/,
        'la liste part des sources réellement interrogées');
    assert.match(SRC, /enAttente = enAttente\.filter\(n => n !== nom\)/,
        'une source qui répond doit en sortir — sinon le bandeau mentirait');
    assert.match(SRC, /renderResults\(q, \{ enCours: repondues < actives\.length, attendues: enAttente \}\)/,
        'et la liste doit parvenir au rendu');
});

test('l’accord suit le nombre de sources restantes', () => {
    // Trois formes, parce qu'« 1 source(s) » est le genre de détail qui fait
    // lire une interface comme un formulaire administratif.
    const bloc = /const phraseAttente =([\s\S]*?);\n/.exec(SRC);
    assert.ok(bloc, 'la construction de la phrase doit rester lisible');

    assert.match(bloc[1], /length === 0 \?/, 'un repli existe quand on ne sait pas qui manque');
    assert.match(bloc[1], /length === 1 \?/, 'le singulier : « … répond encore »');
    assert.match(bloc[1], /répond encore/, 'singulier accordé');
    assert.match(bloc[1], /répondent encore/, 'pluriel accordé');
    assert.match(bloc[1], /et <strong>/, 'le dernier nom est joint par « et », pas par une virgule');
});

test('les noms de source sont échappés', () => {
    // Ils viennent d'une extension, c'est-à-dire d'un fichier que l'on peut
    // installer soi-même. Un nom porteur de balises deviendrait une injection
    // dans la page de recherche.
    const bloc = /const quiManque =([^\n]*)/.exec(SRC);
    assert.ok(bloc, 'la préparation des noms doit rester repérable');
    assert.match(bloc[1], /MH\.esc\(n\)/, 'chaque nom passe par l’échappement');
});

test('le bandeau d’échec reste distinct du bandeau d’attente', () => {
    // Une source TOMBÉE et une source LENTE demandent deux réactions
    // différentes : relancer, ou patienter. Les confondre ramènerait le défaut
    // que l'audit AMEL-11 avait justement corrigé.
    assert.match(SRC, /sourcesEnEchec\.map/, 'le bandeau d’échec nomme les sources tombées');
    assert.match(SRC, /const bandeauEnCours = opts\.enCours/, 'et celui d’attente est séparé');
});
