// ============================================================
// test/unit/scan-attente.test.js — une barre de progression ne vaut pas 26 requêtes
// ------------------------------------------------------------
// `scanUpdates` lance la vérification des nouveaux chapitres côté serveur,
// puis relit l'avancement pour alimenter une barre. L'intervalle était fixe à
// une seconde.
//
// Mesuré sur un chargement d'accueil réel : le scan dure 26 secondes, et ces
// 26 interrogations représentaient **26 des 63 requêtes de la page** —
// presque la moitié, pour une seule barre de progression.
//
// L'attente recule désormais. Les premières restent rapprochées, parce qu'un
// scan court doit rendre la main tout de suite ; au-delà elle croît jusqu'à
// cinq secondes, une barre qui avance par paliers de cinq secondes sur une
// minute de travail se lisant exactement aussi bien.
//
// Ce test pilote le temps plutôt que de l'attendre : sans minuteries
// simulées, il durerait une demi-minute et mesurerait l'horloge de la machine
// plutôt que la décision.
'use strict';

const { test, mock } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'assets', 'js', 'api.js'), 'utf8');

/**
 * Monte `api.js` avec un serveur simulé dont le scan dure `dureeMs`.
 * Chaque appel réseau est enregistré, avec l'instant simulé où il part.
 */
function monter(dureeMs) {
    const dom = new JSDOM('<!doctype html><html><body></body></html>',
        { url: 'http://localhost/accueil.html', runScripts: 'outside-only' });
    const w = dom.window;
    w.MH = { err() {}, toast() {} };

    const appels = [];
    const t0 = Date.now();
    w.fetch = async (url, opts = {}) => {
        const chemin = String(url).replace('http://localhost', '');
        appels.push({ chemin, methode: opts.method || 'GET', a: Date.now() - t0 });
        const fini = (Date.now() - t0) >= dureeMs;
        return {
            ok: true, status: 200,
            headers: { get: () => 'application/json' },
            json: async () => ({
                etat: fini ? 'fini' : 'en_cours',
                faits: Math.min(40, Math.round((Date.now() - t0) / 650)), total: 40,
                updates: [], failures: [],
            }),
            text: async () => '',
        };
    };
    w.eval(SRC);
    return { w, appels, sondages: () => appels.filter(a => a.methode === 'GET').length };
}

test('un scan de 26 secondes ne demande plus 26 fois où il en est', async () => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    try {
        const m = monter(26000);
        const p = m.w.API.me.scanUpdates({}, () => {});
        // On avance le temps simulé par petits pas, en laissant les promesses
        // se régler entre deux : c'est ce qui permet à la boucle de repartir.
        for (let i = 0; i < 400; i++) {
            mock.timers.tick(100);
            await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
        }
        await p;

        const n = m.sondages();
        assert.ok(n <= 10, `au plus dix interrogations, vu ${n}`);
        assert.ok(n >= 5, `mais pas si peu que la barre se fige : vu ${n}`);
    } finally { mock.timers.reset(); }
});

test('un scan court rend la main tout de suite', async () => {
    // Le recul ne doit pas punir le cas rapide : la première attente reste
    // d'une seconde, sinon une bibliothèque de dix titres paraîtrait lente
    // alors que le travail est fini.
    mock.timers.enable({ apis: ['setTimeout', 'Date'] });
    try {
        const m = monter(900);
        const p = m.w.API.me.scanUpdates({}, () => {});
        for (let i = 0; i < 60; i++) {
            mock.timers.tick(100);
            await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
        }
        await p;

        const premier = m.appels.find(a => a.methode === 'GET');
        assert.ok(premier, 'une première interrogation doit avoir lieu');
        // 1 500 et non 1 100 : l'horloge simulée avance par pas de 100 ms et
        // chaque pas draine des microtâches, ce qui décale l'horodatage de
        // quelques crans au-delà de l'attente réelle. La marge mesure le
        // harnais, pas le code — ce qu'elle exclut, c'est une attente qui
        // aurait démarré à deux secondes ou plus.
        assert.ok(premier.a <= 1500,
            `la première attente doit rester d’une seconde, vue à ${premier.a} ms`);
        assert.equal(m.sondages(), 1, 'et une seule suffit quand le scan est déjà fini');
    } finally { mock.timers.reset(); }
});

test('l’attente est bornée : elle ne part pas à l’infini', () => {
    // Sans plafond, une bibliothèque de cinq cents titres finirait avec des
    // minutes entre deux mesures, et la barre paraîtrait bloquée.
    const src = SRC.replace(/\r\n/g, '\n');
    assert.match(src, /ATTENTE_MAX = 5000/, 'un plafond doit exister');
    assert.match(src, /Math\.min\(ATTENTE_MAX,/, 'et être réellement appliqué');
});
