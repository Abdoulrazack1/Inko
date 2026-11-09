// ============================================================
// test/unit/extensions-code-http.test.js — une page d'erreur n'est pas
// du contenu
// ------------------------------------------------------------
// Trois extensions appellent `curl -s -L` SANS `-f` : gutenberg et
// gutenberg-fr l'ont, novelbin, novelfull et sushiscan ne l'avaient pas.
// Sans lui, curl sort avec 0 sur un 429, un 403 ou un 503, et la page
// d'erreur devient du « contenu ».
//
// ── Ce que ca donnait, mesure le 9 novembre ──
//
// En diagnostiquant novelbin, mes propres appels ont declenche la limite
// du site. Le 429 de nginx fait 1 678 octets, donc au-dessus du seuil de
// taille qui servait de seul garde-fou : il passait, il etait MIS EN
// CACHE pour dix minutes, et l'analyseur annoncait « Contenu du chapitre
// introuvable ».
//
// Deux consequences, et la seconde est la pire. Le diagnostic accusait
// le balisage du site alors qu'on etait simplement limite — j'ai failli
// reecrire un selecteur qui n'avait rien. Et le cache rejouait l'erreur
// a chaque tentative : une limite de quelques minutes devenait une
// panne de dix.
//
// C'est la meme faute que le proxy d'images la semaine derniere :
// croire le corps sans regarder le statut.
//
// ── Apres ──
//
//   novelbin    complet : 30 chapitres, 9 275 caracteres de texte
//   novelfull   complet : 3 956 chapitres, 18 196 caracteres
//   sushiscan   « Site source indisponible (HTTP 504) » au lieu d'un
//               echec muet — le site est en panne, et ca se lit
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const EXT = path.join(RACINE, 'extensions-community');
const lire = (f) => fs.readFileSync(path.join(EXT, f, 'index.js'), 'utf8').replace(/\r\n/g, '\n');

/** Les extensions qui appellent curl directement. */
function aCurl(f) {
    try { return /execFile\('curl'/.test(lire(f)); } catch (e) { return false; }
}
const TOUTES = fs.readdirSync(EXT).filter((f) => fs.existsSync(path.join(EXT, f, 'index.js')));
const AVEC_CURL = TOUTES.filter(aCurl);

test('les extensions qui utilisent curl sont connues', () => {
    assert.deepEqual(AVEC_CURL.sort(), ['gutenberg', 'gutenberg-fr', 'novelbin', 'novelfull', 'sushiscan'],
        'si cette liste change, le reste de ce fichier doit etre relu');
});

test('aucune ne prend une page d’erreur pour du contenu', () => {
    for (const f of AVEC_CURL) {
        const src = lire(f);
        const avecF = /'-f'|"-f"/.test(src);
        const avecCode = /http_code/.test(src);
        assert.ok(avecF || avecCode,
            f + ' : ni `-f` ni `%{http_code}` — un 429 passerait pour du contenu');
    }
});

test('celles qui lisent le code le lisent correctement', () => {
    for (const f of AVEC_CURL.filter((x) => /http_code/.test(lire(x)))) {
        const src = lire(f);
        assert.match(src, /'-w', CODE_SEP \+ '%\{http_code\}'/, f + ' : le code doit etre demande a curl');
        assert.match(src, /lastIndexOf\(CODE_SEP\)/,
            f + ' : le code se detache par la DERNIERE occurrence — une page peut contenir le motif');
        assert.match(src, /if \(code && code >= 400\)/, f + ' : un statut d’erreur doit refuser');
        assert.match(src, /e\.httpCode = code;/, f + ' : le code doit voyager avec l’erreur');
    }
});

test('le message nomme la panne, au lieu de dire « erreur »', () => {
    for (const f of AVEC_CURL.filter((x) => /messageHttp/.test(lire(x)))) {
        const src = lire(f);
        assert.match(src, /429 \|\| code === 503\) return 'Source momentanement limitee/,
            f + ' : une limite se dit, elle ne se confond pas avec une panne');
        assert.match(src, /403\) return 'Source refusee/, f + ' : un refus se dit');
        assert.match(src, /404\) return 'Page introuvable/, f + ' : un 404 se dit');
    }
});

test('on ne réessaie que ce qui peut changer', () => {
    // Insister sur un 404 ou un 403 ne fait que doubler la charge sur un
    // site qui nous repousse deja. Le site d'une source est tenu par
    // quelqu'un.
    for (const f of AVEC_CURL.filter((x) => /vautLaPeineDeReessayer/.test(lire(x)))) {
        const src = lire(f);
        assert.match(src, /return code === 429 \|\| code === 408 \|\| \(code >= 500 && code <= 599\);/,
            f + ' : seuls le transitoire et les 5xx valent une seconde tentative');
        assert.match(src, /if \(e && e\.httpCode && !e\.transitoire\) break;/,
            f + ' : une erreur definitive doit arreter la boucle');
    }
});

test('rien n’est mis en cache tant que le statut n’est pas bon', () => {
    // C'est ce qui transformait une limite de quelques minutes en panne
    // de dix : la page d'erreur etait cachee comme une reponse valide.
    for (const f of AVEC_CURL.filter((x) => /setC\(/.test(lire(x)))) {
        const src = lire(f);
        const i = src.indexOf('async function fetchHtml');
        assert.notEqual(i, -1, f + ' : fetchHtml doit rester reperable');
        const bloc = src.slice(i, src.indexOf('\n}', i));
        assert.ok(bloc.indexOf('setC(') > bloc.indexOf('await curlGet'),
            f + ' : on ne cache qu’APRES avoir obtenu une reponse acceptee');
        // Le chemin d'erreur SORT, il ne tombe pas sur `setC`. Et quand
        // curl a joint le site et rapporte un statut, on ne refait pas la
        // meme requete par axios : le site repondra la meme chose, et on
        // aurait double la charge sur un hote qui nous repousse deja.
        assert.match(bloc, /if \(e && e\.httpCode\) throw e;/,
            f + ' : un statut rapporte par curl doit remonter tel quel');
    }
});

test('novelbin accepte les DEUX balisages connus du site', () => {
    // Le site a restructure ses listes deux fois en quatre mois. Viser un
    // seul balisage, c'est reparer puis attendre la prochaine refonte ;
    // le repli par les liens de fiche, lui, ne depend d'aucune classe.
    const src = lire('novelbin');
    assert.match(src, /'a\[data-almanac-book-row\]',/, 'balisage de novembre 2026');
    assert.match(src, /'\.list-novel \.row, \.archive \.row',/, 'balisage d’aout 2026');
    assert.match(src, /\$\('a\[href\*="\/novel-bin\/"\]'\)/,
        'et un dernier recours qui ne depend d’aucune classe');
    assert.match(src, /balisage inconnu/,
        'le repli doit le DIRE : une liste approximative qui se tait est un piege');
});
