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

// Audit DB-05 : cette fonction avalait TOUTE erreur inconnue avec un simple
// console.warn. Une migration réellement en échec laissait donc le serveur
// démarrer sur un schéma incohérent, avec un avertissement noyé dans les logs
// — et la version était quand même enregistrée dans schema_migrations, donc
// jamais rejouée. Les erreurs « déjà présent » restent ignorées (c'est le
// principe de l'idempotence) ; les autres remontent.
// MIGRATE_TOLERANT=1 rétablit l'ancien comportement pour dépanner une base
// dans un état inattendu.
const TOLERANT = process.env.MIGRATE_TOLERANT === '1';

// Le nom de table d'un `CREATE TABLE IF NOT EXISTS` — pour vérifier ensuite
// qu'elle existe VRAIMENT.
function tableCreee(sql) {
    const m = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?([A-Za-z0-9_]+)`?/i.exec(String(sql));
    return m ? m[1] : null;
}

async function run(sql) {
    const table = tableCreee(sql);
    try {
        await pool.query(sql);
        // Ceinture et bretelles : on VÉRIFIE que la table demandée existe.
        // Une erreur avalée par un chemin qu'on n'a pas prévu laisserait sinon
        // un schéma amputé et une migration marquée appliquée — la panne la
        // plus coûteuse, parce qu'elle ne se rejoue jamais.
        if (table && !(await tableExists(table))) {
            throw new Error(`la table \`${table}\` n'existe pas après son CREATE TABLE`);
        }
    }
    catch (e) {
        // Sur un CREATE TABLE, la seule erreur réellement anodine est « elle
        // existe déjà ». Les autres codes de cette liste — nom de clé ou de
        // contrainte en double — signifient que la table n'a PAS été créée.
        //
        // C'est arrivé : `fk_push_user` était déjà pris par une autre table
        // (les noms de contraintes sont globaux à la base dans MySQL). La
        // création a échoué, l'erreur a été ignorée, et la migration s'est
        // enregistrée comme appliquée. Schéma incohérent, définitivement, et
        // sans une ligne dans le journal — exactement le défaut DB-05, revenu
        // par la porte de la liste des ignorables.
        const anodine = table
            ? e.code === 'ER_TABLE_EXISTS_ERROR'
            : IGNORABLE.has(e.code);
        if (anodine) return;
        // Même filet, même raison : ce test sur le MESSAGE rattrapait « Duplicate
        // foreign key constraint name » quel que soit le code, et refermait donc
        // la porte qu'on vient d'ouvrir. Il ne vaut que hors CREATE TABLE.
        if (!table && /duplicate (column|key|foreign key|entry)/i.test(e.message || '')) return;
        const detail = `${e.code || 'ERREUR'} — ${e.sqlMessage || e.message}`;
        if (TOLERANT) {
            console.warn(`[migrate] ⚠ ignorée (MIGRATE_TOLERANT=1) : ${detail}`);
            return;
        }
        console.error(`[migrate] ✖ ${detail}`);
        console.error(`          SQL : ${String(sql).replace(/\s+/g, ' ').slice(0, 160)}`);
        throw new Error(`migration échouée : ${detail}`);
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

async function tableExists(table) {
    const [[r]] = await pool.query(
        `SELECT COUNT(*) AS n FROM information_schema.tables
         WHERE table_schema = DATABASE() AND table_name = ?`, [table]);
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
    { version: 5, name: 'intégrité des notes + colonne morte library.rating (audit DB-03/DB-04)', apply: async () => {
        // DB-04 : `ratings.rating` est un TINYINT sans borne — la validation
        // 1..5 était purement applicative, donc contournable par tout accès
        // direct à la base (script, restauration, correction manuelle).
        // On borne d'abord les valeurs existantes, puis on pose la contrainte.
        await run('UPDATE ratings SET rating = 5 WHERE rating > 5');
        await run('UPDATE ratings SET rating = 1 WHERE rating < 1');
        await run('ALTER TABLE ratings ADD CONSTRAINT chk_rating_range CHECK (rating BETWEEN 1 AND 5)');

        // DB-03 : `library.rating` n'est écrite NULLE PART dans le code — la
        // table `ratings` a pris le relais (avec review, horodatage et index).
        // On ne supprime la colonne que si elle est effectivement vide, pour ne
        // jamais détruire de données sur une base qui l'aurait utilisée.
        if (await columnExists('library', 'rating')) {
            const [[r]] = await pool.query('SELECT COUNT(*) AS n FROM library WHERE rating IS NOT NULL');
            if (r.n === 0) {
                await run('ALTER TABLE library DROP COLUMN rating');
                console.log('[migrate] colonne morte library.rating supprimée (0 ligne renseignée)');
            } else {
                console.warn(`[migrate] library.rating conservée : ${r.n} ligne(s) renseignée(s) — à migrer vers ratings avant suppression`);
            }
        }
    } },
    { version: 6, name: 'anilist_links sort du blob de réglages (audit PERF-09)', apply: anilistLinksTable },
    { version: 7, name: 'fusion de library dans favorites (audit DB-02)', apply: mergeLibraryIntoFavorites },
    { version: 8, name: 'local_imports.cover — vignette extraite du fichier (audit AMEL-25)', apply: async () => {
        // La bibliothèque locale n'affichait qu'une icône de type et un titre
        // déduit du NOM DE FICHIER. Les EPUB portent pourtant leur titre et
        // leur couverture, les CBZ leur première planche.
        // MEDIUMTEXT et non TEXT : une vignette encodée en data-URI dépasse
        // les 64 Ko de TEXT dès qu'elle est un peu détaillée, et un INSERT
        // tronqué produirait une image corrompue plutôt qu'une erreur.
        if (!(await columnExists('local_imports', 'cover'))) {
            await run('ALTER TABLE local_imports ADD COLUMN cover MEDIUMTEXT DEFAULT NULL');
        }
    } },
    { version: 9, name: 'progress_history — positions précédentes (audit AMEL-28)', apply: async () => {
        // `progress` ne garde qu'UNE ligne par (compte, série) : ouvrir par
        // erreur le chapitre 1 d'une série qu'on lisait au chapitre 300 écrasait
        // définitivement la position, sans aucun moyen de revenir en arrière.
        //
        // On garde donc une trace des positions, mais SEULEMENT aux changements
        // de chapitre : enregistrer chaque page tournée produirait des milliers
        // de lignes par série pour aucune information utile — ce qu'on veut
        // retrouver, c'est « j'étais au chapitre 300 », pas « page 14 ».
        await run(`CREATE TABLE IF NOT EXISTS progress_history (
            id          BIGINT AUTO_INCREMENT PRIMARY KEY,
            user_id     INT NOT NULL,
            manga_id    VARCHAR(191) NOT NULL,
            chapter_id  VARCHAR(191) DEFAULT NULL,
            chapter_number DECIMAL(10,2) DEFAULT NULL,
            page        INT DEFAULT 1,
            source      VARCHAR(64) DEFAULT NULL,
            recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_user_manga (user_id, manga_id, recorded_at),
            CONSTRAINT fk_ph_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB`);
    } },
    { version: 10, name: 'bookmarks sort du blob de réglages (audit AMEL-41)', apply: bookmarksTable },
    { version: 11, name: 'lists.rules — listes intelligentes (audit AMEL-38)', apply: async () => {
        // Une liste intelligente n'a pas de membres : elle a des RÈGLES, et son
        // contenu se recalcule à chaque lecture. C'est ce qui la distingue
        // d'une liste ordinaire — et ce qui évite d'avoir à la tenir à jour
        // quand la bibliothèque change.
        if (!(await columnExists('lists', 'rules'))) {
            await run('ALTER TABLE lists ADD COLUMN rules TEXT DEFAULT NULL');
        }
    } },
    { version: 12, name: 'notes sur 10 — demi-étoiles (audit AMEL-47)', apply: async () => {
        // `TINYINT` 1-5 est trop grossier pour classer des centaines de séries :
        // tout finit à 4 ou 5. On passe à une échelle sur 10, affichée en
        // 5 étoiles avec demis — ce qui double la granularité sans changer le
        // repère visuel auquel les gens sont habitués.
        //
        // Ordre des opérations, et il compte : la contrainte 1-5 (posée en
        // migration 5) doit tomber AVANT de doubler les valeurs, sinon
        // l'UPDATE la viole et échoue. On la repose ensuite, bornée à 10.
        const [[c]] = await pool.query(
            `SELECT COUNT(*) AS n FROM information_schema.table_constraints
             WHERE table_schema = DATABASE() AND table_name = 'ratings'
               AND constraint_name = 'chk_rating_range'`);
        if (c.n) await run('ALTER TABLE ratings DROP CHECK chk_rating_range');

        // Ne double QUE ce qui est encore sur 5 : la migration doit pouvoir
        // être rejouée sans transformer un 8 en 16.
        const [[m]] = await pool.query('SELECT COALESCE(MAX(rating), 0) AS max FROM ratings');
        if (m.max > 0 && m.max <= 5) {
            const [r] = await pool.query('UPDATE ratings SET rating = rating * 2');
            console.log(`[migrate] ${r.affectedRows} note(s) converties de /5 vers /10`);
        }
        await run('ALTER TABLE ratings ADD CONSTRAINT chk_rating_range CHECK (rating BETWEEN 1 AND 10)');
    } },
    { version: 13, name: 'commentaires : visibilité, spoiler, ancrage chapitre (audit AMEL-50/51/52)', apply: async () => {
        // AMEL-50 : l'UI promettait « ton avis reste privé » pendant que
        // /comments/:mangaId servait tout le monde, y compris non connecté.
        // Ce n'était pas un réglage manquant, c'était une promesse fausse.
        // Le défaut retenu est `instance` — visible des membres de CETTE
        // instance — parce que c'est ce que faisait le code jusqu'ici pour un
        // utilisateur connecté : les commentaires existants ne changent donc
        // pas de portée. Seuls les visiteurs anonymes en perdent l'accès,
        // ce qui est exactement la fuite à colmater.
        if (!(await columnExists('comments', 'visibility'))) {
            await run(`ALTER TABLE comments ADD COLUMN visibility
                ENUM('private','instance','public') NOT NULL DEFAULT 'instance'`);
        }
        // AMEL-51 : un lecteur de manga sans marqueur de spoiler force à
        // choisir entre se taire et gâcher la lecture des autres.
        if (!(await columnExists('comments', 'spoiler'))) {
            await run('ALTER TABLE comments ADD COLUMN spoiler TINYINT(1) NOT NULL DEFAULT 0');
        }
        // AMEL-52 : `chapter_id` existait déjà et n'était jamais rempli. Un
        // index le rend interrogeable — sans lui, filtrer les commentaires
        // d'un chapitre balaierait toute la table de l'œuvre.
        const [[idx]] = await pool.query(
            `SELECT COUNT(*) AS n FROM information_schema.statistics
             WHERE table_schema = DATABASE() AND table_name = 'comments'
               AND index_name = 'idx_comments_chapter'`);
        if (!idx.n) await run('CREATE INDEX idx_comments_chapter ON comments (manga_id, chapter_id)');
    } },
    { version: 14, name: 'notifications : regroupement, séries surveillées, fréquence (audit AMEL-53/54/56)', apply: async () => {
        // AMEL-53 : une notification par chapitre et par série, empilées sans
        // fin — 110 lignes pour une poignée de séries. La clé de regroupement
        // (l'œuvre) permet de METTRE À JOUR la notification non lue d'une série
        // plutôt que d'en ajouter une : la cloche montre l'état courant, pas
        // l'historique de chaque parution.
        if (!(await columnExists('notifications', 'group_key'))) {
            await run('ALTER TABLE notifications ADD COLUMN group_key VARCHAR(191) DEFAULT NULL');
            await run('ALTER TABLE notifications ADD COLUMN group_count INT NOT NULL DEFAULT 1');
            // Rattrapage des 110 lignes existantes : l'œuvre est déjà dans le
            // lien (`?manga=<id>`). Sans ce backfill, les anciennes notifications
            // resteraient orphelines et le regroupement ne commencerait qu'à la
            // prochaine parution.
            const [r] = await pool.query(
                `UPDATE notifications
                 SET group_key = SUBSTRING_INDEX(SUBSTRING_INDEX(link, 'manga=', -1), '&', 1)
                 WHERE group_key IS NULL AND link LIKE '%manga=%'`);
            console.log(`[migrate] ${r.affectedRows} notification(s) rattachées à leur œuvre`);
        }
        const [[idx]] = await pool.query(
            `SELECT COUNT(*) AS n FROM information_schema.statistics
             WHERE table_schema = DATABASE() AND table_name = 'notifications'
               AND index_name = 'idx_notif_group'`);
        if (!idx.n) await run('CREATE INDEX idx_notif_group ON notifications (user_id, type, group_key, is_read)');

        // AMEL-54 : le scan était global — toutes les séries suivies, toutes
        // les 4 h, pour tout le monde. Une série qu'on suit sans vouloir en
        // être averti n'existait pas.
        if (!(await columnExists('favorites', 'notify'))) {
            await run('ALTER TABLE favorites ADD COLUMN notify TINYINT(1) NOT NULL DEFAULT 1');
        }
        // La fréquence est une propriété du compte : une colonne sur `users`
        // plutôt qu'une table à joindre, et surtout pas le blob `user_settings`
        // — le planificateur la lit pour CHAQUE utilisateur à chaque cycle.
        if (!(await columnExists('users', 'notif_every_hours'))) {
            await run('ALTER TABLE users ADD COLUMN notif_every_hours INT NOT NULL DEFAULT 4');
            await run('ALTER TABLE users ADD COLUMN last_notif_scan TIMESTAMP NULL DEFAULT NULL');
        }
    } },
    { version: 15, name: 'regroupement rétroactif des notifications déjà empilées (audit AMEL-53)', apply: async () => {
        // La migration 14 rend le regroupement possible pour les parutions À
        // VENIR. Elle ne touche pas à l'arriéré — or c'est lui le problème
        // décrit par l'audit : 110 lignes pour une poignée de séries, dont 27
        // NON LUES sur une seule œuvre. Sans ce rattrapage, la cloche resterait
        // illisible jusqu'à ce que la rétention de 30 jours finisse le travail.
        //
        // Le regroupement se fait par (utilisateur, type, œuvre, ÉTAT DE
        // LECTURE) : fusionner une notification lue avec une non lue
        // effacerait le fait que l'utilisateur a déjà traité l'une des deux.
        // On garde la plus récente de chaque groupe — celle qui pointe vers le
        // chapitre le plus avancé — et son `group_count` dit ce qu'elle
        // recouvre. Les autres sont supprimées : les garder, c'est ne rien
        // avoir regroupé.
        const [[avant]] = await pool.query('SELECT COUNT(*) AS n FROM notifications');
        if (!avant.n) return;

        await run(`UPDATE notifications n
            JOIN (SELECT user_id, type, group_key, is_read, COUNT(*) AS n, MAX(id) AS garde
                  FROM notifications WHERE group_key IS NOT NULL
                  GROUP BY user_id, type, group_key, is_read
                  HAVING n > 1) g
              ON n.id = g.garde
            SET n.group_count = GREATEST(n.group_count, g.n)`);

        const [supp] = await pool.query(`DELETE n FROM notifications n
            JOIN (SELECT user_id, type, group_key, is_read, MAX(id) AS garde
                  FROM notifications WHERE group_key IS NOT NULL
                  GROUP BY user_id, type, group_key, is_read) g
              ON  n.user_id = g.user_id AND n.type = g.type
              AND n.group_key = g.group_key AND n.is_read = g.is_read
            WHERE n.id <> g.garde`);
        console.log(`[migrate] ${supp.affectedRows} notification(s) fusionnées dans leur série (${avant.n} → ${avant.n - supp.affectedRows})`);
    } },
    { version: 16, name: 'sessions révocables une à une (audit AMEL-69)', apply: async () => {
        // `token_version` (migration 4) ne sait révoquer que TOUT : changer son
        // mot de passe déconnecte l'intrus ET tous ses propres appareils. On ne
        // pouvait ni voir où l'on était connecté, ni fermer une seule session
        // — sur un jeton qui vit 30 jours, c'est long.
        //
        // Chaque jeton porte désormais un identifiant (`jti`) et une ligne
        // ici. Absence de ligne = session révoquée : le défaut est donc de
        // REFUSER, ce qui vaut mieux que d'accepter faute d'information.
        await run(`CREATE TABLE IF NOT EXISTS sessions (
            id          CHAR(36) NOT NULL,
            user_id     INT NOT NULL,
            user_agent  VARCHAR(255) DEFAULT NULL,
            ip          VARCHAR(45)  DEFAULT NULL,
            created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            KEY idx_sessions_user (user_id, last_seen_at),
            CONSTRAINT sessions_user_fk FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    } },

    { version: 17, name: 'couvertures : retirer le proxy figé dans la donnée', apply: async () => {
        // `global.js` enregistrait la couverture d'un favori en lisant le `src`
        // de l'image AFFICHÉE — donc déjà passée par le proxy, et résolue en
        // ABSOLU par le navigateur. La base contenait ainsi des couvertures du
        // type `http://127.0.0.1:8088/api/img?u=<source>`.
        //
        // Relevé avant correction : 83 favoris proxifiés, dont 67 en absolu.
        //
        // Deux conséquences, la seconde décisive : les couvertures cassent si
        // le port du hub change, et depuis un autre appareil `127.0.0.1`
        // désigne CET appareil — un téléphone n'afficherait donc aucune
        // couverture. Le proxy doit être appliqué à l'AFFICHAGE, jamais stocké.
        //
        // Le client est corrigé et le serveur normalise désormais à l'écriture ;
        // cette migration répare l'existant. `SUBSTRING_INDEX` isole la valeur
        // de `u=`, et `urldecode` n'existant pas en SQL, on ne remet en clair
        // que les deux séquences réellement produites par `encodeURIComponent`
        // sur une URL http(s) : `%3A` et `%2F`.
        await run(`UPDATE favorites
            SET cover = REPLACE(REPLACE(
                    SUBSTRING_INDEX(SUBSTRING_INDEX(cover, 'u=', -1), '&', 1),
                    '%3A', ':'), '%2F', '/')
            WHERE cover LIKE '%/api/img?u=%'`);
        // Même défaut dans les notifications, écrites par `lib/notify.js`.
        await run(`UPDATE notifications
            SET image = REPLACE(REPLACE(
                    SUBSTRING_INDEX(SUBSTRING_INDEX(image, 'u=', -1), '&', 1),
                    '%3A', ':'), '%2F', '/')
            WHERE image LIKE '%/api/img?u=%'`);
    } },

    { version: 18, name: 'sessions expirables + appareils appairés (audit DB-01/DB-02/DB-05)', apply: async () => {
        // ── DB-01 : `sessions` grossit d'une ligne par PAGE AFFICHÉE ──
        // `/api/auth/local` est appelé à chaque chargement de page, et `sign()`
        // insère une ligne. Relevé pendant l'audit : 1 820 lignes pour UN seul
        // compte sur 82 h, pic à 626 en une heure. Deux jours plus tard, 4 578.
        // Le volume suit le nombre de pages vues, pas celui des connexions.
        //
        // La table n'a ni expiration ni révocation — alors que la migration 16
        // s'intitule « sessions révocables une à une ». On ne pouvait révoquer
        // qu'en SUPPRIMANT la ligne, et rien ne purgeait.
        //
        // Le correctif tient en trois parties : ces colonnes, la purge plus bas,
        // et surtout la réutilisation de session dans `localAuth` — sans quoi la
        // fuite reprend dès le prochain démarrage.

        // ── DB-05 d'abord : la collation de `sessions` diverge ──
        // Elle est en `utf8mb4_0900_ai_ci` là où les 22 autres tables sont en
        // `utf8mb4_unicode_ci`. Ce n'est pas cosmétique ici : MySQL refuse une
        // clé étrangère entre deux colonnes de collations différentes
        // (errno 3780). La FK `sessions.device_id → devices.id` ci-dessous
        // échouerait donc. On aligne AVANT de créer la contrainte.
        //
        // `utf8mb4_0900_ai_ci` est propre à MySQL 8 : il n'existe pas sur la
        // MariaDB embarquée du desktop, où la table a hérité d'un autre défaut.
        // `utf8mb4_unicode_ci` existe des deux côtés — c'est la seule valeur
        // qui rende cette migration portable.
        const [[coll]] = await pool.query(
            `SELECT TABLE_COLLATION AS c FROM information_schema.TABLES
              WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'sessions'`);
        if (coll && coll.c && coll.c !== 'utf8mb4_unicode_ci') {
            await run('ALTER TABLE sessions CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
        }

        // ── Appareils appairés (stratégie mobile VIII.5) ──
        // Créés ici et non plus tard : `sessions.device_id` doit pouvoir les
        // référencer, et une session révoquée depuis un téléphone perdu doit
        // l'être immédiatement — d'où `revoked_at` des deux côtés.
        await run(`CREATE TABLE IF NOT EXISTS devices (
            id           CHAR(36)     NOT NULL,
            user_id      INT          NOT NULL,
            nom          VARCHAR(64)  NOT NULL,
            plateforme   ENUM('android','ios','desktop','web') NOT NULL,
            app_version  VARCHAR(16)  DEFAULT NULL,
            empreinte    CHAR(64)     NOT NULL,
            push_token   VARCHAR(255) DEFAULT NULL,
            push_type    ENUM('fcm','webpush') DEFAULT NULL,
            created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_seen_at TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            revoked_at   TIMESTAMP    NULL DEFAULT NULL,
            PRIMARY KEY (id),
            KEY idx_devices_user (user_id, revoked_at),
            CONSTRAINT fk_devices_user FOREIGN KEY (user_id)
                REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

        // Code d'appairage à usage unique et à durée de vie courte.
        // `used_at` plutôt qu'une suppression : un code rejoué doit être
        // distinguable d'un code inconnu, sinon on ne peut pas le dire à
        // l'utilisateur ni le repérer dans les journaux.
        await run(`CREATE TABLE IF NOT EXISTS pair_codes (
            code       CHAR(9)   NOT NULL,
            user_id    INT       NOT NULL,
            expires_at TIMESTAMP NOT NULL,
            used_at    TIMESTAMP NULL DEFAULT NULL,
            PRIMARY KEY (code),
            KEY idx_pair_exp (expires_at),
            CONSTRAINT fk_pair_user FOREIGN KEY (user_id)
                REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

        // ── Les colonnes qui manquaient à `sessions` ──
        if (!(await columnExists('sessions', 'device_id')))
            await run('ALTER TABLE sessions ADD COLUMN device_id CHAR(36) NULL DEFAULT NULL');
        if (!(await columnExists('sessions', 'expires_at')))
            await run('ALTER TABLE sessions ADD COLUMN expires_at TIMESTAMP NULL DEFAULT NULL');
        if (!(await columnExists('sessions', 'revoked_at')))
            await run('ALTER TABLE sessions ADD COLUMN revoked_at TIMESTAMP NULL DEFAULT NULL');
        await run('ALTER TABLE sessions ADD KEY idx_sessions_exp (expires_at)');
        await run(`ALTER TABLE sessions ADD CONSTRAINT fk_sessions_device
            FOREIGN KEY (device_id) REFERENCES devices(id) ON DELETE CASCADE`);

        // Les lignes existantes n'ont pas d'échéance. On leur donne celle que
        // portait déjà leur jeton — 30 jours après émission (`JWT_EXPIRES`) —
        // plutôt que de les traiter comme éternelles ou de les tuer d'un coup.
        // La purge juste après les emportera si elles sont déjà dépassées.
        await run(`UPDATE sessions SET expires_at = created_at + INTERVAL 30 DAY
                    WHERE expires_at IS NULL`);

        // ── La purge de rattrapage ──
        // Sans elle, la migration ajoute des colonnes à un tas qui reste un
        // tas. `sessionsExpirees()` (lib/sessions.js) rejoue le même nettoyage
        // au démarrage puis chaque jour.
        await run('DELETE FROM sessions WHERE expires_at < NOW() OR revoked_at IS NOT NULL');

        // ── DB-02 : `progress.source` NULL, racine de BUG-01 ──
        // Sans source, `getFrom(undefined, id)` interroge la source COURANTE
        // avec l'identifiant d'une autre — d'où des chapitres introuvables.
        // Le favori correspondant connaît presque toujours la bonne source :
        // on la recopie. Ce qu'aucun favori ne couvre reste NULL, et sera
        // IGNORÉ à la lecture (P0.4) : deviner une source produirait un
        // résultat faux, ce qui est pire qu'une entrée sautée.
        await run(`UPDATE progress p
                     JOIN favorites f ON f.user_id = p.user_id AND f.manga_id = p.manga_id
                      SET p.source = f.source
                    WHERE (p.source IS NULL OR p.source = '') AND f.source IS NOT NULL AND f.source <> ''`);
    } },

    { version: 19, name: 'events.source — la source voyage avec l’identifiant (audit BUG-01/BUG-11)', apply: async () => {
        // BUG-01 : `events` ne porte PAS de source. Le client lisait donc
        // `item.source === undefined` sur chaque entrée d'historique, et
        // `getFrom(undefined, id)` envoyait la requête à la source COURANTE.
        //
        // Mesuré pendant l'audit : 14 requêtes avec un identifiant étranger à
        // la source appelée, dont `/api/sources/weebcentral/mangas/2701` —
        // 2701 est l'identifiant de Moby Dick chez Project Gutenberg. Le
        // serveur répondait 200 avec une fiche vide (BUG-02), ce qui rendait
        // la faute invisible : un roman ouvrait le lecteur d'IMAGES, d'où la
        // « page blanche » signalée.
        //
        // Le correctif `sourceDe()` avait été appliqué à `readerHref` mais pas
        // à `getFrom` — soigner l'un des deux chemins laisse l'autre ouvert.
        // La colonne referme la cause plutôt que ses symptômes.
        if (!(await columnExists('events', 'source')))
            await run('ALTER TABLE events ADD COLUMN source VARCHAR(64) NULL DEFAULT NULL AFTER manga_id');

        // Rattrapage de l'existant. Les favoris d'abord : c'est la source que
        // l'utilisateur a explicitement choisie en ajoutant la série. La
        // progression ensuite, qui la connaît aussi depuis la migration 18.
        await run(`UPDATE events e
                     JOIN favorites f ON f.user_id = e.user_id AND f.manga_id = e.manga_id
                      SET e.source = f.source
                    WHERE e.source IS NULL AND f.source IS NOT NULL AND f.source <> ''`);
        await run(`UPDATE events e
                     JOIN progress p ON p.user_id = e.user_id AND p.manga_id = e.manga_id
                      SET e.source = p.source
                    WHERE e.source IS NULL AND p.source IS NOT NULL AND p.source <> ''`);
        // Ce qu'aucune des deux ne couvre reste NULL — et sera IGNORÉ à la
        // lecture. Deviner produirait exactement le défaut qu'on referme.
    } },

    { version: 20, name: 'migrations de source réversibles (audit XIII.1)', apply: async () => {
        // Trois sources ne répondent plus ou plus complètement, et 13 séries en
        // dépendent : chireads (9), novelfull (3), novelbin (1). Leur
        // progression, leurs notes et leurs signets existent toujours — mais
        // l'œuvre est devenue inatteignable. La migration transforme la perte
        // sèche en déménagement.
        //
        // Cette table existe pour UNE raison : pouvoir revenir en arrière.
        // Reporter 143 chapitres lus sur la mauvaise œuvre est une opération
        // qu'aucun utilisateur ne saurait défaire à la main, et le score qui
        // guide le choix n'est qu'une heuristique. `etat_avant` conserve donc
        // l'intégralité de ce qui a été touché, en JSON, avant de l'écrire.
        //
        // Sept jours : au-delà, la progression a repris sur la nouvelle source
        // et restaurer l'ancienne détruirait ce qui a été lu depuis. Une purge
        // accompagne la fenêtre — voir `lib/migration-sources.js`.
        await run(`CREATE TABLE IF NOT EXISTS source_migrations (
            id            INT AUTO_INCREMENT PRIMARY KEY,
            user_id       INT          NOT NULL,
            manga_id      VARCHAR(191) NOT NULL,
            source_avant  VARCHAR(64)  NOT NULL,
            id_avant      VARCHAR(191) NOT NULL,
            source_apres  VARCHAR(64)  NOT NULL,
            id_apres      VARCHAR(191) NOT NULL,
            etat_avant    JSON         NOT NULL,
            reportes      INT          NOT NULL DEFAULT 0,
            absents       INT          NOT NULL DEFAULT 0,
            created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            annulee_at    TIMESTAMP    NULL DEFAULT NULL,
            KEY idx_migr_user (user_id, created_at),
            CONSTRAINT fk_migr_user FOREIGN KEY (user_id)
                REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    } },

    { version: 21, name: 'jetons de notification par appareil (audit P2.5)', apply: async () => {
        // Un jeton FCM appartient à un APPAREIL, pas à un compte : le même
        // utilisateur sur deux téléphones a deux jetons, et révoquer un
        // téléphone perdu doit faire taire celui-là seulement.
        //
        // La clé étrangère vers `devices` avec ON DELETE CASCADE fait ce
        // travail toute seule. Sans elle, un appareil retiré continuerait de
        // recevoir les nouveaux chapitres de la bibliothèque de son ancien
        // propriétaire — ce qui n'est pas un défaut de confort.
        //
        // Le jeton est UNIQUE : Google le réattribue quand un appareil est
        // réinstallé, et deux lignes pour un même jeton enverraient chaque
        // notification en double.
        await run(`CREATE TABLE IF NOT EXISTS device_push_tokens (
            id          INT AUTO_INCREMENT PRIMARY KEY,
            device_id   CHAR(36)     NOT NULL,
            user_id     INT          NOT NULL,
            token       VARCHAR(512) NOT NULL,
            plateforme  VARCHAR(16)  NOT NULL DEFAULT 'android',
            created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
            last_seen_at TIMESTAMP   NULL DEFAULT NULL,
            -- 512 caractères dépassent la limite d'index de MySQL en utf8mb4
            -- (767 octets) : on indexe un préfixe, largement discriminant pour
            -- un jeton opaque, et l'unicité est portée par ce préfixe.
            UNIQUE KEY uniq_token (token(190)),
            KEY idx_push_device (device_id),
            KEY idx_push_user (user_id),
            CONSTRAINT fk_dpt_device FOREIGN KEY (device_id)
                REFERENCES devices(id) ON DELETE CASCADE,
            -- fk_dpt_* et non fk_push_* : dans MySQL, un nom de contrainte est
            -- unique dans TOUTE la base, pas dans la table. fk_push_user
            -- appartient deja a push_subscriptions — la collision a fait
            -- echouer cette creation, et l'erreur figurait dans la liste des
            -- ignorables (voir run() ci-dessus, corrige du meme coup).
            CONSTRAINT fk_dpt_user FOREIGN KEY (user_id)
                REFERENCES users(id) ON DELETE CASCADE
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    } },
];

// ── Migration 10 : sortir les signets des réglages (audit AMEL-41) ──
// Même défaut que `anilistLinks` (traité en PERF-09) : jusqu'à 200 signets,
// chacun avec titre et URL de couverture, vivaient dans `user_settings.data` —
// un blob JSON rechargé À CHAQUE PAGE et réécrit en entier au moindre ajout.
// Un signet n'a rien d'une préférence : c'est une donnée qui croît, se liste,
// se trie et se supprime à l'unité.
async function bookmarksTable() {
    await run(`CREATE TABLE IF NOT EXISTS bookmarks (
        user_id     INT NOT NULL,
        manga_id    VARCHAR(191) NOT NULL,
        chapter_id  VARCHAR(191) NOT NULL,
        source      VARCHAR(64)  DEFAULT NULL,
        title       VARCHAR(512) DEFAULT NULL,
        cover       VARCHAR(512) DEFAULT NULL,
        chapter_num DECIMAL(10,2) DEFAULT NULL,
        page        INT DEFAULT 1,
        label       VARCHAR(255) DEFAULT NULL,
        created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, manga_id, chapter_id),
        INDEX idx_user_date (user_id, created_at),
        CONSTRAINT fk_bm_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);

    // Reprise des signets déjà posés, puis retrait du blob.
    let rows;
    try {
        [rows] = await pool.query(
            `SELECT user_id, data FROM user_settings
             WHERE JSON_EXTRACT(data, '$.userdata.bookmarks') IS NOT NULL`);
    } catch (e) { return; }   // colonne JSON absente : rien à migrer

    for (const r of rows) {
        const d = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
        const liste = d?.userdata?.bookmarks || [];
        const valides = liste
            .filter(b => b && b.mangaId && b.chapterId)
            .map(b => [r.user_id, String(b.mangaId).slice(0, 191), String(b.chapterId).slice(0, 191),
                b.source || null, (b.title || '').slice(0, 512) || null, (b.cover || '').slice(0, 512) || null,
                Number.isFinite(+b.chapterNum) ? +b.chapterNum : null,
                Number.isFinite(+b.page) ? +b.page : 1,
                (b.label || '').slice(0, 255) || null,
                b.at ? new Date(b.at) : new Date()]);
        if (valides.length) {
            for (let i = 0; i < valides.length; i += 500) {
                await pool.query(
                    `INSERT INTO bookmarks
                     (user_id, manga_id, chapter_id, source, title, cover, chapter_num, page, label, created_at)
                     VALUES ? ON DUPLICATE KEY UPDATE page = VALUES(page), label = VALUES(label)`,
                    [valides.slice(i, i + 500)]);
            }
        }
        // Le blob n'est allégé QU'APRÈS insertion réussie : en cas d'échec on
        // préfère des signets en double aux deux endroits plutôt que perdus.
        if (d?.userdata) {
            delete d.userdata.bookmarks;
            await pool.query('UPDATE user_settings SET data = ? WHERE user_id = ?',
                [JSON.stringify(d), r.user_id]);
        }
        if (valides.length) {
            console.log(`[migrate] user ${r.user_id} : ${valides.length} signet(s) sortis des réglages`);
        }
    }
}

// ── Migration 7 : fusionner `library` dans `favorites` (audit DB-02) ──
// Les deux tables avaient EXACTEMENT la même clé primaire (user_id, manga_id).
// `library` n'apportait qu'un `status` et son horodatage : un attribut
// optionnel de `favorites`, isolé dans sa propre table sans raison. Le prix
// était payé à chaque lecture de la bibliothèque — un LEFT JOIN obligatoire
// (user.controller.js, updates.js), et deux écritures à tenir cohérentes.
//
// Relevé sur la base de développement avant la fusion : 392 favoris, 11 lignes
// de `library`, et **aucune** ligne de `library` sans favori correspondant. Le
// découpage ne servait donc à rien en pratique non plus.
//
// Conséquence assumée : poser un statut implique désormais d'être dans la
// bibliothèque. C'était déjà le comportement visible — l'interface se nourrit
// de `favorites`, donc un statut sans favori n'était affiché nulle part.
async function mergeLibraryIntoFavorites() {
    if (!(await columnExists('favorites', 'status'))) {
        await run(`ALTER TABLE favorites
            ADD COLUMN status ENUM('reading','completed','planned','paused','dropped') DEFAULT NULL,
            ADD COLUMN status_updated_at TIMESTAMP NULL DEFAULT NULL`);
    }
    if (!(await tableExists('library'))) return;   // déjà fusionnée, ou base neuve

    // Un statut sans favori ne devrait pas exister, mais s'il en reste un on
    // crée le favori manquant : la migration ne doit jamais perdre une donnée
    // parce qu'un cas de bord était réputé impossible.
    await run(`INSERT INTO favorites (user_id, manga_id, added_at)
               SELECT l.user_id, l.manga_id, l.added_at
               FROM library l
               LEFT JOIN favorites f ON f.user_id = l.user_id AND f.manga_id = l.manga_id
               WHERE f.manga_id IS NULL`);
    await run(`UPDATE favorites f
               JOIN library l ON l.user_id = f.user_id AND l.manga_id = f.manga_id
               SET f.status = l.status, f.status_updated_at = l.updated_at`);

    // Vérification AVANT le DROP : on ne supprime pas la source tant qu'on n'a
    // pas constaté que la destination contient au moins autant de statuts.
    const [[chk]] = await pool.query(
        `SELECT (SELECT COUNT(*) FROM library) AS avant,
                (SELECT COUNT(*) FROM favorites WHERE status IS NOT NULL) AS apres`);
    if (chk.apres < chk.avant) {
        throw new Error(`fusion library→favorites incomplète : ${chk.avant} statut(s) avant, `
            + `${chk.apres} après. La table library est CONSERVÉE — rien n'est perdu, `
            + `mais le schéma reste à l'ancien état tant que l'écart n'est pas expliqué.`);
    }
    await run('DROP TABLE library');
    console.log(`[migrate] library fusionnée dans favorites (${chk.avant} statut(s) repris)`);
}

// ── Migration 6 : sortir le cache AniList des réglages (audit PERF-09) ──
// `user_settings.data` est chargé À CHAQUE PAGE. Il pesait 8 188 octets, dont
// 7 348 rien que pour `anilistLinks` — un cache de résolution titre → id
// AniList, une entrée par titre jamais consulté, sans aucune éviction. Un cache
// de lecture n'a pas sa place dans des préférences synchronisées : il ne fait
// que croître et il est retransmis à chaque navigation.
async function anilistLinksTable() {
    await run(`CREATE TABLE IF NOT EXISTS anilist_links (
        user_id    INT NOT NULL,
        title_key  VARCHAR(191) NOT NULL,
        anilist_id INT NOT NULL,
        exact      TINYINT(1) NOT NULL DEFAULT 0,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (user_id, title_key),
        CONSTRAINT fk_anilist_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);

    // Reprise des liens déjà résolus, puis retrait du blob.
    let rows;
    try {
        [rows] = await pool.query(
            `SELECT user_id, data FROM user_settings
             WHERE JSON_EXTRACT(data, '$.anilistLinks') IS NOT NULL`);
    } catch (e) { return; }   // colonne JSON absente : rien à migrer

    for (const r of rows) {
        const data = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
        const links = data?.anilistLinks || {};
        const entries = Object.entries(links)
            .filter(([k, v]) => k && v && v.id != null)
            .map(([k, v]) => [r.user_id, k.slice(0, 191), parseInt(v.id, 10), v.exact ? 1 : 0])
            .filter(e => Number.isFinite(e[2]));
        if (entries.length) {
            for (let i = 0; i < entries.length; i += 500) {
                await pool.query(
                    `INSERT INTO anilist_links (user_id, title_key, anilist_id, exact) VALUES ?
                     ON DUPLICATE KEY UPDATE anilist_id = VALUES(anilist_id), exact = VALUES(exact)`,
                    [entries.slice(i, i + 500)]);
            }
        }
        await pool.query(
            `UPDATE user_settings SET data = JSON_REMOVE(data, '$.anilistLinks') WHERE user_id = ?`,
            [r.user_id]);
        console.log(`[migrate] user ${r.user_id} : ${entries.length} lien(s) AniList sortis des réglages`);
    }
}

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
        // Audit DB-05 : la version n'est enregistrée QUE si la migration a
        // réellement abouti. Avant, `run()` avalait l'échec et l'INSERT suivait
        // quand même : la migration était marquée comme appliquée et n'était
        // jamais rejouée, laissant un schéma incohérent de façon permanente.
        try {
            await m.apply();
        } catch (e) {
            console.error(`[migrate] ✖ migration ${m.version} (${m.name}) a échoué — versions suivantes non appliquées.`);
            throw e;
        }
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
