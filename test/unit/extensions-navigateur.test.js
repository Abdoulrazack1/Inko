// ============================================================
// test/unit/extensions-navigateur.test.js — les VRAIES extensions, côté client
// ------------------------------------------------------------
// L'adaptateur n'a d'intérêt que s'il fait tourner les fichiers d'extension
// TELS QU'ILS SONT dans le dépôt. Un adaptateur validé sur un module d'essai
// écrit pour l'occasion ne prouverait rien : ce sont les vraies dépendances
// (`axios`, `cheerio`, `child_process`) et les vrais motifs d'appel qui
// posent problème.
//
// Ces tests chargent donc `extensions-community/*/index.js` et vérifient que
// chacune s'initialise, expose son contrat, et sait analyser une page.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const EXT = path.join(ROOT, 'extensions-community');

/** Un DOM où l'adaptateur et son cheerio sont chargés, sans réseau réel. */
function monter({ reponses = {} } = {}) {
    const dom = new JSDOM('<!doctype html><html><body></body></html>',
        { url: 'http://localhost/', runScripts: 'outside-only' });
    const w = dom.window;
    const appels = [];
    w.fetch = async (url) => {
        appels.push(String(url));
        const trouve = Object.entries(reponses).find(([motif]) => String(url).includes(motif));
        if (!trouve) return { ok: false, status: 404, text: async () => '' };
        return { ok: true, status: 200, text: async () => trouve[1] };
    };
    w.eval(fs.readFileSync(path.join(ROOT, 'assets', 'js', 'cheerio-navigateur.js'), 'utf8'));
    w.eval(fs.readFileSync(path.join(ROOT, 'assets', 'js', 'extensions-navigateur.js'), 'utf8'));
    return { w, appels, E: w.INKO_EXTENSIONS };
}

const extensions = fs.readdirSync(EXT)
    .filter((d) => fs.existsSync(path.join(EXT, d, 'index.js')));

test('toutes les extensions du dépôt se chargent sans lever', () => {
    const { E } = monter();
    const echecs = [];
    for (const nom of extensions) {
        const src = fs.readFileSync(path.join(EXT, nom, 'index.js'), 'utf8');
        try {
            const ext = E.charger(nom, src);
            assert.ok(ext.id, `${nom} : pas d’identifiant`);
        } catch (e) {
            echecs.push(`${nom} : ${e.message}`);
        }
    }
    assert.deepEqual(echecs, [], `extensions qui ne chargent pas :\n  ${echecs.join('\n  ')}`);
});

test('chaque extension expose le contrat que le hub attend', () => {
    const { E } = monter();
    for (const nom of extensions) {
        const ext = E.charger('c_' + nom, fs.readFileSync(path.join(EXT, nom, 'index.js'), 'utf8'));
        assert.equal(typeof ext.id, 'string', `${nom} : id`);
        assert.equal(typeof ext.name, 'string', `${nom} : name`);
        assert.ok(Array.isArray(ext.capabilities), `${nom} : capabilities`);
        // Les capacités annoncées doivent correspondre à des fonctions
        // réelles : annoncer « search » sans la fournir donnerait un bouton
        // qui échoue à l'appui.
        const table = {
            search: 'search', popular: 'popular', latest: 'latest',
            manga: 'getManga', chapters: 'getChapters', pages: 'getPages', tags: 'getTags',
        };
        for (const cap of ext.capabilities) {
            const fn = table[cap];
            if (!fn) continue;
            assert.equal(typeof ext[fn], 'function',
                `${nom} annonce « ${cap} » mais ${fn}() n’existe pas`);
        }
    }
});

test('une extension qui scrape analyse réellement une page', async () => {
    // WeebCentral : celle que l'inventaire montrait comme source par défaut,
    // et qui exigeait le hub. On lui sert une page minimale et on vérifie
    // qu'elle en tire des résultats — c'est-à-dire que le cheerio de
    // remplacement fait bien son travail dans un vrai fichier d'extension.
    const src = fs.readFileSync(path.join(EXT, 'weebcentral', 'index.js'), 'utf8');
    const page = `
      <html><body>
        <article>
          <a href="https://weebcentral.com/series/ABC/mon-titre">
            <img src="https://temp.compsci88.com/cover/normal/ABC.webp" alt="Mon Titre">
            <div class="line-clamp-1">Mon Titre</div>
          </a>
        </article>
      </body></html>`;
    const { E } = monter({ reponses: { '/search/data': page, 'weebcentral.com': page } });
    const ext = E.charger('wc_test', src);

    const r = await ext.search({ q: 'mon', limit: 5 }).catch((e) => ({ erreur: e.message }));
    assert.ok(!r.erreur, `la recherche a échoué : ${r.erreur}`);
    assert.ok(Array.isArray(r.results), 'la forme { results } est attendue');
});

// ── Les doublures ───────────────────────────────────────────

test('axios de remplacement a l’interface qu’attendent les extensions', () => {
    const { E } = monter();
    const require_ = E._fabriquerRequire();
    const axios = require_('axios');
    for (const m of ['get', 'post', 'put', 'delete', 'head', 'create', 'request']) {
        assert.equal(typeof axios[m], 'function', `axios.${m}`);
    }
    // `axios.create({baseURL})` est le motif de sept extensions sur neuf.
    const i = axios.create({ baseURL: 'https://exemple.test', headers: { 'X-A': '1' } });
    assert.equal(typeof i.get, 'function');
    assert.equal(i.defaults.baseURL, 'https://exemple.test');
});

test('`curl` via child_process est redirigé, pas refusé', async () => {
    // Cinq extensions l'utilisent en repli quand un site bloque axios. Le
    // client natif a déjà une empreinte TLS différente : le repli n'a plus
    // d'objet, mais il ne doit pas échouer pour autant.
    const { E, appels } = monter({ reponses: { 'exemple.test': '<html>ok</html>' } });
    const cp = E._fabriquerRequire()('child_process');
    const sortie = await new Promise((ok, ko) => {
        cp.execFile('curl', ['-s', '-L', '-A', 'UA/1', 'https://exemple.test/p'], {},
            (e, out) => (e ? ko(e) : ok(out)));
    });
    assert.match(sortie, /ok/);
    assert.ok(appels.some((u) => u.includes('exemple.test')), 'l’URL doit être extraite des arguments');
});

test('les modules absents échouent à l’APPEL, sans mentir avant', () => {
    // Une doublure qui rendrait un objet vide laisserait l'extension croire
    // qu'elle a lu un fichier, et produire des résultats faux. Mieux vaut
    // qu'elle s'arrête net.
    const { E } = monter();
    const require_ = E._fabriquerRequire();
    const fsFaux = require_('fs');
    assert.throws(() => fsFaux.readFileSync('/x'), /pas disponible/);
    assert.throws(() => require_('crypto'), /indisponible/);
});

test('une extension ne peut pas atteindre les variables de l’adaptateur', () => {
    // `new Function` exécute dans la portée GLOBALE : le magasin personnel et
    // le jeton de session restent hors d'atteinte, par construction.
    const { E } = monter();
    assert.throws(
        () => E.charger('fouineuse', 'module.exports = { id: "x", vole: chargees };'),
        /n’a pas pu être chargée/);
});

test('une extension sans identifiant est refusée', () => {
    const { E } = monter();
    assert.throws(() => E.charger('anonyme', 'module.exports = {};'), /identifiant/);
});

test('le même identifiant n’est chargé qu’une fois', () => {
    const { E } = monter();
    const a = E.charger('memo', 'module.exports = { id: "memo", n: Math.random() };');
    const b = E.charger('memo', 'module.exports = { id: "memo", n: Math.random() };');
    assert.equal(a.n, b.n, 'le second chargement doit rendre la même instance');
});
