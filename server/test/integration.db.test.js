// test/integration.db.test.js — tests d'intégration des contrôleurs (audit §4)
// ------------------------------------------------------------
// Exerce les contrôleurs les plus manipulés (auth, user, notes, profile)
// contre une base MySQL RÉELLE mais jetable (`inko_test`, recréée à chaque
// exécution). Si MySQL est injoignable (CI sans service DB), les tests
// sont sautés proprement — la suite unitaire reste verte partout.
// node --test lance ce fichier dans son propre process : DB_NAME est posé
// AVANT tout require de config/db (le pool lit l'env au require).
process.env.DB_NAME = 'inko_test';
process.env.NODE_ENV = 'test';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

let available = false;
let pool, Auth, User, Notes, Profile;

// Fabrique de req/res Express minimaux
function rr({ body = {}, params = {}, query = {}, user = null } = {}) {
    const req = { body, params, query, user, cookies: {}, headers: {} };
    const res = {
        statusCode: 200, body: null,
        status(c) { this.statusCode = c; return this; },
        json(o)   { this.body = o; return this; },
        cookie()  { return this; },
        clearCookie() { return this; },
    };
    return { req, res };
}
const nextThrow = (e) => { if (e) throw e; };

before(async () => {
    try {
        const mysql = require('mysql2/promise');
        const admin = await mysql.createConnection({
            host: process.env.DB_HOST || '127.0.0.1',
            port: parseInt(process.env.DB_PORT || '3306', 10),
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            multipleStatements: true,
            connectTimeout: 2500,
        });
        await admin.query('DROP DATABASE IF EXISTS inko_test');
        // Schéma officiel, redirigé vers la base jetable
        const schema = fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8')
            .replace('CREATE DATABASE IF NOT EXISTS inko', 'CREATE DATABASE IF NOT EXISTS inko_test')
            .replace('USE inko;', 'USE inko_test;');
        await admin.query(schema);
        await admin.end();

        ({ pool } = require('../config/db'));
        await require('../db/migrate').ensureSchema();   // migrations versionnées (audit §4)
        Auth    = require('../controllers/auth.controller');
        User    = require('../controllers/user.controller');
        Notes   = require('../controllers/notes.controller');
        Profile = require('../controllers/profile.controller');
        available = true;
    } catch (e) {
        // Audit QUAL-01 : ces suites étaient « vertes par abstention » — elles
        // se sautaient en silence et la CI ne déclarait aucun service MySQL,
        // donc elles n'ont jamais tourné. En CI (REQUIRE_DB_TESTS=1) une base
        // injoignable est désormais un ÉCHEC, pas un saut : sans cela, la
        // régression peut revenir sans que rien ne l'indique.
        if (process.env.REQUIRE_DB_TESTS === '1') {
            throw new Error(
                'MySQL est requis pour les tests d\'intégration (REQUIRE_DB_TESTS=1) : ' + e.message);
        }
        console.warn('[integration] MySQL indisponible — tests sautés :', e.message);
    }
});

after(async () => {
    if (pool) { try { await pool.end(); } catch (e) { /* déjà fermée */ } }
});

// Petit helper : crée un compte et renvoie l'objet user
async function createUser(username, email) {
    const { req, res } = rr({ body: { username, email, password: 'motdepasse1' } });
    await Auth.register(req, res, nextThrow);
    assert.equal(res.statusCode, 200, JSON.stringify(res.body));
    return res.body.user;
}

test('auth.register : crée un compte et rejette les doublons d\'email', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    const u = await createUser('Kaito Test', 'kaito@test.local');
    assert.ok(u.id > 0);
    assert.equal(u.username, 'Kaito Test');

    const { req, res } = rr({ body: { username: 'Autre', email: 'kaito@test.local', password: 'motdepasse1' } });
    await Auth.register(req, res, nextThrow);
    assert.equal(res.statusCode, 409);
});

test('auth.register : rejette un pseudo à caractères dangereux (audit S3)', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    const { req, res } = rr({ body: { username: '</textarea><img src=x>', email: 'xss@test.local', password: 'motdepasse1' } });
    await Auth.register(req, res, nextThrow);
    assert.equal(res.statusCode, 400);
    assert.match(res.body.error, /invalide/i);
});

test('auth.login : accepte le bon mot de passe, refuse le mauvais', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    const ok = rr({ body: { email: 'kaito@test.local', password: 'motdepasse1' } });
    await Auth.login(ok.req, ok.res, nextThrow);
    assert.equal(ok.res.statusCode, 200);
    assert.ok(ok.res.body.token);

    const ko = rr({ body: { email: 'kaito@test.local', password: 'mauvais' } });
    await Auth.login(ko.req, ko.res, nextThrow);
    assert.equal(ko.res.statusCode, 401);
});

test('user.setProgress : persiste et restitue totalPages (audit HIST2)', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    const u = await createUser('Lecteur P', 'prog@test.local');
    const set = rr({ user: u, params: { mangaId: 'serie-x' },
                     body: { chapterId: 'ch-12', chapter: 12, page: 7, totalPages: 35, source: 'weebcentral' } });
    await User.setProgress(set.req, set.res, nextThrow);
    assert.equal(set.res.statusCode, 200);

    const get = rr({ user: u });
    await User.getAllProgress(get.req, get.res, nextThrow);
    const p = get.res.body['serie-x'];
    assert.equal(p.page, 7);
    assert.equal(p.totalPages, 35);
    assert.equal(Number(p.chapter), 12);
});

test('notes.updateNote : mood null EFFACE l\'humeur (audit B1)', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    const u = await createUser('Noteur', 'notes@test.local');
    const c = rr({ user: u, body: { mangaId: 'serie-n', body: 'très bon chapitre', mood: 'love' } });
    await Notes.createNote(c.req, c.res, nextThrow);
    assert.equal(c.res.body.note.mood, 'love');
    const id = c.res.body.note.id;

    const up = rr({ user: u, params: { id }, body: { body: 'très bon chapitre', mood: null } });
    await Notes.updateNote(up.req, up.res, nextThrow);
    assert.equal(up.res.statusCode, 200);
    assert.equal(up.res.body.note.mood, null);   // avant le fix : restait 'love'

    // mood absent du payload → inchangée
    const up2 = rr({ user: u, params: { id }, body: { body: 'édité', mood: 'wow' } });
    await Notes.updateNote(up2.req, up2.res, nextThrow);
    assert.equal(up2.res.body.note.mood, 'wow');
    const up3 = rr({ user: u, params: { id }, body: { body: 'ré-édité' } });
    await Notes.updateNote(up3.req, up3.res, nextThrow);
    assert.equal(up3.res.body.note.mood, 'wow');
});

test('profile.publicProfile : le profil privé ne fuit plus avatar/bio/date (audit B2)', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    const u = await createUser('Discret', 'prive@test.local');
    await pool.query('UPDATE users SET bio = ?, avatar = ? WHERE id = ?', ['ma bio perso', 'D', u.id]);
    await pool.query(
        'INSERT INTO user_settings (user_id, data) VALUES (?, CAST(? AS JSON))',
        [u.id, JSON.stringify({ privacy: { privateProfile: true } })]
    );
    const { req, res } = rr({ params: { username: 'Discret' } });   // visiteur anonyme
    await Profile.publicProfile(req, res, nextThrow);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.hidden, true);
    assert.equal(res.body.avatar, null);
    assert.equal(res.body.bio, null);
    assert.equal(res.body.memberSince, null);
    assert.equal(res.body.stats, null);
});

test('user.importData : import batché, compteurs corrects (audit B3)', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    const u = await createUser('Importeur', 'import@test.local');
    const { req, res } = rr({ user: u, body: {
        favorites: [
            { manga_id: 'a', title: 'A', source: 'weebcentral' },
            { manga_id: 'b', title: 'B' },
            { mangaId: 'c', title: 'C' },
            { title: 'sans id — ignoré' },
        ],
        progress: [
            { manga_id: 'a', chapter_id: 'ch1', chapter_number: 1, page: 3 },
            { mangaId: 'b', chapterId: 'ch9', chapter: 9.5, page: 12 },
        ],
        readChapters: [
            { manga_id: 'a', chapter_id: 'ch1', chapter_number: 1 },
        ],
        ratings: [{ manga_id: 'a', rating: 9, review: 'excellent' }],
    } });
    await User.importData(req, res, nextThrow);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.imported.favorites, 3);      // l'entrée sans id est ignorée
    assert.equal(res.body.imported.progress, 2);
    assert.equal(res.body.imported.readChapters, 1);
    assert.equal(res.body.imported.ratings, 1);

    const favs = rr({ user: u });
    await User.getFavorites(favs.req, favs.res, nextThrow);
    assert.equal(favs.res.body.length, 3);
});
