// ============================================================
// test/e2e/a11y.spec.js — accessibilité automatisée (audit QUAL-05)
// ------------------------------------------------------------
// L'audit relevait « aucun contrôle a11y automatisé ». Les corrections A11Y-06
// à A11Y-08 (région d'annonce, état des boutons favori, lien d'évitement) ont
// été validées à la main pendant l'audit — c'est-à-dire une fois, et jamais
// depuis. axe-core est injecté dans la page réelle, après chargement des
// données : les défauts d'accessibilité naissent presque toujours du contenu
// rendu dynamiquement, pas du HTML statique.
//
// Portée assumée : axe détecte de l'ordre de 30 à 50 % des problèmes réels. Ce
// fichier n'affirme donc pas « l'application est accessible » — il affirme
// « les défauts mécaniquement détectables ne réapparaissent pas ». Le reste
// (ordre de tabulation, pertinence des libellés, lecture au lecteur d'écran)
// demande toujours une vérification humaine.
'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8');

const EULA_KEY = 'mh_eula_v2';
const TOUR_KEY = 'inko_tour_done';

async function ouvrir(page, chemin) {
    await page.addInitScript(([e, t]) => {
        try { localStorage.setItem(e, '1'); localStorage.setItem(t, '1'); } catch (err) { /* noop */ }
    }, [EULA_KEY, TOUR_KEY]);
    await page.goto(chemin, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body').first()).toBeVisible();
    // Les données arrivent après le premier rendu : analyser trop tôt ne
    // mesurerait que la coquille statique, là où sont justement les rares
    // défauts déjà corrigés.
    await page.waitForTimeout(3500);
}

async function analyser(page, opts = {}) {
    // Les transitions CSS faussent la mesure de contraste : un élément saisi
    // en plein fondu a une couleur composée avec son fond, et axe la juge
    // insuffisante. C'est ainsi que le recensement a rapporté 25 violations
    // que le même parcours, rejoué, ne retrouvait pas — un chiffre fantôme est
    // pire qu'aucun chiffre. On fige donc l'animation avant d'analyser.
    await page.addStyleTag({ content: `*, *::before, *::after {
        transition: none !important; animation: none !important;
    }` });
    await page.waitForTimeout(250);
    await page.addScriptTag({ content: AXE });
    await page.evaluate((aaa) => { window.__aaa = aaa; }, !!opts.aaa);
    return page.evaluate(async () => {
        const res = await window.axe.run(document, {
            // WCAG 2.1 niveau AA : la cible que l'audit a retenue.
            // Le theme « contraste » vise AAA : on ajoute alors la regle
            // color-contrast-enhanced (7:1), sinon on ne verifierait de lui
            // que ce qu'on verifie deja partout ailleurs.
            runOnly: window.__aaa
                ? { type: 'rule', values: ['color-contrast-enhanced'] }
                : { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
        });
        return res.violations.map(v => ({
            id: v.id,
            impact: v.impact,
            aide: v.help,
            nb: v.nodes.length,
            exemples: v.nodes.slice(0, 3).map(n => n.html.slice(0, 120)),
        }));
    });
}

// Audit AMEL-83 : le theme « contraste » promet AAA (7:1). Une promesse de
// contraste qui n'est pas mesuree derive au premier composant ajoute — c'est
// exactement ce qui est arrive au theme clair (A11Y-02, 58 echecs).
test('le theme contraste tient le niveau AAA (AMEL-83)', async ({ page }) => {
    // Même raison que le recensement plus bas : axe analyse les 1 517 contrôles
    // de `parametres.html`, ce qui prend ~100 s à vide et davantage sur une
    // machine chargée. À 180 s le test échouait par dépassement, pas par
    // violation — un faux négatif qui ferait chercher une régression de
    // contraste là où il n'y en a pas.
    test.setTimeout(300_000);
    await ouvrir(page, '/parametres.html');
    await page.evaluate(() => window.Theme.apply('contrast'));
    await page.waitForTimeout(600);
    const attribut = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    expect(attribut).toBe('contrast');

    const violations = await analyser(page, { aaa: true });
    const NL = String.fromCharCode(10);
    const rapport = violations
        .map(v => `  ${v.id} (${v.nb}) — ${v.aide}` + NL + '    ' + v.exemples.join(NL + '    '))
        .join(NL);
    expect(violations, NL + rapport).toEqual([]);
});

const PAGES = [
    '/accueil.html',
    '/bibliotheque.html',
    '/catalogue.html',
    '/profil.html',
    '/notifications.html',
    '/parametres.html',
    '/sources.html',
];

for (const p of PAGES) {
    test(`aucune violation critique ou sérieuse sur ${p}`, async ({ page }) => {
        // axe parcourt TOUT l'arbre : sur `parametres.html`, qui expose 1 517
        // occurrences de contrôles, l'analyse demande à elle seule ~80 s. Le
        // délai commun de 45 s la faisait échouer sur un dépassement, pas sur
        // une violation — un rouge qui ne dit rien du sujet du test.
        test.setTimeout(180_000);
        await ouvrir(page, p);
        const violations = await analyser(page);
        // On bloque sur `critical` et `serious` : ce sont les défauts qui
        // empêchent réellement d'utiliser la page (contraste illisible, image
        // sans alternative, contrôle sans nom accessible). `moderate` et
        // `minor` sont rapportés par le test de recensement plus bas, sans
        // faire échouer — un seuil qu'on ne peut pas atteindre est un seuil
        // qu'on finit par désactiver.
        const bloquantes = violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
        const rapport = bloquantes
            .map(v => `  ${v.impact.toUpperCase()} ${v.id} (${v.nb}) — ${v.aide}\n    ${v.exemples.join('\n    ')}`)
            .join('\n');
        expect(bloquantes, `\n${rapport}`).toEqual([]);
    });
}

// Recensement non bloquant : donne l'état réel sans transformer chaque
// imperfection mineure en échec de CI.
test('recensement des violations modérées et mineures', async ({ page }) => {
    // Ce test visite les 7 pages dans une seule exécution, chacune avec son
    // attente de chargement des données : il dépasse par nature le délai
    // commun, calibré pour un test qui regarde UNE page.
    //
    // 300 s et non 180 : `parametres.html` occupe à elle seule ~80 s (1 517
    // contrôles à analyser), et le recensement en visite sept. À 180 s il
    // expirait sur une machine chargée — et un recensement qui expire ne
    // recense RIEN, alors que c'est sa seule raison d'être : il n'a aucune
    // assertion, il produit un chiffre.
    test.setTimeout(300_000);
    const total = {};
    for (const p of PAGES) {
        await ouvrir(page, p);
        for (const v of await analyser(page)) {
            const k = `${v.impact}/${v.id}`;
            total[k] = (total[k] || 0) + v.nb;
        }
    }
    const lignes = Object.entries(total).sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} : ${n}`);
    // eslint-disable-next-line no-console
    console.log('Violations a11y par règle (toutes pages) :\n  ' + (lignes.join('\n  ') || 'aucune'));
});

test('le lien d’évitement mène vraiment au contenu principal (A11Y-07)', async ({ page }) => {
    // Le lien pointait vers une ancre inexistante : au clavier, il ne sautait
    // nulle part. C'est le tout premier élément focusable de chaque page.
    await ouvrir(page, '/accueil.html');
    const lien = page.locator('a[href^="#"]').first();
    await expect(lien).toHaveAttribute('href', /#\w+/);
    const cible = await lien.getAttribute('href');
    await expect(page.locator(cible), `le lien d’évitement pointe vers ${cible}`).toHaveCount(1);
});

test('les boutons favori annoncent leur état (A11Y-08)', async ({ page }) => {
    // Sans aria-pressed, un lecteur d'écran lit « bouton favori » sans jamais
    // dire si la série EST en favori — l'information visuelle (cœur plein)
    // n'ayant aucun équivalent textuel.
    await ouvrir(page, '/bibliotheque.html');
    const sansEtat = await page.evaluate(() => {
        const boutons = [...document.querySelectorAll('[data-fav], .fav-btn, [aria-label*="favori" i]')];
        return boutons.filter(b => !b.hasAttribute('aria-pressed')).length;
    });
    expect(sansEtat, 'un bouton à bascule doit exposer aria-pressed').toBe(0);
});
