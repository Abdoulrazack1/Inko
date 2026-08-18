// ============================================================
// test/unit/icone-android.test.js — l'icône est-elle vraiment celle d'Inko ?
// ------------------------------------------------------------
// Trois tentatives ont été nécessaires, et chaque fois un contrôle disait
// « bon » :
//
//   1. j'ai remplacé les PNG du lanceur — or `minSdkVersion` vaut 26, donc
//      Android n'utilise JAMAIS ces PNG : il compose l'icône ADAPTATIVE.
//      Le contrôle regardait le fichier de repli ;
//   2. j'ai corrigé l'icône mais pas l'ÉCRAN DE DÉMARRAGE, qui portait encore
//      le gabarit Capacitor en 11 copies — c'est pourtant lui qu'on voit en
//      premier ;
//   3. le fond vectoriel portait le même nom qu'une couleur héritée de
//      Capacitor (`ic_launcher_background` en drawable ET en color).
//
// Ce test vérifie donc ce qu'Android utilise RÉELLEMENT, pas ce qui existe.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const RES = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const lire = (p) => fs.readFileSync(path.join(RES, p), 'utf8');

test('sur API 26+, c’est l’icône ADAPTATIVE qui compte — et elle existe', () => {
    // `mipmap-anydpi-v26/` gagne sur toutes les densités PNG dès Android 8.
    // Vérifier les PNG sans vérifier ceci, c'est regarder le repli.
    for (const f of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
        const xml = lire(path.join('mipmap-anydpi-v26', f));
        assert.match(xml, /<adaptive-icon/, `${f} doit être une icône adaptative`);
        assert.match(xml, /<background android:drawable="@drawable\//, `${f} : fond vectoriel`);
        assert.match(xml, /<foreground android:drawable="@drawable\//, `${f} : avant-plan vectoriel`);
    }
});

test('les couches référencées existent vraiment', () => {
    // Une référence vers un drawable absent ne se voit pas à la lecture du
    // XML : la construction échoue, ou pire, une couche vide passe.
    for (const f of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
        const xml = lire(path.join('mipmap-anydpi-v26', f));
        for (const m of xml.matchAll(/android:drawable="@drawable\/([a-z0-9_]+)"/g)) {
            assert.ok(fs.existsSync(path.join(RES, 'drawable', m[1] + '.xml')),
                `${f} référence @drawable/${m[1]}, qui n’existe pas`);
        }
    }
});

test('aucun nom de ressource n’est ambigu entre drawable et color', () => {
    // `@drawable/x` et `@color/x` sont distincts pour Android, mais partager
    // le nom rend indéchiffrable ce que la chaîne de construction a retenu.
    const drawables = fs.readdirSync(path.join(RES, 'drawable'))
        .filter((f) => f.endsWith('.xml')).map((f) => f.replace('.xml', ''));
    const couleurs = [];
    for (const f of fs.readdirSync(path.join(RES, 'values'))) {
        if (!f.endsWith('.xml')) continue;
        for (const m of lire(path.join('values', f)).matchAll(/<color name="([^"]+)"/g)) couleurs.push(m[1]);
    }
    const collisions = drawables.filter((d) => couleurs.includes(d));
    assert.deepEqual(collisions, [], `même nom en drawable et en color : ${collisions.join(', ')}`);
});

test('l’avant-plan porte le kanji, et il est visible', () => {
    const fg = lire(path.join('drawable', 'ic_launcher_foreground.xml'));
    const trace = /android:pathData="([^"]+)"/.exec(fg);
    assert.ok(trace, 'un tracé doit être présent');
    assert.ok(trace[1].length > 1000, 'le tracé du kanji fait plusieurs milliers de caractères');
    assert.match(fg, /android:fillColor="#FFFFFFFF"/, 'le kanji doit être opaque, sinon invisible');

    // La zone SÛRE d'une icône adaptative vaut 72/108 = 66,7 %. Mesuré au
    // navigateur, le kanji occupe 65,9 % x 70,3 % du carré : la hauteur
    // dépassait. L'échelle le ramène dedans — sans elle, un masque de lanceur
    // agressif rogne le haut et le bas du caractère.
    const echelle = /android:scaleX="([\d.]+)"/.exec(fg);
    assert.ok(echelle, 'le groupe doit porter une échelle');
    assert.ok(parseFloat(echelle[1]) <= 0.95,
        `échelle ${echelle[1]} : le kanji déborderait de la zone sûre`);
});

test('le fond est opaque — un kanji blanc sur rien est invisible', () => {
    const bg = lire(path.join('drawable', 'ic_launcher_fond.xml'));
    const couleurs = [...bg.matchAll(/android:color="#([0-9A-Fa-f]{8})"/g)].map((m) => m[1]);
    assert.ok(couleurs.length >= 2, 'le dégradé doit avoir ses arrêts');
    for (const c of couleurs) {
        assert.equal(c.slice(0, 2).toUpperCase(), 'FF',
            `arrêt #${c} : un fond translucide laisserait le kanji blanc invisible`);
    }
});

test('l’écran de démarrage ne porte plus le gabarit Capacitor', () => {
    // C'est le PREMIER écran affiché. Corriger l'icône sans le corriger
    // laissait le X bleu bien visible — et c'est ce qu'on voyait.
    const restants = fs.readdirSync(RES)
        .filter((d) => fs.existsSync(path.join(RES, d, 'splash.png')));
    assert.deepEqual(restants, [], `splash.png du gabarit : ${restants.join(', ')}`);
    assert.ok(fs.existsSync(path.join(RES, 'drawable', 'splash.xml')));
});

test('le manifeste pointe bien sur ces icônes', () => {
    const man = fs.readFileSync(
        path.join(ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8');
    assert.match(man, /android:icon="@mipmap\/ic_launcher"/);
    assert.match(man, /android:roundIcon="@mipmap\/ic_launcher_round"/);
});
