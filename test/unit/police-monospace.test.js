// ============================================================
// test/unit/police-monospace.test.js — le quatrième rôle typographique
// ------------------------------------------------------------
// Trois familles étaient nommées et tenues en jetons : `--font-head`
// (Archivo Narrow), `--font-body` (IBM Plex Sans), `--font-read` (Bitter).
// Vérifié dans le navigateur, elles se chargent toutes les trois — mesuré
// au poids déclaré, contre le repli de chaque famille :
//
//     Archivo Narrow 500   256 px   (system-ui : 316)
//     Archivo Narrow 700   270 px   (system-ui : 330)
//     IBM Plex Sans 400    308 px   (system-ui : 306)
//     Bitter 400           327 px   (Georgia   : 310)
//
// Le monospace, lui, s'écrivait en clair — et pas deux fois pareil :
//
//     assets/css/chapitre.css     monospace
//     assets/js/parametres.js     monospace
//     assets/js/appairage.js      ui-monospace,Consolas,monospace
//     assets/js/appairage.js      ui-monospace,'Cascadia Code',Consolas,monospace
//
// Et `notes.css` appelait `var(--font-mono, ui-monospace, monospace)` : le
// jeton était RÉFÉRENCÉ sans avoir jamais été défini, donc toujours en repli.
// Quelqu'un l'avait voulu, personne ne l'avait créé.
//
// Trois déclarations restent en clair, et ce test les y maintient — ce sont
// des écrans qui s'affichent SANS la feuille de l'application : `index.html`
// (redirection, aucune feuille), `offline.html` (page autonome, aucune
// feuille) et le voile de `hub.js` (écran bloquant qui ne doit pas dépendre
// d'une feuille que la page hôte peut contredire, cf. son commentaire).
// Y poser `var(--font-mono)` ne donnerait aucune police du tout.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const R = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');
const GLOBAL = R('assets', 'css', 'global.css');

test('--font-mono est défini une fois, au même endroit que les trois autres rôles', () => {
    const def = GLOBAL.match(/--font-mono\s*:[^;]+;/g) || [];
    assert.equal(def.length, 1, 'un seul jeton monospace, pas un par thème : il ne dépend pas du thème');
    assert.match(def[0], /monospace/, 'la pile se termine par le repli génerique');
    // Les quatre rôles se lisent ensemble ou ne se lisent pas.
    const roles = ['--font-head', '--font-body', '--font-read', '--font-mono']
        .map(j => GLOBAL.indexOf(j + ':'));
    assert.ok(roles.every(i => i > 0), 'les quatre rôles sont déclarés');
    assert.ok(Math.max(...roles) - Math.min(...roles) < 1200,
        'les quatre déclarations restent dans le même bloc, pour qu’on les voie comme un jeu');
});

test('aucune pile monospace en clair dans ce que l\'application habille', () => {
    const fautes = [];
    const parcourir = (dir) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const p = path.join(dir, e.name);
            if (e.isDirectory()) { parcourir(p); continue; }
            if (!/\.(css|js)$/.test(e.name)) continue;
            if (/global\.css$|fonts\.css$|hub\.js$/.test(e.name)) continue;
            const src = fs.readFileSync(p, 'utf8');
            src.split('\n').forEach((l, i) => {
                if (/font-family\s*:[^;'"]*monospace/.test(l) && !/var\(--font-mono\)/.test(l)) {
                    fautes.push(`${path.relative(path.join(__dirname, '..', '..'), p)}:${i + 1}`);
                }
            });
        }
    };
    for (const d of ['assets/css', 'assets/js']) parcourir(path.join(__dirname, '..', '..', d));
    assert.deepEqual(fautes, [], `à router vers var(--font-mono) :\n${fautes.join('\n')}`);
});

test('le jeton est appelé sans repli : un repli masquerait sa disparition', () => {
    for (const f of [['assets', 'css', 'notes.css'], ['assets', 'css', 'chapitre.css']]) {
        assert.ok(!/var\(--font-mono\s*,/.test(R(...f)),
            `${f.at(-1)} : si le jeton sautait, le repli rendrait la panne invisible`);
    }
});

test('les écrans servis sans la feuille de l\'application gardent leur pile en clair', () => {
    for (const [f, src] of [['index.html', R('index.html')], ['offline.html', R('offline.html')]]) {
        assert.equal(/<link[^>]+global\.css/.test(src), false,
            `${f} ne charge pas global.css : un jeton n’y vaudrait rien`);
        assert.match(src, /font-family\s*:\s*system-ui/, `${f} nomme sa pile`);
    }
    const hub = R('assets', 'js', 'hub.js');
    assert.ok(!/var\(--font-/.test(hub),
        'le voile de hub.js est posé en ligne exprès : il ne doit rien devoir à la feuille de la page');
    assert.match(hub, /font-family:system-ui/, 'et il nomme sa pile');
});
