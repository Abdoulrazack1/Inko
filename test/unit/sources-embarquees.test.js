// ============================================================
// test/unit/sources-embarquees.test.js — le téléphone se passe du hub
// ------------------------------------------------------------
// Sans ordinateur allumé, l'application s'ouvrait sur un catalogue vide : le
// hub scrapait, le téléphone affichait. Ce module lui donne une source qu'il
// interroge lui-même.
//
// Ces tests ne touchent PAS le réseau : ils vérifient le contrat — l'aiguillage
// des chemins, les formes rendues, et les refus. La conversation réelle avec
// MangaDex est éprouvée séparément (et l'a été : 85 221 séries, 131 chapitres,
// 37 pages, URL absolues).
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'sources-embarquees.js'), 'utf8');
const API = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'api.js'), 'utf8');

/** Charge le moteur avec un transport factice, dont on garde la trace. */
function charger() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>',
        { url: 'http://localhost/', runScripts: 'outside-only' });
    const w = dom.window;
    const appels = [];
    w.fetch = async (url) => {
        appels.push(url);
        return { ok: true, json: async () => ({ total: 1, data: [reponseManga()] }) };
    };
    w.eval(SRC);
    return { w, appels, M: w.INKO_SOURCES_EMBARQUEES };
}

function reponseManga() {
    return {
        id: 'abc-123',
        attributes: {
            title: { en: 'Titre anglais', fr: 'Titre français' },
            altTitles: [{ ja: 'べつ' }],
            description: { fr: 'Une description.' },
            status: 'ongoing', year: 2020, contentRating: 'safe',
            tags: [{ attributes: { name: { en: 'Action' } } }],
            availableTranslatedLanguages: ['fr', 'en'],
        },
        relationships: [
            { type: 'cover_art', attributes: { fileName: 'couv.jpg' } },
            { type: 'author', attributes: { name: 'Quelqu’un' } },
        ],
    };
}

test('le moteur s’annonce et expose une source par défaut', () => {
    const { M } = charger();
    assert.equal(M.disponible, true);
    assert.equal(M.defaut.id, 'mangadex');
    assert.ok(M.parId('mangadex'), 'la source doit être retrouvable par identifiant');
    assert.equal(M.parId('weebcentral'), null,
        'une source qui exige le hub ne doit PAS se prétendre embarquée');
});

test('les formes rendues sont celles que les pages lisent', () => {
    // Rendre autre chose ici obligerait à écrire un second affichage, qui
    // divergerait du premier. Les champs sont donc ceux de l'extension
    // serveur, à l'identique.
    const { M } = charger();
    return M.defaut.popular({ limit: 1 }).then((r) => {
        assert.ok(Array.isArray(r.results), 'la page est { results: [] }');
        const m = r.results[0];
        for (const champ of ['id', 'title', 'author', 'description', 'status',
            'tags', 'cover', 'coverThumb', 'coverLarge', 'langs']) {
            assert.ok(champ in m, `champ « ${champ} » manquant`);
        }
        assert.equal(m.title, 'Titre anglais', 'l’anglais prime, puis le français');
        assert.equal(m.author, 'Quelqu’un');
        assert.deepEqual(m.tags, ['Action']);
        assert.match(m.coverThumb, /^https:\/\/uploads\.mangadex\.org\/covers\/abc-123\//);
    });
});

test('la limite demandée est bornée à ce que la source accepte', async () => {
    // MangaDex refuse au-delà de 100 : envoyer 500 ferait une erreur 400 que
    // l'utilisateur verrait comme « la recherche ne marche pas ».
    const { M, appels } = charger();
    await M.defaut.popular({ limit: 500 });
    assert.match(appels[0], /limit=100/);
});

test('le cache évite de marteler la source', async () => {
    // MangaDex limite à 5 requêtes/seconde par IP. Sans cache, un aller-retour
    // dans le catalogue suffit à s'en approcher.
    const { M, appels } = charger();
    await M.defaut.popular({ limit: 5 });
    await M.defaut.popular({ limit: 5 });
    assert.equal(appels.length, 1, 'le second appel identique ne doit pas repartir');
});

test('le cache est plafonné — une longue session ne le fait pas enfler', async () => {
    const { M } = charger();
    for (let i = 0; i < 140; i++) await M.defaut.popular({ limit: 5, offset: i });
    assert.ok(M._cache.size <= 120, `cache à ${M._cache.size} entrées`);
});

// ── L'aiguillage, côté api.js ───────────────────────────────

test('api.js route les appels de source vers le moteur', () => {
    const bloc = /async function viaSourcesEmbarquees\(method, path\) \{([\s\S]*?)\n    \}/.exec(API);
    assert.ok(bloc, 'le routeur doit exister');
    const code = bloc[1];
    for (const chemin of ['popular', 'latest', 'search', 'tags', 'chapters', 'pages', '/sources', '/search-all']) {
        assert.ok(code.includes(chemin), `le routeur doit traiter « ${chemin} »`);
    }
});

test('« je ne sais pas répondre » se distingue de « la réponse est vide »', () => {
    // Sans sentinelle, un `null` légitime rendu par une source serait pris
    // pour « le moteur ne sait pas », et l'appel repartirait vers un hub
    // inexistant.
    assert.match(API, /const ABSENT = Symbol\('absent'\)/);
    assert.match(API, /if \(local !== ABSENT\) return local/);
});

test('seules les écritures GET sont servies sans hub', () => {
    // Une écriture suppose un compte, donc un hub. La router vers le moteur
    // donnerait l'illusion d'une sauvegarde qui n'existe pas.
    const bloc = /async function viaSourcesEmbarquees\(method, path\) \{([\s\S]*?)\n    \}/.exec(API);
    assert.match(bloc[1], /method !== 'GET'\) return ABSENT/);
});

test('les couvertures ne passent pas par un hub inexistant', () => {
    // `API_BASE` désigne alors `localhost:8088`. Une couverture réécrite vers
    // lui ne chargerait jamais : la grille s'afficherait entièrement grise,
    // ce qui ressemble à un catalogue vide plutôt qu'à une image manquante.
    const bloc = /function proxyCover\(u\) \{([\s\S]*?)\n    \}/.exec(API);
    assert.ok(bloc, 'proxyCover doit exister');
    assert.match(bloc[1], /INKO_AUTONOME\) return u/);
});

test('le moteur est chargé AVANT api.js dans le paquet mobile', () => {
    // Chargé après, il existerait — mais trop tard pour le premier appel de
    // la page, celui qui remplit l'accueil.
    const build = fs.readFileSync(path.join(ROOT, 'scripts-ci', 'build-mobile-www.js'), 'utf8');
    const balises = /const balises = \[([\s\S]*?)\];/.exec(build);
    assert.ok(balises, 'la liste des scripts injectés doit être lisible');
    assert.match(balises[1], /sources-embarquees\.js/);

    const page = path.join(ROOT, 'mobile', 'www', 'accueil.html');
    if (fs.existsSync(page)) {
        const html = fs.readFileSync(page, 'utf8');
        assert.ok(html.indexOf('sources-embarquees.js') < html.indexOf('assets/js/api.js'),
            'le moteur doit précéder api.js dans la page construite');
    }
});
