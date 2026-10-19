// ============================================================
// server/test/reprendre-scan.test.js — un scan coupé ne repart pas de zéro
// ------------------------------------------------------------
// Un scan de mises à jour parcourt toute la bibliothèque — 496 séries sur le
// compte de référence — et parle à des sources lentes. S'il est coupé
// (fermeture de l'app, redémarrage, coupure réseau), tout était à refaire :
// `jobs`, `lastFullScan` et `derniersScans` vivent en mémoire et disparaissent
// avec le processus.
//
// Ce qui survit, lui, c'est `favorites.checked_at` : chaque série examinée le
// pose, depuis la migration 22. Il manquait seulement de savoir QUAND le scan
// interrompu avait commencé pour reconnaître ce qu'il avait déjà fait.
//
// D'où un marqueur : une date de départ écrite dans `app_settings` au
// lancement, effacée à l'arrivée. S'il est encore là au scan suivant, le
// précédent n'a pas fini — on reprend. Pas de fenêtre glissante arbitraire :
// la règle est exacte, « déjà examiné PENDANT le scan interrompu ».
//
// Vérifié contre la vraie base (sans lancer de scan : ce serait un demi-millier
// de requêtes vers des sources déjà en 403) :
//
//     marqueur écrit puis relu              ok
//     marqueur de 7 h tenu pour périmé      ok
//     marqueur effacé                       ok
//     règle appliquée aux vraies lignes     partition cohérente
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'lib', 'updates.js'), 'utf8')
    .replace(/\r\n/g, '\n');

// ── La règle de reprise, exécutée ──
/** Le filtre tel qu'il est écrit dans la source, extrait et joué. */
function filtre() {
    const m = /targets = targets\.filter\((f => !\(f\.checked_at && new Date\(f\.checked_at\)\.getTime\(\) >= depuis\))\);/
        .exec(SRC);
    assert.ok(m, 'le filtre de reprise doit rester repérable');
    const fn = new Function('depuis', 'return ' + m[1] + ';');
    return (cibles, depuis) => cibles.filter(fn(depuis));
}

const T = Date.parse('2026-10-19T19:00:00Z');
const serie = (nom, checked) => ({ manga_id: nom, checked_at: checked ? new Date(checked) : null });

test('ce qui a été examiné pendant le scan coupé est sauté', () => {
    const restantes = filtre()([
        serie('a', T + 60000),       // examinée après le départ : déjà faite
        serie('b', T + 120000),
        serie('c', T - 86400000),    // examinée hier : à refaire
        serie('d', null),            // jamais examinée
    ], T);
    assert.deepEqual(restantes.map(s => s.manga_id), ['c', 'd']);
});

test('une série examinée À la seconde du départ compte comme faite', () => {
    // `>=` et non `>` : la première série examinée porte souvent exactement
    // l'horodatage du départ, à la seconde près — MySQL stocke `checked_at` en
    // DATETIME, sans millisecondes.
    assert.deepEqual(filtre()([serie('a', T)], T), []);
});

test('sans marqueur, rien n’est sauté', () => {
    // `depuis` est null quand aucun scan n'a été interrompu : la comparaison
    // doit alors laisser passer tout le monde.
    const toutes = filtre()([serie('a', T + 1000), serie('b', T)], null);
    assert.equal(toutes.length, 0,
        'avec depuis = null, `>= null` vaut `>= 0` : le code ne doit JAMAIS appeler le filtre dans ce cas');
    // C'est pourquoi l'appel est gardé en amont :
    assert.match(SRC, /if \(depuis\) \{/,
        'le filtre ne doit tourner que s’il y a un marqueur');
});

// ── Le cycle de vie du marqueur ──
test('le marqueur est écrit au départ et effacé à l’arrivée', () => {
    assert.match(SRC, /await marquerDebutScan\(uid, debutDeCeScan\);/,
        'écrit avant d’examiner la première série');
    const sorties = SRC.match(/await effacerDebutScan\(uid\);/g) || [];
    assert.equal(sorties.length, 2,
        'les DEUX sorties normales l’effacent : bibliothèque vide, et fin de scan');
});

test('un scan qui lève garde son marqueur', () => {
    // Sans ça, la reprise ne servirait à rien : c'est justement le scan qui
    // casse qu'il faut pouvoir reprendre. Donc pas de `finally` qui efface.
    //
    // Seul, ce test passerait aussi sur un code SANS marqueur du tout : on
    // exige donc d'abord qu'il existe.
    assert.match(SRC, /async function effacerDebutScan\(uid\)/,
        'le marqueur doit exister avant qu’on parle de ne pas l’effacer');
    assert.ok(!/finally[\s\S]{0,80}effacerDebutScan/.test(SRC),
        'effacer le marqueur dans un `finally` annulerait toute la reprise');
});

test('un marqueur trop vieux ne sert plus', () => {
    assert.match(SRC, /const REPRISE_MAX_MS = 6 \* 60 \* 60 \* 1000;/);
    assert.match(SRC, /if \(Date\.now\(\) - t > REPRISE_MAX_MS\) return null;/,
        'une série examinée il y a huit heures mérite d’être revue');
});

test('le marqueur ne fait jamais échouer un scan', () => {
    // `app_settings` peut manquer sur une base ancienne. La reprise est un
    // confort ; la refuser doit coûter un scan complet, pas une erreur.
    const helpers = /async function marquerDebutScan[\s\S]*?async function debutScanInterrompu\(uid\) \{[\s\S]*?\n\}/
        .exec(SRC);
    assert.ok(helpers, 'les trois aides doivent rester repérables');
    const catches = helpers[0].match(/catch \(e\)/g) || [];
    assert.ok(catches.length >= 3, 'chacune doit encaisser son échec, vu ' + catches.length);
});

// ── Ce que la reprise ne doit PAS couper ──
test('viser une seule série ne reprend pas', () => {
    assert.match(SRC, /const depuis = mangaId \? null : await debutScanInterrompu\(uid\);/,
        'demander une série précise, c’est demander à la revoir');
});

test('`force` ne coupe pas la reprise, et c’est écrit', () => {
    // `force` veut dire « ne te sers pas du cache de chapitres », pas
    // « refais ce que tu viens de faire ». Et c'est le bouton de
    // rafraîchissement — celui qui force — qu'on reclique après une coupure.
    assert.ok(!/depuis = \(force/.test(SRC),
        'force ne doit pas entrer dans la décision de reprendre');
    assert.match(SRC, /`force` NON PLUS n'annule la reprise/,
        'la raison doit être écrite à côté : elle n’est pas évidente');
});

test('le compte des reprises remonte jusqu’au résultat', () => {
    // « 412 vérifiées » après une interruption, sans dire pourquoi c'est allé
    // si vite, ressemble à un scan bâclé.
    assert.match(SRC, /return \{ updates, failures, scanned: targets\.length, skipped, repris \};/);
    const lib = fs.readFileSync(
        path.join(__dirname, '..', '..', 'assets', 'js', 'bibliotheque.js'), 'utf8');
    assert.match(lib, /data\.repris \? ` · \$\{data\.repris\} reprise\(s\) du scan interrompu`/,
        'et la bibliothèque doit le dire');
});
