#!/usr/bin/env node
// ============================================================
// gen-precache.js — Génère la liste STATIC_ASSETS du service worker
// ------------------------------------------------------------
// Audit BUG-11 : la liste était maintenue à la main et avait dérivé —
// 10 JS, 4 CSS et 1 HTML réellement utilisés n'y figuraient pas. Le cas le
// plus visible : bibliotheque.html était précaché mais NI bibliotheque.js NI
// bibliotheque.css, donc la page s'ouvrait hors-ligne en coquille vide.
//
// On lit les <script src> et <link rel=stylesheet> de chaque page pour
// construire la liste réelle. Plus de dérive possible.
//
//   node scripts-ci/gen-precache.js           → réécrit service-worker.js
//   node scripts-ci/gen-precache.js --check   → échoue si la liste a dérivé (CI)
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const SW = path.join(ROOT, 'service-worker.js');
const CHECK = process.argv.includes('--check');

// Toujours précachés, même s'ils ne sont référencés par aucune page.
// Deux catégories : les ressources hors HTML (manifeste, icônes, i18n) et les
// fichiers INJECTÉS À L'EXÉCUTION par le JS — invisibles pour un scan du HTML,
// et c'est précisément pour ça qu'ils manquaient à la liste manuelle.
const ALWAYS = [
    '/',
    '/manifest.webmanifest',
    // Audit BUG-19 : fr.json a été supprimé — i18n.js ne le chargeait JAMAIS
    // (loadI18n ne fetch que si lang !== 'fr', le français étant la langue
    // source du HTML), et il utilisait un schéma incompatible avec en.json
    // (0 clé en commun). Il était livré et précaché pour rien.
    '/assets/i18n/en.json',
    '/assets/img/icon.svg',
    '/assets/img/icon-192.png',
    '/assets/img/icon-512.png',
    '/assets/js/onboarding.js',   // chargé dynamiquement par global.js
    '/assets/css/music.css',      // injecté par music.js (injectCSS)
];

// Libs vendor lourdes chargées à la demande : on ne les précache pas toutes.
// pdf.worker (1 Mo) et three (607 Ko) restent hors précache — ils ne servent
// qu'à une page et gonfleraient l'installation du service worker.
const VENDOR_SKIP = new Set(['/assets/vendor/pdf.worker.min.js', '/assets/vendor/three.min.js']);

const pages = fs.readdirSync(ROOT).filter(f => f.endsWith('.html')).sort();

const assets = new Set(ALWAYS);
for (const page of pages) {
    assets.add('/' + page);
    const html = fs.readFileSync(path.join(ROOT, page), 'utf8');
    const refs = [
        ...html.matchAll(/<script[^>]+src="([^"]+)"/g),
        ...html.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+)"/g),
    ].map(m => m[1]);
    for (let r of refs) {
        if (/^https?:/i.test(r)) continue;             // CDN : jamais précaché
        r = '/' + r.replace(/^\.?\//, '');
        if (VENDOR_SKIP.has(r)) continue;
        if (!fs.existsSync(path.join(ROOT, r.slice(1)))) {
            console.warn(`  ⚠ référencé mais absent du disque : ${r} (dans ${page})`);
            continue;
        }
        assets.add(r);
    }
}

const sorted = [...assets].sort();
const block = 'const STATIC_ASSETS = [\n' +
    sorted.map(a => `    '${a}',`).join('\n') +
    '\n];';

const sw = fs.readFileSync(SW, 'utf8');
const re = /const STATIC_ASSETS = \[[\s\S]*?\n\];/;
if (!re.test(sw)) {
    console.error('STATIC_ASSETS introuvable dans service-worker.js');
    process.exit(1);
}
const next = sw.replace(re, block);

if (CHECK) {
    if (next !== sw) {
        console.error('::error::La liste de précache du service worker a dérivé.');
        console.error("Lance 'npm run gen-precache' et committe le résultat.");
        process.exit(1);
    }
    console.log(`Précache à jour — ${sorted.length} entrées.`);
} else {
    fs.writeFileSync(SW, next);
    console.log(`✔ service-worker.js : ${sorted.length} entrées de précache`);
}
