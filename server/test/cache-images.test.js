// ============================================================
// cache-images.test.js — le cache disque du proxy d'images
// ------------------------------------------------------------
// Le cache du proxy etait un `Map` : il mourait avec le processus. Or l'app
// de bureau relance son serveur a CHAQUE ouverture — chaque session repartait
// donc a froid, et une planche lue hier se retelechargeait aujourd'hui. Le
// TTL de sept jours ne servait a rien : le cache n'a jamais vecu jusque-la.
//
// Ce que la mesure justifiait, et elle seule :
//
//     page en cache :      5 – 46 ms
//     page a froid  :  3 700 – 20 000 ms
//
// Un facteur cent a mille. C'est le seul ecart de ce chemin qui depasse
// franchement la variance de la source — mesuree a 3x d'un moment a l'autre.
// La concurrence du lecteur n'a PAS ete touchee pour cette raison : les
// releves se contredisaient d'une minute sur l'autre, et regler une constante
// sur du bruit aurait ete pire que ne rien faire.
//
// Ces tests portent sur les DECISIONS qui rendent ce cache sur : l'ecriture
// atomique, le quota, et le fait qu'une panne de disque n'empeche jamais de
// lire.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(
    path.join(__dirname, '..', 'controllers', 'image.controller.js'), 'utf8');

test('le cache disque ecrit de facon atomique', () => {
    const bloc = /async function poserSurDisque\([\s\S]*?\n\}/.exec(SRC);
    assert.ok(bloc, 'poserSurDisque doit rester lisible');

    // Sans fichier temporaire puis renommage, une ecriture interrompue
    // laisserait une image TRONQUEE que la lecture suivante servirait comme
    // valide. Un defaut silencieux, et le pire genre : l'utilisateur voit une
    // planche coupee sans qu'aucune erreur ne soit levee.
    assert.match(bloc[0], /\.tmp/, 'l’ecriture doit passer par un fichier temporaire');
    assert.match(bloc[0], /rename\(/, 'la publication doit etre un renommage');
    const iEcrit = bloc[0].indexOf('writeFile');
    const iRenomme = bloc[0].indexOf('rename(');
    assert.ok(iEcrit > 0 && iRenomme > iEcrit,
        'le renommage doit venir APRES l’ecriture, sinon il ne protege rien');
});

test('une panne de disque n’empeche jamais de lire', () => {
    // Disque plein, dossier en lecture seule, hub sur un NAS : le cache disque
    // est un CONFORT. S'il devenait bloquant, il transformerait une lenteur en
    // panne — l'inverse de son objet.
    const poser = /async function poserSurDisque\([\s\S]*?\n\}/.exec(SRC);
    assert.match(poser[0], /catch/, 'l’ecriture doit absorber son echec');

    const lire = /async function surDisque\([\s\S]*?\n\}/.exec(SRC);
    assert.ok(lire, 'surDisque doit rester lisible');
    assert.match(lire[0], /catch/, 'la lecture doit absorber son echec');

    // Et le chemin de la requete doit repasser au telechargement, pas echouer.
    assert.match(SRC, /fichier disparu ou illisible/,
        'un fichier illisible doit renvoyer au telechargement');
});

test('le dossier est borne, et l’eviction reste hors du chemin d’une requete', () => {
    const bloc = /async function evincer\([\s\S]*?\n\}/.exec(SRC);
    assert.ok(bloc, 'evincer doit rester lisible');

    // Un balayage de plusieurs milliers de fichiers ne doit pas s'ajouter a
    // l'attente d'une page : il est borne dans le temps.
    assert.match(bloc[0], /derniereEviction/, 'l’eviction doit etre espacee dans le temps');
    assert.match(bloc[0], /sort\(\(a, b\) => a\.age - b\.age\)/,
        'les plus anciens doivent partir en premier');
    assert.match(SRC, /IMG_DISK_CACHE_MB/, 'le quota doit etre reglable');

    // Et elle est lancee APRES la reponse, jamais avant.
    assert.match(SRC, /poserSurDisque\(url, img\.buf, img\.type\)\.then\(evincer\)/,
        'l’ecriture et l’eviction doivent suivre la reponse, pas la precéder');
});

test('le delai distingue un hote MORT d’un hote LENT', () => {
    // `-m 20` plafonnait le transfert ENTIER. Mesure sur une vraie source :
    // 3 700 a 9 000 ms par planche seule, 17 000 a 25 000 ms quand plusieurs
    // partent ensemble. Le plafond tombait donc en plein telechargement d'une
    // image valide, le proxy rendait un echec, et le lecteur affichait une
    // page vide — indistinguable d'une image manquante.
    assert.match(SRC, /'--connect-timeout', '10'/,
        'dix secondes pour etablir la connexion : au-dela, l’hote ne repond pas');
    assert.match(SRC, /IMG_TIMEOUT_S \|\| '60'/,
        'le transfert doit avoir son propre plafond, plus large');
    assert.ok(!/'-m', '20'/.test(SRC), 'l’ancien plafond unique de 20 s ne doit plus exister');
});

test('le cache disque ne sert jamais une entree perimee', () => {
    const bloc = /async function surDisque\([\s\S]*?\n\}/.exec(SRC);
    // Sans cette borne, une image supprimee a la source resterait servie
    // indefiniment — le disque, lui, ne se vide pas tout seul.
    assert.match(bloc[0], /Date\.now\(\) - st\.mtimeMs > TTL/,
        'l’age du fichier doit etre compare au TTL');
});
