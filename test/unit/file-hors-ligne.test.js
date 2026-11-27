// ============================================================
// test/unit/file-hors-ligne.test.js — DAT-20
// ------------------------------------------------------------
// Réseau coupé, cinq gestes : seuls la progression et les chapitres lus
// revenaient. Suivre, retirer, poser un signet, écrire une note étaient
// perdus — et l'écran annulait le geste sur une erreur. Ces écritures sont
// désormais gardées, rendent `enAttente`, et sont rejouées au retour.
'use strict';

const { test, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const ROOT = path.join(__dirname, '..', '..');
const CLE = 'inko_offline_queue_v1';

const ouvertes = [];
afterEach(() => { while (ouvertes.length) ouvertes.pop().close(); });

function chargerAPI() {
    const dom = new JSDOM('<!doctype html><html><body></body></html>',
        { url: 'http://localhost:8088/accueil.html', runScripts: 'outside-only' });
    const win = dom.window;
    ouvertes.push(win);
    const etat = { enLigne: false, appels: [] };
    win.fetch = (url, opts = {}) => {
        const chemin = String(url).replace(/^https?:\/\/[^/]+/, '');
        etat.appels.push({ chemin, methode: opts.method || 'GET', corps: opts.body });
        if (!etat.enLigne) return Promise.reject(new TypeError('Failed to fetch'));
        return Promise.resolve({ ok: true, status: 200, headers: { get: () => 'application/json' }, json: () => Promise.resolve({ ok: true }) });
    };
    win.localStorage.setItem('inko_session', JSON.stringify({ token: 't', user: { id: 1, username: 'x' } }));
    win.eval(fs.readFileSync(path.join(ROOT, 'assets', 'js', 'api.js'), 'utf8'));
    const file = () => JSON.parse(win.localStorage.getItem(CLE) || '[]');
    return { win, API: win.API, etat, file };
}

test('hors ligne, suivre, signet et note sont gardés et rendent « en attente »', async () => {
    const { API, file } = chargerAPI();
    const a = await API.me.addFavorite('m1', { title: 'Un' });
    const b = await API.me.addBookmark({ mangaId: 'm1', chapterId: 'c1' });
    const c = await API.me.addNote({ mangaId: 'm1', body: 'texte' });
    for (const r of [a, b, c]) assert.strictEqual(r.enAttente, true);
    assert.deepStrictEqual(file().map(e => e.method + ' ' + e.path),
        ['POST /me/favorites', 'POST /me/bookmarks', 'POST /me/notes']);
});

test('suivre puis retirer hors ligne ne rejoue que le retrait', async () => {
    const { API, file } = chargerAPI();
    await API.me.addFavorite('m2', {});
    await API.me.removeFavorite('m2');
    assert.deepStrictEqual(file().map(e => e.method + ' ' + e.path), ['DELETE /me/favorites/m2']);
});

test('un statut changé deux fois ne garde que le dernier', async () => {
    const { API, file } = chargerAPI();
    await API.me.setLibrary('m3', 'reading');
    await API.me.setLibrary('m3', 'completed');
    const q = file();
    assert.strictEqual(q.length, 1);
    assert.strictEqual(q[0].body.status, 'completed');
});

test('la progression garde son comportement : elle échoue, mais reste en file', async () => {
    const { API, file } = chargerAPI();
    await assert.rejects(() => API.me.setProgress('m4', { chapterId: 'c', chapter: 2, page: 1 }));
    assert.ok(file().some(e => e.method === 'PUT' && e.path.startsWith('/me/progress/')));
});

test('ce qui n’est pas rejouable n’est pas gardé : l’erreur reste une erreur', async () => {
    const { API, file } = chargerAPI();
    await assert.rejects(() => API.me.removeFavorites(['a', 'b']));
    assert.strictEqual(file().length, 0);
});
