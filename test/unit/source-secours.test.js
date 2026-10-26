// ============================================================
// test/unit/source-secours.test.js — le chapitre, ailleurs, quand sa source
// ne répond plus
// ------------------------------------------------------------
// Vérifié dans le vrai lecteur (Chromium, deux sources simulées) : pages en
// échec chez « Source en panne » → « Source en panne ne répond pas : ce
// chapitre est lu sur Source de secours. Ta progression reste sur la série
// d'origine. » ; planche servie par la source de secours, Page 1 / 3 ; titre
// et adresse restent ceux de la série d'origine ; « Solo Leveling: Ragnarok »
// (proposé par la recherche) n'est pas pris pour « Solo Leveling ».
'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const window = {};
// eslint-disable-next-line no-new-func
new Function('window', fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'source-secours.js'), 'utf8'))(window);
const { chercher, chapitreDeMemeNumero, candidates } = window.MH.sourceSecours;

function apiFactice({ parSource }) {
    const appels = [];
    return {
        appels,
        sources: { list: async () => Object.keys(parSource).map(id => ({ id, name: id.toUpperCase(), capabilities: ['search'] })) },
        mangas: {
            searchFor: async (s) => { appels.push(`search:${s}`); if (parSource[s].panne) throw new Error('503'); return { results: parSource[s].resultats || [] }; },
            chaptersFor: async (s) => { appels.push(`chapters:${s}`); return { results: parSource[s].chapitres || [] }; },
            pagesFor: async (s) => { appels.push(`pages:${s}`); return { pages: parSource[s].pages || [] }; },
        },
    };
}

test('même titre, même numéro, sur la première source qui répond — les autres ne sont pas sollicitées', async () => {
    const API = apiFactice({ parSource: {
        a: { panne: true },
        b: { resultats: [{ id: 'b1', title: 'SOLO LEVELING' }], chapitres: [{ id: 'b-12', chapter: '12.0' }], pages: [{ url: 'u1' }] },
        c: { resultats: [{ id: 'c1', title: 'Solo Leveling' }] },
        panne: {},
    } });
    const r = await chercher({ titre: 'Solo Leveling', numero: '12', enPanne: 'panne', API, MH: {} });
    assert.deepStrictEqual([r.source, r.mangaId, r.chapitre.id, r.pages.length], ['b', 'b1', 'b-12', 1]);
    assert.ok(!API.appels.some(x => x.endsWith(':c')), 'une à une : on s\'arrête au premier trouvé');
    assert.ok(!API.appels.some(x => x.endsWith(':panne')), 'jamais la source en panne');
});

test('on ne devine pas : autre œuvre, autre numéro, titre ou numéro inconnu → rien', async () => {
    const API = apiFactice({ parSource: {
        b: { resultats: [{ id: 'b2', title: 'Solo Leveling: Ragnarok' }] },
        c: { resultats: [{ id: 'c1', title: 'Solo Leveling' }], chapitres: [{ id: 'c-13', chapter: '13' }] },
    } });
    assert.equal(await chercher({ titre: 'Solo Leveling', numero: 12, enPanne: 'x', API, MH: {} }), null);
    assert.equal(await chercher({ titre: null, numero: 12, enPanne: 'x', API, MH: {} }), null);
    assert.equal(await chercher({ titre: 'Solo Leveling', numero: '?', enPanne: 'x', API, MH: {} }), null);
});

test('candidates : images, activées, capables de chercher', () => {
    const r = candidates([
        { id: 'panne', capabilities: ['search'] }, { id: 'roman', capabilities: ['search'] },
        { id: 'coupee', capabilities: ['search'] }, { id: 'muette', capabilities: [] }, { id: 'ok', capabilities: ['search'] },
    ], 'panne', { estRoman: id => id === 'roman', activee: id => id !== 'coupee' });
    assert.deepStrictEqual(r.map(s => s.id), ['ok']);
    assert.equal(chapitreDeMemeNumero([{ id: 'x', chapter: '10.5' }], 10.5).id, 'x');
});

test('le lecteur garde la série d\'origine et le dit', () => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', 'chapitre.js'), 'utf8');
    assert.match(src, /const s = await lireAilleurs\(mangaId, chapterId\);\s*if \(!s\) throw netErr;/);
    assert.match(src, /Ta progression reste sur la série d’origine/);
});
