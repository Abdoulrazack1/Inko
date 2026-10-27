// ============================================================
// test/unit/jauges.test.js — une seule barre de progression
// ------------------------------------------------------------
// Treize jauges relevées dans les feuilles : trois épaisseurs (3, 4 et
// 5 px), sept rayons, trois couleurs de piste. Et `.progress-bar-big`
// était déclaré DEUX FOIS — 4 px / rayon 2 dans `chapitre.css`, 5 px /
// rayon 3 dans `serie.css`. Le même nom de classe, deux tailles, selon
// la page où l'on se trouvait. C'est le troisième cas de cette famille
// trouvé dans l'étape 2, après `.reader-chap-select` et les cartes.
//
// Les trois épaisseurs sont gardées : elles répondent à trois usages
// réels — un filet d'ambiance en haut du lecteur, une jauge posée sur
// une carte, une barre qu'on lit pour elle-même. Ce qui change, c'est
// qu'elles portent un nom, et que le comportement est commun.
//
// Vérifié dans les pages : les six jauges de la bibliothèque rendent
// toutes `4px / 999px`, piste et remplissage compris, sans débordement.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const CSS = path.join(__dirname, '..', '..', 'assets', 'css');
const FEUILLES = fs.readdirSync(CSS).filter(f => f.endsWith('.css'))
    .map(f => [f, fs.readFileSync(path.join(CSS, f), 'utf8').replace(/\r\n/g, '\n')]);
const TOUT = FEUILLES.map(([, s]) => s).join('\n');

// Les jauges : une piste et son remplissage. Les barres d'outils, les
// barres de recherche et le bandeau de musique portent le même mot dans
// leur nom mais ne sont pas des jauges — on les nomme pour ne pas les
// confondre avec ce qu'on mesure ici.
const JAUGES = [
    '.progress-bar', '.progress-bar-big', '.lib2-progress', '.list-manga-prog-bar',
    '.last-read-bar', '.genre-bar-track', '.novel-progressbar', '.reader-progressbar',
];
const REMPLISSAGES = [
    '.progress-fill', '.lib2-progress-fill', '.genre-bar-fill',
    '.novel-progressbar-fill', '.reader-progressbar-fill',
];

const regles = (sel) => FEUILLES
    .map(([f, s]) => {
        const out = [];
        const re = new RegExp('(^|\\n)[^\\n{}]*\\' + sel + '\\s*\\{([^}]*)\\}', 'g');
        let m;
        while ((m = re.exec(s))) out.push([f, m[2]]);
        return out;
    })
    .flat();

test('les trois épaisseurs sont nommées, et ce sont les seules', () => {
    for (const j of ['--jauge-fine', '--jauge-normale', '--jauge-epaisse',
        '--jauge-piste', '--jauge-couleur']) {
        assert.match(TOUT, new RegExp(j + '\\s*:'), `${j} doit être défini`);
    }
    const fautes = [];
    for (const sel of JAUGES) {
        for (const [f, corps] of regles(sel)) {
            const h = /(?:^|;)\s*height\s*:\s*([^;}]+)/.exec(corps);
            if (h && !/var\(--jauge-/.test(h[1])) fautes.push(`${f} ${sel} — height: ${h[1].trim()}`);
        }
    }
    assert.deepEqual(fautes, [], `épaisseurs en dur :\n  ${fautes.join('\n  ')}`);
});

test('une jauge a les mêmes extrémités partout, piste comme remplissage', () => {
    const fautes = [];
    for (const sel of [...JAUGES, ...REMPLISSAGES]) {
        for (const [f, corps] of regles(sel)) {
            const r = /border-radius\s*:\s*([^;}]+)/.exec(corps);
            if (r && r[1].trim() !== '999px') fautes.push(`${f} ${sel} — ${r[1].trim()}`);
        }
    }
    assert.deepEqual(fautes, [],
        `rayons qui ne font pas une pastille :\n  ${fautes.join('\n  ')}`);
});

test('`.progress-bar-big` ne vaut plus deux tailles selon la page', () => {
    const defs = regles('.progress-bar-big').filter(([, c]) => /height\s*:/.test(c));
    assert.ok(defs.length >= 2, 'la classe est bien déclarée dans deux feuilles');
    const tailles = new Set(defs.map(([, c]) => /height\s*:\s*([^;}]+)/.exec(c)[1].trim()));
    assert.equal(tailles.size, 1,
        `le même nom de classe doit donner la même barre : ${[...tailles].join(' vs ')}`);
});

test('la classe `.jauge` existe pour ce qu’on écrira ensuite', () => {
    // Sans elle, la prochaine jauge repartirait d'un height et d'un
    // border-radius écrits à la main — c'est ainsi qu'on en compte treize.
    assert.match(TOUT, /\n\.jauge \{[^}]*height:\s*var\(--jauge-epaisseur, var\(--jauge-normale\)\)/,
        'une épaisseur par défaut, surchargeable');
    assert.match(TOUT, /\n\.jauge > \* \{[^}]*transition: width var\(--jauge-duree\)/,
        'et un seul comportement d’animation');
});
