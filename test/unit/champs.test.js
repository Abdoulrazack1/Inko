// ============================================================
// test/unit/champs.test.js — un seul champ de saisie, et ses états
// ------------------------------------------------------------
// Il n'y avait aucune base : `input, select, textarea` ne recevaient que
// `font-family: inherit`, une transition et un anneau de focus. Chaque
// champ redéclarait donc le sien. Relevé sur dix classes :
//
//     7 rembourrages   de `0 10px` à `12px 16px`
//     6 tailles        de 12 à 15 px
//     5 rayons         8, 9, 11, 20 px et var(--radius2)
//     4 fonds, 4 bordures
//
// Et l'autre moitié de l'item manquait entièrement. `aria-invalid` est
// employé ZÉRO fois dans toute l'application ; `aria-describedby` une
// seule, pour une infobulle de carte. Aucun champ n'a jamais signalé
// d'erreur, ni à l'œil ni à la voix : quand une saisie est refusée, le
// message part en toast — loin du champ, sans dire lequel, et il s'efface
// — ou bien rien du tout ne se passe, ce qui est pire.
//
// Vérifié dans les pages réelles après : la recherche rend 12px 16px /
// r11 / 15px, la bibliothèque 9px 13px / r9 / 13px, le tri du catalogue
// 0 10px / r8 / 12,5px — chacun sa densité, une seule définition.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const CSS = path.join(RACINE, 'assets', 'css');
const lire = (...p) => fs.readFileSync(path.join(RACINE, ...p), 'utf8');
const FEUILLES = fs.readdirSync(CSS).filter(f => f.endsWith('.css'))
    .map(f => [f, fs.readFileSync(path.join(CSS, f), 'utf8')]);
// Les copies de travail sont en CRLF sous Windows : on normalise, sinon
// chaque expression ancrée sur un saut de ligne échoue ici et passe en CI.
const TOUT = FEUILLES.map(([, s]) => s.replace(/\r\n/g, '\n')).join('\n');

const FAMILLES = ['se-input', 'lib2-search', 'jr-search', 'list-modal-input',
    'chap-search-input', 'sort-select', 'reader-chap-select'];

test('le contrat du champ est déclaré une fois', () => {
    for (const j of ['--champ-fond', '--champ-bordure', '--champ-rembourrage',
        '--champ-rayon', '--champ-taille']) {
        assert.match(TOUT, new RegExp(j + '\\s*:'), `${j} doit être défini`);
    }
    // Et les familles existantes le prennent, au lieu de le recopier.
    const base = /\n\.champ,\n([\s\S]*?)\{/.exec(TOUT);
    assert.ok(base, 'la règle de base doit lister les familles');
    for (const f of FAMILLES) {
        assert.ok(base[1].includes('.' + f), `.${f} doit prendre le contrat`);
    }
});

test('aucune famille ne redéclare ce que le contrat porte', () => {
    const fautes = [];
    for (const f of FAMILLES) {
        for (const [nom, src] of FEUILLES) {
            // La règle propre à la classe, pas les variantes (:focus, etc.).
            const m = new RegExp('(^|\\n)[^\\n{}]*\\.' + f + '\\s*\\{([^}]*)\\}')
                .exec(src.replace(/\r\n/g, '\n'));
            // La règle du contrat liste ces mêmes classes : c'est elle qui
            // porte les déclarations, pas une famille qui les doublerait.
            if (!m || /var\(--champ-fond\)/.test(m[2])) continue;
            for (const prop of ['background', 'border-radius', 'padding', 'font-size']) {
                const d = new RegExp('(^|;)\\s*' + prop + '\\s*:').exec(m[2]);
                if (d) fautes.push(`${nom} .${f} — ${prop}`);
            }
        }
    }
    assert.deepEqual(fautes, [],
        `ces déclarations doublent le contrat :\n  ${fautes.join('\n  ')}`);
});

test('deux champs restent hors contrat, et c\'est voulu', () => {
    // `.im-input` vit dans le panneau de musique, sombre dans les quatre
    // thèmes comme la chrome d'un lecteur vidéo ; ses blancs en dur y sont
    // justes. `.nf-champ` est une recherche posée à même une barre d'outils,
    // sans fond ni bordure. Les router les casserait.
    const musique = lire('assets/css/music.css');
    assert.match(musique, /\.im-panel\{[^}]*background:rgba\(18,18,22/,
        'le panneau de musique est sombre en toutes éditions — c’est ce qui justifie l’exception');
    assert.ok(!/\.im-input[^}]*var\(--champ-/.test(musique),
        '.im-input ne doit pas prendre le contrat');
});

test('un champ refusé le dit à l\'œil ET à la voix', () => {
    assert.match(TOUT, /\[aria-invalid="true"\][^{]*\{[^}]*border-color:\s*var\(--red\)/,
        'l’erreur doit se voir');
    const js = lire('assets', 'js', 'global.js');
    assert.match(js, /window\.MH\.champErreur\s*=/, 'et une seule façon de la poser');
    const f = js.slice(js.indexOf('window.MH.champErreur'), js.indexOf('window.MH.champValide'));
    assert.match(f, /setAttribute\('aria-invalid', 'true'\)/, 'annoncée comme invalide');
    assert.match(f, /aria-describedby/, 'le message est rattaché au champ');
    assert.match(f, /setAttribute\('role', 'alert'\)/,
        'et annoncé au moment où il apparaît, sans attendre un retour de focus');
});

test('les trois refus passent par le champ, plus par un toast ni par le silence', () => {
    const col = lire('assets', 'js', 'collections.js');
    assert.match(col, /MH\.champErreur\?\.\(champNom, 'Donne un nom à ta liste'\)/);
    assert.ok(!/toast\?\.\('Donne un nom à ta liste'\)/.test(col), 'plus de toast pour ce refus');

    const bib = lire('assets', 'js', 'bibliotheque.js');
    assert.ok(!/toast\?\.\('Cette catégorie existe déjà'\)/.test(bib), 'plus de toast ici non plus');
    assert.equal((bib.match(/MH\.champErreur\?\./g) || []).length, 3,
        'trois refus : nom vide à deux endroits, et le doublon');
    // Le pire des trois : `if (!v) return;` ne produisait RIEN.
    assert.ok(!/const v = corps\.querySelector\('#catAddInput'\)[\s\S]{0,80}if \(!v\) return;/.test(bib),
        'un nom vide ne doit plus se solder par un silence');
});

test('aucune liste de sélecteurs ne se termine par une virgule', () => {
    // Trouvé en vérifiant dans le navigateur : la règle du contrat se
    // terminait par `.reader-chap-select, {`. Une virgule finale invalide
    // la liste ENTIÈRE, et le navigateur jette la règle sans un mot —
    // `npm run audit-css` ne l'avait pas vu non plus.
    const fautes = [];
    for (const [nom, src] of FEUILLES) {
        src.split('\n').forEach((l, i) => {
            if (/,\s*\{\s*$/.test(l)) fautes.push(`${nom}:${i + 1} — ${l.trim().slice(0, 60)}`);
        });
    }
    assert.deepEqual(fautes, [],
        `règles jetées en silence par le navigateur :\n  ${fautes.join('\n  ')}`);
});
