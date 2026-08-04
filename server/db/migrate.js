// ============================================================
// db/migrate.js — Migrations additives idempotentes (au démarrage)
// ------------------------------------------------------------
// Permet aux installations existantes (y compris desktop, où l'on ne
// relance pas `npm run init-db`) d'obtenir les NOUVELLES tables/colonnes
// automatiquement au lancement du serveur. Toutes les opérations sont
// sûres à rejouer (CREATE IF NOT EXISTS, ADD COLUMN gardé par un check).
// Appelé par server.js (après ping MySQL) ET par db/init.js.
// ============================================================
const { pool } = require('../config/db');

// Codes d'erreur « déjà présent » qu'on peut ignorer sans bruit
const IGNORABLE = new Set([
    'ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME', 'ER_FK_DUP_NAME',
    'ER_TABLE_EXISTS_ERROR', 'ER_DUP_ENTRY',
]);

async function run(sql) {
    try { await pool.query(sql); }
    catch (e) {
        if (IGNORABLE.has(e.code)) return;
        if (/duplicate (column|key|foreign key|entry)/i.test(e.message || '')) return;
        console.warn('[migrate] ', e.code || e.message);
    }
}

async function columnExists(table, col) {
    const [[r]] = await pool.query(
        `SELECT COUNT(*) AS n FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
        [table, col]
    );
    return r.n > 0;
}

async function columnType(table, col) {
    const [[r]] = await pool.query(
        `SELECT COLUMN_TYPE AS t FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
        [table, col]
    );
    return r ? String(r.t).toLowerCase() : null;
}

// Convertit une colonne seulement si son type actuel ne correspond pas (idempotent)
async function modifyIf(table, col, wantSubstr, ddlType) {
    const t = await columnType(table, col);
    if (t == null || t.includes(wantSubstr)) return;
    await run(`ALTER TABLE \`${table}\` MODIFY \`${col}\` ${ddlType}`);
}

// ── Audit §4 : historique de migrations versionné ────────────
// Avant, ensureSchema() refaisait ~15 requêtes information_schema à CHAQUE
// démarrage. La table schema_migrations trace ce qui est appliqué : un
// schéma à jour = 1 seule requête au boot, et « quel est le schéma
// appliqué ? » a désormais une réponse directe (SELECT * FROM
// schema_migrations). Chaque nouvelle évolution = une entrée de plus dans
// MIGRATIONS (jamais modifier une migration déjà livrée : en ajouter une).
const MIGRATIONS = [
    { version: 1, name: 'socle-historique (threads, reports, notifications, notes, imports, index, types)', apply: legacySchema },
    { version: 2, name: 'progress.total_pages (audit HIST2)', apply: async () => {
        if (!(await columnExists('progress', 'total_pages'))) {
            await run('ALTER TABLE progress ADD COLUMN total_pages INT DEFAULT NULL');
        }
    } },
    { version: 3, name: 'users.username UNIQUE + dédoublonnage (audit BUG-01)', apply: uniqueUsernames },
    { version: 4, name: 'users.token_version — révocation des JWT (audit SEC-05)', apply: async () => {
        if (!(await columnExists('users', 'token_version'))) {
            await run('ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0');
        }
    } },
];

// ── Migration 3 : unicité des pseudos (audit BUG-01) ──────────
// `users.username` n'avait qu'un INDEX, pas de contrainte UNIQUE, et aucun
// contrôle applicatif. Or profile.controller résout le profil public par
// `WHERE username = ?` : avec deux comptes homonymes, MySQL renvoie celui qu'il
// veut. Constaté en production : « Kaito » ×2 et « Otaku » ×9 — l'utilisateur
// voyait les statistiques d'un inconnu sur son propre profil public, et son
// réglage « profil privé » était contourné puisqu'il s'appliquait à l'autre
// compte.
//
// Dédoublonnage : on garde le pseudo au compte le plus « réel » (plus grosse
// bibliothèque, puis le plus ancien — même heuristique que resolveOwner), les
// autres reçoivent un suffixe numérique. Le suffixe respecte la règle de
// validation des pseudos (lettres/chiffres/espace/._-) et la limite de 32
// caractères.
async function uniqueUsernames() {
    // Déjà unique ? (migration rejouée sur une base saine)
    const [[idx]] = await pool.query(
        `SELECT COUNT(*) AS n FROM information_schema.statistics
         WHERE table_schema = DATABASE() AND table_name = 'users'
           AND index_name = 'uq_username' AND non_unique = 0`);
    if (idx.n > 0) return;

    const [dups] = await pool.query(
        `SELECT username FROM users GROUP BY username HAVING COUNT(*) > 1`);

    for (const { username } of dups) {
        const [rows] = await pool.query(
            `SELECT u.id, (SELECT COUNT(*) FROM favorites f WHERE f.user_id = u.id) AS favs
             FROM users u WHERE u.username = ?
             ORDER BY favs DESC, u.id ASC`, [username]);
        // rows[0] conserve le pseudo ; les suivants sont suffixés
        for (let i = 1; i < rows.length; i++) {
            let n = i + 1, candidate;
            // Cherche un suffixe libre (un « Otaku2 » peut déjà exister)
            for (;;) {
                const suffix = String(n);
                const base = username.slice(0, Math.max(1, 32 - suffix.length));
                candidate = base + suffix;
                const [[taken]] = await pool.query(
                    'SELECT COUNT(*) AS n FROM users WHERE username = ?', [candidate]);
                if (!taken.n) break;
                n++;
            }
            await pool.query('UPDATE users SET username = ? WHERE id = ?', [candidate, rows[i].id]);
            console.log(`[migrate] pseudo dédoublonné : #${rows[i].id} "${username}" → "${candidate}"`);
        }
    }

    await run('ALTER TABLE users ADD UNIQUE KEY uq_username (username)');
}

async function ensureSchema() {
    await run(`CREATE TABLE IF NOT EXISTS schema_migrations (
        version    INT PRIMARY KEY,
        name       VARCHAR(255) DEFAULT NULL,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);
    let current = 0;
    try {
        const [[row]] = await pool.query('SELECT MAX(version) AS v FROM schema_migrations');
        current = row?.v || 0;
    } catch (e) { /* table toute neuve */ }
    for (const m of MIGRATIONS) {
        if (m.version <= current) continue;
        await m.apply();
        await run(`INSERT IGNORE INTO schema_migrations (version, name) VALUES (${m.version}, ${pool.escape(m.name)})`);
        console.log(`[migrate] migration ${m.version} appliquée : ${m.name}`);
    }
}

// Migration 1 : tout l'historique idempotent d'avant le versionnage.
// (Sûre à rejouer sur une base existante : gardes IF NOT EXISTS partout.)
async function legacySchema() {
    // 1. Commentaires hiérarchiques (threads) : comments.parent_id
    if (!(await columnExists('comments', 'parent_id'))) {
        await run('ALTER TABLE comments ADD COLUMN parent_id INT DEFAULT NULL');
        await run('ALTER TABLE comments ADD INDEX idx_parent (parent_id)');
        await run('ALTER TABLE comments ADD CONSTRAINT fk_comment_parent ' +
                  'FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE');
    }

    // 2. Modération : drapeau de bannissement utilisateur
    if (!(await columnExists('users', 'banned'))) {
        await run('ALTER TABLE users ADD COLUMN banned TINYINT(1) NOT NULL DEFAULT 0');
    }

    // 3. Signalements de commentaires (file de modération)
    await run(`CREATE TABLE IF NOT EXISTS reports (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        reporter_id INT NOT NULL,
        comment_id  INT DEFAULT NULL,
        manga_id    VARCHAR(191) DEFAULT NULL,
        reason      VARCHAR(255) DEFAULT NULL,
        status      ENUM('open','resolved','dismissed') NOT NULL DEFAULT 'open',
        created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_report_user    FOREIGN KEY (reporter_id) REFERENCES users(id)    ON DELETE CASCADE,
        CONSTRAINT fk_report_comment FOREIGN KEY (comment_id)  REFERENCES comments(id) ON DELETE CASCADE,
        INDEX idx_report_status (status, created_at)
    ) ENGINE=InnoDB`);

    // 4. Notifications in-app (cloche header)
    await run(`CREATE TABLE IF NOT EXISTS notifications (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT NOT NULL,
        type       VARCHAR(32) NOT NULL,          -- reply | mention | chapter | badge | system
        title      VARCHAR(255) DEFAULT NULL,
        body       VARCHAR(512) DEFAULT NULL,
        link       VARCHAR(512) DEFAULT NULL,
        actor      VARCHAR(50)  DEFAULT NULL,      -- username de l'auteur de l'action
        image      VARCHAR(512) DEFAULT NULL,      -- cover de l'oeuvre (nouveau chapitre)
        is_read    TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_notif_user (user_id, is_read, created_at)
    ) ENGINE=InnoDB`);

    // Réglages applicatifs par base (ex. local_owner_id) : le choix du
    // propriétaire vit DANS la base — un fichier partagé entre la base
    // externe et l'embarquée désignait le mauvais compte après une bascule.
    await run(`CREATE TABLE IF NOT EXISTS app_settings (
        k VARCHAR(64) PRIMARY KEY,
        v TEXT,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`);

    if (!await columnExists('notifications', 'image')) {
        await run('ALTER TABLE notifications ADD COLUMN image VARCHAR(512) DEFAULT NULL');
    }

    // 5. Abonnements Web Push (notifications push navigateur)
    await run(`CREATE TABLE IF NOT EXISTS push_subscriptions (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT NOT NULL,
        endpoint   VARCHAR(512) NOT NULL,
        p256dh     VARCHAR(255) DEFAULT NULL,
        auth       VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY uq_push_endpoint (endpoint(191)),
        CONSTRAINT fk_push_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);

    // ── Index manquants (audit DB6/DB7/DB9) ──
    await run('ALTER TABLE read_chapters  ADD INDEX idx_read_at (read_at)');                 // stats/historique par date
    await run('ALTER TABLE events         ADD INDEX idx_user_type_time (user_id, type, created_at)'); // filtres timeline
    await run('ALTER TABLE password_resets ADD INDEX idx_expires (expires_at)');             // cleanup tokens expirés

    // ── Types : précision & longueur (audit DB1/DB2/DB4) ──
    await modifyIf('favorites',     'last_chapter',   'decimal', 'DECIMAL(10,2) DEFAULT NULL');   // FLOAT → DECIMAL
    await modifyIf('progress',      'chapter_number', 'decimal', 'DECIMAL(10,2) DEFAULT NULL');
    await modifyIf('read_chapters', 'chapter_number', 'decimal', 'DECIMAL(10,2) DEFAULT NULL');
    await modifyIf('favorites',     'cover',  'text', 'TEXT DEFAULT NULL');                       // URLs longues (CDN signées)
    await modifyIf('list_items',    'cover',  'text', 'TEXT DEFAULT NULL');
    await modifyIf('users',         'avatar', 'varchar(255)', 'VARCHAR(255) DEFAULT NULL');       // emojis longs / URLs

    // 7. Notes de lecture personnelles (journal du lecteur)
    //    Privées, synchronisées, rattachées au contexte (série / chapitre / page).
    await run(`CREATE TABLE IF NOT EXISTS reading_notes (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        user_id     INT NOT NULL,
        manga_id    VARCHAR(191) NOT NULL,
        source      VARCHAR(64) DEFAULT NULL,
        manga_title VARCHAR(512) DEFAULT NULL,     -- dénormalisé pour le journal
        cover       TEXT DEFAULT NULL,
        chapter_id  VARCHAR(191) DEFAULT NULL,      -- NULL = note au niveau de la série
        chapter_num DECIMAL(10,2) DEFAULT NULL,
        page        INT DEFAULT NULL,               -- position dans le chapitre
        body        TEXT NOT NULL,
        mood        VARCHAR(24) DEFAULT NULL,        -- humeur / étiquette (optionnel)
        created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT fk_note_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_note_user_manga (user_id, manga_id),
        INDEX idx_note_user_time (user_id, created_at)
    ) ENGINE=InnoDB`);

    // 6. Imports locaux (EPUB / CBZ / CBR téléversés par l'utilisateur)
    await run(`CREATE TABLE IF NOT EXISTS local_imports (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT NOT NULL,
        title      VARCHAR(512) NOT NULL,
        type       VARCHAR(16) NOT NULL,            -- cbz | epub | pdf (audit BUG-17 : jamais cbr, refusé à l'upload)
        filename   VARCHAR(255) NOT NULL,           -- nom du fichier sur disque
        size       BIGINT DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_local_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_local_user (user_id, created_at)
    ) ENGINE=InnoDB`);
}

module.exports = { ensureSchema };
