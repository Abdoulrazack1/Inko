// ============================================================
// test/frontend.global.test.js — MH (assets/js/global.js)
// ------------------------------------------------------------
// Audit QUAL-02 : 7 900 lignes de JS frontend sans un seul test. On couvre ici
// les fonctions dont une régression ne casse RIEN de visible — elle rend la
// page fausse, lente ou vulnérable en silence. Chaque bloc correspond à un
// constat d'audit déjà corrigé : ces tests existent pour qu'il ne revienne pas.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { loadGlobal } = require('./helpers/dom');

// Un seul chargement pour tout le fichier : global.js n'a pas d'état mutable
// partagé entre ces fonctions, et recharger un DOM par test coûterait ~1 s pièce.
const win = loadGlobal();
const MH = win.MH;

// Vérifie l'injection sur le DOM RÉSULTANT, pas sur la chaîne HTML.
// Chercher « <script> » ou « onerror= » dans le texte produit est trompeur :
// une charge utile correctement échappée contient toujours ces caractères, en
// tant que texte affiché. La seule question qui compte est : après insertion,
// le document contient-il un nœud ou un attribut capable de s'exécuter ?
function noeudsExecutables(html) {
    const hote = win.document.createElement('div');
    hote.innerHTML = html;
    return {
        scripts: hote.querySelectorAll('script').length,
        iframes: hote.querySelectorAll('iframe').length,
        gestionnaires: attributsEvenementiels(html).length,
    };
}
function attributsEvenementiels(html) {
    const hote = win.document.createElement('div');
    hote.innerHTML = html;
    const trouves = [];
    hote.querySelectorAll('*').forEach(el => {
        for (const a of el.attributes) if (/^on/i.test(a.name)) trouves.push(a.name);
    });
    return trouves;
}

// ── SEC-01 : échappement HTML ────────────────────────────────
// La faille d'origine : un titre de série contenant du HTML était inséré tel
// quel dans `innerHTML`. La charge utile ci-dessous est celle qui a servi à
// démontrer l'injection pendant l'audit.
test('esc neutralise la charge utile qui exploitait SEC-01', () => {
    const out = MH.esc('<img src=x onerror=alert(1)>');
    assert.ok(!out.includes('<'), 'aucun chevron ouvrant ne doit subsister');
    assert.ok(!out.includes('>'), 'aucun chevron fermant ne doit subsister');
    assert.strictEqual(out, '&lt;img src=x onerror=alert(1)&gt;');
});

test('esc échappe aussi les quotes — sinon on sort d’un attribut', () => {
    // Le cas le plus facile à oublier : sans échapper " et ', une valeur
    // injectée dans href="..." peut fermer l'attribut et en ouvrir un autre
    // (onmouseover=…), sans jamais utiliser de chevron.
    assert.strictEqual(MH.esc('a"b\'c&d'), 'a&quot;b&#39;c&amp;d');
    // On vérifie le RÉSULTAT PARSÉ, pas la chaîne : chercher « onmouseover »
    // dans du HTML échappé donne un faux positif, puisque le texte échappé
    // contient légitimement ces caractères. Seul le DOM dit la vérité.
    assert.deepStrictEqual(
        attributsEvenementiels(`<a href="${MH.esc('" onmouseover="alert(1)')}">x</a>`), [],
        'une valeur échappée ne doit produire aucun gestionnaire d’événement');
});

test('esc traite null, undefined et les nombres sans lever', () => {
    assert.strictEqual(MH.esc(null), '');
    assert.strictEqual(MH.esc(undefined), '');
    assert.strictEqual(MH.esc(42), '42');
    assert.strictEqual(MH.esc(0), '0');   // piège classique : 0 est falsy
});

// ── PERF-08 / BUG-14 : routage des images par le proxy ───────
// L'audit avait relevé 326 images chargées en direct depuis des hôtes tiers :
// fuite de l'adresse IP de l'utilisateur vers le site scrapé, et casse dès que
// l'hôte refuse le hotlink.
test('cover route les URL externes par /api/img', () => {
    assert.strictEqual(
        MH.cover('https://cdn.exemple.fr/a.jpg', null),
        '/api/img?u=' + encodeURIComponent('https://cdn.exemple.fr/a.jpg'));
});

test('cover ne double PAS le proxy sur une URL déjà proxifiée', () => {
    // Une double proxification produit /api/img?u=%2Fapi%2Fimg... → 404.
    assert.strictEqual(MH.cover('/api/img?u=x', null), '/api/img?u=x');
});

test('cover laisse intactes les URL locales et data:', () => {
    assert.strictEqual(MH.cover('data:image/png;base64,AA', null), 'data:image/png;base64,AA');
    assert.strictEqual(MH.cover('/assets/img/x.png', null), '/assets/img/x.png');
});

test('cover retombe sur le repli quand il n’y a pas d’image', () => {
    assert.strictEqual(MH.cover(null, 'REPLI'), 'REPLI');
    assert.strictEqual(MH.cover('', 'REPLI'), 'REPLI');
});

test('placeholderCover produit une image autonome, sans requête réseau', () => {
    const p = MH.placeholderCover('abc');
    assert.ok(p.startsWith('data:image/svg+xml'), 'doit être une data-URI, pas une URL');
    // Stable : la même série doit garder la même couverture de repli d'une
    // page à l'autre, sinon la grille scintille à chaque rendu.
    assert.strictEqual(p, MH.placeholderCover('abc'));
    assert.notStrictEqual(p, MH.placeholderCover('def'));
});

// ── Affichage des numéros de chapitre ────────────────────────
test('chapNum n’affiche pas de décimale inutile', () => {
    assert.strictEqual(String(MH.chapNum(12)), '12');
    assert.strictEqual(String(MH.chapNum(12.0)), '12');
    assert.strictEqual(String(MH.chapNum(12.5)), '12.5');
});

test('chapNum dégrade proprement une valeur absente', () => {
    // Les sources scrapées renvoient parfois null : il faut un repli lisible
    // plutôt que « NaN » ou « null » dans l'interface.
    assert.strictEqual(MH.chapNum(null), '?');
    assert.strictEqual(MH.chapNum(undefined), '?');
});

// ── Dates relatives ──────────────────────────────────────────
test('relTime rend une durée lisible et bornée', () => {
    const ilYA = (ms) => MH.relTime(new Date(Date.now() - ms).toISOString());
    assert.match(ilYA(90 * 1000), /min/);
    assert.match(ilYA(3 * 86400 * 1000), /3\s*j/);
    assert.match(ilYA(5 * 3600 * 1000), /h/);
});

test('relTime ne produit jamais « Invalid Date »', () => {
    // Une date absente ou malformée ne doit pas afficher un message technique.
    for (const mauvais of [null, undefined, '', 'pas-une-date']) {
        const out = String(MH.relTime(mauvais));
        assert.ok(!/Invalid Date|NaN/.test(out),
            `relTime(${JSON.stringify(mauvais)}) a produit « ${out} »`);
    }
});

// ── notifItemHTML : rendu de contenu venant du serveur ───────
// Titre, corps et lien d'une notification peuvent contenir un titre de série,
// donc du texte tiers. C'est un point d'injection direct.
test('notifItemHTML échappe le titre, le corps et le lien', () => {
    const html = MH.notifItemHTML({
        id: 1, type: 'chapter',
        title: '<script>alert(1)</script>',
        body:  '"><img src=x onerror=alert(2)>',
        link:  '" onmouseover="alert(3)',
        read: false, at: new Date().toISOString(),
    });
    assert.deepStrictEqual(noeudsExecutables(html), { scripts: 0, iframes: 0, gestionnaires: 0 },
        'aucun nœud ni attribut exécutable ne doit naître d’une notification');
});

test('esc neutralise aussi les charges utiles sans chevron', () => {
    // Rappel de ce que ces tests vérifient VRAIMENT : le texte hostile a le
    // droit d’apparaître à l’écran, il n’a pas le droit de s’exécuter.
    const html = `<div title="${MH.esc('x" onfocus="alert(1)" autofocus="')}">t</div>`;
    assert.deepStrictEqual(attributsEvenementiels(html), []);
});

test('notifItemHTML affiche une date valide à partir du champ « at » du serveur', () => {
    // notif.controller.js mappe created_at → at. Si l'un des deux côtés
    // renomme le champ, l'interface afficherait « Invalid Date » sans erreur.
    const html = MH.notifItemHTML({ id: 1, type: 'chapter', title: 'T', at: new Date().toISOString() });
    assert.ok(!html.includes('Invalid Date'), 'le champ « at » doit être celui que lit le rendu');
});

test('notifItemHTML distingue lue et non lue', () => {
    const nonLue = MH.notifItemHTML({ id: 1, type: 'chapter', title: 'T', read: false, at: new Date().toISOString() });
    const lue    = MH.notifItemHTML({ id: 1, type: 'chapter', title: 'T', read: true,  at: new Date().toISOString() });
    assert.ok(nonLue.includes('unread'));
    assert.ok(!lue.includes('unread'));
});

// ── Filtrage du contenu adulte ───────────────────────────────
test('isAdultManga reconnaît le classement pornographique', () => {
    assert.strictEqual(MH.isAdultManga({ contentRating: 'pornographic' }), true);
    assert.strictEqual(MH.isAdultManga({ contentRating: 'safe' }), false);
    assert.strictEqual(MH.isAdultManga({}), false);
});

test('nsfwCardAttrs marque la carte pour que le CSS puisse la flouter', () => {
    assert.match(MH.nsfwCardAttrs({ contentRating: 'pornographic' }), /data-nsfw="1"/);
    assert.strictEqual(MH.nsfwCardAttrs({ contentRating: 'safe' }), '');
});

// ── Vocabulaire manga / roman ────────────────────────────────
test('unitLabel emploie le bon mot selon le type de source', () => {
    assert.strictEqual(MH.unitLabel('weebcentral'), 'Chapitre');
    assert.strictEqual(MH.unitLabel('weebcentral', { short: true }), 'Chap.');
});

// ── Lien vers le lecteur ─────────────────────────────────────
test('readerHref encode ses paramètres', () => {
    const href = MH.readerHref('m 1', 'c&1', 'weebcentral');
    assert.ok(!/[ ]/.test(href), 'aucune espace brute dans une URL');
    assert.ok(href.includes('chapter=c%261'), 'le & doit être encodé, sinon il coupe la query');
});

// ── Badges de statut ─────────────────────────────────────────
test('statusBadge produit un badge pour chaque statut connu', () => {
    for (const s of ['ongoing', 'completed', 'hiatus']) {
        const b = MH.statusBadge(s);
        assert.match(b, /<span class="badge/, `statut « ${s} » sans badge`);
    }
});
