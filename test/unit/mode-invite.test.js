// ============================================================
// test/unit/mode-invite.test.js — preter son appareil sans ecrire dans
// l'historique
// ------------------------------------------------------------
// On prete son telephone. Sans ce mode, les chapitres que l'autre ouvre
// entrent dans l'historique, deplacent les reprises, comptent dans les
// statistiques et declenchent des notifications — et rien ne permet de
// les demeler apres coup.
//
// LE FILTRE EST POSE A UN SEUL ENDROIT : le passage unique par lequel
// toutes les ecritures sortent (`request`, dans api.js). Trois fichiers
// ecrivent une progression et quatre marquent des chapitres lus ; les
// garder un par un, ce serait se preparer a en oublier un au prochain
// ajout. C'est le defaut de l'etape 2, et le remede est le meme.
//
// CE QUE LE MODE N'EMPECHE PAS, et c'est delibere : les favoris, les
// notes, les reglages. Ce sont des gestes DECIDES. Ce qu'on bloque,
// c'est ce que la lecture ecrit toute seule dans le dos de celui qui
// prete son appareil.
//
// LE REFUS EST SILENCIEUX ET REUSSI. Lever une erreur ferait apparaitre
// « echec de l'enregistrement » a chaque page tournee, et l'invite se
// demanderait ce qu'il a casse.
//
// ── Le mode de panne de ce mode, et ce qui le couvre ──
//
// L'OUBLI. On lit sa propre serie pendant une semaine et rien n'est
// enregistre — pas de reprise, pas de statistiques, et aucun message
// puisque le refus est silencieux par conception. D'ou un bandeau
// permanent, sur chaque page, SANS CROIX : un bandeau qu'on peut fermer
// serait ferme le premier jour. Et il survit au redemarrage, sinon il
// protegerait exactement quand on n'en a plus besoin.
//
// Verifie dans le navigateur, aller-retour complet. Mode actif : les
// deux ecritures rendent `{ok, invite, ignore}` et la progression N'EST
// PAS enregistree ; la lecture, elle, continue de repondre. Mode quitte
// par le bouton du bandeau : l'ecriture passe pour de bon et la
// progression apparait. (L'entree d'essai a ete retiree ensuite.)
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const RACINE = path.join(__dirname, '..', '..');
const lire = (...p) => fs.readFileSync(path.join(RACINE, ...p), 'utf8').replace(/\r\n/g, '\n');
const API = lire('assets', 'js', 'api.js');

/** Charge le filtre depuis la source reelle. */
function filtre(actif) {
    const i = API.indexOf('    const ECRITURES_HISTORIQUE = [');
    assert.notEqual(i, -1, 'le filtre doit rester reperable');
    const j = API.indexOf('\n    }', API.indexOf('function ecritureDHistorique')) + 6;
    const bloc = API.slice(i, j) + '\nwindow.__f = ecritureDHistorique; window.__i = invite;';
    const window = { Storage: { getPref: (k) => (k === 'modeInvite' ? actif : undefined) } };
    // eslint-disable-next-line no-new-func
    new Function('window', bloc)(window);
    return { estHistorique: window.__f, invite: window.__i };
}

test('les ecritures de lecture sont reconnues, les lectures non', () => {
    const { estHistorique } = filtre(true);
    for (const [m, p] of [
        ['PUT', '/me/progress/abc'],
        ['DELETE', '/me/progress/abc'],
        ['POST', '/me/read-chapters'],
        ['POST', '/me/read-chapters/bulk'],
        ['POST', '/me/read-chapters/unmark-bulk'],
        ['POST', '/me/temps-lecture'],
    ]) {
        assert.equal(estHistorique(m, p), true, m + ' ' + p);
    }
    // Une LECTURE n'ecrit rien : elle doit passer, meme sur ces chemins.
    for (const p of ['/me/progress', '/me/read-chapters', '/me/temps-lecture?jours=30']) {
        assert.equal(estHistorique('GET', p), false, 'GET ' + p);
    }
});

test('les gestes DECIDES continuent de passer', () => {
    // Un favori, une note, un reglage : l'invite les pose volontairement,
    // et les bloquer transformerait « ne pas enregistrer ma lecture » en
    // « application en lecture seule ».
    const { estHistorique } = filtre(true);
    for (const [m, p] of [
        ['POST', '/me/favorites'],
        ['DELETE', '/me/favorites/abc'],
        ['PUT', '/me/library/abc'],
        ['POST', '/me/notes'],
        ['PUT', '/me/settings'],
        ['POST', '/me/lists'],
    ]) {
        assert.equal(estHistorique(m, p), false, m + ' ' + p);
    }
});

test('hors mode invité, rien n’est filtré', () => {
    const { invite } = filtre(false);
    assert.equal(invite(), false);
    const absent = filtre(undefined);
    assert.equal(absent.invite(), false, 'préférence absente = mode normal');
});

test('le refus est silencieux et réussi, pas une erreur', () => {
    const i = API.indexOf('async function request(method, path, body');
    const b = API.slice(i, i + 400);
    assert.match(b, /return \{ ok: true, invite: true, ignore: path \};/,
        'l’appelant reçoit une réponse normale : pas d’« échec » à chaque page tournée');
    assert.ok(!/throw/.test(b.slice(0, b.indexOf('sharedCache'))),
        'aucune exception sur le chemin du refus');
});

test('le filtre est AVANT tout le reste de la requête', () => {
    // Sinon le cache serait vidé, la file hors-ligne alimentée, et des
    // effets de bord resteraient d'une écriture qui n'a pas eu lieu.
    const i = API.indexOf('async function request(method, path, body');
    const b = API.slice(i, i + 900);
    assert.ok(b.indexOf('invite()') < b.indexOf('sharedCache.clear()'),
        'le refus doit precéder la purge de cache');
    assert.ok(b.indexOf('invite()') < b.indexOf('INKO_HORS_LIGNE'),
        'et précéder la file hors-ligne');
});

test('le bandeau est permanent, sans croix, et survit au redémarrage', () => {
    const g = lire('assets', 'js', 'global.js');
    const i = g.indexOf('    function bandeauInvite() {');
    assert.notEqual(i, -1);
    const b = g.slice(i, g.indexOf('\n    }', i));
    assert.match(b, /getPref\?\.\('modeInvite'\)/,
        'il lit une préférence persistée, pas un état de session');
    assert.match(b, /Quitter le mode invité/,
        'la seule sortie est de quitter le mode, pas de masquer le bandeau');
    assert.ok(!/fermer|masquer|×|✕/i.test(b),
        'aucun bouton de fermeture : il serait utilisé le premier jour');
    assert.match(b, /role', 'status'/, 'annoncé aux lecteurs d’écran');
    assert.match(g, /bandeauInvite\(\);\s*\n\s*showConsentBanner\(\);/,
        'posé à chaque page par initPage');
});

test('le réglage dit ce qu’il coûte, au moment du clic', () => {
    const p = lire('assets', 'js', 'parametres.js');
    assert.match(p, /segInvite/);
    assert.match(p, /plus rien n’est inscrit dans l’historique/);
    assert.match(p, /de nouveau enregistrées/, 'et le retour au normal se dit aussi');
    assert.match(p, /window\.MH\?\.bandeauInvite\?\.\(\)/,
        'le bandeau apparaît sans recharger la page');
    const h = lire('parametres.html');
    assert.match(h, /Mode invité/);
    assert.match(h, /Les favoris,\s*\n?\s*les notes et les réglages/,
        'la page dit ce que le mode NE bloque pas');
});
