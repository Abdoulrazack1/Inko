// ============================================================
// server/test/arret-signaux.test.js — fermer proprement, y compris sous Windows
// ------------------------------------------------------------
// `fermer()` existait, et il fait le bon travail : il retire l'annonce mDNS,
// ferme le serveur HTTP, et garde un filet de 2,5 s pour les connexions
// longues (SSE) qui empêcheraient `close` d'aboutir.
//
// Il n'écoutait que SIGINT et SIGTERM. Or :
//
//   · sous Windows, **SIGTERM n'est jamais délivré** — Node le documente ;
//   · SIGINT n'y arrive qu'au Ctrl+C dans une console ;
//   · fermer la fenêtre de console émet SIGHUP, et un Ctrl+Break émet
//     SIGBREAK — ni l'un ni l'autre n'était écouté.
//
// La conséquence est celle que le code décrit déjà pour les plantages :
// l'annonce mDNS reste publiée, et les téléphones sont envoyés vers une
// adresse morte pendant les minutes que dure l'expiration. L'application de
// bureau relance son serveur à chaque ouverture : le cas est fréquent.
//
// ── Ce que ce test ne prouve pas ──
//
// Il vérifie que les quatre signaux sont ENREGISTRÉS, et que la plateforme
// les accepte. Il ne prouve pas qu'ils sont DÉLIVRÉS : depuis un shell
// MSYS sous Windows, `kill -INT` n'atteint pas un processus Node détaché —
// essayé, le serveur a continué de répondre et son journal n'a rien montré.
// La délivrance est l'affaire du système ; ce qui nous regarde, c'est
// d'écouter ce qu'il envoie.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8')
    .replace(/\r\n/g, '\n');

test('les quatre signaux d’arrêt sont écoutés', () => {
    const m = /\[([^\]]*)\]\.forEach\(\(sig\) => \{/.exec(SRC);
    assert.ok(m, 'la liste des signaux doit rester repérable');
    for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK', 'SIGHUP']) {
        assert.match(m[1], new RegExp(`'${sig}'`), `${sig} doit être écouté`);
    }
});

test('un signal refusé par la plateforme ne fait pas tomber le démarrage', () => {
    // `process.on` lève sur un signal que le système ne connaît pas. Sans
    // garde, ajouter SIGBREAK — qui est propre à Windows — ferait échouer le
    // démarrage sur les plateformes qui l'ignorent.
    const bloc = /\[[^\]]*\]\.forEach\(\(sig\) => \{([\s\S]*?)\n    \}\);/.exec(SRC);
    assert.ok(bloc, 'la boucle d’enregistrement doit rester repérable');
    assert.match(bloc[1], /try \{ process\.on\(sig/, 'l’enregistrement doit être gardé');
    assert.match(bloc[1], /catch/, 'et le refus absorbé');
});

test('cette plateforme accepte bien les quatre', () => {
    // Vérification réelle, pas une lecture de source : on les enregistre pour
    // de bon, puis on se retire.
    const acceptes = [];
    for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK', 'SIGHUP']) {
        const noop = () => {};
        try { process.on(sig, noop); acceptes.push(sig); process.removeListener(sig, noop); }
        catch (e) { /* la plateforme refuse ce signal */ }
    }
    assert.ok(acceptes.includes('SIGINT'), 'SIGINT doit être disponible partout');
    // Les autres dépendent du système : on n'exige rien, on constate.
    assert.ok(acceptes.length >= 1);
});

test('la fermeture retire l’annonce AVANT de couper le serveur', () => {
    // L'ordre compte : couper d'abord laisserait l'annonce publiée pendant
    // que le port ne répond plus — exactement l'adresse morte qu'on veut
    // éviter.
    const f = /const fermer = async \(signal, code = 0\) => \{([\s\S]*?)\n    \};/.exec(SRC);
    assert.ok(f, 'fermer() doit rester repérable');
    const iMdns = f[1].indexOf('annonce-mdns');
    const iClose = f[1].indexOf('serveur.close');
    assert.ok(iMdns >= 0 && iClose > iMdns,
        'le retrait de l’annonce doit précéder la fermeture du serveur');
    assert.match(f[1], /setTimeout\(\(\) => process\.exit\(code\), 2500\)/,
        'un filet doit exister pour les connexions longues');
    assert.match(f[1], /if \(enFermeture\) return;/,
        'deux signaux coup sur coup ne doivent pas fermer deux fois');
});
