// ============================================================
// test/e2e/reperes.spec.js — des repères qu'on peut distinguer
// ------------------------------------------------------------
// La navigation par repères est le moyen qu'a un lecteur d'écran de sauter
// d'une région à l'autre sans parcourir la page. Elle ne vaut que si les
// régions portent des noms : deux repères annoncés « navigation » sont deux
// repères entre lesquels on ne peut pas choisir.
//
// Relevé avant correction : `/profil.html` exposait SIX repères de
// navigation — quatre dans la colonne latérale, plus l'en-tête et la barre du
// téléphone — et aucun n'était nommé. L'aside de la colonne non plus.
//
// Les noms des quatre premiers viennent de `aria-labelledby`, pointant sur
// l'intitulé DÉJÀ VISIBLE de chaque section. Le nom ne peut donc pas diverger
// de ce qui est à l'écran — c'est ce qui arrive avec un `aria-label` recopié
// à la main le jour où l'intitulé change.
//
// Comme `cibles-tactiles.spec.js`, ce fichier n'inspecte que des attributs et
// du texte : aucune mesure de couleur, donc aucune des sources de faux
// positifs qui ont fait renoncer à élargir `contraste.spec.js`.
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

/** Le nom accessible d'un repère : aria-label, ou le texte de aria-labelledby. */
const NOMS = function () {
    const nom = (el) => {
        const direct = el.getAttribute('aria-label');
        if (direct && direct.trim()) return direct.trim();
        const par = el.getAttribute('aria-labelledby');
        if (par) {
            const txt = par.split(/\s+/)
                .map(id => document.getElementById(id))
                .filter(Boolean)
                .map(n => n.textContent.trim())
                .join(' ').trim();
            if (txt) return txt;
        }
        return null;
    };
    const vus = [];
    document.querySelectorAll('nav, [role="navigation"], aside, [role="complementary"]').forEach(el => {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        vus.push({
            type: el.tagName === 'NAV' || el.getAttribute('role') === 'navigation' ? 'navigation' : 'complementary',
            nom: nom(el),
            repere: (el.className || '').toString().slice(0, 28) || el.id || el.tagName,
        });
    });
    return vus;
};

// DEUX largeurs, et la raison vaut d'etre dite : ecrit d'abord en 375 px
// seulement, ce fichier passait sur `/catalogue.html` alors que son panneau
// de filtres n'avait aucun nom — a cette largeur il est masque, donc jamais
// examine. Un test qui passe en ne regardant pas est pire qu'absent : il
// rassure.
const LARGEURS = [
    { nom: 'téléphone', taille: { width: 375, height: 812 } },
    { nom: 'bureau', taille: { width: 1280, height: 900 } },
];

for (const p of ['/accueil.html', '/profil.html', '/catalogue.html'])
for (const l of LARGEURS) {
    test(`les repères de ${p} portent tous un nom — ${l.nom}`, async ({ page }) => {
        test.setTimeout(120_000);
        // Largeur téléphone : c'est là que la barre du bas existe, et donc là
        // qu'il y a le plus de repères à distinguer.
        await page.setViewportSize(l.taille);
        await ouvrir(page, p);

        const reperes = await page.evaluate(NOMS);
        expect(reperes.length, 'la page doit exposer des repères').toBeGreaterThan(0);

        const sansNom = reperes.filter(r => !r.nom);
        const SAUT = String.fromCharCode(10);
        expect(sansNom, SAUT + sansNom.map(r => `  ${r.type} « ${r.repere} » sans nom`).join(SAUT))
            .toEqual([]);
    });

    test(`deux repères de ${p} ne portent pas le même nom — ${l.nom}`, async ({ page }) => {
        // Un nom qui ne distingue pas ne vaut pas mieux que pas de nom : la
        // navigation par repères annoncerait deux fois la même chose.
        test.setTimeout(120_000);
        await page.setViewportSize(l.taille);
        await ouvrir(page, p);

        const reperes = await page.evaluate(NOMS);
        const parType = {};
        for (const r of reperes) {
            const k = r.type + '/' + (r.nom || '');
            (parType[k] = parType[k] || []).push(r.repere);
        }
        const doublons = Object.entries(parType).filter(([, v]) => v.length > 1);
        const SAUT = String.fromCharCode(10);
        expect(doublons, SAUT + doublons.map(([k, v]) => `  ${k} porté par ${v.join(', ')}`).join(SAUT))
            .toEqual([]);
    });
}
