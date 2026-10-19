// ============================================================
// server/test/memoire-scan.test.js — un scan terminé ne doit pas rester
// ------------------------------------------------------------
// `jobs` était une Map jamais purgée. Chaque scan terminé y gardait son
// résultat **complet** — la liste des mises à jour et celle des échecs pour
// les 495 séries de la bibliothèque, titres et couvertures compris — et l'y
// gardait pour toute la durée de vie du processus.
//
// Sur un hub à un seul compte : une entrée qui ne se libère jamais. Sur un
// hub partagé : une par compte ayant lancé un scan, et rien ne les enlève.
//
// ── L'invariant qui compte plus que la purge elle-même ──
//
// On ne retire JAMAIS un job en cours. Le client interroge l'avancement
// jusqu'à ce que l'état change ; si le job disparaissait entre deux appels,
// `scanUpdates` verrait `null`, sortirait de sa boucle et rendrait un
// résultat VIDE — un scan qui a bien tourné, présenté comme n'ayant rien
// trouvé. Perdre de la mémoire est moins grave que mentir sur un résultat.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'lib', 'updates.js'), 'utf8')
    .replace(/\r\n/g, '\n');

const purge = () => {
    const m = /function purgerJobs\(\) \{([\s\S]*?)\n\}/.exec(SRC);
    assert.ok(m, 'purgerJobs doit rester repérable');
    return m[1];
};

test('un scan EN COURS n’est jamais retiré', () => {
    // L'invariant central. Sans lui, la purge transforme un scan reussi en
    // resultat vide.
    assert.match(purge(), /if \(j\.etat === 'en_cours'\) continue;/,
        'la boucle de purge doit sauter les scans vivants');

    // Et le filet de capacité doit obéir à la même règle : il ne trie que
    // les terminés.
    assert.match(purge(), /\.filter\(\(\[, j\]\) => j\.etat !== 'en_cours'\)/,
        'le filet de capacité ne doit considérer que les scans terminés');
});

test('un scan terminé expire, et le plus ancien part en premier', () => {
    assert.match(SRC, /const RETENTION_JOB_MS = 10 \* 60 \* 1000;/,
        'une durée de rétention doit être nommée');
    assert.match(purge(), /maintenant - \(j\.finishedAt \|\| 0\) > RETENTION_JOB_MS/,
        'l’expiration se mesure depuis la fin du scan');
    assert.match(purge(), /\.sort\(\(a, b\) => \(a\[1\]\.finishedAt \|\| 0\) - \(b\[1\]\.finishedAt \|\| 0\)\)/,
        'le filet doit retirer les plus anciens d’abord');
});

test('la purge tourne aux DEUX points d’entrée', () => {
    // Au lancement seul, sur un hub a un compte, le scan suivant peut
    // n'arriver que des jours plus tard : le resultat precedent occuperait la
    // memoire jusque-la.
    assert.match(SRC, /function lancerScan\(uid, opts = \{\}\) \{\n    purgerJobs\(\);/,
        'le lancement doit purger');
    assert.match(SRC, /function etatScan\(uid\) \{ purgerJobs\(\);/,
        'la consultation aussi');
});

test('aucun minuteur n’est posé pour cela', () => {
    // Un `setInterval` retiendrait le processus s'il n'est pas `unref`, et
    // c'est le genre de detail qu'on oublie. Deux points d'appel suffisent.
    const bloc = SRC.slice(SRC.indexOf('const jobs = new Map()'));
    assert.ok(!/setInterval/.test(bloc),
        'la purge ne doit pas reposer sur un minuteur');
});
