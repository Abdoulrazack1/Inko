#!/usr/bin/env node
'use strict';
// ============================================================
// captures-readme.js — regenere les captures d'ecran du README
// ------------------------------------------------------------
// Les anciennes captures venaient d'un script Puppeteer qui creait un
// compte par une route d'inscription disparue depuis : elles ne
// pouvaient plus etre refaites, donc elles vieillissaient avec
// l'interface. Celui-ci tourne sur Playwright, deja present pour les
// tests, contre une instance reelle.
//
//   node server/server.js                      # dans un terminal
//   node scripts-ci/captures-readme.js         # dans un autre
//
//   INKO_URL=http://localhost:8088             adresse de l'instance
//   CAPTURES=accueil,lecteur                   n'en refaire que certaines
//
// Ce que fait le script pour que le resultat soit LISIBLE et STABLE :
//   · un profil de navigateur neuf (aucune preference heritee) ;
//   · themes et bandeaux fixes AVANT le chargement : ni visite guidee, ni
//     bandeau de consentement, ni invitation a installer ;
//   · `prefers-reduced-motion` : l'application calme ses animations, on ne
//     photographie pas un fondu a mi-course ;
//   · on attend les COUVERTURES, pas seulement le DOM : une carte sans image
//     est un visuel de remplacement, pas ce qu'on veut montrer ;
//   · deux fois la densite de pixels, pour que le texte reste net quand
//     GitHub reduit l'image.
//
// Les donnees affichees sont celles de l'instance ciblee. Relis chaque
// image avant de la publier : une bibliotheque personnelle n'est pas un
// jeu de demonstration.

const path = require('path');
const fs = require('fs');
const { chromium } = require('@playwright/test');

const BASE = (process.env.INKO_URL || 'http://localhost:8088').replace(/\/$/, '');
const OUT = path.join(__dirname, '..', 'assets', 'screenshots');
const VOULUES = (process.env.CAPTURES || '').split(',').map((s) => s.trim()).filter(Boolean);

const SERIE = { id: '01J76XYA1TQYKV6W4BCMR2WD5M', source: 'weebcentral' };   // Wind Breaker
const ROMAN = { manga: '1342', chapter: '1342:full', source: 'gutenberg' };  // Pride and Prejudice

const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** Un contexte propre, avec les preferences posees avant tout script de page. */
async function contexte(browser, { theme = 'light', mobile = false, prefs = {} } = {}) {
    const ctx = await browser.newContext({
        viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
        deviceScaleFactor: mobile ? 3 : 2,
        isMobile: mobile,
        hasTouch: mobile,
        locale: 'fr-FR',
        timezoneId: 'Europe/Paris',
        colorScheme: theme === 'dark' ? 'dark' : 'light',
        reducedMotion: 'reduce',
    });
    await ctx.addInitScript(({ theme: t, prefs: p }) => {
        try {
            const ls = window.localStorage;
            ls.setItem('mh_eula_v2', '1');
            ls.setItem('inko_consent', '1');
            ls.setItem('inko_tour_done', '1');
            ls.setItem('mh_install_dismissed', '1');
            ls.setItem('mh_source', 'weebcentral');
            const actuelles = JSON.parse(ls.getItem('mh_prefs') || '{}');
            ls.setItem('mh_prefs', JSON.stringify({ ...actuelles, theme: t, readingLang: 'fr,en', ...p }));
        } catch (e) { /* stockage refuse : la capture montrera l'etat par defaut */ }
    }, { theme, prefs });
    return ctx;
}

/** Attend que les images visibles aient FINI (chargees, ou en echec : on le dira). */
async function imagesPretes(page, { minimum = 1, delai = 25000 } = {}) {
    await page.waitForFunction(({ minimum: n }) => {
        const vue = (el) => {
            const r = el.getBoundingClientRect();
            return r.width > 30 && r.height > 30 && r.bottom > 0 && r.top < innerHeight;
        };
        const imgs = [...document.images].filter(vue);
        if (imgs.length < n) return false;
        return imgs.every((i) => i.complete && i.naturalWidth > 0);
    }, { minimum }, { timeout: delai }).catch(() => { /* on photographie quand meme, et on le signale */ });
    await pause(600);
}

/** Combien d'images visibles ne se sont pas affichees : un visuel de remplacement compte. */
async function imagesRatees(page) {
    return page.evaluate(() => [...document.images].filter((i) => {
        const r = i.getBoundingClientRect();
        if (r.width < 30 || r.height < 30 || r.bottom < 0 || r.top > innerHeight) return false;
        return !i.complete || i.naturalWidth === 0 || /^data:image\/svg/.test(i.currentSrc || i.src);
    }).length);
}

/**
 * Retire de la PAGE les cartes dont la couverture n'a pas pu s'afficher.
 *
 * Pourquoi, et ce que ca signifie. MangaDex protege depuis novembre 2026 son
 * CDN de couvertures par un defi anti-bot : l'application affiche alors son
 * visuel de remplacement, correctement. Mais trois cartes sur sept en
 * visuel de remplacement ne montrent pas l'application, elles montrent
 * l'etat d'un site tiers a un instant donne.
 *
 * On ne fabrique AUCUNE image : on retire seulement les cartes sans
 * couverture, et la mise en page se recompose avec les autres. C'est une
 * retouche de la page photographiee, pas de ses donnees ; elle est
 * annoncee dans le rapport pour que personne ne la prenne pour l'etat reel.
 */
async function sansCouverturesAbsentes(page, conteneurs) {
    return page.evaluate((sels) => {
        let retirees = 0;
        for (const sel of sels) {
            for (const c of document.querySelectorAll(sel)) {
                const img = c.querySelector('img');
                if (!img) continue;
                // Un ECHEC, pas un chargement differe : une image « lazy » hors ecran
                // n'est pas `complete`, et ne doit surtout pas etre prise pour
                // une couverture absente (premiere version : 47 cartes retirees
                // a tort sur une page qui n'en avait que trois).
                const visuelDeRemplacement = /^data:image\/svg/.test(img.currentSrc || img.src);
                const echec = img.complete && img.naturalWidth === 0 && !!(img.currentSrc || img.src) && img.loading !== 'lazy';
                const raté = visuelDeRemplacement || echec || img.classList.contains('img-echec');
                if (raté) { c.remove(); retirees++; }
            }
        }
        return retirees;
    }, conteneurs);
}

const SCENES = [];
const scene = (nom, f) => SCENES.push({ nom, f });

// ── Bureau, theme clair (Washi) ──────────────────────────────

scene('accueil', async (b) => {
    const ctx = await contexte(b);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/accueil.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('.etagere, .home-continue', { timeout: 20000 });
    await imagesPretes(p, { minimum: 6 });
    const retirees = await sansCouverturesAbsentes(p, ['.etagere .latte', '.shelf .shelf-card', '.shelf-track > *']);
    await pause(500);
    return { ctx, p, retirees };
});

scene('bibliotheque', async (b) => {
    const ctx = await contexte(b);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/bibliotheque.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#libGrid .lib2-card', { timeout: 25000 });
    await imagesPretes(p, { minimum: 12 });
    const retirees = await sansCouverturesAbsentes(p, ['#libGrid .lib2-card']);
    await pause(500);
    return { ctx, p, retirees };
});

scene('catalogue', async (b) => {
    const ctx = await contexte(b);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/catalogue.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('.manga-card', { timeout: 30000 });
    await imagesPretes(p, { minimum: 10 });
    // Survol : l'apercu qui s'ouvre fait partie de ce qu'on veut montrer.
    const carte = p.locator('.manga-card').nth(2);
    await carte.hover();
    await pause(1400);
    return { ctx, p };
});

scene('serie', async (b) => {
    const ctx = await contexte(b);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/serie.html?id=${SERIE.id}&source=${SERIE.source}`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('.chapters-block, #serieMain', { timeout: 30000 });
    await imagesPretes(p, { minimum: 2 });
    return { ctx, p };
});

scene('lecteur', async (b) => {
    const ctx = await contexte(b, { prefs: { readMode: 'page', readingDir: 'rtl' } });
    const p = await ctx.newPage();
    // Un chapitre reel : le plus ancien, c'est celui dont on connait la couverture.
    const rep = await ctx.request.get(`${BASE}/api/sources/${SERIE.source}/mangas/${SERIE.id}/chapters`);
    const liste = (await rep.json()).results || [];
    const chap = liste[liste.length - 1];
    if (!chap) throw new Error('aucun chapitre pour le lecteur');
    await p.goto(`${BASE}/chapitre.html?manga=${SERIE.id}&chapter=${encodeURIComponent(chap.id)}&source=${SERIE.source}`,
        { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('.reader-page-img, #readerPagesArea img', { timeout: 40000 });
    await imagesPretes(p, { minimum: 1, delai: 40000 });
    return { ctx, p };
});

scene('roman', async (b) => {
    const ctx = await contexte(b, { prefs: { novel_theme: 'sepia', novel_font: 'serif', novel_size: 19, novel_mode: 'scroll' } });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/lecture.html?manga=${ROMAN.manga}&chapter=${encodeURIComponent(ROMAN.chapter)}&source=${ROMAN.source}`,
        { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('.novel-content p, #novelContent p', { timeout: 40000 });
    await pause(900);
    return { ctx, p };
});

scene('sources', async (b) => {
    const ctx = await contexte(b);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/sources.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('[data-bac]', { timeout: 20000 });
    await pause(900);
    return { ctx, p };
});

scene('essai-source', async (b) => {
    const ctx = await contexte(b);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/sources.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('[data-bac="weebcentral"]', { timeout: 20000 });
    await p.click('[data-bac="weebcentral"]');
    await p.waitForSelector('.mh-modal-input', { timeout: 8000 });
    await p.fill('.mh-modal-input', 'Wind Breaker');
    await p.click('.mh-modal button:has-text("Valider")');
    await p.waitForFunction(() => /complet|partiel|aucune étape/.test(
        (document.querySelector('.mh-modal-msg') || {}).textContent || ''), null, { timeout: 40000 });
    await pause(500);
    return { ctx, p };
});

scene('statistiques', async (b) => {
    const ctx = await contexte(b);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/stats.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('.st-card', { timeout: 25000 });
    await p.waitForSelector('#stDistrib .st-panel', { timeout: 25000 }).catch(() => {});
    await pause(900);
    return { ctx, p };
});

scene('parametres', async (b) => {
    const ctx = await contexte(b);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/parametres.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#accentSwatches button', { timeout: 20000 });
    await p.locator('#accentSwatches').scrollIntoViewIfNeeded();
    await p.evaluate(() => window.scrollBy(0, -260));
    await pause(700);
    return { ctx, p };
});

scene('musique', async (b) => {
    const ctx = await contexte(b);
    const p = await ctx.newPage();
    await p.goto(`${BASE}/accueil.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('.etagere, .home-continue', { timeout: 20000 });
    await imagesPretes(p, { minimum: 6 });
    await p.evaluate(() => window.MH && MH.openMusic && MH.openMusic());
    await pause(1500);
    const retirees = await sansCouverturesAbsentes(p, ['.etagere .latte', '.shelf .shelf-card', '.shelf-track > *']);
    await pause(500);
    return { ctx, p, retirees };
});

// ── Theme sombre (Sumi) ─────────────────────────────────────

scene('accueil-sombre', async (b) => {
    const ctx = await contexte(b, { theme: 'dark' });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/accueil.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('.etagere, .home-continue', { timeout: 20000 });
    await imagesPretes(p, { minimum: 6 });
    const retirees = await sansCouverturesAbsentes(p, ['.etagere .latte', '.shelf .shelf-card', '.shelf-track > *']);
    await pause(500);
    return { ctx, p, retirees };
});

scene('bibliotheque-sombre', async (b) => {
    const ctx = await contexte(b, { theme: 'dark' });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/bibliotheque.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#libGrid .lib2-card', { timeout: 25000 });
    await imagesPretes(p, { minimum: 12 });
    const retirees = await sansCouverturesAbsentes(p, ['#libGrid .lib2-card']);
    await pause(500);
    return { ctx, p, retirees };
});

// ── Telephone ───────────────────────────────────────────────

scene('mobile-accueil', async (b) => {
    const ctx = await contexte(b, { mobile: true });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/accueil.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('.etagere, .home-continue', { timeout: 20000 });
    await imagesPretes(p, { minimum: 4 });
    const retirees = await sansCouverturesAbsentes(p, ['.etagere .latte', '.shelf .shelf-card', '.shelf-track > *']);
    await pause(500);
    return { ctx, p, retirees };
});

scene('mobile-bibliotheque', async (b) => {
    const ctx = await contexte(b, { mobile: true });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/bibliotheque.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('#libGrid .lib2-card', { timeout: 25000 });
    await imagesPretes(p, { minimum: 6 });
    const retirees = await sansCouverturesAbsentes(p, ['#libGrid .lib2-card']);
    await pause(500);
    return { ctx, p, retirees };
});

scene('mobile-serie', async (b) => {
    const ctx = await contexte(b, { mobile: true });
    const p = await ctx.newPage();
    await p.goto(`${BASE}/serie.html?id=${SERIE.id}&source=${SERIE.source}`, { waitUntil: 'domcontentloaded' });
    await p.waitForSelector('.chapters-block, #serieMain', { timeout: 30000 });
    await imagesPretes(p, { minimum: 1 });
    return { ctx, p };
});

/**
 * Le navigateur que Playwright attend n'est pas toujours celui qui est
 * installe : une montee de version de la bibliotheque change le numero de
 * build attendu, et le telechargement n'a lieu qu'a `npx playwright
 * install`. On essaie donc d'abord le navigateur par defaut, puis les
 * builds deja presents sur la machine — le rendu d'une capture n'a pas
 * besoin de la version exacte.
 */
async function lancerNavigateur() {
    try { return await chromium.launch(); } catch (e) { /* on cherche un autre build */ }
    const racine = path.join(process.env.LOCALAPPDATA || path.join(require('os').homedir(), 'AppData', 'Local'), 'ms-playwright');
    const candidats = [];
    if (fs.existsSync(racine)) {
        for (const d of fs.readdirSync(racine).sort().reverse()) {
            const bases = [
                path.join(racine, d, 'chrome-win64', 'chrome.exe'),
                path.join(racine, d, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'),
                path.join(racine, d, 'chrome-linux', 'chrome'),
                path.join(racine, d, 'chrome-linux64', 'chrome'),
            ];
            for (const c of bases) if (fs.existsSync(c)) candidats.push(c);
        }
    }
    for (const exe of candidats) {
        try { return await chromium.launch({ executablePath: exe }); } catch (e) { /* suivant */ }
    }
    throw new Error('aucun navigateur utilisable : lance `npx playwright install chromium`');
}

(async () => {
    fs.mkdirSync(OUT, { recursive: true });
    const b = await lancerNavigateur();
    const rapport = [];
    for (const s of SCENES) {
        if (VOULUES.length && !VOULUES.includes(s.nom)) continue;
        let ctx;
        try {
            const r = await s.f(b);
            ctx = r.ctx;
            const fichier = path.join(OUT, s.nom + '.jpg');
            // JPEG q92 : ~6 fois plus leger qu'un PNG pour des couvertures, et
            // le texte reste net a cette qualite et a deux fois la densite.
            await r.p.screenshot({ path: fichier, type: 'jpeg', quality: 92, animations: 'disabled', caret: 'initial' });
            const retirees = r.retirees || 0;
            const ratees = await imagesRatees(r.p);
            const ko = Math.round(fs.statSync(fichier).size / 1024);
            rapport.push(`  ✔ ${s.nom.padEnd(22)} ${String(ko).padStart(5)} Ko   ${ratees ? ratees + ' image(s) de remplacement ou en echec' : 'toutes les images affichees'}${retirees ? '   [' + retirees + ' carte(s) sans couverture retiree(s) de la page]' : ''}`);
        } catch (e) {
            rapport.push(`  ✖ ${s.nom.padEnd(22)} ${e.message.split('\n')[0].slice(0, 90)}`);
        } finally {
            if (ctx) await ctx.close();
        }
    }
    await b.close();
    console.log('\n' + rapport.join('\n') + '\n');
})();
