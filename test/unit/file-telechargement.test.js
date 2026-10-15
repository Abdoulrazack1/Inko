// ============================================================
// test/unit/file-telechargement.test.js — une file qui survit à la page
// ------------------------------------------------------------
// Télécharger une plage de chapitres était une boucle `for` vivant DANS la
// page de la série. Quitter la page tuait la boucle en silence : on lançait
// vingt chapitres, on allait en lire un — ce que l'application invite à faire
// — et au retour il s'était arrêté à trois. Rien ne le disait.
//
// `dl-file.js` en fait un état persisté : n'importe quelle page qui charge le
// module reprend le travail. Ces tests EXÉCUTENT le module dans un DOM avec
// un `localStorage` réel et une source simulée, plutôt que de relire son
// texte — ce qui est précisément ce qu'on veut d'une machine à états.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const SRC = fs.readFileSync(
    path.join(__dirname, '..', '..', 'assets', 'js', 'dl-file.js'), 'utf8');

const attendre = (ms) => new Promise(r => setTimeout(r, ms));

/**
 * Monte le module avec une source et un magasin simulés.
 *
 * `pagesDe` décide du sort de chaque chapitre : rendre un tableau le fait
 * réussir, lever le fait échouer. C'est tout ce dont le module a besoin de la
 * source, et c'est ce qui permet d'éprouver la branche d'échec sans dépendre
 * d'un site réel.
 */
function monter({ pagesDe, lent = 0, etatInitial = null } = {}) {
    const dom = new JSDOM('<!doctype html><html><body></body></html>',
        { url: 'http://localhost/downloads.html', runScripts: 'outside-only' });
    const w = dom.window;

    if (etatInitial) w.localStorage.setItem('inko_dl_file_v1', JSON.stringify(etatInitial));

    const telecharges = [];
    w.MH = { err() {}, toast() {} };
    w.API = { mangas: { pages: async (id) => ({ pages: pagesDe(id) }) } };
    w.Downloads = {
        async download(info, pages, onProgress) {
            if (lent) {
                for (let i = 1; i <= pages.length; i++) {
                    if (onProgress) onProgress(i, pages.length);
                    await attendre(lent);
                }
            }
            telecharges.push(info.chapterId);
            return { failed: 0 };
        },
    };

    w.eval(SRC);
    return { w, F: w.DlFile, telecharges };
}

const chapitre = (n) => ({
    chapterId: 'ch' + n, mangaId: 'm1', chapterNum: n,
    mangaTitle: 'Une série', source: 'test',
});

// ── Ce qui manquait : la persistance ────────────────────────

test('la file survit à la page : une autre page la retrouve et la reprend', async () => {
    // Première page : on met trois chapitres en file, la source ne répond pas.
    const a = monter({ pagesDe: () => { throw new Error('hors ligne'); } });
    a.F.ajouter([chapitre(1), chapitre(2), chapitre(3)]);
    const garde = a.w.localStorage.getItem('inko_dl_file_v1');
    assert.ok(garde, 'la file doit être écrite sur le disque, pas gardée en mémoire');

    // Seconde page : même stockage, source de nouveau là. Personne ne lui dit
    // quoi faire — c'est tout l'intérêt.
    const b = monter({ pagesDe: () => ['p1', 'p2'], etatInitial: JSON.parse(garde) });
    await attendre(120);

    assert.deepEqual(b.telecharges, ['ch1', 'ch2', 'ch3'],
        'la seconde page reprend la file sans qu’on la relance');
    assert.equal(b.F.liste().length, 0, 'et la vide à mesure qu’elle avance');
});

test('les chapitres sont téléchargés UN PAR UN, dans l’ordre', async () => {
    // Paralléliser irait plus vite et assommerait le site scrapé : c'est ce
    // qui fait bannir une adresse IP. L'ordre est celui de la file, pas celui
    // des réponses.
    let simultanes = 0, maxSimultanes = 0;
    const m = monter({ pagesDe: () => ['p1'] });
    m.w.Downloads.download = async (info) => {
        simultanes++; maxSimultanes = Math.max(maxSimultanes, simultanes);
        await attendre(15);
        simultanes--;
        m.telecharges.push(info.chapterId);
    };
    m.F.ajouter([chapitre(1), chapitre(2), chapitre(3)]);
    await attendre(200);

    assert.equal(maxSimultanes, 1, 'jamais deux téléchargements en même temps');
    assert.deepEqual(m.telecharges, ['ch1', 'ch2', 'ch3'], 'et dans l’ordre de la file');
});

// ── Réordonner ──────────────────────────────────────────────

test('on peut remonter un chapitre, et l’ordre est celui qui est suivi', async () => {
    // Sur quarante chapitres en attente, celui qu'on veut lire ce soir peut
    // être en trente-huitième position. Sans cela, la seule façon de
    // l'obtenir avant demain était de tout annuler.
    const m = monter({ pagesDe: () => { throw new Error('en attente'); } });
    m.F.ajouter([chapitre(1), chapitre(2), chapitre(3)]);
    await attendre(60);

    assert.equal(m.F.deplacer('ch3', -1), true);
    assert.deepEqual(m.F.liste().map(i => i.chapterId), ['ch1', 'ch3', 'ch2']);

    // Les bords ne doivent pas se replier : descendre le dernier n'a pas de
    // sens, et le faire taire sans rien changer vaut mieux que de le
    // téléporter en tête.
    assert.equal(m.F.deplacer('ch2', 1), false, 'le dernier ne descend pas');
    assert.equal(m.F.deplacer('ch1', -1), false, 'le premier ne monte pas');
    assert.deepEqual(m.F.liste().map(i => i.chapterId), ['ch1', 'ch3', 'ch2'],
        'un déplacement refusé ne change rien');
});

test('ajouter deux fois le même chapitre ne le met pas deux fois', () => {
    const m = monter({ pagesDe: () => { throw new Error('en attente'); } });
    assert.equal(m.F.ajouter([chapitre(1), chapitre(2)]), 2);
    assert.equal(m.F.ajouter([chapitre(2), chapitre(3)]), 1,
        'le compte rendu porte sur ce qui a RÉELLEMENT été ajouté');
    assert.deepEqual(m.F.liste().map(i => i.chapterId), ['ch1', 'ch2', 'ch3']);
});

// ── La pause ────────────────────────────────────────────────

test('la pause arrête le chapitre SUIVANT, pas celui en cours', async () => {
    // Abandonner le chapitre en cours jetterait les pages déjà prises. La
    // pause s'applique donc au suivant — et l'interface le dit, sans quoi une
    // barre qui continue de monter après « pause » passe pour un bouton cassé.
    const m = monter({ pagesDe: () => ['p1', 'p2', 'p3'], lent: 10 });
    m.F.ajouter([chapitre(1), chapitre(2)]);
    await attendre(15);

    assert.equal(m.F.basculerPause(), true);
    await attendre(200);

    assert.deepEqual(m.telecharges, ['ch1'],
        'le chapitre en cours va au bout, le suivant n’est pas lancé');
    assert.equal(m.F.liste().length, 1, 'le suivant reste en file');

    m.F.basculerPause();
    await attendre(200);
    assert.deepEqual(m.telecharges, ['ch1', 'ch2'], 'reprendre relance la file');
});

// ── L'échec ─────────────────────────────────────────────────

test('une source morte bloque son entrée après trois essais, sans bloquer la file', async () => {
    // Une file qui tourne à vide sur la même entrée empêche toutes les
    // suivantes. Et retirer l'entrée effacerait la trace de ce qui n'a pas
    // marché, qui est justement ce qu'on veut voir.
    const m = monter({ pagesDe: (id) => { if (id === 'ch1') throw new Error('source morte'); return ['p1']; } });
    m.F.ajouter([chapitre(1), chapitre(2)]);
    await attendre(300);

    const mort = m.F.liste().find(i => i.chapterId === 'ch1');
    assert.ok(mort, 'l’entrée en échec reste visible');
    assert.equal(mort.bloque, true, 'elle est bloquée');
    assert.equal(mort.echecs, 3, 'après trois essais, pas davantage');
    assert.match(mort.erreur, /source morte/, 'et elle porte la raison');

    assert.deepEqual(m.telecharges, ['ch2'],
        'le chapitre suivant passe quand même');
});

test('relancer une entrée bloquée la remet en jeu', async () => {
    let vivante = false;
    const m = monter({ pagesDe: () => { if (!vivante) throw new Error('source morte'); return ['p1']; } });
    m.F.ajouter([chapitre(1)]);
    await attendre(300);
    assert.equal(m.F.liste()[0].bloque, true);

    vivante = true;
    m.F.relancer('ch1');
    await attendre(120);

    assert.deepEqual(m.telecharges, ['ch1']);
    assert.equal(m.F.liste().length, 0);
});

// ── Le verrou entre onglets ─────────────────────────────────

test('une page qui travaille empêche une autre de refaire le même travail', async () => {
    // Deux pages Inko ouvertes — l'app de bureau ET un onglet — feraient
    // tourner deux fois la même file : le même chapitre demandé deux fois à
    // la source, c'est-à-dire le comportement qu'on évite en téléchargeant en
    // série.
    const a = monter({ pagesDe: () => ['p1', 'p2', 'p3'], lent: 20 });
    a.F.ajouter([chapitre(1), chapitre(2)]);
    await attendre(25);

    const verrou = a.w.localStorage.getItem('inko_dl_verrou_v1');
    assert.ok(verrou, 'la page qui travaille pose une marque');
    assert.ok(JSON.parse(verrou).at, 'datée, pour qu’elle puisse périmer');

    // Une seconde page avec le MÊME stockage ne doit pas doubler le travail.
    const b = monter({
        pagesDe: () => ['p1', 'p2', 'p3'], lent: 20,
        etatInitial: JSON.parse(a.w.localStorage.getItem('inko_dl_file_v1')),
    });
    b.w.localStorage.setItem('inko_dl_verrou_v1', verrou);
    await attendre(80);

    assert.deepEqual(b.telecharges, [],
        'la seconde page se retire tant que la première tient la marque');
});

test('le verrou périme, sinon un onglet fermé gèlerait la file pour toujours', async () => {
    const m = monter({
        pagesDe: () => ['p1'],
        etatInitial: { items: [chapitre(1)], pause: false },
    });
    // Une marque vieille de cinq minutes : son détenteur n'est plus là.
    m.w.localStorage.setItem('inko_dl_verrou_v1',
        JSON.stringify({ id: 'un-onglet-ferme', at: Date.now() - 300000 }));
    m.F.ajouter([chapitre(2)]);        // provoque une tentative de reprise
    await attendre(150);

    assert.ok(m.telecharges.length > 0,
        'une marque périmée ne doit pas geler la file');
});
