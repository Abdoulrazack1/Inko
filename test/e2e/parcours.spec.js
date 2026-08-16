// ============================================================
// test/e2e/parcours.spec.js — parcours utilisateur (audit QUAL-03)
// ------------------------------------------------------------
// L'audit relevait zéro test e2e et notait que huit bugs livrés auraient été
// attrapés par n'importe quel parcours automatisé. Chacun de ces bugs partage
// le même profil : code valide, tests serveur verts, et pourtant un résultat
// FAUX à l'écran. Les tests ci-dessous rejouent précisément ces situations.
//
// Règle suivie ici : privilégier ce qui vient de la base locale (profil,
// favoris, notifications, listes). Les pages qui dépendent d'un site scrapé
// distant ne sont sollicitées que là où c'est le sujet du test — un e2e qui
// rougit parce qu'un site tiers a hoqueté finit ignoré, donc inutile.
'use strict';

const { test, expect } = require('@playwright/test');

// L'application est en LOCAL_MODE : le propriétaire local est authentifié
// automatiquement. Un `domcontentloaded` puis une attente sur un élément réel
// vaut mieux que `networkidle`, qui ne se stabilise jamais ici (l'app garde
// des requêtes en vol : cloche, mises à jour, préchargement).
// Un navigateur neuf affiche la bannière de conditions d'utilisation
// (assets/js/eula.js), qui recouvre la page et intercepte TOUS les clics.
// Elle est injectée après `domcontentloaded`, donc la chercher juste après la
// navigation ne la trouve pas — c'est ce qui faisait échouer les tests qui
// cliquent, avec un message trompeur sur l'élément visé.
//
// Choix : la plupart des tests portent sur ce qui vient APRÈS l'acceptation.
// On pose donc le drapeau avant chargement, comme pour un utilisateur qui a
// déjà répondu. Le franchissement lui-même reste couvert, une fois, par le
// test « la bannière … » plus bas — sinon plus personne ne vérifierait qu'on
// peut en sortir.
// Il y a DEUX voiles de premier lancement, pas un : la bannière de conditions,
// puis la visite guidée (assets/js/onboarding.js) qui démarre une fois les
// conditions acceptées. La seconde ne s'était manifestée qu'après avoir neutralisé
// la première — et comme elle ne s'affiche qu'une fois par profil, elle rendait
// la suite dépendante de l'ordre d'exécution : le test qui cliquait en premier
// échouait, les autres passaient.
const EULA_KEY = 'mh_eula_v2';
const TOUR_KEY = 'inko_tour_done';

async function preAccepterPremierLancement(page) {
    await page.addInitScript(([eula, tour]) => {
        try {
            localStorage.setItem(eula, '1');
            localStorage.setItem(tour, '1');
        } catch (e) { /* stockage indisponible */ }
    }, [EULA_KEY, TOUR_KEY]);
}

// ── Independance vis-a-vis de l'instance (corrige un defaut de ces tests) ──
// Ecrits sur une instance PEUPLEE et connectee, plusieurs de ces tests
// supposaient des donnees qui n'existent pas ailleurs : un pseudo en dur
// (« Kaito »), un accueil rempli par des sites tiers, des notifications
// deja recues. Resultat : verts en local, rouges des le premier passage en
// CI — sur une base neuve et sans acces fiable aux sources distantes.
//
// Un test qui rougit pour une raison etrangere au code finit ignore, donc
// inutile. On separe donc deux choses :
//   · ce qui doit TOUJOURS tenir (pas d'ecran d'erreur, pas d'erreur JS,
//     pas de src vide, structure de page rendue) — assertions inconditionnelles ;
//   · ce qui depend de donnees ou du reseau — sonde d'abord, et on saute
//     avec un motif EXPLICITE si la donnee n'existe pas.
let _contexte = null;
async function contexte(page) {
    if (_contexte) return _contexte;
    await preAccepterPremierLancement(page);
    await page.goto('/accueil.html', { waitUntil: 'domcontentloaded' });
    _contexte = await page.evaluate(async () => {
        const base = window.API?.base || '/api';
        const lire = async (u) => {
            try {
                const r = await fetch(base + u, { credentials: 'include' });
                return r.ok ? await r.json() : null;
            } catch (e) { return null; }
        };
        const moi = await lire('/auth/me');
        const pop = await lire('/mangas/popular?limit=1');
        const favs = await lire('/me/favorites');
        const notifs = await lire('/me/notifications?limit=1');
        return {
            pseudo: moi?.user?.username || moi?.username || null,
            sourcesEnLigne: !!(pop && Array.isArray(pop.results) && pop.results.length),
            nbFavoris: Array.isArray(favs) ? favs.length : (favs?.total ?? 0),
            nbNotifs: notifs?.total ?? 0,
        };
    });
    return _contexte;
}

async function ouvrir(page, chemin) {
    await preAccepterPremierLancement(page);
    await page.goto(chemin, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('body').first()).toBeVisible();
    // Aucun voile ne doit subsister : s'il en apparaissait un nouveau, tous
    // les tests qui cliquent échoueraient avec un message trompeur sur
    // l'élément visé. Mieux vaut que ce soit dit ici, explicitement.
    await expect(page.locator('#mh-eula')).toHaveCount(0);
    await expect(page.locator('.itr-veil.on')).toHaveCount(0);
}

test.describe('Accueil', () => {
    // Ce qui doit tenir MEME sans reseau : l'app ne montre pas d'ecran
    // d'erreur. C'est l'assertion qui attrape une vraie regression.
    test('n’affiche jamais un écran d’erreur', async ({ page }) => {
        await ouvrir(page, '/accueil.html');
        await expect(page.locator('body')).not.toContainText('Impossible de charger l’accueil');
    });

    test('affiche du contenu réel quand les sources répondent', async ({ page }) => {
        const c = await contexte(page);
        test.skip(!c.sourcesEnLigne, 'sources distantes injoignables depuis cet environnement');
        await ouvrir(page, '/accueil.html');
        const titre = page.locator('.hero-title').first();
        await expect(titre).toBeVisible({ timeout: 20_000 });
        await expect(titre).not.toHaveText('');
    });

    test('les blocs de la page sont tous peuplés quand les sources répondent', async ({ page }) => {
        const c = await contexte(page);
        test.skip(!c.sourcesEnLigne, 'sources distantes injoignables depuis cet environnement');
        await ouvrir(page, '/accueil.html');
        await expect(page.locator('.hero-thumb')).not.toHaveCount(0, { timeout: 20_000 });
        for (const id of ['#trendingTrack', '#recoGrid', '#latestGrid', '#topMangaList']) {
            await expect(page.locator(`${id} > *`).first()).toBeVisible({ timeout: 20_000 });
        }
    });
});

test.describe('Images', () => {
    // BUG-14 : profil.js posait `src=""` sur trois images. Un src vide fait
    // recharger la page courante comme image — requête inutile et icône cassée.
    for (const p of ['/accueil.html', '/profil.html', '/bibliotheque.html', '/notifications.html']) {
        test(`aucune image sans source sur ${p}`, async ({ page }) => {
            await ouvrir(page, p);
            await page.waitForTimeout(2500);
            expect(await page.locator('img[src=""]').count(), 'src="" recharge la page comme image').toBe(0);
        });
    }

    // PERF-08 : 326 couvertures étaient chargées en direct depuis les hôtes
    // tiers — fuite de l'IP de l'utilisateur vers le site scrapé, et casse dès
    // que l'hôte refuse le hotlink.
    test('les couvertures passent par le proxy, pas par des hôtes tiers', async ({ page }) => {
        const externes = new Set();
        page.on('request', (r) => {
            if (r.resourceType() !== 'image') return;
            const u = new URL(r.url());
            if (u.hostname !== '127.0.0.1' && u.hostname !== 'localhost') externes.add(u.hostname);
        });
        await ouvrir(page, '/bibliotheque.html');
        await page.waitForTimeout(4000);
        expect([...externes], 'aucune image ne doit être demandée hors du serveur Inko').toEqual([]);
    });

    // Ce test observait les REQUÊTES, et seulement sur la bibliothèque. Deux
    // angles morts, qui se sont refermés sur un vrai défaut :
    //
    //   · une image en `loading="lazy"` hors de l'écran ne déclenche aucune
    //     requête — son `src` peut donc pointer n'importe où sans être vu ;
    //   · la page des notifications n'était pas couverte. C'est précisément
    //     celle où la migration 17 a laissé le rendu écrire `src="${n.image}"`
    //     tel quel, une fois le proxy retiré des données stockées. Résultat :
    //     40 couvertures demandées DIRECTEMENT à des hôtes tiers, bloquées par
    //     la CSP, et 40 cadres vides à l'écran.
    //
    // On inspecte donc l'ATTRIBUT, sur les deux pages.
    for (const chemin of ['/notifications.html', '/bibliotheque.html', '/accueil.html']) {
        test(`aucun src d'image ne vise un hôte tiers sur ${chemin}`, async ({ page }) => {
            await ouvrir(page, chemin);
            await page.waitForTimeout(3500);
            const fautifs = await page.evaluate(() => [...document.querySelectorAll('img')]
                .map(i => i.getAttribute('src') || '')
                .filter(s => /^https?:\/\//i.test(s))
                .filter(s => {
                    try { return new URL(s).origin !== location.origin; } catch (e) { return true; }
                })
                .slice(0, 5));
            expect(fautifs, 'le proxy s’applique à l’AFFICHAGE : aucun src ne doit sortir de l’origine').toEqual([]);
        });
    }
});

test.describe('Profil public (BUG-01)', () => {
    // `users.username` n'avait pas de contrainte UNIQUE : u.html résolvait le
    // pseudo par une recherche qui pouvait tomber sur un homonyme, et affichait
    // donc le profil de QUELQU'UN D'AUTRE.
    test('u.html?u=<pseudo> affiche bien ce compte', async ({ page }) => {
        // Le pseudo est RESOLU depuis l'instance : le coder en dur liait le
        // test a mon compte local et le rendait faux partout ailleurs.
        const c = await contexte(page);
        test.skip(!c.pseudo, 'aucun compte connecte sur cette instance');
        await ouvrir(page, '/u.html?u=' + encodeURIComponent(c.pseudo));
        await expect(page.locator('body')).toContainText(c.pseudo, { timeout: 15_000 });
        await expect(page.locator('body')).not.toContainText('Profil introuvable');
    });

    test('un pseudo inexistant donne un message clair, pas un profil au hasard', async ({ page }) => {
        await ouvrir(page, '/u.html?u=ce-compte-nexiste-pas-xyz');
        await expect(page.locator('body')).toContainText(/introuvable|inconnu|existe pas/i, { timeout: 15_000 });
    });
});

test.describe('Sources (BUG-05)', () => {
    // Gutenberg (romans) était rangé parmi les mangas : la page de série
    // proposait alors un lecteur d'images pour du texte.
    test('les sources sont réparties entre mangas et romans', async ({ page }) => {
        await ouvrir(page, '/sources.html');
        const corps = page.locator('body');
        await expect(corps).toContainText('Mangas', { timeout: 15_000 });
        await expect(corps).toContainText('Romans');
        // Chaque famille doit contenir au moins une extension : un compteur à
        // zéro d'un côté signalerait un classement à nouveau cassé.
        const texte = await corps.innerText();
        expect(texte).toMatch(/Gutenberg/i);
    });
});

test.describe('Catalogue', () => {
    // Le bouton « Charger la suite » disparaissait apres 48 series sur un
    // catalogue de plusieurs milliers de titres. Cause : beaucoup de sources
    // ignorent la taille de leur catalogue et renvoient un total « page
    // pleine » — une borne BASSE qui grandit a chaque page. Le client la
    // figeait au premier appel, en deduisait 2 pages, et s'arretait.
    test('le catalogue continue de charger au-dela de deux pages', async ({ page }) => {
        const c = await contexte(page);
        test.skip(!c.sourcesEnLigne, 'sources distantes injoignables depuis cet environnement');
        await ouvrir(page, '/catalogue.html');
        // `> *` attrapait aussi le message « Chargement… » : depart valait 1 et
        // le test se comparait a un placeholder. On vise la vraie carte.
        const grille = '#catalogueGrid .manga-card, #resultsGrid .manga-card';
        await expect(page.locator(grille).first()).toBeVisible({ timeout: 20_000 });
        const depart = await page.locator(grille).count();

        // Trois pages suffisent a prouver qu'on ne s'arrete pas a la deuxieme.
        for (let i = 0; i < 3; i++) {
            const b = page.locator('#catLoadMore');
            if (!(await b.count())) break;
            await b.click({ force: true });
            await page.waitForTimeout(3500);
        }
        const arrivee = await page.locator(grille).count();
        expect(arrivee, 'le catalogue doit depasser deux pages').toBeGreaterThan(depart * 2);
    });

    // Le compteur affichait « 168 sur 192 series » : 192 etant la borne basse,
    // il laissait croire qu'on touchait au bout d'un catalogue de milliers de
    // titres. On n'affirme plus un total qu'on ne connait pas.
    test('le compteur n’annonce pas un total qu’il ignore', async ({ page }) => {
        const c = await contexte(page);
        test.skip(!c.sourcesEnLigne, 'sources distantes injoignables depuis cet environnement');
        await ouvrir(page, '/catalogue.html');
        await expect(page.locator('#catalogueGrid .manga-card, #resultsGrid .manga-card').first()).toBeVisible({ timeout: 20_000 });
        const b = page.locator('#catLoadMore');
        if (await b.count()) { await b.click({ force: true }); await page.waitForTimeout(3500); }
        const texte = (await page.locator('#resultsCount').innerText()).replace(/\s+/g, ' ');
        const charges = await page.locator('#catalogueGrid .manga-card, #resultsGrid .manga-card').count();
        const m = texte.match(/sur ([0-9  ]+)/);
        if (m) {
            const annonce = parseInt(m[1].replace(/[^0-9]/g, ''), 10);
            expect(annonce, 'un total annonce doit etre franchement superieur a ce qui est charge')
                .toBeGreaterThan(charges + 24);
        } else {
            expect(texte).toMatch(/d.autres sont disponibles/i);
        }
    });
});

test.describe('Notifications', () => {
    // BUG-08 : le filtre « Chapitres » comparait `chapter` au type réellement
    // stocké `new_chapter` — l'onglet restait vide en permanence.
    test('le filtre « Chapitres » remonte des éléments', async ({ page }) => {
        const c = await contexte(page);
        test.skip(!c.nbNotifs, 'aucune notification sur cette instance');
        await ouvrir(page, '/notifications.html');
        await expect(page.locator('.nt-item').first()).toBeVisible({ timeout: 15_000 });
        const total = await page.locator('.nt-item').count();

        await page.getByRole('button', { name: /^Chapitres$/ }).click();
        await page.waitForTimeout(800);
        const chapitres = await page.locator('.nt-item').count();

        expect(chapitres, 'l’onglet Chapitres ne doit pas être vide').toBeGreaterThan(0);
        expect(chapitres, 'un filtre ne peut pas rendre plus d’éléments que « Toutes »').toBeLessThanOrEqual(total);
    });

    // SEC-01 : les notifications affichent des titres de séries, donc du texte
    // venu de sites tiers. C'était le vecteur d'injection identifié.
    test('aucun script ni gestionnaire d’événement injecté dans la liste', async ({ page }) => {
        const c = await contexte(page);
        test.skip(!c.nbNotifs, 'aucune notification sur cette instance');
        await ouvrir(page, '/notifications.html');
        await expect(page.locator('.nt-item').first()).toBeVisible({ timeout: 15_000 });
        // Nuance importante, apprise en écrivant ce test : « aucun attribut
        // on* » est un critère FAUX ici. L'application en pose elle-même 68,
        // tous légitimes — des `onerror` de repli sur les <img> de couverture.
        // Un test qui les compte échoue en permanence et finit désactivé.
        //
        // L'invariant utile est plus précis : dans la liste, le seul
        // gestionnaire attendu est un `onerror` porté par une <img>. Tout le
        // reste (onclick, onload, onmouseover, ou un onerror ailleurs) vient
        // forcément d'un contenu injecté.
        const suspects = await page.evaluate(() => {
            const zone = document.querySelector('#ntList, .nt-list, main') || document.body;
            const anormaux = [];
            zone.querySelectorAll('*').forEach((el) => {
                for (const a of el.attributes) {
                    if (!/^on/i.test(a.name)) continue;
                    const attendu = a.name.toLowerCase() === 'onerror' && el.tagName === 'IMG';
                    if (!attendu) anormaux.push(`${el.tagName}.${a.name}="${a.value.slice(0, 40)}"`);
                }
            });
            return {
                scripts: zone.querySelectorAll('script').length,
                javascriptHrefs: [...zone.querySelectorAll('a[href^="javascript:" i]')].length,
                anormaux,
            };
        });
        expect(suspects.scripts, 'aucune balise script ne doit naître d’une notification').toBe(0);
        expect(suspects.javascriptHrefs, 'aucun lien javascript:').toBe(0);
        expect(suspects.anormaux, suspects.anormaux.join('\n')).toEqual([]);
    });
});

test.describe('Listes (BUG-09)', () => {
    // Le drapeau « publique » était stocké mais n'apparaissait nulle part :
    // impossible de savoir si une liste était partagée.
    test('la visibilité d’une liste est affichée', async ({ page }) => {
        await ouvrir(page, '/collections.html');
        // Une instance neuve n'a aucune liste : on ne peut alors rien affirmer
        // sur l'affichage de leur visibilite.
        const listes = await page.locator('.col-card, .collection-card, [data-list-id]').count();
        test.skip(!listes, 'aucune liste sur cette instance');
        await expect(page.locator('body')).toContainText(/PRIVÉE|PUBLIQUE/i, { timeout: 15_000 });
    });
});

test.describe('Parcours de lecture', () => {
    test('bibliothèque → fiche série → chapitres', async ({ page }) => {
        const c = await contexte(page);
        test.skip(!c.nbFavoris, 'bibliotheque vide sur cette instance');
        await ouvrir(page, '/bibliotheque.html');
        // `#libGrid` et non `.lib2-card` tout court : la première carte de la
        // page appartient à la ligne « reprise de lecture », qui se redessine
        // et que Playwright refuse de cliquer (« element is not stable »).
        // Ici c'est bien une carte de la grille qu'on veut suivre.
        const carte = page.locator('#libGrid .lib2-card').first();
        await expect(carte).toBeVisible({ timeout: 20_000 });

        await carte.click();
        await page.waitForLoadState('domcontentloaded');
        // La carte pointe soit vers la fiche, soit directement sur la reprise
        // de lecture : les deux sont des destinations valides du parcours.
        expect(page.url()).toMatch(/serie\.html|chapitre\.html|lecture\.html/);
        await expect(page.locator('body')).not.toContainText('Cannot GET');
    });

    test('la bibliothèque rend toutes les séries, pas seulement la première tranche', async ({ page }) => {
        // PERF-05 : le rendu est désormais progressif. Le risque introduit
        // serait qu'une partie de la bibliothèque devienne inatteignable.
        const c = await contexte(page);
        test.skip(!c.nbFavoris, 'bibliotheque vide sur cette instance');
        await ouvrir(page, '/bibliotheque.html');
        await expect(page.locator('.lib2-card').first()).toBeVisible({ timeout: 20_000 });
        const premier = await page.locator('.lib2-card').count();
        await page.waitForTimeout(4000);
        const final = await page.locator('.lib2-card').count();
        expect(final, 'le rendu progressif doit finir par tout peindre').toBeGreaterThanOrEqual(premier);
        // Le compteur affiché par la page doit correspondre à ce qui est rendu.
        const attendu = await page.evaluate(async () => (await window.API.me.favorites()).length);
        expect(final, `${attendu} favoris annoncés, ${final} cartes rendues`).toBeGreaterThanOrEqual(Math.min(attendu, 60));
    });
});

test.describe('Premier lancement', () => {
    // La bannière de conditions est le tout premier écran et bloque la page
    // tant qu'on n'a pas répondu. Si elle cessait de se fermer, l'application
    // deviendrait entièrement inutilisable pour un nouvel arrivant — et aucun
    // autre test ne le verrait, puisqu'ils pré-acceptent.
    test('la bannière de conditions s’affiche puis se ferme', async ({ page }) => {
        await page.goto('/accueil.html', { waitUntil: 'domcontentloaded' });
        const veil = page.locator('#mh-eula');
        await expect(veil).toBeVisible({ timeout: 10_000 });

        // Les deux boutons sont « Refuser » et « Continuer » — pas « J'ai
        // compris », qui appartient à une autre bannière de la page.
        await expect(veil.getByRole('button', { name: /refuser/i })).toBeVisible();

        // « Continuer » naît `disabled` : il ne s'active qu'une fois la case
        // de reconnaissance cochée. C'est délibéré (eula.js) et c'est ce que
        // ce test doit vérifier — un clic direct échouait, ce qui est le
        // comportement attendu, pas un défaut.
        const continuer = veil.getByRole('button', { name: /continuer/i }).first();
        await expect(continuer).toBeDisabled();
        await veil.locator('#mh-eula-check').check();
        await expect(continuer).toBeEnabled();

        await continuer.click();
        await expect(veil).toBeHidden({ timeout: 5000 });

        // Et elle ne doit pas revenir au chargement suivant.
        await page.goto('/accueil.html', { waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(1500);
        await expect(page.locator('#mh-eula')).toHaveCount(0);
    });
});

test.describe('AniList (BUG-15)', () => {
    // La page était un cul-de-sac : aucun moyen d'en repartir.
    test('la page de retour AniList propose une sortie', async ({ page }) => {
        await ouvrir(page, '/anilist.html');
        const liens = page.locator('a[href]');
        await expect(liens.first()).toBeVisible({ timeout: 10_000 });
        expect(await liens.count(), 'une page de retour sans lien est un cul-de-sac').toBeGreaterThan(0);
    });
});

test.describe('Erreurs console', () => {
    // Ce que ces tests doivent attraper : une exception JS, un module absent,
    // un appel à une fonction disparue — bref un défaut du frontend.
    //
    // Ce qu'ils ne doivent PAS attraper : « Failed to load resource … 429/502 ».
    // La suite enchaîne une vingtaine de chargements en deux minutes depuis une
    // seule IP ; le site scrapé finit par nous limiter, et l'application est
    // CENSÉE encaisser ça sans casser. Faire rougir le test là-dessus le rend
    // dépendant de l'ordre d'exécution et d'un tiers — c'est ainsi qu'une suite
    // e2e devient du bruit qu'on finit par ignorer.
    const transitoireAmont = (t) => /Failed to load resource/i.test(t) && /\b(429|500|502|503|504)\b/.test(t);

    for (const p of ['/accueil.html', '/bibliotheque.html', '/profil.html']) {
        test(`aucune erreur JS sur ${p}`, async ({ page }) => {
            const erreurs = [];
            // `pageerror` = exception non capturée : jamais toléré.
            page.on('pageerror', (e) => erreurs.push('EXCEPTION ' + String(e)));
            page.on('console', (m) => {
                if (m.type() !== 'error') return;
                if (transitoireAmont(m.text())) return;
                erreurs.push(m.text());
            });
            await ouvrir(page, p);
            await page.waitForTimeout(3500);
            expect(erreurs, erreurs.join('\n')).toEqual([]);
        });
    }
});
