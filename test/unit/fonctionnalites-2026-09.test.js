// ============================================================
// test/unit/fonctionnalites-2026-09.test.js — les trois ajouts de septembre
// ------------------------------------------------------------
// Trois manques relevés en parcourant l'application, et non déduits d'une
// liste de souhaits :
//
//   · un chapitre de web novel fait couramment dix mille mots, et rien ne
//     permettait d'y chercher quoi que ce soit. Le `Ctrl+F` du navigateur ne
//     comble pas ce trou : en mode pages, le texte est en colonnes hors écran,
//     et le navigateur « trouve » sans jamais pouvoir amener sous les yeux ;
//   · « Reprendre » dit où l'on s'est arrêté ; rien ne disait ce qu'on
//     s'était promis de lire ensuite ;
//   · `MH.errors` retient cent erreurs depuis toujours, et rien ne les avait
//     jamais montrées — sur une app qu'on héberge soi-même, c'est la
//     différence entre « ça marche pas » et un rapport exploitable.
//
// Ces tests portent sur les DÉCISIONS qui rendent ces fonctions correctes, pas
// sur leur balisage : le repli d'accent, le fait que la file survive sans
// réseau, et le fait que le rapport ne transporte aucun secret.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const JS = path.join(__dirname, '..', '..', 'assets', 'js');
const lire = (f) => fs.readFileSync(path.join(JS, f), 'utf8');

// ── Chercher dans le chapitre ───────────────────────────────

test('le lecteur de romans expose la recherche, au bouton ET au clavier', () => {
    const src = lire('lecture.js');
    assert.match(src, /id="btnNovelFind"/, 'un bouton doit exister dans la barre d’outils');
    assert.match(src, /aria-label="Rechercher dans le chapitre"/,
        'le bouton est une icône : sans nom accessible il n’annonce qu’un pictogramme');
    assert.match(src, /case 'f': case 'F':/, 'la touche F doit ouvrir la recherche');
    assert.match(src, /basculerRecherche/, 'le raccourci et le bouton partagent la même bascule');
});

test('la recherche ignore la casse ET les accents, à longueur constante', () => {
    const src = lire('lecture.js');
    // Le pliage doit être fait CARACTÈRE PAR CARACTÈRE. Une normalisation NFD
    // change la longueur de la chaîne, et les positions trouvées ne
    // correspondraient plus au texte d'origine : on surlignerait à côté.
    assert.ok(!/normalize\(['"]NFD['"]\)/.test(src),
        'NFD décale les positions : le surlignage tomberait à côté du mot trouvé');
    assert.match(src, /const ACCENTS_PLIES/, 'une table de pliage 1 pour 1 doit exister');
    assert.match(src, /toLowerCase\(\)/, 'la casse doit être ignorée');

    // La table doit couvrir les accents français les plus courants — sans eux,
    // « evenement » ne trouve pas « événement », qui est le cas le plus
    // fréquent sur des traductions de fans.
    const table = /const ACCENTS_PLIES = \{([\s\S]*?)\};/.exec(src);
    assert.ok(table, 'la table doit rester lisible');
    for (const c of ['é', 'è', 'ê', 'à', 'ç', 'ô', 'û', 'ï']) {
        assert.ok(table[1].includes(`'${c}'`), `l’accent ${c} doit être plié`);
    }
});

test('fermer la recherche rend le texte intact', () => {
    const src = lire('lecture.js');
    // `normalize()` recolle les nœuds scindés par le surlignage. Sans lui,
    // chaque recherche fragmente un peu plus le chapitre, et la suivante ne
    // retrouve plus un terme à cheval sur deux morceaux.
    const retrait = /function retirerSurlignage\(\)([\s\S]*?)\n    \}/.exec(src);
    assert.ok(retrait, 'retirerSurlignage doit rester lisible');
    assert.match(retrait[1], /zone\.normalize\(\)/,
        'sans normalize(), le texte se fragmente à chaque recherche');
    assert.match(retrait[1], /replaceChild/, 'les marques doivent redevenir du texte');
});

// ── À lire ensuite ──────────────────────────────────────────

test('la file d’attente s’affiche sans réseau', () => {
    const ud = lire('userdata.js');
    // Le titre et la couverture sont stockés AVEC l'entrée. Une file qui ne
    // garderait que des identifiants exigerait un appel par ligne pour
    // s'afficher — donc une file invisible hors ligne, c'est-à-dire
    // exactement quand on cherche quoi lire.
    const bascule = /basculerFile\(entree\) \{([\s\S]*?)\n        \},/.exec(ud);
    assert.ok(bascule, 'basculerFile doit rester lisible');
    for (const champ of ['title', 'cover', 'source', 'id']) {
        assert.ok(bascule[1].includes(champ + ':'),
            `l’entrée doit porter ${champ} pour s’afficher hors ligne`);
    }

    const acc = lire('accueil.js');
    assert.match(acc, /function loadFile\(\)/, 'l’accueil doit rendre la file');
    assert.ok(!/await/.test(/function loadFile\(\)([\s\S]*?)\n    \}\n/.exec(acc)?.[1] || ''),
        'le rendu de la file ne doit attendre aucun appel réseau');
});

test('la file bornée, et la section masquée quand elle est vide', () => {
    const ud = lire('userdata.js');
    // `userdata` part ENTIER dans les réglages à chaque synchronisation : une
    // file sans borne pèserait sur chaque écriture.
    assert.match(ud, /data\.file\.length > 100/, 'la file doit être bornée');

    const acc = lire('accueil.js');
    assert.match(acc, /section\.hidden = entrees\.length === 0/,
        'une section vide sur l’accueil est du bruit, pas une invitation');
});

// ── Diagnostic ──────────────────────────────────────────────

test('le rapport de diagnostic ne transporte aucun secret', () => {
    const src = lire('parametres.js');
    const bloc = /async function construireDiagnostic\(\)([\s\S]*?)\n    \}/.exec(src);
    assert.ok(bloc, 'construireDiagnostic doit rester lisible');

    // Un rapport qu'on hésite à coller dans un ticket public ne sert à rien :
    // il doit pouvoir partir tel quel.
    for (const interdit of ['token', 'jwt', 'email', 'password', 'INKO_HUB', 'motdepasse']) {
        assert.ok(!new RegExp(interdit, 'i').test(bloc[1]),
            `le rapport ne doit jamais lire « ${interdit} »`);
    }
    // Ce qu'il DOIT dire : le mode explique à lui seul la moitié des
    // symptômes rapportés.
    assert.match(bloc[1], /INKO_AUTONOME/, 'le rapport doit dire si l’app tourne sans hub');
    assert.match(bloc[1], /MH\?\.errors|MH\.errors/, 'le rapport doit joindre les dernières erreurs');
});

test('la copie refusée n’enferme pas l’utilisateur', () => {
    const src = lire('parametres.js');
    const bloc = /async function copierDiagnostic\(\)([\s\S]*?)\n    \}/.exec(src);
    assert.ok(bloc, 'copierDiagnostic doit rester lisible');
    // Le presse-papiers exige un contexte sûr et une permission. Un « copie
    // impossible » sans rien d'autre laisserait la seule information utile
    // hors de portée.
    assert.match(bloc[1], /catch/, 'le refus du presse-papiers doit être prévu');
    assert.match(bloc[1], /selectNodeContents|addRange/,
        'à défaut de copier, le rapport doit être sélectionné pour un Ctrl+C');
});

// ── Le résumé des filtres, rafraîchi par TOUS les chemins ────
//
// Le même défaut a été trouvé deux fois, sur deux pages, pour la même raison :
// le bloc « filtres actifs » était rafraîchi par certains gestionnaires et pas
// par d'autres.
//
//   · catalogue — cocher un genre appelait `cycleTag`, `peindreTag`,
//     `updateFiltersCount` et `runSearch`, mais jamais `renderResumeFiltres`.
//     Sept filtres actifs, et le bloc restait vide ET masqué ;
//   · bibliothèque — les puces le rafraîchissaient, la RECHERCHE non. Taper un
//     mot rétrécissait la liste sans que le résumé le dise.
//
// La parade est la même des deux côtés : appeler le rendu du résumé depuis la
// fonction par laquelle TOUT changement de filtre passe. C'est ce lien-là que
// ces tests tiennent — pas le nombre d'appelants, qui peut bouger.
test('le catalogue rafraîchit son résumé de filtres depuis runSearch', () => {
    const src = lire('catalogue.js');
    const bloc = /async function runSearch\(\)([\s\S]{0,900})/.exec(src);
    assert.ok(bloc, 'runSearch doit rester lisible');
    assert.match(bloc[1], /renderResumeFiltres\(\)/,
        'sinon cocher un genre laisse le bloc « Filtres actifs » vide et masqué');
});

test('la bibliothèque rafraîchit son résumé de filtres depuis render', () => {
    const src = lire('bibliotheque.js');
    const bloc = /function render\(\)([\s\S]{0,700})/.exec(src);
    assert.ok(bloc, 'render doit rester lisible');
    assert.match(bloc[1], /renderResumeFiltres\(\)/,
        'la recherche n’appelle que `render` : sans cela elle filtre en silence');
});

test('un genre s’affiche par son nom, jamais par son identifiant', () => {
    // MangaDex identifie ses genres par UUID. Le résumé montrait
    // « ea2bc92d-1c26-4930-9b7c-d5c0dc1b6869 » là où l'utilisateur avait coché
    // « Historical » — illisible, et impossible à retirer sciemment.
    const src = lire('catalogue.js');
    assert.match(src, /const nomTag = \(id\) =>/,
        'une correspondance identifiant → nom doit exister');
    assert.ok(!/activeTags\.forEach\(t\s*=>\s*actifs\.push\(\{ k: 'tag', v: t, l: t \}\)\)/.test(src),
        'le libellé ne doit plus être l’identifiant brut');
});

test('un état « aucun résultat » propose toujours de relâcher les filtres', () => {
    // « Modifiez les filtres » n'était qu'une phrase : aucun geste, et pas un
    // mot sur CE QUI filtre. Le bouton « Réinitialiser » existait pourtant —
    // dans la barre latérale, c'est-à-dire pas là où l'on constate le vide.
    for (const [f, attendu] of [['catalogue.js', /Effacer les filtres/],
        ['bibliotheque.js', /Effacer les filtres/]]) {
        assert.match(lire(f), attendu, `${f} : l’état vide doit offrir une sortie`);
    }
    assert.ok(!/Aucune série correspondante\. Modifiez les filtres\./.test(lire('catalogue.js')),
        'l’ancien message sans action ne doit plus exister');
});

// ── Paramètres : le geste prime sur la réponse tardive ───────
//
// Trouvé en vérifiant à la main un « INERTE » du rapport des contrôles, et non
// l'inverse : le bouton « Double » était bien branché.
//
// La page s'affiche sur le stockage local, puis charge les réglages du serveur
// et écrasait TOUTES les préférences avant de re-synchroniser les segments. Un
// clic donné avant l'arrivée de la réponse était défait sous les doigts, sans
// un mot. Reproduit dans le navigateur : cliquer « Double » à l'ouverture
// laissait « Défilement » actif et `readMode` à « scroll » ; la même page
// posée deux secondes, le bouton marche.
//
// En boucle locale la fenêtre dure quelques dizaines de millisecondes — assez
// pour que l'audit tombe dedans. Sur un hub distant elle dure un aller-retour,
// et c'est l'utilisateur qui perd son réglage.
test('un réglage changé n’est pas écrasé par les réglages du serveur', () => {
    const src = lire('parametres.js');
    const bloc = /const s = await API\.me\.settings\(\);([\s\S]{0,600})/.exec(src);
    assert.ok(bloc, 'le chargement des réglages serveur doit rester lisible');
    assert.match(bloc[1], /TOUCHEES\.has\(k\)/,
        'sans garde, la réponse serveur défait le clic qui l’a précédée');
    assert.match(bloc[1], /TOUCHEES\.has\('theme'\)/,
        'le thème aussi : il est appliqué à part, donc gardé à part');

    // La garde ne vaut que si CHAQUE enregistrement l'alimente.
    const save = /async function savePref\(key, val\) \{([\s\S]*?)\n    \}/.exec(src);
    assert.ok(save, 'savePref doit rester lisible');
    assert.match(save[1], /TOUCHEES\.add\(key\)/,
        'la clé doit être marquée AVANT toute écriture, sinon la garde reste vide');
});

test('une pastille de couleur s’annonce par son nom, pas par son code', () => {
    // Le `title` valait « #3b82f6 » : un lecteur d'écran annonçait « dièse
    // trois b huit deux f six », et la pastille n'est qu'un rond de couleur —
    // donc muette pour qui ne voit pas la couleur.
    const src = lire('parametres.js');
    assert.match(src, /aria-label="Couleur d’accentuation \$\{nom\}"/,
        'chaque pastille doit porter un nom lisible');
    assert.ok(!/title="\$\{c\}"/.test(src),
        'le code hexadécimal ne doit plus servir de nom accessible');
    assert.match(src, /aria-pressed=/,
        'laquelle est choisie ne doit pas tenir qu’à la bordure');
    for (const nom of ['Orange', 'Bleu', 'Violet', 'Vert', 'Rose', 'Rouge', 'Cyan', 'Ambre'])
        assert.ok(src.includes(`'${nom}'`), `la couleur ${nom} doit être nommée`);
});

// ── Un audit ne repart pas avec les réglages de quelqu'un ────
//
// La passe « hub » se connecte au vrai compte. Le garde-fou `DESTRUCTIF` ne
// couvre que les libellés qui annoncent une perte — pas les contrôles qui
// ENREGISTRENT. Relevé sur la machine : quatre segments sur cinq se sont
// retrouvés sur leur DERNIÈRE option (webtoon, scroll, saver, « + JA »), ce
// qu'aucun choix humain n'explique et qu'un parcours de gauche à droite
// explique entièrement.
test('l’audit des contrôles rend les réglages qu’il a modifiés', () => {
    const src = fs.readFileSync(
        path.join(__dirname, '..', 'e2e', 'audit-controles.spec.js'), 'utf8');
    assert.match(src, /async function lireReglages\(browser\)/,
        'les réglages doivent être relevés avant la première page');
    assert.match(src, /async function rendreReglages\(browser, avant\)/,
        'et reposés après la dernière');

    // La restitution doit passer par le `finally` de la MESURE : un plantage
    // ne doit pas laisser le compte dans l'état où l'audit l'a mis. On ancre
    // sur la fermeture du serveur — plusieurs `finally` cohabitent ici, et
    // viser le premier venu ferait passer le test sur le mauvais bloc.
    const fin = /serveur\.close\(ok\)\);([\s\S]{0,700})/.exec(src);
    assert.ok(fin, 'le finally de la mesure doit rester lisible');
    assert.match(fin[1], /rendreReglages\(browser, reglagesAvant\)/,
        'la restitution doit survivre à l’échec de la mesure');

    // Une clé CRÉÉE par l'audit doit disparaître, pas rester : côté serveur la
    // fusion est un JSON_MERGE_PATCH, qui n'efface que sur null.
    assert.match(src, /patch\[k\] = null/,
        'les clés ajoutées par l’audit doivent être effacées, pas laissées');
});
