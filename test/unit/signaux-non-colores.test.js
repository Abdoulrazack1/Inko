// ============================================================
// test/unit/signaux-non-colores.test.js — la couleur ne doit jamais etre
// le seul porteur d'une information
// ------------------------------------------------------------
// WCAG 1.4.1 (« Utilisation de la couleur »). Le graphe de repartition de
// la page de statistiques attribue une des huit teintes `--graph-*` a
// chaque source, et la legende associe teinte et nom. Pour qui ne
// distingue pas deux de ces teintes, la legende ne sert a rien : on voit
// bien douze colonnes empilees, on ne sait pas qui est qui.
//
// ── Ce qui a ete mesure ──
//
// Simulation des trois dichromatismes (matrices LMS usuelles), puis
// distance CIE76 entre chaque paire de teintes simulees. En dessous de
// 20, deux aplats categoriels se confondent pour la plupart des gens.
// Sur les editions de la palette, jusqu'a SEPT paires passent sous le
// seuil. Les pires :
//
//     protanopie     --graph-1 ~ --graph-5    2,2   (identiques)
//     deuteranopie   --graph-1 ~ --graph-5    3,5
//     deuteranopie   --graph-1 ~ --graph-6    4,0
//     tritanopie     --graph-3 ~ --graph-7    3,8
//
// Deux conclusions, et la seconde compte plus que la premiere.
//
// 1. L'ORDRE d'attribution peut etre ameliore. Les sources sortent par
//    volume decroissant, et on en a rarement huit : ce sont les premiers
//    rangs qui comptent. Un ordonnancement glouton sur la distance
//    minimale dans le pire dichromatisme, joint aux trois editions,
//    donne `2, 6, 8, 4, 3, 5, 7, 1`. Gain mesure, en distance minimale :
//
//        2 sources   66 -> 91       3 sources   6 -> 13
//        4 sources et au-dela : aucun changement
//
// 2. Donc ca ne suffit pas. A partir de quatre categories, aucun ordre ne
//    sauve une palette de huit teintes — il n'existe pas huit teintes
//    mutuellement distinguables sous dichromatisme a ce niveau de
//    contraste. L'information doit passer par un AUTRE canal : les
//    chiffres, que le bouton « Voir les chiffres » rend lisibles.
//
// Ce test refait les deux mesures a chaque execution, sur le CSS reel. Il
// n'exige pas l'absence de confusion — ce serait faux, et le test
// mentirait. Il exige que la confusion mesuree soit encore la (sinon le
// bouton n'a plus de justification et il faut relire ce commentaire) et
// que l'ordre retenu ne soit jamais pire que l'ordre naturel.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const lire = (...p) => fs.readFileSync(path.join(RACINE, ...p), 'utf8').replace(/\r\n/g, '\n');

// ── Simulation du dichromatisme ──
// sRGB -> lineaire -> LMS -> projection sur le plan des deux cones
// restants -> retour. Matrices usuelles (Vienot, Brettel).
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const lin = (c) => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
const slin = (c) => {
    const v = c <= 0.0031308 ? c * 12.92 : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
    return Math.max(0, Math.min(255, Math.round(v * 255)));
};
const RGB2LMS = [[0.31399022, 0.63951294, 0.04649755],
                 [0.15537241, 0.75789446, 0.08670142],
                 [0.01775239, 0.10944209, 0.87256922]];
const LMS2RGB = [[5.47221206, -4.6419601, 0.16963708],
                 [-1.1252419, 2.29317094, -0.1678952],
                 [0.02980165, -0.19318073, 1.16364789]];
const SIM = {
    deuteranopie: [[1, 0, 0], [0.9513092, 0, 0.04866992], [0, 0, 1]],
    protanopie:   [[0, 1.05118294, -0.05116099], [0, 1, 0], [0, 0, 1]],
    tritanopie:   [[1, 0, 0], [0, 1, 0], [-0.86744736, 1.86727089, 0]],
};
const TYPES = Object.keys(SIM);
const mul = (M, v) => M.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const simule = (h, type) => mul(LMS2RGB, mul(SIM[type], mul(RGB2LMS, hex(h).map(lin)))).map(slin);

function lab([r, g, b]) {
    const [R, G, B] = [r, g, b].map(lin);
    let X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
    let Y = (R * 0.2126 + G * 0.7152 + B * 0.0722);
    let Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
    const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    [X, Y, Z] = [f(X), f(Y), f(Z)];
    return [116 * Y - 16, 500 * (X - Y), 200 * (Y - Z)];
}
const dE = (a, b) => { const A = lab(a), B = lab(b); return Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };

// Distance d'une paire dans le pire des trois dichromatismes.
const pire = (a, b) => Math.min(...TYPES.map((t) => dE(simule(a, t), simule(b, t))));

const SEUIL = 20;

// ── Les palettes, relevees dans le CSS reel ──
function palettes() {
    const css = lire('assets', 'css', 'global.css');
    const out = [];
    const blocs = [...css.matchAll(/--graph-1:\s*#[0-9a-f]{6}[\s\S]{0,400}?--graph-8:\s*#[0-9a-f]{6}/gi)];
    for (const b of blocs) {
        const pal = [...b[0].matchAll(/--graph-\d:\s*(#[0-9a-f]{6})/gi)].map((m) => m[1]);
        if (pal.length === 8) out.push(pal);
    }
    return out;
}

test('les palettes de graphiques sont bien relevees dans le CSS', () => {
    const pals = palettes();
    assert.ok(pals.length >= 3,
        'au moins trois editions de --graph-1..8 attendues, ' + pals.length + ' trouvee(s)');
    for (const p of pals) assert.equal(new Set(p).size, 8, 'huit teintes distinctes a l’oeil');
});

test('huit teintes ne sont pas distinguables sous dichromatisme', () => {
    // Le constat qui justifie tout le reste. S'il tombe un jour — palette
    // refaite, seuil revu — c'est la decision qu'il faut relire, pas le test.
    let maxParEdition = 0;
    const confondues = [];
    for (const pal of palettes()) {
        for (const type of TYPES) {
            const sim = pal.map((h) => simule(h, type));
            let n = 0;
            for (let i = 0; i < 8; i++) {
                for (let j = i + 1; j < 8; j++) {
                    const d = dE(sim[i], sim[j]);
                    if (d < SEUIL) { n++; confondues.push({ type, i: i + 1, j: j + 1, d }); }
                }
            }
            maxParEdition = Math.max(maxParEdition, n);
        }
    }
    assert.ok(maxParEdition >= 5,
        'seulement ' + maxParEdition + ' paire(s) confondue(s) au pire : la palette aurait'
        + ' change, et le bouton « Voir les chiffres » demande a etre rejustifie');
    const plusProche = confondues.reduce((a, p) => (p.d < a.d ? p : a), confondues[0]);
    assert.ok(plusProche.d < 5,
        'la paire la plus proche est a ' + plusProche.d.toFixed(1) + ' : attendu sous 5');
});

// Distance minimale entre les k premieres couleurs attribuees.
function minK(pal, ordre, k) {
    const pris = ordre.slice(0, k).map((n) => pal[n - 1]);
    let min = Infinity;
    for (let i = 0; i < pris.length; i++) {
        for (let j = i + 1; j < pris.length; j++) min = Math.min(min, pire(pris[i], pris[j]));
    }
    return min;
}

test('l’ordre d’attribution retenu n’est jamais pire que l’ordre naturel', () => {
    const ORDRE = [2, 6, 8, 4, 3, 5, 7, 1];
    const NATUREL = [1, 2, 3, 4, 5, 6, 7, 8];
    const src = lire('assets', 'js', 'stats.js');
    const m = /const PALETTE = \[([\d, ]+)\]\.map/.exec(src);
    assert.ok(m, 'stats.js doit deriver sa palette des jetons');
    assert.deepEqual(m[1].split(',').map((n) => Number(n.trim())), ORDRE,
        'l’ordre de stats.js doit rester celui qu’on a mesure');

    for (const pal of palettes()) {
        for (let k = 2; k <= 8; k++) {
            const a = minK(pal, ORDRE, k), n = minK(pal, NATUREL, k);
            assert.ok(a >= n - 0.5,
                k + ' sources : l’ordre retenu donne ' + a.toFixed(1)
                + ', l’ordre naturel ' + n.toFixed(1));
        }
    }
    // Et il gagne vraiment la ou ca compte : deux ou trois sources, le cas
    // courant. Mesure sur la premiere edition relevee (le theme clair).
    const clair = palettes()[0];
    assert.ok(minK(clair, ORDRE, 3) > minK(clair, NATUREL, 3),
        'a trois sources, le reordonnancement doit apporter quelque chose');
});

test('le gain du reordonnancement s’epuise au-dela de trois sources', () => {
    // La mesure qui empeche de croire que le probleme est regle. Si un
    // jour ces deux valeurs divergent, une palette a change et la
    // conclusion « il faut un autre canal » doit etre reprise.
    const ORDRE = [2, 6, 8, 4, 3, 5, 7, 1];
    const NATUREL = [1, 2, 3, 4, 5, 6, 7, 8];
    const clair = palettes()[0];
    assert.equal(minK(clair, ORDRE, 8).toFixed(1), minK(clair, NATUREL, 8).toFixed(1),
        'avec les huit teintes, l’ordre ne change rien : ce sont les memes paires');
    assert.ok(minK(clair, ORDRE, 8) < SEUIL,
        'et cette distance reste sous le seuil de confusion');
});

test('la page de statistiques offre un canal non colore', () => {
    // La mesure ci-dessus ne vaut que si les chiffres sont atteignables.
    const src = lire('assets', 'js', 'stats.js');
    assert.match(src, /class="st-chiffres-bouton" aria-expanded="false"/,
        'un bouton, annonce replie');
    assert.match(src, /function tableauRepartition\(d, sources, id\)/,
        'le tableau doit porter un identifiant pour aria-controls');
    // Le tableau defile horizontalement des qu'il y a plusieurs sources
    // (mesure : 430 px de table dans 278 px de boite, a 375 px d'ecran).
    // Une zone qui defile doit pouvoir prendre le focus pour qu'on y
    // defile au clavier — mais pas tant qu'elle est hors de l'ecran,
    // sinon la tabulation part dans le vide.
    assert.match(src, /if \(ouvert\) boite\.removeAttribute\('tabindex'\);/);
    assert.match(src, /else boite\.setAttribute\('tabindex', '0'\);/);
    const css = lire('assets', 'css', 'stats.css');
    assert.match(css, /\.st-chiffres-bouton\s*\{/, 'le bouton doit etre style');
    assert.match(css, /\.st-chiffres-table th\[scope="row"\]/,
        'les en-tetes de ligne se lisent a gauche');
});
