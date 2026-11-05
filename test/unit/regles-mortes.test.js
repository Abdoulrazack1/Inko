// ============================================================
// test/unit/regles-mortes.test.js — une règle écrite n'est pas une règle
// appliquée
// ------------------------------------------------------------
// En mesurant les marges du lecteur (« harmoniser les marges entre
// modes »), les marges se sont révélées DÉJÀ identiques — 8px 0 en mode
// page comme en défilement, à 687 px comme à 454 px. Ce qui ne l'était
// pas, c'est la cohérence du fichier : une règle mobile déclarait
// `padding: var(--sp-2); min-height: 400px` et ne s'appliquait jamais.
//
// La cause est une règle de cascade qu'on oublie facilement : une
// requête média n'ajoute AUCUNE spécificité. À sélecteur égal, c'est la
// dernière écrite qui gagne, qu'elle soit dans un `@media` ou non. Une
// règle mobile placée avant la règle de base est donc morte.
//
// Trois cas trouvés en balayant les feuilles :
//
//   chapitre.css  .reader-page-wrapper    mesuré 8px 0 / 0, pas 8px / 400px
//   chapitre.css  .reader-settings-pop    le panneau prenait les valeurs
//                                         du bureau sur un téléphone
//   catalogue.css .catalogue-header       TROIS déclarations contradictoires
//                                         dont un `!important` qui gagnait
//
// Ce test refuse qu'une quatrième apparaisse.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..', '..', 'assets', 'css');

/**
 * Découpe une feuille en règles, en notant si chacune est dans un
 * `@media`. Volontairement simple : les feuilles du projet n'imbriquent
 * pas, et un analyseur complet se tromperait de métier.
 */
function regles(src) {
    const out = [];
    let i = 0, ligne = 1, media = 0;
    while (i < src.length) {
        const c = src[i];
        if (c === '\n') { ligne++; i++; continue; }
        if (src.startsWith('/*', i)) {
            const j = src.indexOf('*/', i);
            if (j < 0) break;
            ligne += (src.slice(i, j).match(/\n/g) || []).length;
            i = j + 2; continue;
        }
        if (c === '}') { if (media > 0) media--; i++; continue; }
        const o = src.indexOf('{', i);
        if (o < 0) break;
        const tete = src.slice(i, o).trim();
        ligne += (src.slice(i, o).match(/\n/g) || []).length;
        if (tete.startsWith('@')) {
            if (/^@media/.test(tete)) media++;
            i = o + 1; continue;
        }
        const f = src.indexOf('}', o);
        if (f < 0) break;
        const props = {};
        for (const d of src.slice(o + 1, f).split(';')) {
            const k = d.indexOf(':');
            if (k > 0) props[d.slice(0, k).trim().toLowerCase()] = d.slice(k + 1).trim();
        }
        out.push({ ligne, sel: tete, props, media: media > 0 });
        ligne += (src.slice(o, f).match(/\n/g) || []).length;
        i = f + 1;
    }
    return out;
}

test('aucune règle de requête média n’est écrasée par une règle plus bas', () => {
    const fautes = [];
    for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.css'))) {
        const rs = regles(fs.readFileSync(path.join(DIR, f), 'utf8').replace(/\r\n/g, '\n'));
        for (let a = 0; a < rs.length; a++) {
            const r1 = rs[a];
            if (!r1.media || !Object.keys(r1.props).length) continue;
            for (let b = a + 1; b < rs.length; b++) {
                const r2 = rs[b];
                if (r2.media || r2.sel !== r1.sel) continue;
                // Toutes les propriétés de la règle média sont-elles reprises
                // par une règle inconditionnelle écrite après elle ?
                if (Object.keys(r1.props).every((k) => k in r2.props)) {
                    fautes.push(`${f}:${r1.ligne} « ${r1.sel} » — écrasée par la ligne `
                        + `${r2.ligne} (${Object.keys(r1.props).join(', ')})`);
                    break;
                }
            }
        }
    }
    assert.deepEqual(fautes, [],
        'une requête média n’ajoute aucune spécificité : à sélecteur égal, la '
        + 'dernière écrite gagne. Ces règles ne s’appliquent jamais :\n  '
        + fautes.join('\n  '));
});

test('les trois cas trouvés restent corrigés', () => {
    const chap = fs.readFileSync(path.join(DIR, 'chapitre.css'), 'utf8').replace(/\r\n/g, '\n');
    const cat = fs.readFileSync(path.join(DIR, 'catalogue.css'), 'utf8').replace(/\r\n/g, '\n');

    // 1. la marge mobile du cadre de planche : supprimée, elle ne disait
    //    rien de vrai (mesuré 8px 0 / 0 partout).
    assert.ok(!/\.reader-page-wrapper \{ padding: var\(--sp-2\); min-height: 400px; \}/.test(chap));

    // 2. le panneau de réglages : sa règle mobile est désormais APRÈS la base.
    const iBase = chap.indexOf('.reader-settings-pop {\n  position: fixed;');
    const iMob = chap.indexOf('.reader-settings-pop { top: 56px; right: 8px; width: 280px; }');
    assert.ok(iBase > 0 && iMob > 0, 'les deux règles existent');
    assert.ok(iMob > iBase, 'la règle mobile vient après la base, donc elle s’applique');

    // 3. l’en-tête du catalogue : une seule déclaration, sans `!important`.
    const cols = cat.match(/\.catalogue-header[^{]*\{[^}]*grid-template-columns[^}]*\}/g) || [];
    assert.equal(cols.length, 1, `une seule déclaration de colonnes :\n  ${cols.join('\n  ')}`);
    assert.ok(!/grid-template-columns: 1fr !important/.test(cat), 'et plus de !important');
});
