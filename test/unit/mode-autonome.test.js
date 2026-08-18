// ============================================================
// test/unit/mode-autonome.test.js — l'app mobile s'ouvre sans PC
// ------------------------------------------------------------
// L'application Android exigeait un hub AVANT de montrer quoi que ce soit :
// on installait, et on tombait sur « configure un serveur ». Le commentaire
// qui gardait ce mur le disait légitime — « sans hub et sans rien de
// téléchargé, il n'y a rien à montrer ». C'était vrai de l'implémentation,
// pas de l'utilisateur : la plupart des gens désinstallent à cet écran.
//
// Le rapport est inversé : l'app s'ouvre, et connecter un ordinateur devient
// une option dans les réglages. Ces tests protègent l'inversion, parce qu'un
// mur se réintroduit facilement — il suffit d'un `return` de plus.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const hub = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'hub.js'), 'utf8');
const api = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'api.js'), 'utf8');

test('sans hub, l’app ne pose plus d’écran bloquant d’office', () => {
    // La branche « aucun hub configuré » ne doit plus appeler `ecran('')`
    // directement : c'est lui, le mur.
    const branche = /if \(!window\.INKO_HUB\) \{([\s\S]*?)\n    \}/.exec(hub);
    assert.ok(branche, 'la branche « aucun hub » doit rester lisible');
    assert.ok(!/^\s*ecran\('/m.test(branche[1]),
        'l’écran de configuration ne doit plus s’ouvrir sans que l’utilisateur le demande');
    assert.match(branche[1], /INKO_AUTONOME\s*=\s*true/,
        'le mode autonome doit être signalé aux pages');
});

test('le choix d’ouverture n’est présenté qu’une fois', () => {
    // Reposer la question à chaque lancement ferait de l'option un mur
    // déguisé — le défaut qu'on vient de retirer, sous un autre nom.
    assert.match(hub, /localStorage\.getItem\('inko_autonome_vu'\)/);
    assert.match(hub, /localStorage\.setItem\('inko_autonome_vu'/);
});

test('l’écran d’accueil propose les DEUX voies, sans en imposer une', () => {
    const ecran = /function accueilAutonome\(\)([\s\S]*?)\n    \}/.exec(hub);
    assert.ok(ecran, 'accueilAutonome doit exister');
    assert.match(ecran[1], /iaSeul/, 'un bouton pour continuer sans ordinateur');
    assert.match(ecran[1], /iaLier/, 'un bouton pour en connecter un');
    // Le bouton « sans ordinateur » doit simplement fermer, jamais rouvrir la
    // configuration par une porte dérobée.
    assert.match(ecran[1], /#iaSeul'\)\.addEventListener\('click', \(\) => \{ retenir\(\); v\.remove\(\); \}\)/);
});

test('connecter un ordinateur reste possible plus tard', () => {
    // Retirer le mur ne doit pas retirer la porte : sans ce point d'entrée,
    // le mode autonome deviendrait un cul-de-sac.
    assert.match(hub, /window\.INKO_changerHub\s*=/,
        'les réglages doivent pouvoir rouvrir la configuration du hub');
});

test('en mode autonome, aucun appel ne part vers un serveur inexistant', () => {
    // Sans ce raccourci, `API_BASE` vaut `http://localhost:8088/api` — une
    // adresse qui n'existe sur aucun téléphone. Chaque appel attendrait son
    // délai complet, et une page qui en enchaîne trente paraîtrait GELÉE :
    // l'app aurait l'air cassée là où elle est seulement non connectée.
    const bloc = /if \(window\.INKO_AUTONOME\) \{([\s\S]*?)\n        \}/.exec(api);
    assert.ok(bloc, 'api.js doit court-circuiter en mode autonome');
    assert.match(bloc[1], /throw e/, 'l’appel doit échouer tout de suite');
    assert.match(bloc[1], /autonome = true/, 'l’erreur doit être reconnaissable');
    // Et le message doit dire QUOI FAIRE, pas seulement ce qui ne va pas.
    assert.match(bloc[1], /Param.tres/, 'le message doit indiquer où connecter un ordinateur');
});

test('« autonome » et « hors ligne » restent deux états distincts', () => {
    // Hors ligne = un hub existe mais ne répond pas (on réessaiera).
    // Autonome  = il n'y en a pas, et c'est un choix.
    // Les confondre ferait réessayer indéfiniment vers rien, ou inversement
    // abandonnerait un hub simplement éteint.
    assert.match(api, /window\.INKO_HORS_LIGNE && method === 'GET'/);
    assert.ok(api.indexOf('INKO_HORS_LIGNE && method') < api.indexOf('if (window.INKO_AUTONOME)'),
        'le cas hors-ligne doit rester traité en premier');
});

test('l’écran de démarrage Android ne porte plus le gabarit Capacitor', () => {
    // C'est le PREMIER écran que voit quiconque ouvre l'app : corriger
    // l'icône du lanceur sans corriger celui-ci laissait le X bleu bien
    // visible. Mesuré : 11 `splash.png` du gabarit, un par densité.
    const res = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
    const restants = [];
    for (const d of fs.readdirSync(res)) {
        if (fs.existsSync(path.join(res, d, 'splash.png'))) restants.push(d + '/splash.png');
    }
    assert.deepEqual(restants, [], `splash.png du gabarit encore présents : ${restants.join(', ')}`);
    assert.ok(fs.existsSync(path.join(res, 'drawable', 'splash.xml')),
        'un écran de démarrage vectoriel doit le remplacer');

    // Un VectorDrawable ne se pose pas via `<bitmap>` : cette balise n'accepte
    // qu'une image matricielle, et l'inflation échouerait — écran vide.
    const splash = fs.readFileSync(path.join(res, 'drawable', 'splash.xml'), 'utf8');
    assert.ok(!/<bitmap[^>]*splash_kanji/.test(splash),
        'le kanji vectoriel doit être posé en android:drawable, pas en <bitmap>');
});
