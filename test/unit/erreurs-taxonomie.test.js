// ============================================================
// test/unit/erreurs-taxonomie.test.js — VIII.47 (MH.messageErreur)
// ------------------------------------------------------------
// Le motif employé partout avant P1.6 était `Erreur : ${e.message}` en rouge,
// au milieu d'une grille vide. Il violait les trois règles de la taxonomie
// d'un coup, et le pire des trois n'est pas le plus visible :
//
//   · du technique à l'écran — « HTTP 504 » n'apprend rien à personne ;
//   · aucune action, alors que « réessayer » suffit neuf fois sur dix ;
//   · aucune distinction entre VIDE et CASSÉ — c'est SRC-02 : une source en
//     panne ressemblait à un catalogue vide, et l'utilisateur en concluait
//     que le titre n'existait pas.
//
// Ces tests portent sur la DÉCISION, pas sur le balisage : c'est elle qui se
// dégrade en silence quand on ajoute un cas d'erreur en oubliant les autres.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { loadGlobal } = require('../helpers/dom');

const MH = loadGlobal().MH;

function err(o) {
    const e = new Error(o.message || '');
    Object.assign(e, o);
    return e;
}

test('un code technique n’atteint jamais l’écran', () => {
    // Le serveur ne répond pas toujours une phrase. Quand il n'en a pas, ce
    // qui reste est « HTTP 504 » — un renseignement pour le journal, pas pour
    // l'utilisateur, qui n'a aucun geste à en tirer.
    for (const brut of ['HTTP 504', '504', 'ECONNABORTED', 'SESSION_REVOKED']) {
        const m = MH.messageErreur(err({ message: brut, status: 504 }));
        const affiche = `${m.titre} ${m.texte}`;
        assert.ok(!affiche.includes(brut),
            `« ${brut} » se retrouve à l'écran : ${affiche}`);
    }
});

test('le message propre du serveur est PRÉFÉRÉ à toute reformulation', () => {
    // Règle 2 : ne jamais remplacer une phrase écrite par le serveur par un
    // générique. `{"error":"Source momentanement limitee"}` dit déjà l'essentiel
    // et connaît un contexte que le client n'a pas.
    const m = MH.messageErreur(err({ message: 'Source momentanement limitee', status: 429 }));
    assert.strictEqual(m.texte, 'Source momentanement limitee');
});

test('une source en panne se distingue d’un catalogue vide (SRC-02)', () => {
    const m = MH.messageErreur(err({ status: 504 }), { source: 'weebcentral' });
    assert.strictEqual(m.code, 'SOURCE_INDISPONIBLE');
    assert.match(m.titre, /Weebcentral ne répond pas/);
    // Et la panne est située EN AMONT : sans cette phrase, l'utilisateur
    // soupçonne sa propre connexion ou Inko, et va chercher au mauvais endroit.
    assert.match(m.texte, /Ce n’est pas ta connexion|momentan/i);
});

test('un appareil révoqué n’est pas envoyé à l’écran de connexion', () => {
    // Le compte est valide : aucun mot de passe ne rendra l'accès. Le seul
    // geste utile est de ré-appairer le téléphone depuis le PC. Confondre les
    // deux cas donne un cul-de-sac où l'utilisateur retape son mot de passe
    // indéfiniment.
    const revoque = MH.messageErreur(err({ status: 401, data: { code: 'APPAREIL_REVOQUE' } }));
    assert.strictEqual(revoque.code, 'APPAREIL_REVOQUE');
    assert.match(revoque.actions[0].libelle, /appairer/i);

    const session = MH.messageErreur(err({ status: 401, message: 'Session fermée — reconnecte-toi' }));
    assert.match(session.actions[0].href, /login/);
});

test('hors ligne : la sortie proposée est ce qui MARCHE encore', () => {
    // Proposer « réessayer » et rien d'autre à quelqu'un sans réseau, c'est ne
    // rien proposer. Les chapitres téléchargés, eux, restent lisibles.
    const m = MH.messageErreur(err({ network: true, horsLigne: true, status: 0 }));
    assert.strictEqual(m.code, 'HUB_INJOIGNABLE');
    assert.ok(m.actions.some(a => /downloads/.test(a.href || '')),
        'aucune issue vers les téléchargements alors qu’ils restent lisibles');
});

test('aucun état d’erreur n’est un cul-de-sac', () => {
    // Invariant VIII.50 n°4 : aucun écran vide sans explication — et sans
    // sortie. Le seul cas où l'on peut ne rien proposer est celui où l'appelant
    // n'a fourni aucune façon de rejouer ; ailleurs, il y a toujours un geste.
    const cas = [
        err({ status: 429 }), err({ status: 502 }), err({ status: 504 }),
        err({ status: 401 }), err({ network: true }),
        err({ status: 401, data: { code: 'APPAREIL_REVOQUE' } }),
    ];
    for (const e of cas) {
        const m = MH.messageErreur(e, { source: 'mangadex' });
        assert.ok(m.actions.length > 0, `aucune action pour ${e.status}`);
        assert.ok(m.titre && m.texte, `titre ou texte manquant pour ${e.status}`);
        assert.ok(!/une erreur est survenue/i.test(m.titre + m.texte),
            'message générique interdit (règle 2)');
    }
});

test('« Réessayer » n’est proposé que si l’appelant sait rejouer', () => {
    // Un bouton qui ne fait rien est pire que pas de bouton : il fait croire
    // que le problème vient de l'utilisateur qui n'insiste pas assez.
    const sans = MH.messageErreur(err({ status: 502 }));
    assert.ok(!sans.actions.some(a => /réessayer/i.test(a.libelle)));
    const avec = MH.messageErreur(err({ status: 502 }), { onRetry() {} });
    assert.ok(avec.actions.some(a => /réessayer/i.test(a.libelle)));
});

// ── La taxonomie ne sert que si les pages l'appellent ────────
//
// Tout ce qui précède teste la DÉCISION de `MH.messageErreur`. Rien ne
// vérifiait qu'une page s'en serve — et de fait, un an après P1.6, elle
// n'était câblée que sur DEUX pages. Six autres endroits affichaient encore
// `Erreur : ${e.message}` en rouge : le journal, les notes du lecteur, les
// avis du profil, la recherche, la page des sources, les statistiques.
//
// Le pire des six est la page « Sources » : c'est celle qu'on ouvre JUSTEMENT
// quand quelque chose ne répond plus, et elle rendait un code technique sans
// le moindre geste possible.
const fs = require('fs');
const path = require('path');
const JS = path.join(__dirname, '..', '..', 'assets', 'js');

/** `Erreur : ${…}` — le motif que P1.6 a remplacé. */
const ANCIEN_MOTIF = /Erreur\s*:\s*\$\{/;

test('aucune page ne réaffiche « Erreur : <message> » à la main', () => {
    const coupables = [];
    for (const f of fs.readdirSync(JS).filter((x) => x.endsWith('.js'))) {
        const src = fs.readFileSync(path.join(JS, f), 'utf8');
        src.split('\n').forEach((ligne, i) => {
            // Les commentaires CITENT le motif pour expliquer pourquoi il a été
            // retiré : les exclure, sinon la documentation ferait échouer le test.
            const nu = ligne.replace(/^\s*(\/\/|\*|\/\*).*/, '');
            if (ANCIEN_MOTIF.test(nu)) coupables.push(`${f}:${i + 1}`);
        });
    }
    assert.deepEqual(coupables, [],
        'ces lignes affichent un code technique sans action — passe par '
        + '`MH.poserEtatVide(cible, MH.messageErreur(e, { onRetry }))` : '
        + coupables.join(', '));
});

test('chaque état d’erreur de page propose de rejouer', () => {
    // `messageErreur` n'ajoute « Réessayer » que si l'appelant sait rejouer
    // (testé plus haut). Un appel sans `onRetry` redonne donc un cul-de-sac —
    // exactement ce qu'on vient de retirer.
    const sansRetry = [];
    for (const f of fs.readdirSync(JS).filter((x) => x.endsWith('.js'))) {
        const src = fs.readFileSync(path.join(JS, f), 'utf8');
        // On lit le fichier ENTIER, pas ligne à ligne : le contexte s'écrit
        // souvent sur trois lignes (`{`, `source:`, `onRetry:`), et un scan
        // ligne à ligne accusait alors des appels parfaitement corrects.
        for (const m of src.matchAll(/MH\.(?:messageErreur|poserEtatErreur)\(/g)) {
            const avant = src.slice(Math.max(0, m.index - 40), m.index);
            // La DÉFINITION du helper vit dans global.js — ce n'est pas un appel.
            if (/=\s*function\s*$/.test(avant)) continue;
            // Fenêtre : de l'appel jusqu'à la fin de l'instruction.
            const suite = src.slice(m.index, m.index + 260);
            const arret = suite.indexOf(');');
            const args = arret > 0 ? suite.slice(0, arret) : suite;
            // On ne juge que les appels qui posent un contexte EN DUR :
            // `poserEtatErreur(cible, err, ctx)` transmet celui de son
            // appelant — un passe-plat, pas un site de décision.
            if (!args.includes('{')) continue;
            if (!/onRetry/.test(args)) {
                sansRetry.push(`${f} → ${args.replace(/\s+/g, ' ').slice(0, 70)}`);
            }
        }
    }
    assert.deepEqual(sansRetry, [],
        'ces appels n’offrent aucune sortie : ' + sansRetry.join(' | '));
});

test('aucun toast ne montre un message technique brut', () => {
    // La taxonomie couvrait les ÉTATS de page ; les toasts, eux, étaient
    // restés à `'Erreur : ' + e.message` — trente-neuf fois dans le dépôt.
    // Même défaut, en plus court et en plus fréquent : « Erreur : HTTP 504 »
    // passe une seconde et demie à l'écran et n'apprend rien à personne.
    const coupables = [];
    for (const f of fs.readdirSync(JS).filter((x) => x.endsWith('.js'))) {
        const src = fs.readFileSync(path.join(JS, f), 'utf8');
        src.split('\n').forEach((ligne, i) => {
            const nu = ligne.replace(/^\s*(\/\/|\*|\/\*).*/, '');
            if (/toast\(\s*['"`](Erreur|Échec)\s*:/.test(nu)) coupables.push(`${f}:${i + 1}`);
        });
    }
    assert.deepEqual(coupables, [],
        'passe par `MH.toastErreur(e)` : il réutilise la taxonomie et écarte '
        + 'les codes techniques — ' + coupables.join(', '));
});

test('MH.toastErreur s’appuie sur la taxonomie, pas sur le message brut', () => {
    const src = fs.readFileSync(path.join(JS, 'global.js'), 'utf8');
    const bloc = /window\.MH\.toastErreur = function[\s\S]*?\n    \};/.exec(src);
    assert.ok(bloc, 'MH.toastErreur doit rester lisible');
    assert.match(bloc[0], /messageErreur/,
        'sans elle, le helper ne saurait pas écarter « HTTP 504 »');
    // `.message` suivi d'une lettre, c'est `.messageErreur` — l'appel qu'on
    // veut justement voir. Seul `.message` NU est le message brut.
    assert.ok(!/\.message\b(?!Erreur)/.test(bloc[0]),
        'le message brut ne doit jamais être affiché tel quel');
});

test('un afficheur d’erreur doit RÉELLEMENT afficher', () => {
    // `showError` de l'accueil ne peignait rien. Elle cherchait l'élément et,
    // s'il existait, ne faisait rien du tout ; sinon elle écrivait dans la
    // console. Quand le hero ou les nouveautés échouaient, l'utilisateur voyait
    // une section vide, sans un mot — sur le PREMIER écran de l'application.
    //
    // Le pire de ce défaut est qu'il se lit comme un correctif : la fonction
    // porte le bon nom, elle est appelée aux bons endroits, et elle ne fait
    // rien. Aucun test ne pouvait le voir, et l'œil non plus.
    const src = fs.readFileSync(path.join(JS, 'accueil.js'), 'utf8');
    const bloc = /function showError\(([\s\S]*?)\n    \}/.exec(src);
    assert.ok(bloc, 'showError doit rester lisible');
    assert.match(bloc[1], /poserEtatVide|poserEtatErreur/,
        'un afficheur d’erreur qui n’affiche rien est pire qu’absent : il rassure');
    assert.match(bloc[1], /actions:/, 'et il doit proposer une sortie');
});

test('aucun message d’erreur ne parle de « backend » à l’utilisateur', () => {
    // « Impossible de charger l'accueil. Le backend est-il lancé ? » est une
    // question de développeur, posée à quelqu'un qui voulait lire un manga.
    const coupables = [];
    for (const f of fs.readdirSync(JS).filter((x) => x.endsWith('.js'))) {
        const src = fs.readFileSync(path.join(JS, f), 'utf8');
        src.split('\n').forEach((ligne, i) => {
            const nu = ligne.replace(/^\s*(\/\/|\*|\/\*).*/, '');
            // Dans une CHAÎNE affichée, pas dans un commentaire ni un nom.
            if (/['"`][^'"`]*\bbackend\b[^'"`]*['"`]/i.test(nu)) coupables.push(`${f}:${i + 1}`);
        });
    }
    assert.deepEqual(coupables, [], 'jargon technique à l’écran : ' + coupables.join(', '));
});
