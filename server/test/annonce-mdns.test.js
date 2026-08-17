// ============================================================
// server/test/annonce-mdns.test.js — VIII.44 point 2, la découverte
// ------------------------------------------------------------
// L'audit fixe une condition avant tout le reste : « Sans le point 1, le point
// 2 est dangereux. » Le point 1 est l'identité du hub ; le point 2, cette
// annonce. Un service `_inko._tcp` découvrable sans moyen de vérifier à qui
// l'on parle, c'est une invitation à récupérer une bibliothèque entière sur un
// Wi-Fi partagé — il suffit d'annoncer le bon nom.
//
// Ce fichier garde les deux propriétés qui font que la découverte est sûre, et
// celle qui fait qu'elle est supportable.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const mdns = require('../lib/annonce-mdns');
const SRC = fs.readFileSync(path.join(__dirname, '..', 'lib', 'annonce-mdns.js'), 'utf8');

test('sans identité, le hub ne s’annonce PAS', async () => {
    // C'est la condition de l'audit, rendue exécutable. Annoncer un service
    // que personne ne peut authentifier vaut moins que ne rien annoncer : la
    // saisie manuelle de l'adresse, elle, se fait devant le PC.
    const publie = await mdns.demarrer(8088, null);
    assert.strictEqual(publie, false);
    assert.strictEqual(mdns.actif(), false);
});

test('l’identité voyage dans l’enregistrement TXT', () => {
    // C'est le champ que le téléphone lit AVANT de faire confiance à une
    // adresse. Sans lui, l'annonce ne transporte qu'un nom et un port —
    // c'est-à-dire tout ce qu'une machine hostile peut copier.
    assert.match(SRC, /txt:\s*\{[\s\S]*?hub:\s*hubId/,
        'le hubId doit être publié dans le TXT de l’annonce');
});

test('le port annoncé est le port réel, pas une constante', () => {
    // Derrière Docker, un reverse proxy, ou avec PORT défini, le port d'écoute
    // diffère de 8088. Annoncer une constante enverrait chaque téléphone du
    // réseau sur une porte fermée — et l'échec ressemblerait à un hub en panne.
    assert.match(SRC, /async function demarrer\(port, hubId\)/);
    assert.match(SRC, /port,/);
    assert.ok(!/port:\s*8088/.test(SRC), 'aucun port codé en dur dans l’annonce');
});

test('une annonce impossible ne fait pas tomber le hub', () => {
    // mDNS est filtré sur beaucoup de réseaux : Wi-Fi invité, isolation de
    // points d'accès, la plupart des réseaux d'entreprise. Un hub qui
    // refuserait de démarrer parce que le multicast est bloqué serait un hub
    // inutilisable au bureau — pour une commodité.
    assert.match(SRC, /catch \(e\) \{[\s\S]*?annonce impossible/,
        'l’échec de publication doit être rattrapé');
    assert.match(SRC, /la saisie manuelle de l’adresse reste disponible/,
        'et le message doit indiquer le chemin qui marche encore');
});

test('l’annonce est retirée à l’arrêt', () => {
    // Un service qui reste publié après la fermeture envoie les téléphones sur
    // une adresse morte, et l'expiration mDNS se compte en minutes — pendant
    // lesquelles l'application paraît cassée alors que le hub est simplement
    // éteint.
    assert.match(SRC, /unpublishAll/);
    const app = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
    assert.match(app, /process\.on\('SIGINT'/);
    assert.match(app, /annonce-mdns'\)\.arreter\(\)/);
});

test('l’annonce se coupe par variable d’environnement', () => {
    // Sur un serveur exposé, ou sur un réseau où l'administrateur ne veut pas
    // de multicast, il faut pouvoir dire non sans modifier le code.
    assert.match(SRC, /INKO_MDNS === '0'/);
});
