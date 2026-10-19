// ============================================================
// test/e2e/cibles-tactiles.spec.js — viser au doigt
// ------------------------------------------------------------
// WCAG 2.2 pose un plancher de 24 × 24 px pour une cible (critère 2.5.8,
// niveau AA), sauf espacement suffisant ou texte en ligne.
//
// Relevé sur l'accueil en 375 px, avant correction : 10 des 60 contrôles
// interactifs étaient sous ce plancher. Le plus net : les pastilles de la
// visite guidée, **22 × 7 px** — sept pixels de haut, à viser au pouce.
//
// Ce fichier mesure de la géométrie, pas des couleurs. C'est délibéré :
// `getBoundingClientRect` ne dépend ni de la pile de peinture, ni du
// défilement, ni des dégradés — les quatre sources de faux positifs qui ont
// fait renoncer à élargir `contraste.spec.js`. Un rectangle est un rectangle.
'use strict';

const { test, expect } = require('@playwright/test');

const EULA_KEY = 'mh_eula_v2';
const TOUR_KEY = 'inko_tour_done';

test('les pastilles de la visite guidée se visent au doigt', async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 375, height: 812 });
    // L'EULA est acceptée mais PAS la visite : c'est elle qu'on vient mesurer.
    await page.addInitScript((e) => {
        try { localStorage.setItem(e, '1'); localStorage.removeItem('inko_tour_done'); } catch (err) { /* noop */ }
    }, EULA_KEY);
    await page.goto('/accueil.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const pastilles = page.locator('.itr-dot');
    const n = await pastilles.count();
    expect(n, 'la visite guidée doit être affichée, sinon ce test ne mesure rien').toBeGreaterThan(1);

    const boites = [];
    for (let i = 0; i < n; i++) boites.push(await pastilles.nth(i).boundingBox());

    // 1. Le plancher WCAG 2.2 AA.
    for (const [i, b] of boites.entries()) {
        expect(Math.round(b.width), `pastille ${i + 1} : largeur`).toBeGreaterThanOrEqual(24);
        expect(Math.round(b.height), `pastille ${i + 1} : hauteur`).toBeGreaterThanOrEqual(24);
    }

    // 2. Et surtout : les zones ne doivent pas se CHEVAUCHER. Agrandir des
    //    cibles voisines sans les espacer ferait activer la troisième en
    //    visant la deuxième — une cible qui se trompe de destination est pire
    //    qu'une cible trop petite.
    for (let i = 1; i < boites.length; i++) {
        expect(Math.round(boites[i].x),
            `la pastille ${i + 1} ne doit pas mordre sur la ${i}`)
            .toBeGreaterThanOrEqual(Math.round(boites[i - 1].x + boites[i - 1].width));
    }

    // 3. Le visuel n'a pas changé : seule la cible a grandi.
    const peint = await pastilles.first().evaluate(el => ({
        clip: getComputedStyle(el).backgroundClip,
        hauteurPeinte: getComputedStyle(el).height,
    }));
    expect(peint.clip, 'le fond doit rester borné à la boîte de contenu').toBe('content-box');
    expect(peint.hauteurPeinte, 'la pastille reste visuellement de 7 px').toBe('7px');

    // 4. Cliquer la dernière mène bien à la dernière étape.
    await pastilles.nth(n - 1).click();
    await page.waitForTimeout(300);
    const active = await page.locator('.itr-dot.on').getAttribute('data-i');
    expect(active, 'le clic doit activer la pastille visée').toBe(String(n - 1));
});

test('recensement des cibles sous le plancher WCAG 2.2', async ({ page }) => {
    // Non bloquant : donne l'état réel sans transformer chaque lien en ligne
    // — que le critère exempte — en échec de CI.
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 375, height: 812 });
    await page.addInitScript(([e, t]) => {
        try { localStorage.setItem(e, '1'); localStorage.setItem(t, '1'); } catch (err) { /* noop */ }
    }, [EULA_KEY, TOUR_KEY]);
    await page.goto('/accueil.html', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

    const petites = await page.evaluate(() => {
        const SEL = 'a[href], button, input:not([type=hidden]), select, textarea, [role="button"]';
        return [...document.querySelectorAll(SEL)].filter(el => {
            const cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') return false;
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.height > 0 && (r.width < 24 || r.height < 24);
        }).map(el => {
            const r = el.getBoundingClientRect();
            return `${(el.className || '').toString().split(' ')[0] || el.tagName}`
                + ` ${Math.round(r.width)}×${Math.round(r.height)}`;
        });
    });
    console.log('Cibles sous 24×24 sur /accueil.html en 375 px :\n  '
        + (petites.join('\n  ') || 'aucune'));
});
