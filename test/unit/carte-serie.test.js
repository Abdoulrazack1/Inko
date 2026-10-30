// ============================================================
// test/unit/carte-serie.test.js — une seule carte de série
// ------------------------------------------------------------
// Six familles de classes rendaient le même objet — une couverture, un
// titre, parfois une ligne de méta — et aucune n'était d'accord avec une
// autre. Mesuré dans les pages réelles, avant :
//
//     .shelf-*        accueil         3 / 4.3   r10   13px   / 600 / 2 lignes
//     .manga-card-*   catalogue       3 / 4     r8    13px   / 600 / sans borne
//     .lib2-*         bibliothèque    3 / 4     r12   12,5px / 500 / 2 lignes
//     .pl-card        liste           3 / 4     r10   12,5px / 400 / 2 lignes
//     .se-*           recherche       3 / 4     r12   12,5px / 500 / 2 lignes
//     .cd-*, .similar fiche, listes   3 / 4     r6
//
// Le ratio est ce qui se voit le plus, et c'est la mesure qui a tranché
// contre le plan. 34 couvertures relevées dans la bibliothèque : médiane
// 0,667 au millième près, 28 sur 34 en 2:3. Dans une boîte 3 / 4,
// `object-fit: cover` leur prend 10,8 % de hauteur en moyenne — en haut et
// en bas, là où sont le titre et le numéro de tome. Après : 0,3 %.
//
// L'audit IX.5 l'avait déjà écrit, mais le correctif n'était posé que sous
// `(hover: none)` : le tactile voyait la bonne couverture, le bureau la
// version rognée.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const CSS = path.join(__dirname, '..', '..', 'assets', 'css');
const R = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');
const GLOBAL = R('assets', 'css', 'global.css');
// Le repli Android 8 est généré À PARTIR des règles : il répète forcément
// des valeurs littérales, et n'a pas à être relu comme une déclaration.
const SANS_REPLI = GLOBAL.split('/* ══ REPLI aspect-ratio')[0];

const JETONS = ['--carte-ratio', '--carte-rayon', '--carte-titre',
    '--carte-graisse', '--carte-lignes', '--carte-ecart', '--carte-meta'];

test('le contrat de la carte est déclaré une fois, et le ratio est celui des couvertures', () => {
    for (const j of JETONS) {
        const n = (SANS_REPLI.match(new RegExp(j + '\\s*:', 'g')) || []).length;
        assert.ok(n >= 1, `${j} doit être défini`);
    }
    const ratio = /--carte-ratio\s*:\s*([^;]+);/.exec(SANS_REPLI);
    assert.ok(ratio, '--carte-ratio doit être défini');
    assert.match(ratio[1].trim(), /^2\s*\/\s*3$/,
        'les couvertures sont en 2:3 — mesuré, pas supposé : médiane 0,667 sur 34 relevés');
});

test('aucune couverture de série ne déclare son rapport à elle', () => {
    const fautes = [];
    for (const f of fs.readdirSync(CSS).filter(n => n.endsWith('.css'))) {
        const src = f === 'global.css' ? SANS_REPLI : fs.readFileSync(path.join(CSS, f), 'utf8');
        src.split('\n').forEach((l, i) => {
            if (!/aspect-ratio\s*:/.test(l)) return;
            if (/var\(--carte-ratio\)/.test(l)) return;
            // `aspect-ratio: auto` annule le rapport : la boîte est alors
            // dimensionnée en dur, et c'est là qu'on vérifie ses pixels.
            if (/aspect-ratio\s*:\s*auto/.test(l)) return;
            // Une couverture se reconnaît à son nom ; le reste de la feuille
            // (bannières, vignettes carrées, aperçus) garde le sien.
            if (/cover|couv/i.test(l) || /^\s*\.[a-z0-9-]*cover/i.test(l)) {
                fautes.push(`${f}:${i + 1} — ${l.trim().slice(0, 72)}`);
            }
        });
    }
    assert.deepEqual(fautes, [], `à router vers var(--carte-ratio) :\n  ${fautes.join('\n  ')}`);
});

test('aucune famille ne réinvente le titre de la carte', () => {
    // On vise les règles de titre des six familles, pas toute la feuille.
    const titres = {
        'accueil.css': ['.shelf-name'],
        'bibliotheque.css': ['.lib2-title'],
        'recherche.css': ['.se-title'],
        'global.css': ['.manga-card-title'],
    };
    const fautes = [];
    for (const [f, sels] of Object.entries(titres)) {
        const src = f === 'global.css' ? SANS_REPLI : fs.readFileSync(path.join(CSS, f), 'utf8');
        for (const sel of sels) {
            // Toutes les règles qui visent ce titre, variantes comprises.
            const re = new RegExp(`[^{}]*\\${sel}[^{}]*\\{([^}]*)\\}`, 'g');
            let m;
            while ((m = re.exec(src))) {
                for (const prop of ['font-size', 'font-weight', '-webkit-line-clamp']) {
                    const d = new RegExp(prop + '\\s*:\\s*([^;}]+)').exec(m[1]);
                    if (d && !/var\(--carte-/.test(d[1])) {
                        fautes.push(`${f} ${sel} — ${prop}: ${d[1].trim()}`);
                    }
                }
            }
        }
    }
    assert.deepEqual(fautes, [], `à router vers le contrat :\n  ${fautes.join('\n  ')}`);
});

test('la densité est nommée une fois, pas réinventée par page', () => {
    // `.lib2-grid--compact` et `.se-perso-card` posaient chacune leur titre
    // de 11 px et leur rayon : c'étaient deux densités sans nom.
    const bloc = SANS_REPLI.match(/\[data-densite="dense"\][^}]*\}/);
    assert.ok(bloc, 'la densité dense doit être déclarée');
    for (const sel of ['.lib2-grid--compact', '.se-perso-card']) {
        assert.ok(bloc[0].includes(sel), `${sel} doit prendre la densité dense, pas ses propres valeurs`);
    }
    assert.ok(SANS_REPLI.includes('[data-densite="large"]'),
        'et une densité large, pour une page neuve qui n’aurait pas de classe à elle');
});

test('le repli Android 8 résout le jeton au lieu de disparaître', () => {
    // Si le générateur ne sait pas lire `var(--carte-ratio)`, la déclaration
    // tombe dans ses « ignorées » — il échoue bruyamment, mais seulement si
    // on le relance. Ici on vérifie le résultat : 2/3 = 150 %.
    const repli = GLOBAL.split('/* ══ REPLI aspect-ratio')[1] || '';
    assert.ok(repli, 'le bloc de repli doit exister');
    for (const sel of ['.shelf-cover', '.lib2-cover', '.manga-card-cover', '.se-cover']) {
        const re = new RegExp(`\\${sel} \\{ height: 0; padding-top: ([\\d.]+)%`);
        const m = re.exec(repli);
        assert.ok(m, `${sel} doit avoir son repli`);
        assert.equal(m[1], '150', `${sel} : 2/3 vaut 150 %, pas ${m[1]} %`);
    }
    assert.match(R('scripts-ci', 'gen-repli-aspect-ratio.js'), /\^var\\\(/,
        'le générateur doit savoir résoudre un var() — sinon la boîte fait 0 px sur Android 8');
});
