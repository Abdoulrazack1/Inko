// ============================================================
// test/e2e/audit-controles.spec.js — chaque bouton fait-il QUELQUE CHOSE ?
// ------------------------------------------------------------
// L'audit de mise en page mesure des boîtes. Il ne dit rien de l'essentiel :
// est-ce qu'appuyer sur un bouton produit un effet ? C'est le défaut le plus
// coûteux à découvrir soi-même, parce qu'il n'y a rien à voir — on appuie, et
// il ne se passe rien.
//
// L'audit d'origine avait déjà relevé cette famille (DESK-05 : « carte, zoom,
// changement de page morts »), et elle est revenue avec le mode autonome : un
// contrôle qui appelait le hub échoue désormais en silence.
//
// ── Comment on décide qu'un contrôle est INERTE ─────────────
//
// On photographie l'état avant (URL, nombre de nœuds, texte visible, boîtes
// de dialogue ouvertes), on actionne, on attend, on recompare. Trois issues :
//
//   · NAVIGUE   — l'URL a changé : le contrôle marche, on revient en arrière ;
//   · AGIT      — le DOM a changé : panneau ouvert, liste filtrée, bascule ;
//   · INERTE    — rien n'a bougé. C'est un constat, PAS une condamnation :
//                 un bouton peut légitimement ne rien faire dans cet état
//                 (« Marquer lu » sans chapitre chargé). Le rapport le
//                 signale, un humain tranche.
//
// ── Ce qu'on n'actionne PAS ─────────────────────────────────
//
// Tout ce dont le libellé annonce une perte : supprimer, effacer, vider,
// réinitialiser, déconnexion, révoquer. Un audit ne doit pas détruire l'état
// qu'il mesure — et sur un vrai appareil, il détruirait celui de l'utilisateur.
'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const http = require('http');

const RACINE = path.join(__dirname, '..', '..');
const PAQUET = path.join(RACINE, 'mobile', 'www');
const PORT = 8612;
const BASE = 'http://127.0.0.1:' + PORT;

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

// Les 23 pages du paquet, pas les 16 « principales ».
//
// Huit pages n'avaient JAMAIS ete auditees — dont `lecture`, le lecteur de
// romans, et `localreader`, celui des fichiers importes : deux des trois
// surfaces de LECTURE d'une application de lecture. Un audit qui saute le
// coeur du produit rassure sans rien prouver.
//
// `besoin` dit ce qu'il faut a la page pour etre autre chose qu'un ecran
// d'erreur. Sans ces parametres, `serie.html` affiche « série introuvable » et
// ses vingt-cinq controles sont inertes A JUSTE TITRE — on auditait le message
// d'erreur, pas la page.
const PAGES = [
    { slug: 'accueil' },
    { slug: 'catalogue' },
    { slug: 'recherche' },
    { slug: 'bibliotheque' },
    { slug: 'serie', besoin: 'serie' },
    { slug: 'chapitre', besoin: 'chapitre' },
    { slug: 'lecture', besoin: 'chapitre' },
    { slug: 'collections' },
    { slug: 'collection-detail', besoin: 'collection' },
    { slug: 'notes' },
    { slug: 'notifications' },
    { slug: 'downloads' },
    { slug: 'import' },
    { slug: 'localreader' },
    { slug: 'parametres' },
    { slug: 'profil' },
    { slug: 'u', requete: '?u=demo&preview=1' },
    { slug: 'stats' },
    { slug: 'sources' },
    { slug: 'liste' },
    { slug: 'anilist' },
    { slug: 'confidentialite' },
    { slug: 'offline' },
];

// Libellés dont l'action détruit quelque chose : on ne les actionne jamais.
const DESTRUCTIF = /supprim|efface|vider|réinitialis|reinitialis|déconnex|deconnex|révoqu|revoqu|quitter|retirer|annuler l|purge/i;

const LARGEUR = 375, HAUTEUR = 812;

/** Signature de l'état de la page : ce qui doit changer si le contrôle agit. */
const SIGNATURE = () => ({
    url: location.href,
    noeuds: document.querySelectorAll('*').length,
    texte: (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 4000).length,
    dialogues: document.querySelectorAll('dialog[open],.mh-feuille,.mh-modal,[role=dialog]').length,
    classes: document.body.className,
    focus: document.activeElement ? document.activeElement.tagName : '',
});

/** Les contrôles actionnables, avec de quoi les retrouver. */
const LISTER = ({ DESTRUCTIF_SRC }) => {
    const DESTRUCTIF = new RegExp(DESTRUCTIF_SRC, 'i');
    const visible = (e) => {
        const r = e.getBoundingClientRect();
        const s = getComputedStyle(e);
        return r.width > 0 && r.height > 0 && s.visibility !== 'hidden'
            && s.display !== 'none' && parseFloat(s.opacity) > 0.05;
    };
    const out = [];
    const vus = new Set();
    // Le repere est DERIVE du controle (balise + id + libelle), pas de son rang.
    //
    // Il valait « c » + l'index de la boucle. Or on re-liste apres chaque
    // navigation, et le rang d'un controle change des qu'un noeud apparait ou
    // disparait au-dessus de lui — une carte chargee, une banniere fermee.
    // Tous les reperes se decalaient alors d'un cran, `[data-audit="cN"]`
    // ne designait plus rien, et l'audit rendait « DISPARU » pour la quasi
    // totalite des controles suivant la premiere navigation. Le rapport
    // comptait ainsi des centaines de faux DISPARU, qui masquaient les vrais.
    const cleStable = (e, libelle) => {
        const brut = e.tagName + '|' + (e.id || '') + '|' + libelle;
        let h = 0;
        for (let k = 0; k < brut.length; k++) { h = (h * 31 + brut.charCodeAt(k)) | 0; }
        return 'c' + (h >>> 0).toString(36);
    };
    document.querySelectorAll('button,a[href],[role="button"],input[type=checkbox],select')
        .forEach((e) => {
            if (!visible(e)) return;
            const libelle = (e.getAttribute('aria-label') || e.getAttribute('title')
                || (e.textContent || '').trim() || e.tagName).replace(/\s+/g, ' ').slice(0, 46);
            // Un même libellé répété (cartes d'une grille) : un exemplaire suffit.
            const cle = e.tagName + '|' + libelle;
            if (vus.has(cle)) return;
            vus.add(cle);
            const ref = cleStable(e, libelle);
            e.setAttribute('data-audit', ref);
            out.push({
                ref,
                libelle,
                tag: e.tagName.toLowerCase() + (e.id ? '#' + e.id : ''),
                href: e.getAttribute('href') || null,
                destructif: DESTRUCTIF.test(libelle),
            });
        });
    return out;
};

test.describe('Audit fonctionnel de l’application mobile', () => {
    test('actionner chaque contrôle et voir s’il produit un effet', async ({ browser }) => {
        test.setTimeout(25 * 60 * 1000);
        if (!fs.existsSync(PAQUET)) test.skip(true, 'paquet mobile absent');
        const serveur = await servir();

        const ctx = await browser.newContext({
            viewport: { width: LARGEUR, height: HAUTEUR },
            isMobile: true, hasTouch: true,
            userAgent: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36',
        });
        const page = await ctx.newPage();
        // Tout ce qui pose un CALQUE au premier lancement doit etre neutralise
        // ici, sinon l'audit n'audite que le calque.
        //
        // L'EULA et le choix « avec ou sans ordinateur » l'etaient deja. La
        // VISITE GUIDEE ne l'etait pas : elle s'ouvre sur l'accueil, couvre la
        // page, et avale chaque clic. Resultat, l'accueil rendait 33 controles
        // « INERTE » et pas UNE navigation sur 44 — 33 constats faux, en tete
        // du rapport, qui envoyaient chercher une panne inexistante. Le
        // bandeau de consentement, lui, est ancre en bas et n'intercepte rien,
        // mais on l'ecarte aussi : il fausse la signature de la page.
        await page.addInitScript(() => {
            try {
                localStorage.setItem('mh_eula_v2', JSON.stringify({ acceptedAt: Date.now(), version: 1 }));
                localStorage.setItem('inko_autonome_vu', '1');
                localStorage.setItem('inko_tour_done', '1');
                localStorage.setItem('inko_consent', '1');
            } catch (e) { /* stockage refusé */ }
        });
        // Une boîte native bloquerait le parcours indéfiniment.
        page.on('dialog', (d) => d.dismiss().catch(() => {}));

        // ── De VRAIES donnees pour les pages qui en exigent ──────
        //
        // On demande a l'application elle-meme, avec son propre moteur : une
        // serie populaire, puis un de ses chapitres. Sans ca, `serie.html`,
        // `chapitre.html` et `lecture.html` s'auditent sur leur ecran
        // « introuvable » — trois pages, soixante-dix controles, et un rapport
        // qui decrit un message d'erreur.
        let reel = { manga: null, source: null, chapitre: null };
        try {
            await page.goto(BASE + '/catalogue.html', { waitUntil: 'domcontentloaded', timeout: 20000 });
            await page.waitForTimeout(2500);
            reel = await page.evaluate(async () => {
                const out = { manga: null, source: null, chapitre: null };
                try {
                    const pg = await window.API.mangas.popular({ limit: 1 });
                    const m = (pg && pg.results && pg.results[0]) || null;
                    if (!m) return out;
                    out.manga = m.id; out.source = m.source || window.API.sources.current;
                    const ch = await window.API.mangas.chapters(m.id);
                    const liste = Array.isArray(ch) ? ch : (ch && ch.results) || [];
                    if (liste[0]) out.chapitre = liste[0].id;
                } catch (e) { out.erreur = String(e && e.message).slice(0, 90); }
                return out;
            });
        } catch (e) { reel.erreur = String(e.message).slice(0, 90); }
        // eslint-disable-next-line no-console
        console.log('  donnees reelles : manga=' + (reel.manga || '-')
            + ' chapitre=' + (reel.chapitre || '-') + (reel.erreur ? ' (' + reel.erreur + ')' : ''));

        /** L'URL a auditer pour une page, avec ce qu'il lui faut. */
        const urlDe = (P) => {
            const q = new URLSearchParams();
            if (P.besoin === 'serie' && reel.manga) { q.set('id', reel.manga); if (reel.source) q.set('source', reel.source); }
            if (P.besoin === 'chapitre' && reel.manga) {
                q.set('manga', reel.manga);
                if (reel.chapitre) q.set('chapter', reel.chapitre);
                if (reel.source) q.set('source', reel.source);
            }
            const qs = q.toString();
            return BASE + '/' + P.slug + '.html' + (qs ? '?' + qs : (P.requete || ''));
        };

        /**
         * Le message de garde affiche par la page, s'il y en a un.
         * « Connecte-toi pour voir cette liste » explique a lui seul pourquoi
         * les controles qui suivent ne font rien : c'est un CONTEXTE, pas une
         * panne, et le rapport doit le dire au lieu de laisser conclure.
         */
        const CONTEXTE = () => {
            const g = document.querySelector('.empty-state,.cd-guard,.guard,[data-guard]');
            const t = g && (g.innerText || '').replace(/[\s ]+/g, ' ').trim();
            return t ? t.slice(0, 120) : null;
        };

        const resultats = [];
        for (const P of PAGES) {
            const slug = P.slug;
            const erreurs = [];
            const onErr = (e) => erreurs.push(String(e.message || e).slice(0, 140));
            page.on('pageerror', onErr);
            // Les ressources qui MANQUENT : une icone, une police, un script.
            // Elles ne levent aucune exception — la page s'affiche « bien » et
            // il manque seulement quelque chose. Rien ne les relevait.
            // On separe INTERNE et EXTERNE : ce ne sont pas les memes defauts.
            //
            // Un 404 interne est une ressource du paquet qui manque — toujours
            // un bug. Un 404 externe vient d'un site tiers, et il est souvent
            // NORMAL : l'extension SushiScan pagine `/genres/<g>/page/N/`
            // jusqu'a ce que le site reponde 404, c'est ainsi qu'elle sait
            // qu'elle a fini. Melanges, ces dizaines de 404 attendus
            // noieraient la seule icone reellement absente.
            const absentsInternes = [];
            const absentsExternes = [];
            const onRep = (r) => {
                if (r.status() !== 404) return;
                const u = r.url();
                if (u.startsWith(BASE)) absentsInternes.push(u.replace(BASE, ''));
                else absentsExternes.push(u.replace(/^https?:\/\//, '').slice(0, 90));
            };
            page.on('response', onRep);

            let controles = [];
            let contexte = null;
            try {
                await page.goto(urlDe(P), { waitUntil: 'domcontentloaded', timeout: 20000 });
                await page.waitForTimeout(2200);
                contexte = await page.evaluate(CONTEXTE);
                controles = await page.evaluate(LISTER, { DESTRUCTIF_SRC: DESTRUCTIF.source });
            } catch (e) {
                resultats.push({ slug, erreurNav: e.message.split('\n')[0].slice(0, 120), controles: [] });
                page.off('pageerror', onErr); page.off('response', onRep);
                continue;
            }

            const verdicts = [];
            for (const c of controles) {
                if (c.destructif) { verdicts.push({ ...c, verdict: 'ÉVITÉ (destructif)' }); continue; }
                let verdict = 'INERTE';
                try {
                    const avant = await page.evaluate(SIGNATURE);
                    const cible = page.locator(`[data-audit="${c.ref}"]`).first();
                    if (!(await cible.count())) { verdicts.push({ ...c, verdict: 'DISPARU' }); continue; }
                    await cible.click({ timeout: 2500, force: true, noWaitAfter: true });
                    await page.waitForTimeout(700);
                    const apres = await page.evaluate(SIGNATURE);

                    if (apres.url !== avant.url) {
                        verdict = 'NAVIGUE → ' + apres.url.replace(BASE + '/', '');
                        await page.goto(BASE + '/' + slug + '.html', { waitUntil: 'domcontentloaded' });
                        await page.waitForTimeout(1600);
                        await page.evaluate(LISTER, { DESTRUCTIF_SRC: DESTRUCTIF.source });
                    } else if (apres.dialogues !== avant.dialogues) {
                        verdict = 'AGIT (panneau)';
                        await page.keyboard.press('Escape').catch(() => {});
                        await page.waitForTimeout(300);
                    } else if (Math.abs(apres.noeuds - avant.noeuds) > 2
                        || Math.abs(apres.texte - avant.texte) > 12
                        || apres.classes !== avant.classes) {
                        verdict = 'AGIT (page modifiée)';
                    }
                } catch (e) {
                    verdict = 'ERREUR : ' + String(e.message).split('\n')[0].slice(0, 60);
                }
                verdicts.push({ ...c, verdict });
            }

            page.off('pageerror', onErr); page.off('response', onRep);
            const inertes = verdicts.filter((v) => v.verdict === 'INERTE').length;
            const manquants = [...new Set(absentsInternes)].slice(0, 10);
            const tiers = [...new Set(absentsExternes)];
            resultats.push({
                slug, contexte, controles: verdicts,
                erreurs: [...new Set(erreurs)].slice(0, 4),
                absents: manquants,
                tiers: tiers.slice(0, 6),
                tiersTotal: tiers.length,
                url: urlDe(P).replace(BASE, ''),
            });
            // eslint-disable-next-line no-console
            console.log(`  ${slug.padEnd(18)} ${verdicts.length} contrôles · ${inertes} inertes`
                + (erreurs.length ? ` · ${erreurs.length} erreur(s) JS` : '')
                + (manquants.length ? ` · ${manquants.length} ressource(s) 404 INTERNE` : '')
                + (tiers.length ? ` · ${tiers.length} 404 tiers` : ''));
        }

        await ctx.close();
        await new Promise((ok) => serveur.close(ok));
        ecrire(resultats);
        expect(resultats.length).toBe(PAGES.length);
    });
});

function ecrire(resultats) {
    const L = [];
    L.push('# Audit fonctionnel — chaque contrôle de chaque page');
    L.push('');
    L.push(`Relevé du ${new Date().toISOString().slice(0, 10)}. Chaque bouton, lien et bascule`);
    L.push('a été **actionné**, et l’état de la page comparé avant/après.');
    L.push('');
    L.push('| Verdict | Sens |');
    L.push('|---|---|');
    L.push('| `NAVIGUE` | l’URL a changé — le contrôle fonctionne |');
    L.push('| `AGIT` | le DOM a changé — panneau ouvert, liste filtrée, bascule |');
    L.push('| `INERTE` | **rien n’a bougé** — à examiner |');
    L.push('| `ÉVITÉ` | libellé destructif : non actionné, par précaution |');
    L.push('');
    L.push('> ⚠ `INERTE` est un constat, pas une condamnation : un bouton peut');
    L.push('> légitimement ne rien faire dans cet état (« Marquer lu » sans chapitre');
    L.push('> chargé). Sans hub ni réseau, tout ce qui dépend d’une source l’est aussi.');
    L.push('');

    const tousInertes = [];
    L.push('## Vue d’ensemble');
    L.push('');
    L.push('| Page | Contrôles | Naviguent | Agissent | **Inertes** | Erreurs JS | 404 interne | 404 tiers |');
    L.push('|---|---|---|---|---|---|---|---|');
    for (const r of resultats) {
        if (r.erreurNav) { L.push(`| ${r.slug} | — | — | — | — | **${r.erreurNav}** | — | — |`); continue; }
        const n = (f) => r.controles.filter((c) => c.verdict.startsWith(f)).length;
        L.push(`| ${r.slug} | ${r.controles.length} | ${n('NAVIGUE')} | ${n('AGIT')} | **${n('INERTE')}** | ${(r.erreurs || []).length} | ${(r.absents || []).length} | ${r.tiersTotal || 0} |`);
        for (const c of r.controles) if (c.verdict === 'INERTE') tousInertes.push({ page: r.slug, ...c });
    }
    L.push('');
    L.push(`**${tousInertes.length} contrôles inertes** au total.`);
    L.push('');
    L.push('---');
    L.push('');
    L.push('## Le détail, page par page');

    for (const r of resultats) {
        L.push('');
        L.push(`### \`${r.slug}.html\``);
        L.push('');
        if (r.url) { L.push(`URL auditée : \`${r.url}\``); L.push(''); }
        if (r.erreurNav) { L.push(`**Page non chargée** : ${r.erreurNav}`); continue; }
        // Le message de garde vaut explication : sans lui, on lit une colonne
        // d'INERTE et on conclut a une panne la ou la page dit simplement
        // qu'elle attend une connexion ou un contenu.
        if (r.contexte) {
            L.push(`> **Etat de la page** : « ${r.contexte} »`);
            L.push('> Les controles qui suivent sont a lire dans CET etat.');
            L.push('');
        }
        if (r.absents && r.absents.length) {
            L.push('**Ressources du paquet absentes (404) — toujours un défaut :**');
            L.push('');
            for (const a of r.absents) L.push(`- \`${a}\``);
            L.push('');
        }
        if (r.tiersTotal) {
            L.push(`**${r.tiersTotal} réponse(s) 404 de sites tiers** — souvent normal `
                + '(une extension pagine jusqu’au 404 pour savoir qu’elle a fini) :');
            L.push('');
            for (const a of r.tiers) L.push(`- \`${a}\``);
            if (r.tiersTotal > r.tiers.length) L.push(`- … et ${r.tiersTotal - r.tiers.length} autre(s)`);
            L.push('');
        }
        if (r.erreurs && r.erreurs.length) {
            L.push('**Exceptions JavaScript pendant le parcours :**');
            L.push('');
            for (const e of r.erreurs) L.push(`- \`${e}\``);
            L.push('');
        }
        if (!r.controles.length) { L.push('Aucun contrôle visible.'); continue; }
        L.push('| Contrôle | Élément | Verdict |');
        L.push('|---|---|---|');
        for (const c of r.controles) {
            const v = c.verdict === 'INERTE' ? '**INERTE**' : c.verdict;
            L.push(`| ${c.libelle.replace(/\|/g, '\\|')} | \`${c.tag}\` | ${v} |`);
        }
        L.push('');
    }

    const dest = path.join(RACINE, 'docs', 'audit-controles.md');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, L.join('\n') + '\n');
    // eslint-disable-next-line no-console
    console.log('\n→ rapport écrit : docs/audit-controles.md');
}
