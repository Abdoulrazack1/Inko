// ============================================================
// test/unit/maj-bureau-reprenable.test.js — un telechargement coupe
// reprend ou il s'est arrete
// ------------------------------------------------------------
// L'installeur de bureau pese ~80 Mo. Trois choses se liguaient pour
// faire recommencer de zero a chaque tentative :
//
//   · le fichier partiel etait EFFACE avant chaque essai
//     (`if (fs.existsSync(dest)) fs.unlinkSync(dest)`) ;
//   · `curl` etait appele sans `-C -`, donc sans reprise ;
//   · un plafond UNIQUE de 300 s coupait le transfert.
//
// Ce dernier point est la faute deja corrigee dans le proxy d'images :
// un seul delai ne distingue pas « hote mort » de « hote lent ». Sur une
// ligne lente, les 300 s tombaient en plein transfert valide, et l'essai
// suivant repartait de l'octet zero. La mise a jour ne pouvait tout
// simplement jamais aboutir.
//
// ── Ce qui a ete mesure ──
//
// Essai reel (`scratchpad/essai-reprise.js`) : un serveur HTTP local qui
// sert 24 Mo AVEC les plages d'octets, coupe en plein vol au tiers, puis
// relance.
//
//     1. coupee au tiers   echec, morceau garde 8 Mo, aucun fichier final
//     2. reprise           succes, taille exacte, OCTETS IDENTIQUES,
//                          morceau nettoye
//     3. morceau d'une autre URL   non repris, jete
//     4. morceau sans marque       non repris, jete
//
// LES DEUX DERNIERS CAS SONT LE VRAI SUJET. Une reprise n'est pas
// gratuite : reprendre sur un morceau venu d'une AUTRE version donne un
// fichier coherent en taille et faux en contenu. L'URL est donc ecrite a
// cote du morceau, et un morceau qui ne vient pas de la meme URL est
// jete. Le controle d'empreinte (audit SEC-03) reste la derniere
// barriere, et il efface aussi le morceau — sans quoi un telechargement
// corrompu se reprendrait a l'infini.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Ce fichier vit dans `server/test` et non `test/unit`, et ce n'est pas
// un detail de rangement : il CHARGE `update.controller.js`, qui tire
// `axios`. Le job frontend de la CI n'installe que les dependances de la
// racine — le test y echouait sur « Cannot find module 'axios' »,
// invisible en local ou `server/node_modules` existe. Un test qui touche
// au serveur appartient a la suite du serveur.
const SERVEUR = path.join(__dirname, '..');
const lire = (...p) => fs.readFileSync(path.join(SERVEUR, ...p), 'utf8').replace(/\r\n/g, '\n');
const SRC = lire('controllers', 'update.controller.js');
const M = require(path.join(SERVEUR, 'controllers', 'update.controller.js'));

function bacASable(nom) {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), 'inko-maj-'));
    return { dest: path.join(d, nom), dossier: d };
}
const nettoyer = (b) => { try { fs.rmSync(b.dossier, { recursive: true, force: true }); } catch (e) { /* rien */ } };

test('curl demande la reprise, avec deux delais separes', () => {
    const i = SRC.indexOf('function download(url, dest) {');
    assert.notEqual(i, -1, 'download doit rester reperable');
    const b = SRC.slice(i, SRC.indexOf('\n}\n', i));
    assert.match(b, /'-C', '-'/, 'sans -C -, curl repart de zero');
    assert.match(b, /'--connect-timeout', '10'/,
        'dix secondes pour ETABLIR : au-dela, l’hote ne repond pas');
    assert.match(b, /'-m', TRANSFERT_MAX_S/,
        'et un delai de TRANSFERT distinct, qu’une ligne lente ne doit pas heurter');
    assert.ok(!/timeout: 300000/.test(SRC),
        'le plafond unique de 300 s ne doit plus exister');
    assert.match(b, /'-o', part/, 'on ecrit dans le morceau, pas dans le fichier final');
});

test('le fichier final part, le morceau reste', () => {
    // C'est l'inversion qui rend la reprise possible : avant, les deux
    // etaient effaces ensemble avant chaque tentative.
    const i = SRC.indexOf("const dest = path.join(os.tmpdir(), 'Inko-Setup.exe');");
    const b = SRC.slice(i, i + 400);
    assert.match(b, /fs\.unlinkSync\(dest\)/, 'l’installeur complet d’un essai precedent part');
    assert.ok(!/jeterMorceau/.test(b), 'mais pas le morceau en cours');
});

test('un morceau venu d’une autre URL est jete, pas repris', () => {
    // Le cas qui transforme une reprise en corruption : meme taille,
    // contenu d’une autre version.
    const b = bacASable('Inko-Setup.exe');
    try {
        const part = M.cheminMorceau(b.dest);
        fs.writeFileSync(part, Buffer.alloc(2048));
        fs.writeFileSync(part + '.url', 'https://exemple/v1/Inko-Setup.exe');
        assert.equal(M.morceauUtilisable(b.dest, 'https://exemple/v2/Inko-Setup.exe'), false);
        assert.equal(fs.existsSync(part), false, 'le morceau doit etre jete');
        assert.equal(fs.existsSync(part + '.url'), false, 'sa marque aussi');
    } finally { nettoyer(b); }
});

test('un morceau sans marque d’URL n’est pas repris non plus', () => {
    // On ne devine pas d’ou vient un morceau : un fichier laisse la par
    // une version anterieure du code n’a aucune provenance connue.
    const b = bacASable('Inko-Setup.exe');
    try {
        const part = M.cheminMorceau(b.dest);
        fs.writeFileSync(part, Buffer.alloc(2048));
        assert.equal(M.morceauUtilisable(b.dest, 'https://exemple/Inko-Setup.exe'), false);
        assert.equal(fs.existsSync(part), false);
    } finally { nettoyer(b); }
});

test('un morceau de la MEME URL est repris', () => {
    const b = bacASable('Inko-Setup.exe');
    try {
        const part = M.cheminMorceau(b.dest);
        const url = 'https://exemple/v2/Inko-Setup.exe';
        fs.writeFileSync(part, Buffer.alloc(2048));
        fs.writeFileSync(part + '.url', url);
        assert.equal(M.morceauUtilisable(b.dest, url), true);
        assert.equal(fs.existsSync(part), true, 'et il doit survivre a la question');
    } finally { nettoyer(b); }
});

test('jeterMorceau efface le morceau ET sa marque, sans se plaindre', () => {
    const b = bacASable('Inko-Setup.exe');
    try {
        const part = M.cheminMorceau(b.dest);
        fs.writeFileSync(part, 'x');
        fs.writeFileSync(part + '.url', 'u');
        M.jeterMorceau(b.dest);
        assert.equal(fs.existsSync(part), false);
        assert.equal(fs.existsSync(part + '.url'), false);
        // Deux fois de suite : une absence n’est pas une erreur.
        assert.doesNotThrow(() => M.jeterMorceau(b.dest));
    } finally { nettoyer(b); }
});

test('une empreinte invalide efface AUSSI le morceau', () => {
    // Sans ca, la tentative suivante reprendrait le meme telechargement
    // corrompu, indefiniment — le correctif s’annulerait lui-meme.
    const i = SRC.indexOf('if (got !== want) {');
    assert.notEqual(i, -1);
    const b = SRC.slice(i, i + 600);
    assert.match(b, /jeterMorceau\(dest\);/);
    const j = SRC.indexOf('if (!ALLOW_UNVERIFIED) {');
    assert.match(SRC.slice(j, j + 400), /jeterMorceau\(dest\);/,
        'un installeur non verifiable aussi');
});

test('le repli PowerShell ne pretend pas reprendre', () => {
    // Il ne sait pas le faire. Ce qui compte est qu’il ecrive dans le
    // morceau et pas dans le fichier final, sinon le renommage final
    // deplacerait un fichier que personne n’a verifie.
    const i = SRC.indexOf('Invoke-WebRequest');
    const b = SRC.slice(i - 400, i + 400);
    assert.match(b, /'-o', part\]/, 'le repli ecrit dans le morceau');
    assert.ok(!/'-o', dest\]/.test(b), 'jamais directement dans le fichier final');
});
