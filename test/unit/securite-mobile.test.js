// ============================================================
// test/unit/securite-mobile.test.js — la surface d'attaque du mode autonome
// ------------------------------------------------------------
// Rendre le téléphone autonome ajoute deux choses qui n'existaient pas : du
// code qui parle DIRECTEMENT à des serveurs tiers, et des données
// personnelles stockées en clair sur l'appareil. Chacune apporte sa famille
// de risques, et aucune n'était couverte par l'audit précédent — qui
// supposait que tout passait par le hub.
//
// Ces tests portent sur ce qui est vérifiable dans le code. Ils ne remplacent
// pas une revue, ils empêchent les régressions les plus coûteuses.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const lire = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const SOURCES = lire('assets/js/sources-embarquees.js');
const MOI = lire('assets/js/moi-local.js');
const API = lire('assets/js/api.js');

function chargerMoi() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>',
        { url: 'http://localhost/', runScripts: 'outside-only' });
    dom.window.eval(MOI);
    return dom.window.INKO_MOI_LOCAL;
}

// ── Le moteur de sources ────────────────────────────────────

test('le moteur ne parle qu’à des hôtes en dur, jamais à une URL reçue', () => {
    // Le vrai danger d'un client HTTP natif : il ne connaît pas CORS, donc
    // rien ne l'empêcherait d'atteindre le réseau LOCAL de l'utilisateur —
    // box, NAS, imprimante — si une URL venait d'une réponse distante.
    // Les bases sont donc des constantes, jamais des paramètres.
    assert.match(SOURCES, /const BASE = 'https:\/\/api\.mangadex\.org'/);
    assert.match(SOURCES, /const COVERS = 'https:\/\/uploads\.mangadex\.org\/covers'/);

    // `appel()` compose BASE + chemin : il ne doit jamais accepter une URL
    // complète, qui ferait sortir de l'hôte prévu.
    const fn = /async function appel\(chemin, params = \{\}, ttl = 60000\) \{([\s\S]*?)\n    \}/.exec(SOURCES);
    assert.ok(fn, 'appel() doit être lisible');
    assert.match(fn[1], /const url = BASE \+ chemin/);
    assert.ok(!/url:\s*chemin\b/.test(fn[1]), 'le chemin ne doit pas servir d’URL complète');
});

test('tout est en HTTPS — aucun appel en clair', () => {
    // ⚠ On retire d'abord les COMMENTAIRES. Ma première version cherchait
    // `http://` dans tout le fichier et mordait sur « l'origine est
    // http://localhost » — une explication, pas un appel. Un contrôle qui
    // signale du texte finit par être désactivé, et ne protège plus rien.
    const codeSeul = SOURCES
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
    const clairs = [...codeSeul.matchAll(/['"`]http:\/\/[a-z]/gi)];
    assert.deepEqual(clairs.map((m) => m[0]), [],
        'un appel en clair exposerait les lectures à qui écoute le Wi-Fi');
});

test('une réponse non-JSON ne fait pas tomber le module', () => {
    // Portail Wi-Fi captif, page de maintenance : le corps est du HTML.
    // `JSON.parse` lèverait, et l'application paraîtrait cassée alors que
    // c'est le réseau qui détourne.
    assert.match(SOURCES, /typeof r\.data === 'string' \? JSON\.parse\(r\.data\) : r\.data/);
});

test('les codes d’erreur deviennent des messages, pas des nombres bruts', () => {
    for (const code of ['429', '503', '404']) {
        assert.ok(SOURCES.includes(code), `le code ${code} doit être traduit`);
    }
});

// ── Les données personnelles ────────────────────────────────

test('le magasin local ne sert QUE des chemins connus', () => {
    // Un `case` par ressource, et `default: return ABSENT`. Sans ce refus par
    // défaut, un chemin inattendu tomberait dans une branche voisine.
    assert.match(MOI, /default:\s*\n\s*return ABSENT;/);
    const M = chargerMoi();
    assert.equal(M.repondre('GET', '/me/../admin/users'), M.ABSENT);
    assert.equal(M.repondre('GET', '/admin/users'), M.ABSENT);
    assert.equal(M.repondre('DELETE', '/me'), M.ABSENT);
});

test('le magasin ne touche jamais au jeton de session', () => {
    // Il vit dans un cookie httpOnly (SEC-06) précisément pour qu'aucun script
    // ne puisse le lire. Le magasin local ne doit pas en garder une copie.
    assert.ok(!/mh_session|inko_token|access_token|Authorization/.test(MOI),
        'aucune trace de jeton de session dans le magasin');
});

test('le journal local est borné, et la borne est appliquée', () => {
    // Un journal sans plafond finit par occuper toute la place disponible :
    // le même défaut que DB-06 côté serveur, transposé sur le téléphone.
    const M = chargerMoi();
    for (let i = 0; i < 2200; i++) M.repondre('POST', '/me/read-chapters', { mangaId: 'm', chapterId: 'c' + i });
    assert.ok(M._etat().events.length <= 2000);
});

test('un stockage plein est DIT, jamais avalé', () => {
    // Une donnée perdue en silence est pire qu'un message d'erreur : on croit
    // avoir enregistré, et on découvre la perte plus tard.
    const bloc = /function ecrire\(\) \{([\s\S]*?)\n    \}/.exec(MOI);
    assert.match(bloc[1], /toast/, 'l’échec d’écriture doit être annoncé');
    assert.match(bloc[1], /return false/);
});

// ── AniList ─────────────────────────────────────────────────

test('AniList : la redirection est calculée depuis l’origine réelle', () => {
    // Recopier le `redirectUri` du serveur enverrait le jeton vers l'adresse
    // du hub, pas vers l'app : sur le téléphone l'origine est
    // `http://localhost`, et le jeton n'arriverait jamais.
    assert.match(MOI, /redirectUri: location\.origin \+ '\/anilist\.html'/);
});

test('AniList : le Client ID est borné à ce qu’on a écrit', () => {
    const M = chargerMoi();
    M.repondre('PUT', '/anilist/config', { clientId: '  12345  ' });
    assert.equal(M.repondre('GET', '/anilist/config').clientId, '12345', 'les espaces sont retirés');
    // Un identifiant vide retombe sur celui par défaut plutôt que de laisser
    // une URL d'autorisation sans client_id, qu'AniList refuserait.
    M.repondre('PUT', '/anilist/config', { clientId: '' });
    assert.ok(M.repondre('GET', '/anilist/config').clientId, 'un repli existe');
});

// ── La politique réseau d'Android ───────────────────────────

test('les hôtes contactés en direct sont interdits de trafic en clair', () => {
    // Le mode autonome fait dialoguer le téléphone avec MangaDex et AniList
    // sans passer par le hub. Le clair reste autorisé globalement (le hub en
    // a besoin, son adresse est en DHCP) — mais ces domaines-là sont publics
    // et joignables en HTTPS : les laisser retomber en clair permettrait à un
    // Wi-Fi hostile de lire ce que l'utilisateur consulte.
    //
    // ⚠ On retire les COMMENTAIRES XML avant de lire les domaines : le
    // fichier en CITE un dans son explication historique
    // (`<domain>192.168.0.0</domain>`), et ma première version du contrôle le
    // comptait comme une règle active. Il aurait donc passé même si la vraie
    // règle avait disparu.
    const brut = lire('android/app/src/main/res/xml/network_security_config.xml');
    const xml = brut.replace(/<!--[\s\S]*?-->/g, '');

    const bloc = /<domain-config cleartextTrafficPermitted="false">([\s\S]*?)<\/domain-config>/.exec(xml);
    assert.ok(bloc, 'un bloc interdisant le clair doit exister');
    const domaines = [...bloc[1].matchAll(/<domain[^>]*>([^<]+)<\/domain>/g)].map((m) => m[1].trim());

    // Tous les hôtes réellement appelés doivent être couverts.
    const code = lire('assets/js/sources-embarquees.js') + lire('assets/js/anilist.js');
    const hotes = new Set([...code.matchAll(/https:\/\/([a-z0-9.-]+)/g)].map((m) => m[1]));
    const nus = [...hotes].filter((h) => !domaines.some((d) => h === d || h.endsWith('.' + d)));
    assert.deepEqual(nus, [], `hôtes contactés sans exigence HTTPS : ${nus.join(', ')}`);

    // Les serveurs de planches de MangaDex changent de nom à chaque chapitre.
    assert.ok(domaines.includes('mangadex.network'),
        'les serveurs de planches (*.mangadex.network) doivent être couverts');
});

// ── Le routage général ──────────────────────────────────────

test('sans hub, aucune écriture ne part vers le réseau', () => {
    // Router une écriture vers un serveur inexistant la mettrait dans la file
    // hors-ligne, qui la rejouerait indéfiniment vers rien.
    const bloc = /async function viaSourcesEmbarquees\(method, path\) \{([\s\S]*?)\n    \}/.exec(API);
    assert.match(bloc[1], /method !== 'GET'\) return ABSENT/);
});

test('le mode autonome est évalué AVANT toute requête sortante', () => {
    // Placé après, chaque appel partirait d'abord vers `localhost:8088` et
    // attendrait son délai — trente par page, l'app paraîtrait gelée.
    const iAuto = API.indexOf('if (window.INKO_AUTONOME)');
    const iFetch = API.indexOf('const ctrl  = new AbortController()');
    assert.ok(iAuto > 0 && iFetch > 0);
    assert.ok(iAuto < iFetch, 'le court-circuit doit précéder la requête réseau');
});

test('les pages injectées dans le paquet mobile gardent leur ordre', () => {
    // `api.js` consulte `INKO_SOURCES_EMBARQUEES` et `INKO_MOI_LOCAL` : chargés
    // après lui, ils existeraient trop tard pour le premier appel de la page.
    const build = lire('scripts-ci/build-mobile-www.js');
    const b = /const balises = \[([\s\S]*?)\];/.exec(build)[1];
    const ordre = ['natif.js', 'hub.js', 'sources-embarquees.js', 'moi-local.js'];
    let pos = -1;
    for (const f of ordre) {
        const i = b.indexOf(f);
        assert.ok(i > pos, `${f} doit venir après le précédent`);
        pos = i;
    }
});
