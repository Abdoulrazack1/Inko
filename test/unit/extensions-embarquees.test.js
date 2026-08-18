// ============================================================
// test/unit/extensions-embarquees.test.js — le câblage, et son garde-fou
// ------------------------------------------------------------
// L'adaptateur sait exécuter les extensions ; encore faut-il qu'elles soient
// dans le paquet, qu'elles y arrivent INTACTES, et que leur contrat soit
// traduit vers celui qu'attend `api.js`.
//
// Le point le plus important est le contrôle d'empreinte. Ces fichiers
// parlent au réseau : les exécuter sans vérification reviendrait à faire
// confiance à tout ce qui a pu atterrir dans le paquet. Le hub le fait déjà
// (audit S-2) ; le téléphone doit faire pareil, sinon la garantie s'arrête à
// la porte du mobile.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'sources-embarquees.js'), 'utf8');
const PAQUET = path.join(ROOT, 'mobile', 'www', 'extensions');

test('les extensions sont embarquées avec leurs empreintes', () => {
    if (!fs.existsSync(PAQUET)) { console.log('   (paquet mobile non construit — sauté)'); return; }
    const h = JSON.parse(fs.readFileSync(path.join(PAQUET, 'hashes.json'), 'utf8'));
    assert.ok(Object.keys(h).length >= 9, 'toutes les extensions doivent être listées');
    for (const id of Object.keys(h)) {
        assert.ok(fs.existsSync(path.join(PAQUET, id, 'index.js')), `${id} : fichier absent du paquet`);
    }
});

test('chaque fichier embarqué correspond à son empreinte', () => {
    // Une extension modifiée en route — build cassé, copie partielle — serait
    // ÉCARTÉE au chargement. Autant le voir ici que sur le téléphone.
    if (!fs.existsSync(PAQUET)) return;
    const h = JSON.parse(fs.readFileSync(path.join(PAQUET, 'hashes.json'), 'utf8'));
    const mauvaises = [];
    for (const [id, attendu] of Object.entries(h)) {
        const p = path.join(PAQUET, id, 'index.js');
        if (!fs.existsSync(p)) { mauvaises.push(id + ' (absent)'); continue; }
        const vu = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
        if (vu !== attendu) mauvaises.push(id);
    }
    assert.deepEqual(mauvaises, [], `empreintes qui ne correspondent pas : ${mauvaises.join(', ')}`);
});

test('l’empreinte se calcule pareil côté navigateur', () => {
    // Le téléphone lit le fichier en TEXTE (`r.text()`) et l'encode en UTF-8 ;
    // le dépôt l'a haché en OCTETS. Une divergence ferait écarter toutes les
    // extensions, avec un message qui accuserait à tort une falsification.
    if (!fs.existsSync(PAQUET)) return;
    const p = path.join(PAQUET, 'weebcentral', 'index.js');
    if (!fs.existsSync(p)) return;
    const octets = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    const texte = crypto.createHash('sha256')
        .update(Buffer.from(fs.readFileSync(p, 'utf8'), 'utf8')).digest('hex');
    assert.equal(texte, octets);
});

test('une empreinte qui ne correspond pas fait ÉCARTER l’extension', () => {
    // C'est le comportement qui compte : ignorer, pas « charger au cas où ».
    const bloc = /async function chargerExtensions\(\)([\s\S]*?)\n    \}/.exec(SRC);
    assert.ok(bloc, 'chargerExtensions doit être lisible');
    assert.match(bloc[1], /vue !== empreintes\[id\]/);
    assert.match(bloc[1], /refusees\.push\(id \+ ' \(empreinte\)'\)/);
    assert.match(bloc[1], /continue/);
});

test('sans fichier d’empreintes, AUCUNE extension n’est chargée', () => {
    // Mieux vaut le seul MangaDex que du code non vérifié.
    const bloc = /async function chargerExtensions\(\)([\s\S]*?)\n    \}/.exec(SRC);
    assert.match(bloc[1], /return \{ chargees: 0, refusees: \['\(empreintes introuvables\)'\] \}/);
});

test('le contrat des extensions est traduit vers celui d’api.js', () => {
    // Les extensions exposent `getManga`/`getChapters`/`getPages` ; le routeur
    // appelle `get`/`chapters`/`pages`. Traduire ici évite de toucher aux
    // extensions — c'est tout l'intérêt de les partager avec le hub.
    const dom = new JSDOM('<!doctype html>', { url: 'http://localhost/', runScripts: 'outside-only' });
    dom.window.eval(SRC);
    const M = dom.window.INKO_SOURCES_EMBARQUEES;

    const faux = {
        id: 'test', name: 'Test', capabilities: ['search'],
        popular: async () => ({ results: ['p'] }),
        search: async (p) => ({ results: [p.q] }),
        getManga: async (id) => ({ id }),
        getChapters: async () => [{ id: 'c1' }],       // tableau NU
        getPages: async () => ({ pages: [] }),
    };
    const a = M.adapter(faux);
    for (const m of ['popular', 'latest', 'search', 'get', 'chapters', 'pages', 'tags']) {
        assert.equal(typeof a[m], 'function', `${m}() doit exister après adaptation`);
    }
    return Promise.all([
        a.get('x').then((r) => assert.equal(r.id, 'x')),
        // Un tableau nu doit devenir `{ total, chapters }` : c'est la forme
        // que `serie.js` lit, et rendre un tableau afficherait zéro chapitre.
        a.chapters('x').then((r) => {
            assert.equal(r.total, 1);
            assert.deepEqual(r.chapters, [{ id: 'c1' }]);
        }),
        // `latest` absente retombe sur `popular` plutôt que d'échouer.
        a.latest({}).then((r) => assert.deepEqual(r.results, ['p'])),
        // `search` accepte `title` comme `q` : les deux existent selon la page.
        a.search({ title: 'abc' }).then((r) => assert.deepEqual(r.results, ['abc'])),
    ]);
});

test('MangaDex reste servie nativement, sans passer par l’adaptateur', () => {
    // Elle est une API JSON : la réimplémenter coûtait moins que de charger un
    // fichier pour ça, et elle doit répondre même si les extensions échouent.
    const bloc = /async function chargerExtensions\(\)([\s\S]*?)\n    \}/.exec(SRC);
    assert.match(bloc[1], /if \(parId\.has\(id\)\) continue/);
});

test('le chargement des extensions ne bloque pas l’ouverture de l’app', () => {
    // Neuf `fetch` + neuf SHA-256 avant le premier affichage donneraient une
    // page blanche au lancement. MangaDex répond pendant ce temps.
    assert.match(SRC, /chargerExtensions\(\)\.catch\(/);
});
