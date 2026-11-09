// ============================================================
// test/unit/paquet-sans-orphelins.test.js — le paquet n'emporte que ce
// qu'une page reclame
// ------------------------------------------------------------
// `build-mobile-www.js` copie des DOSSIERS entiers. Le paquet emportait
// donc ce qui avait cesse d'etre utilise, et rien ne le disait.
//
// Mesure du 9 novembre, sur 5,3 Mo :
//
//     assets/js/hero3d.js        10 Ko   plus appele par aucune page
//     assets/vendor/three.min.js 594 Ko  charge par hero3d.js, et par lui seul
//
// Soit 604 Ko, 11 % du paquet, pour un ornement qui n'existe plus : la
// couche 3D du hero de l'accueil a disparu avec la refonte de l'etape 3
// (commit d839d5d). Le module est reste, la bibliotheque aussi.
//
// CE QU'ON NE FAIT PAS. On ne supprime rien du depot : savoir si le hero
// 3D revient un jour n'est pas une question de build. On cesse seulement
// de l'embarquer, et le build le DIT — un build qui jette en silence est
// pire que le poids qu'il economise.
//
// LE PIEGE, et c'est lui qui a demande un filet. `caches.addAll` rejette
// EN BLOC si un seul chemin rend 404. Ecarter par erreur un fichier
// precache ne couterait pas un module : ca couterait tout le mode hors
// ligne, a l'installation du worker, sans rien dans l'interface pour le
// dire. Le build refuse donc de finir dans ce cas.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const lire = (...p) => fs.readFileSync(path.join(RACINE, ...p), 'utf8').replace(/\r\n/g, '\n');
const BUILD = lire('scripts-ci', 'build-mobile-www.js');

test('le build calcule l’accessibilite depuis les pages, de proche en proche', () => {
    const i = BUILD.indexOf('function ecarterLesOrphelins(dir) {');
    assert.notEqual(i, -1, 'ecarterLesOrphelins doit rester reperable');
    const b = BUILD.slice(i, BUILD.indexOf('\n}\n', i));
    assert.match(b, /fs\.readdirSync\(dir\)\.filter\(\(f\) => f\.endsWith\('\.html'\)\)/,
        'les pages sont les racines');
    assert.match(b, /while \(aVoir\.length\)/,
        'de proche en proche : une page cite hero3d.js, qui cite three.min.js');
    assert.match(b, /service-worker/, 'le worker precache par chemin : c’est une racine aussi');
});

test('l’elagage vient APRES l’injection des modules du mode autonome', () => {
    // Sinon `hub.js`, `natif.js`, `sources-embarquees.js` et leurs voisins
    // seraient jetes : aucune page du depot ne les cite, c'est le build
    // qui les insere. Neuf modules, dont tout le mode autonome.
    const iInject = BUILD.indexOf('injecterHub(SORTIE);');
    const iElague = BUILD.indexOf('ecarterLesOrphelins(SORTIE)');
    assert.ok(iInject !== -1 && iElague !== -1);
    assert.ok(iInject < iElague,
        'elaguer avant l’injection emporterait tout le mode autonome');
});

test('le build refuse d’ecarter un fichier que le worker precache', () => {
    const b = BUILD.slice(BUILD.indexOf('function ecarterLesOrphelins(dir) {'));
    assert.match(b, /const manquants = ecartes\.filter\(\(e\) => texte\.includes\('\/' \+ e\.rel\)\)/);
    assert.match(b, /manquants\.length[\s\S]{0,400}?process\.exit\(1\)/,
        'un seul 404 fait rejeter addAll en bloc : le build doit s’arreter');
});

test('ce qui est ecarte est nomme, jamais jete en silence', () => {
    const b = BUILD.slice(BUILD.indexOf('function ecarterLesOrphelins(dir) {'));
    assert.match(b, /aucune page ne les reclame/, 'le build dit ce qu’il laisse dehors');
    assert.match(b, /Math\.round\(e\.poids \/ 1024\)/, 'avec le poids, pour qu’on juge');
});

test('hero3d.js n’est reclame par aucune page du depot', () => {
    // La mesure qui a declenche tout ca, refaite a chaque execution. Si ce
    // test tombe parce qu'une page rappelle hero3d.js, tant mieux : le
    // build la suivra et rembarquera three.min.js tout seul.
    const pages = fs.readdirSync(RACINE).filter((f) => f.endsWith('.html'));
    for (const p of pages) {
        assert.ok(!lire(p).includes('hero3d'),
            p + ' cite hero3d.js — mettre ce test a jour, il n’est plus orphelin');
    }
    // Et three.min.js n'a pas d'autre appelant que lui.
    const jsDir = path.join(RACINE, 'assets', 'js');
    const citants = fs.readdirSync(jsDir)
        .filter((f) => f.endsWith('.js') && lire('assets', 'js', f).includes('vendor/three.min.js'));
    assert.deepEqual(citants, ['hero3d.js'],
        'three.min.js ne doit avoir que hero3d.js pour appelant : ' + citants.join(', '));
});
