// ============================================================
// test/unit/transitions.test.js — trois durées, une courbe
// ------------------------------------------------------------
// Le chantier demandait « une durée, une courbe, appliquées partout ».
// La mesure a dit trois durées, et c'est elle qui avait raison : les
// 166 transitions de l'application (138 en CSS, 28 écrites en style en
// ligne depuis le JS) se rangent en trois grappes nettes selon CE
// QU'ELLES ANIMENT.
//
//   120–180 ms  (x50)  couleur, fond, filet, opacité — un contrôle
//                      répond au pointeur ou au clavier
//   200–340 ms  (x19)  transform sur une carte, ouverture d'un panneau
//   400–600 ms   (x8)  width sur une jauge, zoom d'une couverture
//
// Une seule durée pour les trois ferait claquer les jauges ou traîner
// les survols.
//
// L'autre moitié de l'item ne figurait pas dans le chantier, et c'est
// la plus lourde : 43 règles écrivaient `transition: all`, qui anime
// TOUTE propriété animable — y compris celles qui déclenchent une mise
// en page — sur des cartes répétées jusqu'à 500 fois par page.
//
// Mesuré au navigateur, après : catalogue 257 éléments animés,
// bibliothèque 2 600, profil 460 — trois durées et UNE courbe partout.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const lire = (p) => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');

const fichiers = (dossier, ext) => fs.readdirSync(path.join(RACINE, dossier))
    .filter(f => f.endsWith(ext))
    .map(f => [path.posix.join(dossier, f), lire(path.join(RACINE, dossier, f))]);

const SOURCES = [
    ...fichiers('assets/css', '.css'),
    ...fichiers('assets/js', '.js'),
    ...fs.readdirSync(RACINE).filter(f => f.endsWith('.html'))
        .map(f => [f, lire(path.join(RACINE, f))]),
];

// Les commentaires de ces fichiers citent ce qu'ils ont remplacé : on mesure
// les déclarations, pas la prose.
const SANS_COMMENTAIRES = SOURCES.map(([n, s]) => [n, s.replace(/\/\*[\s\S]*?\*\//g, '')]);

// `transition:` — jamais la DÉFINITION des jetons (`--transition:`).
const DECL = /(?<![-\w])transition:\s*([^;{}"'`]+)/g;

test('les trois durées sont nommées, et elles sont trois', () => {
    const global = lire(path.join(RACINE, 'assets', 'css', 'global.css'));
    assert.match(global, /--transition:\s*150ms var\(--ease-out\)/, 'réponse');
    assert.match(global, /--transition2:\s*280ms var\(--ease-out\)/, 'déplacement');
    assert.match(global, /--transition3:\s*500ms var\(--ease-out\)/, 'parcours');
    // Et pas une quatrième qui se glisserait.
    const dures = [...global.matchAll(/--transition\d*:\s*(\d+)ms/g)].map(m => m[1]);
    assert.deepEqual(dures.sort((a, b) => a - b), ['150', '280', '500']);
});

test('plus une seule durée écrite en dur', () => {
    const fautes = [];
    for (const [nom, src] of SOURCES) {
        for (const m of src.matchAll(DECL)) {
            if (/[\d.]+\s*m?s(?![\w-])/.test(m[1])) {
                fautes.push(`${nom} — transition: ${m[1].trim().slice(0, 60)}`);
            }
        }
    }
    assert.deepEqual(fautes, [], `durées littérales :\n  ${fautes.join('\n  ')}`);
});

test('plus un seul « transition: all »', () => {
    // `all` anime toute propriété animable, y compris celles qui
    // déclenchent une mise en page. Quarante-trois règles l'employaient,
    // sur des cartes répétées jusqu'à 500 fois par page.
    const fautes = [];
    for (const [nom, src] of SANS_COMMENTAIRES) {
        for (const m of src.matchAll(DECL)) {
            if (/(^|,)\s*all\b/.test(m[1])) fautes.push(`${nom} — ${m[1].trim().slice(0, 50)}`);
        }
    }
    assert.deepEqual(fautes, [], `« all » restants :\n  ${fautes.join('\n  ')}`);
});

test('la virgule de la forme abrégée sépare des transitions COMPLÈTES', () => {
    // `transition: a, b, c var(--transition)` ne donne sa durée qu'à `c` :
    // les deux premières valent 0 s et claquent. C'est le piège dans lequel
    // la première version de cette migration est tombée — d'où ce test.
    const fautes = [];
    for (const [nom, src] of SOURCES) {
        for (const m of src.matchAll(DECL)) {
            const segments = m[1].split(',').map(s => s.trim()).filter(Boolean);
            if (segments.length < 2) continue;
            for (const seg of segments) {
                if (!/var\(--transition\d?\)/.test(seg)) {
                    fautes.push(`${nom} — « ${seg} » n’a pas de durée dans « ${m[1].trim().slice(0, 64)} »`);
                }
            }
        }
    }
    assert.deepEqual(fautes, [], `segments sans durée :\n  ${fautes.join('\n  ')}`);
});

test('l’état d’un contrôle est défini une seule fois', () => {
    const global = lire(path.join(RACINE, 'assets', 'css', 'global.css'));
    const m = /--transition-etat:([\s\S]*?);/.exec(global);
    assert.ok(m, '--transition-etat existe');
    const props = [...m[1].matchAll(/([a-z-]+)\s+150ms/g)].map(x => x[1]);
    assert.deepEqual(props.sort(), ['background-color', 'border-color', 'box-shadow',
        'color', 'opacity', 'transform'].sort(),
    'les six propriétés que ces règles animent réellement, et pas une de plus');
    // Chaque propriété porte sa durée : c'est le seul moyen correct.
    assert.equal((m[1].match(/150ms/g) || []).length, 6);
});
