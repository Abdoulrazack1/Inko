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

// ── La suite écrit : jamais dans la base de l'utilisateur (audit DAT-04) ──
//
// Elle reprenait tout serveur répondant sur 8088 (`reuseExistingServer`), avec
// LOCAL_MODE=1 : sur un poste de développement, c'était la base `inko` RÉELLE,
// et les favoris qu'elle ajoutait ou retirait étaient ceux de l'utilisateur.
//
// Hors CI : une base `inko_e2e` préparée à la volée, un port à elle (8187), et
// aucun serveur repris. En CI, la base du job est jetable : rien ne change.
const EN_CI = !!process.env.CI;
const BASE_DE_DONNEES = process.env.DB_NAME || (EN_CI ? 'inko' : 'inko_e2e');
if (!EN_CI && !/^inko_e2e/.test(BASE_DE_DONNEES) && process.env.E2E_BASE_REELLE !== '1') {
    throw new Error(`e2e : refus d'écrire dans la base « ${BASE_DE_DONNEES} ». `
        + 'Utilise une base inko_e2e* (défaut), ou E2E_BASE_REELLE=1 en connaissance de cause.');
}
const PORT = process.env.E2E_PORT || (EN_CI ? 8088 : 8187);
// Second port : serveur en mode desktop, CSP active (cf. le bloc webServer).
const PORT_CSP = process.env.E2E_PORT_CSP || 8188;
const BASE = `http://127.0.0.1:${PORT}`;
process.env.E2E_PORT = String(PORT);

module.exports = defineConfig({
    testDir: './test/e2e',
    // Ces tests parlent à une vraie base et à de vraies sources distantes :
    // les faire tourner en parallèle les ferait interférer (mêmes favoris,
    // même compte local).
    workers: 1,
    fullyParallel: false,

    // ── Un essai de rattrapage, en CI seulement ─────────────
    //
    // Deux exécutions distinctes (16 et 17 août) ont échoué sur le MÊME test,
    // avec la même cause — et ce n'est pas une assertion :
    //
    //   Error: browser.newContext: Target page, context or browser has been closed
    //
    // Le navigateur meurt au lancement. Rien dans le produit n'est en cause :
    // c'est le runner qui n'a plus de quoi démarrer un Chromium de plus, après
    // treize contextes et un serveur qui martèle des sources bloquées.
    //
    // Une reprise distingue proprement les deux situations : un test qui passe
    // au second essai est signalé FLAKY, un test qui échoue deux fois reste un
    // échec. Sans elle, une panne d'infrastructure et une vraie régression
    // rendent le même rouge — et on finit par ne plus lire ni l'un ni l'autre.
    //
    // Une seule reprise, et seulement en CI : en local on veut voir l'échec
    // tout de suite, et masquer une instabilité derrière trois essais reviendrait
    // à la laisser grandir.
    retries: process.env.CI ? 1 : 0,
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
    // DEUX serveurs.
    //
    // Le premier est le serveur de développement habituel, sans CSP — c'est
    // dans cette configuration que tourne l'essentiel de la suite.
    //
    // Le second tourne en mode DESKTOP (`APP_VERSION` défini), ce qui active la
    // CSP exactement comme dans l'application installée. Il n'existe que pour
    // `csp.spec.js` : sans lui, une violation de CSP est structurellement
    // invisible aux tests — c'est ainsi que le lecteur a pu se retrouver
    // entièrement blanc dans l'app sans qu'aucun test ne bronche.
    //
    // Pourquoi un second serveur plutôt qu'`APP_VERSION` sur le premier :
    // la variable ne pilote pas que la CSP, elle allume aussi l'interface
    // desktop (bannière de mise à jour). Toute la suite a11y tombait alors sur
    // un défaut de contraste de cette bannière — un vrai défaut, mais qui n'a
    // rien à voir avec les tests qui échouaient.
    webServer: [{
        // la base d'essai est préparée avant que le serveur ne l'ouvre
        command: 'node scripts-ci/preparer-base-e2e.js && node server/server.js',
        url: `${BASE}/api/health`,
        // jamais de serveur repris : on ne sait pas quelle base il sert
        reuseExistingServer: false,
        timeout: 120_000,
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
            DB_NAME: BASE_DE_DONNEES,
        },
    }, {
        command: 'node server/server.js',
        url: `http://127.0.0.1:${PORT_CSP}/api/health`,
        reuseExistingServer: false,
        timeout: 60_000,
        env: {
            PORT: String(PORT_CSP),
            LOCAL_MODE: '1',
            APP_VERSION: 'test-csp',    // → IS_DESKTOP → CSP active
            IMG_RATE_MAX: '5000',
            SEARCH_RATE_MAX: '500',
            DB_NAME: BASE_DE_DONNEES,
        },
    }],
});
