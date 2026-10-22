// ============================================================
// test/unit/feuille-focus.test.js — une feuille modale garde le clavier
// ------------------------------------------------------------
// La feuille déclare `role="dialog"` et `aria-modal="true"`, mais ne tenait
// pas la promesse. Mesuré dans Chromium sur les filtres du catalogue à
// 390 px :
//     main        focus resté sur le bouton d'ouverture ; le 1er Tab part
//                 derrière le voile, dans la page masquée
//     correctif   focus sur le 1er contrôle ; 40 Tab et 40 Maj+Tab restent
//                 dans la feuille ; Échap rend le focus au bouton « Filtres »
// Les e2e echap.spec et focus-clavier.spec restent verts.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'feuille.js'), 'utf8');

function monter() {
    const dom = new JSDOM('<!doctype html><body><button id="ouvrir">Filtres</button><a id="derriere" href="#">page</a></body>',
        { runScripts: 'outside-only', pretendToBeVisual: true });
    const w = dom.window;
    // jsdom ne calcule pas de mise en page : tout élément y a offsetParent null.
    Object.defineProperty(w.HTMLElement.prototype, 'offsetParent', { get() { return w.document.body; } });
    w.MH = { esc: (t) => String(t) };
    w.eval(SRC);
    const ouvrir = w.document.getElementById('ouvrir');
    ouvrir.focus();
    const contenu = w.document.createElement('div');
    contenu.innerHTML = '<input id="a"><input id="b">';
    const h = w.MH.feuille({ titre: 'Filtres', contenu, actions: [{ libelle: 'Voir', principal: true, onClick: ({ fermer }) => fermer() }] });
    const tab = (shiftKey = false) => {
        const e = new w.KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
        w.document.activeElement.dispatchEvent(e);
        return e.defaultPrevented;
    };
    return { w, h, tab, actif: () => w.document.activeElement, feuille: () => w.document.querySelector('.mh-feuille') };
}

const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

test('à l\'ouverture, le focus entre dans la feuille', async () => {
    const m = monter();
    await attendre(150);
    assert.ok(m.feuille().contains(m.actif()), `focus sur ${m.actif().id || m.actif().tagName}`);
});

test('Tab depuis le dernier contrôle revient au premier, Maj+Tab depuis le premier va au dernier', async () => {
    const m = monter();
    await attendre(150);
    const l = [...m.feuille().querySelectorAll('button, input')];
    l[l.length - 1].focus();
    assert.equal(m.tab(), true, 'le Tab est retenu');
    assert.equal(m.actif(), l[0]);
    assert.equal(m.tab(true), true);
    assert.equal(m.actif(), l[l.length - 1]);
});

test('à la fermeture, le focus revient au bouton qui l\'a ouverte', async () => {
    const m = monter();
    await attendre(150);
    m.w.document.activeElement.dispatchEvent(new m.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await attendre(50);
    assert.equal(m.actif().id, 'ouvrir');
});
