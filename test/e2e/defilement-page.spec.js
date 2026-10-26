// ============================================================
// test/e2e/defilement-page.spec.js — en défilement, la page annoncée est
// celle qu'on lit
// ------------------------------------------------------------
// Le suivi reposait sur un IntersectionObserver au seuil 0,3 : dès que le
// haut de la planche SUIVANTE atteignait 30 % de visibilité, elle devenait
// la page courante, alors que la précédente occupait encore le milieu de
// l'écran. Mesuré dans ce même montage (20 planches, fenêtre 1100 × 900),
// en relisant la page annoncée 400 ms après chaque arrêt :
//
//     avant    14 à 15 positions sur 55 annoncent la page suivante, durablement
//     après    aucune erreur durable
//
// Ce n'est pas cosmétique : la page annoncée est celle qu'on SAUVEGARDE, et
// la dernière planche déclenche « chapitre lu » — à la page 19 sur 20.
//
// Aucune source distante : chapitre, liste et planches sont simulés. Le
// service worker est bloqué, sinon il récupère les images sans passer par
// les interceptions.
'use strict';

const { test, expect } = require('@playwright/test');

const NB = 20;
const planche = (h) => `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="${h}"><rect width="800" height="${h}" fill="#456"/></svg>`;

test.use({ viewport: { width: 1100, height: 900 }, serviceWorkers: 'block' });

for (const [nom, hauteur, chemin] of [
    ['planches manga, ouverture en défilement', 1140, 'ouverture'],
    ['planches hautes, bascule page → défilement', 4000, 'bascule'],
]) {
    test(`page annoncée = page lue — ${nom}`, async ({ page }) => {
        test.setTimeout(90_000);
        await page.route(/\/api\/.*\/chapters\/[^/]+\/pages/, r => r.fulfill({
            json: { pages: Array.from({ length: NB }, (_, i) => ({ url: `https://planches.invalid/p${i}.svg` })) } }));
        await page.route(/\/api\/.*\/mangas\/[^/]+\/chapters/, r => r.fulfill({
            json: { results: [{ id: 'c1', chapter: '1' }, { id: 'c2', chapter: '2' }] } }));
        await page.route(/\/api\/.*\/mangas\/m-e2e(\?|$)/, r => r.fulfill({
            json: { id: 'm-e2e', title: 'Défilement', cover: '', coverThumb: '', tags: [], status: 'ongoing' } }));
        await page.route(/\/api\/img\?|planches\.invalid/, r => r.fulfill({ body: planche(hauteur), contentType: 'image/svg+xml' }));

        const prefs = chemin === 'ouverture' ? { readMode: 'scroll' } : {};
        await page.addInitScript((p) => {
            try {
                localStorage.setItem('mh_eula_v2', '1');
                localStorage.setItem('inko_tour_done', '1');
                localStorage.setItem('mh_prefs', JSON.stringify(p));
            } catch (e) { /* stockage indisponible */ }
        }, prefs);

        await page.goto('/chapitre.html?manga=m-e2e&chapter=c1&source=weebcentral', { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('.reader-page-img');
        if (chemin === 'bascule') await page.click('[data-mode="scroll"]');
        await expect(page.locator('.reader-scroll-wrapper .reader-page-img')).toHaveCount(NB);
        await page.waitForTimeout(1500);
        // Le défilement doux rendrait chaque arrêt dépendant d'une animation.
        await page.addStyleTag({ content: 'html, * { scroll-behavior: auto !important; }' });

        const fausses = [];
        const H = await page.evaluate(() => document.documentElement.scrollHeight);
        const pas = Math.max(60, Math.round(H / 30));
        for (let y = 0; y < H - 900; y += pas) {
            await page.evaluate(v => window.scrollTo(0, v), y);
            await page.waitForTimeout(400);
            const [annonce, lue] = await page.evaluate(() => {
                const milieu = innerHeight / 2;
                const im = [...document.querySelectorAll('.reader-page-img')].find(i => {
                    const b = i.getBoundingClientRect();
                    return b.top <= milieu && b.bottom >= milieu;
                });
                return [+(document.querySelector('.reader-nav-page strong')?.textContent || 0), im ? +im.dataset.page : null];
            });
            if (lue && annonce !== lue) fausses.push(`y=${y} : annoncée ${annonce}, lue ${lue}`);
        }
        expect(fausses, fausses.join('\n')).toEqual([]);
    });
}
