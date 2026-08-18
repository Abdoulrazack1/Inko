// ============================================================
// test/unit/fichiers-notifications.test.js
// ------------------------------------------------------------
// Les deux dernières pages que l'inventaire donnait « inutilisables sans PC » :
// `import.html` (fichiers importés) et `notifications.html`.
//
// Les fichiers vivent dans IndexedDB — pas dans le magasin personnel : on
// parle de mégaoctets binaires, et localStorage n'accepte que des chaînes, ce
// qui imposerait un encodage base64 gonflant de 33 % et ferait exploser la
// limite dès le premier livre.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const lire = (f) => fs.readFileSync(path.join(ROOT, 'assets', 'js', f), 'utf8');
const FICHIERS = lire('fichiers-locaux.js');
const MOI = lire('moi-local.js');

function chargerMoi() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>',
        { url: 'http://localhost/', runScripts: 'outside-only' });
    dom.window.eval(MOI);
    return dom.window.INKO_MOI_LOCAL;
}

// ── Notifications ───────────────────────────────────────────

test('les notifications se déposent, se listent et se marquent lues', () => {
    const M = chargerMoi();
    assert.deepEqual(M.repondre('GET', '/me/notifications').notifications, []);

    M.deposerNotification({ mangaId: 'm1', title: 'Nouveau chapitre', chapter: 12 });
    M.deposerNotification({ mangaId: 'm2', title: 'Autre série', chapter: 3 });

    const l = M.repondre('GET', '/me/notifications');
    assert.equal(l.total, 2);
    assert.equal(l.unread, 2);
    assert.equal(M.repondre('GET', '/me/notifications/unread').count, 2);

    M.repondre('POST', `/me/notifications/${l.notifications[0].id}/read`);
    assert.equal(M.repondre('GET', '/me/notifications').unread, 1);

    M.repondre('POST', '/me/notifications/read-all');
    assert.equal(M.repondre('GET', '/me/notifications').unread, 0);
});

test('le même chapitre déposé deux fois ne fait pas deux notifications', () => {
    // Le greffon Android peut redéposer après un redémarrage : un doublon
    // ferait croire à deux chapitres parus.
    const M = chargerMoi();
    assert.equal(M.deposerNotification({ mangaId: 'm', chapter: 5, title: 'Ch. 5' }), true);
    assert.equal(M.deposerNotification({ mangaId: 'm', chapter: 5, title: 'Ch. 5' }), false);
    assert.equal(M.repondre('GET', '/me/notifications').total, 1);
});

test('la liste des notifications est bornée', () => {
    // Une série très suivie en produirait des centaines par an.
    const M = chargerMoi();
    for (let i = 0; i < 260; i++) M.deposerNotification({ mangaId: 'm', chapter: i });
    assert.ok(M.repondre('GET', '/me/notifications').total <= 200);
});

test('la fréquence de scan est bornée aux deux bouts', () => {
    // Android refuse tout travail périodique sous quinze minutes ; au-delà
    // d'une semaine, la fonction ne sert plus à rien.
    const M = chargerMoi();
    assert.equal(M.repondre('PUT', '/me/notif-prefs', { everyHours: 0 }).everyHours, 1);
    assert.equal(M.repondre('PUT', '/me/notif-prefs', { everyHours: 99999 }).everyHours, 168);
    assert.equal(M.repondre('PUT', '/me/notif-prefs', { everyHours: 12 }).everyHours, 12);
    assert.equal(M.repondre('GET', '/me/notif-prefs').everyHours, 12);
});

test('surveiller une série s’active et se retire', () => {
    const M = chargerMoi();
    M.repondre('PUT', '/me/notif-watch/serie1', { notify: true });
    assert.equal(M._etat().notifWatch.serie1, true);
    M.repondre('PUT', '/me/notif-watch/serie1', { notify: false });
    assert.equal(M._etat().notifWatch.serie1, undefined);
});

// ── Fichiers importés ───────────────────────────────────────

test('la base est ouverte avec un NUMÉRO de version explicite', () => {
    // ⚠ `indexedDB.open(nom)` sans version crée la base vide en version 1, et
    // `onupgradeneeded` ne se déclenche alors jamais pour un code qui l'ouvre
    // ensuite en version 1 : le magasin d'objets n'est JAMAIS créé, et
    // l'import devient définitivement impossible sur une installation neuve,
    // sans la moindre erreur. Le même défaut a déjà été rencontré sur la base
    // des téléchargements.
    assert.match(FICHIERS, /indexedDB\.open\(BASE, VERSION\)/);
    assert.match(FICHIERS, /const VERSION = \d+/);
});

test('le magasin d’objets est créé à la montée de version', () => {
    assert.match(FICHIERS, /onupgradeneeded/);
    assert.match(FICHIERS, /createObjectStore\(MAGASIN, \{ keyPath: 'id' \}\)/);
});

test('seuls les formats que le lecteur sait ouvrir sont acceptés', () => {
    const dom = new JSDOM('<!doctype html>', { url: 'http://localhost/', runScripts: 'outside-only' });
    dom.window.eval(FICHIERS);
    const F = dom.window.INKO_FICHIERS_LOCAUX;
    for (const bon of ['livre.epub', 'tome.CBZ', 'archive.cbr', 'doc.pdf']) {
        assert.ok(F.typeDe(bon), `${bon} devrait être accepté`);
    }
    for (const mauvais of ['image.png', 'notes.txt', 'sans-extension', '']) {
        assert.equal(F.typeDe(mauvais), null, `${mauvais} ne devrait pas passer`);
    }
});

/** Le code seul : sans les commentaires, qui EXPLIQUENT souvent ce qu'on
 *  cherche à interdire. Trois de mes contrôles mordaient dessus. */
function codeSeul(src) {
    return src.replace(/\/\*[\s\S]*?\*\//g, '')
        .split('\n').filter((l) => !/^\s*\/\//.test(l)).join('\n');
}

test('le Blob est stocké tel quel, jamais encodé', () => {
    // Un encodage base64 gonflerait de 33 % et ferait exploser le stockage
    // dès le premier livre un peu gros. ⚠ Le fichier EXPLIQUE ce piège dans
    // son en-tête : lire les commentaires ferait échouer le contrôle sur sa
    // propre justification.
    assert.match(FICHIERS, /blob: fichier/);
    assert.ok(!/btoa|readAsDataURL|base64/i.test(codeSeul(FICHIERS)),
        'aucun encodage texte ne doit intervenir');
});

test('la liste ne rend pas le contenu binaire', () => {
    // `import.html` affiche des dizaines d'entrées : y joindre les Blobs
    // chargerait tous les livres en mémoire pour afficher des titres.
    const f = /function fiche\(e\) \{([\s\S]*?)\n    \}/.exec(FICHIERS);
    assert.ok(f, 'fiche() doit exister');
    assert.ok(!/blob/.test(f[1]), 'la fiche ne doit pas porter le Blob');
});

test('une base indisponible rend une liste vide, pas une page morte', () => {
    const bloc = /async function lister\(\) \{([\s\S]*?)\n    \}/.exec(FICHIERS);
    assert.match(bloc[1], /return \[\]/, 'l’échec doit rendre une liste vide');
});

// ── Le branchement ──────────────────────────────────────────

test('le téléversement reste local en mode autonome', () => {
    // Le XHR d'origine vise le hub : sa barre de progression défilerait vers
    // un échec.
    const api = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'api.js'), 'utf8');
    const up = /async upload\(file, meta, onProgress\) \{([\s\S]*?)\n {16}\}/.exec(api);
    assert.ok(up, 'upload() doit être lisible');
    assert.match(up[1], /INKO_AUTONOME && window\.INKO_FICHIERS_LOCAUX/);
    // On compare dans le FICHIER entier, débarrassé des commentaires : le bloc
    // capturé s'arrête avant le XHR, et `indexOf` y rendait -1.
    const c = codeSeul(api);
    assert.ok(c.indexOf('INKO_FICHIERS_LOCAUX.ajouter') < c.indexOf('XMLHttpRequest'),
        'le détour local doit précéder le téléversement réseau');
});

test('le lecteur lit depuis IndexedDB plutôt que par URL', () => {
    // `API.local.fileUrl()` désigne le hub : l'ouverture échouerait sur
    // « Fichier introuvable » alors que le fichier est bien sur l'appareil.
    // ⚠ Sur le fichier brut, `API.local.fileUrl` apparaît d'abord dans le
    // COMMENTAIRE qui explique pourquoi on ne l'utilise plus.
    const lr = codeSeul(lire('localreader.js'));
    assert.match(lr, /INKO_FICHIERS_LOCAUX\.contenu\(id\)/);
    assert.ok(lr.indexOf('INKO_FICHIERS_LOCAUX.contenu') < lr.indexOf('API.local.fileUrl'),
        'le chemin local doit être essayé en premier');
});

test('les modules du mode autonome gardent leur ordre de chargement', () => {
    const build = fs.readFileSync(path.join(ROOT, 'scripts-ci', 'build-mobile-www.js'), 'utf8');
    const b = /const balises = \[([\s\S]*?)\];/.exec(build)[1];
    const ordre = ['natif.js', 'hub.js', 'sources-embarquees.js', 'moi-local.js', 'fichiers-locaux.js'];
    let pos = -1;
    for (const f of ordre) {
        const i = b.indexOf(f);
        assert.ok(i > pos, `${f} doit venir après le précédent`);
        pos = i;
    }
});
