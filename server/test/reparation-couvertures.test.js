// ============================================================
// test/reparation-couvertures.test.js — remplacer une couverture morte (COV-01)
// ------------------------------------------------------------
// Sans réseau : la source, la vérification d'image et AniList sont simulées.
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const R = require('../lib/reparation-couvertures');

const MORTE = 'https://sushiscan.fr/wp-content/uploads/x.jpg';
const NEUVE = 'https://sushiscan.net/wp-content/uploads/X.jpg';
const ANI = 'https://s4.anilist.co/file/c.jpg';
const favori = (o = {}) => ({ manga_id: 'akane-banashi', source: 'sushiscan', title: 'Akane-banashi', cover: MORTE, ...o });
const deps = ({ valides = [], source = null, media = [], appels = [] } = {}) => ({
    verifierImage: async (u) => { appels.push(u); return valides.includes(u); },
    source: () => source,
    aniList: async (t) => { appels.push('anilist:' + t); return media; },
});
const fiche = (titre, url, synonymes = []) => ({ title: { romaji: titre }, synonyms: synonymes, coverImage: { extraLarge: url } });

test('une panne passagère ne change rien', async () => {
    const r = await R.trouver(favori(), deps({ valides: [MORTE] }));
    assert.deepEqual(r, { url: MORTE, via: 'actuelle' });
});

test('la source redemandée passe avant tout le reste (site déménagé)', async () => {
    const appels = [];
    const r = await R.trouver(favori(), deps({ valides: [NEUVE, ANI], source: { getManga: async () => ({ cover: NEUVE }) }, media: [fiche('Akane-banashi', ANI)], appels }));
    assert.deepEqual(r, { url: NEUVE, via: 'source' });
    assert.ok(!appels.some(a => a.startsWith('anilist:')), 'inutile d’interroger AniList');
});

test('source muette : AniList, par un titre qui correspond', async () => {
    const r = await R.trouver(favori(), deps({ valides: [ANI], source: { getManga: async () => { throw new Error('panne'); } }, media: [fiche('Akane Banashi', ANI)] }));
    assert.deepEqual(r, { url: ANI, via: 'anilist' });
});

test('jamais la couverture d’une AUTRE œuvre', async () => {
    for (const autre of ['Naruto', 'Akane', 'Akane-banashi Spin-off : une autre histoire', 'Ranma 1/2']) {
        const r = await R.trouver(favori(), deps({ valides: [ANI], media: [fiche(autre, ANI)] }));
        assert.equal(r, null, autre);
    }
});

test('MangaDex : l’identifiant AniList (ou MyAnimeList) prime sur le titre', async () => {
    const demandes = [];
    const f = favori({ source: 'mangadex', manga_id: '8f8b7cb0-7109-46e8-b12c-0448a6453dfa', title: 'JoJo Part 9 : The JOJOLands', cover: 'https://uploads.mangadex.org/covers/x.jpg' });
    for (const [liens, attendu] of [[{ al: '31706', mal: '1706' }, { id: 31706 }], [{ mal: '139629' }, { idMal: 139629 }]]) {
        const d = deps({ valides: [ANI] });
        d.liens = async () => liens;
        d.aniListId = async (q) => { demandes.push(q); return { coverImage: { large: ANI } }; };
        assert.deepEqual(await R.trouver(f, d), { url: ANI, via: 'identifiant' });
        assert.deepEqual(demandes.pop(), attendu);
    }
    const sans = deps({ valides: [ANI] }); sans.liens = async () => null; sans.aniListId = async () => { throw new Error('inattendu'); };
    assert.equal(await R.trouver(f, sans), null, 'sans lien ni titre ressemblant, rien');
});

test('un synonyme ou une variante d’écriture suffit', () => {
    assert.ok(R.titresProches('Akane-banashi', ['Akane Banashi']));
    assert.ok(R.titresProches('L’Attaque des Titans', ['L\'attaque des titans']));
    assert.ok(R.titresProches('SPY×FAMILY (VF)', ['Spy x Family', 'SPY×FAMILY']));
    assert.ok(R.titresProches('進撃の巨人', ['進撃の巨人']));
    assert.ok(!R.titresProches('Blame!', ['Blame! Academy and So On']));
    assert.ok(!R.titresProches('', ['x']));
});

test('une adresse dangereuse ou illisible n’est jamais retenue', async () => {
    const r = await R.trouver(favori({ title: null }), deps({ valides: ['javascript:alert(1)'], source: { getManga: async () => ({ cover: 'javascript:alert(1)' }) } }));
    assert.equal(r, null);
});

test('reparer enregistre ce qu’elle trouve, une seule fois par œuvre introuvable', async () => {
    R._oublier();
    const ecrits = [];
    const lignes = [favori(), favori({ manga_id: 'introuvable', title: 'Zzz', cover: null })];
    const pool = { query: async (sql, p) => { if (/^SELECT/.test(sql)) return [lignes.filter(l => p[1].includes(l.manga_id))]; ecrits.push(p); return [{}]; } };
    const d = deps({ valides: [NEUVE], source: { getManga: async (id) => (id === 'akane-banashi' ? { cover: NEUVE } : {}) } });
    const r = await R.reparer(pool, 7, ['akane-banashi', 'introuvable'], d);
    assert.deepEqual(r.couvertures, { 'akane-banashi': NEUVE });
    assert.deepEqual(r.introuvables, ['introuvable']);
    assert.deepEqual(ecrits, [[NEUVE, 7, 'akane-banashi']]);
    const encore = await R.reparer(pool, 7, ['introuvable'], d);
    assert.deepEqual(encore, { couvertures: {}, introuvables: [] }, 'on ne redemande pas ce qui vient d’échouer');
});
