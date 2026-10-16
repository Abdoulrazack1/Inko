// ============================================================
// test/e2e/contraste.spec.js — le contraste que axe ne juge pas
// ------------------------------------------------------------
// `a11y.spec.js` fait tourner axe-core et bloque sur les violations
// critiques et sérieuses. Il ne suffit pas pour le contraste, et je l'ai
// vérifié plutôt que supposé : deux défauts réels — `.mnav-item.active` à
// 3,79:1 et `.header-avatar` à 3,70:1 — laissaient la suite axe entièrement
// verte, y compris en largeur téléphone où la barre est bien rendue.
//
// axe renonce à trancher dès que le fond est composé (transparences
// empilées, dégradés, color-mix) : il classe alors le cas en « incomplete »,
// qui n'est pas une violation. C'est précisément la situation de cette
// interface, où les fonds sont des `color-mix` et des rgba superposés.
//
// Ce fichier calcule donc le contraste lui-même, en composant les fonds
// comme le fait le rendu. Il ne remplace pas axe — il couvre l'angle mort.
//
// ── Trois faux positifs écartés en l'écrivant ──
//
// La première version rapportait 19 défauts sur l'accueil. Aucun n'était
// réel :
//
//   · `color(srgb 0.9 0.89 0.85)` était lu comme du 0-255, donnant des
//     luminances nulles et des ratios de 1,21 ;
//   · les conteneurs dont le premier enfant est une espace étaient comptés
//     comme porteurs de texte, avec la couleur du parent sur le fond du
//     parent — c'est ainsi qu'un calque d'arrière-plan sans texte propre
//     s'est retrouvé accusé à 1,38 ;
//   · les contrôles réellement `disabled` étaient comptés, alors que WCAG
//     1.4.3 les exempte.
//
// Après correction : 3 défauts, puis 0 une fois les deux règles CSS reprises.
// Un chiffre faux coûte plus cher qu'aucun chiffre.
'use strict';

const { test, expect } = require('@playwright/test');

const EULA_KEY = 'mh_eula_v2';
const TOUR_KEY = 'inko_tour_done';

/** Calcule le contraste de chaque texte réellement rendu. Exécuté DANS la page. */
const SCANNER = function () {
    const lire = (c) => {
        if (!c) return null;
        const m = c.match(/[\d.]+/g);
        if (!m || m.length < 3) return null;
        // `color(srgb r g b / a)` porte des composantes 0-1, `rgb()` du 0-255.
        const k = c.startsWith('color(') ? 255 : 1;
        return [m[0] * k, m[1] * k, m[2] * k, m[3] !== undefined ? +m[3] : 1];
    };
    const lum = (p) => {
        const a = p.slice(0, 3).map(v => {
            v /= 255;
            return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
    };
    // Empile les fonds jusqu'au premier opaque, puis compose du fond vers l'avant.
    const fond = (el) => {
        const pile = [];
        let n = el;
        while (n && n !== document.documentElement) {
            const c = lire(getComputedStyle(n).backgroundColor);
            if (c && c[3] > 0) { pile.push(c); if (c[3] >= 0.999) break; }
            n = n.parentElement;
        }
        let out = (lire(getComputedStyle(document.documentElement).backgroundColor)
            || [255, 255, 255, 1]).slice(0, 3);
        for (let i = pile.length - 1; i >= 0; i--) {
            const [r, g, b, a] = pile[i];
            out = [r * a + out[0] * (1 - a), g * a + out[1] * (1 - a), b * a + out[2] * (1 - a)];
        }
        return out;
    };
    // L'opacité des ancêtres compte : un texte dans un bloc à 0,4 est pâle pour de vrai.
    const opacEff = (el) => {
        let o = 1, n = el;
        while (n && n !== document.documentElement) { o *= +getComputedStyle(n).opacity; n = n.parentElement; }
        return o;
    };

    const mauvais = [];
    document.querySelectorAll('*').forEach(el => {
        // Texte PROPRE : un conteneur sans nœud de texte direct n'affiche rien.
        const propre = [...el.childNodes]
            .filter(n => n.nodeType === 3 && n.textContent.trim())
            .map(n => n.textContent.trim()).join(' ');
        if (!propre) return;
        if (el.disabled) return;                       // WCAG 1.4.3 exempte les contrôles inactifs
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.display === 'none') return;
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        const o = opacEff(el);
        if (o < 0.05) return;                          // invisible en pratique
        const fg = lire(cs.color);
        if (!fg) return;
        const bg = fond(el);
        const a = fg[3] * o;
        const avant = [fg[0] * a + bg[0] * (1 - a), fg[1] * a + bg[1] * (1 - a), fg[2] * a + bg[2] * (1 - a)];
        const l1 = lum(avant), l2 = lum(bg);
        const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
        const px = parseFloat(cs.fontSize), gras = +cs.fontWeight >= 700;
        const seuil = (px >= 24 || (px >= 18.66 && gras)) ? 3 : 4.5;   // WCAG AA, texte large
        if (ratio < seuil) {
            mauvais.push({
                ratio: +ratio.toFixed(2), seuil, px: Math.round(px),
                ou: (el.className || '').toString().slice(0, 30) || el.tagName,
                couleur: cs.color, fond: 'rgb(' + bg.map(Math.round).join(',') + ')',
                texte: propre.slice(0, 30),
            });
        }
    });
    return mauvais.sort((a, b) => a.ratio - b.ratio);
};

async function ouvrir(page, chemin) {
    await page.addInitScript(([e, t]) => {
        try { localStorage.setItem(e, '1'); localStorage.setItem(t, '1'); } catch (err) { /* noop */ }
    }, [EULA_KEY, TOUR_KEY]);
    await page.goto(chemin, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
    // Un élément saisi en plein fondu a une couleur composée avec son fond :
    // même précaution que dans `a11y.spec.js`, et pour la même raison.
    await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important}' });
    await page.waitForTimeout(200);
}

// ── Pourquoi DEUX pages, et pas les dix ──
//
// J'ai essaye d'etendre ce fichier a toutes les pages sans parametre. A
// chaque elargissement, l'instrument a produit des defauts qui n'existaient
// pas, et il a fallu quatre corrections pour s'en apercevoir :
//
//   · sur `/profil.html`, seize textes accuses d'etre a 1,1:1. En realite
//     `.profil-hero-bg` est un calque FRERE en position absolue qui peint un
//     degrade sombre code en dur : une remontee par `parentElement` ne le
//     voit pas, et lit le fond clair du parent ;
//   · en passant a `elementsFromPoint` pour lire la vraie pile de peinture,
//     les elements situes hors de la fenetre ont rendu une pile VIDE — un
//     badge au fond rouge sombre, parfaitement lisible, s'est retrouve
//     accuse a 1,18:1.
//
// Lire fidelement un fond compose demande de gerer le defilement, les
// calques, les degrades et les filtres. Tant que ce n'est pas fait et
// VERIFIE, elargir la portee reviendrait a produire les chiffres fantomes
// que ce depot s'applique a eviter ailleurs.
//
// Ces deux pages sont celles ou l'instrument a ete eprouve dans les deux
// sens : il echoue sur le CSS d'avant en nommant les deux defauts, et passe
// sur celui d'apres.
const PAGES = ['/accueil.html', '/bibliotheque.html'];
const LARGEURS = [
    { nom: 'bureau', taille: null },
    // La barre de navigation mobile vit dans une media query : à la largeur
    // par défaut elle n'est pas rendue, et son contraste ne peut pas être
    // jugé. C'est exactement l'angle mort qui a laissé passer 3,79:1.
    { nom: 'téléphone', taille: { width: 390, height: 844 } },
];

for (const p of PAGES) {
    for (const l of LARGEURS) {
        for (const theme of ['light', 'dark']) {
            test(`contraste AA — ${p} en ${theme}, ${l.nom}`, async ({ page }) => {
                test.setTimeout(120_000);
                if (l.taille) await page.setViewportSize(l.taille);
                await ouvrir(page, p);
                await page.evaluate((t) => window.Theme.apply(t), theme);
                await page.waitForTimeout(500);

                const mauvais = await page.evaluate(SCANNER);
                const SAUT = String.fromCharCode(10);
                const rapport = mauvais
                    .map(m => `  ${m.ratio}:1 (seuil ${m.seuil}) ${m.ou} — « ${m.texte} » ${m.couleur} sur ${m.fond}`)
                    .join(SAUT);
                expect(mauvais, SAUT + rapport).toEqual([]);
            });
        }
    }
}
