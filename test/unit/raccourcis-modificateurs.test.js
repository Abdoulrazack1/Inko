// ============================================================
// test/unit/raccourcis-modificateurs.test.js — une touche de lecteur ne
// vole pas les combinaisons du navigateur
// ------------------------------------------------------------
// Les lecteurs filtraient la cible (champ de saisie) mais pas les
// modificateurs. Avec Ctrl ou Cmd enfoncé :
//     Ctrl+P (imprimer)       → chapitre précédent
//     Ctrl+F (rechercher)     → plein écran
//     Ctrl+A (tout sélect.)   → défilement automatique
//     Alt+→ (page suivante)   → chapitre suivant (lecteur local)
// Les raccourcis globaux de global.js filtraient déjà Ctrl/Cmd/Alt.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const lire = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', f), 'utf8').replace(/\r\n/g, '\n');
const GLOBAL = lire('global.js');

function toucheIgnoree() {
    const i = GLOBAL.indexOf('window.MH.toucheIgnoree = function');
    assert.notEqual(i, -1, 'MH.toucheIgnoree doit exister');
    const corps = GLOBAL.slice(i, GLOBAL.indexOf('\n    };\n', i) + 7);
    const MH = {};
    // eslint-disable-next-line no-new-func
    new Function('window', corps)({ MH });
    return MH.toucheIgnoree;
}

const ev = (key, o = {}) => ({ key, ctrlKey: false, metaKey: false, altKey: false, target: { tagName: 'DIV' }, ...o });

test('une touche seule sur la page est traitée', () => {
    const f = toucheIgnoree();
    assert.equal(f(ev('p')), false);
    assert.equal(f(ev('ArrowRight')), false);
});

test('Ctrl, Cmd et Alt laissent la combinaison au navigateur', () => {
    const f = toucheIgnoree();
    assert.equal(f(ev('p', { ctrlKey: true })), true);
    assert.equal(f(ev('f', { metaKey: true })), true);
    assert.equal(f(ev('ArrowRight', { altKey: true })), true);
});

test('la saisie dans un champ ou une zone éditable est ignorée', () => {
    const f = toucheIgnoree();
    for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT', 'input']) assert.equal(f(ev('n', { target: { tagName } })), true, tagName);
    assert.equal(f(ev('n', { target: { tagName: 'DIV', isContentEditable: true } })), true);
});

test('les trois lecteurs appliquent la règle', () => {
    assert.match(lire('chapitre.js'), /document\.addEventListener\('keydown', e => \{\n\s+if \(MH\.toucheIgnoree\(e\)\) return;/);
    assert.match(lire('lecture.js'), /if \(MH\.toucheIgnoree\(e\)\) return;\n\s+switch \(e\.key\)/);
    // localreader.html ne charge pas global.js : la règle y est écrite en clair.
    assert.match(lire('localreader.js'), /e\.ctrlKey \|\| e\.metaKey \|\| e\.altKey/);
});

test('le lecteur de romans garde Ctrl+F pour sa recherche, et c\'est voulu', () => {
    // La recherche du navigateur ne voit pas les colonnes hors écran du mode
    // pages : intercepter Ctrl+F y est le service rendu, pas un vol.
    assert.match(lire('lecture.js'), /\(e\.ctrlKey \|\| e\.metaKey\) && \(e\.key === 'f' \|\| e\.key === 'F'\)\) \{ e\.preventDefault\(\); basculerRecherche\(\)/);
});
