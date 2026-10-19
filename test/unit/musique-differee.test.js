// ============================================================
// test/unit/musique-differee.test.js — ne pas bâtir un lecteur qu'on n'ouvre pas
// ------------------------------------------------------------
// `global.js` injecte `music.js` sur TOUTES les pages. Le module construisait
// alors son dock complet — 167 nœuds — et demandait sa feuille de style, puis
// masquait le tout quand le lecteur n'avait jamais été ouvert. Sur une page
// d'accueil qui en compte 1 049, c'est 14 % du DOM bâti pour rien, à chaque
// chargement, pour quelqu'un qui n'écoute pas de musique.
//
// Le report ne peut pas être inconditionnel : le lecteur porte la reprise
// entre les pages. Si de la musique joue, le dock doit revenir tout seul sur
// la page suivante. Ces tests tiennent les deux moitiés de cette règle, et le
// défaut qui s'est glissé entre elles.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'assets', 'js', 'music.js'), 'utf8');

/**
 * Charge `music.js` avec un état de lecteur donné, comme le ferait une page.
 * `etat` est ce que `localStorage` contient avant le chargement — c'est par là
 * que passe la mémoire d'une page à l'autre.
 */
async function charger(etat) {
    const dom = new JSDOM('<!doctype html><html><body></body></html>',
        { url: 'http://localhost/accueil.html', runScripts: 'outside-only' });
    const w = dom.window;
    w.MH = { err() {}, toast() {} };
    if (etat) w.localStorage.setItem('inko_music_v2', JSON.stringify(etat));
    w.eval(SRC);
    // Sous jsdom, `document.readyState` vaut « loading » : le module attend
    // donc `DOMContentLoaded`, qui est asynchrone. Sans ce tour de boucle on
    // mesurerait AVANT l'initialisation, et le test dirait « rien n'est
    // bâti » quelle que soit la vérité.
    await new Promise(r => setTimeout(r, 0));
    return {
        w,
        dock: () => w.document.getElementById('inko-music'),
        css: () => !!w.document.querySelector('link[href*="music.css"]'),
        etat: () => JSON.parse(w.localStorage.getItem('inko_music_v2') || '{}'),
        noeuds: () => w.document.getElementsByTagName('*').length,
    };
}

test('un lecteur jamais ouvert ne bâtit rien du tout', async () => {
    const m = await charger(null);
    assert.equal(m.dock(), null, 'aucun dock dans le DOM');
    assert.equal(m.css(), false, 'et aucune feuille de style demandée');
    assert.equal(typeof m.w.Music, 'object',
        'l’API publique existe quand même : c’est elle qui bâtira');
});

test('ouvrir le lecteur le bâtit, et l’état part en mémoire', async () => {
    const m = await charger(null);
    const avant = m.noeuds();
    m.w.Music.open();

    assert.ok(m.dock(), 'le dock existe après ouverture');
    assert.equal(m.css(), true, 'la feuille de style suit');
    assert.ok(m.noeuds() - avant > 50,
        'le dock représente un volume de DOM réel — c’est tout l’enjeu');
    assert.equal(m.etat().visible, true,
        'l’ouverture doit être ENREGISTRÉE, sinon elle ne survit pas à la page suivante');
});

test('un lecteur laissé ouvert revient de lui-même sur la page suivante', async () => {
    // C'est la moitié de la règle qu'un report trop zélé casserait : la
    // musique joue, on change de page, le dock doit être là sans qu'on
    // le redemande.
    const m = await charger({ visible: true, min: false, enPause: true, mode: null });
    assert.ok(m.dock(), 'le dock est bâti dès le chargement');
    assert.equal(m.dock().style.display, 'flex', 'et il est visible');
});

test('un lecteur fermé ne bâtit rien sur la page suivante', async () => {
    const m = await charger({ visible: false, min: false, enPause: true, mode: null });
    assert.equal(m.dock(), null);
    assert.equal(m.css(), false);
});

test('une construction tardive laisse le dock dans l’état « fermé »', async () => {
    // Le défaut introduit en écrivant ce correctif, vu en naviguant :
    // `init()` posait `display` juste après `build()`. En construisant plus
    // tard sans le faire, `root.style.display` vaut '' au lieu de 'none' —
    // `toggle()` ne reconnaît alors pas « fermé », expose le panneau sans
    // jamais poser `S.visible`, et le lecteur disparaît au changement de page.
    //
    // On éprouve la conséquence, pas la ligne : `toggle()` sur un lecteur
    // jamais ouvert doit l'ouvrir POUR DE BON.
    const m = await charger(null);
    m.w.Music.toggle();

    assert.equal(m.etat().visible, true,
        'basculer depuis l’état vierge doit enregistrer l’ouverture');
    assert.equal(m.dock().style.display, 'flex',
        'et montrer le dock, pas seulement déplier le panneau');
});

test('fermer après une construction tardive laisse une trace cohérente', async () => {
    const m = await charger(null);
    m.w.Music.open();
    m.w.Music.close();
    assert.equal(m.etat().visible, false);
    assert.equal(m.dock().style.display, 'none');
});
