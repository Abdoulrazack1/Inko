// ============================================================
// test/e2e/focus-clavier.spec.js — savoir où l'on est au clavier
// ------------------------------------------------------------
// Trois feuilles retiraient le contour de focus sans rien donner en retour :
//
//   · `lecture.css` le retirait sur l'état de BASE du champ de recherche du
//     lecteur de romans. Il disparaissait donc aussi au clavier, et la
//     spécificité du sélecteur (0,2,0) l'emportait sur la règle générale
//     `:focus-visible` (0,1,0) de `global.css`. Ce champ n'avait **aucun**
//     indicateur de focus ;
//   · `music.css` et `recherche.css` le retiraient sur `:focus` — qui couvre
//     aussi le clavier — en le remplaçant par une bordure colorée. Une
//     bordure ne se distingue pas d'un survol, et c'est le seul repère dont
//     dispose quelqu'un qui navigue à la tabulation.
//
// Le correctif rend un contour sur `:focus-visible` seulement : il ne se
// déclenche pas sur un clic de souris, donc l'aspect au pointeur ne bouge pas.
//
// Ce test envoie de VRAIES touches. `element.focus()` en JavaScript ne
// déclenche pas `:focus-visible` — Chrome le réserve à une navigation
// clavier réelle — et un test écrit avec `focus()` passerait au vert sans
// rien prouver. Constaté en essayant, avant d'écrire ce fichier.
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

/** Le contour réellement peint sur l'élément actuellement focalisé. */
const CONTOUR = () => {
    const el = document.activeElement;
    if (!el || el === document.body) return { focalise: null };
    const cs = getComputedStyle(el);
    return {
        focalise: (el.className || '').toString().slice(0, 24) || el.tagName,
        focusVisible: el.matches(':focus-visible'),
        style: cs.outlineStyle,
        epaisseur: parseFloat(cs.outlineWidth) || 0,
        // Une ombre ne compte que si elle est VISIBLE. Mesure sur l'ancien
        // CSS : `box-shadow` valait « oklab(0 0 0 / 0) 0px 0px 0px 0px » —
        // entierement transparente et de taille nulle. Compare a la chaine
        // 'none', elle passait pour une marque de focus, et ce test passait
        // au vert devant un champ qui n'en portait aucune.
        ombre: cs.boxShadow !== 'none'
            && !/\/ 0\)/.test(cs.boxShadow)
            && /[1-9]\d*px/.test(cs.boxShadow),
    };
};

test('le champ de recherche montre son focus au clavier', async ({ page }) => {
    test.setTimeout(120_000);
    await ouvrir(page, '/recherche.html');

    // Tabulation jusqu'au champ : de vraies touches, pas un focus() simulé.
    // Soixante et non vingt-cinq : l'en-tete porte plus de controles
    // focalisables que prevu, et une limite trop basse ferait echouer le test
    // sur le COMPTAGE au lieu du focus — un rouge qui ne dit rien du sujet.
    let etat = null, atteint = false;
    for (let i = 0; i < 60; i++) {
        await page.keyboard.press('Tab');
        atteint = await page.evaluate(() => document.activeElement && document.activeElement.id === 'seInput');
        if (atteint) { etat = await page.evaluate(CONTOUR); break; }
    }
    expect(atteint, 'la tabulation doit atteindre le champ de recherche').toBe(true);
    expect(etat.focusVisible, ':focus-visible doit se déclencher à la tabulation').toBe(true);
    expect(etat.style !== 'none' || etat.ombre,
        'un contour ou une ombre doit marquer le champ focalisé').toBe(true);
    expect(etat.epaisseur, 'le contour doit être épais d’au moins 2 px').toBeGreaterThanOrEqual(2);
});

test('aucun élément atteint à la tabulation ne reste sans marque', async ({ page }) => {
    // Le vrai critère (WCAG 2.4.7) ne porte pas sur UN champ mais sur tout ce
    // qu'on peut atteindre : un seul élément muet suffit à perdre quelqu'un
    // qui navigue au clavier.
    test.setTimeout(120_000);
    await ouvrir(page, '/accueil.html');

    const muets = [];
    const vus = new Set();
    for (let i = 0; i < 40; i++) {
        await page.keyboard.press('Tab');
        const e = await page.evaluate(CONTOUR);
        if (!e.focalise) continue;
        const cle = e.focalise + '#' + i;
        if (vus.has(e.focalise)) continue;
        vus.add(e.focalise);
        if (e.focusVisible && e.style === 'none' && !e.ombre) muets.push(cle);
    }
    const SAUT = String.fromCharCode(10);
    expect(muets, SAUT + muets.map(m => '  ' + m + ' : focalisé sans aucune marque').join(SAUT))
        .toEqual([]);
});
