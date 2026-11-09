// ============================================================
// test/unit/gutendex-slash-et-tri.test.js — deux sources mortes pour un
// slash et un tri
// ------------------------------------------------------------
// Le bac a sable disait des deux Gutenberg : « pas de reponse en 20 s ».
// On en concluait que la source etait tombee. Elle repond en 80 ms.
//
// ── Le slash final n'est pas cosmetique ──
//
// Mesure du 9 novembre, curl, meme machine, meme instant :
//
//   /books/?page=1                              0,08 s
//   /books/?page=1&sort=popular                 0,08 s
//   /books?page=1&sort=popular                  PEND (30 s)
//   /books/78027/                               0,08 s
//   /books/78027                                PEND (22 s)
//
// `/books` sans slash rend un 301 vers `/books/`. Suivre cette
// redirection est gratuit — sauf avec un parametre derriere, ou la
// requete ne revient jamais. L'extension demandait exactement cette
// forme-la, sur les listes ET sur les fiches.
//
// ── Le tri est une preference, pas une exigence ──
//
//   /books/?languages=fr&page=1                 0,11 s
//   /books/?languages=fr&page=1&sort=popular    PEND (25 s)
//   /books/?languages=fr&page=1&sort=descending 503 apres 15 s
//
// Gutendex ne sait plus servir un tri combine a un filtre de langue.
// Attendre trente secondes puis echouer, c'est rendre une source morte
// pour un ordre d'affichage. On essaie le tri avec un delai court, et
// on retombe sur la requete qui, elle, repond.
//
// ── Apres ──
//
//   gutenberg      complet, 1 038 ms  (778 749 caracteres de texte)
//   gutenberg-fr   complet, 1 091 ms
//
// Contre 20 s de delai depasse et 40 s de partiel avant.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const lire = (f) => fs.readFileSync(path.join(RACINE, 'extensions-community', f, 'index.js'), 'utf8')
    .replace(/\r\n/g, '\n');
const LES_DEUX = ['gutenberg', 'gutenberg-fr'];

test('aucune URL Gutendex ne part sans son slash final', () => {
    for (const f of LES_DEUX) {
        const src = lire(f);
        // Une URL construite vers /books suivie d'autre chose qu'un slash.
        const fautives = [...src.matchAll(/\$\{API\}\/books(?!\/)[^`]*/g)].map((m) => m[0]);
        assert.deepEqual(fautives, [],
            f + ' : ' + fautives.join(', ') + ' — sans slash, la redirection pend');
        assert.match(src, /\$\{API\}\/books\/\?/, f + ' : les listes passent par /books/?');
        assert.match(src, /\$\{API\}\/books\/\$\{encodeURIComponent\(id\)\}\//,
            f + ' : les fiches aussi');
    }
});

test('le tri se replie, il ne fait pas tomber la source', () => {
    for (const f of LES_DEUX) {
        const src = lire(f);
        assert.match(src, /async function getJsonOuSansTri\(base, extra, ttl\)/, f);
        assert.match(src, /const DELAI_TRI_MS = 8000;/,
            f + ' : le tri a un delai COURT — on veut echouer vite pour se rabattre');
        assert.match(src, /triAbandonne = true;/, f + ' : une fois suffit, on n’insiste pas');
        assert.match(src, /return getJson\(base, ttl\);/, f + ' : le repli demande la meme chose, sans tri');
        assert.match(src, /liste rendue SANS tri/,
            f + ' : il faut le DIRE, sinon on croit le tri actif');
    }
});

test('le repli n’est pas plus lent que l’echec qu’il remplace', () => {
    // Un repli qui attend 30 s puis refait une requete serait pire que le
    // defaut. Le delai court est passe jusqu'a curl, et une tentative
    // suffit quand on sait qu'on va se rabattre.
    for (const f of LES_DEUX) {
        const src = lire(f);
        assert.match(src, /function curlGet\(url, maxBuffer = 32 \* 1024 \* 1024, asBuffer = false, delaiMs = 0\)/, f);
        assert.match(src, /const max = delaiMs \? String\(Math\.max\(1, Math\.round\(delaiMs \/ 1000\)\)\) : '30';/,
            f + ' : le delai doit atteindre curl, pas seulement la promesse');
        assert.match(src, /const essais = delaiMs \? 1 : 2;/,
            f + ' : deux tentatives sur une requete qu’on sait facultative, c’est le double de l’attente');
    }
});

test('le bac à sable choisit la porte sur le TYPE déclaré', () => {
    // Project Gutenberg expose `getPages` uniquement pour lever une
    // erreur explicative. Deviner le type d'apres les methodes presentes
    // faisait appeler la mauvaise, et le bac a sable rapportait l'echec
    // comme un defaut de la source — alors qu'il s'etait trompe de porte.
    const src = fs.readFileSync(path.join(RACINE, 'server', 'lib', 'bac-a-sable.js'), 'utf8')
        .replace(/\r\n/g, '\n');
    assert.match(src, /const type = String\(src\.type \|\| src\.format \|\| ''\)\.toLowerCase\(\);/);
    assert.match(src, /type === 'novel' \|\| type === 'book'/,
        'les deux types de texte que l’application connait');
    for (const f of LES_DEUX) {
        assert.match(lire(f), /type:\s*'book'/, f + ' : la source doit declarer son type');
    }
});
