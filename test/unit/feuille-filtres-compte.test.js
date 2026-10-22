// ============================================================
// test/unit/feuille-filtres-compte.test.js — la feuille de filtres dit ce
// qu'on va trouver avant qu'on la referme
// ------------------------------------------------------------
// Sur téléphone, les filtres du catalogue s'ouvrent dans une feuille dont le
// bouton disait « Voir les résultats ». Les filtres s'appliquent pourtant en
// direct derrière elle : on réglait trois filtres à l'aveugle, on refermait,
// et l'on découvrait une grille vide.
//
// Vérifié dans Chromium à 390 px, catalogue simulé de 1 234 séries :
//     ouverture        « Voir 1 234 résultats »
//     clic sur statut  « Recherche… »
//     réponse vide     « Aucun résultat »
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'catalogue.js'), 'utf8').replace(/\r\n/g, '\n');

function libelle({ results = [], total = 0, aggrege = false } = {}) {
    const fn = (nom) => {
        const i = SRC.indexOf(`    function ${nom}(`);
        assert.notEqual(i, -1, `${nom} doit rester repérable`);
        return SRC.slice(i, SRC.indexOf('\n    }\n', i) + 6);
    };
    const corps = fn('estBorneBasse') + fn('libelleVoirResultats');
    // eslint-disable-next-line no-new-func
    return new Function('lastResults', 'lastTotal', 'PER_PAGE', 'allSources', `${corps}; return libelleVoirResultats;`)(
        results, total, 24, aggrege);
}
const serie = (n) => Array.from({ length: n }, (_, i) => ({ id: String(i) }));

test('un total connu est annoncé en entier, sans abréviation', () => {
    assert.equal(libelle({ results: serie(24), total: 1234 })('pret'), 'Voir 1 234 résultats');
    assert.equal(libelle({ results: serie(1), total: 1 })('pret'), 'Voir 1 résultat');
});

test('un total qui n\'est qu\'une borne basse n\'est pas présenté comme exact', () => {
    // Signature des sources qui ne connaissent pas leur catalogue : « chargé + une page ».
    assert.equal(libelle({ results: serie(24), total: 48 })('pret'), 'Voir les résultats (24+)');
});

test('tout chargé : le total est exact, même petit', () => {
    assert.equal(libelle({ results: serie(3), total: 3 })('pret'), 'Voir 3 résultats');
});

test('le compteur de la grille applique la même règle', () => {
    const i = SRC.indexOf('    function texteCompteur(');
    assert.match(SRC.slice(i, SRC.indexOf('\n    }\n', i)), /estBorneBasse\(charges, total\)/);
});

test('zéro, en cours, échec', () => {
    assert.equal(libelle()('pret'), 'Aucun résultat');
    assert.equal(libelle({ results: serie(24), total: 1234 })('enCours'), 'Recherche…');
    assert.equal(libelle({ results: serie(24), total: 1234 })('echec'), 'Voir les résultats');
});

test('la recherche prévient la feuille à chaque changement d\'état', () => {
    for (const etat of ['enCours', 'pret', 'echec']) {
        assert.ok(SRC.includes(`surEtatRecherche('${etat}')`), etat);
    }
    assert.match(SRC, /ouverte\?\.majPied\(0, libelleVoirResultats\(etat\)\)/);
    assert.match(SRC, /libelle: libelleVoirResultats\(etatRecherche\), principal: true/);
});
