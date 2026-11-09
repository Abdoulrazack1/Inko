// ============================================================
// test/unit/bac-a-sable-extension.test.js — essayer une extension sur
// une serie, sans l'activer
// ------------------------------------------------------------
// Le dernier des cinquante qui manquait vraiment.
//
// « Tester » existait, et ne repond qu'a une question : la source
// repond-elle ? Un appel, `limit: 1`, un temps. C'est utile quand une
// source tombe, et insuffisant pour decider de l'activer — une source
// peut repondre a une recherche et ne jamais rendre de chapitres, ou
// rendre des chapitres sans pages lisibles. On le decouvrait en
// l'activant, puis en s'etonnant.
//
// Le bac a sable deroule la CHAINE COMPLETE sur une seule oeuvre et rend
// chaque etape separement, avec son temps. Une source casse presque
// toujours a UNE etape ; un verdict global ne dit pas laquelle.
//
// ── Mesure, sur les sources reelles ──
//
//   weebcentral   recherche 260 ms, fiche 36 ms, 556 chapitres 270 ms,
//                 16 pages 1 ms  ->  complet
//   mangadex      recherche et fiche passent, 0 chapitre  ->  partiel
//   royalroad     HTTP 403 des la premiere etape  ->  rien ne passe
//   gutenberg     aucune reponse en 20 s  ->  rien ne passe
//
// Les deux derniers confirment ce que le chantier notait deja : ces
// sources sont inaccessibles depuis cette machine. Le bac a sable le
// DIT, au lieu de laisser deviner.
//
// ── Deux fautes a moi, rattrapees par la verification ──
//
// 1. Mon premier lecteur de liste n'acceptait que `{ chapters }` et un
//    tableau nu. Les extensions rendent aussi `{ total, results }` :
//    j'annoncais « aucun chapitre » sur une serie qui en a 556. Un outil
//    de diagnostic qui se trompe est pire que pas d'outil — et c'est la
//    meme divergence de forme que le chantier avait deja relevee entre
//    le moteur embarque et le hub.
// 2. Le rapport indentait ses details avec des espaces ; la modale rend
//    le texte en `pre-line`, qui les collapse. Vu dans la page.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const lire = (...p) => fs.readFileSync(path.join(RACINE, ...p), 'utf8').replace(/\r\n/g, '\n');
const { essayer } = require(path.join(RACINE, 'server', 'lib', 'bac-a-sable.js'));

/** Une extension de pacotille, qui rend ce qu'on lui dit de rendre. */
function fausseSource(plan) {
    return {
        id: 'essai',
        search: async () => plan.recherche,
        popular: plan.populaire === undefined ? undefined : async () => plan.populaire,
        getManga: async () => plan.fiche,
        getChapters: async () => plan.chapitres,
        getPages: plan.pages === undefined ? undefined : async () => plan.pages,
        getText: plan.texte === undefined ? undefined : async () => plan.texte,
    };
}

test('une source complete rend quatre etapes vertes', async () => {
    const r = await essayer(fausseSource({
        recherche: { results: [{ id: 'x1', title: 'Une série' }] },
        fiche: { id: 'x1', title: 'Une série', cover: 'u', status: 'ongoing', tags: ['a', 'b'] },
        chapitres: { total: 3, results: [{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }] },
        pages: ['https://cdn.exemple.org/1.jpg', 'https://cdn.exemple.org/2.jpg'],
    }), 'une');
    assert.equal(r.etapes.length, 4);
    assert.deepEqual(r.etapes.map((e) => e.ok), [true, true, true, true]);
    assert.match(r.verdict, /complet/);
    assert.match(r.etapes[2].detail, /3 chapitre/);
    assert.match(r.etapes[3].detail, /cdn\.exemple\.org/, 'l’hôte des pages est dit : c’est lui qu’on contactera');
});

test('les TROIS formes de liste sont acceptées', async () => {
    // La faute qui m'a fait annoncer « aucun chapitre » sur 556.
    for (const forme of [
        [{ id: 'c1' }],                              // tableau nu
        { results: [{ id: 'c1' }] },                 // { results }
        { chapters: [{ id: 'c1' }] },                // { chapters }
    ]) {
        const r = await essayer(fausseSource({
            recherche: [{ id: 'x', title: 'T' }],
            fiche: { id: 'x', title: 'T' },
            chapitres: forme,
            pages: ['u'],
        }), 'T');
        const chap = r.etapes.find((e) => e.etape === 'liste des chapitres');
        assert.equal(chap.ok, true, JSON.stringify(forme));
    }
});

test('l’étape qui casse est DÉSIGNÉE, pas résumée', async () => {
    const r = await essayer(fausseSource({
        recherche: [{ id: 'x', title: 'T' }],
        fiche: { id: 'x', title: 'T' },
        chapitres: { total: 0, results: [] },
        pages: [],
    }), 'T');
    assert.equal(r.verdict, 'partiel : liste des chapitres');
    const chap = r.etapes.find((e) => e.etape === 'liste des chapitres');
    assert.equal(chap.ok, false);
    assert.match(chap.detail, /langue réglée/,
        'une œuvre sans chapitre dans la langue réglée n’est pas une source cassée : le dire');
    assert.equal(r.etapes.length, 3, 'on s’arrête : sans chapitre, il n’y a pas de page à chercher');
});

test('une source muette s’arrête à la première étape', async () => {
    const r = await essayer({ id: 'muette', search: async () => { throw new Error('HTTP 403'); } }, 'x');
    assert.equal(r.etapes.length, 1);
    assert.match(r.etapes[0].erreur, /403/);
    assert.match(r.verdict, /aucune étape ne passe/);
});

test('chaque étape est bornée dans le temps', async () => {
    // Sans borne, une source qui ne repond jamais laisse l'essai ouvert,
    // et l'utilisateur regarde un bouton desactive sans savoir pourquoi.
    const src = lire('server', 'lib', 'bac-a-sable.js');
    assert.match(src, /function avecDelai\(p, ms, quoi\)/);
    assert.match(src, /Promise\.race\(\[p, limite\]\)\.finally\(\(\) => clearTimeout\(t\)\)/,
        'le minuteur doit être nettoyé, sinon le processus ne rend pas la main');
    assert.match(src, /pas de réponse en \$\{Math\.round\(ms \/ 1000\)\} s/,
        'le message doit dire combien de temps on a attendu');
});

test('le bac à sable n’active rien et n’écrit rien', async () => {
    // C'est toute la raison d'etre du mode. Un bac a sable qui laisse des
    // traces n'en est pas un.
    const src = lire('server', 'lib', 'bac-a-sable.js');
    for (const interdit of ['setDefault', 'activate', 'enable', 'pool.query', 'INSERT', 'UPDATE', 'setPref']) {
        assert.ok(!src.includes(interdit), 'le module ne doit pas contenir ' + interdit);
    }
    // Et il appelle UNE fois chaque methode : un essai ne doit pas
    // devenir une charge pour le site d'en face.
    let appels = 0;
    const compteur = new Proxy(fausseSource({
        recherche: [{ id: 'x', title: 'T' }],
        fiche: { id: 'x', title: 'T' },
        chapitres: [{ id: 'c1' }],
        pages: ['u'],
    }), { get(c, k) { if (typeof c[k] === 'function') appels++; return c[k]; } });
    await essayer(compteur, 'T');
    assert.ok(appels <= 6, appels + ' accès aux méthodes : un essai doit rester léger');
});

test('la route passe par le limiteur des relais, et borne la requête', () => {
    const r = lire('server', 'routes', 'index.js');
    assert.match(r, /router\.post\('\/extensions\/:id\/bac-a-sable', auth\.authRequired, relayLimiter, Ext\.bacASable\);/,
        'elle sort vers un site tiers : même limiteur que les relais');
    const c = lire('server', 'controllers', 'extensions.controller.js');
    assert.match(c, /\.slice\(0, 200\)/, 'ce champ part vers un site tiers : il se borne');
});

test('le rapport est rendu en TEXTE, jamais en HTML', () => {
    // Il contient des titres d'oeuvres et des messages d'erreur venus
    // d'un site tiers. Les rendre en HTML ouvrirait une injection dans la
    // page des reglages, en echange d'un gras.
    const s = lire('assets', 'js', 'sources.js');
    const i = s.indexOf('    function rapportBac(r) {');
    assert.notEqual(i, -1, 'rapportBac doit rester repérable');
    const b = s.slice(i, s.indexOf('\n    }', i));
    assert.ok(!/innerHTML|<b>|<span/.test(b), 'aucun HTML dans le rapport');
    assert.match(b, /Aucune source n’a été activée/,
        'le rapport doit rappeler que rien n’a été touché');
    assert.match(s, /MH\.alert\(rapportBac\(r\), \{ title:/, 'une modale de texte');
});
