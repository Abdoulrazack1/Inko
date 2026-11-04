// ============================================================
// test/unit/sources-hotes.test.js — ce qu'une source va contacter, dit
// AVANT de l'activer
// ------------------------------------------------------------
// La carte d'une source affichait son `baseUrl`, et rien d'autre. Or
// beaucoup de sources servent leurs planches depuis des CDN distincts,
// et elles les DÉCLARENT déjà dans leur manifeste (`imageHosts`) :
// Weeb Central en annonce quatre — planeptune.us, lastation.us,
// lowee.us, compsci88.com — et SushiScan un. Aucun n'apparaissait nulle
// part dans l'interface.
//
// Ce n'est pas un détail de curiosité. `image.controller.js` élargit la
// liste blanche du proxy d'images avec ces hôtes, et le dit :
//
//   « Élargir la liste statique à chaque CDN découvert la ferait courir
//     derrière les sources indéfiniment. Une extension DÉCLARE donc les
//     hôtes d'images qu'elle utilise […]. La restriction reste fermée
//     par défaut : ajouter une source n'ouvre que ce que cette source
//     annonce. »
//
// et, plus haut, pourquoi le proxy existe : sans lui le lecteur charge
// en direct, « exposant l'IP de l'utilisateur au site source à chaque
// page tournée ».
//
// Activer une source, c'est donc décider quels serveurs verront passer
// sa lecture. On ne décide pas d'une chose qu'on ne voit pas.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const lire = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8')
    .replace(/\r\n/g, '\n');
const JS = lire('assets', 'js', 'sources.js');
const CSS = lire('assets', 'css', 'sources.css');

test('la carte montre les hôtes, pas seulement le site', () => {
    assert.match(JS, /function hotesHTML\(s\) \{/);
    assert.match(JS, /\$\{hotesHTML\(s\)\}/, 'et elle est appelée dans la carte');
    // L'ancienne ligne — le seul `baseUrl`, en style en ligne — a disparu.
    assert.ok(!/style="font-size:10\.5px;color:var\(--text3\);margin-top:4px"/.test(JS),
        'plus de ligne de baseUrl en style en ligne');

    const f = /function hotesHTML\(s\) \{([\s\S]*?)\n    \}/.exec(JS);
    assert.ok(f, 'le corps de la fonction');
    assert.match(f[1], /s\.imageHosts \|\| \[\]/, 'elle lit les hôtes déclarés');
});

test('le site n’est pas répété dans ses propres CDN', () => {
    // SushiScan déclare `sushiscan.fr` parmi ses `imageHosts`, et c'est
    // aussi son site : l'afficher deux fois donnerait à croire à un
    // serveur de plus.
    const f = /function hotesHTML\(s\) \{([\s\S]*?)\n    \}/.exec(JS)[1];
    assert.match(f, /\.filter\(h => h && h !== site\)/);
});

test('l’avertissement ne sort que s’il y a de quoi avertir', () => {
    // Sur une source qui se sert elle-même, une note « les images
    // viennent d'ailleurs » serait fausse, et sur neuf cartes elle
    // deviendrait du bruit qu'on cesse de lire.
    const f = /function hotesHTML\(s\) \{([\s\S]*?)\n    \}/.exec(JS)[1];
    assert.match(f, /\$\{images\.length \? /);
    // Et elle s'accorde : un serveur, ou plusieurs.
    assert.match(f, /images\.length === 1/);
});

test('un hôte se lit comme un hôte', () => {
    // `new URL(...).hostname` plutôt qu'une URL entière : ce qui compte
    // est le SERVEUR contacté, pas le chemin d'API par lequel on entre.
    assert.match(JS, /function hote\(u\) \{[\s\S]*?new URL\(u\)\.hostname\.replace\(\/\^www\\\.\/, ''\)/);
    // Une URL illisible ne doit pas faire tomber la page des sources.
    assert.match(JS, /catch \(e\) \{ return String\(u \|\| ''\)\.trim\(\); \}/);
    // En chasse fixe : on compare des noms de domaine à l'œil, et une
    // police proportionnelle rapproche les caractères qu'il faut
    // distinguer.
    assert.match(CSS, /\.source-hote \{[\s\S]*?font-family: var\(--font-mono\)/);
});

test('et c’est bien ce que le proxy ouvre', () => {
    // Si le proxy cessait de lire `imageHosts`, cet affichage
    // annoncerait une permission qui n'existe plus.
    const proxy = lire('server', 'controllers', 'image.controller.js');
    assert.match(proxy, /for \(const h of \(s\.imageHosts \|\| \[\]\)\)/);
});
