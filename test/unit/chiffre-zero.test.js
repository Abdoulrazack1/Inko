// ============================================================
// test/unit/chiffre-zero.test.js — un zero n'est pas un resultat
// ------------------------------------------------------------
// Mesure, page des statistiques, compte reel (117 chapitres) :
//
//     117  Chapitres lus      ACCENT   rgb(193, 83, 27)
//      20  Series commencees
//       1  Ce mois-ci
//       0  Jours d'affilee    ACCENT   rgb(193, 83, 27)
//       4  Record de serie
//     495  Favoris
//
// Le signal le plus fort de la page — la couleur de marque, celle du plus
// gros chiffre — pointait une ABSENCE. Parce que l'accent est pose par
// POSITION dans le tableau des tuiles, jamais d'apres ce que la tuile
// finit par afficher.
//
// Sur la page de profil, meme famille de tuiles, trois zeros sur sept :
// aucun n'etait en accent, mais aucun ne se distinguait non plus d'un
// resultat. Un zero garde donc sa place et son chiffre — le masquer
// ferait croire a une panne — et passe a l'encre du libelle.
//
// La decision tient en un seul endroit, `MH.classeChiffre` pour un
// chiffre construit en chaine et `MH.chiffre` pour un chiffre pose sur
// un element existant. C'est le defaut qui revient depuis l'etape 2 :
// une regle existe, et chaque page la reprend a sa facon.
//
// UNE EXCEPTION, deliberee : le « 0/7 » de l'anneau d'objectif du profil.
// Ce chiffre est le seul contenu de son widget, il n'est en concurrence
// avec rien, et son libelle dit deja « C'est parti ? ». L'attenuer ferait
// paraitre l'anneau casse.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const lire = (...p) => fs.readFileSync(path.join(RACINE, ...p), 'utf8').replace(/\r\n/g, '\n');

// ── Le comportement des deux aides, charge depuis la source reelle ──
function aides() {
    const src = lire('assets', 'js', 'global.js');
    const i = src.indexOf('    const estZero = (v) =>');
    assert.notEqual(i, -1, 'le bloc des aides doit rester reperable');
    const j = src.indexOf('\n    };', src.indexOf('window.MH.chiffre = function')) + 7;
    const bloc = src.slice(i, j);
    const window = { MH: {} };
    // eslint-disable-next-line no-new-func
    new Function('window', bloc)(window);
    return window.MH;
}

test('un zero est reconnu, un resultat ne l’est pas', () => {
    const MH = aides();
    for (const v of [0, '0', '0/7', '0 min', '0,0', -0]) {
        assert.equal(MH.classeChiffre(v), 'chiffre-zero', JSON.stringify(v));
    }
    for (const v of [1, '1', 117, '495', '4 h', '—', '', null, undefined, NaN, 'aucun']) {
        assert.equal(MH.classeChiffre(v), '', JSON.stringify(v));
    }
});

test('MH.chiffre pose le texte et la classe sur l’element', () => {
    const MH = aides();
    const faux = () => {
        const classes = new Set();
        return {
            textContent: '',
            classList: {
                toggle(c, on) { if (on) classes.add(c); else classes.delete(c); },
                has: (c) => classes.has(c),
            },
        };
    };
    const a = MH.chiffre(faux(), 0);
    assert.equal(a.textContent, '0');
    assert.ok(a.classList.has('chiffre-zero'));

    const b = MH.chiffre(faux(), 117, '117');
    assert.equal(b.textContent, '117');
    assert.ok(!b.classList.has('chiffre-zero'));

    // Un libelle rendu par une mise en forme : c'est LUI qui decide.
    const c = MH.chiffre(faux(), 0, '0 min');
    assert.ok(c.classList.has('chiffre-zero'));
    const d = MH.chiffre(faux(), 42, '4 h');
    assert.ok(!d.classList.has('chiffre-zero'));

    // Un element absent ne doit pas faire tomber la page.
    assert.doesNotThrow(() => MH.chiffre(null, 0));
});

test('la classe est declaree une fois, dans la feuille partagee', () => {
    const css = lire('assets', 'css', 'global.css');
    // Doublee : deux feuilles de page colorent deja leur chiffre, l'une
    // par l'ordre de chargement, l'autre par la specificite. Sans ce
    // doublement la classe etait posee et sans effet.
    assert.match(css, /\.chiffre-zero\.chiffre-zero \{ color: var\(--text3\); \}/,
        'une seule declaration, dans global.css, et assez lourde pour gagner');
    for (const [f, sel] of [['collection-detail.css', '.cd-stat-num'], ['notes.css', '.jr-stat b']]) {
        assert.match(lire('assets', 'css', f), new RegExp(sel.replace(/[.*]/g, '\\$&') + '[^}]*color:'),
            f + ' colore encore son chiffre : c’est ce que le doublement paie');
    }
    // Et nulle part ailleurs : la decision ne doit pas se redessiner page
    // par page — c'est exactement le defaut qu'on corrige.
    for (const f of fs.readdirSync(path.join(RACINE, 'assets', 'css'))) {
        if (!f.endsWith('.css') || f === 'global.css') continue;
        assert.ok(!lire('assets', 'css', f).includes('.chiffre-zero'),
            f + ' redefinit .chiffre-zero');
    }
});

test('l’accent ne se pose plus sur un zero', () => {
    const src = lire('assets', 'js', 'stats.js');
    assert.match(src, /<div class="st-card \$\{v === 0 \? '' : c\}">/,
        'la tuile perd sa couleur de marque quand elle n’a rien a dire');
    assert.match(src, /<div class="v \$\{MH\.classeChiffre\(v\)\}">/);
});

test('les tuiles de chiffres passent toutes par l’aide', () => {
    // Le piege de cette famille de correctifs : une page oubliee. On
    // refuse donc la FORME qui contourne l'aide, pas seulement on verifie
    // celles qu'on a converties.
    const ECRANS = {
        'profil.js': ['.profil-stat-num', '.stat-mini-num'],
        'stats.js': [],
        'notes.js': [],
        'collection-detail.js': ['.cd-stat-num'],
    };
    for (const [f, selecteurs] of Object.entries(ECRANS)) {
        const src = lire('assets', 'js', f);
        for (const sel of selecteurs) {
            const nom = sel.slice(1);
            const motif = new RegExp("querySelector\\('" + sel + "'\\)[^\\n]*\\.textContent\\s*=");
            assert.ok(!motif.test(src),
                f + ' : ' + nom + ' pose encore son texte sans passer par MH.chiffre');
        }
    }
    assert.match(lire('assets', 'js', 'notes.js'), /<b class="\$\{MH\.classeChiffre\(s\.total\)\}">/);
    assert.match(lire('assets', 'js', 'notes.js'), /<b class="\$\{MH\.classeChiffre\(s\.series\)\}">/);
    assert.match(lire('assets', 'js', 'collection-detail.js'),
        /class="cd-stat-num \$\{MH\.classeChiffre\(items\.length\)\}"/);
    // Sept tuiles, huit appels : le temps de lecture est ecrit deux fois —
    // l'estimation d'abord, la mesure quand la route repond.
    assert.equal((lire('assets', 'js', 'profil.js').match(/MH\.chiffre\(/g) || []).length, 8,
        'les sept tuiles de chiffres du profil, dont une ecrite deux fois');
});

test('l’encre attenuee reste lisible dans les quatre editions', () => {
    // L'attenuation ne vaut que si elle n'efface pas. Seuil AA pour du
    // texte, meme si ces chiffres sont assez gros pour relever du seuil
    // des grands caracteres : on prend le plus exigeant.
    const css = lire('assets', 'css', 'global.css');
    const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
    const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
    const rap = (a, b) => {
        const x = L(hex(a)), y = L(hex(b));
        return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
    };
    const bloc = (sel) => {
        const aig = sel + ' {';
        for (let i = css.indexOf(aig); i !== -1; i = css.indexOf(aig, i + 1)) {
            const corps = css.slice(i, css.indexOf('\n}', i));
            if (corps.includes('--bg4:')) return corps;
        }
        assert.fail('palette introuvable : ' + sel);
    };
    const jeton = (corps, n) => {
        const m = new RegExp('--' + n + ':\\s*(#[0-9a-f]{6})', 'i').exec(corps);
        assert.ok(m, n + ' doit etre une couleur litterale');
        return m[1];
    };
    for (const sel of [':root', 'html[data-theme="dark"]',
        'html[data-theme="amoled"]', 'html[data-theme="contrast"]']) {
        const corps = bloc(sel);
        const r = rap(jeton(corps, 'text3'), jeton(corps, 'bg2'));
        assert.ok(r >= 4.5, sel + ' : --text3 a ' + r.toFixed(2) + ' sur --bg2');
    }
});
