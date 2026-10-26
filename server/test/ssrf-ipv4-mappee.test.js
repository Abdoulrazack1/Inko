// ============================================================
// server/test/ssrf-ipv4-mappee.test.js — deux écritures, une seule adresse
// ------------------------------------------------------------
// Contournement signalé par zaderlyl, avec le test qui le démontre (PR #134,
// marqué `todo` pour ne pas rougir la CI avant correction) et par le canal
// privé de SECURITY.md.
//
// LE DÉFAUT. Une IPv4 mappée en IPv6 s'écrit de deux façons :
//
//     ::ffff:127.0.0.1   la forme pointée, celle qu'on tape
//     ::ffff:7f00:1      la forme hexadécimale, celle que `new URL` écrit
//                        APRÈS normalisation
//
// `ipIsPrivate` ne reconnaissait que la première. Or le contrôleur ne voit
// jamais que la seconde :
//
//     new URL('http://[::ffff:169.254.169.254]/')
//         → hostname  [::ffff:a9fe:a9fe]
//
// `a9fe:a9fe`, c'est **169.254.169.254** : les métadonnées cloud. Elle
// passait pour une adresse publique, et le proxy acceptait d'aller la
// chercher depuis le réseau du hub.
//
// Vérifié avant correction en rejouant la fonction telle qu'elle était :
// `::ffff:7f00:1`, `::ffff:a9fe:a9fe` et `::ffff:a00:1` rendaient toutes
// les trois `false`.
//
// PORTÉE RÉELLE. La liste blanche de domaines bloque en amont, donc le
// contournement demandait `IMG_PROXY_OPEN=1`, ou un hôte autorisé dont
// l'enregistrement AAAA pointe vers une telle adresse. Ce n'est pas
// exploitable sur une installation par défaut — ça restait un trou dans la
// défense qui est précisément là pour ce cas.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const net = require('net');
const fs = require('fs');
const path = require('path');

/** Extrait `ipIsPrivate` du contrôleur et l'exécute pour de vrai. */
function charger() {
    const src = fs.readFileSync(
        path.join(__dirname, '..', 'controllers', 'image.controller.js'), 'utf8')
        .replace(/\r\n/g, '\n');
    const i = src.indexOf('function ipIsPrivate(ip)');
    assert.notEqual(i, -1, 'ipIsPrivate doit rester repérable');
    const fin = src.indexOf('\n}', src.indexOf('return true; // format inconnu', i));
    const corps = src.slice(i, fin + 2);
    const f = new Function('net', corps + '\nreturn ipIsPrivate;');
    return f(net);
}

const ipIsPrivate = charger();

// ── Le défaut lui-même ──
const MAPPEES_INTERNES = [
    ['::ffff:7f00:1', '127.0.0.1 — loopback'],
    ['::ffff:a9fe:a9fe', '169.254.169.254 — métadonnées cloud'],
    ['::ffff:a00:1', '10.0.0.1 — réseau privé'],
    ['::ffff:c0a8:101', '192.168.1.1 — réseau privé'],
    ['::ffff:ac10:1', '172.16.0.1 — réseau privé'],
    ['::ffff:6440:1', '100.64.0.1 — CGNAT'],
    ['::ffff:0:1', '0.0.0.1 — this-host'],
];

for (const [ip, quoi] of MAPPEES_INTERNES) {
    test('forme hexadécimale refusée : ' + ip + '  (' + quoi + ')', () => {
        assert.strictEqual(ipIsPrivate(ip), true);
    });
}

test('la forme pointée reste reconnue', () => {
    // Elle l'était déjà : la correction ne doit pas la perdre en route.
    for (const ip of ['::ffff:127.0.0.1', '::ffff:169.254.169.254', '::ffff:10.0.0.1']) {
        assert.strictEqual(ipIsPrivate(ip), true, ip);
    }
});

// ── Ne pas sur-bloquer ──
test('une IPv4 publique mappée reste publique', () => {
    // Le piège inverse : refuser toute adresse mappée couperait le proxy de
    // sources légitimes servies en IPv4 via une pile v6.
    assert.strictEqual(ipIsPrivate('::ffff:5db8:d822'), false, '93.184.216.34');
    assert.strictEqual(ipIsPrivate('::ffff:93.184.216.34'), false);
});

test('une IPv6 publique reste publique', () => {
    assert.strictEqual(ipIsPrivate('2606:4700::1111'), false);
    assert.strictEqual(ipIsPrivate('2001:4860:4860::8888'), false);
});

test('les refus d’origine tiennent toujours', () => {
    for (const ip of ['::1', '::', 'fe80::1', 'fc00::1', 'fd12:3456::1']) {
        assert.strictEqual(ipIsPrivate(ip), true, ip);
    }
    for (const ip of ['127.0.0.1', '10.0.0.5', '192.168.1.1', '169.254.169.254', '224.0.0.1']) {
        assert.strictEqual(ipIsPrivate(ip), true, ip);
    }
    for (const ip of ['93.184.216.34', '172.15.0.1', '172.32.0.1']) {
        assert.strictEqual(ipIsPrivate(ip), false, ip);
    }
});

test('ce qui embarque de l’IPv4 sans être déchiffrable est refusé', () => {
    // NAT64 et formes compressées exotiques : on ne sait pas les lire sans
    // risquer de se tromper, et un proxy de planches n'a aucune raison d'aller
    // chercher une image derrière un NAT64. On refuse, comme pour un format
    // inconnu.
    assert.strictEqual(ipIsPrivate('64:ff9b::7f00:1'), true);
    assert.strictEqual(ipIsPrivate('::7f00:1'), true);
});

test('un format illisible reste refusé par prudence', () => {
    for (const ip of ['pas-une-ip', '', '999.999.999.999']) {
        assert.strictEqual(ipIsPrivate(ip), true, ip);
    }
});

// ── Le chemin complet, tel que l'URL le présente ──
test('c’est bien la forme normalisée par new URL qui arrive au contrôle', () => {
    // La raison pour laquelle le défaut existait : personne ne tape
    // `::ffff:7f00:1`, mais c'est tout ce que le contrôleur reçoit.
    const cas = [
        ['http://[::ffff:127.0.0.1]/a.png', '::ffff:7f00:1'],
        ['http://[::ffff:169.254.169.254]/a.png', '::ffff:a9fe:a9fe'],
        ['http://[::ffff:10.0.0.1]/a.png', '::ffff:a00:1'],
    ];
    for (const [url, attendu] of cas) {
        const hote = new URL(url).hostname.replace(/^\[|\]$/g, '');
        assert.strictEqual(hote, attendu, url);
        assert.strictEqual(ipIsPrivate(hote), true, 'et cette forme doit être refusée');
    }
});
