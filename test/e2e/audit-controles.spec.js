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
// On photographie l'état avant, on actionne, on attend, on recompare. La
// signature couvre l'URL, le nombre de nœuds, une EMPREINTE du texte, une
// empreinte de toutes les classes du document, les boîtes de dialogue
// ouvertes, l'élément qui a le focus et la position de défilement. Chacun de
// ces sept points a été ajouté parce que son absence produisait de faux
// « INERTE » sur des contrôles qui marchaient — le détail est en commentaire
// au-dessus de chacun.
//
//   · NAVIGUE          — l'URL a changé : on revient en arrière ;
//   · AGIT             — le DOM, les classes, le focus ou le défilement ont
//                        changé : panneau ouvert, liste filtrée, bascule ;
//   · OUVRE UN ONGLET  — `target="_blank"` : la page courante ne bouge pas,
//                        et c'est normal. Non actionné, verdict certain ;
//   · INERTE           — rien n'a bougé. C'est un constat, PAS une
//                        condamnation : un bouton peut légitimement ne rien
//                        faire dans cet état (« Marquer lu » sans chapitre
//                        chargé). Le rapport le signale, un humain tranche.
//
// Un contrôle qui semble inerte est mesuré UNE SECONDE FOIS, 1,1 s plus tard,
// avant de conclure : sans cela le même lien de pied de page ressortait
// NAVIGUE sur une page et INERTE sur la suivante, au gré du réseau.
//
// ── Deux passes, et c'est là tout l'intérêt ─────────────────
//
// Le paquet est audité sans hub ni compte, puis via le hub, connecté. Inerte
// dans le seul mode autonome = dépendance au serveur. Inerte dans les DEUX =
// défaut. Sans cette comparaison, « inerte » ne voulait rien dire de
// décidable, et il fallait rouvrir chaque page à la main pour trancher.
//
// ── Ce qu'on n'actionne PAS ─────────────────────────────────
//
// Tout ce dont le libellé annonce une perte : supprimer, effacer, vider,
// réinitialiser, déconnexion, révoquer. Un audit ne doit pas détruire l'état
// qu'il mesure — et sur un vrai appareil, il détruirait celui de l'utilisateur.
//
// ── Ce que cet audit COÛTE, et à qui ────────────────────────
//
// La passe « hub » fait scraper de vraies sources : vingt-trois pages, près de
// mille contrôles actionnés. WeebCentral a fini par répondre 504 « source
// momentanément limitée ». Ce n'est pas gratuit pour les sites en face — à
// lancer quand on en a besoin, pas en boucle.
'use strict';

const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const http = require('http');

const RACINE = path.join(__dirname, '..', '..');
const PAQUET = path.join(RACINE, 'mobile', 'www');
const PORT = 8612;
let BASE_STATIQUE = 'http://127.0.0.1:' + PORT;   // reaffectee si le port est pris
// L'adresse du hub de developpement. `.claude/launch.json` et le serveur
// s'accordent sur 8088.
const BASE_HUB = process.env.INKO_HUB_AUDIT || 'http://127.0.0.1:8088';
// `BASE` designe le mode en cours d'audit. Les deux passes partagent tout le
// reste du code : c'est la seule chose qui les distingue.
let BASE = BASE_STATIQUE;

const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};
/**
 * Sert le paquet mobile.
 *
 * Le port est CHERCHE, pas impose : un audit interrompu laisse son serveur en
 * vie quelques secondes, et le suivant echouait alors sur EADDRINUSE — sans
 * rien auditer, pour une raison qui n'a rien a voir avec l'application. On
 * essaie les ports suivants plutot que d'abandonner.
 */
function servir(port = PORT, restants = 12) {
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
            if (e.code === 'EADDRINUSE' && restants > 0) {

                console.log(`  port ${port} occupé — essai sur ${port + 1}`);
                servir(port + 1, restants - 1).then(ok, ko);
            } else ko(e);
        });
        s.listen(port, () => { BASE_STATIQUE = 'http://127.0.0.1:' + port; ok(s); });
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
    // Une EMPREINTE du texte, pas sa longueur.
    //
    // On comparait `…​.length`. Filtrer le catalogue sur « Shonen » remplace
    // vingt-quatre titres par vingt-quatre autres : le nombre de noeuds ne
    // bouge pas, et la longueur totale varie de quelques caracteres — sous le
    // seuil. Sept filtres qui MARCHENT (verifie a la main dans le navigateur :
    // la liste change bien) etaient donc declares INERTE, en tete de la liste
    // « a corriger ». Un faux negatif d'outil coute plus cher qu'un faux
    // positif : il envoie reparer ce qui n'est pas casse.
    texte: (() => {
        const t = (document.body.innerText || '').replace(/\s+/g, ' ').slice(0, 8000);
        let h = 0;
        for (let i = 0; i < t.length; i++) { h = (h * 31 + t.charCodeAt(i)) | 0; }
        return h;
    })(),
    dialogues: document.querySelectorAll('dialog[open],.mh-feuille,.mh-modal,[role=dialog]').length,
    // L'empreinte de TOUTES les classes du document, pas seulement celles du
    // `body`. La bascule grille/liste du catalogue pose `list-view` sur la
    // GRILLE : le body ne bouge pas, le nombre de noeuds non plus, le texte non
    // plus — et un controle qui change toute la mise en page passait pour
    // inerte. Verifie a la main : `results-grid` devient
    // `results-grid list-view`. Tout etat rendu par une classe (onglet actif,
    // panneau ouvert, element selectionne) entre desormais dans la mesure.
    classes: (() => {
        let h = 0;
        const els = document.querySelectorAll('[class]');
        for (let i = 0; i < els.length; i++) {
            const c = els[i].getAttribute('class') || '';
            for (let j = 0; j < c.length; j++) { h = (h * 31 + c.charCodeAt(j)) | 0; }
        }
        return h;
    })(),
    // Deux effets que la comparaison OUBLIAIT, alors qu'ils etaient releves ici.
    //
    // `focus` etait deja dans la signature, et la comparaison ne le lisait pas.
    // Le lien d'evitement « Aller au contenu » deplace le focus vers <main> —
    // c'est TOUT ce qu'il doit faire — sans toucher a l'URL, aux noeuds ni au
    // texte. Il ressortait donc INERTE sur les vingt-trois pages : le premier
    // controle de chaque page, celui que rencontre un lecteur d'ecran, accuse
    // a tort. Verifie dans le navigateur : le focus passe bien de BODY a MAIN.
    focus: document.activeElement
        ? document.activeElement.tagName + '#' + (document.activeElement.id || '')
        : '',
    // Meme famille : « remonter en haut », les ancres, le defilement vers un
    // chapitre. Rien ne bouge dans le DOM, et la page a pourtant reagi.
    defilement: Math.round(window.scrollY),
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
            // Un nom accessible qui ne contient AUCUNE lettre ni chiffre n'en
            // est pas un : un lecteur d'ecran annonce alors « guillemet simple
            // gauche » pour ‹ , « croix de multiplication » pour ✕. Le
            // controle existe, il est atteignable au clavier, et personne ne
            // peut savoir ce qu'il fait sans le voir. Le releve statique du
            // HTML ne suffisait pas : la moitie de ces boutons est fabriquee
            // en JavaScript.
            const nomUtile = /[\p{L}\p{N}]{2,}/u.test(libelle);
            out.push({
                ref,
                libelle,
                sansNom: !nomUtile,
                tag: e.tagName.toLowerCase() + (e.id ? '#' + e.id : ''),
                href: e.getAttribute('href') || null,
                // Un lien `target="_blank"` ouvre un ONGLET : la page courante
                // ne bouge pas d'un pixel, et l'audit le declarait donc INERTE.
                // « Code source », « Signaler un bug », « Versions » et
                // « Licence » remontaient ainsi sur presque chaque page —
                // une trentaine de faux inertes pour quatre liens qui
                // marchent parfaitement.
                nouvelOnglet: e.getAttribute('target') === '_blank',
                destructif: DESTRUCTIF.test(libelle),
            });
        });
    return out;
};

/** Le hub de developpement repond-il ? Sinon la seconde passe est sautee. */
async function hubJoignable() {
    return new Promise((ok) => {
        const q = http.get(BASE_HUB + '/api/health', (r) => { r.resume(); ok(r.statusCode < 500); });
        q.on('error', () => ok(false));
        q.setTimeout(2500, () => { q.destroy(); ok(false); });
    });
}

// ── Deux passes, et c'est tout l'interet ────────────────────
//
// Une seule passe ne pouvait pas conclure. Sur le paquet autonome, sans hub et
// sans compte, « Actualiser les notifications » ne fait rien — et c'est
// NORMAL. Rien ne distinguait ce cas d'un bouton reellement debranche, alors
// le rapport listait les deux cote a cote et il fallait ouvrir chaque page a
// la main pour trancher.
//
// On audite donc le meme paquet deux fois :
//   · `autonome` — serveur statique, aucun hub, aucun compte ;
//   · `hub`      — le vrai serveur, qui connecte tout seul en boucle locale
//                  (`POST /auth/local`), donc AVEC compte et AVEC sources.
//
// Un controle inerte dans les DEUX modes n'a plus d'excuse : c'est un defaut.
// Inerte dans le seul mode autonome, c'est une dependance au hub — a rendre
// visible a l'utilisateur, pas a corriger dans le bouton.
async function auditerMode(browser, MODE) {
        BASE = MODE.base;
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
            let connecte = null;
            try { connecte = !!(window.API && window.API.isLoggedIn && window.API.isLoggedIn()); } catch (e) { connecte = null; }
            const g = document.querySelector('.empty-state,.lib2-empty,.lists-empty,.cd-guard,.guard,[data-guard]');
            const t = g && (g.innerText || '').replace(/[\s ]+/g, ' ').trim();
            return {
                connecte,
                autonome: !!window.INKO_AUTONOME,
                garde: t ? t.slice(0, 140) : null,
            };
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
            //
            // Troisieme cas, decouvert en lisant le rapport : un 404 de
            // l'API n'est pas une ressource manquante, c'est une REPONSE.
            // `/api/users/profile/demo` rend 404 parce qu'aucun compte ne
            // s'appelle « demo », et la page affiche proprement « Profil
            // introuvable ». Le compter comme un actif absent envoyait
            // chercher un fichier qui n'a jamais existe.
            const absentsInternes = [];
            const absentsApi = [];
            const absentsExternes = [];
            const onRep = (r) => {
                if (r.status() !== 404) return;
                const u = r.url();
                if (!u.startsWith(BASE)) {
                    absentsExternes.push(u.replace(/^https?:\/\//, '').slice(0, 90));
                    return;
                }
                const chemin = u.replace(BASE, '');
                if (/^\/api\//.test(chemin)) absentsApi.push(chemin.slice(0, 90));
                else absentsInternes.push(chemin);
            };
            page.on('response', onRep);

            let controles = [];
            let contexte = null;
            try {
                // 45 s, et non 20. Via le hub, `serie.html?id=…` fait scraper
                // la source AVANT de rendre la page. Quand le site en face
                // ralentit — et il ralentit d'autant plus que c'est justement
                // cet audit qui le sollicite page après page — vingt secondes
                // ne suffisent plus. Dix pages sur vingt-trois ont ainsi été
                // sautées d'un seul coup, dont les trois du lecteur.
                await page.goto(urlDe(P), { waitUntil: 'domcontentloaded', timeout: 45000 });
                await page.waitForTimeout(2200);
                contexte = await page.evaluate(CONTEXTE);
                controles = await page.evaluate(LISTER, { DESTRUCTIF_SRC: DESTRUCTIF.source });
            } catch (e) {
                const raison = e.message.split('\n')[0].slice(0, 120);
                resultats.push({ slug, erreurNav: raison, controles: [] });
                page.off('pageerror', onErr); page.off('response', onRep);
                // Une page sautée doit se VOIR pendant l'exécution. Elle ne
                // remontait que dans le rapport : le journal passait de
                // `bibliotheque` à `parametres` sans un mot, et on croyait
                // l'audit complet.

                console.log(`  ${slug.padEnd(18)} ⚠ page non auditée — ${raison}`);
                continue;
            }

            const verdicts = [];
            for (const c of controles) {
                if (c.destructif) { verdicts.push({ ...c, verdict: 'ÉVITÉ (destructif)' }); continue; }
                // On ne l'actionne pas : ouvrir vingt onglets vers GitHub
                // ralentirait l'audit sans rien apprendre. Le verdict se lit
                // dans le balisage, et il est certain.
                if (c.nouvelOnglet) { verdicts.push({ ...c, verdict: 'OUVRE UN ONGLET' }); continue; }
                let verdict = 'INERTE';
                try {
                    const avant = await page.evaluate(SIGNATURE);
                    const cible = page.locator(`[data-audit="${c.ref}"]`).first();
                    if (!(await cible.count())) { verdicts.push({ ...c, verdict: 'DISPARU' }); continue; }
                    await cible.click({ timeout: 2500, force: true, noWaitAfter: true });
                    await page.waitForTimeout(700);
                    let apres = await page.evaluate(SIGNATURE);

                    // Un SECOND regard avant de conclure a l'inertie.
                    //
                    // `noWaitAfter` n'attend aucune navigation : 700 ms
                    // suffisaient d'habitude, pas toujours. Le meme lien de
                    // pied de page — « Catalogue », « Nouveautes », « Top » —
                    // ressortait NAVIGUE sur une page et INERTE sur la
                    // suivante, sans rien qui les distingue. Ce n'etait pas un
                    // defaut, c'etait la mesure qui arrivait trop tot, et elle
                    // salissait le rapport de constats non reproductibles.
                    //
                    // On ne paie ce delai que sur les candidats a l'inertie :
                    // tout ce qui a deja bouge est conclu du premier coup.
                    const inchange = apres.url === avant.url
                        && apres.dialogues === avant.dialogues
                        && apres.classes === avant.classes
                        && apres.focus === avant.focus
                        && Math.abs(apres.noeuds - avant.noeuds) <= 2
                        && apres.texte === avant.texte
                        && Math.abs(apres.defilement - avant.defilement) <= 24;
                    if (inchange) {
                        await page.waitForTimeout(1100);
                        apres = await page.evaluate(SIGNATURE);
                    }

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
                        || apres.texte !== avant.texte
                        || apres.classes !== avant.classes) {
                        verdict = 'AGIT (page modifiée)';
                    } else if (apres.focus !== avant.focus) {
                        verdict = 'AGIT (focus déplacé)';
                    } else if (Math.abs(apres.defilement - avant.defilement) > 24) {
                        verdict = 'AGIT (défilement)';
                    }
                } catch (e) {
                    verdict = 'ERREUR : ' + String(e.message).split('\n')[0].slice(0, 60);
                }
                verdicts.push({ ...c, verdict });
            }

            page.off('pageerror', onErr); page.off('response', onRep);
            const inertes = verdicts.filter((v) => v.verdict === 'INERTE').length;
            const manquants = [...new Set(absentsInternes)].slice(0, 10);
            const api404 = [...new Set(absentsApi)];
            const tiers = [...new Set(absentsExternes)];
            resultats.push({
                slug, contexte, controles: verdicts,
                erreurs: [...new Set(erreurs)].slice(0, 4),
                absents: manquants,
                api404: api404.slice(0, 6),
                api404Total: api404.length,
                tiers: tiers.slice(0, 6),
                tiersTotal: tiers.length,
                url: urlDe(P).replace(BASE, ''),
            });

            console.log(`  ${slug.padEnd(18)} ${verdicts.length} contrôles · ${inertes} inertes`
                + (erreurs.length ? ` · ${erreurs.length} erreur(s) JS` : '')
                + (manquants.length ? ` · ${manquants.length} ACTIF 404` : '')
                + (api404.length ? ` · ${api404.length} api 404` : '')
                + (tiers.length ? ` · ${tiers.length} 404 tiers` : ''));
        }

        await ctx.close();
        return resultats;
}

// Pas de trace, pas de vidéo pour cet audit.
//
// `retain-on-failure` convient à un test de quelques secondes. Ici on actionne
// près de mille cinq cents contrôles sur vingt et une minutes : Playwright a
// fini par rendre `file data stream has unexpected number of bytes`, puis une
// archive tronquée (« End of central directory record signature not found »).
// L'échec est survenu APRÈS la dernière page — toutes les mesures étaient
// faites, et vingt et une minutes de travail sont parties avec, parce que le
// rapport s'écrivait à la toute fin. (Il s'écrit désormais dans un `finally`.)
//
// Cet audit produit son PROPRE rapport ; la trace ne servait à personne.
// `test.use` doit rester au niveau du FICHIER : dans un `describe`, Playwright
// refuse `video`, qui l'obligerait à changer de worker.
test.use({ trace: 'off', video: 'off' });

test.describe('Audit fonctionnel — chaque contrôle, en autonome et via le hub', () => {
    test('actionner chaque contrôle et voir s’il produit un effet', async ({ browser }) => {
        test.setTimeout(50 * 60 * 1000);
        if (!fs.existsSync(PAQUET)) test.skip(true, 'paquet mobile absent');
        const serveur = await servir();

        // Apres `servir()` : BASE_STATIQUE porte le port reellement obtenu.
        const modes = [{ nom: 'autonome', base: BASE_STATIQUE }];
        if (await hubJoignable()) modes.push({ nom: 'hub', base: BASE_HUB });
        else {

            console.log(`  ⚠ hub injoignable sur ${BASE_HUB} — passe « hub » sautée.`);

            console.log('    Sans elle, « inerte » ne veut dire que « inerte SANS hub ni compte ».');
        }

        // Le rapport s'écrit dans un `finally` : ce qui a été mesuré est écrit,
        // même si la suite échoue. Une panne d'outillage survenue après la
        // dernière page a déjà emporté vingt et une minutes de relevés.
        const parMode = [];
        try {
            for (const MODE of modes) {
                console.log(`\n── mode ${MODE.nom} (${MODE.base}) ──`);
                parMode.push({ mode: MODE.nom, base: MODE.base, resultats: await auditerMode(browser, MODE) });
            }
        } finally {
            await new Promise((ok) => serveur.close(ok));
            if (parMode.length) ecrire(parMode);
        }
        expect(parMode[0].resultats.length).toBe(PAGES.length);
    });
});

function ecrire(parMode) {
    const L = [];
    const jour = new Date().toISOString().slice(0, 10);
    L.push('# Audit fonctionnel — chaque contrôle, dans les deux modes');
    L.push('');
    L.push(`Relevé du ${jour}. Chaque bouton, lien et bascule a été **actionné**,`);
    L.push('et l’état de la page comparé avant/après.');
    L.push('');
    L.push('| Verdict | Sens |');
    L.push('|---|---|');
    L.push('| `NAVIGUE` | l’URL a changé — le contrôle fonctionne |');
    L.push('| `AGIT` | le DOM a changé — panneau ouvert, liste filtrée, bascule |');
    L.push('| `OUVRE UN ONGLET` | `target="_blank"` : la page courante ne bouge pas, c’est normal |');
    L.push('| `AGIT (focus déplacé)` | le focus a changé de cible — un lien d’évitement, une ancre |');
    L.push('| `AGIT (défilement)` | la page a défilé |');
    L.push('| `INERTE` | **rien n’a bougé** — à examiner |');
    L.push('| `ÉVITÉ` | libellé destructif : non actionné, par précaution |');
    L.push('');
    for (const m of parMode) L.push(`- **${m.mode}** — \`${m.base}\``);
    L.push('');

    // ── Ce qui ne s'explique par aucun contexte ──────────────
    //
    // La seule liste sur laquelle agir sans rien reverifier : un controle
    // inerte AVEC hub et AVEC compte comme sans.
    const cle = (page, c) => page + '|' + c.tag + '|' + c.libelle;
    const inertesDe = (m) => {
        const set = new Map();
        for (const r of m.resultats) {
            for (const c of r.controles || []) {
                if (c.verdict === 'INERTE') set.set(cle(r.slug, c), { page: r.slug, ...c });
            }
        }
        return set;
    };
    const parModeInertes = parMode.map(inertesDe);
    let communs = [];
    if (parModeInertes.length > 1) {
        const [a, ...reste] = parModeInertes;
        communs = [...a.entries()].filter(([k]) => reste.every((m) => m.has(k))).map(([, v]) => v);
    } else if (parModeInertes.length === 1) {
        communs = [...parModeInertes[0].values()];
    }

    // ── Les controles qu'on ne peut pas nommer ──────────────
    const anonymes = new Map();
    for (const m of parMode) {
        for (const r of m.resultats) {
            for (const c of r.controles || []) {
                if (c.sansNom) anonymes.set(r.slug + '|' + c.tag + '|' + c.libelle, { page: r.slug, ...c });
            }
        }
    }
    L.push('## Sans nom accessible — un lecteur d’écran annonce le pictogramme');
    L.push('');
    L.push('Ni texte, ni `aria-label`, ni `title` : le contrôle est atteignable au');
    L.push('clavier et reste indéchiffrable sans le voir.');
    L.push('');
    if (!anonymes.size) L.push('_Aucun._');
    else {
        L.push('| Page | Ce qui est annoncé | Élément |');
        L.push('|---|---|---|');
        for (const c of anonymes.values()) {
            L.push(`| \`${c.page}\` | \`${c.libelle.replace(/\|/g, '\|')}\` | \`${c.tag}\` |`);
        }
    }
    L.push('');

    L.push('## À corriger — inerte dans TOUS les modes audités');
    L.push('');
    if (parModeInertes.length < 2) {
        L.push('> ⚠ Un seul mode audité : cette liste vaut « inerte SANS hub ni compte ».');
        L.push('> Démarre le hub et relance pour distinguer un vrai défaut d’une dépendance au serveur.');
        L.push('');
    }
    if (!communs.length) { L.push('_Aucun._'); }
    else {
        L.push(`**${communs.length} contrôle(s)** ne réagissent ni en autonome, ni via le hub.`);
        L.push('');
        L.push('| Page | Contrôle | Élément |');
        L.push('|---|---|---|');
        for (const c of communs) L.push(`| \`${c.page}\` | ${c.libelle.replace(/\|/g, '\\|')} | \`${c.tag}\` |`);
    }
    L.push('');

    // ── Ce qui depend du hub ou du compte ────────────────────
    if (parModeInertes.length > 1) {
        const seulAutonome = [...parModeInertes[0].entries()]
            .filter(([k]) => !parModeInertes[1].has(k)).map(([, v]) => v);
        L.push('## Dépend du hub ou d’un compte — inerte en autonome seulement');
        L.push('');
        L.push('Ces contrôles fonctionnent une fois le serveur joignable. Le défaut, s’il y');
        L.push('en a un, n’est pas dans le bouton : c’est que **rien ne dit à l’utilisateur**');
        L.push('pourquoi il ne se passe rien.');
        L.push('');
        if (!seulAutonome.length) { L.push('_Aucun._'); }
        else {
            L.push('| Page | Contrôle | Élément |');
            L.push('|---|---|---|');
            for (const c of seulAutonome) L.push(`| \`${c.page}\` | ${c.libelle.replace(/\|/g, '\\|')} | \`${c.tag}\` |`);
        }
        L.push('');
    }

    for (const m of parMode) {
        L.push('---');
        L.push('');
        L.push(`# Mode « ${m.mode} » — \`${m.base}\``);
        L.push('');
        L.push('| Page | Contrôles | Naviguent | Agissent | Onglet | **Inertes** | Erreurs JS | Actif 404 | API 404 | 404 tiers |');
        L.push('|---|---|---|---|---|---|---|---|---|---|');
        let totalInertes = 0;
        let totalSautees = 0;
        for (const r of m.resultats) {
            if (r.erreurNav) {
                totalSautees++;
                L.push(`| ${r.slug} | — | — | — | — | — | **non auditée : ${r.erreurNav}** | — | — | — |`);
                continue;
            }
            const n = (f) => r.controles.filter((c) => c.verdict.startsWith(f)).length;
            totalInertes += n('INERTE');
            L.push(`| ${r.slug} | ${r.controles.length} | ${n('NAVIGUE')} | ${n('AGIT')} | ${n('OUVRE')} `
                + `| **${n('INERTE')}** | ${(r.erreurs || []).length} | ${(r.absents || []).length} `
                + `| ${r.api404Total || 0} | ${r.tiersTotal || 0} |`);
        }
        if (totalSautees) {
            L.push('');
            L.push(`> ⚠ **${totalSautees} page(s) n’ont pas été auditées** dans ce mode : leurs`);
            L.push('> contrôles ne sont ni confirmés ni infirmés. Les compter comme « rien à');
            L.push('> signaler » serait la pire lecture possible de ce tableau.');
        }
        L.push('');
        L.push(`**${totalInertes} contrôles inertes** dans ce mode.`);
        L.push('');

        for (const r of m.resultats) {
            L.push('');
            L.push(`## \`${r.slug}.html\``);
            L.push('');
            if (r.url) { L.push(`URL auditée : \`${r.url}\``); L.push(''); }
            if (r.erreurNav) { L.push(`**Page non chargée** : ${r.erreurNav}`); continue; }
            const cx = r.contexte;
            if (cx) {
                const etat = [];
                if (cx.connecte === true) etat.push('**connecté**');
                else if (cx.connecte === false) etat.push('**non connecté**');
                if (cx.autonome) etat.push('mode autonome (aucun hub)');
                if (etat.length) L.push(`> État : ${etat.join(' · ')}`);
                if (cx.garde) L.push(`> La page affiche : « ${cx.garde} »`);
                if (etat.length || cx.garde) {
                    L.push('> Les verdicts qui suivent se lisent dans CET état.');
                    L.push('');
                }
            }
            if (r.absents && r.absents.length) {
                L.push('**Ressources du paquet absentes (404) — toujours un défaut :**');
                L.push('');
                for (const a of r.absents) L.push(`- \`${a}\``);
                L.push('');
            }
            if (r.api404Total) {
                L.push(`**${r.api404Total} réponse(s) 404 de l’API** — souvent la bonne réponse `
                    + '(« ce compte n’existe pas ») ; à lire avec ce que la page affiche alors :');
                L.push('');
                for (const a of r.api404) L.push(`- \`${a}\``);
                if (r.api404Total > r.api404.length) L.push(`- … et ${r.api404Total - r.api404.length} autre(s)`);
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
    }

    const dest = path.join(RACINE, 'docs', 'audit-controles.md');
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, L.join('\n') + '\n');

    console.log('\n→ rapport écrit : docs/audit-controles.md');

    console.log(`  ${communs.length} contrôle(s) inerte(s) dans TOUS les modes — c'est la liste à traiter.`);
}
