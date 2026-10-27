// ============================================================
// test/unit/motif-panneau.test.js — un seul motif de panneau
// ------------------------------------------------------------
// Neuf panneaux distincts, relevés dans les scripts. Chacun redéclarait
// une partie du comportement, aucun les quatre :
//
//     focus rendu à l'ouvrant      1 / 9
//     piège de focus (Tab)         2 / 9
//     Échap ferme                  7 / 9
//     aria-modal                   8 / 9
//
// `aria-modal="true"` est une PROMESSE faite aux technologies
// d'assistance : derrière ce dialogue, il n'y a rien. Huit la font, un
// seul la tenait.
//
// Mesuré sur `MH.confirm` dans la page réelle, avant :
//     le dialogue s'ouvre et le focus N'Y ENTRE PAS — il reste sur le
//     bouton qui l'a ouvert, derrière le voile — puis le premier Tab
//     part dans la page masquée.
// Après : le focus entre sur le premier bouton, Tab depuis le dernier
// revient au premier, Échap ferme et rend le focus à l'ouvrant. Vérifié
// de même sur la feuille des filtres du catalogue à 375 px.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const JS = path.join(__dirname, '..', '..', 'assets', 'js');
const lire = (f) => fs.readFileSync(path.join(JS, f), 'utf8');
const GLOBAL = lire('global.js');

// Les panneaux qui promettent `aria-modal` ou déclarent `role="dialog"`.
const PANNEAUX = fs.readdirSync(JS)
    .filter(f => f.endsWith('.js'))
    .map(f => [f, lire(f)])
    // Les deux façons de le promettre : dans un gabarit, ou par `setAttribute`.
    .filter(([, s]) => /aria-modal="true"|setAttribute\(\s*['"]aria-modal['"]/.test(s));

test('tout panneau qui promet aria-modal passe par le piège partagé', () => {
    const fautes = PANNEAUX
        .filter(([, s]) => !/piegerFocus/.test(s))
        .map(([f]) => f);
    assert.deepEqual(fautes, [],
        `ils annoncent « dialogue modal » sans tenir le clavier :\n  ${fautes.join('\n  ')}`);
    assert.ok(PANNEAUX.length >= 6, `on en attend au moins six, trouvé ${PANNEAUX.length}`);
});

test('le piège n\'existe qu\'à un seul endroit', () => {
    // `feuille.js` le portait ; il en a été extrait. S'il le reprenait,
    // on aurait de nouveau deux comportements à maintenir.
    const definitions = fs.readdirSync(JS)
        .filter(f => f.endsWith('.js'))
        .filter(f => /piegerFocus\s*=\s*function/.test(lire(f)));
    assert.deepEqual(definitions, ['global.js'], 'une seule définition');
    assert.ok(!/const focusables = \(\) =>/.test(lire('feuille.js')),
        'feuille.js ne doit plus porter sa propre liste de focusables');
});

test('le piège fait les trois choses, et toujours les trois', () => {
    // On exécute la VRAIE fonction, découpée dans sa source : un test qui
    // relit du code sans le lancer ne prouve pas un comportement.
    const debut = GLOBAL.indexOf('window.MH.piegerFocus = function');
    assert.ok(debut > 0, 'piegerFocus doit exister');
    let n = 0, j = GLOBAL.indexOf(') {', debut) + 2;
    for (; j < GLOBAL.length; j++) {
        if (GLOBAL[j] === '{') n++;
        else if (GLOBAL[j] === '}' && --n === 0) break;
    }
    const source = GLOBAL.slice(GLOBAL.indexOf('function', debut), j + 1);

    const dom = new JSDOM('<!doctype html><body><button id="ouvrir">O</button>'
        + '<a id="derriere" href="#">page</a>'
        + '<div id="dlg" role="dialog" aria-modal="true"><button id="a">A</button><button id="b">B</button></div></body>',
    { pretendToBeVisual: true });
    const w = dom.window;
    Object.defineProperty(w.HTMLElement.prototype, 'offsetParent', { get() { return w.document.body; } });
    // eslint-disable-next-line no-new-func
    const pieger = new w.Function('document', 'return ' + source)(w.document);

    const ouvrir = w.document.getElementById('ouvrir');
    ouvrir.focus();
    const dlg = w.document.getElementById('dlg');
    let echappe = 0;
    const liberer = pieger(dlg, { surEchap: () => { echappe++; } });

    // 1. le focus entre
    assert.equal(w.document.activeElement.id, 'a', 'le focus entre dans le dialogue');

    // 2. Tab depuis le dernier revient au premier — il ne sort pas
    w.document.getElementById('b').focus();
    const tab = (shiftKey = false) => {
        const e = new w.KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
        w.document.dispatchEvent(e);
        return e.defaultPrevented;
    };
    assert.equal(tab(), true, 'le Tab est retenu');
    assert.equal(w.document.activeElement.id, 'a');
    assert.equal(tab(true), true, 'Maj+Tab aussi');
    assert.equal(w.document.activeElement.id, 'b');

    // 3. Échap est signalé, et la libération rend le focus
    w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    assert.equal(echappe, 1, 'Échap est remonté à l’appelant, qui décide de fermer');
    liberer();
    assert.equal(w.document.activeElement.id, 'ouvrir', 'le focus revient d’où il venait');

    // et plus rien n'est retenu après libération
    w.document.getElementById('derriere').focus();
    assert.equal(tab(), false, 'le clavier est rendu à la page');
});
