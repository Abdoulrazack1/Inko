// ============================================================
// test/unit/widget-lien.test.js — le lien du widget survit à la validation
// ------------------------------------------------------------
// Le widget « Reprendre » dépose un chemin dans une intention Android ; le
// greffon `RaccourcisPlugin` le valide avant de laisser la page naviguer.
// Deux langages, deux fichiers, un seul contrat — et rien qui les relie.
//
// Quand ils divergent, il ne se passe RIEN : l'appui ouvre l'application, qui
// s'arrête sur l'accueil. Pas d'erreur, pas de message. Mesuré avant
// correction : sur six identifiants réalistes, cinq étaient rejetés, dont
// « one-piece_(2024) » et « k-on! », parce que `encodeURIComponent` laisse
// passer !'()*~ — légal dans une URL, refusé par le greffon.
//
// Ce test lit la classe de caractères DANS le Java, et l'applique à la
// fonction d'encodage prise DANS le JavaScript. Si l'une des deux bouge, il
// tombe.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

/** La fonction d'encodage, extraite du lecteur (elle vit dans une IIFE). */
function encodeurDuLecteur() {
    const src = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'chapitre.js'), 'utf8');
    const m = /function encoderStrict\(v\) \{([\s\S]*?)\n {4}\}/.exec(src);
    assert.ok(m, 'encoderStrict doit exister dans chapitre.js');
    return new Function('v', m[1]);
}

/** La classe de caractères acceptée, extraite du greffon Android. */
function validateurDuGreffon() {
    const java = fs.readFileSync(
        path.join(ROOT, 'android', 'app', 'src', 'main', 'java', 'app', 'inko', 'mobile',
            'RaccourcisPlugin.java'), 'utf8');
    const m = /lien\.matches\("(\/\[[^"]+)"\)/.exec(java);
    assert.ok(m, 'la validation du lien doit être lisible dans RaccourcisPlugin.java');
    // Java écrit `\\.` là où une regex JS écrit `\.` — même classe, échappement double.
    const motif = m[1].replace(/\\\\/g, '\\');
    return new RegExp('^' + motif + '$');
}

// Des identifiants qui existent vraiment dans les catalogues : parenthèses de
// millésime, point d'exclamation, apostrophe, espace, caractères japonais.
const IDENTIFIANTS = [
    'solo-leveling',
    'one-piece_(2024)',
    'k-on!',
    'tokyo~ghoul',
    "jojo's-bizarre-adventure",
    'a*b',
    'naruto 01',
    '日本語のタイトル',
    'chap.5',
    'a+b&c=d',
    '100%-manga',
    'slash/dans/lid',
];

test('tout identifiant encodé passe la validation du greffon Android', () => {
    const encoder = encodeurDuLecteur();
    const accepte = validateurDuGreffon();

    for (const id of IDENTIFIANTS) {
        const lien = `/chapitre.html?manga=${encoder(id)}&chapter=${encoder('1')}&source=${encoder('mangadex')}`;
        assert.ok(accepte.test(lien), `le lien de « ${id} » serait rejeté en silence :\n  ${lien}`);
    }
});

test('l’encodage reste réversible — le lien désigne bien la bonne série', () => {
    // Encoder plus strictement ne doit pas encoder FAUX : le chapitre ouvert
    // doit être celui qu'on lisait, pas un voisin.
    const encoder = encodeurDuLecteur();
    for (const id of IDENTIFIANTS) {
        assert.equal(decodeURIComponent(encoder(id)), id, `« ${id} » ne se relit pas à l’identique`);
    }
});

test('encodeURIComponent seul NE suffit PAS — la raison d’être de ce garde-fou', () => {
    // Si ce test venait à passer, c'est qu'`encodeURIComponent` s'est mis à
    // couvrir ces caractères, et que `encoderStrict` n'aurait plus de raison
    // d'être. Le faire échouer alors est le bon signal.
    const accepte = validateurDuGreffon();
    const rejetes = IDENTIFIANTS.filter(
        (id) => !accepte.test(`/chapitre.html?manga=${encodeURIComponent(id)}`));
    assert.ok(rejetes.length > 0,
        'encodeURIComponent passe désormais partout : encoderStrict peut être retiré');
});

test('le widget ne peut pas fabriquer un lien vers un autre hôte', () => {
    // La validation autorise `/...` mais pas `//...` : un chemin protocole-relatif
    // pointerait vers un serveur tiers.
    const accepte = validateurDuGreffon();
    const java = fs.readFileSync(
        path.join(ROOT, 'android', 'app', 'src', 'main', 'java', 'app', 'inko', 'mobile',
            'RaccourcisPlugin.java'), 'utf8');
    assert.match(java, /startsWith\("\/\/"\)/,
        'le refus explicite de « // » doit rester dans le greffon');
    assert.ok(accepte.test('/chapitre.html?manga=x'));
    assert.ok(!accepte.test('http://ailleurs.example/chapitre.html'));
});
