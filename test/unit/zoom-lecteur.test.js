// ============================================================
// test/unit/zoom-lecteur.test.js — un seul zoom, et il se souvient de la série
// ------------------------------------------------------------
// Le zoom du lecteur était écrit TROIS fois : `appliquerZoom` pour le pinch,
// `changeZoom` pour les boutons et le clavier, `toggleTapZoom` pour le
// double-tap. Trois bornes différentes, deux façons d'appliquer l'échelle.
// Deux défauts en sortaient, tous deux atteignables au doigt sur un téléphone :
//
//   · pincer jusqu'à 400 % puis toucher « − » retombait à 200 %, parce que
//     `changeZoom` plafonnait là. Un « −10 % » qui divise par deux.
//   · en mode défilement — celui des webtoons — le pinch posait
//     `transform: scale()` sur la colonne d'images empilées. La mise à
//     l'échelle fait déborder le bas du chapitre hors de la zone défilable,
//     donc hors d'atteinte : c'est exactement le défaut que `changeZoom`
//     évitait de son côté depuis un correctif, et que le geste tactile
//     réintroduisait.
//
// Et le zoom restait GLOBAL, alors que le mode de lecture, lui, est mémorisé
// par série depuis longtemps — pour la même raison : un scan de magazine et un
// webtoon ne se lisent pas à la même échelle.
//
// Ces tests portent donc sur deux choses : que le chemin du zoom soit unique
// (vérifié en l'exécutant vraiment, pas en relisant le texte), et que la
// mémoire par série existe avec le défaut global en repli.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const JS = path.join(__dirname, '..', '..', 'assets', 'js');
// Normalise les fins de ligne : git réécrit la copie de travail en CRLF sous
// Windows, et les expressions ci-dessous attendent « \n ».
const normal = (s) => s.replace(/\r\n/g, '\n');
const lire = (f) => normal(fs.readFileSync(path.join(JS, f), 'utf8'));

/**
 * Charge `chapitre.js` dans un DOM de lecteur réduit au nécessaire.
 *
 * Le gros du fichier s'exécute sur `DOMContentLoaded` ; le document jsdom est
 * déjà chargé, donc l'initialisation asynchrone (sources, chapitres, réseau)
 * ne part JAMAIS. Ce qui reste est exactement ce qu'on veut éprouver : l'état
 * du module et les fonctions qu'il publie.
 *
 * Conséquence volontaire : aucune série n'est chargée. C'est l'état réel du
 * lecteur pendant sa première seconde, et le zoom doit déjà y survivre.
 */
function monterLecteur() {
    const dom = new JSDOM(`<!doctype html><html><body>
        <div id="readerPagesArea" class="paged">
            <div class="reader-page-wrapper" style="transform:scale(1);transform-origin:top center">
                <img class="reader-page-img" src="p1.jpg">
            </div>
        </div>
        <span id="zoomLabel">100%</span>
    </body></html>`, { url: 'http://localhost/chapitre.html', runScripts: 'outside-only' });
    const w = dom.window;

    const ecritures = [];
    w.Storage = {
        getPrefs: () => ({}),
        getPref: () => undefined,
        setPref: (k, v) => ecritures.push([k, v]),
    };
    // L'URL ne porte ni `manga` ni `chapter` : l'initialisation s'arrête donc
    // sur « Lien invalide » au lieu de partir chercher une série. C'est la
    // seule chose que ce stub doit encaisser.
    w.MH = { initPage() {}, err() {}, poserEtatVide() {}, messageErreur: () => ({}) };
    w.fetch = async () => { throw new Error('aucun appel réseau attendu ici'); };

    w.eval(lire('chapitre.js'));
    return {
        w,
        ecritures,
        label: () => w.document.getElementById('zoomLabel').textContent,
        planche: () => w.document.querySelector('.reader-page-wrapper'),
    };
}

// ── Le chemin unique, exécuté ───────────────────────────────

test('les boutons + / − passent par le même zoom que le pinch', () => {
    const { w, label, planche } = monterLecteur();

    w.changeZoom(50);
    assert.equal(label(), '150%', 'l’étiquette doit suivre');
    assert.equal(planche().style.transform, 'scale(1.5)',
        'en mode page, l’échelle reste un transform');
});

test('pincer à 400 % puis toucher « − » ne divise plus le zoom par deux', () => {
    const { w, label } = monterLecteur();

    // Le pinch atteint 400 % (c'est la borne du module de gestes). Le défaut :
    // `changeZoom` plafonnait à 200, donc le premier « −10 % » ramenait à 200.
    w.changeZoom(300);
    assert.equal(label(), '400%', 'le plafond du lecteur est celui du pinch');

    w.changeZoom(-10);
    assert.equal(label(), '390%', 'un « −10 % » retire dix pour cent, pas la moitié');
});

test('le zoom a un plancher, et il ne descend pas sous celui des boutons', () => {
    const { w, label } = monterLecteur();
    w.changeZoom(-1000);
    assert.equal(label(), '50%', 'sous 50 % la planche n’est plus lisible');
});

test('zoomer avant qu’une série soit chargée n’échoue pas', () => {
    // Le lecteur publie `changeZoom` dès l'exécution du fichier, bien avant que
    // la série soit connue. Écrire la préférence par série sans garde y
    // lèverait sur `manga.id` — et le bouton de zoom serait mort pendant toute
    // la phase de chargement, c'est-à-dire précisément quand elle est longue.
    const { w, ecritures } = monterLecteur();
    assert.doesNotThrow(() => w.changeZoom(10));
    assert.deepEqual(ecritures, [['zoom', 110]],
        'sans série, seul le défaut global est écrit');
});

// ── La mémoire par série ────────────────────────────────────

test('le zoom est mémorisé par série, le global servant de défaut', () => {
    const src = lire('chapitre.js');

    const global = src.indexOf('if (prefs.zoom)');
    const serie = src.indexOf("if (prefs['zoom_' + mangaId])");
    assert.ok(global > 0, 'le défaut global doit être lu');
    assert.ok(serie > 0, 'la valeur de la série doit être lue');
    assert.ok(serie > global,
        'la série est lue APRÈS le global, sinon le global l’écraserait');

    assert.match(src, /setPref\('zoom_' \+ manga\.id, zoom\)/,
        'régler le zoom doit le retenir pour cette série');
});

test('le zoom par série suit la convention déjà posée par le mode de lecture', () => {
    // `readMode` est mémorisé par série depuis longtemps, avec exactement cette
    // forme de clé. Une seconde convention pour la même idée rendrait les
    // préférences illisibles — et impossibles à purger ensemble.
    const src = lire('chapitre.js');
    assert.match(src, /prefs\['readMode_' \+ mangaId\]/);
    assert.match(src, /prefs\['zoom_' \+ mangaId\]/);
});

// ── La non-régression du défilement ─────────────────────────

test('en défilement, le zoom est une largeur — jamais un transform', () => {
    const src = lire('chapitre.js');
    const corps = /function appliquerZoom\(z, point\) \{([\s\S]*?)\n    \}/.exec(src);
    assert.ok(corps, 'appliquerZoom doit rester repérable');
    const body = corps[1];

    assert.match(body, /readMode === 'scroll'/,
        'le mode doit être consulté AVANT d’appliquer l’échelle');
    assert.match(body, /style\.width = zoom \+ '%'/,
        'en défilement l’échelle passe par la largeur de la colonne');
    assert.match(body, /style\.transform = ''/,
        'et le transform d’un passage précédent doit être effacé');

    // La borne du mode défilement est 100 % : une largeur ne dépasse pas son
    // conteneur. Sans elle, l'étiquette annoncerait « 150 % » devant une
    // planche inchangée — un chiffre faux est pire que pas de chiffre.
    assert.match(body, /defilement \? 100 : 400/,
        'le plafond dépend du mode');
});

test('plus aucune copie du zoom en dehors du point d’entrée', () => {
    const src = lire('chapitre.js');

    // Si ce compte repasse à trois, c'est que quelqu'un a réécrit une variante
    // locale — et les deux défauts ci-dessus reviennent avec elle.
    const persistances = (src.match(/setPref\('zoom'/g) || []).length;
    assert.equal(persistances, 1,
        'un seul endroit persiste le zoom, sinon les chemins divergent à nouveau');

    const tapZoom = /function toggleTapZoom\(point\) \{([\s\S]*?)\n    \}/.exec(src);
    assert.ok(tapZoom, 'toggleTapZoom doit rester repérable');
    assert.match(tapZoom[1], /appliquerZoom\(/,
        'le double-tap délègue');
    assert.ok(!/style\.transform/.test(tapZoom[1]),
        'le double-tap ne doit plus appliquer l’échelle lui-même');

    assert.match(src, /window\.changeZoom = function \(delta\) \{ appliquerZoom\(zoom \+ delta\); \};/,
        'les boutons et le clavier ne font plus que fournir le pas');
});

test('changer de mode renormalise le zoom avant de redessiner', () => {
    // Passer en défilement avec 150 % en mémoire afficherait une planche à
    // 100 % sous une étiquette « 150 % » : les bornes dépendent du mode, donc
    // le zoom doit être repassé dans la moulinette au changement.
    const src = lire('chapitre.js');
    const ordre = /appliquerZoom\(zoom\);\n            renderPage\(currentPage\);/;
    assert.match(src, ordre,
        'la renormalisation vient AVANT le rendu, sinon le rendu utilise l’ancienne valeur');
});
