// ============================================================
// test/e2e/audit-clavier-etats.spec.js — le clavier, et ce qu'on voit quand
// le serveur ne répond plus
// ------------------------------------------------------------
// L'audit des contrôles répond à « est-ce que ce bouton fait quelque chose ».
// Il ne dit rien de deux questions au moins aussi coûteuses, et qu'aucun
// relevé de ce dépôt ne posait :
//
//   1. **Peut-on seulement l'atteindre ?** Un bouton parfait à la souris et
//      invisible au clavier n'existe pas pour qui navigue au clavier — et il
//      n'y a rien à voir : la page est belle, la souris marche, le défaut est
//      entièrement silencieux.
//
//   2. **Que montre la page quand l'API ne répond plus ?** C'est l'état dans
//      lequel l'utilisateur se trouve le plus souvent hors de chez lui : hub
//      éteint, réseau coupé, serveur redémarré. Une page qui reste blanche ou
//      qui tourne indéfiniment n'est pas une panne serveur, c'est une panne
//      d'interface — et elle est réparable ici.
//
// ── Ce qu'on mesure, et comment on décide ───────────────────
//
// · CLAVIER — on presse Tab jusqu'à faire le tour, on note ce qui reçoit le
//   focus, et on le compare aux contrôles VISIBLES de la page. Ce qui n'est
//   jamais atteint est signalé. On vérifie aussi que chaque élément focalisé
//   porte un indicateur visible (contour, anneau, ou changement de fond) :
//   un focus qu'on ne voit pas revient à ne pas l'avoir.
//
// · ÉCHAP — pour chaque panneau qu'on sait ouvrir, on vérifie que la touche
//   Échap le referme. Un panneau qui ne se ferme qu'au clic sur une croix de
//   14 px est un piège, au clavier comme au doigt.
//
// · API MUETTE — on coupe TOUTES les requêtes `/api/**` et on regarde ce que
//   la page affiche après cinq secondes. Trois issues : elle explique (bien),
//   elle tourne encore (l'utilisateur attend pour rien), elle est vide (le
//   pire : rien ne distingue une panne d'une bibliothèque vide).
//
// Comme les autres audits de ce dossier, celui-ci REND UN RAPPORT plutôt qu'un
// verdict binaire : les constats demandent un œil humain, et un test rouge sur
// une heuristique finirait par être désactivé.
'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const http = require('http');

const RACINE = path.join(__dirname, '..', '..');
const PAQUET = path.join(RACINE, 'mobile', 'www');
const PORT_DEPART = 8812;

const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

let BASE = '';

/** Le port est cherché : un audit interrompu laisse le précédent en vie. */
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

const PREPARER = () => {
    try {
        localStorage.setItem('mh_eula_v2', JSON.stringify({ acceptedAt: Date.now(), version: 1 }));
        localStorage.setItem('inko_autonome_vu', '1');
        localStorage.setItem('inko_tour_done', '1');
        localStorage.setItem('inko_consent', '1');
    } catch (e) { /* stockage refusé */ }
};

/** Identité stable d'un élément, pour comparer « atteint » et « visible ». */
const IDENTITE = `(e) => {
    if (!e || e === document.body || e === document.documentElement) return null;
    const libelle = (e.getAttribute('aria-label') || e.getAttribute('title')
        || (e.textContent || '').trim() || e.getAttribute('placeholder') || '')
        .replace(/\\s+/g, ' ').slice(0, 40);
    return e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + '|' + libelle;
}`;

/**
 * Les contrôles visibles qu'un utilisateur au clavier doit pouvoir atteindre.
 *
 * Chacun reçoit un repère UNIQUE (`data-kbd`) posé sur l'élément lui-même.
 *
 * La première version comparait des libellés. Or une page en compte des
 * dizaines d'identiques — « + » sur chaque carte, « ‹ » deux fois, des liens
 * sans texte — et la boucle Tab, qui s'arrêtait au premier repère déjà vu,
 * concluait après vingt pressions sur une page qui en comptait soixante-dix.
 * Elle rendait alors « 50 contrôles jamais atteints » : cinquante faux
 * constats, exactement le défaut que l'audit des contrôles venait de corriger.
 */
const CONTROLES_VISIBLES = new Function(`
    const ident = ${IDENTITE};
    const out = [];
    let n = 0;
    document.querySelectorAll('button,a[href],input,select,textarea,[role="button"],[tabindex]')
        .forEach((e) => {
            if (e.disabled) return;
            if (e.getAttribute('tabindex') === '-1') return;   // retiré volontairement
            if (e.type === 'hidden') return;
            const r = e.getBoundingClientRect();
            const s = getComputedStyle(e);
            if (r.width < 2 || r.height < 2) return;
            if (s.visibility === 'hidden' || s.display === 'none' || parseFloat(s.opacity) < 0.05) return;
            // Hors de l'écran vers le haut : le lien d'évitement, par exemple,
            // qui n'apparaît QU'au focus. Il est atteignable, on le garde.
            const ref = 'k' + (n++);
            e.setAttribute('data-kbd', ref);
            out.push({ ref, id: ident(e) || e.tagName.toLowerCase() });
        });
    return out;
`);

/** Le focus se voit-il ? Contour ou anneau. */
const INDICATEUR_VISIBLE = new Function(`
    const e = document.activeElement;
    if (!e || e === document.body) return null;
    const s = getComputedStyle(e);
    const contour = s.outlineStyle !== 'none' && parseFloat(s.outlineWidth) > 0;
    const anneau = s.boxShadow && s.boxShadow !== 'none';
    const ident = ${IDENTITE};
    return {
        ref: e.getAttribute('data-kbd'),
        id: ident(e),
        visible: !!(contour || anneau),
        outline: s.outlineStyle + ' ' + s.outlineWidth,
    };
`);

test.use({ trace: 'off', video: 'off' });

test.describe('Audit clavier & états — ce qu’on ne voyait pas', () => {
    test('le clavier atteint-il tout, et voit-on où l’on est ?', async ({ browser }) => {
        test.setTimeout(25 * 60 * 1000);
        if (!fs.existsSync(PAQUET)) test.skip(true, 'paquet mobile absent');
        const serveur = await servir();
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        const page = await ctx.newPage();
        await page.addInitScript(PREPARER);
        page.on('dialog', (d) => d.dismiss().catch(() => {}));

        const clavier = [];
        const echap = [];
        try {
            for (const slug of PAGES) {
                try {
                    await page.goto(`${BASE}/${slug}.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await page.waitForTimeout(2200);
                } catch (e) {
                    clavier.push({ slug, erreur: String(e.message).split('\n')[0].slice(0, 100) });
                    continue;
                }

                const visibles = await page.evaluate(CONTROLES_VISIBLES);
                // On repart du tout début du document, sinon l'ordre dépend de
                // ce qui avait le focus en arrivant.
                await page.evaluate(() => { document.body.setAttribute('tabindex', '-1'); document.body.focus(); });

                // On tourne jusqu'à revenir au PREMIER contrôle atteint : c'est
                // ça, un tour complet. S'arrêter au premier repère déjà vu
                // coupait le parcours dès la première paire de jumeaux.
                const atteints = new Set();
                const sansIndicateur = [];
                let premier = null;
                const maxTab = Math.min(visibles.length * 2 + 30, 320);
                for (let i = 0; i < maxTab; i++) {
                    await page.keyboard.press('Tab');
                    const r = await page.evaluate(INDICATEUR_VISIBLE);
                    if (!r) continue;
                    if (r.ref) {
                        if (premier === null) premier = r.ref;
                        else if (r.ref === premier && atteints.size > 1) break;   // tour bouclé
                        atteints.add(r.ref);
                    }
                    if (!r.visible && r.id) sansIndicateur.push(r.id + '  [' + r.outline + ']');
                }

                const jamaisAtteints = visibles
                    .filter((v) => !atteints.has(v.ref))
                    .map((v) => v.id);
                clavier.push({
                    slug,
                    visibles: visibles.length,
                    atteints: atteints.size,
                    jamaisAtteints: jamaisAtteints.slice(0, 12),
                    jamaisTotal: jamaisAtteints.length,
                    sansIndicateur: [...new Set(sansIndicateur)].slice(0, 8),
                    sansIndicateurTotal: new Set(sansIndicateur).size,
                });

                // ── Échap referme-t-il ce qui s'ouvre ? ──────────
                // On n'ouvre que les panneaux qu'un contrôle non destructif
                // sait ouvrir, et au plus trois par page : l'objectif est de
                // trouver le motif, pas d'inventorier.
                const ouvreurs = await page.evaluate(() => {
                    const D = /supprim|efface|vider|réinitialis|déconnex|révoqu|quitter|retirer|purge/i;
                    const out = [];
                    document.querySelectorAll('button,[role="button"]').forEach((e, i) => {
                        const t = (e.getAttribute('aria-label') || e.getAttribute('title')
                            || e.textContent || '').replace(/\s+/g, ' ').trim();
                        if (D.test(t)) return;
                        const r = e.getBoundingClientRect();
                        if (r.width < 2 || r.height < 2) return;
                        e.setAttribute('data-echap', 'e' + i);
                        out.push({ ref: 'e' + i, libelle: t.slice(0, 36) });
                    });
                    return out;
                });
                const compter = () => page.evaluate(
                    () => document.querySelectorAll('dialog[open],.mh-feuille,.mh-modal,[role=dialog]').length);

                let testes = 0;
                for (const o of ouvreurs) {
                    if (testes >= 3) break;
                    const avant = await compter();
                    try {
                        await page.locator(`[data-echap="${o.ref}"]`).first()
                            .click({ timeout: 1500, force: true, noWaitAfter: true });
                    } catch (e) { continue; }
                    await page.waitForTimeout(500);
                    const ouvert = await compter();
                    if (ouvert <= avant) continue;             // rien ne s'est ouvert
                    testes++;
                    // Le focus est-il entré dans le panneau ?
                    const focusDedans = await page.evaluate(() => {
                        const p = document.querySelector('dialog[open],.mh-feuille,.mh-modal,[role=dialog]');
                        return !!(p && document.activeElement && p.contains(document.activeElement));
                    });
                    await page.keyboard.press('Escape');
                    await page.waitForTimeout(450);
                    const apres = await compter();
                    echap.push({
                        slug, libelle: o.libelle,
                        ferme: apres <= avant,
                        focusDedans,
                    });
                    if (apres > avant) {
                        // Il est resté ouvert : on recharge, sinon il gêne la suite.
                        await page.goto(`${BASE}/${slug}.html`, { waitUntil: 'domcontentloaded' });
                        await page.waitForTimeout(1500);
                    }
                }

                const c = clavier[clavier.length - 1];
                console.log(`  ${slug.padEnd(18)} ${String(c.visibles).padStart(3)} visibles · `
                    + `${String(c.atteints).padStart(3)} atteints au clavier`
                    + (c.jamaisTotal ? ` · ${c.jamaisTotal} JAMAIS atteints` : '')
                    + (c.sansIndicateurTotal ? ` · ${c.sansIndicateurTotal} sans indicateur` : ''));
            }
        } finally {
            await ctx.close();
            await new Promise((ok) => serveur.close(ok));
            ecrireClavier(clavier, echap);
        }
        expect(clavier.length).toBe(PAGES.length);
    });

    test('que montre la page quand l’API ne répond plus ?', async ({ browser }) => {
        test.setTimeout(20 * 60 * 1000);
        if (!fs.existsSync(PAQUET)) test.skip(true, 'paquet mobile absent');
        const serveur = await servir();
        const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
        const page = await ctx.newPage();
        await page.addInitScript(PREPARER);
        page.on('dialog', (d) => d.dismiss().catch(() => {}));
        // TOUT ce qui part vers l'API échoue, comme si le hub était éteint.
        await page.route('**/api/**', (r) => r.abort('failed'));

        // Les trois pages qui EXIGENT une cible. Sans elle, on mesurait leur
        // ecran « Lien invalide » — un ecran parfaitement correct — au lieu de
        // ce qu'elles montrent quand la source ne repond plus. Les
        // identifiants n'ont pas besoin d'exister : l'API est coupee, seul
        // compte le fait que la page ait de quoi essayer.
        const CIBLE = {
            serie: '?id=demo-audit&source=weebcentral',
            chapitre: '?manga=demo-audit&chapter=c1&source=weebcentral',
            lecture: '?manga=demo-audit&chapter=c1&source=weebcentral',
            'collection-detail': '?id=1',
            liste: '?id=1',
            u: '?u=demo&preview=1',
        };

        const etats = [];
        try {
            for (const slug of PAGES) {
                try {
                    await page.goto(`${BASE}/${slug}.html${CIBLE[slug] || ''}`,
                        { waitUntil: 'domcontentloaded', timeout: 30000 });
                } catch (e) {
                    etats.push({ slug, erreur: String(e.message).split('\n')[0].slice(0, 100) });
                    continue;
                }
                // Cinq secondes : au-delà, l'utilisateur a déjà conclu que
                // l'application est cassée.
                await page.waitForTimeout(5000);
                const vu = await page.evaluate(() => {
                    const zone = document.querySelector('main') || document.body;
                    const texte = (zone.innerText || '').replace(/\s+/g, ' ').trim();
                    const tourne = document.querySelectorAll(
                        '.spinner,.spinner-inline,.loader,.skeleton,[class*="squelette"]').length;
                    // Un mot qui EXPLIQUE : erreur, hors-ligne, réessayer…
                    // Le vocabulaire de l'attente et de l'absence, pas
                    // seulement celui de la PANNE.
                    //
                    // La liste ne connaissait que le registre de l'erreur, et
                    // signalait donc trois pages qui font exactement ce qu'il
                    // faut. Vérifié une par une :
                    //
                    //   · `liste` — « Cette liste n'existe pas ou n'est pas
                    //     partagée publiquement. Aller à l'accueil » : elle dit
                    //     quoi, pourquoi, et offre une sortie. Elle disait
                    //     « n'existe pas » là où le motif attendait
                    //     « introuvable » ;
                    //   · `anilist` — ouverte sans paramètre, elle explique
                    //     qu'elle attend une réponse d'AniList et renvoie aux
                    //     paramètres. Elle ne DOIT pas annoncer d'échec : c'est
                    //     précisément le correctif DESK-03 ;
                    //   · `recherche` — son invite d'accueil. Rien n'a encore
                    //     échoué au chargement ; la page n'a rien à signaler.
                    //
                    // Trois faux constats en tête d'un rapport envoient
                    // réparer ce qui marche. D'où l'élargissement, et le
                    // rappel plus bas que ce verdict est une piste, pas un
                    // jugement.
                    const explique = /(indisponible|injoignable|hors[- ]ligne|erreur|impossible|réessa|connecte|connexion|pas de connexion|introuvable|n[’']existe pas|non disponible|pas partagée?|se lance depuis|requise?|vide|aucun)/i
                        .test(texte);
                    return {
                        longueur: texte.length,
                        tourne,
                        explique,
                        extrait: texte.slice(0, 150),
                    };
                });
                let verdict = 'EXPLIQUE';
                if (vu.longueur < 40) verdict = 'VIDE';
                else if (vu.tourne > 0) verdict = 'TOURNE ENCORE';
                else if (!vu.explique) verdict = 'MUET';
                etats.push({ slug, ...vu, verdict });
                console.log(`  ${slug.padEnd(18)} ${verdict.padEnd(14)} ${vu.longueur} car.`
                    + (vu.tourne ? ` · ${vu.tourne} indicateur(s) de chargement` : ''));
            }
        } finally {
            await ctx.close();
            await new Promise((ok) => serveur.close(ok));
            ecrireEtats(etats);
        }
        expect(etats.length).toBe(PAGES.length);
    });
});

function ecrireClavier(clavier, echap) {
    const L = [];
    L.push('# Audit clavier — atteindre, et voir où l’on est');
    L.push('');
    L.push(`Relevé du ${new Date().toISOString().slice(0, 10)}, sur le paquet \`mobile/www\`,`);
    L.push('à 1280×900, sans hub. On presse Tab jusqu’à faire le tour de la page.');
    L.push('');
    L.push('> Un contrôle « jamais atteint » est un constat, pas une condamnation :');
    L.push('> il peut être dans un panneau fermé, ou apparaître après le tour. Mais un');
    L.push('> bouton visible que Tab ne rencontre jamais n’existe pas pour qui navigue');
    L.push('> au clavier — et rien à l’écran ne le laisse deviner.');
    L.push('');
    L.push('## Vue d’ensemble');
    L.push('');
    L.push('| Page | Visibles | Atteints | **Jamais atteints** | **Focus invisible** |');
    L.push('|---|---|---|---|---|');
    let totJamais = 0, totSans = 0;
    for (const c of clavier) {
        if (c.erreur) { L.push(`| ${c.slug} | — | — | **${c.erreur}** | — |`); continue; }
        totJamais += c.jamaisTotal; totSans += c.sansIndicateurTotal;
        L.push(`| ${c.slug} | ${c.visibles} | ${c.atteints} | **${c.jamaisTotal}** | **${c.sansIndicateurTotal}** |`);
    }
    L.push('');
    L.push(`**${totJamais}** contrôle(s) visibles jamais atteints au clavier · `
        + `**${totSans}** focalisés sans indicateur visible.`);
    L.push('');

    L.push('## Échap referme-t-il les panneaux ?');
    L.push('');
    if (!echap.length) L.push('_Aucun panneau ouvert pendant le parcours._');
    else {
        L.push('| Page | Ce qui l’a ouvert | Échap ferme | Focus entré dedans |');
        L.push('|---|---|---|---|');
        for (const e of echap) {
            L.push(`| \`${e.slug}\` | ${e.libelle.replace(/\|/g, '\\|')} `
                + `| ${e.ferme ? 'oui' : '**NON**'} | ${e.focusDedans ? 'oui' : '**non**'} |`);
        }
    }
    L.push('');
    L.push('---');
    L.push('');
    L.push('## Le détail, page par page');
    for (const c of clavier) {
        if (c.erreur) continue;
        if (!c.jamaisTotal && !c.sansIndicateurTotal) continue;
        L.push('');
        L.push(`### \`${c.slug}.html\``);
        L.push('');
        if (c.jamaisTotal) {
            L.push(`**${c.jamaisTotal} contrôle(s) visibles que Tab n’atteint jamais :**`);
            L.push('');
            for (const v of c.jamaisAtteints) L.push(`- \`${v}\``);
            if (c.jamaisTotal > c.jamaisAtteints.length) {
                L.push(`- … et ${c.jamaisTotal - c.jamaisAtteints.length} autre(s)`);
            }
            L.push('');
        }
        if (c.sansIndicateurTotal) {
            L.push(`**${c.sansIndicateurTotal} focalisé(s) sans rien de visible :**`);
            L.push('');
            for (const v of c.sansIndicateur) L.push(`- \`${v}\``);
            L.push('');
        }
    }
    const dest = path.join(RACINE, 'docs', 'audit-clavier.md');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, L.join('\n') + '\n');
    console.log('\n→ rapport écrit : docs/audit-clavier.md');
}

function ecrireEtats(etats) {
    const L = [];
    L.push('# Audit des états — ce que la page montre quand l’API se tait');
    L.push('');
    L.push(`Relevé du ${new Date().toISOString().slice(0, 10)}. **Toutes** les requêtes`);
    L.push('`/api/**` sont coupées, comme si le hub était éteint. On regarde ce que la');
    L.push('page affiche cinq secondes plus tard.');
    L.push('');
    L.push('| Verdict | Sens |');
    L.push('|---|---|');
    L.push('| `EXPLIQUE` | la page dit ce qui se passe — c’est ce qu’on veut |');
    L.push('| `TOURNE ENCORE` | un indicateur de chargement tourne toujours : l’utilisateur attend pour rien |');
    L.push('| `MUET` | du contenu, mais rien qui explique l’absence de données |');
    L.push('| `VIDE` | **rien**. Une panne et une bibliothèque vide se ressemblent alors trait pour trait |');
    L.push('');
    L.push('| Page | Verdict | Texte visible | Chargement | Ce qu’on lit |');
    L.push('|---|---|---|---|---|');
    for (const e of etats) {
        if (e.erreur) { L.push(`| ${e.slug} | **non chargée** | — | — | ${e.erreur} |`); continue; }
        const v = e.verdict === 'EXPLIQUE' ? e.verdict : `**${e.verdict}**`;
        L.push(`| ${e.slug} | ${v} | ${e.longueur} car. | ${e.tourne || 0} `
            + `| ${(e.extrait || '').replace(/\|/g, '\\|').slice(0, 90)} |`);
    }
    L.push('');
    const aTraiter = etats.filter((e) => e.verdict && e.verdict !== 'EXPLIQUE');
    L.push(`**${aTraiter.length} page(s)** à relire : rien n’y a été reconnu comme une explication.`);
    L.push('');
    L.push('> ⚠ **Heuristique, pas verdict.** `MUET` se décide sur du vocabulaire :');
    L.push('> une page qui explique parfaitement les choses avec d’autres mots est');
    L.push('> signalée à tort. Trois l’ont été — `liste`, `anilist` et `recherche` —');
    L.push('> et les trois faisaient exactement ce qu’il fallait. Lire l’extrait');
    L.push('> avant de conclure.');
    const dest = path.join(RACINE, 'docs', 'audit-etats.md');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, L.join('\n') + '\n');
    console.log('\n→ rapport écrit : docs/audit-etats.md');
    console.log(`  ${aTraiter.length} page(s) muettes ou bloquées quand l'API se tait.`);
}
