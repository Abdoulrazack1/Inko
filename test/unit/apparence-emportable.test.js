// ============================================================
// test/unit/apparence-emportable.test.js — une apparence s'emporte, et
// un fichier ne peut rien faire que les reglages ne permettent deja
// ------------------------------------------------------------
// Neuf reglages d'apparence vivent dans `Storage` : le theme, la couleur
// d'accent, la densite, et six pour la typographie des romans. Les
// regler prend du temps, et ce temps etait perdu a chaque nouvel
// appareil — rien ne permettait de les emporter.
//
// LA DECISION QUI COMPTE EST CELLE DE CE QU'ON N'IMPORTE PAS. Un
// « theme personnalise » pourrait vouloir dire un fichier qui pose des
// variables CSS arbitraires. On s'y refuse : un fichier qui s'echange
// pourrait alors rendre un texte invisible, ou repeindre un bouton de
// suppression en bouton anodin. Ce qui passe est une LISTE FERMEE,
// chaque valeur validee contre son domaine. Un fichier d'apparence ne
// peut donc rien faire que la page des reglages ne permette deja.
//
// Et rien ne part nulle part : un fichier sur l'appareil, lu par
// l'appareil. L'application promet de ne rien envoyer.
//
// Verifie dans le navigateur, sur la page des reglages : un fichier
// valide applique ses cinq reglages et le DOM suit immediatement
// (`data-theme`, `data-densite`, `--accent`) ; un fichier hostile
// — theme inconnu, `javascript:` en couleur, `--bg` en cle, taille 999 —
// voit ses six entrees refusees et n'applique rien.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const lire = (...p) => fs.readFileSync(path.join(RACINE, ...p), 'utf8').replace(/\r\n/g, '\n');

/** Charge `theme.js` dans un faux document, avec un `Storage` en memoire. */
function charger(prefs = {}) {
    const src = lire('assets', 'js', 'theme.js');
    const sac = { ...prefs };
    const attrs = {};
    const racine = {
        setAttribute: (k, v) => { attrs[k] = v; },
        removeAttribute: (k) => { delete attrs[k]; },
        getAttribute: (k) => (k in attrs ? attrs[k] : null),
        style: { setProperty: (k, v) => { attrs['style:' + k] = v; }, removeProperty: () => {} },
        classList: { add() {}, remove() {}, toggle() {} },
    };
    const window = {
        Storage: {
            getPref: (k) => sac[k],
            setPref: (k, v) => { sac[k] = v; },
        },
        matchMedia: () => ({ matches: false, addEventListener() {}, addListener() {} }),
        requestAnimationFrame: (f) => f(),
        getComputedStyle: () => ({ getPropertyValue: () => '' }),
        MH: { err() {} },
    };
    const document = {
        documentElement: racine,
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener() {},
        createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, remove() {} }),
        head: { appendChild() {} },
        body: { appendChild() {}, classList: { add() {}, remove() {} } },
        readyState: 'complete',
    };
    // `apply` suspend les transitions via une rAF : la fournir en global
    // plutot qu'en propriete de `window`, puisque le fichier l'appelle nue.
    // eslint-disable-next-line no-new-func
    new Function('window', 'document', 'localStorage', 'requestAnimationFrame', 'setTimeout', src)(
        window, document, { getItem: () => null, setItem() {}, removeItem() {} },
        (f) => f(), (f) => f());
    return { Theme: window.Theme, sac, attrs };
}

test('l’export ne porte que ce qui est reellement pose', () => {
    const { Theme } = charger({ theme: 'amoled', accent: '#22c55e', novel_font: 'mono' });
    const d = Theme.exporterApparence();
    assert.equal(d.format, 'inko-apparence');
    assert.equal(d.version, 1);
    assert.deepEqual(d.reglages, { theme: 'amoled', accent: '#22c55e', novel_font: 'mono' });
    // Un reglage absent ne doit pas sortir en `undefined` : un fichier qui
    // porte des trous les reimposerait ailleurs.
    assert.ok(!('densite' in d.reglages));
});

test('un aller-retour rend exactement l’etat de depart', () => {
    const depart = {
        theme: 'contrast', accent: '#ff6b1a', densite: 'spacieux',
        novel_size: 20, novel_lh: 1.6, novel_width: 72,
        novel_font: 'sans', novel_theme: 'sepia', novel_mode: 'pages',
    };
    const a = charger(depart);
    const fichier = JSON.parse(JSON.stringify(a.Theme.exporterApparence()));
    const b = charger({});
    const r = b.Theme.importerApparence(fichier);
    assert.equal(r.refuses.length, 0, 'refuses : ' + r.refuses.join(', '));
    assert.equal(r.appliques.length, 9, 'les neuf reglages');
    assert.deepEqual(b.Theme.exporterApparence().reglages, depart);
});

test('l’import FUSIONNE : il n’efface pas ce dont le fichier ne parle pas', () => {
    // Importer l'apparence de quelqu'un ne doit pas effacer en silence un
    // reglage dont ce fichier n'a jamais parle.
    const { Theme, sac } = charger({ novel_font: 'mono', novel_size: 24, theme: 'dark' });
    Theme.importerApparence({ format: 'inko-apparence', version: 1, reglages: { theme: 'light' } });
    assert.equal(sac.theme, 'light', 'ce que le fichier dit est applique');
    assert.equal(sac.novel_font, 'mono', 'ce dont il ne parle pas reste');
    assert.equal(sac.novel_size, 24);
});

test('un fichier ne peut rien faire que les reglages ne permettent deja', () => {
    // Le test qui porte la decision. Chaque entree est hors de son
    // domaine, ou n'est pas un reglage du tout.
    const { Theme, sac, attrs } = charger({ theme: 'dark', accent: '#c1531b' });
    const r = Theme.importerApparence({
        format: 'inko-apparence', version: 1,
        reglages: {
            theme: 'neon',                       // hors vocabulaire
            accent: 'javascript:alert(1)',       // pas un hexa
            densite: 'enorme',                   // hors vocabulaire
            novel_size: 999,                     // hors plage
            novel_lh: 'grand',                   // pas un nombre
            novel_font: 'comic',                 // hors vocabulaire
            novel_mode: 'diaporama',             // hors vocabulaire
            '--bg': '#000000',                   // une variable CSS
            '__proto__': { pollue: 1 },          // une tentative de pollution
            inconnu: 1,                          // pas un reglage
        },
    });
    assert.deepEqual(r.appliques, [], 'rien ne doit passer');
    assert.ok(r.refuses.length >= 9, 'chaque entree doit etre refusee, et DITE');
    assert.equal(sac.theme, 'dark', 'l’etat ne bouge pas');
    assert.equal(sac.accent, '#c1531b');
    assert.equal(attrs['style:--bg'], undefined, 'aucune variable CSS posee');
    assert.equal(({}).pollue, undefined, 'le prototype n’est pas pollue');
});

test('un fichier qui n’est pas une apparence est refuse en disant pourquoi', () => {
    const { Theme } = charger({});
    for (const [entree, motif] of [
        [null, /pas une apparence/],
        ['du texte', /pas une apparence/],
        [[1, 2], /pas une apparence/],
        [{ format: 'autre', version: 1, reglages: {} }, /pas une apparence/],
        [{ format: 'inko-apparence', version: 9, reglages: {} }, /version 9/],
        [{ format: 'inko-apparence', version: 1 }, /aucun réglage/i],
        [{ format: 'inko-apparence', version: 1, reglages: 'x' }, /aucun réglage/i],
    ]) {
        const r = Theme.importerApparence(entree);
        assert.match(r.erreur || '', motif, JSON.stringify(entree));
        assert.deepEqual(r.appliques, []);
    }
});

test('la page des reglages se resynchronise apres un import', () => {
    // Sinon les segments afficheraient l'ancien choix : la page mentirait
    // sur son propre etat, et c'est exactement le defaut qu'on a corrige
    // ailleurs cette semaine (le pied de l'etagere, la pastille muette).
    const src = lire('assets', 'js', 'parametres.js');
    const i = src.indexOf('function brancherApparence() {');
    assert.notEqual(i, -1, 'brancherApparence doit rester reperable');
    const b = src.slice(i, src.indexOf('\n    }\n', i));
    assert.match(b, /initSegments\(\);\s*\n\s*initAccent\(\);/,
        'les deux rendus doivent etre refaits apres un import');
    assert.match(b, /champ\.value = '';/,
        're-choisir le meme fichier doit remarcher');
    assert.match(b, /r\.refuses\.length/, 'les refus doivent etre dits a l’utilisateur');
});
