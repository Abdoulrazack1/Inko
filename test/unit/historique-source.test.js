// ============================================================
// test/unit/historique-source.test.js — filtrer l'historique par source
// ------------------------------------------------------------
// L'historique se filtrait par type, par genre, par moment de la journée et
// par période. Pas par SOURCE — alors que c'est le seul filtre qui répond à
// « où ai-je lu ça », la question qu'on se pose quand une source tombe ou
// qu'on hésite entre deux traductions.
//
// En posant la quatrième pastille, un défaut plus grave est apparu, et il
// n'avait rien à voir avec la source :
//
//     initTabs();
//     await Promise.all([ ...treize sections... ]);
//     initHistoryFilters();          <-- ici
//
// Les filtres ne dépendent que du balisage, mais ils étaient câblés APRÈS
// l'attente. Observé dans le navigateur : un 504 sur un seul panneau, la
// frise affichée normalement, et les quatre pastilles inertes neuf secondes
// plus tard — sans un mot. `Promise.all` aggravait le cas : une section qui
// rejette emportait aussi le câblage des actions destructrices.
//
// Vérifié dans le navigateur après correction, sur l'historique réel :
//
//     période « cette année »   12 lectures, 2 sources
//     menu Source               « Weeb Central · 10 », « MangaDex · 2 »
//     choix MangaDex            2 lignes, pastille « Source : MangaDex »
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'assets', 'js', 'profil.js'), 'utf8');

// Le balisage que les filtres exigent — celui de profil.html, réduit.
const PAGE = `<!doctype html><html><body>
<div class="history-quick-filters">
  <button class="hqf-btn active">Derniers 7 jours</button>
  <button class="hqf-btn">30 jours</button>
  <button class="hqf-btn">Cette année</button>
</div>
<div class="history-search-bar"><input type="text"></div>
<div class="history-filter-pills">
  <button class="tag">Type de contenu</button>
  <button class="tag">Genres</button>
  <button class="tag">Moment de lecture</button>
  <button class="tag">Source</button>
</div>
<div class="history-timeline-header"><button class="sort-btn">Trier</button></div>
<div id="historyTimeline"></div>
</body></html>`;

/** Une promesse qui ne se résout jamais : une section restée en vol. */
const enVol = () => new Promise(() => {});

/** Un objet dont tout appel, à n'importe quelle profondeur, reste en vol. */
function toutEnVol() {
    const creuser = () => new Proxy(function () {}, {
        get: (c, k) => (k === 'then' || typeof k === 'symbol' ? undefined : creuser()),
        apply: () => enVol(),
    });
    return creuser();
}

async function charger({ events, progress, favorites } = {}) {
    const dom = new JSDOM(PAGE, { url: 'http://localhost/profil.html', runScripts: 'outside-only' });
    const w = dom.window;
    const toasts = [];
    w.MH = {
        initPage() {}, err() {}, toast(t) { toasts.push(t); },
        esc: (s) => String(s ?? ''), fmt: (n) => String(n),
        sourceName: (id) => ({ weebcentral: 'Weeb Central', mangadex: 'MangaDex' }[id] || id),
        isNovelSource: () => false,
    };
    const me = toutEnVol();
    w.API = {
        ready: Promise.resolve(),
        isLoggedIn: () => true,
        sources: toutEnVol(),
        me: new Proxy(me, {
            get: (c, k) => {
                if (k === 'events' && events) return () => Promise.resolve(events);
                if (k === 'progress' && progress) return () => Promise.resolve(progress);
                if (k === 'favorites') return () => Promise.resolve(favorites || []);
                return me[k];
            },
        }),
    };
    w.eval(SRC);
    w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
    // Deux tours : le module attend `API.ready` avant de câbler quoi que ce soit.
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const pastilles = () => [...w.document.querySelectorAll('.history-filter-pills .tag')];
    return {
        w, toasts, pastilles,
        source: () => pastilles()[3],
        menu: () => [...w.document.querySelectorAll('.histo-menu .histo-menu-item')]
            .map((b) => b.textContent),
    };
}

test('une section restée en vol ne doit plus laisser les filtres morts', async () => {
    // AUCUN appel ne se résout ici : c'est le cas observé, un panneau qui
    // traîne pendant que la page, elle, est à l'écran et répond.
    const p = await charger();
    const etats = p.pastilles().map((b) => b.dataset.wired || 'non');
    assert.deepEqual(etats, ['1', '1', '1', '1'],
        'les quatre pastilles doivent être câblées sans attendre les données');
});

test('la quatrième pastille existe et s’annonce comme un menu', async () => {
    const p = await charger();
    const s = p.source();
    assert.ok(s, 'la pastille Source doit exister');
    assert.equal(s.getAttribute('aria-haspopup'), 'menu',
        'elle ouvre un menu : il faut le dire avant de cliquer');
    assert.equal(s.textContent, 'Source', 'au repos, elle porte son nom');
});

test('sans lecture connue, la pastille le dit au lieu d’ouvrir un menu vide', async () => {
    const p = await charger();
    p.source().click();
    assert.deepEqual(p.menu(), [], 'aucun menu ne doit s’ouvrir');
    assert.match(p.toasts.join(' '), /Aucune source connue/,
        'un menu vide n’apprend rien ; un message, si');
});

// ── Le filtre lui-même ──
const JOUR = 86400000;
const LECTURES = [
    { type: 'read', at: new Date(Date.now() - 1 * JOUR).toISOString(), mangaId: 'a', source: 'weebcentral' },
    { type: 'read', at: new Date(Date.now() - 2 * JOUR).toISOString(), mangaId: 'a', source: 'weebcentral' },
    { type: 'read', at: new Date(Date.now() - 3 * JOUR).toISOString(), mangaId: 'b', source: 'mangadex' },
    { type: 'favorite', at: new Date(Date.now() - 1 * JOUR).toISOString(), mangaId: 'c', source: 'mangadex' },
];

// Les œuvres telles que les renvoie /me/favorites : c'est de là que
// `sourceDe` tire la source quand la progression ne la porte pas.
const FAVORIS = [
    { id: 'a', title: 'Une série', source: 'weebcentral' },
    { id: 'b', title: 'Une autre', source: 'mangadex' },
    { id: 'c', title: 'Jamais lue', source: 'mangadex' },
];

test('le menu ne propose que les sources réellement lues, avec leur compte', async () => {
    const p = await charger({ events: LECTURES, progress: {}, favorites: FAVORIS });
    await new Promise((r) => setTimeout(r, 0));
    p.source().click();
    const items = p.menu();
    assert.deepEqual(items, ['Toutes les sources', 'Weeb Central · 2', 'MangaDex · 1'],
        'triées par nombre de lectures, le nom humain et non l’identifiant');
    // L'événement « favorite » de mangadex ne doit PAS être compté : la
    // pastille filtre des LECTURES, et promettre 2 pour n'en montrer qu'une
    // ferait douter du filtre, pas de la donnée.
    assert.ok(!items.some((t) => /MangaDex . 2/.test(t)),
        'seuls les événements de lecture comptent');
});

test('choisir une source la nomme dans la pastille', async () => {
    const p = await charger({ events: LECTURES, progress: {}, favorites: FAVORIS });
    await new Promise((r) => setTimeout(r, 0));
    p.source().click();
    const w = p.w;
    [...w.document.querySelectorAll('.histo-menu .histo-menu-item')]
        .find((b) => b.textContent.startsWith('MangaDex')).click();
    await new Promise((r) => setTimeout(r, 0));
    assert.equal(p.source().textContent, 'Source : MangaDex',
        'une pastille qui garde son libellé neutre ne dit plus ce qui filtre');
    assert.equal(p.source().getAttribute('aria-pressed'), 'true');
});

// ── L'amorce ──
test('le câblage ne dépend plus de la réussite des sections', () => {
    const src = SRC.replace(/\r\n/g, '\n');
    // L'amorce seule : de l'écouteur jusqu'au dernier câblage. Ailleurs dans
    // le fichier, un `Promise.all` local est légitime — l'appelant a son
    // propre `catch` et ne tient aucun câblage derrière lui.
    const debut = src.indexOf("addEventListener('DOMContentLoaded'");
    const fin = src.indexOf('wireExtraButtons();', debut);
    assert.ok(debut !== -1 && fin > debut, 'l’amorce doit rester repérable');
    const amorce = src.slice(debut, fin);

    assert.ok(amorce.indexOf('initHistoryFilters();') < amorce.indexOf('await Promise.'),
        'les filtres doivent être câblés AVANT l’attente des données');
    assert.ok(/await Promise\.allSettled\(\s*\[/.test(amorce),
        'l’attente des sections doit être tolérante à un rejet');
    assert.ok(!/await Promise\.all\(\s*\[/.test(amorce),
        'une section qui rejette ne doit pas emporter le câblage qui suit');
});
