// ============================================================
// test/corbeille.test.js — retirer sans perdre (audit DAT-01 / DAT-03)
// ------------------------------------------------------------
// Rejoue l'incident du 9 novembre sur une base JETABLE : des centaines de
// retraits d'affilée. Le serveur doit les freiner, et tout ce qui est retiré
// doit pouvoir revenir.
'use strict';

const BASE = 'inko_test_corbeille';
process.env.DB_NAME = BASE;
process.env.DISABLE_BACKUPS = '1';
const fs = require('fs');
const os = require('os');
const path = require('path');
const DOSSIER = fs.mkdtempSync(path.join(os.tmpdir(), 'inko-corbeille-'));
process.env.BACKUP_DIR = DOSSIER;

const { test, before, after } = require('node:test');
const assert = require('node:assert');

let pool, User, corbeille, available = false;

before(async () => {
    try {
        require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
        process.env.DB_NAME = BASE;
        const mysql = require('mysql2/promise');
        const admin = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1', port: parseInt(process.env.DB_PORT || '3306', 10),
            user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '',
            multipleStatements: true, connectTimeout: 2500,
        });
        await admin.query(`DROP DATABASE IF EXISTS ${BASE}`);
        await admin.query(`CREATE DATABASE ${BASE} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await admin.query(`USE ${BASE}`);
        await admin.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
        await admin.end();
        ({ pool } = require('../config/db'));
        await require('../db/migrate').ensureSchema();
        User = require('../controllers/user.controller');
        corbeille = require('../lib/corbeille');
        available = true;
    } catch (e) {
        if (process.env.REQUIRE_DB_TESTS === '1') throw new Error('MySQL requis : ' + e.message);
        console.warn('[corbeille] MySQL indisponible — tests sautés :', e.message);
    }
});

after(async () => {
    if (pool) { try { await pool.query(`DROP DATABASE IF EXISTS ${BASE}`); await pool.end(); } catch (e) { /* déjà fermée */ } }
    try { fs.rmSync(DOSSIER, { recursive: true, force: true }); } catch (e) { /* nettoyage */ }
});

/** Une requête et une réponse factices, comme dans les autres suites. */
function rr({ user, params = {}, body = {}, headers = {} } = {}) {
    const req = { user, params, body, query: {}, headers, cookies: {}, socket: { remoteAddress: '127.0.0.1' }, ip: '127.0.0.1' };
    const res = { statusCode: 200, body: undefined, entetes: {}, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; }, set(k, v) { this.entetes[k] = v; return this; }, end() { return this; } };
    return { req, res };
}
const echec = (e) => { throw e; };
let n = 0;
async function compte(favoris = 0) {
    const nom = 'corb' + (++n) + Date.now().toString(36);
    const [r] = await pool.query('INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)', [nom, nom + '@test.local', 'x']);
    const u = { id: r.insertId, username: nom };
    for (let i = 0; i < favoris; i++) await pool.query('INSERT INTO favorites (user_id, manga_id, source, title, cover, category) VALUES (?, ?, ?, ?, ?, ?)', [u.id, 'm' + i, 'weebcentral', 'Titre ' + i + ' 漫画', 'https://exemple.test/' + i + '.webp', i % 2 ? 'À relire' : null]);
    return u;
}
const favoris = async (u) => (await pool.query('SELECT * FROM favorites WHERE user_id = ? ORDER BY manga_id', [u.id]))[0];

test('retrait en lot : tout part dans la corbeille et revient à l’identique', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    const u = await compte(25);
    const avant = await favoris(u);
    const ids = avant.map(f => f.manga_id);
    const r = rr({ user: u, body: { mangaIds: ids, confirmer: ids.length }, headers: { 'user-agent': 'Mozilla/5.0 Chrome/120.0' } });
    await User.removeFavoritesBulk(r.req, r.res, echec);
    assert.equal(r.res.statusCode, 200, JSON.stringify(r.res.body));
    assert.equal(r.res.body.retires, 25);
    assert.ok(r.res.body.sauvegarde && r.res.body.sauvegarde.startsWith('inko-avant-retrait-'), 'une sauvegarde précède un retrait massif');
    assert.ok(fs.existsSync(path.join(DOSSIER, r.res.body.sauvegarde)));
    assert.equal((await favoris(u)).length, 0);

    const liste = rr({ user: u });
    await User.getCorbeille(liste.req, liste.res, echec);
    assert.equal(liste.res.body.lots.length, 1);
    assert.equal(liste.res.body.lots[0].nombre, 25);

    const back = rr({ user: u, body: { lot: r.res.body.lot } });
    await User.restaurerCorbeille(back.req, back.res, echec);
    assert.equal(back.res.body.restaures, 25);
    const apres = await favoris(u);
    const nu = (f) => ({ manga_id: f.manga_id, source: f.source, title: f.title, cover: f.cover, category: f.category, added_at: String(f.added_at) });
    assert.deepEqual(apres.map(nu), avant.map(nu), 'titres, couvertures, catégories et dates reviennent');
    const [[ev]] = await pool.query("SELECT COUNT(*) AS n, MAX(origine) AS o FROM events WHERE user_id = ? AND type = 'unfavorite'", [u.id]);
    assert.equal(ev.n, 25);
    assert.match(ev.o, /Chrome\/120 · local/, 'chaque événement dit d’où il vient');
});

test('retrait en lot sans le bon nombre confirmé : rien n’est retiré', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    const u = await compte(3);
    for (const confirmer of [undefined, 2, 4, 0]) {
        const r = rr({ user: u, body: { mangaIds: ['m0', 'm1', 'm2'], confirmer } });
        await User.removeFavoritesBulk(r.req, r.res, echec);
        assert.equal(r.res.statusCode, 400);
        assert.equal(r.res.body.code, 'CONFIRMATION_REQUISE');
    }
    assert.equal((await favoris(u)).length, 3);
});

test('une boucle de retraits à l’unité est freinée (incident du 9 novembre)', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    corbeille._oublierRythmes();
    const u = await compte(60);
    let acceptes = 0, refuses = 0;
    for (let i = 0; i < 60; i++) {
        const r = rr({ user: u, params: { mangaId: 'm' + i } });
        await User.removeFavorite(r.req, r.res, echec);
        if (r.res.statusCode === 429) { refuses++; assert.equal(r.res.body.code, 'SUPPRESSION_EN_RAFALE'); assert.ok(Number(r.res.entetes['Retry-After']) >= 1); }
        else acceptes++;
    }
    assert.equal(acceptes, corbeille.PLAFOND_UNITAIRE, 'au-delà du plafond, plus rien ne part');
    assert.equal(refuses, 60 - corbeille.PLAFOND_UNITAIRE);
    assert.equal((await favoris(u)).length, 60 - corbeille.PLAFOND_UNITAIRE);
});

test('un autre compte ne voit ni ne restaure ma corbeille', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    corbeille._oublierRythmes();
    const moi = await compte(2), autre = await compte(0);
    const r = rr({ user: moi, params: { mangaId: 'm0' } });
    await User.removeFavorite(r.req, r.res, echec);
    const vol = rr({ user: autre, body: { lot: r.res.body.lot } });
    await User.restaurerCorbeille(vol.req, vol.res, echec);
    assert.equal(vol.res.body.restaures, 0);
    assert.equal((await favoris(autre)).length, 0);
    const liste = rr({ user: autre }); await User.getCorbeille(liste.req, liste.res, echec);
    assert.equal(liste.res.body.lots.length, 0);
});

test('restaurer ne remplace pas un favori revenu entre-temps', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    corbeille._oublierRythmes();
    const u = await compte(1);
    const r = rr({ user: u, params: { mangaId: 'm0' } });
    await User.removeFavorite(r.req, r.res, echec);
    await pool.query("INSERT INTO favorites (user_id, manga_id, title) VALUES (?, 'm0', 'ajouté depuis')", [u.id]);
    const back = rr({ user: u, body: { lot: r.res.body.lot } });
    await User.restaurerCorbeille(back.req, back.res, echec);
    assert.equal(back.res.body.dejaPresents, 1);
    assert.equal((await favoris(u))[0].title, 'ajouté depuis');
});

test('la corbeille oublie ce qui a plus de 30 jours', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    corbeille._oublierRythmes();
    const u = await compte(2);
    for (const id of ['m0', 'm1']) { const r = rr({ user: u, params: { mangaId: id } }); await User.removeFavorite(r.req, r.res, echec); }
    await pool.query("UPDATE favorites_corbeille SET supprime_le = NOW() - INTERVAL 31 DAY WHERE user_id = ? AND manga_id = 'm0'", [u.id]);
    assert.ok((await corbeille.purger(pool)) >= 1);
    const [reste] = await pool.query('SELECT manga_id FROM favorites_corbeille WHERE user_id = ?', [u.id]);
    assert.deepEqual(reste.map(x => x.manga_id), ['m1']);
});

test('import abîmé : 400 avec le champ en cause, jamais 500 (audit API-01)', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    const u = await compte(0);
    for (const [corps, champ] of [[{ favorites: 'pas un tableau', progress: 42 }, 'favorites'], [{ progress: 42 }, 'progress'], [{ settings: [1] }, 'settings']]) {
        const r = rr({ user: u, body: corps });
        await User.importData(r.req, r.res, echec);
        assert.equal(r.res.statusCode, 400, JSON.stringify(corps));
        assert.equal(r.res.body.champ, champ);
    }
    const ok = rr({ user: u, body: { favorites: [null, { mangaId: 'z1', title: 'Z', cover: 'javascript:alert(1)' }] } });
    await User.importData(ok.req, ok.res, echec);
    assert.equal(ok.res.statusCode, 200, JSON.stringify(ok.res.body));
    const f = await favoris(u);
    assert.equal(f.length, 1, 'une entrée vide est ignorée, la bonne passe');
    assert.equal(f[0].cover, null, 'une adresse javascript: n’est jamais conservée');
});
