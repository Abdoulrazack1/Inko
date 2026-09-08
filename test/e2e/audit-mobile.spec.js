// ============================================================
// test/e2e/audit-mobile.spec.js — l'audit de l'application mobile
// ------------------------------------------------------------
// Ce fichier n'est pas un test de non-régression : c'est un INSTRUMENT DE
// MESURE. Il parcourt le paquet mobile tel qu'il part dans l'APK, à la taille
// d'un téléphone, et écrit dans `docs/audit-mobile.md` ce qu'il constate —
// chaque débordement avec son sélecteur et son ampleur, chaque cible tactile
// trop petite avec son libellé et sa taille, chaque conteneur de contenu resté
// vide, chaque image cassée, chaque erreur de console.
//
// ── Pourquoi un navigateur, et pas jsdom ────────────────────
//
// jsdom n'a PAS de moteur de mise en page : toutes les boîtes y mesurent zéro.
// Un audit de débordements et de chevauchements y serait entièrement faux, et
// vert. Playwright pilote un vrai Chromium, avec une vraie mise en page.
//
// ── Ce que cet audit ne peut PAS voir ───────────────────────
//
// Les appels aux sources échouent ici : sans `CapacitorHttp`, CORS les bloque.
// Un catalogue vide dans ce rapport ne prouve donc PAS qu'il est vide sur
// l'appareil. Les constats de MISE EN PAGE, eux, sont valables partout : ils
// ne dépendent pas du réseau.
'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const http = require('http');

const RACINE = path.join(__dirname, '..', '..');
const PAQUET = path.join(RACINE, 'mobile', 'www');
const PORT = 8611;
const BASE = 'http://127.0.0.1:' + PORT;

// L'audit sert LUI-MEME le paquet mobile : la configuration Playwright vise
// le serveur Inko, qui rend les pages du SITE, pas celles de l'APK. Auditer
// les mauvaises pages donnerait un rapport juste sur un objet faux.
const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};
function servir() {
    return new Promise((ok) => {
        const s = http.createServer((q, r) => {
            let rel = decodeURIComponent(q.url.split('?')[0]);
            if (rel === '/') rel = '/accueil.html';
            // ⚠ `path.resolve` des DEUX cotes : sur Windows `path.join` rend des
            // antislashes, et comparer a une constante en slashes rejette tout.
            const f = path.resolve(path.join(PAQUET, rel));
            if (!f.startsWith(path.resolve(PAQUET))) { r.writeHead(403); return r.end(); }
            try {
                const c = fs.readFileSync(f);
                r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
                r.end(c);
            } catch (e) { r.writeHead(404); r.end('absent'); }
        });
        s.listen(PORT, () => ok(s));
    });
}

// Les 23 pages du paquet, dans l'ordre où un utilisateur les rencontre.
const PAGES = [
    ['accueil', 'Accueil'],
    ['catalogue', 'Catalogue'],
    ['recherche', 'Recherche'],
    ['bibliotheque', 'Bibliothèque'],
    ['serie', 'Fiche de série'],
    ['chapitre', 'Lecteur'],
    ['lecture', 'Lecteur de roman'],
    ['collections', 'Collections'],
    ['collection-detail', 'Détail d’une collection'],
    ['notes', 'Journal de lecture'],
    ['notifications', 'Notifications'],
    ['downloads', 'Téléchargements'],
    ['import', 'Fichiers importés'],
    ['localreader', 'Lecteur de fichier'],
    ['parametres', 'Paramètres'],
    ['profil', 'Profil'],
    ['stats', 'Statistiques'],
    ['sources', 'Sources'],
    ['liste', 'Liste'],
    ['u', 'Profil public'],
    ['anilist', 'Retour AniList'],
    ['confidentialite', 'Confidentialité'],
    ['offline', 'Hors ligne'],
];

const LARGEUR = 375;
const HAUTEUR = 812;
const CIBLE_MIN = 44;      // recommandation tactile : 48 dp ≈ 44 px CSS ici

/** Relevé complet d'une page, exécuté DANS le navigateur. */
const MESURER = ({ LARGEUR, CIBLE_MIN }) => {
    const visible = (e) => {
        const r = e.getBoundingClientRect();
        const s = getComputedStyle(e);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden'
            && s.display !== 'none' && parseFloat(s.opacity) > 0.05;
    };
    const nommer = (e) => {
        let n = e.tagName.toLowerCase();
        if (e.id) n += '#' + e.id;
        else if (typeof e.className === 'string' && e.className.trim()) {
            n += '.' + e.className.trim().split(/\s+/)[0];
        }
        return n;
    };
    const etiquette = (e) => (e.getAttribute('aria-label')
        || e.getAttribute('title') || (e.textContent || '').trim() || e.tagName).slice(0, 40);

    // ── Débordements horizontaux ────────────────────────────
    const debordements = [];
    for (const e of document.querySelectorAll('body *')) {
        if (!visible(e)) continue;
        const r = e.getBoundingClientRect();
        if (r.right > LARGEUR + 1) {
            debordements.push({ el: nommer(e), de: Math.round(r.right - LARGEUR), largeur: Math.round(r.width) });
        } else if (r.left < -1) {
            debordements.push({ el: nommer(e), de: Math.round(-r.left), cote: 'gauche' });
        }
    }

    // ── Cibles tactiles trop petites ────────────────────────
    const cibles = [];
    for (const e of document.querySelectorAll('button,a,input,select,textarea,[role="button"],[role="tab"]')) {
        if (!visible(e)) continue;
        if (e.type === 'hidden') continue;
        const r = e.getBoundingClientRect();
        // Une zone étendue par ::after compte : on lit la boîte réelle du
        // pseudo-élément, sinon on signale des contrôles parfaitement
        // atteignables — l'audit avait déjà produit ce faux positif.
        const ap = getComputedStyle(e, '::after');
        const etendu = ap && ap.content !== 'none' && ap.position === 'absolute'
            && (parseFloat(ap.height) >= CIBLE_MIN || ap.inset === '-8px' || parseFloat(ap.top) < 0);
        if (!etendu && (r.height < CIBLE_MIN || r.width < 24)) {
            cibles.push({ el: nommer(e), quoi: etiquette(e), taille: Math.round(r.width) + '×' + Math.round(r.height) });
        }
    }

    // ── Chevauchements entre contrôles ──────────────────────
    // Deux boutons qui se recouvrent : l'un des deux est inatteignable.
    const chevauchements = [];
    const boutons = [...document.querySelectorAll('button,a[href],[role="button"]')].filter(visible);
    for (let i = 0; i < boutons.length; i++) {
        for (let j = i + 1; j < boutons.length; j++) {
            const a = boutons[i].getBoundingClientRect(), b = boutons[j].getBoundingClientRect();
            if (boutons[i].contains(boutons[j]) || boutons[j].contains(boutons[i])) continue;
            const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left);
            const oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
            if (ox > 4 && oy > 4) {
                chevauchements.push({ a: nommer(boutons[i]), b: nommer(boutons[j]),
                    zone: Math.round(ox) + '×' + Math.round(oy) });
            }
        }
    }

    // ── Conteneurs de contenu restés vides ──────────────────
    const vides = [];
    const SEL = '[id*=grid],[id*=Grid],[class*=grid],[id*=hero],[class*=hero],'
        + '[id*=List],[id*=list],[class*=carousel],[class*=rail],[id*=Rail]';
    for (const e of document.querySelectorAll(SEL)) {
        if (!visible(e)) continue;
        if (e.children.length === 0 && !(e.textContent || '').trim()) vides.push(nommer(e));
    }

    // ── Images ──────────────────────────────────────────────
    const imgs = [...document.images].filter(visible);
    const cassees = imgs.filter((i) => i.complete && i.naturalWidth === 0).map((i) => (i.src || '').slice(-52));

    // ── Repères d'accessibilité ─────────────────────────────
    const h1 = document.querySelectorAll('h1').length;
    const main = document.querySelectorAll('main').length;

    return {
        debordements, cibles, chevauchements: chevauchements.slice(0, 10), vides, cassees,
        scrollW: document.documentElement.scrollWidth,
        controles: document.querySelectorAll('button,a[href],input,select').length,
        h1, main,
        voile: !!(document.getElementById('mh-eula') || document.getElementById('inko-accueil-autonome')),
        titre: document.title,
    };
};

test.describe('Audit de l’application mobile', () => {
    test('parcourir chaque page et relever ce qui cloche', async ({ browser }) => {
        test.setTimeout(15 * 60 * 1000);

        if (!fs.existsSync(PAQUET)) {
            test.skip(true, 'paquet mobile absent — lancer `npm run mobile:www`');
        }
        const serveur = await servir();

        const ctx = await browser.newContext({
            viewport: { width: LARGEUR, height: HAUTEUR },
            deviceScaleFactor: 3,
            isMobile: true,
            hasTouch: true,
            userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
        });

        const page = await ctx.newPage();
        const journal = [];
        page.on('console', (m) => { if (m.type() === 'error') journal.push(m.text().slice(0, 160)); });
        page.on('pageerror', (e) => journal.push('EXCEPTION ' + e.message.slice(0, 160)));

        // On écarte l'EULA et l'écran de bienvenue : sinon on ne mesure qu'un
        // voile, et c'est exactement l'erreur du premier audit.
        await page.addInitScript(() => {
            try {
                localStorage.setItem('mh_eula_v2', JSON.stringify({ acceptedAt: Date.now(), version: 1 }));
                localStorage.setItem('inko_autonome_vu', '1');
            } catch (e) { /* stockage refusé */ }
        });

        const resultats = [];
        for (const [slug, nom] of PAGES) {
            journal.length = 0;
            let mesure = null, erreurNav = null;
            try {
                await page.goto(BASE + '/' + slug + '.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
                await page.waitForTimeout(2500);
                mesure = await page.evaluate(MESURER, { LARGEUR, CIBLE_MIN });
            } catch (e) {
                erreurNav = e.message.split('\n')[0].slice(0, 120);
            }
            resultats.push({ slug, nom, mesure, erreurNav, console: [...new Set(journal)].slice(0, 5) });
            // eslint-disable-next-line no-console
            console.log(`  ${nom.padEnd(28)} ${mesure
                ? `${mesure.debordements.length} déb · ${mesure.cibles.length} cibles · ${mesure.vides.length} vides`
                : 'ÉCHEC : ' + erreurNav}`);
        }

        await ctx.close();
        await new Promise((ok) => serveur.close(ok));
        ecrireRapport(resultats);

        // L'audit ne fait pas échouer la CI : c'est un relevé, pas une barrière.
        expect(resultats.length).toBe(PAGES.length);
    });
});

function ecrireRapport(resultats) {
    const L = [];
    const D = new Date().toISOString().slice(0, 10);
    L.push('# Audit de l’application mobile');
    L.push('');
    L.push(`Relevé du ${D}, sur le paquet `+'`mobile/www`'+` tel qu’il part dans l’APK,`);
    L.push(`dans un Chromium piloté à **${LARGEUR}×${HAUTEUR}**, tactile, EULA écartée.`);
    L.push('');
    L.push('> ⚠ Les appels aux sources échouent dans ce contexte : sans `CapacitorHttp`,');
    L.push('> CORS les bloque. **Un conteneur vide ici ne prouve pas qu’il l’est sur');
    L.push('> l’appareil.** Les constats de mise en page, eux, valent partout.');
    L.push('');

    const tot = (f) => resultats.reduce((n, r) => n + (r.mesure ? r.mesure[f].length : 0), 0);
    L.push('## Vue d’ensemble');
    L.push('');
    L.push('| Page | Débordements | Cibles < 44 px | Chevauchements | Conteneurs vides | Images cassées |');
    L.push('|---|---|---|---|---|---|');
    for (const r of resultats) {
        if (!r.mesure) { L.push(`| ${r.nom} | — | — | — | — | **échec : ${r.erreurNav}** |`); continue; }
        const m = r.mesure;
        L.push(`| ${r.nom} | ${m.debordements.length} | ${m.cibles.length} | ${m.chevauchements.length} | ${m.vides.length} | ${m.cassees.length} |`);
    }
    L.push('');
    L.push(`**Totaux** — débordements : ${tot('debordements')} · cibles trop petites : ${tot('cibles')}`
        + ` · chevauchements : ${tot('chevauchements')} · conteneurs vides : ${tot('vides')}`);
    L.push('');
    L.push('---');
    L.push('');
    L.push('## Le détail, page par page');

    for (const r of resultats) {
        L.push('');
        L.push(`### ${r.nom} — \`${r.slug}.html\``);
        L.push('');
        if (!r.mesure) { L.push(`**La page n’a pas pu être chargée** : ${r.erreurNav}`); continue; }
        const m = r.mesure;

        L.push(`\`${m.titre}\` · ${m.controles} contrôles · ${m.h1} \`h1\` · ${m.main} \`main\``
            + (m.voile ? ' · ⚠ un voile couvrait encore la page' : ''));
        L.push('');

        if (m.debordements.length) {
            L.push(`**Débordements horizontaux (${m.debordements.length})** — la page mesure `
                + `${m.scrollW} px pour ${LARGEUR} disponibles :`);
            L.push('');
            for (const d of m.debordements.slice(0, 12)) {
                L.push(`- \`${d.el}\` dépasse de **${d.de} px**${d.cote ? ' à ' + d.cote : ''}`
                    + (d.largeur ? ` (largeur ${d.largeur} px)` : ''));
            }
            if (m.debordements.length > 12) L.push(`- … et ${m.debordements.length - 12} autres`);
            L.push('');
        }

        if (m.cibles.length) {
            L.push(`**Cibles tactiles sous ${CIBLE_MIN} px (${m.cibles.length})** :`);
            L.push('');
            for (const c of m.cibles.slice(0, 15)) {
                L.push(`- ${c.taille} — « ${c.quoi} » (\`${c.el}\`)`);
            }
            if (m.cibles.length > 15) L.push(`- … et ${m.cibles.length - 15} autres`);
            L.push('');
        }

        if (m.chevauchements.length) {
            L.push(`**Contrôles qui se recouvrent (${m.chevauchements.length})** — l’un des deux est inatteignable :`);
            L.push('');
            for (const c of m.chevauchements) L.push(`- \`${c.a}\` × \`${c.b}\` sur ${c.zone} px`);
            L.push('');
        }

        if (m.vides.length) {
            L.push(`**Conteneurs de contenu vides (${m.vides.length})** :`);
            L.push('');
            for (const v of m.vides) L.push(`- \`${v}\``);
            L.push('');
        }

        if (m.cassees.length) {
            L.push(`**Images qui ne chargent pas (${m.cassees.length})** :`);
            L.push('');
            for (const i of m.cassees.slice(0, 8)) L.push(`- …${i}`);
            L.push('');
        }

        if (r.console.length) {
            L.push('**Erreurs de console** :');
            L.push('');
            for (const e of r.console) L.push(`- \`${e}\``);
            L.push('');
        }

        if (!m.debordements.length && !m.cibles.length && !m.chevauchements.length
            && !m.vides.length && !m.cassees.length && !r.console.length) {
            L.push('Rien à signaler.');
            L.push('');
        }
    }

    const dest = path.join(RACINE, 'docs', 'audit-mobile.md');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, L.join('\n') + '\n');
    // eslint-disable-next-line no-console
    console.log('\n→ rapport écrit : docs/audit-mobile.md');
}
