// ============================================================
// test/unit/cors-hote-refuse.test.js — ne pas redemander ce qui vient d'être refusé
// ------------------------------------------------------------
// `fetchPage` tente chaque page EN DIRECT avant de se replier sur le proxy du
// hub, et c'est délibéré : une réponse directe est non-opaque et évite de
// faire transiter tout le volume par le hub.
//
// Mais rien ne retenait le refus. Sur un hôte qui bloque le CORS — le cas de
// celui mesuré — la tentative vouée à l'échec était refaite à CHAQUE page :
// 393 erreurs de console pour trois chapitres, soit un aller-retour réseau
// perdu par page, sur l'opération la plus longue de l'application.
//
// Ce test EXÉCUTE `downloads.js` avec un réseau simulé et compte les appels,
// parce que c'est un comportement, pas une tournure de code.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'assets', 'js', 'downloads.js'), 'utf8');

/**
 * Monte `downloads.js` avec un Cache API et un réseau simulés.
 *
 * `directRefuse` décide du sort du fetch direct : `true` le fait lever, comme
 * un navigateur devant une réponse sans `Access-Control-Allow-Origin`.
 *
 * L'écriture finale des métadonnées passe par IndexedDB, absent de jsdom :
 * `download()` rejette donc à la toute fin. Les appels réseau, eux, ont déjà
 * eu lieu — et ce sont eux qu'on compte.
 */
function monter({ directRefuse = true } = {}) {
    const dom = new JSDOM('<!doctype html><html><body></body></html>',
        { url: 'http://localhost/', runScripts: 'outside-only' });
    const w = dom.window;

    const appels = [];
    w.MH = { err() {}, toast() {} };
    w.API = { base: '/api' };
    w.caches = {
        open: async () => ({
            match: async () => undefined,
            put: async () => {},
            delete: async () => {},
        }),
    };
    const reponse = () => ({
        ok: true, status: 200,
        clone() { return reponse(); },
        async blob() { return { size: 10, type: 'image/png' }; },
        async arrayBuffer() { return new ArrayBuffer(10); },
    });
    w.fetch = async (url) => {
        const u = String(url);
        const proxy = u.includes('/img?u=');
        appels.push(proxy ? 'proxy' : 'direct');
        if (!proxy && directRefuse) throw new TypeError('Failed to fetch');
        return reponse();
    };

    w.eval(SRC);
    return { w, appels, direct: () => appels.filter(a => a === 'direct').length,
             proxy: () => appels.filter(a => a === 'proxy').length };
}

const pagesDe = (n, hote = 'https://cdn.exemple') =>
    Array.from({ length: n }, (_, i) => ({ url: `${hote}/p${i}.png` }));

const info = { chapterId: 'c1', mangaId: 'm1', chapterNum: 1, mangaTitle: 'T', source: 's' };

test('un hôte qui refuse le CORS n’est sondé qu’UNE fois, pas à chaque page', async () => {
    const m = monter({ directRefuse: true });
    await m.w.Downloads.download(info, pagesDe(10)).catch(() => {});

    assert.equal(m.proxy(), 10, 'les dix pages passent bien par le proxy');
    assert.equal(m.direct(), 1,
        'une seule sonde directe : le refus du premier vaut pour les suivantes');
});

test('le refus vaut pour l’hôte, pas pour l’URL', async () => {
    // Retenir par URL ne servirait à rien : chaque page a la sienne. C'est
    // l'origine qui refuse.
    const m = monter({ directRefuse: true });
    await m.w.Downloads.download(info, pagesDe(5)).catch(() => {});
    const apresPremier = m.direct();

    // Deuxième chapitre, MÊME hôte, nouvel appel à download() : la mémoire
    // vit au niveau du module, pas de l'appel.
    await m.w.Downloads.download({ ...info, chapterId: 'c2' }, pagesDe(5)).catch(() => {});
    assert.equal(m.direct(), apresPremier,
        'un second chapitre du même hôte ne resonde pas');
});

test('un autre hôte est sondé pour lui-même', async () => {
    // Punir un hôte pour le refus d'un autre ferait passer par le hub un
    // volume qui n'avait aucune raison d'y passer.
    const m = monter({ directRefuse: true });
    await m.w.Downloads.download(info, pagesDe(3, 'https://a.exemple')).catch(() => {});
    const apresA = m.direct();
    await m.w.Downloads.download({ ...info, chapterId: 'c2' },
        pagesDe(3, 'https://b.exemple')).catch(() => {});

    assert.equal(m.direct(), apresA + 1, 'le second hôte a droit à sa propre sonde');
});

test('un hôte qui ACCEPTE le direct n’est jamais dévié vers le proxy', async () => {
    // C'est le point qu'une optimisation trop zélée casserait : le direct
    // existe pour que le hub ne serve pas de relais à des gigaoctets.
    const m = monter({ directRefuse: false });
    await m.w.Downloads.download(info, pagesDe(6)).catch(() => {});

    assert.equal(m.direct(), 6, 'chaque page passe en direct');
    assert.equal(m.proxy(), 0, 'et aucune par le proxy');
});

test('une coupure réseau ne doit pas être prise pour un refus d’hôte', async () => {
    // Direct ET proxy échouent : c'est le réseau, pas l'hôte. Le retenir
    // ferait passer toute la session par le hub une fois le réseau revenu,
    // alors que l'hôte, lui, acceptait peut-être très bien le direct.
    const m = monter({ directRefuse: true });
    m.w.fetch = async (url) => {
        m.appels.push(String(url).includes('/img?u=') ? 'proxy' : 'direct');
        throw new TypeError('Failed to fetch');
    };
    await m.w.Downloads.download(info, pagesDe(3)).catch(() => {});

    // Trois pages, deux tentatives chacune, direct ET proxy à chaque fois :
    // si un refus avait été retenu, le nombre de sondes directes s'effondrerait.
    assert.ok(m.direct() > 1,
        'aucun refus d’hôte ne doit être retenu sur une panne de réseau');
});
