// ============================================================
// test/unit/synchro-conflits.test.js — quand le téléphone et le PC ont
// changé la même chose chacun de leur côté
// ------------------------------------------------------------
// Avant : hors ligne, le téléphone passe une série en « Terminé » ; pendant
// ce temps, sur le PC, on la passe en « Abandonné ». Au retour du réseau, la
// boîte d'envoi rejouait « Terminé » et écrasait le choix du PC sans rien
// dire. Ces tests jouent un PC factice dont l'état change entre deux synchros.
'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const lire = (f) => fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'js', f), 'utf8');

function pcFactice() {
    const pc = {
        recus: [],
        favoris: [{ mangaId: 's1', title: 'Berserk', source: 'mangadex' }, { mangaId: 's2', title: 'Vagabond', source: 'mangadex' }],
        statut: { s1: 'reading', s2: 'reading' },
        progress: { s1: { chapterId: 'c9', chapter: 9, page: 1, updatedAt: '2026-10-20T08:00:00Z' } },
    };
    pc.fetch = async (url, opts = {}) => {
        const chemin = url.replace(/^.*\/api/, '');
        const method = opts.method || 'GET';
        const corps = opts.body ? JSON.parse(opts.body) : null;
        // Copie, comme un vrai réseau : sans elle, le téléphone garderait une
        // RÉFÉRENCE vers l'état du PC factice, et l'écrire chez lui l'écrirait au PC.
        const rep = (data) => ({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(data)) });
        if (chemin === '/health') return rep({ ok: true });
        if (method !== 'GET') {
            pc.recus.push({ method, chemin, corps });
            const st = /^\/me\/library\/(.+)$/.exec(chemin);
            if (st) pc.statut[decodeURIComponent(st[1])] = corps.status;
            const pr = /^\/me\/progress\/(.+)$/.exec(chemin);
            if (pr) pc.progress[decodeURIComponent(pr[1])] = { ...corps, updatedAt: corps.clientAt };
            return rep({ ok: true });
        }
        if (chemin === '/me/favorites') return rep(pc.favoris);
        if (chemin === '/me/progress') return rep(pc.progress);
        if (chemin === '/me/read-chapters') return rep({});
        if (chemin.startsWith('/me/notes')) return rep({ notes: [] });
        if (chemin === '/me/lists') return rep([]);
        if (chemin === '/me/library') return rep(Object.entries(pc.statut).map(([mangaId, status]) => ({ mangaId, status })));
        return { ok: false, status: 404, json: async () => ({}) };
    };
    return pc;
}
const fenetres = [];
after(() => fenetres.forEach(w => w.close()));

async function telephoneSynchronise() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', runScripts: 'outside-only' });
    const w = dom.window;
    fenetres.push(w);
    const pc = pcFactice();
    w.fetch = pc.fetch;
    w.INKO_HUB = 'http://pc:8088';
    w.INKO_TOKEN = 'jeton';
    w.eval(lire('moi-local.js'));
    w.eval(lire('synchro.js'));
    const S = w.INKO_SYNCHRO, ML = w.INKO_MOI_LOCAL;
    await S.synchroniser();          // première synchro : la base est posée
    pc.recus.length = 0;
    return { w, pc, S, ML };
}
const versJs = (x) => JSON.parse(JSON.stringify(x));

test('statut changé des deux côtés : rien n\'est écrasé, les deux valeurs sont proposées', async () => {
    const { pc, S, ML } = await telephoneSynchronise();
    pc.statut.s1 = 'dropped';                                         // sur le PC
    ML.repondre('PUT', '/me/library/s1', { status: 'completed' });   // sur le téléphone, hors ligne
    await S.synchroniser();
    assert.ok(!pc.recus.some(o => o.chemin === '/me/library/s1'), 'le choix du PC n\'est pas écrasé');
    assert.equal(pc.statut.s1, 'dropped');
    const c = versJs(S.conflits());
    assert.equal(c.length, 1);
    assert.deepStrictEqual([c[0].titre, c[0].telephone, c[0].pc], ['Berserk', 'Terminé', 'Abandonné']);
    assert.equal(S.resume().conflits, 1);

    // On garde le téléphone : la valeur part, le conflit disparaît.
    await S.resoudre(c[0].id, 'telephone');
    assert.equal(pc.statut.s1, 'completed');
    assert.equal(S.conflits().length, 0);
});

test('un changement fait d\'un seul côté passe comme avant', async () => {
    const { pc, S, ML } = await telephoneSynchronise();
    ML.repondre('PUT', '/me/library/s2', { status: 'paused' });
    await S.synchroniser();
    assert.equal(pc.statut.s2, 'paused');
    assert.equal(S.conflits().length, 0);
});

test('les deux disent la même chose : pas de conflit', async () => {
    const { pc, S, ML } = await telephoneSynchronise();
    pc.statut.s1 = 'completed';
    ML.repondre('PUT', '/me/library/s1', { status: 'completed' });
    await S.synchroniser();
    assert.equal(S.conflits().length, 0);
});

test('position divergente : proposée ; garder le PC n\'envoie rien et reprend la sienne', async () => {
    const { pc, S, ML } = await telephoneSynchronise();
    pc.progress.s1 = { chapterId: 'c15', chapter: 15, page: 1, updatedAt: '2026-10-20T20:00:00Z' };
    ML.repondre('PUT', '/me/progress/s1', { chapterId: 'c12', chapter: 12, page: 3 });
    await S.synchroniser();
    const c = versJs(S.conflits());
    assert.deepStrictEqual([c[0].type, c[0].telephone, c[0].pc], ['progression', 'chapitre 12', 'chapitre 15']);
    await S.resoudre(c[0].id, 'pc');
    assert.ok(!pc.recus.some(o => o.chemin === '/me/progress/s1'));
    assert.equal(ML._etat().progress.s1.chapter, 15, 'le téléphone a repris la position du PC');
});
