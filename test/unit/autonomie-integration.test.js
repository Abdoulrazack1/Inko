// ============================================================
// test/unit/autonomie-integration.test.js — la CHAÎNE, pas les maillons
// ------------------------------------------------------------
// Les modules du mode autonome ont chacun leurs tests, et ils passent tous.
// Ça ne prouve rien sur l'assemblage : `api.js` doit RÉELLEMENT consulter le
// moteur de sources et le magasin local, avec les bons arguments, dans le bon
// ordre, et rendre ce que les pages attendent.
//
// C'est précisément le trou par lequel passent les pannes : trois contrôles
// verts, et une application qui n'affiche rien. On charge donc les trois
// fichiers ensemble, dans un DOM sans réseau, et on appelle l'API PUBLIQUE —
// celle que les pages utilisent.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const lire = (f) => fs.readFileSync(path.join(ROOT, 'assets', 'js', f), 'utf8');

/**
 * Monte l'application comme le fait le paquet mobile : moteur de sources et
 * magasin local AVANT `api.js`, et `INKO_AUTONOME` posé par `hub.js`.
 */
function monter({ reponseReseau } = {}) {
    const dom = new JSDOM('<!doctype html><html><body></body></html>',
        { url: 'http://localhost/', runScripts: 'outside-only' });
    const w = dom.window;

    // Tout appel réseau qui parviendrait à sortir est une ERREUR : sans hub,
    // rien ne doit partir. On le rend visible plutôt que de le laisser
    // échouer silencieusement.
    const sorties = [];
    w.fetch = async (url, opts) => {
        sorties.push(String(url));
        if (reponseReseau) return reponseReseau(url, opts);
        throw new Error('appel réseau inattendu : ' + url);
    };
    w.INKO_AUTONOME = true;

    w.eval(lire('sources-embarquees.js'));
    w.eval(lire('moi-local.js'));
    w.eval(lire('api.js'));
    return { w, API: w.API, sorties };
}

// ── Les sources ─────────────────────────────────────────────

test('API.mangas.popular() traverse jusqu’à MangaDex, sans passer par un hub', async () => {
    const { API, sorties } = monter({
        reponseReseau: async (url) => ({
            ok: true,
            json: async () => ({
                total: 1,
                data: [{
                    id: 'm1',
                    attributes: { title: { en: 'Une œuvre' }, tags: [], availableTranslatedLanguages: ['fr'] },
                    relationships: [{ type: 'cover_art', attributes: { fileName: 'c.jpg' } }],
                }],
            }),
        }),
    });

    const r = await API.mangas.popular({ limit: 1 });
    assert.equal(r.results.length, 1);
    assert.equal(r.results[0].title, 'Une œuvre');

    // Un seul appel, et il part vers MangaDex — pas vers `localhost:8088`.
    assert.equal(sorties.length, 1);
    assert.match(sorties[0], /^https:\/\/api\.mangadex\.org\/manga\?/);
});

test('les couvertures ne sont pas réécrites vers un hub inexistant', async () => {
    const { API } = monter({
        reponseReseau: async () => ({
            ok: true,
            json: async () => ({
                total: 1,
                data: [{
                    id: 'm1', attributes: { title: { en: 'X' }, tags: [] },
                    relationships: [{ type: 'cover_art', attributes: { fileName: 'c.jpg' } }],
                }],
            }),
        }),
    });
    const r = await API.mangas.popular({ limit: 1 });
    // `mapMangaPage` passe par `proxyCover` : sans la garde, l'URL deviendrait
    // `http://localhost:8088/api/img?u=…` et la grille serait entièrement grise.
    assert.match(r.results[0].coverThumb, /^https:\/\/uploads\.mangadex\.org\//);
});

// ── Les données personnelles ────────────────────────────────

test('API.me.favorites() : écrire puis relire, sans réseau du tout', async () => {
    const { API, sorties } = monter();

    assert.deepEqual(await API.me.favorites(), []);
    // ⚠ Signature réelle : `addFavorite(mangaId, meta)`. Mon premier essai
    // passait un objet unique — le favori était bien créé, mais sans titre.
    await API.me.addFavorite('abc', { title: 'Gardée' });
    const l = await API.me.favorites();
    assert.equal(l.length, 1);
    assert.equal(l[0].title, 'Gardée');

    assert.deepEqual(sorties, [], 'aucun appel réseau ne doit avoir lieu');
});

test('la progression écrite est relue dans la forme attendue par les pages', async () => {
    const { API } = monter();
    await API.me.setProgress('serie1', { chapterId: 'c1', chapter: 7, page: 2, totalPages: 20 });
    const p = await API.me.progress();
    // `accueil.js` fait `Object.entries(progress)` : un tableau casserait la
    // reprise de lecture sans lever d'erreur.
    assert.ok(!Array.isArray(p));
    assert.equal(p.serie1.chapter, 7);
});

test('marquer un chapitre lu survit à la relecture', async () => {
    const { API } = monter();
    await API.me.markChapter({ mangaId: 'm', chapterId: 'c1', chapter: 1, read: true });
    const lus = await API.me.readChapters();
    assert.deepEqual(lus.m, ['c1']);
});

test('notes et listes traversent l’API publique', async () => {
    const { API } = monter();
    const n = await API.me.addNote({ mangaId: 'm', text: 'une note' });
    assert.ok(n.id);
    assert.equal((await API.me.notes({ mangaId: 'm' })).total, 1);

    const l = await API.me.createList({ name: 'À lire' });
    assert.ok(l.id);
    assert.equal((await API.me.lists()).length, 1);
});

// ── Ce qui doit ÉCHOUER, et bien échouer ────────────────────

test('ce qui exige un hub échoue vite, avec quoi faire', async () => {
    const { API, sorties } = monter();
    await assert.rejects(
        () => API.devices.lister(),
        (e) => {
            assert.equal(e.autonome, true, 'l’erreur doit être reconnaissable');
            assert.match(e.message, /Param.tres/, 'le message doit dire où connecter un ordinateur');
            return true;
        });
    // Et surtout : elle n'a pas attendu un délai réseau.
    assert.deepEqual(sorties, [], 'aucune tentative vers un serveur inexistant');
});

test('une source que le téléphone ne sait pas interroger n’invente rien', async () => {
    const { API } = monter();
    await assert.rejects(() => API.mangas.searchFor('weebcentral', { q: 'x' }),
        (e) => e.autonome === true);
});

// ── L'ordre, qui conditionne tout le reste ──────────────────

test('sans les modules embarqués, l’API refuse au lieu d’appeler dans le vide', async () => {
    // Simule un chargement où `api.js` arrive AVANT les deux autres : c'est
    // l'erreur d'intégration la plus facile à commettre, et elle rendrait
    // l'application inutilisable sans rien casser de visible dans les tests
    // unitaires de chaque module.
    const dom = new JSDOM('<!doctype html><html><body></body></html>',
        { url: 'http://localhost/', runScripts: 'outside-only' });
    const w = dom.window;
    const sorties = [];
    w.fetch = async (u) => { sorties.push(String(u)); throw new Error('réseau'); };
    w.INKO_AUTONOME = true;
    w.eval(lire('api.js'));                     // seul, sans moteur ni magasin

    await assert.rejects(() => w.API.mangas.popular({}), (e) => e.autonome === true);
    assert.deepEqual(sorties, [],
        'même sans les modules, rien ne doit partir vers localhost:8088');
});
