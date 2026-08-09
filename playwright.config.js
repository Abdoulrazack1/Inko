// ============================================================
// playwright.config.js — tests de bout en bout (audit QUAL-03/QUAL-05)
// ------------------------------------------------------------
// L'audit relevait zéro test e2e, et notait que huit bugs livrés (BUG-01, 05,
// 06, 07, 08, 09, 14, 15) auraient été attrapés par n'importe quel parcours
// automatisé. Ces bugs ont un point commun : le code était syntaxiquement
// correct et les tests serveur passaient — c'est le RÉSULTAT À L'ÉCRAN qui
// était faux (mauvais compte affiché, filtre qui ne remonte rien, images
// vides). Seul un vrai navigateur sur la vraie application peut le voir.
//
// Chromium seul : les trois moteurs coûteraient ~350 Mo pour un projet dont
// l'audit relevait déjà un problème de place disque (DISK-01), et l'application
// est distribuée en WebView2 — donc du Chromium.
'use strict';

const { defineConfig, devices } = require('@playwright/test');

const PORT = process.env.E2E_PORT || 8088;
const BASE = `http://127.0.0.1:${PORT}`;

module.exports = defineConfig({
    testDir: './test/e2e',
    // Ces tests parlent à une vraie base et à de vraies sources distantes :
    // les faire tourner en parallèle les ferait interférer (mêmes favoris,
    // même compte local).
    workers: 1,
    fullyParallel: false,
    timeout: 45_000,
    expect: { timeout: 10_000 },
    reporter: process.env.CI ? [['list'], ['github']] : [['list']],
    use: {
        baseURL: BASE,
        // Les traces ne sont gardées qu'en cas d'échec : un e2e rouge sans
        // trace oblige à rejouer à la main pour comprendre.
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: 'node server/server.js',
        url: `${BASE}/api/health`,
        reuseExistingServer: !process.env.CI,
        timeout: 60_000,
        env: {
            PORT: String(PORT),
            LOCAL_MODE: '1',
            // Le limiteur d'images autorise 300 requêtes/min/IP. Une page de
            // bibliothèque en demande ~90 (mesuré) : correct pour un usage
            // normal, mais la suite enchaîne une vingtaine de chargements en
            // moins d'une minute depuis LA MÊME IP et se fait limiter — les
            // tests échouaient alors sur des 429 sans rapport avec leur objet.
            // On relève la borne pour les tests uniquement ; la valeur de
            // production reste celle de security.js.
            IMG_RATE_MAX: '5000',
            SEARCH_RATE_MAX: '500',
            // Permet de rejouer la suite sur une base VIDE, comme en CI :
            //   DB_NAME=inko_e2e_vide npx playwright test
            // C'est ainsi qu'on reproduit localement les echecs qui ne se
            // voyaient qu'en integration continue.
            ...(process.env.DB_NAME ? { DB_NAME: process.env.DB_NAME } : {}),
        },
    },
});
