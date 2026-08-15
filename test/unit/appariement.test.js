// ============================================================
// test/unit/appariement.test.js — le moteur de migration (P0.5)
// ------------------------------------------------------------
// Ce module décide où atterrit la progression d'un lecteur quand sa source
// meurt. Une erreur ici ne plante rien : elle déplace 143 chapitres lus sur la
// mauvaise œuvre, en silence, et sans retour possible côté source d'origine.
// D'où une couverture volontairement tatillonne.
//
// Il vit dans `test/unit/` — donc dans le job `frontend-lint`, qui n'installe
// QUE les dépendances racine. C'est possible parce que `lib/appariement.js`
// n'en a aucune : ni base, ni réseau, ni express. C'était une raison de
// l'écrire ainsi.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');

const A = require(path.join(__dirname, '..', '..', 'server', 'lib', 'appariement.js'));

// ── Numéros de chapitre ─────────────────────────────────────
test('normaliserNumero : les notations réelles des sources', () => {
    const cas = [
        ['143', 143], [143, 143], ['Chapitre 143', 143], ['Ch. 143', 143],
        ['143.5', 143.5], ['143,5', 143.5],          // virgule décimale (sources fr)
        ['143v2', 143], ['143V3', 143],              // réédition : même chapitre
        ['Chapitre 143 - Le duel', 143],
    ];
    for (const [entree, attendu] of cas) {
        assert.strictEqual(A.normaliserNumero(entree), attendu, `« ${entree} »`);
    }
});

test('normaliserNumero : rien de lisible → null, jamais un nombre inventé', () => {
    for (const v of [null, undefined, '', 'Extra', 'Hors-série', 'Épilogue', {}, NaN]) {
        assert.strictEqual(A.normaliserNumero(v), null, `« ${String(v)} » ne doit rien produire`);
    }
});

// ── Appariement ─────────────────────────────────────────────
test('apparierChapitres : reporte par NUMÉRO, pas par identifiant', () => {
    // Le cas réel : les identifiants n'ont aucun rapport d'une source à
    // l'autre. Seul le numéro fait le lien.
    const lus = [
        { chapterId: 'novelbin:c-1', chapter: 1 },
        { chapterId: 'novelbin:c-2', chapter: 2 },
        { chapterId: 'novelbin:c-143', chapter: 143 },
    ];
    const cibles = [
        { id: '01ABC-143', number: '143' },
        { id: '01ABC-2', number: 'Chapitre 2' },
        { id: '01ABC-1', number: '1' },
    ];
    const { reportes, absents } = A.apparierChapitres(lus, cibles);
    assert.strictEqual(reportes.length, 3);
    assert.strictEqual(absents.length, 0);
    const c143 = reportes.find(r => r.numero === 143);
    assert.strictEqual(c143.ancienId, 'novelbin:c-143');
    assert.strictEqual(c143.nouvelId, '01ABC-143');
});

test('apparierChapitres : un numéro absent en face est SIGNALÉ, pas rapproché', () => {
    // Rattacher 144 au chapitre 143 « le plus proche » ferait croire au lecteur
    // qu'il a lu un chapitre qu'il n'a pas lu — ou l'inverse.
    const lus = [{ chapterId: 'a', chapter: 143 }, { chapterId: 'b', chapter: 144 }];
    const cibles = [{ id: 'x', number: 143 }];
    const { reportes, absents } = A.apparierChapitres(lus, cibles);
    assert.strictEqual(reportes.length, 1);
    assert.deepStrictEqual(absents, [144]);
});

test('apparierChapitres : les hors-série ne se confondent pas avec l entier', () => {
    const lus = [{ chapterId: 'a', chapter: '143' }, { chapterId: 'b', chapter: '143.5' }];
    const cibles = [{ id: 'x', number: '143' }, { id: 'y', number: '143.5' }];
    const { reportes } = A.apparierChapitres(lus, cibles);
    assert.strictEqual(reportes.find(r => r.numero === 143).nouvelId, 'x');
    assert.strictEqual(reportes.find(r => r.numero === 143.5).nouvelId, 'y');
});

test('apparierChapitres : une réédition v2 retrouve bien son chapitre', () => {
    const { reportes } = A.apparierChapitres(
        [{ chapterId: 'a', chapter: '143v2' }], [{ id: 'x', number: '143' }]);
    assert.strictEqual(reportes.length, 1);
    assert.strictEqual(reportes[0].nouvelId, 'x');
});

test('apparierChapitres : entrées illisibles ou vides — aucun report hasardeux', () => {
    const { reportes, absents } = A.apparierChapitres(
        [{ chapterId: 'a', chapter: 'Épilogue' }, { chapterId: 'b', chapter: null }],
        [{ id: 'x', number: 1 }]);
    assert.deepStrictEqual(reportes, []);
    assert.deepStrictEqual(absents, []);
    assert.deepStrictEqual(A.apparierChapitres(null, null), { reportes: [], absents: [] });
    assert.deepStrictEqual(A.apparierChapitres([], []), { reportes: [], absents: [] });
});

// ── Score ───────────────────────────────────────────────────
test('scoreTitre : un titre exact bat toujours un titre qui le contient', () => {
    assert.ok(A.scoreTitre('Solo Leveling', 'Solo Leveling')
            < A.scoreTitre('Solo Leveling: Ragnarok', 'Solo Leveling'));
    assert.ok(A.scoreTitre('Solo Leveling: Ragnarok', 'Solo Leveling')
            < A.scoreTitre('Solo Apocalypse', 'Solo Leveling'));
    // La ponctuation disparaît dès la mise en mots : « one-piece » et
    // « One Piece » deviennent identiques, donc score 0.
    assert.strictEqual(A.scoreTitre('one-piece', 'One Piece'), 0, 'ponctuation et casse ignorées');
    // Le rang 1 sert au cas où c'est la SÉPARATION des mots qui diffère —
    // fréquent entre une source anglophone et une source francophone.
    assert.strictEqual(A.scoreTitre('OnePiece', 'One Piece'), 1);
});

test('classer : le meilleur candidat sort en tête, et le score est exposé', () => {
    const reference = { titre: 'Solo Leveling', chapitres: 200, annee: 2018 };
    const classes = A.classer([
        { source: 'weebcentral', titre: 'Na Honjaman Level-Up', chapitres: 201, annee: 2018 },
        { source: 'sushiscan',   titre: 'Solo Leveling',        chapitres: 200, annee: 2018 },
        { source: 'mangadex',    titre: 'Solo Leveling',        chapitres: 179, annee: 2018 },
    ], reference);

    assert.strictEqual(classes[0].source, 'sushiscan', 'titre exact + même compte de chapitres');
    assert.strictEqual(classes[1].source, 'mangadex',  'titre exact mais moins de chapitres');
    assert.strictEqual(classes[2].source, 'weebcentral', 'titre différent : dernier malgré le compte');
    assert.ok(classes.every(c => c.score >= 0 && c.score <= 100));
    assert.ok(classes[0].score > classes[2].score);
});

test('scoreCandidat : une donnée absente ne pénalise pas la source discrète', () => {
    const ref = { titre: 'Berserk', chapitres: 380, annee: 1989 };
    const complet = A.scoreCandidat({ titre: 'Berserk', chapitres: 380, annee: 1989 }, ref);
    const muet    = A.scoreCandidat({ titre: 'Berserk' }, ref);
    const faux    = A.scoreCandidat({ titre: 'Berserk', chapitres: 12, annee: 2020 }, ref);
    assert.ok(complet > muet, 'une correspondance vérifiée doit primer');
    assert.ok(muet > faux, 'une source qui ne dit rien vaut mieux qu une qui contredit');
});

test('scoreCandidat : le titre pèse plus que le reste réuni', () => {
    // Sinon une œuvre sans rapport, mais au bon nombre de chapitres et à la
    // bonne année, remonterait devant la bonne — exactement le genre de
    // proposition qu'un utilisateur pressé accepterait.
    const ref = { titre: 'Vinland Saga', chapitres: 200, annee: 2005 };
    const bon    = A.scoreCandidat({ titre: 'Vinland Saga' }, ref);
    const leurre = A.scoreCandidat({ titre: 'Vagabond', chapitres: 200, annee: 2005 }, ref);
    assert.ok(bon > leurre, `${bon} devrait dépasser ${leurre}`);
});

// ── Titres composites ───────────────────────────────────────
// Les sources francophones et chinoises publient le titre en plusieurs langues
// à la fois. Sur les 13 séries orphelines d'Inko, 8 sont dans ce cas — et ce
// sont précisément celles que la migration existe pour sauver. Chercher la
// chaîne entière ne donne rien : aucune autre source ne nomme l'œuvre ainsi.
test('variantesDeTitre : découpe un titre multilingue', () => {
    assert.deepStrictEqual(
        A.variantesDeTitre('Crazy Detective｜狂探'),
        ['Crazy Detective｜狂探', 'Crazy Detective', '狂探']);
    assert.deepStrictEqual(
        A.variantesDeTitre('Infinite Bloodcore | 无限血核'),
        ['Infinite Bloodcore | 无限血核', 'Infinite Bloodcore', '无限血核']);
});

test('variantesDeTitre : un titre simple reste seul', () => {
    assert.deepStrictEqual(A.variantesDeTitre('Solo Leveling'), ['Solo Leveling']);
    assert.deepStrictEqual(A.variantesDeTitre(''), []);
    assert.deepStrictEqual(A.variantesDeTitre(null), []);
});

test('variantesDeTitre : les variantes latines passent devant', () => {
    // L'appelant plafonne le nombre de requêtes. Sans ce tri, le plafond
    // coupait la variante ANGLAISE — la seule que les autres sources
    // connaissent. Cas mesuré, qui ne rendait aucun candidat pertinent.
    const v = A.variantesDeTitre('Laissez-moi Jouer en Paix｜Let me game in peace｜我只想安静地打游戏');
    assert.strictEqual(v[0], 'Laissez-moi Jouer en Paix｜Let me game in peace｜我只想安静地打游戏',
        'le composite complet reste en tête');
    assert.ok(v.slice(0, 3).includes('Let me game in peace'),
        'la variante anglaise doit tenir dans les trois premières');
    assert.strictEqual(v[v.length - 1], '我只想安静地打游戏', 'le pur non-latin ferme la marche');
});

test('variantesDeTitre : le dédoublonnage ne confond pas composite et partie latine', () => {
    // Piège rencontré : dédoublonner sur la forme NORMALISÉE rendait
    // « Crazy Detective｜狂探 » et « Crazy Detective » identiques, puisque la
    // normalisation retire les caractères non latins. Le découpage devenait
    // alors sans effet, sur le cas le plus fréquent.
    const v = A.variantesDeTitre('Crazy Detective｜狂探');
    assert.strictEqual(v.length, 3);
    assert.notStrictEqual(v[0], v[1]);
});
