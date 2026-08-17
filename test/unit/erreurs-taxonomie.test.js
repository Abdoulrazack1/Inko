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
