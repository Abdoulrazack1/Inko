// ============================================================
// test/unit/squelettes.test.js — un seul squelette de chargement
// ------------------------------------------------------------
// Le système existe : `MH.squelette` pose des blocs AUX DIMENSIONS
// FINALES, met `aria-busy` et le lève tout seul. Trois fichiers s'en
// servaient. Les autres attentes se montraient autrement — et pas de la
// même manière du tout.
//
// Une roue qui tourne ne réserve rien. Mesuré dans la page de recherche :
//
//     l'attente actuelle (roue)        143 px
//     la grille qui la remplace        937 px pour 12 cartes
//
// Soit près de 800 px de saut à l'arrivée des résultats — exactement ce
// que le commentaire du système décrit : « à l'arrivée des données, tout
// saute ».
//
// En posant le squelette d'un rayon d'accueil, la mesure a trouvé autre
// chose : les cartes du rayon n'avaient PAS de hauteur fixe. Leur titre
// tenait sur une ou deux lignes selon l'œuvre, donc aucun squelette ne
// pouvait coller. `.shelf-name` a maintenant la hauteur figée que
// `.manga-card-title` avait déjà — et les 59 cartes de l'accueil font
// désormais toutes exactement 300 px, au lieu de varier.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const JS = path.join(__dirname, '..', '..', 'assets', 'js');
const lire = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');
const GLOBAL = lire('assets', 'js', 'global.js');

// Le lecteur garde sa roue, et c'est juste : il attend une page entière
// dont il ne connaît ni le nombre d'images ni leur taille. Un squelette
// y mentirait au lieu de réserver.
const ROUE_LEGITIME = new Set(['chapitre.js', 'lecture.js']);

test('les trois formes de squelette sont au même endroit', () => {
    for (const t of ['rayon', 'ligne']) {
        assert.ok(GLOBAL.includes(`type === '${t}'`), `le type « ${t} » doit exister`);
    }
    assert.match(GLOBAL, /window\.MH\.squelette = function/, 'une seule fabrique');
    // Chaque forme reprend les CLASSES de la vraie carte : recopier ses
    // valeurs les laisserait dériver au premier changement.
    assert.match(GLOBAL, /class="shelf-card shelf-card--skel mh-sq"/);
    assert.match(GLOBAL, /class="manga-card mh-sq"/);
});

test('aucune page ne fabrique son propre squelette', () => {
    const fautes = [];
    for (const f of fs.readdirSync(JS).filter(n => n.endsWith('.js') && n !== 'global.js')) {
        const src = fs.readFileSync(path.join(JS, f), 'utf8');
        if (/(skel|mh-sq)[^a-z]/.test(src) && !/MH\.squelette/.test(src)) fautes.push(f);
    }
    assert.deepEqual(fautes, [], `squelettes écrits à la main :\n  ${fautes.join('\n  ')}`);
});

test('une attente qui connaît sa forme finale ne montre plus une roue', () => {
    const fautes = [];
    for (const f of fs.readdirSync(JS).filter(n => n.endsWith('.js'))) {
        if (ROUE_LEGITIME.has(f)) continue;
        const src = fs.readFileSync(path.join(JS, f), 'utf8');
        // Une roue posée comme CONTENU d'un conteneur remplace ce qui va
        // venir : c'est là qu'elle coûte un saut. Une roue dans un bouton
        // ou à côté d'un texte ne réserve rien et n'a rien à réserver.
        const re = /innerHTML\s*=\s*[`'"][^`'"]{0,200}spinner-inline[^`'"]{0,200}[`'"]/g;
        let m;
        while ((m = re.exec(src))) {
            fautes.push(`${f}:${src.slice(0, m.index).split('\n').length}`);
        }
    }
    assert.deepEqual(fautes, [],
        `attentes qui ne réservent pas la place :\n  ${fautes.join('\n  ')}`);
});

test('la carte d\'un rayon a une hauteur fixe, sinon rien ne peut la préfigurer', () => {
    const css = lire('assets', 'css', 'accueil.css');
    assert.match(css, /\.shelf-name \{[^}]*min-height:/,
        'sans hauteur figée, le titre fait une ou deux lignes selon l’œuvre');
    const g = lire('assets', 'css', 'global.css');
    assert.match(g, /\.shelf-card--skel \.shelf-meta \{[^}]*min-height:/,
        'et la ligne de méta du squelette doit valoir celle de la vraie carte');
});

test('le squelette s\'annonce, et cesse de s\'annoncer', () => {
    // Un `aria-busy` jamais levé laisse la grille « en cours de chargement »
    // pour toujours : un défaut invisible à l'écran, qui ne gêne que ceux
    // qui ne le voient pas non plus.
    assert.match(GLOBAL, /el\.setAttribute\('aria-busy', 'true'\)/);
    assert.match(GLOBAL, /el\.removeAttribute\('aria-busy'\)/);
    assert.match(GLOBAL, /new MutationObserver/,
        'la levée est automatique : la confier aux appelants, c’est attendre qu’un seul l’oublie');
});
