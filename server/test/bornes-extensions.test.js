// ============================================================
// server/test/bornes-extensions.test.js — ce qu'on accepte de demander
// ------------------------------------------------------------
// `limit` et `offset` partaient BRUTS de la chaîne de requête jusqu'à
// l'extension. Deux conséquences, et la seconde est la plus gênante :
//
//   · on relayait « limit=100000 » à un site scrapé, c'est-à-dire qu'on lui
//     demandait de travailler sans mesure en notre nom ;
//   · **la clé de cache contenait cette valeur brute**. « limit=1 »,
//     « limit=2 », « limit=3 »… créaient chacune leur entrée : six cents
//     requêtes suffisent à évincer tout le cache de recherche depuis le
//     réseau local, et quatre cents celui des chapitres.
//
// Mesuré sur un serveur réel, cinq limites absurdes d'affilée :
//
//     avant   chacune repart chercher à la source
//     après   191 ms, puis 17, 15, 3 et 19 ms — une seule entrée
//
// Et cinq limites légitimes (11 à 15) coûtent toujours leur plein prix,
// 107 à 172 ms chacune : le cache n'a pas été rendu grossier, seulement
// insensible à l'absurde.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
    path.join(__dirname, '..', 'controllers', 'manga.controller.js'), 'utf8')
    .replace(/\r\n/g, '\n');

test('les bornes existent, et valent ce que la recherche agrégée applique déjà', () => {
    assert.match(SRC, /const LIMITE_RECHERCHE = 50;/,
        '50 est déjà le plafond de searchAll : deux chiffres différents seraient une incohérence');
    assert.match(SRC, /const LIMITE_CHAPITRES = 2000;/,
        'généreux exprès — One Piece compte 1 196 chapitres, la borne ne doit pas tronquer');
});

test('une valeur illisible retombe sur le défaut, pas sur zéro', () => {
    // `parseInt('abc')` rend NaN. Sans garde, `Math.min(Math.max(NaN, 1), 50)`
    // rend NaN, et l'extension recevrait NaN comme limite.
    const f = /const borner = \(v, defaut, max\) => \{([\s\S]*?)\n\};/.exec(SRC);
    assert.ok(f, 'borner doit rester repérable');
    assert.match(f[1], /Number\.isFinite\(n\)/, 'le cas non numérique doit être traité');
    assert.match(f[1], /return defaut;/, 'et retomber sur le défaut');
    assert.match(f[1], /Math\.min\(Math\.max\(n, 1\), max\)/, 'puis borner des deux côtés');
});

test('un offset négatif devient zéro', () => {
    const f = /const bornerOffset = \(v\) => \{([\s\S]*?)\n\};/.exec(SRC);
    assert.ok(f, 'bornerOffset doit rester repérable');
    assert.match(f[1], /n > 0 \? Math\.min\(n, 100000\) : 0/,
        'négatif ou illisible → 0, et un plafond au-dessus');
});

test('la clé de cache est construite sur les valeurs BORNÉES', () => {
    // C'est tout l'objet du correctif : une clé bâtie sur la valeur brute
    // laisse n'importe qui créer autant d'entrées qu'il veut.
    const rech = /const limit = borner\(limiteBrute[\s\S]*?const k = `s:[^`]*`;/.exec(SRC);
    assert.ok(rech, 'la recherche doit borner avant de construire sa clé');
    assert.ok(!/limiteBrute/.test(rech[0].split('const k =')[1] || ''),
        'la clé ne doit pas contenir la valeur brute');

    const chap = /const limit = borner\(req\.query\.limit[\s\S]*?const k = `c:[^`]*`;/.exec(SRC);
    assert.ok(chap, 'les chapitres aussi');
    assert.match(chap[0], /\$\{limit \?\? ''\}:\$\{offset\}/,
        'la clé des chapitres doit porter les valeurs bornées');
});

test('l’extension ne reçoit plus la requête entière', () => {
    // `req.query` partait tel quel : tout parametre inconnu, y compris une
    // limite absurde, traversait jusqu'au site scrapé.
    assert.ok(!/getChapters\(req\.params\.id, req\.query\)/.test(SRC),
        'la requête brute ne doit plus être relayée');
    assert.match(SRC, /const demande = \{ \.\.\.req\.query, offset \};/,
        'une demande bornée doit être construite');
    assert.match(SRC, /getChapters\(req\.params\.id, demande\)/,
        'et c’est elle qui part à l’extension');
});
