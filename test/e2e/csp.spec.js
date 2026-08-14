// ============================================================
// test/e2e/csp.spec.js — la CSP de production ne casse rien
// ------------------------------------------------------------
// Ce test manquait, et son absence a coûté cher.
//
// La CSP n'est active qu'en DESKTOP et en PRODUCTION (`security.js` :
// `CSP_ON = IS_PROD || IS_DESKTOP`). Toute la suite e2e tourne sur le serveur
// de développement, où elle est inactive : une violation de CSP y est donc
// structurellement invisible.
//
// Conséquence réelle, mesurée sur l'app installée 2.5.7 : le lecteur
// téléchargeait ses planches et les laissait à `opacity: 0`, faute de la classe
// `loaded` posée par un attribut `onload=` que `script-src-attr 'none'`
// bloquait. Chapitre entièrement blanc, zones de changement de page mortes —
// et aucun test ne pouvait le voir.
//
// Ce fichier lance donc les pages avec la CSP ACTIVE (variable `APP_VERSION`
// posée sur le serveur, cf. `playwright.config.js`) et échoue à la première
// violation.
'use strict';

const { test, expect } = require('@playwright/test');

// Ce fichier vise le SECOND serveur de `playwright.config.js`, lancé en mode
// desktop (`APP_VERSION`), donc avec la CSP active. Le reste de la suite
// continue de viser le serveur habituel.
test.use({ baseURL: `http://127.0.0.1:${process.env.E2E_PORT_CSP || 8188}` });

const EULA_KEY = 'mh_eula_v2';
const TOUR_KEY = 'inko_tour_done';

// Le collecteur doit être posé AVANT tout script de la page : une violation
// déclenchée au chargement serait sinon manquée.
async function ouvrir(page, chemin) {
    await page.addInitScript(([e, t]) => {
        try { localStorage.setItem(e, '1'); localStorage.setItem(t, '1'); } catch (err) { /* noop */ }
        window.__violations = [];
        document.addEventListener('securitypolicyviolation', (ev) => {
            window.__violations.push({
                directive: ev.violatedDirective,
                bloque: String(ev.blockedURI || '').slice(0, 60),
                fichier: String(ev.sourceFile || '').split('/').pop().slice(0, 40),
                ligne: ev.lineNumber,
            });
        });
    }, [EULA_KEY, TOUR_KEY]);
    await page.goto(chemin, { waitUntil: 'domcontentloaded' });
}

const violations = (page) => page.evaluate(() => window.__violations || []);
const format = (v) => '\n' + v.map(x => `  ${x.directive} ← ${x.bloque} (${x.fichier}:${x.ligne})`).join('\n');

test('la CSP est bien active pendant ce test', async ({ request }) => {
    // Sans ce garde-fou, tout le fichier passerait au vert sur un serveur sans
    // CSP — c'est-à-dire exactement le piège qu'il est censé fermer.
    const r = await request.get('/accueil.html');
    const csp = r.headers()['content-security-policy'];
    expect(csp, 'CSP absente : lance le serveur avec APP_VERSION défini').toBeTruthy();
    expect(csp).toContain('script-src-attr');
});

const PAGES = [
    '/accueil.html', '/catalogue.html', '/bibliotheque.html', '/recherche.html',
    '/parametres.html', '/profil.html', '/notifications.html', '/sources.html',
    '/collections.html', '/stats.html', '/notes.html', '/downloads.html',
    '/liste.html', '/import.html', '/u.html', '/confidentialite.html',
];

for (const p of PAGES) {
    test(`aucune violation de CSP sur ${p}`, async ({ page }) => {
        await ouvrir(page, p);
        await page.waitForTimeout(4000);
        const v = await violations(page);
        expect(v, format(v)).toEqual([]);
    });
}

test('le lecteur affiche ses planches sous CSP active', async ({ page, request }) => {
    test.setTimeout(180_000);
    // Une source qui répond, et un chapitre qui existe : sinon le test mesure
    // l'indisponibilité d'un site tiers, pas la CSP.
    const src = await (await request.get('/api/sources/weebcentral/mangas/popular?limit=1')).json();
    const manga = (src.results || [])[0];
    test.skip(!manga, 'WeebCentral ne répond pas — ce test dépend d’une source distante');
    const ch = await (await request.get(`/api/sources/weebcentral/mangas/${encodeURIComponent(manga.id)}/chapters`)).json();
    const chap = (ch.results || [])[0];
    test.skip(!chap, 'aucun chapitre disponible');

    await ouvrir(page, `/chapitre.html?manga=${encodeURIComponent(manga.id)}`
        + `&chapter=${encodeURIComponent(chap.id)}&source=weebcentral`);
    await page.waitForTimeout(15_000);

    const etat = await page.evaluate(() => {
        const imgs = [...document.querySelectorAll('.reader-page-img')];
        return {
            balises: imgs.length,
            telechargees: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
            visibles: imgs.filter(i => +getComputedStyle(i).opacity > 0.1).length,
        };
    });
    const v = await violations(page);

    expect(v, format(v)).toEqual([]);
    expect(etat.balises, 'aucune planche insérée').toBeGreaterThan(0);
    // Le cœur du test : une planche téléchargée DOIT être visible. C'est
    // exactement ce qui était faux dans l'app installée.
    expect(etat.visibles, `téléchargées ${etat.telechargees}, visibles ${etat.visibles}`)
        .toBe(etat.telechargees);
});
