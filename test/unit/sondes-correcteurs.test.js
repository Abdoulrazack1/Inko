// ============================================================
// test/unit/sondes-correcteurs.test.js — les correcteurs de sondes sont sûrs
// ------------------------------------------------------------
// Un correcteur qui devine est un correcteur qui casse. Ces tests tiennent les
// trois promesses de scripts-ci/sondes/correcteurs :
//
//   1. IDEMPOTENT : appliqué deux fois, il ne change plus rien la seconde fois ;
//   2. HONNÊTE : `plan()` annonce exactement ce qu'`appliquer()` fait — et rien
//      avant d'appliquer n'est écrit ;
//   3. RESPECTUEUX : fins de ligne d'origine conservées (CRLF reste CRLF).
//
// Ils tournent sur une COPIE jetable du dépôt (SONDES_RACINE), jamais sur le
// vrai arbre de travail.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RACINE = fs.mkdtempSync(path.join(os.tmpdir(), 'inko-correcteurs-'));
process.env.SONDES_RACINE = RACINE;
const ecrire = (f, t) => { const p = path.join(RACINE, f); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, t); };
const lire = (f) => fs.readFileSync(path.join(RACINE, f), 'utf8');

ecrire('page.html', '<!DOCTYPE html>\n<html>\n<head></head>\n<body><a href="https://exemple.test" target="_blank">x</a>\n<a href="/a" target="_blank" rel="noopener">déjà bon</a></body>\n</html>\n');
ecrire('assets/css/global.css', '.plein {\n    min-height: 100vh;\n}\n.deja {\n    height: 100vh;\n    height: 100dvh;\n}\n');
ecrire('assets/js/m.js', "const h = `<a href=\"https://x.test\" target=\"_blank\">lien</a>`;\ntry { a(); } catch (e) { }\ntry { b(); } catch (e) { /* voulu */ }\n");
ecrire('package.json', '{\n  "name": "inko",\n  "version": "2.9.0"\n}\n');
ecrire('server/package.json', '{\n  "name": "inko-server",\n  "version": "2.5.7"\n}\n');
ecrire('extensions-community/versions.json', '{\n  "foo": "1.0.0",\n  "bar": "2.0.0"\n}\n');
ecrire('extensions-community/foo/index.js', "module.exports = { id: 'foo', version: '1.2.0' };\n");
ecrire('extensions-community/bar/index.js', "module.exports = { id: 'bar', version: '2.0.0' };\n");
ecrire('android/app/src/main/AndroidManifest.xml', '<manifest><application android:allowBackup="true" android:label="Inko"/></manifest>\n');
ecrire('.github/workflows/ci.yml', 'name: CI\r\non: [push]\r\njobs:\r\n  t:\r\n    runs-on: ubuntu-latest\r\n');

const { CORRECTEURS } = require('../../scripts-ci/sondes/correcteurs');
const SANS_GENERATEUR = CORRECTEURS.filter(c => !['openapi', 'precache', 'meta'].includes(c.nom));
const par = (nom) => CORRECTEURS.find(c => c.nom === nom);

test('chaque correcteur déclare un nom, un risque connu et les ids qu\'il couvre', () => {
    for (const c of CORRECTEURS) {
        assert.ok(c.nom && c.description, 'nom et description : ' + c.nom);
        assert.ok(['nul', 'faible', 'moyen'].includes(c.risque), 'risque invalide pour ' + c.nom);
        assert.ok(Array.isArray(c.couvre) && c.couvre.length, 'ids couverts pour ' + c.nom);
        assert.equal(typeof c.plan, 'function'); assert.equal(typeof c.appliquer, 'function');
    }
});

test('plan() n\'écrit rien : l\'arbre est identique avant et après', async () => {
    const avant = ['page.html', 'assets/css/global.css', 'assets/js/m.js', 'package.json', 'server/package.json', 'extensions-community/versions.json', 'android/app/src/main/AndroidManifest.xml', '.github/workflows/ci.yml'].map(lire);
    for (const c of SANS_GENERATEUR) await c.plan();
    const apres = ['page.html', 'assets/css/global.css', 'assets/js/m.js', 'package.json', 'server/package.json', 'extensions-community/versions.json', 'android/app/src/main/AndroidManifest.xml', '.github/workflows/ci.yml'].map(lire);
    assert.deepEqual(apres, avant);
});

test('noopener : ajoute rel aux seuls liens qui n\'en ont pas', async () => {
    assert.ok((await par('noopener').plan()).length >= 1);
    await par('noopener').appliquer();
    assert.match(lire('page.html'), /target="_blank" rel="noopener noreferrer">x</);
    assert.equal((lire('page.html').match(/rel="noopener"/g) || []).length, 1, 'le lien déjà conforme n\'est pas retouché');
    assert.match(lire('assets/js/m.js'), /target="_blank" rel="noopener noreferrer">lien/);
});

test('lang : ajoute lang="fr" sur <html> sans toucher le reste', async () => {
    await par('lang').appliquer();
    assert.match(lire('page.html'), /<html lang="fr">/);
});

test('vh-dvh : repli 100dvh après 100vh, une seule fois', async () => {
    await par('vh-dvh').appliquer();
    const css = lire('assets/css/global.css');
    assert.match(css, /min-height: 100vh;\n    min-height: 100dvh;/);
    assert.equal((css.match(/height: 100dvh/g) || []).length, 2, 'celui qui avait déjà son repli n\'est pas doublé');
});

test('versions : aligne le serveur sur la racine', async () => {
    await par('versions').appliquer();
    assert.equal(JSON.parse(lire('server/package.json')).version, '2.9.0');
    assert.match(lire('server/package.json'), /\n  "name": "inko-server"/, 'indentation conservée');
});

test('versions-extensions : seul ce qui dérive est réécrit', async () => {
    await par('versions-extensions').appliquer();
    const v = JSON.parse(lire('extensions-community/versions.json'));
    assert.equal(v.foo, '1.2.0'); assert.equal(v.bar, '2.0.0');
});

test('allowbackup : passe à false', async () => {
    await par('allowbackup').appliquer();
    assert.match(lire('android/app/src/main/AndroidManifest.xml'), /allowBackup="false"/);
});

test('ci-permissions : ajoute le bloc et CONSERVE les fins de ligne CRLF', async () => {
    await par('ci-permissions').appliquer();
    const t = lire('.github/workflows/ci.yml');
    assert.match(t, /permissions:\r\n {2}contents: read/);
    assert.ok(!/[^\r]\n/.test(t), 'aucune fin de ligne LF isolée dans un fichier CRLF');
});

test('catch-muet : trace les catch vides, laisse ceux qui portent un commentaire', async () => {
    await par('catch-muet').appliquer();
    const js = lire('assets/js/m.js');
    assert.match(js, /catch \(e\) \{ window\.MH\?\.err\?\.\('m\.js', e\); \}/);
    assert.match(js, /catch \(e\) \{ \/\* voulu \*\/ \}/, 'le catch délibéré (commenté) est respecté');
});

test('mouvement-reduit : ajoute le bloc une seule fois', async () => {
    await par('mouvement-reduit').appliquer();
    await par('mouvement-reduit').appliquer();
    const css = lire('assets/css/global.css');
    assert.equal((css.match(/@media \(prefers-reduced-motion: reduce\)/g) || []).length, 1, 'un seul bloc, même après deux applications');
    assert.equal((css.match(/inko:mouvement-reduit/g) || []).length, 1, 'une seule marque d\'idempotence');
});

test('IDEMPOTENCE : après application, plus aucun correcteur n\'a quoi que ce soit à faire', async () => {
    for (const c of SANS_GENERATEUR) await c.appliquer();
    const photo = (f) => lire(f);
    const fichiers = ['page.html', 'assets/css/global.css', 'assets/js/m.js', 'package.json', 'server/package.json', 'extensions-community/versions.json', 'android/app/src/main/AndroidManifest.xml', '.github/workflows/ci.yml'];
    const avant = fichiers.map(photo);
    for (const c of SANS_GENERATEUR) {
        assert.deepEqual(await c.plan(), [], `${c.nom} annonce encore des changements après application`);
        await c.appliquer();
    }
    assert.deepEqual(fichiers.map(photo), avant, 'une seconde application ne change aucun fichier');
});

test.after(() => { try { fs.rmSync(RACINE, { recursive: true, force: true }); } catch (e) { /* nettoyage */ } });
