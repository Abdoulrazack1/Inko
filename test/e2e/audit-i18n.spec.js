// ============================================================
// test/e2e/audit-i18n.spec.js — ce qui reste en français en anglais
// ------------------------------------------------------------
// Inko n'a pas de fichier de langue française : le FRANÇAIS est la langue du
// code, écrite en dur dans le HTML et le JS. `assets/i18n/en.json` est une
// SURCOUCHE — un dictionnaire « texte français exact → texte anglais » que
// `i18n.js` applique au vol, y compris sur ce qui est inséré après coup.
//
// Cette architecture a une conséquence que rien ne mesurait : une chaîne
// oubliée du dictionnaire ne casse rien, ne lève aucune erreur, n'apparaît
// dans aucun test. Elle reste simplement EN FRANÇAIS sous le doigt d'un
// lecteur anglophone. C'est le seul défaut d'interface qui soit à la fois
// certain, invisible depuis le poste d'un francophone, et jamais relevé.
//
// ── Comment on décide qu'une chaîne est oubliée ─────────────
//
// On charge chaque page avec `inko_lang = 'en'`, on laisse `i18n.js` faire son
// travail, puis on lit le texte VISIBLE. Une chaîne est signalée si elle porte
// une marque de français — un mot-outil (« le », « pour », « sans »…) ou une
// lettre accentuée — et qu'elle n'est pas déjà une valeur du dictionnaire.
//
// C'est une heuristique, et le rapport le dit : un titre d'œuvre français
// passerait pour une chaîne oubliée. On écarte donc ce qui vient des sources
// (titres, auteurs, contenus de chapitres), et on laisse un humain trancher le
// reste — le même contrat que le verdict `INERTE` de l'audit des contrôles.
'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const http = require('http');

const RACINE = path.join(__dirname, '..', '..');
const PAQUET = path.join(RACINE, 'mobile', 'www');
const PORT_DEPART = 8712;

const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

let BASE = '';

/** Même serveur que l'audit des contrôles, et pour la même raison : le port
 *  est cherché, un audit interrompu pouvant laisser le précédent en vie. */
function servir(port = PORT_DEPART, restants = 12) {
    return new Promise((ok, ko) => {
        const s = http.createServer((q, r) => {
            let rel = decodeURIComponent(q.url.split('?')[0]);
            if (rel === '/') rel = '/accueil.html';
            const f = path.resolve(path.join(PAQUET, rel));
            if (!f.startsWith(path.resolve(PAQUET))) { r.writeHead(403); return r.end(); }
            try {
                const c = fs.readFileSync(f);
                r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
                r.end(c);
            } catch (e) { r.writeHead(404); r.end('absent'); }
        });
        s.on('error', (e) => {
            if (e.code === 'EADDRINUSE' && restants > 0) servir(port + 1, restants - 1).then(ok, ko);
            else ko(e);
        });
        s.listen(port, () => { BASE = 'http://127.0.0.1:' + port; ok(s); });
    });
}

const PAGES = ['accueil', 'catalogue', 'recherche', 'bibliotheque', 'serie', 'chapitre',
    'lecture', 'collections', 'collection-detail', 'notes', 'notifications', 'downloads',
    'import', 'localreader', 'parametres', 'profil', 'u', 'stats', 'sources', 'liste',
    'anilist', 'confidentialite', 'offline'];

/**
 * Relève le texte visible que l'utilisateur anglophone a sous les yeux.
 *
 * On saute ce qui NE DOIT PAS être traduit : les titres d'œuvres, les noms
 * d'auteurs et le contenu des chapitres viennent des sources. `i18n.js` ne les
 * touche jamais — c'est sa garantie de sûreté — et les signaler ici noierait
 * les vraies chaînes oubliées.
 */
const RELEVER = ({ ignores }) => {
    const IGNORE = new Set(ignores);
    const hors = (n) => {
        for (let e = n.parentElement; e; e = e.parentElement) {
            if (e.hasAttribute && e.hasAttribute('data-no-i18n')) return true;
            const c = String(e.className || '');
            // Tout ce qui porte un titre, un auteur ou un contenu de source.
            if (/manga-card-title|card-title|serie-title|chapter-title|ch-title|novel-|reader-|note-body|manga-title|author|tp-title|team-pick/i.test(c)) return true;
            if (e.tagName === 'SCRIPT' || e.tagName === 'STYLE' || e.tagName === 'NOSCRIPT') return true;
        }
        return false;
    };
    const visible = (n) => {
        const e = n.parentElement;
        if (!e) return false;
        const r = e.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) return false;
        const s = getComputedStyle(e);
        return s.visibility !== 'hidden' && s.display !== 'none';
    };

    const out = new Set();
    const it = document.createNodeIterator(document.body, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = it.nextNode())) {
        const t = (n.nodeValue || '').replace(/\s+/g, ' ').trim();
        if (t.length < 3 || t.length > 160) continue;
        if (IGNORE.has(t)) continue;
        if (hors(n) || !visible(n)) continue;
        out.add(t);
    }
    // Les attributs que l'utilisateur lit aussi : bulles d'aide et champs.
    document.querySelectorAll('[placeholder],[title],[aria-label]').forEach((e) => {
        if (hors(e)) return;
        for (const a of ['placeholder', 'title', 'aria-label']) {
            const v = (e.getAttribute(a) || '').replace(/\s+/g, ' ').trim();
            if (v.length >= 3 && v.length <= 160 && !IGNORE.has(v)) out.add(v);
        }
    });
    return [...out];
};

// ── Reconnaître du français ─────────────────────────────────
// Les mots-outils sont le signal le plus sûr : ils n'apparaissent pas dans un
// titre d'œuvre japonais translittéré, et rarement en anglais. Les lettres
// accentuées complètent, avec un risque de faux positif assumé (un titre
// français passerait).
const MOTS_FR = /(^|[\s'’(«"])(le|la|les|un|une|des|du|de|au|aux|et|ou|où|dans|pour|sans|avec|sur|sous|par|plus|moins|tout|tous|toute|toutes|ton|ta|tes|mon|ma|mes|ce|cet|cette|ces|qui|que|quoi|dont|est|sont|était|sera|peut|pas|ne|n'|d'|l'|c'|s'|j'|t'|aucun|aucune|chaque|entre|vers|depuis|encore|déjà|jamais|toujours|ici|voir|lire|ajouter|supprimer|enregistrer|fermer|ouvrir|choisir|rechercher|afficher|masquer)([\s'’.,;:!?)»"]|$)/i;
const ACCENTS = /[àâäçéèêëîïôöùûüÿœæ]/i;
// Ce qui n'est pas de la copie d'interface : nombres, dates, codes, tailles.
const PAS_DU_TEXTE = /^[\d\s.,:/×x+\-–—%()[\]]+$/;

const estFrancais = (t) => !PAS_DU_TEXTE.test(t) && (MOTS_FR.test(t) || ACCENTS.test(t));

test.describe('Audit i18n — ce qui reste en français quand l’interface est en anglais', () => {
    test('relever les chaînes non traduites, page par page', async ({ browser }) => {
        test.setTimeout(15 * 60 * 1000);
        if (!fs.existsSync(PAQUET)) test.skip(true, 'paquet mobile absent');

        const dico = JSON.parse(fs.readFileSync(path.join(RACINE, 'assets', 'i18n', 'en.json'), 'utf8'));
        // Le dictionnaire mêle des clés `data-i18n` et la table « FR exact →
        // EN ». On aplatit tout : seules les VALEURS nous intéressent, ce sont
        // elles qu'on doit retrouver à l'écran une fois traduit.
        const valeurs = new Set();
        const clesFr = new Set();
        (function plat(o) {
            for (const [k, v] of Object.entries(o)) {
                if (v && typeof v === 'object') { plat(v); continue; }
                if (typeof v === 'string') { valeurs.add(v.trim()); clesFr.add(String(k).trim()); }
            }
        })(dico);

        const serveur = await servir();
        const ctx = await browser.newContext({
            viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
            locale: 'en-US',
        });
        const page = await ctx.newPage();
        await page.addInitScript(() => {
            try {
                localStorage.setItem('mh_eula_v2', JSON.stringify({ acceptedAt: Date.now(), version: 1 }));
                localStorage.setItem('inko_autonome_vu', '1');
                localStorage.setItem('inko_tour_done', '1');
                localStorage.setItem('inko_consent', '1');
                localStorage.setItem('inko_lang', 'en');
            } catch (e) { /* stockage refusé */ }
        });
        page.on('dialog', (d) => d.dismiss().catch(() => {}));

        const resultats = [];
        for (const slug of PAGES) {
            let brutes = [];
            let langue = null;
            try {
                await page.goto(BASE + '/' + slug + '.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
                await page.waitForTimeout(2400);
                langue = await page.evaluate(() => (window.MH && window.MH.lang) || null);
                brutes = await page.evaluate(RELEVER, { ignores: [...valeurs] });
            } catch (e) {
                resultats.push({ slug, erreur: String(e.message).split('\n')[0].slice(0, 110), oubliees: [] });
                continue;
            }
            const oubliees = brutes.filter(estFrancais).sort();
            resultats.push({ slug, langue, vues: brutes.length, oubliees });

            console.log(`  ${slug.padEnd(18)} ${String(brutes.length).padStart(3)} chaînes visibles · `
                + `${String(oubliees.length).padStart(3)} encore en français`);
        }

        await ctx.close();
        await new Promise((ok) => serveur.close(ok));
        ecrire(resultats, valeurs.size, clesFr.size);
        expect(resultats.length).toBe(PAGES.length);
    });
});

function ecrire(resultats, nbValeurs, nbCles) {
    const L = [];
    L.push('# Audit i18n — ce qui reste en français en mode anglais');
    L.push('');
    L.push(`Relevé du ${new Date().toISOString().slice(0, 10)}, sur le paquet \`mobile/www\`,`);
    L.push('interface forcée en anglais (`inko_lang = "en"`), sans hub.');
    L.push('');
    L.push(`Le dictionnaire \`assets/i18n/en.json\` compte **${nbCles} entrées** pour`);
    L.push(`**${nbValeurs} traductions distinctes**.`);
    L.push('');
    L.push('> ⚠ **Heuristique, pas verdict.** Une chaîne est signalée si elle porte un');
    L.push('> mot-outil français ou une lettre accentuée. Un titre d’œuvre en français');
    L.push('> serait signalé à tort — les zones qui affichent du contenu de source');
    L.push('> (titres, auteurs, chapitres) sont écartées, mais pas toutes. À trancher');
    L.push('> à l’œil, comme le verdict `INERTE` de l’audit des contrôles.');
    L.push('');

    const total = new Map();
    L.push('## Vue d’ensemble');
    L.push('');
    L.push('| Page | Chaînes visibles | **Encore en français** |');
    L.push('|---|---|---|');
    for (const r of resultats) {
        if (r.erreur) { L.push(`| ${r.slug} | — | **${r.erreur}** |`); continue; }
        L.push(`| ${r.slug} | ${r.vues} | **${r.oubliees.length}** |`);
        for (const s of r.oubliees) {
            if (!total.has(s)) total.set(s, []);
            total.get(s).push(r.slug);
        }
    }
    L.push('');
    L.push(`**${total.size} chaîne(s) distinctes** à traduire.`);
    L.push('');

    // Les plus répandues d'abord : traduire celle qui revient sur vingt pages
    // vaut vingt corrections.
    const parFrequence = [...total.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    L.push('## Par fréquence — la plus rentable en premier');
    L.push('');
    L.push('| Pages | Chaîne | Vue sur |');
    L.push('|---|---|---|');
    for (const [s, pages] of parFrequence) {
        L.push(`| ${pages.length} | ${s.replace(/\|/g, '\\|')} | ${pages.slice(0, 6).join(', ')}`
            + `${pages.length > 6 ? ' …' : ''} |`);
    }
    L.push('');
    L.push('---');
    L.push('');
    L.push('## Le détail, page par page');
    for (const r of resultats) {
        L.push('');
        L.push(`### \`${r.slug}.html\``);
        L.push('');
        if (r.erreur) { L.push(`**Page non chargée** : ${r.erreur}`); continue; }
        if (r.langue && r.langue !== 'en') {
            L.push(`> ⚠ \`MH.lang\` vaut \`${r.langue}\` et non \`en\` : la page n’a pas basculé.`);
            L.push('');
        }
        if (!r.oubliees.length) { L.push('_Rien à signaler._'); continue; }
        for (const s of r.oubliees) L.push(`- ${s.replace(/\|/g, '\\|')}`);
    }

    const dest = path.join(RACINE, 'docs', 'audit-i18n.md');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, L.join('\n') + '\n');

    console.log(`\n→ rapport écrit : docs/audit-i18n.md — ${total.size} chaîne(s) distinctes`);
}
