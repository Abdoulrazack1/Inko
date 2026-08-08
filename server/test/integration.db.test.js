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
        // schema.sql ne choisit plus la base : il portait `CREATE DATABASE inko;
        // USE inko;` en dur, et ce test le réécrivait au vol pour le détourner
        // vers `inko_test`. Deux remplacements de chaîne qui devaient rester
        // synchronisés avec un fichier SQL — c'est ce couplage qui a cassé le
        // jour où ces lignes ont disparu. La base est désormais créée et
        // sélectionnée ici, comme le fait db/init.js en vrai.
        await admin.query('CREATE DATABASE inko_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        await admin.query('USE inko_test');
        await admin.query(fs.readFileSync(path.join(__dirname, '..', 'db', 'schema.sql'), 'utf8'));
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
        // Audit DB-04 : 9 est hors barème. Avant, l'import l'écrivait tel quel ;
        // depuis la contrainte CHECK en base, la ligne serait rejetée EN SILENCE
        // et la note perdue. L'import borne donc la valeur.
        // Audit AMEL-47 : ce fichier ne porte pas `ratingScale`, il vient donc
        // d'avant la bascule — ses notes sont lues sur 5 et doublées. 9 double
        // à 18, hors barème dans les deux échelles : la borne haute vaut 10.
        ratings: [{ manga_id: 'a', rating: 9, review: 'excellent' }],
    } });
    await User.importData(req, res, nextThrow);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.imported.favorites, 3);      // l'entrée sans id est ignorée
    assert.equal(res.body.imported.progress, 2);
    assert.equal(res.body.imported.readChapters, 1);
    assert.equal(res.body.imported.ratings, 1);

    // La note hors barème doit être ramenée dans les bornes, pas perdue
    const [[rated]] = await pool.query(
        'SELECT rating FROM ratings WHERE user_id = ? AND manga_id = ?', [u.id, 'a']);
    assert.equal(rated.rating, 10, 'la note hors barème doit être bornée, pas rejetée');

    const favs = rr({ user: u });
    await User.getFavorites(favs.req, favs.res, nextThrow);
    assert.equal(favs.res.body.length, 3);
});

// ── Commentaires : portée (audit AMEL-50) ────────────────────
// La promesse « ton avis reste privé » était fausse : /comments/:mangaId
// servait tout le monde, y compris un visiteur non connecté. Le filtre est
// désormais en SQL — ces tests exercent les trois points de vue.
test('user.getComments : le privé ne sort pas, l\'anonyme ne voit que le public (audit AMEL-50)', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    const alice = await createUser('vis_alice', 'vis_alice@test.local');
    const bob   = await createUser('vis_bob', 'vis_bob@test.local');
    const M = 'oeuvre-portees';

    for (const [texte, portee] of [['prive', 'private'], ['membres', 'instance'], ['ouvert', 'public']]) {
        const { req, res } = rr({ user: alice, params: { mangaId: M }, body: { text: texte, visibility: portee } });
        await User.addComment(req, res, nextThrow);
        assert.equal(res.statusCode, 200, `publication ${portee}`);
    }

    const vus = async (user) => {
        const { req, res } = rr({ user, params: { mangaId: M }, query: {} });
        await User.getComments(req, res, nextThrow);
        return res.body.items.map(c => c.text).sort();
    };
    assert.deepEqual(await vus(alice), ['membres', 'ouvert', 'prive'], 'son auteur voit ses trois portées');
    assert.deepEqual(await vus(bob),   ['membres', 'ouvert'], 'un autre membre ne voit pas le privé');
    assert.deepEqual(await vus(null),  ['ouvert'], 'un anonyme ne voit que le public');

    // `total` doit suivre le même filtre, sinon la pagination annonce des
    // commentaires que l'appelant ne recevra jamais.
    const { req, res } = rr({ params: { mangaId: M }, query: {} });
    await User.getComments(req, res, nextThrow);
    assert.equal(res.body.total, 1, 'le total est celui du point de vue, pas celui de la table');
});

test('user.addComment : portée invalide refusée, réponse ramenée à celle du parent (audit AMEL-50)', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    const u = await createUser('vis_clamp', 'vis_clamp@test.local');
    const M = 'oeuvre-clamp';

    const bad = rr({ user: u, params: { mangaId: M }, body: { text: 'x', visibility: 'monde-entier' } });
    await User.addComment(bad.req, bad.res, nextThrow);
    assert.equal(bad.res.statusCode, 400, 'une portée inconnue ne doit pas retomber sur le défaut ouvert');

    const parent = rr({ user: u, params: { mangaId: M }, body: { text: 'racine privee', visibility: 'private' } });
    await User.addComment(parent.req, parent.res, nextThrow);
    const rep = rr({ user: u, params: { mangaId: M },
        body: { text: 'reponse', parentId: parent.res.body.id, visibility: 'public' } });
    await User.addComment(rep.req, rep.res, nextThrow);

    const [[row]] = await pool.query('SELECT visibility FROM comments WHERE id = ?', [rep.res.body.id]);
    assert.equal(row.visibility, 'private',
        'une réponse ne peut pas être plus visible que ce qu\'elle cite');
});

test('user.addComment : spoiler et ancrage chapitre persistés et filtrables (audit AMEL-51/52)', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    const u = await createUser('vis_chap', 'vis_chap@test.local');
    const M = 'oeuvre-ancrage';

    const a = rr({ user: u, params: { mangaId: M }, body: { text: 'sur le ch. 3', chapterId: 'ch3', spoiler: true } });
    await User.addComment(a.req, a.res, nextThrow);
    const b = rr({ user: u, params: { mangaId: M }, body: { text: 'sur toute la serie' } });
    await User.addComment(b.req, b.res, nextThrow);

    const tout = rr({ user: u, params: { mangaId: M }, query: {} });
    await User.getComments(tout.req, tout.res, nextThrow);
    assert.equal(tout.res.body.items.length, 2);
    const ancre = tout.res.body.items.find(c => c.chapterId === 'ch3');
    assert.equal(ancre.spoiler, true, 'le marqueur de spoiler revient au client');

    const filtre = rr({ user: u, params: { mangaId: M }, query: { chapterId: 'ch3' } });
    await User.getComments(filtre.req, filtre.res, nextThrow);
    assert.deepEqual(filtre.res.body.items.map(c => c.text), ['sur le ch. 3']);
    assert.equal(filtre.res.body.total, 1, 'le total suit le filtre de chapitre');
});

// ── Notes : aller-retour export/import (audit AMEL-47) ───────
test('export/import : l\'échelle des notes survit à l\'aller-retour (audit AMEL-47)', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    const u = await createUser('scale_u', 'scale_u@test.local');
    await pool.query('INSERT INTO ratings (user_id, manga_id, rating) VALUES (?, ?, ?)', [u.id, 'x', 9]);

    const exp = rr({ user: u });
    await User.exportData(exp.req, exp.res, nextThrow);
    assert.equal(exp.res.body.ratingScale, 10, 'l\'export annonce son échelle');
    assert.equal(exp.res.body.ratings.find(r => r.manga_id === 'x').rating, 9);

    // Réimport dans un compte neuf : la note doit rester 9, pas retomber à 5.
    const v = await createUser('scale_v', 'scale_v@test.local');
    const imp = rr({ user: v, body: exp.res.body });
    await User.importData(imp.req, imp.res, nextThrow);
    const [[apres]] = await pool.query('SELECT rating FROM ratings WHERE user_id = ? AND manga_id = ?', [v.id, 'x']);
    assert.equal(apres.rating, 9, 'réimporter sa sauvegarde ne doit pas diviser ses notes par deux');

    // Fichier d'AVANT la bascule (pas de ratingScale) : notes sur 5, doublées.
    const w = await createUser('scale_w', 'scale_w@test.local');
    const vieux = rr({ user: w, body: { ratings: [{ manga_id: 'y', rating: 4 }] } });
    await User.importData(vieux.req, vieux.res, nextThrow);
    const [[conv]] = await pool.query('SELECT rating FROM ratings WHERE user_id = ? AND manga_id = ?', [w.id, 'y']);
    assert.equal(conv.rating, 8, 'un ancien fichier /5 est converti, comme l\'a fait la migration 12');
});

// ── Notifications (audit AMEL-53/54/55/56) ───────────────────
test('createNotification : regroupe par œuvre au lieu d\'empiler (audit AMEL-53)', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    const { createNotification } = require('../lib/notify');
    const u = await createUser('notif_group', 'notif_group@test.local');

    for (const n of [12, 13, 14]) {
        await createNotification(u.id, {
            type: 'new_chapter', title: 'Nouveau chapitre',
            body: `Blue Lock · Chap. ${n}`, link: `/chapitre.html?manga=blue-lock&chapter=c${n}`,
            groupKey: 'blue-lock',
        });
    }
    const [lignes] = await pool.query(
        'SELECT title, body, group_count FROM notifications WHERE user_id = ? AND type = ?',
        [u.id, 'new_chapter']);
    assert.equal(lignes.length, 1, 'trois parutions d\'une même série tiennent sur une ligne');
    assert.equal(lignes[0].group_count, 3, 'le compte dit combien de parutions sont recouvertes');

    // Une série différente ne doit PAS être absorbée
    await createNotification(u.id, {
        type: 'new_chapter', title: 'Nouveau chapitre', body: 'Autre · Chap. 1',
        link: '/chapitre.html?manga=autre&chapter=c1', groupKey: 'autre',
    });
    const [apres] = await pool.query(
        'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ?', [u.id]);
    assert.equal(apres[0].n, 2, 'chaque série a sa propre ligne');

    // Une notification LUE n'est jamais réécrite : la rouvrir en la modifiant
    // ferait disparaître ce que l'utilisateur a consciemment traité.
    await pool.query('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND group_key = ?', [u.id, 'blue-lock']);
    await createNotification(u.id, {
        type: 'new_chapter', title: 'Nouveau chapitre', body: 'Blue Lock · Chap. 15',
        link: '/chapitre.html?manga=blue-lock&chapter=c15', groupKey: 'blue-lock',
    });
    const [[bl]] = await pool.query(
        'SELECT COUNT(*) AS n FROM notifications WHERE user_id = ? AND group_key = ?', [u.id, 'blue-lock']);
    assert.equal(bl.n, 2, 'une notification déjà lue n\'est pas ressuscitée, une nouvelle est créée');
});

test('purgerNotificationsLues : efface les lues de plus de 30 j, garde les non lues (audit AMEL-56)', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    const { purgerNotificationsLues } = require('../lib/notify');
    const u = await createUser('notif_purge', 'notif_purge@test.local');

    await pool.query(
        `INSERT INTO notifications (user_id, type, title, is_read, created_at) VALUES
         (?, 'new_chapter', 'vieille lue',     1, NOW() - INTERVAL 40 DAY),
         (?, 'new_chapter', 'vieille non lue', 0, NOW() - INTERVAL 40 DAY),
         (?, 'new_chapter', 'recente lue',     1, NOW() - INTERVAL 3 DAY)`,
        [u.id, u.id, u.id]);

    await purgerNotificationsLues(30);
    const [restantes] = await pool.query(
        'SELECT title FROM notifications WHERE user_id = ? ORDER BY title', [u.id]);
    assert.deepEqual(restantes.map(r => r.title), ['recente lue', 'vieille non lue'],
        'une notification non lue survit quel que soit son âge');
});

test('notif prefs : fréquence bornée, sourdine par série sans perdre le suivi (audit AMEL-54)', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    const Notif = require('../controllers/notif.controller');
    const u = await createUser('notif_prefs', 'notif_prefs@test.local');
    await pool.query('INSERT INTO favorites (user_id, manga_id, title) VALUES (?, ?, ?), (?, ?, ?)',
        [u.id, 'aaa', 'A', u.id, 'bbb', 'B']);

    const bad = rr({ user: u, body: { everyHours: 7 } });
    await Notif.setPrefs(bad.req, bad.res, nextThrow);
    assert.equal(bad.res.statusCode, 400, 'une fréquence hors liste est refusée');

    const ok = rr({ user: u, body: { everyHours: 24 } });
    await Notif.setPrefs(ok.req, ok.res, nextThrow);
    assert.equal(ok.res.body.everyHours, 24);

    // Sourdine sur une série : le favori reste, seule l'alerte tombe
    const mute = rr({ user: u, params: { mangaId: 'aaa' }, body: { notify: false } });
    await Notif.setWatch(mute.req, mute.res, nextThrow);
    assert.equal(mute.res.body.notify, false);

    const prefs = rr({ user: u });
    await Notif.getPrefs(prefs.req, prefs.res, nextThrow);
    assert.equal(prefs.res.body.everyHours, 24);
    assert.equal(prefs.res.body.followed, 2, 'la série reste suivie');
    assert.equal(prefs.res.body.watched, 1, 'une seule est encore surveillée');

    // Une série absente de la bibliothèque ne se met pas en sourdine
    const absente = rr({ user: u, params: { mangaId: 'zzz' }, body: { notify: false } });
    await Notif.setWatch(absente.req, absente.res, nextThrow);
    assert.equal(absente.res.statusCode, 404);
});

test('scanUserUpdates : « Lire maintenant » vise le premier NON LU, pas le dernier paru (audit AMEL-55)', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    const loader = require('../extensions/loader');
    const updates = require('../lib/updates');
    const u = await createUser('notif_resume', 'notif_resume@test.local');

    await pool.query(
        'INSERT INTO favorites (user_id, manga_id, source, title, last_chapter) VALUES (?, ?, ?, ?, ?)',
        [u.id, 'serie-x', 'faux', 'Serie X', 10]);
    // Chapitres 10 à 13 ; 10 et 12 déjà lus. Le premier non lu est le 11.
    await pool.query(
        'INSERT INTO read_chapters (user_id, manga_id, chapter_id, chapter_number) VALUES (?,?,?,?), (?,?,?,?)',
        [u.id, 'serie-x', 'c10', 10, u.id, 'serie-x', 'c12', 12]);

    // Source factice : le scan ne doit pas dépendre d'un site réel.
    const vrai = loader.get;
    loader.get = (id) => (id === 'faux' ? {
        getChapters: async () => ({ results: [
            { id: 'c13', chapter: 13 }, { id: 'c12', chapter: 12 },
            { id: 'c11', chapter: 11 }, { id: 'c10', chapter: 10 },
        ] }),
    } : vrai(id));
    try {
        const r = await updates.scanUserUpdates(u.id, { scope: 'all' });
        const s = r.updates.find(x => x.mangaId === 'serie-x');
        assert.equal(s.latest.chapter, 13, 'le dernier paru reste exposé');
        assert.equal(s.resume.chapter, 11,
            'on reprend au premier non lu — viser le 13 ferait sauter le 11');
        assert.equal(s.unreadCount, 2);
    } finally { loader.get = vrai; }
});

test('scanUserUpdates : notifyOnly écarte les séries en sourdine, pas le scan manuel (audit AMEL-54)', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    const loader = require('../extensions/loader');
    const updates = require('../lib/updates');
    const u = await createUser('notif_only', 'notif_only@test.local');
    await pool.query(
        `INSERT INTO favorites (user_id, manga_id, source, title, notify) VALUES (?,?,?,?,1), (?,?,?,?,0)`,
        [u.id, 'suivie', 'faux2', 'Suivie', u.id, 'muette', 'faux2', 'Muette']);

    const vrai = loader.get;
    loader.get = (id) => (id === 'faux2' ? {
        getChapters: async () => ({ results: [{ id: 'c1', chapter: 1 }] }),
    } : vrai(id));
    try {
        const tout = await updates.scanUserUpdates(u.id, { scope: 'all' });
        assert.equal(tout.updates.length, 2, 'le bouton « Mettre à jour » vérifie tout');
        const alerte = await updates.scanUserUpdates(u.id, { scope: 'all', notifyOnly: true });
        assert.deepEqual(alerte.updates.map(x => x.mangaId), ['suivie'],
            'la tâche de fond ignore ce qui est en sourdine');
    } finally { loader.get = vrai; }
});

// ── Profil public : confidentialité par section (audit AMEL-61/62/63) ──
test('publicProfile : chaque section a son réglage, privateProfile prime (audit AMEL-61)', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    const u = await createUser('prof_a', 'prof_a@test.local');
    const autre = await createUser('prof_b', 'prof_b@test.local');
    await pool.query('INSERT INTO read_chapters (user_id, manga_id, chapter_id, chapter_number) VALUES (?,?,?,?)',
        [u.id, 'm1', 'c1', 1]);
    await pool.query('INSERT INTO favorites (user_id, manga_id, title, status) VALUES (?,?,?,?)',
        [u.id, 'm1', 'Serie Un', 'reading']);
    await pool.query('INSERT INTO lists (user_id, name, is_public) VALUES (?,?,1)', [u.id, 'Ma liste']);

    const vu = async (viewer, query = {}) => {
        const { req, res } = rr({ user: viewer, params: { username: 'prof_a' }, query });
        await Profile.publicProfile(req, res, nextThrow);
        return res.body;
    };

    // Par défaut : stats et listes visibles (comportement d'avant), pas la
    // bibliothèque — une amélioration ne doit rien publier rétroactivement.
    let p = await vu(autre);
    assert.ok(p.stats, 'les stats restent publiques par défaut');
    assert.equal(p.lists.length, 1, 'les listes publiques restent visibles');
    assert.equal(p.library, null, 'la bibliothèque n\'est PAS exposée par défaut');

    // Masquer les stats seules laisse les listes
    await pool.query(
        `INSERT INTO user_settings (user_id, data) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE data = VALUES(data)`,
        [u.id, JSON.stringify({ privacy: { showStats: false, showLibrary: true } })]);
    p = await vu(autre);
    assert.equal(p.stats, null, 'stats masquées');
    assert.deepEqual(p.badges, [], 'les badges suivent les stats : ils en sont dérivés');
    assert.equal(p.lists.length, 1, 'les listes ne sont pas emportées par le masquage des stats');
    assert.equal(p.library.length, 1, 'la bibliothèque est exposée quand on l\'a demandé');

    // privateProfile prime sur tout
    await pool.query('UPDATE user_settings SET data = ? WHERE user_id = ?',
        [JSON.stringify({ privacy: { privateProfile: true, showStats: true, showLibrary: true } }), u.id]);
    p = await vu(autre);
    assert.equal(p.hidden, true);
    assert.equal(p.stats, null);
    assert.equal(p.library, undefined, 'rien d\'autre que le pseudo ne sort d\'un profil privé');
});

test('publicProfile : ?as=public montre au propriétaire ce que voit un inconnu (audit AMEL-62)', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    const u = await createUser('prof_c', 'prof_c@test.local');
    await pool.query(
        `INSERT INTO user_settings (user_id, data) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE data = VALUES(data)`,
        [u.id, JSON.stringify({ privacy: { privateProfile: true } })]);

    const propre = rr({ user: u, params: { username: 'prof_c' }, query: {} });
    await Profile.publicProfile(propre.req, propre.res, nextThrow);
    assert.equal(propre.res.body.isOwner, true);
    assert.ok(!propre.res.body.hidden, 'le propriétaire voit son profil complet');

    const apercu = rr({ user: u, params: { username: 'prof_c' }, query: { as: 'public' } });
    await Profile.publicProfile(apercu.req, apercu.res, nextThrow);
    assert.equal(apercu.res.body.isOwner, false);
    assert.equal(apercu.res.body.hidden, true,
        'en aperçu, le propriétaire reçoit exactement ce que reçoit un inconnu');
});

test('publicProfile : la vitrine garde l\'ordre choisi et ignore les œuvres retirées (audit AMEL-63)', async (t) => {
    if (!available) return t.skip('MySQL indisponible');
    const u = await createUser('prof_d', 'prof_d@test.local');
    const autre = await createUser('prof_e', 'prof_e@test.local');
    await pool.query(
        'INSERT INTO favorites (user_id, manga_id, source, title) VALUES (?,?,?,?), (?,?,?,?)',
        [u.id, 'aa', 'src', 'Serie AA', u.id, 'bb', 'src', 'Serie BB']);
    // 'zz' n'est plus en bibliothèque : une épingle morte ne doit pas produire
    // une case vide sur le profil.
    await pool.query(
        `INSERT INTO user_settings (user_id, data) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE data = VALUES(data)`,
        // Emplacement REEL ecrit par UserData : settings.userdata.pins. Le
        // premier jet de ce test ecrivait a la racine — il passait au vert
        // pendant que la vitrine restait vide dans le navigateur.
        // Format REEL ecrit par UserData.keyOf : `<source>:<mangaId>`. Mes deux
        // premiers jets de ce test ont invente l'emplacement PUIS le format —
        // verts tous les deux, pendant que la vitrine restait vide a l'ecran.
        [u.id, JSON.stringify({ userdata: { pins: ['src:bb', 'src:zz', 'src:aa'] } })]);

    const { req, res } = rr({ user: autre, params: { username: 'prof_d' }, query: {} });
    await Profile.publicProfile(req, res, nextThrow);
    assert.deepEqual(res.body.pins.map(p => p.mangaId), ['bb', 'aa'],
        'ordre de l\'utilisateur respecté, épingle morte écartée');

    // Section désactivée : plus de vitrine du tout
    await pool.query('UPDATE user_settings SET data = ? WHERE user_id = ?',
        [JSON.stringify({ userdata: { pins: ['src:bb'] }, privacy: { showPins: false } }), u.id]);
    const off = rr({ user: autre, params: { username: 'prof_d' }, query: {} });
    await Profile.publicProfile(off.req, off.res, nextThrow);
    assert.deepEqual(off.res.body.pins, []);
});
