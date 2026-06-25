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

async function ensureSchema() {
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
        is_read    TINYINT(1) NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_notif_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_notif_user (user_id, is_read, created_at)
    ) ENGINE=InnoDB`);

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

    // 6. Imports locaux (EPUB / CBZ / CBR téléversés par l'utilisateur)
    await run(`CREATE TABLE IF NOT EXISTS local_imports (
        id         INT AUTO_INCREMENT PRIMARY KEY,
        user_id    INT NOT NULL,
        title      VARCHAR(512) NOT NULL,
        type       VARCHAR(16) NOT NULL,            -- cbz | cbr | epub
        filename   VARCHAR(255) NOT NULL,           -- nom du fichier sur disque
        size       BIGINT DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_local_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        INDEX idx_local_user (user_id, created_at)
    ) ENGINE=InnoDB`);
}

module.exports = { ensureSchema };
