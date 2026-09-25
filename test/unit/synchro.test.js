// ============================================================
// test/unit/synchro.test.js — le téléphone et le PC, comme Spotify
// ------------------------------------------------------------
// Le téléphone est autonome : il écrit chez lui, note chaque modification
// dans une boîte d'envoi, la rejoue vers le PC quand il répond, puis reprend
// l'état fusionné du PC. Ces tests jouent un PC factice (fetch simulé).
'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const lire = (f) => fs.readFileSync(path.join(ROOT, 'assets', 'js', f), 'utf8');

/** Un PC factice : garde ce qu'on lui envoie, rend son propre état. */
function pcFactice() {
    const pc = { recus: [], joignable: true, favoris: [{ mangaId: 'pc-1', title: 'Lu sur le PC', source: 'mangadex' }],
        progress: { 'pc-1': { chapterId: 'x9', chapter: 9, page: 1 } }, noteId: 100 };
    pc.fetch = async (url, opts = {}) => {
        if (!pc.joignable) throw new TypeError('Failed to fetch');
        const chemin = url.replace(/^.*\/api/, '');
        const method = opts.method || 'GET';
        const corps = opts.body ? JSON.parse(opts.body) : null;
        const rep = (data) => ({ ok: true, status: 200, json: async () => data });
        if (chemin === '/health') return rep({ ok: true });
        if (method !== 'GET') {
            pc.recus.push({ method, chemin, corps, auth: opts.headers?.Authorization });
            if (chemin === '/me/favorites' && method === 'POST') pc.favoris.push({ mangaId: corps.mangaId, title: corps.title });
            if (chemin === '/me/notes' && method === 'POST') return rep({ ok: true, note: { id: ++pc.noteId, ...corps } });
            return rep({ ok: true });
        }
        if (chemin === '/me/favorites') return rep(pc.favoris);
        if (chemin === '/me/progress') return rep(pc.progress);
        if (chemin === '/me/read-chapters') return rep({ 'pc-1': [{ chapterId: 'x1', chapter: 1 }] });
        if (chemin.startsWith('/me/notes')) return rep({ notes: [], total: 0 });
        if (chemin === '/me/lists') return rep([]);
        if (chemin === '/me/library') return rep([{ mangaId: 'pc-1', status: 'reading' }]);
        return { ok: false, status: 404, json: async () => ({ error: 'inconnu' }) };
    };
    return pc;
}

// Les minuteries de synchro (3 min) garderaient le processus en vie.
const fenetres = [];
after(() => fenetres.forEach(w => w.close()));

function telephone({ hub = 'http://pc:8088', donneesLocales = null } = {}) {
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost/', runScripts: 'outside-only' });
    const w = dom.window;
    fenetres.push(w);
    const pc = pcFactice();
    w.fetch = pc.fetch;
    w.INKO_HUB = hub;
    w.INKO_TOKEN = 'jeton-appareil';
    if (donneesLocales) w.localStorage.setItem('inko_moi_local', JSON.stringify(donneesLocales));
    w.eval(lire('moi-local.js'));
    w.eval(lire('synchro.js'));
    return { w, pc, ML: w.INKO_MOI_LOCAL, S: w.INKO_SYNCHRO };
}

test('une modification faite sur le téléphone part vers le PC, avec le jeton de l’appareil', async () => {
    const { ML, S, pc } = telephone();
    ML.repondre('POST', '/me/favorites', { mangaId: 'tel-1', title: 'Ajouté sur le téléphone', source: 'mangadex' });
    assert.equal(S.resume().enAttente, 1);
    const r = await S.synchroniser();
    assert.ok(r.ok);
    assert.ok(pc.recus.some(o => o.chemin === '/me/favorites' && o.corps.mangaId === 'tel-1'));
    assert.ok(pc.recus.every(o => o.auth === 'Bearer jeton-appareil'));
    assert.equal(S.resume().enAttente, 0);
});

test('PC injoignable : la modification attend, puis part à son retour', async () => {
    const { ML, S, pc } = telephone();
    pc.joignable = false;
    ML.repondre('PUT', '/me/progress/tel-1', { chapterId: 'c2', chapter: 2, page: 4 });
    const r = await S.synchroniser();
    assert.equal(r.ok, false);
    assert.equal(S.resume().enAttente, 1, 'rien ne se perd hors connexion');
    pc.joignable = true;
    await S.synchroniser();
    const envoi = pc.recus.find(o => o.chemin === '/me/progress/tel-1');
    assert.ok(envoi, 'la progression est partie au retour du PC');
    assert.ok(envoi.corps.clientAt, 'elle porte l’heure réelle de lecture, pour l’arbitrage');
});

test('le rapatriement apporte ce qui a été lu sur le PC', async () => {
    const { ML, S } = telephone();
    await S.synchroniser();
    const s = ML._etat();
    assert.ok(s.favorites.some(f => f.mangaId === 'pc-1'));
    assert.equal(s.progress['pc-1'].chapter, 9);
    assert.equal(s.readChapters['pc-1'][0].chapterId, 'x1');
    assert.equal(s.library['pc-1'].status, 'reading');
});

test('la progression d’une série ne garde que sa dernière valeur dans la boîte', () => {
    const { ML, S } = telephone({ hub: '' });
    ML.repondre('PUT', '/me/progress/m', { chapterId: 'c1', chapter: 1, page: 1 });
    ML.repondre('PUT', '/me/progress/m', { chapterId: 'c1', chapter: 1, page: 9 });
    assert.equal(S.resume().enAttente, 1);
});

test('première synchro : ce qui a été lu AVANT l’appairage n’est pas perdu', async () => {
    const { S, pc } = telephone({ donneesLocales: {
        version: 1,
        favorites: [{ mangaId: 'avant-1', title: 'Lu seul', source: 'mangadex' }],
        progress: { 'avant-1': { chapterId: 'a3', chapter: 3, page: 2, updatedAt: '2026-09-01T10:00:00Z' } },
        readChapters: { 'avant-1': [{ chapterId: 'a1', chapter: 1 }] },
        notes: [{ id: 'lxyz', mangaId: 'avant-1', body: 'une note écrite hors connexion' }],
    } });
    await S.synchroniser();
    const chemins = pc.recus.map(o => o.method + ' ' + o.chemin);
    assert.ok(chemins.includes('POST /me/favorites'));
    assert.ok(chemins.includes('PUT /me/progress/avant-1'));
    assert.ok(chemins.includes('POST /me/read-chapters/bulk'));
    assert.ok(chemins.includes('POST /me/notes'));
    const prog = pc.recus.find(o => o.chemin === '/me/progress/avant-1');
    assert.equal(prog.corps.clientAt, '2026-09-01T10:00:00Z', 'la date de lecture d’origine est conservée');
});

test('une note créée hors connexion puis modifiée garde son lien avec le PC', async () => {
    const { ML, S, pc } = telephone();
    await S.synchroniser();                         // première synchro faite
    pc.joignable = false;
    const n = ML.repondre('POST', '/me/notes', { mangaId: 'pc-1', body: 'brouillon' });
    ML.repondre('PUT', '/me/notes/' + n.id, { body: 'version finale' });
    pc.joignable = true;
    await S.synchroniser();
    const maj = pc.recus.find(o => o.method === 'PUT' && o.chemin.startsWith('/me/notes/'));
    assert.equal(maj.chemin, '/me/notes/' + pc.noteId, 'l’identifiant local est remplacé par celui du PC');
});

test('les réglages de l’appareil ne voyagent pas', () => {
    const { ML, S } = telephone({ hub: '' });
    ML.repondre('PUT', '/me/settings', { theme: 'dark' });
    assert.equal(S.resume().enAttente, 0);
});
