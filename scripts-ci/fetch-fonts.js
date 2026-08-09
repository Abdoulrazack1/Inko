#!/usr/bin/env node
// ============================================================
// fetch-fonts.js — Auto-hébergement des polices (audit PERF-07)
// ------------------------------------------------------------
// global.css commençait par :
//   @import url('https://fonts.googleapis.com/css2?family=…');
// Trois problèmes cumulés :
//   1. VIE PRIVÉE — chaque page appelait Google, alors que le README annonce
//      « local d'abord », que les pages posent <meta name="referrer"
//      content="no-referrer"> et qu'il existe une page confidentialite.html ;
//   2. HORS-LIGNE — le service worker précache global.css, mais l'@import va
//      chercher la feuille chez Google à l'exécution : en mode hors-ligne, ou
//      sur une machine sans accès Internet, la typographie tombe en repli ;
//   3. PERFORMANCE — un @import en tête de CSS sérialise les requêtes
//      (global.css → css2 → woff2) sur le chemin critique du rendu.
//
// Le dossier assets/font/ EXISTAIT et était VIDE : l'auto-hébergement avait été
// prévu puis jamais terminé. Ce script le termine.
//
//   node scripts-ci/fetch-fonts.js
// ============================================================
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');

const ROOT = path.join(__dirname, '..');
const FONT_DIR = path.join(ROOT, 'assets', 'font');
const OUT_CSS = path.join(ROOT, 'assets', 'css', 'fonts.css');

// User-Agent moderne : sans lui, Google sert du TTF (3× plus lourd) au lieu du woff2.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const FAMILIES = [
    { css: 'Archivo+Narrow:wght@500;600;700', slug: 'archivo-narrow' },
    { css: 'Bitter:wght@400;500;600',         slug: 'bitter' },
    { css: 'IBM+Plex+Sans:wght@400;500;600',  slug: 'ibm-plex-sans' },
];

function get(url, asBuffer = false) {
    return new Promise((resolve, reject) => {
        https.get(url, { headers: { 'User-Agent': UA } }, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return resolve(get(res.headers.location, asBuffer));
            }
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode} sur ${url}`));
            const chunks = [];
            res.on('data', c => chunks.push(c));
            res.on('end', () => resolve(asBuffer ? Buffer.concat(chunks) : Buffer.concat(chunks).toString('utf8')));
        }).on('error', reject);
    });
}

(async () => {
    fs.mkdirSync(FONT_DIR, { recursive: true });
    let css = `/* ============================================================
   fonts.css — Polices auto-hébergées (audit PERF-07)
   ------------------------------------------------------------
   GÉNÉRÉ par scripts-ci/fetch-fonts.js — ne pas éditer à la main.
   Remplace l'@import vers fonts.googleapis.com qui ouvrait global.css :
   appel à Google sur chaque page, typographie perdue hors-ligne, et
   requêtes sérialisées sur le chemin critique du rendu.
   ============================================================ */\n\n`;
    let downloaded = 0, bytes = 0;

    for (const fam of FAMILIES) {
        const sheet = await get(`https://fonts.googleapis.com/css2?family=${fam.css}&display=swap`);
        // Chaque bloc @font-face porte un sous-ensemble (latin, latin-ext…).
        const blocks = sheet.split('@font-face').slice(1);
        for (const b of blocks) {
            const url = (b.match(/url\((https:\/\/[^)]+\.woff2)\)/) || [])[1];
            if (!url) continue;
            const weight = (b.match(/font-weight:\s*(\d+)/) || [, '400'])[1];
            const family = (b.match(/font-family:\s*'([^']+)'/) || [, fam.slug])[1];
            const range = (b.match(/unicode-range:\s*([^;]+);/) || [])[1];
            // Un même poids existe en plusieurs sous-ensembles : on les distingue
            // par un compteur stable tiré de l'URL.
            const tag = url.match(/\/([^/]+)\.woff2$/)[1].slice(-6);
            const name = `${fam.slug}-${weight}-${tag}.woff2`;
            const dest = path.join(FONT_DIR, name);

            if (!fs.existsSync(dest)) {
                const buf = await get(url, true);
                fs.writeFileSync(dest, buf);
                downloaded++; bytes += buf.length;
            }
            css += `@font-face {\n` +
                   `  font-family: '${family}';\n` +
                   `  font-style: normal;\n` +
                   `  font-weight: ${weight};\n` +
                   `  font-display: swap;\n` +
                   `  src: url('../font/${name}') format('woff2');\n` +
                   (range ? `  unicode-range: ${range};\n` : '') +
                   `}\n\n`;
        }
        console.log(`  ${fam.slug} : ${blocks.length} coupe(s)`);
    }

    fs.writeFileSync(OUT_CSS, css);
    console.log(`\n✔ ${downloaded} fichier(s) téléchargé(s) — ${Math.round(bytes / 1024)} Ko`);
    console.log(`✔ ${path.relative(ROOT, OUT_CSS)} généré`);
    console.log('\nPense à retirer l\'@import de global.css et à charger fonts.css avant.');
})().catch(e => { console.error('Échec :', e.message); process.exit(1); });
