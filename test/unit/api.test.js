// ============================================================
// test/frontend.api.test.js — cache de lectures partagées (assets/js/api.js)
// ------------------------------------------------------------
// Audit QUAL-02 + PERF-02. Le cache introduit pour PERF-02 met en commun les
// lectures idempotentes propres à l'utilisateur (favoris, progression,
// réglages…). C'est un gain mesuré — accueil 39 → 30 appels, profil 6 → 1 — mais
// c'est AUSSI le genre de mécanisme qui, mal invalidé, fait réapparaître une
// série qu'on vient de retirer. Un bug de ce type est intermittent, dépendant
// du minutage, et quasi impossible à reproduire à la main. D'où ces tests.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');

// Charge api.js dans un DOM neuf avec un fetch instrumenté : chaque test part
// d'un compteur à zéro et d'un cache vide.
// `reponses` : chemin → charge utile (ou fonction renvoyant la charge, pour
// simuler un état qui change entre deux appels).
function chargerAPI(reponses = {}) {
    const dom = new JSDOM('<!doctype html><html><body></body></html>',
        { url: 'http://localhost:8088/accueil.html', runScripts: 'outside-only' });
    const win = dom.window;

    const appels = [];
    win.fetch = (url, opts = {}) => {
        const chemin = String(url).replace(/^https?:\/\/[^/]+/, '');
        appels.push({ chemin, methode: opts.method || 'GET' });
        const corps = Object.prototype.hasOwnProperty.call(reponses, chemin)
            ? reponses[chemin]
            : { ok: true };
        const charge = typeof corps === 'function' ? corps() : corps;
        return Promise.resolve({
            ok: true, status: 200,
            json: () => Promise.resolve(charge),
        });
    };

    win.eval(fs.readFileSync(path.join(ROOT, 'assets', 'js', 'api.js'), 'utf8'));
    return { win, API: win.API, appels, gets: () => appels.filter(a => a.methode === 'GET') };
}

test('deux lectures concurrentes de la même route ne font qu’UNE requête', async () => {
    // C'est le cas réel mesuré : global.js (en-tête, cloche, avatar) et le
    // script de page demandent /me/favorites au même instant sans se connaître.
    const { API, gets } = chargerAPI({ '/api/me/favorites': [{ mangaId: 'a' }] });
    const [a, b] = await Promise.all([API.me.favorites(), API.me.favorites()]);
    assert.strictEqual(gets().filter(g => g.chemin === '/api/me/favorites').length, 1);
    assert.deepStrictEqual(a, b);
});

test('deux lectures séquentielles rapprochées ne font qu’UNE requête', async () => {
    // Le cas des appels enchaînés pendant le chargement d'une page : ils ne
    // sont pas concurrents, une simple coalescence d'appels en vol ne suffit
    // donc pas — il faut la fenêtre de cache.
    const { API, gets } = chargerAPI({ '/api/me/progress': { m1: { chapter: 3 } } });
    await API.me.progress();
    await API.me.progress();
    await API.me.progress();
    assert.strictEqual(gets().filter(g => g.chemin === '/api/me/progress').length, 1);
});

test('une ÉCRITURE périme le cache : la lecture suivante voit le changement', async () => {
    // Le risque central. Sans invalidation, « retirer des favoris » suivi d'un
    // rafraîchissement rendrait la série disparue… toujours présente.
    let etat = [{ mangaId: 'a' }, { mangaId: 'b' }];
    const { API, gets } = chargerAPI({ '/api/me/favorites': () => etat });

    const avant = await API.me.favorites();
    assert.strictEqual(avant.length, 2);

    etat = [{ mangaId: 'a' }];
    await API.me.removeFavorite('b');            // écriture → doit vider le cache

    const apres = await API.me.favorites();
    assert.strictEqual(apres.length, 1, 'la lecture après écriture doit être fraîche');
    assert.strictEqual(gets().filter(g => g.chemin === '/api/me/favorites').length, 2);
});

test('chaque appelant reçoit une COPIE, pas la même référence', async () => {
    // Plusieurs modules partagent désormais une réponse. Si l'un trie ou vide
    // le tableau en place, les autres verraient une liste corrompue — un bug
    // qui n'apparaît qu'en présence de deux consommateurs, donc introuvable.
    const { API } = chargerAPI({ '/api/me/favorites': [{ mangaId: 'a' }, { mangaId: 'b' }] });
    const premier = await API.me.favorites();
    premier.length = 0;                          // consommateur hostile
    const second = await API.me.favorites();
    assert.strictEqual(second.length, 2, 'la mutation d’un appelant ne doit pas atteindre les autres');
});

test('les routes non partagées ne sont PAS mises en cache', async () => {
    // Une recherche est paramétrée et une fiche de série peut changer : seules
    // les lectures propres à l'utilisateur, idempotentes, sont mutualisées.
    const { API, gets } = chargerAPI();
    await API.mangas.search({ query: 'x' });
    await API.mangas.search({ query: 'x' });
    const n = gets().filter(g => g.chemin.includes('/search')).length;
    assert.strictEqual(n, 2, 'la recherche doit repartir au réseau à chaque appel');
});

test('un échec n’est pas resservi depuis le cache', async () => {
    // Une réponse en erreur mise en cache 3 s condamnerait l'utilisateur à
    // attendre avant toute nouvelle tentative, même après retour du réseau.
    //
    // Attention : api.js RÉESSAIE une fois les erreurs réseau (getWithRetry).
    // Il faut donc faire échouer les DEUX premières tentatives pour que
    // l'appel remonte réellement une erreur — sinon on teste le réessai, pas
    // le cache.
    const dom = new JSDOM('<!doctype html><html><body></body></html>',
        { url: 'http://localhost:8088/', runScripts: 'outside-only' });
    const win = dom.window;
    let n = 0;
    win.fetch = (url) => {
        if (!String(url).includes('/me/favorites')) {
            return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ ok: true }) });
        }
        n++;
        return n <= 2
            ? Promise.reject(new TypeError('réseau coupé'))
            : Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve([{ mangaId: 'a' }]) });
    };
    win.eval(fs.readFileSync(path.join(ROOT, 'assets', 'js', 'api.js'), 'utf8'));

    await assert.rejects(() => win.API.me.favorites(), 'les deux tentatives échouent → l’appel doit rejeter');
    const ok = await win.API.me.favorites();
    // Comparaison par valeur : l'objet vient du réalm jsdom, donc son
    // prototype n'est pas celui de Node et deepStrictEqual échouerait sur
    // « same structure but not reference-equal ».
    assert.strictEqual(JSON.stringify(ok), JSON.stringify([{ mangaId: 'a' }]),
        'la lecture suivante doit vraiment repartir au réseau');
});

// ── BUG-01 : un identifiant ne part JAMAIS sans sa source ────
// `getFrom(source, id)` construisait l'URL sans préfixe quand `source` était
// absent, et le serveur appliquait alors la source COURANTE. Mesuré pendant
// l'audit : 14 requêtes avec un identifiant étranger à la source appelée, dont
// `/api/sources/weebcentral/mangas/2701` — 2701 est l'identifiant de Moby Dick
// chez Project Gutenberg. Le serveur répondait 200 avec une fiche VIDE, donc
// rien ne signalait la faute : un roman ouvrait le lecteur d'images.
//
// La régression est indétectable à l'œil — elle ne casse rien, elle affiche
// l'œuvre d'un autre catalogue. D'où ces tests.
test('mangas.getFrom sans source : la requête n’est PAS envoyée (audit BUG-01)', async () => {
    const { API, gets } = chargerAPI({});
    await assert.rejects(() => API.mangas.getFrom(undefined, '2701'),
        /source inconnue/i, 'renoncer est plus honnête que d’interroger la mauvaise source');
    await assert.rejects(() => API.mangas.getFrom('', '2701'), /source inconnue/i);
    await assert.rejects(() => API.mangas.getFrom(null, '2701'), /source inconnue/i);
    assert.strictEqual(gets().length, 0, 'aucune requête ne doit partir');
});

test('mangas.getFrom avec source : la source est bien dans l’URL', async () => {
    const { API, gets } = chargerAPI({ '/api/sources/gutenberg/mangas/2701': { id: '2701', title: 'Moby Dick' } });
    const m = await API.mangas.getFrom('gutenberg', '2701');
    assert.strictEqual(m.title, 'Moby Dick');
    assert.strictEqual(gets()[0].chemin, '/api/sources/gutenberg/mangas/2701');
});

test('mangas.chaptersFor sans source : même refus (audit BUG-01)', async () => {
    const { API, gets } = chargerAPI({});
    await assert.rejects(() => API.mangas.chaptersFor(undefined, '2701'), /source inconnue/i);
    assert.strictEqual(gets().length, 0);
});

test('mangas.getFrom : la source est encodée, pas concaténée', async () => {
    // Une source au nom exotique ne doit pas pouvoir sortir du chemin.
    const { API, gets } = chargerAPI({});
    await API.mangas.getFrom('a/b', 'x').catch(() => {});
    assert.ok(gets()[0].chemin.startsWith('/api/sources/a%2Fb/mangas/'),
        `chemin inattendu : ${gets()[0].chemin}`);
});
