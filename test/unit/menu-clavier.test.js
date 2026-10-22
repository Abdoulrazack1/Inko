// ============================================================
// test/unit/menu-clavier.test.js — un menu ouvert au clavier se parcourt
// au clavier
// ------------------------------------------------------------
// Chromium émet `contextmenu` au clavier (Maj+F10, touche Menu) sur
// l'élément qui a le focus : le menu de reprise s'ouvrait donc déjà. Mais
// le focus restait sur le bouton. Le menu, ajouté en fin de <body>, n'était
// atteint par Tab qu'après toute la page, sans flèches malgré son
// `role="menu"`.
//
// Vérifié dans Chromium, trois lectures en cours :
//     main        Maj+F10 → focus sur le bouton ; ↓, Fin : rien
//     correctif   Maj+F10 → 1re entrée ; ↓ → 2e ; Fin → dernière ;
//                 ↓ boucle ; Échap → menu fermé, focus rendu au bouton
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const GLOBAL = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'global.js'), 'utf8').replace(/\r\n/g, '\n');

function monter() {
    const dom = new JSDOM(`<!doctype html><body>
        <button id="b">Reprendre</button>
        <div id="m" role="menu"><a role="menuitem" href="#1">Un</a><a role="menuitem" href="#2">Deux</a><a role="menuitem" href="#3">Trois</a></div>
    </body>`, { runScripts: 'outside-only' });
    const w = dom.window;
    const i = GLOBAL.indexOf('window.MH.menuClavier = function');
    assert.notEqual(i, -1, 'MH.menuClavier doit exister');
    w.MH = {};
    w.eval(GLOBAL.slice(i, GLOBAL.indexOf('\n    };\n', i) + 7));
    let ferme = 0;
    const menu = w.document.getElementById('m'), btn = w.document.getElementById('b');
    w.MH.menuClavier(menu, btn, () => { ferme++; });
    const touche = (key) => menu.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    const actif = () => w.document.activeElement.textContent;
    return { touche, actif, ferme: () => ferme };
}

test('à l\'ouverture, le focus entre dans le menu', () => {
    assert.equal(monter().actif(), 'Un');
});

test('flèches, Début et Fin parcourent les entrées, en boucle', () => {
    const m = monter();
    m.touche('ArrowDown'); assert.equal(m.actif(), 'Deux');
    m.touche('End'); assert.equal(m.actif(), 'Trois');
    m.touche('ArrowDown'); assert.equal(m.actif(), 'Un');
    m.touche('ArrowUp'); assert.equal(m.actif(), 'Trois');
    m.touche('Home'); assert.equal(m.actif(), 'Un');
});

test('Échap et Tab referment et rendent le focus au bouton', () => {
    for (const key of ['Escape', 'Tab']) {
        const m = monter();
        m.touche(key);
        assert.equal(m.ferme(), 1, key);
        assert.equal(m.actif(), 'Reprendre', key);
    }
});

test('le menu de reprise s\'en sert, et le bouton annonce son menu', () => {
    assert.match(GLOBAL, /window\.MH\.menuClavier\(menu, btn, fermerMenuReprise\)/);
    assert.match(GLOBAL, /id="btnContinue"[^>]*aria-haspopup="menu"/);
});
