// ============================================================
// test/unit/pastilles.test.js — deux familles, pas trente-quatre dessins
// ------------------------------------------------------------
// Relevé dans les feuilles : 34 règles de marque ou de puce, et entre
// elles 12 tailles, 17 rembourrages, 10 rayons, 4 graisses. C'est la
// plus grande dispersion des neuf items de l'étape.
//
// LE CHANTIER SE TROMPAIT SUR LA CAUSE. Il disait que « statut, source,
// langue et non-lus se disputent la même place ». Mesuré dans les pages :
//   · 120 cartes de bibliothèque, ZÉRO chevauchement, coins constants —
//     non-lus en haut à gauche, épingle et retrait en bas à droite,
//     progression en bas ;
//   · catalogue, les 55 recouvrements comptés sont tous avec le voile de
//     survol, qui couvre la carte entière par construction.
// Les positions sont disciplinées. C'est le DESSIN qui ne l'est pas.
//
// Et il y avait deux intentions qu'on n'avait jamais séparées : une
// pastille est une marque posée SUR quelque chose — petite, dense,
// grasse ; une puce se clique, donc elle a besoin d'une cible. Les
// confondre, c'était condamner les deux à se ressembler à peu près sans
// jamais se ressembler vraiment.
//
// Vérifié après : les pastilles rendent 10px / 2px 7px / 999px / 700 sur
// la bibliothèque comme sur le catalogue ; les puces 12px / 4px 10px /
// 999px / 500. Aucun débordement.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const CSS = path.join(__dirname, '..', '..', 'assets', 'css');
const FEUILLES = fs.readdirSync(CSS).filter(f => f.endsWith('.css'))
    .map(f => [f, fs.readFileSync(path.join(CSS, f), 'utf8').replace(/\r\n/g, '\n')]);
const TOUT = FEUILLES.map(([, s]) => s).join('\n');

const PASTILLES = ['shelf-badge', 'lib2-badge', 'lib2-kind-badge', 'manga-card-tag',
    'badge', 'conn-pill', 'nav-badge', 'stat-mini-badge', 'se-gtag', 'se-lib-badge',
    'se-src-chip', 'lang-badge', 'status-badge', 'badge-new', 'collection-card-tag',
    'page-counter-badge'];
const PUCES = ['lib2-chip', 'filter-active-chip', 'filter-tag', 'catalogue-chip',
    'hero-tag', 'tag', 'jr-chip', 'se-chip'];

// Les éléments INTERNES d'une puce ne sont pas des puces : un compteur,
// une icône, une croix ont leur propre taille, et la puce les contient.
// `.lib2-resume-chip` fait exception sur le rembourrage : c'est un bouton
// de reprise, de la taille d'un bouton.
const INTERNES = /\.(cnt|x)\b|\bspan\b|\bsvg\b|-ico\b|lib2-resume-tout/;

function reglesDe(classe) {
    const out = [];
    for (const [f, s] of FEUILLES) {
        const re = new RegExp('(^|\\n)([^\\n{}]*\\.' + classe + '(?![a-z0-9-])[^\\n{}]*)\\{([^}]*)\\}', 'g');
        let m;
        while ((m = re.exec(s))) out.push([f, m[2].trim(), m[3]]);
    }
    return out;
}

test('les deux familles sont déclarées une fois', () => {
    for (const j of ['--pastille-taille', '--pastille-rembourrage', '--pastille-rayon',
        '--pastille-graisse', '--puce-taille', '--puce-rembourrage', '--puce-rayon', '--puce-graisse']) {
        assert.match(TOUT, new RegExp(j + '\\s*:'), `${j} doit être défini`);
    }
});

test('une pastille et une puce ne sont pas la même chose', () => {
    // Si quelqu'un les aligne, la distinction disparaît et on revient à
    // trente-quatre dessins approximatifs.
    const val = (j) => (new RegExp(j + '\\s*:\\s*([^;]+);').exec(TOUT) || [, ''])[1].trim();
    assert.notEqual(val('--pastille-taille'), val('--puce-taille'),
        'une marque est plus petite que ce qu’on clique');
    assert.notEqual(val('--pastille-rembourrage'), val('--puce-rembourrage'),
        'et plus dense : une puce a besoin d’une cible');
    assert.notEqual(val('--pastille-graisse'), val('--puce-graisse'));
});

test('aucune pastille ni puce ne redessine ce que sa famille porte', () => {
    const fautes = [];
    for (const [famille, classes] of [['pastille', PASTILLES], ['puce', PUCES]]) {
        for (const c of classes) {
            for (const [f, sel, corps] of reglesDe(c)) {
                if (INTERNES.test(sel)) continue;
                for (const prop of ['font-size', 'padding', 'border-radius', 'font-weight']) {
                    const d = new RegExp('(^|;|\\n)\\s*' + prop + '\\s*:\\s*([^;}]+)').exec(corps);
                    if (d && !new RegExp('var\\(--' + famille + '-').test(d[2])) {
                        fautes.push(`${f} ${sel} — ${prop}: ${d[2].trim()}`);
                    }
                }
            }
        }
    }
    assert.deepEqual(fautes, [],
        `à router vers sa famille :\n  ${fautes.join('\n  ')}`);
});

test('les marques posées sur une couverture gardent leurs coins', () => {
    // Ce que la mesure a trouvé juste, on le garde : chaque marque a son
    // coin, et deux marques ne partagent pas le même.
    const coins = {};
    for (const [, sel, corps] of [...reglesDe('lib2-badge'), ...reglesDe('lib2-kind-badge'),
        ...reglesDe('lib2-pin'), ...reglesDe('lib2-del')]) {
        const v = /(?:^|;|\n)\s*(top|bottom)\s*:\s*([^;}]+)/.exec(corps);
        const h = /(?:^|;|\n)\s*(left|right)\s*:\s*([^;}]+)/.exec(corps);
        if (v && h) (coins[`${v[1]}-${h[1]}`] ||= []).push(sel);
    }
    assert.ok(Object.keys(coins).length >= 3,
        `les marques doivent occuper des coins distincts : ${JSON.stringify(coins)}`);
});
