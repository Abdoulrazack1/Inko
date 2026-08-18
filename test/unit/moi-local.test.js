// ============================================================
// test/unit/moi-local.test.js — les données personnelles sans hub
// ------------------------------------------------------------
// Un inventaire page par page l'a montré : sept pages étaient INUTILISABLES
// sans ordinateur, et l'écrasante majorité des appels en échec visaient
// `me.*`. Une source embarquée permet de TROUVER des œuvres ; ce magasin
// permet d'en garder quelque chose. Sans lui : une liseuse sans mémoire.
//
// Ces tests portent sur le contrat exact que consomment les pages — les
// formes ont été relevées dans le code appelant, pas supposées :
//   `progress` et `readChapters` sont des OBJETS indexés par mangaId,
//   `favorites` et `lists` des TABLEAUX.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const SRC = fs.readFileSync(path.join(ROOT, 'assets', 'js', 'moi-local.js'), 'utf8');

function charger({ stockageCasse = false } = {}) {
    // `runScripts: 'outside-only'` : sans lui, `w.eval` s'exécute dans le
    // contexte de Node et `window` n'y existe pas.
    const dom = new JSDOM('<!doctype html><html><body></body></html>',
        { url: 'http://localhost/', runScripts: 'outside-only' });
    const w = dom.window;
    if (stockageCasse) {
        Object.defineProperty(w, 'localStorage', {
            value: {
                getItem() { throw new Error('Access is denied'); },
                setItem() { throw new Error('QuotaExceededError'); },
            },
            configurable: true,
        });
    }
    w.eval(SRC);
    return w.INKO_MOI_LOCAL;
}

test('les favoris s’ajoutent, se relisent et se retirent', () => {
    const M = charger();
    assert.deepEqual(M.repondre('GET', '/me/favorites'), []);
    M.repondre('POST', '/me/favorites', { mangaId: 'abc', title: 'Une série', source: 'mangadex' });
    const l = M.repondre('GET', '/me/favorites');
    assert.equal(l.length, 1);
    assert.equal(l[0].title, 'Une série');
    assert.ok(l[0].addedAt, 'la date d’ajout doit être posée');
    M.repondre('DELETE', '/me/favorites/abc');
    assert.deepEqual(M.repondre('GET', '/me/favorites'), []);
});

test('mettre deux fois en favori ne crée pas de doublon', () => {
    // La page appelle `addFavorite` sans savoir si c'est déjà fait : un
    // doublon apparaîtrait deux fois dans la bibliothèque.
    const M = charger();
    M.repondre('POST', '/me/favorites', { mangaId: 'x', title: 'A' });
    M.repondre('POST', '/me/favorites', { mangaId: 'x', title: 'A (mis à jour)' });
    const l = M.repondre('GET', '/me/favorites');
    assert.equal(l.length, 1);
    assert.equal(l[0].title, 'A (mis à jour)', 'le second appel met à jour');
});

test('la progression est un OBJET indexé par série', () => {
    // `accueil.js` fait `Object.entries(progress).map(([id, p]) => …)` :
    // rendre un tableau casserait la reprise de lecture, sans erreur visible.
    const M = charger();
    assert.deepEqual(M.repondre('GET', '/me/progress'), {});
    M.repondre('PUT', '/me/progress/serie1', { chapterId: 'c1', chapter: 12, page: 3, totalPages: 20 });
    const p = M.repondre('GET', '/me/progress');
    assert.ok(!Array.isArray(p), 'ce doit être un objet, pas un tableau');
    assert.equal(p.serie1.chapter, 12);
    assert.equal(p.serie1.page, 3);
    assert.ok(p.serie1.updatedAt);
});

test('`clientAt` fait foi sur l’heure d’envoi', () => {
    // Une écriture rejouée depuis la file hors-ligne arriverait horodatée à
    // son envoi et écraserait une lecture plus récente.
    const M = charger();
    M.repondre('PUT', '/me/progress/s', { chapter: 1, clientAt: '2020-01-01T00:00:00.000Z' });
    assert.equal(M.repondre('GET', '/me/progress').s.updatedAt, '2020-01-01T00:00:00.000Z');
});

test('les chapitres lus se marquent à l’unité et en masse', () => {
    const M = charger();
    M.repondre('POST', '/me/read-chapters', { mangaId: 'm', chapterId: 'c1', chapter: 1 });
    assert.deepEqual(M.repondre('GET', '/me/read-chapters').m, ['c1']);

    M.repondre('POST', '/me/read-chapters/bulk', { mangaId: 'm', chapters: [{ chapterId: 'c2' }, { chapterId: 'c3' }] });
    assert.deepEqual(M.repondre('GET', '/me/read-chapters').m, ['c1', 'c2', 'c3']);

    M.repondre('POST', '/me/read-chapters/unmark-bulk', { mangaId: 'm', chapterIds: ['c2'] });
    assert.deepEqual(M.repondre('GET', '/me/read-chapters').m, ['c1', 'c3']);
});

test('marquer deux fois le même chapitre ne le compte pas deux fois', () => {
    const M = charger();
    M.repondre('POST', '/me/read-chapters', { mangaId: 'm', chapterId: 'c1' });
    M.repondre('POST', '/me/read-chapters', { mangaId: 'm', chapterId: 'c1' });
    assert.deepEqual(M.repondre('GET', '/me/read-chapters').m, ['c1']);
    assert.equal(M.repondre('GET', '/me/stats').chaptersRead, 1);
});

test('notes : créer, modifier, filtrer par série, supprimer', () => {
    const M = charger();
    const n = M.repondre('POST', '/me/notes', { mangaId: 'm1', text: 'première' });
    assert.ok(n.id, 'la note doit recevoir un identifiant');
    M.repondre('POST', '/me/notes', { mangaId: 'm2', text: 'autre série' });

    assert.equal(M.repondre('GET', '/me/notes').total, 2);
    assert.equal(M.repondre('GET', '/me/notes?mangaId=m1').total, 1);

    M.repondre('PUT', '/me/notes/' + n.id, { text: 'corrigée' });
    assert.equal(M.repondre('GET', '/me/notes?mangaId=m1').notes[0].text, 'corrigée');

    M.repondre('DELETE', '/me/notes/' + n.id);
    assert.equal(M.repondre('GET', '/me/notes').total, 1);
});

test('listes : créer, y ajouter, en retirer, supprimer', () => {
    const M = charger();
    const l = M.repondre('POST', '/me/lists', { name: 'À lire' });
    assert.ok(l.id);
    assert.deepEqual(l.items, []);

    M.repondre('POST', `/me/lists/${l.id}/items`, { mangaId: 'a', title: 'A' });
    M.repondre('POST', `/me/lists/${l.id}/items`, { mangaId: 'a', title: 'A' });   // doublon
    assert.equal(M.repondre('GET', '/me/lists')[0].items.length, 1, 'pas de doublon dans une liste');

    M.repondre('DELETE', `/me/lists/${l.id}/items/a`);
    assert.equal(M.repondre('GET', '/me/lists')[0].items.length, 0);

    M.repondre('DELETE', '/me/lists/' + l.id);
    assert.deepEqual(M.repondre('GET', '/me/lists'), []);
});

test('les réglages fusionnent au lieu d’écraser', () => {
    // `saveSettings` est appelé avec des fragments : écraser perdrait les
    // réglages que la page courante ne connaît pas.
    const M = charger();
    M.repondre('PUT', '/me/settings', { theme: 'sombre' });
    M.repondre('PUT', '/me/settings', { langue: 'fr' });
    assert.deepEqual(M.repondre('GET', '/me/settings'), { theme: 'sombre', langue: 'fr' });
});

test('« aucune mise à jour » n’est pas annoncé comme un scan réussi', () => {
    // Le scan de toutes les sources appartient au hub. Rendre `{updates: []}`
    // sans plus ferait afficher « Tout est à jour ✓ » — un mensonge.
    const r = charger().repondre('GET', '/me/updates');
    assert.deepEqual(r.updates, []);
    assert.equal(r.frais, false, 'le résultat ne doit pas se prétendre frais');
    assert.equal(r.raison, 'sans-hub');
});

test('les statistiques se disent locales', () => {
    // Le hub en calcule bien plus. Rendre zéro sans le dire ferait croire à
    // une régression des chiffres.
    const M = charger();
    M.repondre('POST', '/me/favorites', { mangaId: 'a' });
    const s = M.repondre('GET', '/me/stats');
    assert.equal(s.favorites, 1);
    assert.equal(s.local, true, 'l’interface doit pouvoir dire d’où viennent ces chiffres');
});

test('l’import FUSIONNE — il n’efface pas ce qui a été lu depuis', () => {
    const M = charger();
    M.repondre('POST', '/me/favorites', { mangaId: 'recent', title: 'Ajouté depuis' });
    M.repondre('POST', '/me/import', {
        donnees: { favorites: [{ mangaId: 'ancien', title: 'De la sauvegarde' }], progress: { x: { chapter: 3 } } },
    });
    const favs = M.repondre('GET', '/me/favorites').map((f) => f.mangaId).sort();
    assert.deepEqual(favs, ['ancien', 'recent'], 'les deux doivent survivre');
    assert.equal(M.repondre('GET', '/me/progress').x.chapter, 3);
});

test('l’export rend tout, et se déclare local', () => {
    const M = charger();
    M.repondre('POST', '/me/favorites', { mangaId: 'a' });
    const e = M.repondre('GET', '/me/export');
    assert.equal(e.source, 'local');
    assert.equal(e.donnees.favorites.length, 1);
});

test('le journal local est borné', () => {
    // Un journal sans plafond finit par occuper toute la place — l'audit
    // avait déjà relevé ce défaut côté serveur (DB-06).
    const M = charger();
    for (let i = 0; i < 2100; i++) M.repondre('POST', '/me/read-chapters', { mangaId: 'm', chapterId: 'c' + i });
    assert.ok(M._etat().events.length <= 2000, `journal à ${M._etat().events.length} entrées`);
});

test('un stockage refusé ne fait pas tomber l’application', () => {
    // Navigation privée, cookies bloqués, certains WebView : `localStorage`
    // LÈVE. Perdre des favoris est grave ; ne plus démarrer l'est plus.
    const M = charger({ stockageCasse: true });
    assert.deepEqual(M.repondre('GET', '/me/favorites'), []);
    assert.doesNotThrow(() => M.repondre('POST', '/me/favorites', { mangaId: 'a' }));
});

test('ce qui n’est pas du ressort local est refusé, pas inventé', () => {
    const M = charger();
    assert.equal(M.repondre('GET', '/me/backups'), M.ABSENT);
    assert.equal(M.repondre('GET', '/mangas/search'), M.ABSENT, 'les sources ne passent pas par ici');
});
