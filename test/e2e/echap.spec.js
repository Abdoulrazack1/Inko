// ============================================================
// test/e2e/echap.spec.js — Échap ferme, partout, sans exception
// ------------------------------------------------------------
// L'application a posé une convention : Échap ferme ce qui est ouvert. Une
// convention ne vaut que si elle n'a pas d'exception — un seul panneau qui
// résiste et l'on cesse d'essayer, donc on ne s'en sert plus nulle part.
//
// Sept gestionnaires existent dans `global.js`, d'autres ailleurs. Ce fichier
// ne les relit pas : il ouvre chaque panneau et appuie sur la touche. C'est
// la seule façon de savoir, parce que ce qui casse la convention n'est pas
// l'absence de gestionnaire mais le fait qu'un autre l'intercepte avant.
'use strict';

const { test, expect } = require('@playwright/test');

const EULA_KEY = 'mh_eula_v2';
const TOUR_KEY = 'inko_tour_done';

async function ouvrir(page, chemin) {
    await page.addInitScript(([e, t]) => {
        try { localStorage.setItem(e, '1'); localStorage.setItem(t, '1'); } catch (err) { /* noop */ }
    }, [EULA_KEY, TOUR_KEY]);
    await page.goto(chemin, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
}

/**
 * Chaque panneau : comment l'ouvrir, et à quoi on reconnaît qu'il est là.
 * Ouvrir par l'API publique plutôt que par un clic : le but est d'éprouver
 * la FERMETURE, pas de retrouver un bouton.
 */
const PANNEAUX = [
    {
        nom: 'palette de commandes',
        ouvrir: (page) => page.evaluate(() => window.MH.openCommandPalette()),
        present: '[role="dialog"], .cmdk, [id*="cmd" i]',
    },
    {
        nom: 'aide des raccourcis',
        ouvrir: (page) => page.keyboard.press('?'),
        present: '#mhShortcuts',
    },
    {
        // La cloche porte deja `aria-expanded` : on verifie aussi qu'il
        // retombe a « false » a la fermeture. Un etat qui ne se defait pas
        // ment au lecteur d'ecran des la seconde ouverture.
        nom: 'liste des notifications',
        ouvrir: (page) => page.locator('#btnNotif').click(),
        present: '#notifDropdown',
        etatAttendu: { sur: '#btnNotif', attribut: 'aria-expanded', apres: 'false' },
    },
    {
        nom: 'boîte de confirmation',
        ouvrir: (page) => page.evaluate(() => { window.MH.confirm('Fermer ceci ?'); }),
        present: '.mh-modal, [class*="modal" i]',
    },
];

for (const p of PANNEAUX) {
    test(`Échap ferme la ${p.nom}`, async ({ page }) => {
        test.setTimeout(120_000);
        await ouvrir(page, '/accueil.html');

        await p.ouvrir(page);
        await page.waitForTimeout(600);
        const avant = await page.locator(p.present).count();
        expect(avant, `le panneau « ${p.nom} » doit s'ouvrir, sinon ce test ne mesure rien`)
            .toBeGreaterThan(0);

        await page.keyboard.press('Escape');
        await page.waitForTimeout(600);

        // Fermé veut dire : retiré du DOM, ou rendu invisible. Les deux sont
        // des fermetures légitimes ; n'accepter que le retrait ferait échouer
        // un panneau simplement masqué.
        const reste = await page.evaluate((sel) => {
            return [...document.querySelectorAll(sel)].filter(el => {
                const cs = getComputedStyle(el);
                return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05;
            }).length;
        }, p.present);
        expect(reste, `« ${p.nom} » doit disparaître sur Échap`).toBe(0);

        if (p.etatAttendu) {
            const valeur = await page.locator(p.etatAttendu.sur).getAttribute(p.etatAttendu.attribut);
            expect(valeur, `${p.etatAttendu.attribut} doit retomber après la fermeture`)
                .toBe(p.etatAttendu.apres);
        }
    });
}
