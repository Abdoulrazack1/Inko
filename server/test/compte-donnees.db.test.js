// test/compte-donnees.db.test.js — DAT-15 / DAT-16 : un compte exporté puis
// réimporté (ou sauvegardé puis restauré) revient À L'IDENTIQUE.
// Base MySQL jetable `inko_test_compte` ; sautés si MySQL est injoignable.
process.env.DB_NAME = 'inko_test_compte';
process.env.NODE_ENV = 'test';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

let pool, C, disponible = false, uid;

before(async () => {
    try {
        const mysql = require('mysql2/promise');
        const admin = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1', port: parseInt(process.env.DB_PORT || '3306', 10),
            user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '',
            multipleStatements: true, connectTimeout: 2500,
        });
        await admin.query('DROP DATABASE IF EXISTS inko_test_compte');
        await admin.query('CREATE DATABASE inko_test_compte CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        await admin.query('USE inko_test_compte');
        await admin.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
        await admin.end();
        ({ pool } = require('../config/db'));
        await require('../db/migrate').ensureSchema();
        C = require('../lib/compte-donnees');
        const [r] = await pool.query("INSERT INTO users (username, email, password_hash) VALUES ('Lectrice', 'l@exemple.test', 'x')");
        uid = r.insertId;
        const q = (sql, p) => pool.query(sql, p);
        await q("INSERT INTO favorites (user_id, manga_id, source, title, category, status, notify, added_at) VALUES (?, 'o-1', 'mangadex', 'Œuvre', 'À relire', 'paused', 0, '2024-03-01 10:00:00')", [uid]);
        await q("INSERT INTO progress (user_id, manga_id, chapter_id, chapter_number, page, total_pages, source) VALUES (?, 'o-1', 'c3', 3, 7, 30, 'mangadex')", [uid]);
        await q("INSERT INTO read_chapters (user_id, manga_id, chapter_id, chapter_number) VALUES (?, 'o-1', 'c1', 1), (?, 'o-1', 'c2', 2)", [uid, uid]);
        await q("INSERT INTO ratings (user_id, manga_id, rating, review) VALUES (?, 'o-1', 8, 'Bien')", [uid]);
        await q("INSERT INTO bookmarks (user_id, manga_id, chapter_id, source, page, label, note) VALUES (?, 'o-1', 'c2', 'mangadex', 4, 'L', 'La phrase')", [uid]);
        await q("INSERT INTO reading_notes (user_id, manga_id, body, chapter_id) VALUES (?, 'o-1', 'Note de carnet', 'c1')", [uid]);
        await q("INSERT INTO anilist_links (user_id, title_key, anilist_id, exact) VALUES (?, 'oeuvre', 30002, 1)", [uid]);
        await q("INSERT INTO reading_time (user_id, day, seconds) VALUES (?, '2026-11-20', 600)", [uid]);
        await q("INSERT INTO progress_history (user_id, manga_id, chapter_id, chapter_number, page) VALUES (?, 'o-1', 'c2', 2, 1)", [uid]);
        await q("INSERT INTO events (user_id, type, manga_id, metadata) VALUES (?, 'read', 'o-1', '{\"chapter\": 2}')", [uid]);
        await q("INSERT INTO user_settings (user_id, data) VALUES (?, '{\"reader\": {\"bg\": \"sepia\"}}')", [uid]);
        const [l] = await q("INSERT INTO lists (user_id, name, description, is_public) VALUES (?, 'Ma liste', 'd', 1)", [uid]);
        await q("INSERT INTO list_items (list_id, manga_id, source, title, position) VALUES (?, 'o-1', 'mangadex', 'Œuvre', 0)", [l.insertId]);
        disponible = true;
    } catch (e) {
        console.log('  (MySQL injoignable — tests de compte sautés :', e.code || e.message, ')');
    }
});

after(async () => {
    if (!pool) return;
    try { await pool.query('DROP DATABASE IF EXISTS inko_test_compte'); } catch (e) { /* déjà fermée */ }
    await pool.end().catch(() => {});
});

const tablesComptees = ['favorites', 'progress', 'read_chapters', 'ratings', 'bookmarks', 'reading_notes', 'anilist_links', 'reading_time', 'progress_history', 'events', 'user_settings', 'lists'];
async function compter() {
    const o = {};
    for (const t of tablesComptees) o[t] = (await pool.query(`SELECT COUNT(*) AS n FROM \`${t}\` WHERE user_id = ?`, [uid]))[0][0].n;
    o.list_items = (await pool.query('SELECT COUNT(*) AS n FROM list_items WHERE list_id IN (SELECT id FROM lists WHERE user_id = ?)', [uid]))[0][0].n;
    return o;
}

test('un compte vidé puis réimporté revient à l’identique, réglages et dates compris', async (t) => {
    if (!disponible) return t.skip('MySQL injoignable');
    const avant = await compter();
    const photo = JSON.parse(JSON.stringify(await C.exporter(uid)));     // comme un vrai fichier
    await pool.query('DELETE FROM list_items WHERE list_id IN (SELECT id FROM lists WHERE user_id = ?)', [uid]);
    for (const tbl of tablesComptees) await pool.query(`DELETE FROM \`${tbl}\` WHERE user_id = ?`, [uid]);
    await C.importer(uid, photo);
    assert.deepStrictEqual(await compter(), avant, 'aucune table ne doit revenir incomplète');
    const [[f]] = await pool.query("SELECT category, status, notify, added_at FROM favorites WHERE user_id = ? AND manga_id = 'o-1'", [uid]);
    assert.equal(f.category, 'À relire'); assert.equal(f.status, 'paused'); assert.equal(f.notify, 0);
    assert.equal(new Date(f.added_at).getFullYear(), 2024, 'la date d’ajout ne doit pas être remise à zéro');
    const [[b]] = await pool.query('SELECT note FROM bookmarks WHERE user_id = ?', [uid]);
    assert.equal(b.note, 'La phrase');
    const [[s]] = await pool.query('SELECT data FROM user_settings WHERE user_id = ?', [uid]);
    assert.equal((typeof s.data === 'string' ? JSON.parse(s.data) : s.data).reader.bg, 'sepia');
});

test('réimporter deux fois le même fichier ne double rien', async (t) => {
    if (!disponible) return t.skip('MySQL injoignable');
    const avant = await compter();
    const photo = JSON.parse(JSON.stringify(await C.exporter(uid)));
    await C.importer(uid, photo);
    await C.importer(uid, photo);
    assert.deepStrictEqual(await compter(), avant);
});

test('ce qui reste attaché à l’installation ne voyage pas', () => {
    for (const t of ['sessions', 'password_resets', 'devices', 'pair_codes']) assert.ok(C.EXCLUES.has(t), t);
});
