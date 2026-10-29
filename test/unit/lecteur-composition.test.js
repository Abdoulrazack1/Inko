// ============================================================
// test/unit/lecteur-composition.test.js — la planche tient seule
// ------------------------------------------------------------
// C'est l'écran dont tout le reste de l'application n'est que
// l'antichambre, et c'était celui où l'habillage se mettait le plus en
// travers : un cadre autour de la planche, une lueur orange autour du
// cadre, et deux feuilles de verre dépoli posées par-dessus.
//
// Mesure de départ, un chapitre de One Piece affiché : 88 surfaces
// arrondies, 7 `backdrop-filter`, 9 ombres, 74 filets — pour une page
// dont le contenu est UNE image.
//
// Les treize rayons distincts de cette page ne sont PAS traités ici :
// la PR #133 les remplace déjà tous par l'échelle. Ce lot ne retire un
// rayon que là où la composition l'exige — la planche et son cadre.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const CSS = fs.readFileSync(
    path.join(__dirname, '..', '..', 'assets', 'css', 'chapitre.css'), 'utf8'
).replace(/\r\n/g, '\n');
// Les commentaires de ce fichier citent ce qu'ils ont remplacé : on mesure
// les déclarations, pas la prose.
const SANS_COMMENTAIRES = CSS.replace(/\/\*[\s\S]*?\*\//g, '');

const regle = (sel) => {
    const m = new RegExp('\\n' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ' \\{([^}]*)\\}').exec(CSS);
    return m ? m[1] : null;
};

test('la planche tient seule', () => {
    const z = regle('.reader-pages-area');
    assert.ok(z, '.reader-pages-area');
    assert.ok(!/border:/.test(z), 'plus de filet autour de l’œuvre');
    assert.ok(!/border-radius/.test(z), 'une planche imprimée n’a pas de coins arrondis');
    assert.ok(!/box-shadow/.test(z), 'ni les trois ombres…');
    assert.ok(!/rgba\(255,107,26/.test(z), '…dont un anneau orange à 3 %');
    assert.ok(!/#060608/.test(z), 'ni un fond codé en dur à côté du jeton');
    assert.match(z, /background: var\(--bg\)/, 'elle se pose sur le fond de la page');
    // Et la planche elle-même n'a plus de coins arrondis.
    assert.ok(!/border-radius/.test(regle('.reader-page-img')));
});

test('plus de verre dépoli au-dessus d’une planche', () => {
    // blur(24px) saturate(1.9) était la plus lourde feuille de verre de
    // l'application : saturer à 1,9 étale la couleur du dessin dans la
    // barre à chaque page tournée.
    for (const sel of ['.reader-toolbar', '.reader-modebar']) {
        const r = regle(sel);
        assert.ok(r, sel);
        assert.ok(!/backdrop-filter/.test(r), `${sel} : le flou salit l’œuvre au lieu de la voiler`);
        assert.ok(!/saturate/.test(r.replace(/\/\*[\s\S]*?\*\//g, '')),
            `${sel} : et la saturation l’étale`);
        assert.match(r, /background: var\(--bg\d?\)/, `${sel} : un aplat opaque`);
    }
    assert.ok(!/inset 0 1px 0 rgba\(255,255,255,\.08\), 0 4px 20px/.test(CSS),
        'et le liseré blanc intérieur avec');
    // Le menu « ⋯ » est opaque à 96 % : son flou de 16 px ne se voyait pas.
    assert.ok(!/backdrop-filter: blur\(16px\)/.test(CSS));
});

test('rien ne se pose sur la planche', () => {
    // Les deux zones de tour de page voilaient un tiers du dessin de
    // chaque côté, en dégradé noir, pour annoncer une flèche.
    assert.ok(!/\.page-zone-prev \{[^}]*linear-gradient/.test(CSS));
    assert.ok(!/\.page-zone-next \{[^}]*linear-gradient/.test(CSS));
    const f = regle('.page-zone-arrow');
    assert.ok(f && !/backdrop-filter/.test(f), 'la flèche n’est plus un disque flouté');
    assert.ok(!/border-radius: 50%/.test(f) && !/border:/.test(f));
    assert.match(f, /text-shadow/, 'une ombre portée suffit à la tenir lisible');
    // Le compteur de page était une pilule bordée et floutée, en bas au
    // milieu — là où finit la dernière case.
    const c = regle('.page-counter-badge') || '';
    assert.ok(!/backdrop-filter/.test(c) && !/border: 1px/.test(c) && !/border-radius/.test(c),
        'le chiffre seul, avec une ombre portée');
});

test('la couleur de marque ne va pas sur le mobilier du lecteur', () => {
    // Six familles viraient à l'orange : le mode actif, les dix boutons
    // d'outil au survol, leur état « on », le retour à la série, les
    // boutons de navigation, le partage.
    const orange = [];
    for (const m of SANS_COMMENTAIRES.matchAll(/([^\n{}]*)\{([^}]*)\}/g)) {
        if (/background:\s*(var\(--orange\)|rgba\(255,107,26)/.test(m[2])) orange.push(m[1].trim());
    }
    // Deux survivants, et ils portent tous deux une donnée : le remplissage
    // de la barre de progression (où l'on en est dans le chapitre) et le
    // filet de 3 px qui désigne le bloc « chapitre suivant » — même
    // grammaire que le filet d'accent des filtres actifs.
    assert.deepEqual(orange, ['.reader-next-chapter::before', '.reader-progressbar-fill'],
        `aplats d’accent restants :\n  ${orange.join('\n  ')}`);
    assert.match(regle('.modebar-btn.active'), /background: var\(--bg4\)/,
        'sixième écran où le choix actif était un aplat d’accent');
    // Signet posé / immersif / défilement auto : des données, donc de
    // l'encre d'accent — comme l'épingle de la bibliothèque.
    assert.match(regle('.reader-icon-btn.on'), /color: var\(--accent-text/);
    // Et cette règle était écrite DEUX FOIS, à 780 lignes d'écart.
    assert.equal((CSS.match(/\n\.reader-icon-btn\.on \{/g) || []).length, 1);
});

test('dix-sept vignettes, pas dix-sept cadres', () => {
    const t = regle('.reader-thumb');
    assert.ok(t && !/border-radius/.test(t));
    assert.ok(!/border: 2px solid/.test(t), 'plus de cadre de 2 px tout autour');
    assert.match(t, /border-bottom: 2px solid transparent/, 'un soulignement suffit');
    assert.ok(!/\.reader-thumb:hover \{ border-color: rgba\(255,107,26/.test(CSS));
    assert.ok(!/\.reader-thumb\.active \{[^}]*box-shadow/.test(CSS), 'ni la lueur');
    // La vignette en cours le disait déjà par sa lumière.
    assert.match(CSS, /\.reader-thumb img \{[^}]*opacity: 0\.5/);
});

test('l’encre crème n’atteignait pas le lecteur', () => {
    // Le lecteur redéfinit toute la palette pour se forcer en sombre :
    // la correction faite dans global.css ne l'atteint pas.
    assert.ok(!/--text: #e9e7e0/.test(CSS), '#e9e7e0 se lit comme une identité d’assistant');
    assert.match(CSS, /--text: #e9e9ec/);
});

test('rien sous onze pixels, plus une capitale espacée', () => {
    const petites = [];
    for (const m of CSS.matchAll(/([^\n{}]*)\{([^}]*font-size:\s*([\d.]+)px[^}]*)\}/g)) {
        if (Number(m[3]) < 11) petites.push(`${m[1].trim()} — ${m[3]}px`);
    }
    assert.deepEqual(petites, [], `sous le plancher :\n  ${petites.join('\n  ')}`);
    const caps = [];
    for (const m of CSS.matchAll(/([^\n{}]*)\{([^}]*)\}/g)) {
        if (/text-transform:\s*uppercase/.test(m[2])) caps.push(m[1].trim());
    }
    // À 9,5 px, en capitales, avec 0,1 em d'approche, on ne lit plus un
    // mot : on reconnaît une forme.
    assert.deepEqual(caps, [], `à passer en bas de casse :\n  ${caps.join('\n  ')}`);
});
