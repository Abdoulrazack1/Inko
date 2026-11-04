// ============================================================
// test/unit/annuler.test.js — annuler la dernière action
// ------------------------------------------------------------
// La barre existait : `.undo-bar`, trois règles dans `global.css`, écrites
// pour l'audit AMEL-40. Mais UNE seule page la construisait — la fiche
// série, à la main, avec ses identifiants en dur, pour son « Tout lu ».
//
// Les trois autres gestes qui défont du travail n'avaient rien :
//
//   · retirer une œuvre d'une liste — un seul clic, sur une carte, au
//     milieu d'une grille : le plus facile à faire par erreur ;
//   · marquer toute une série lue depuis la bibliothèque ;
//   · supprimer un chapitre téléchargé — sans confirmation non plus.
//
// C'est le défaut de l'étape 2 pris à l'envers. Là, une classe nommée
// globalement était redessinée par chaque page ; ici, un style nommé
// globalement n'était construit que par une seule.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const lire = (...p) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8')
    .replace(/\r\n/g, '\n');
const GLOBAL_JS = lire('assets', 'js', 'global.js');
const GLOBAL_CSS = lire('assets', 'css', 'global.css');

const corps = /window\.MH\.annuler = function[\s\S]*?\n    \};/.exec(GLOBAL_JS);

test('la barre est un composant, pas un gabarit recopié', () => {
    assert.ok(corps, 'MH.annuler existe');
    assert.match(GLOBAL_JS, /window\.MH\.fermerAnnulation = function/);
    // Et la feuille la portait déjà : c'est bien le composant qui manquait.
    assert.match(GLOBAL_CSS, /\.undo-bar \{/);
    assert.match(GLOBAL_CSS, /\.undo-bar-action \{/);
});

test('une seule barre à la fois', () => {
    // Une pile d'annulations promettrait de défaire des gestes dans
    // l'ordre inverse, ce que les routes de l'API ne savent pas faire.
    // Une profondeur de un, qu'on tient, vaut mieux qu'une pile qui ment.
    assert.match(corps[0], /window\.MH\.fermerAnnulation\(\);/,
        'la nouvelle remplace l’ancienne');
});

test('elle est persistante, et elle informe sans interrompre', () => {
    // Un toast de trois secondes ne laisse pas le temps de réaliser qu'on
    // s'est trompé. Rien ne doit la refermer tout seul.
    assert.ok(!/setTimeout\([^)]*partir/.test(corps[0]),
        'aucune minuterie ne la retire');
    assert.match(corps[0], /setAttribute\('role', 'status'\)/);
    assert.ok(!/'alert'/.test(corps[0]), 'status et non alert : on n’interrompt pas');
});

test('Ctrl+Z la déclenche, sauf dans un champ de saisie', () => {
    assert.match(corps[0], /e\.ctrlKey \|\| e\.metaKey/);
    // Dans un champ, Ctrl+Z appartient au navigateur : le lui prendre
    // ferait perdre une frappe pour défaire autre chose.
    assert.match(corps[0], /isContentEditable \|\| \/\^\(INPUT\|TEXTAREA\|SELECT\)\$\/\.test/);
    // Maj+Ctrl+Z est « refaire » ailleurs : on ne le capte pas.
    assert.match(corps[0], /e\.shiftKey/);
});

test('un échec le dit et laisse réessayer', () => {
    // Une annulation qu'on croit faite et qui ne l'est pas est pire que
    // pas d'annulation du tout.
    assert.match(corps[0], /L'annulation a échoué\./);
    assert.match(corps[0], /action\.disabled = false;/);
    // Et la barre ne part QUE si l'annulation a réussi.
    assert.match(corps[0], /await surAnnulation\(\);\s*\n\s*partir\(\);/);
});

test('le texte est posé comme du texte, jamais comme du balisage', () => {
    // Les messages portent des titres d'œuvres, qui viennent des sources.
    assert.match(corps[0], /texte\.textContent = message;/);
    assert.ok(!/innerHTML/.test(corps[0]), `innerHTML dans la barre :\n${corps[0]}`);
});

test('les quatre gestes destructeurs l’utilisent', () => {
    const attendus = [
        ['serie.js', /MH\.annuler\(`\$\{nouveaux\.length\} chapitre/],
        ['collection-detail.js', /MH\.annuler\(`« \$\{retiree\.title/],
        ['bibliotheque.js', /MH\.annuler\(`\$\{nouveaux\.length\} chapitre/],
        ['downloads-page.js', /MH\.annuler\(`\$\{quoi\} supprimé/],
    ];
    for (const [f, motif] of attendus) {
        assert.match(lire('assets', 'js', f), motif, `${f} propose une annulation`);
    }
    // La fiche série ne construit plus la sienne à la main.
    const serie = lire('assets', 'js', 'serie.js');
    assert.ok(!/undoMarkBar|undoMarkGo|undoMarkClose/.test(serie),
        'les identifiants en dur ont disparu');
});

test('une œuvre remise dans une liste revient À SA PLACE', () => {
    // `addToList` ajoute en queue. Sans le `reorderList` qui suit,
    // « annuler » déplacerait l'œuvre au lieu de la rendre — une
    // annulation qui laisse une trace n'en est pas une.
    const cd = lire('assets', 'js', 'collection-detail.js');
    assert.match(cd, /const ordreAvant = items\.map/);
    assert.match(cd, /API\.me\.reorderList\(list\.id, ordreAvant\)/);
    assert.match(cd, /list\.items\.splice\(i, 0, retiree\)/);
});

test('marquer une série lue ne défait que ce que CE clic a fait', () => {
    // Sans ça, « annuler » remettrait en non-lu des chapitres lus il y a
    // des mois : une annulation qui détruit du travail n'en est pas une.
    const bib = lire('assets', 'js', 'bibliotheque.js');
    assert.match(bib, /const tout = await API\.me\.readChapters\(\);/);
    assert.match(bib, /const nouveaux = chaps\.filter\(c => !dejaLus\.has\(c\.chapterId\)\)/);
    assert.match(bib, /unmarkChaptersBulk\(mangaId, nouveaux\)/);
});

test('un bouton qui retélécharge ne s’appelle pas « Annuler »', () => {
    // Supprimer un chapitre rend les octets au cache : on ne peut pas les
    // reprendre, seulement les retélécharger. Ça coûte du temps et du
    // réseau — et c'est une très mauvaise surprise en données mobiles. Le
    // bouton dit donc ce qu'il fait.
    const dl = lire('assets', 'js', 'downloads-page.js');
    assert.match(dl, /libelle: 'Retélécharger'/);
    // Et les métadonnées sont prises AVANT la suppression : après, il n'y
    // a plus rien à partir de quoi reconstruire.
    // Le GESTIONNAIRE, pas le gabarit : `data-delchap` paraît d'abord dans
    // le balisage du bouton, une quarantaine de lignes plus haut.
    const bloc = /querySelectorAll\('\[data-delchap\]'\)[\s\S]*?\n        \}\)\);/.exec(dl);
    assert.ok(bloc, 'le gestionnaire de suppression');
    const iGet = bloc[0].indexOf('Downloads.get(id)');
    const iRemove = bloc[0].indexOf('Downloads.remove(id)');
    assert.ok(iGet > 0 && iGet < iRemove,
        'les métadonnées sont lues avant la suppression');
});
