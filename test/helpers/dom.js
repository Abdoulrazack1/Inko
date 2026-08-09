// ============================================================
// test/helpers/dom.js — charge un module frontend dans un vrai DOM
// ------------------------------------------------------------
// Audit QUAL-02 : 7 900 lignes de JS frontend sans le moindre test. Les
// fonctions les plus critiques y sont pourtant celles qui décident de
// l'échappement HTML (SEC-01), du routage des images par le proxy (PERF-08) ou
// de l'affichage des dates — c'est-à-dire du code où une régression ne fait pas
// planter la page, elle la rend fausse ou vulnérable en silence.
//
// Pourquoi jsdom plutôt qu'un faux `document` maison : global.js n'est pas une
// collection de fonctions pures. Au chargement il pose des écouteurs, insère
// des nœuds dans `body`, lit `localStorage` et exécute plusieurs IIFE. Un stub
// artisanal aurait fait passer les tests en n'exécutant PAS le vrai chemin de
// chargement — on aurait testé le stub, pas l'application.
'use strict';

const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');

// Charge une liste de scripts de assets/js dans un DOM neuf, dans l'ordre, et
// renvoie la fenêtre. Chaque appel repart d'un DOM vierge : aucun test ne peut
// dépendre de l'état laissé par un autre.
function loadScripts(files, { html, url = 'http://localhost:8088/accueil.html' } = {}) {
    const dom = new JSDOM(html || '<!doctype html><html><head></head><body><main id="main"></main></body></html>', {
        url,
        pretendToBeVisual: true,
        runScripts: 'outside-only',
    });
    const { window } = dom;

    // Les modules appellent fetch au chargement (santé, réglages…). On ne veut
    // ni réseau ni erreur non capturée : un fetch inerte suffit, les tests qui
    // ont besoin d'une réponse la posent eux-mêmes.
    window.fetch = () => Promise.reject(new Error('réseau désactivé en test'));
    window.matchMedia = window.matchMedia || (q => ({
        matches: false, media: q, addEventListener() {}, removeEventListener() {},
        addListener() {}, removeListener() {}, onchange: null, dispatchEvent: () => false,
    }));

    for (const f of files) {
        window.eval(fs.readFileSync(path.join(ROOT, 'assets', 'js', f), 'utf8'));
    }
    return window;
}

// global.js suppose qu'un objet API existe (il l'interroge pour la session, les
// favoris, la source courante). On fournit un double minimal et explicite :
// tout ce qui n'est pas déclaré ici et que le module appellerait lèverait, ce
// qui est exactement ce qu'on veut voir en test.
function fakeAPI(over = {}) {
    return Object.assign({
        base: '/api',
        user: null,
        token: null,
        isLoggedIn: () => false,
        // Réponse plausible plutôt qu'un rejet : global.js gère bien l'échec
        // (il le journalise), mais chaque test afficherait alors une trace de
        // pile sans rapport avec ce qu'il vérifie.
        health: () => Promise.resolve({ ok: true, version: '2.3.4', dbFallback: false }),
        sources: { current: 'weebcentral', list: () => Promise.resolve([]) },
        me: {
            favorites: () => Promise.resolve([]),
            progress:  () => Promise.resolve({}),
            settings:  () => Promise.resolve({}),
            notifications: { unread: () => Promise.resolve({ count: 0 }) },
        },
    }, over);
}

// Charge global.js avec son environnement, et rend MH prêt à l'emploi.
function loadGlobal(over = {}) {
    const win = loadScripts([], {});
    win.API = fakeAPI(over.api);
    win.Storage = over.storage || { getPref: () => null, setPref: () => {}, cacheLibrary: () => {} };
    const code = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'global.js'), 'utf8');
    win.eval(code);
    return win;
}

module.exports = { loadScripts, loadGlobal, fakeAPI };
