// ============================================================
// test/unit/mobile-n-abime-pas-le-pc.test.js
// ------------------------------------------------------------
// Le travail mobile touche des fichiers PARTAGÉS avec le site de bureau :
// `global.js`, `catalogue.js`, `chapitre.js`, `downloads.js`, et les feuilles
// de style. Une seule application, deux publics — c'est ce qui permet à une
// correction de profiter aux deux, et c'est aussi ce qui permet à un ajout
// mobile de casser le PC sans que personne ne s'en aperçoive.
//
// Les vérifications à l'écran (cinq pages parcourues à 1440 px : cartes
// inchangées en 3:4, barre latérale collante, cinq colonnes, aucun débord,
// aucune erreur) valent pour un instant donné. Ce fichier garde les INVARIANTS
// qui font que ça restera vrai.
//
// Trois règles, et la troisième est la plus facile à violer par accident.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const lire = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// ── 1. Les modules tactiles s'effacent AVANT de s'installer ──
// Un module qui pose ses écouteurs puis teste le pointeur a déjà changé le
// comportement de la page. Le test doit précéder l'installation.
for (const module of ['assets/js/cartes-gestes.js', 'assets/js/une-main.js', 'assets/js/tirer-rafraichir.js']) {
    test(`${path.basename(module)} sort avant tout écouteur au pointeur fin`, () => {
        const code = lire(module);
        const sortie = code.indexOf("matchMedia('(hover: none)').matches");
        const premier = code.indexOf('addEventListener');
        assert.ok(sortie > -1, `${module} ne teste plus \`hover: none\`.`);
        assert.ok(sortie < premier || premier === -1,
            'Le test de `hover: none` doit précéder tout addEventListener : sinon le module '
            + 's’installe aussi à la souris. Pour les gestes de carte, un simple glissé '
            + 'marquerait une série entière comme lue ; pour le mode une main, la page '
            + 'descendrait d’un tiers d’écran sur un ordinateur ; et le tirer-pour-'
            + 'actualiser neutraliserait `overscroll-behavior` sur le site de bureau.');
    });
}

// ── 2. Les modules de l'APK ne sont RÉFÉRENCÉS par aucune page du dépôt ──
// `hub.js` et `natif.js` sont injectés à la construction du paquet mobile, sur
// une COPIE. Les ajouter à une page du dépôt les enverrait aussi sur le site :
// `hub.js` détournerait alors toutes les requêtes vers un hub inexistant, et
// le site de bureau — qui est son propre serveur — cesserait de fonctionner.
//
// C'est l'erreur la plus tentante : « il manque un script sur cette page ».
test('hub.js et natif.js ne sont jamais chargés par une page du dépôt', () => {
    const fautifs = [];
    for (const f of fs.readdirSync(ROOT).filter(n => n.endsWith('.html'))) {
        const html = fs.readFileSync(path.join(ROOT, f), 'utf8');
        for (const m of ['assets/js/hub.js', 'assets/js/natif.js']) {
            if (html.includes(m)) fautifs.push(`${f} → ${m}`);
        }
    }
    assert.deepStrictEqual(fautifs, [],
        'Ces scripts n’existent que dans l’APK et sont injectés par '
        + 'scripts-ci/build-mobile-www.js sur une copie. Chargés par le site, hub.js '
        + 'enverrait les appels d’API vers un hub qui n’existe pas.');
});

// ── 3. Le CSS tactile reste enfermé dans `hover: none` ──
// La règle la plus facile à violer : on ajoute une déclaration « pour le
// mobile » hors de sa requête média, et la grille du bureau passe à trois
// colonnes de 400 px. Rien ne casse, rien n'échoue — c'est simplement laid,
// et on ne fait pas le lien avec un travail sur le téléphone.
test('les règles pensées pour le doigt sont sous `hover: none`', () => {
    // Chacune de ces déclarations est mobile PAR NATURE : elle n'a aucun sens
    // à la souris, où le survol existe et où l'écran est large.
    const TACTILES = [
        [/\.manga-card-cover\s*\{[^}]*aspect-ratio:\s*2\s*\/\s*3/, 'couverture 2:3'],
        [/\.manga-card\s+\.card-fav-btn[^{]*\{[^}]*display:\s*none/, 'cœur masqué'],
        [/-webkit-line-clamp:\s*2[^}]*\}/, 'titre sur deux lignes'],
    ];
    const css = lire('assets/css/global.css');

    // On découpe le fichier en blocs `@media (hover: none)` pour savoir ce qui
    // est dedans. Analyse volontairement simple : ces blocs ne sont pas
    // imbriqués (Chrome 61 ne lirait pas de règles imbriquées).
    const dedans = [];
    const re = /@media[^{]*hover:\s*none[^{]*\{/g;
    let m;
    while ((m = re.exec(css))) {
        let prof = 1, i = re.lastIndex;
        while (i < css.length && prof > 0) {
            if (css[i] === '{') prof++;
            else if (css[i] === '}') prof--;
            i++;
        }
        dedans.push(css.slice(m.index, i));
    }
    assert.ok(dedans.length, 'plus aucun bloc `hover: none` dans global.css');
    const enferme = dedans.join('\n');

    for (const [motif, nom] of TACTILES) {
        const present = motif.test(css);
        if (!present) continue;   // la règle a pu être retirée : ce n'est pas l'objet
        assert.ok(motif.test(enferme),
            `La règle « ${nom} » existe hors de tout bloc \`hover: none\` : elle s’applique `
            + 'donc AUSSI au site de bureau, où le survol existe et où l’écran est large.');
    }
});

test('l’échelle de colonnes tactile ne déborde pas sur le bureau', () => {
    // Attention à ce que ce test affirme, et à ce qu'il n'affirme PAS.
    //
    // Une fenêtre de navigateur étroite reçoit légitimement trois colonnes :
    // c'est l'échelle de BUREAU, antérieure à tout ce travail, et elle est
    // juste — à 700 px de large, trois colonnes valent mieux que cinq.
    // L'interdire ferait échouer ce test sur du code correct, et un test qui
    // se trompe finit contourné.
    //
    // Ce qui doit rester enfermé, c'est l'échelle TACTILE — celle qui vise un
    // écran qu'on tient, et qui donnerait des couvertures de 100 px dans une
    // fenêtre de bureau. Elle se reconnaît à son `minmax(0, 1fr)`, posé pour
    // que les colonnes puissent rétrécir sous leur contenu (un `1fr` seul vaut
    // `minmax(auto, 1fr)` et déborde).
    const css = lire('assets/css/catalogue.css');
    const tactile = /@media([^{]*)\{[^@]*?\.results-grid\s*\{[^}]*minmax\(0,\s*1fr\)/g;
    let m, verifies = 0;
    while ((m = tactile.exec(css))) {
        verifies++;
        assert.match(m[1], /hover:\s*none/,
            'Une grille au format tactile (`minmax(0, 1fr)`) doit être conditionnée au '
            + `pointeur grossier : trouvée sous « @media${m[1].trim()} », qui s’applique `
            + 'aussi à une fenêtre de bureau étroite.');
    }
    assert.ok(verifies > 0, 'l’échelle tactile du catalogue a disparu');
});
