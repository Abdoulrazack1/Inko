-- Schema MangaHub / Inko
--
-- Ce fichier ne choisit PAS la base : c'est db/init.js qui la crée et la
-- sélectionne d'après DB_NAME, avant de jouer ce script.
--
-- Il commençait par `CREATE DATABASE IF NOT EXISTS inko; USE inko;` en dur.
-- Conséquence : avec un DB_NAME différent de « inko », toutes les tables
-- étaient créées dans « inko » pendant que l'application ouvrait la base
-- configurée — restée vide. L'installation semblait réussir, puis les
-- migrations échouaient sur « Table 'xxx.comments' doesn't exist ».
--
-- Pour jouer ce fichier à la main, sélectionne la base d'abord :
--   mysql -e "CREATE DATABASE IF NOT EXISTS inko CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
--   mysql inko < schema.sql

-- ──────────────────────────────────────────────────────────────
-- Users
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  username      VARCHAR(50)  NOT NULL,
  email         VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  avatar        VARCHAR(10)  DEFAULT NULL,
  bio           TEXT         DEFAULT NULL,
  role          ENUM('user','admin') NOT NULL DEFAULT 'user',
  created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_username (username)
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- Bibliothèque de l'utilisateur : une ligne par (compte, série).
--
-- Audit DB-02 : le statut de lecture vivait dans une table `library`
-- séparée, de clé primaire IDENTIQUE. Deux tables 1:1 imposaient un
-- LEFT JOIN sur la lecture la plus fréquente de l'application et deux
-- écritures à garder cohérentes, sans rien apporter — relevé avant
-- fusion : 392 favoris, 11 lignes de `library`, aucune sans favori.
-- `status` NULL = série suivie sans statut de lecture explicite.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS favorites (
  user_id    INT NOT NULL,
  manga_id   VARCHAR(191) NOT NULL,
  source     VARCHAR(64) DEFAULT 'mangadex',
  title      VARCHAR(512) DEFAULT NULL,
  cover      VARCHAR(512) DEFAULT NULL,
  last_chapter FLOAT DEFAULT NULL,    -- dernier chapitre connu (pour détecter les MAJ)
  category   VARCHAR(64) DEFAULT NULL,
  status     ENUM('reading','completed','planned','paused','dropped') DEFAULT NULL,
  status_updated_at TIMESTAMP NULL DEFAULT NULL,
  added_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, manga_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_status (user_id, status)
) ENGINE=InnoDB;

-- Migration douce pour les bases existantes (colonnes ajoutées si absentes)
SET @ddl := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE favorites ADD COLUMN source VARCHAR(64) DEFAULT ''mangadex''',
  'SELECT 1') FROM information_schema.columns
  WHERE table_schema=DATABASE() AND table_name='favorites' AND column_name='source');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE favorites ADD COLUMN title VARCHAR(512) DEFAULT NULL',
  'SELECT 1') FROM information_schema.columns
  WHERE table_schema=DATABASE() AND table_name='favorites' AND column_name='title');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE favorites ADD COLUMN cover VARCHAR(512) DEFAULT NULL',
  'SELECT 1') FROM information_schema.columns
  WHERE table_schema=DATABASE() AND table_name='favorites' AND column_name='cover');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE favorites ADD COLUMN last_chapter FLOAT DEFAULT NULL',
  'SELECT 1') FROM information_schema.columns
  WHERE table_schema=DATABASE() AND table_name='favorites' AND column_name='last_chapter');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE favorites ADD COLUMN category VARCHAR(64) DEFAULT NULL',
  'SELECT 1') FROM information_schema.columns
  WHERE table_schema=DATABASE() AND table_name='favorites' AND column_name='category');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- La table `library` n'existe plus : ses colonnes ont rejoint `favorites`
-- ci-dessus (audit DB-02). Sur une base existante, la migration 7 de
-- db/migrate.js reprend les statuts puis supprime la table — après avoir
-- vérifié que rien n'a été perdu.

-- ──────────────────────────────────────────────────────────────
-- Reading progress (1 ligne par couple user/manga)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS progress (
  user_id         INT NOT NULL,
  manga_id        VARCHAR(191) NOT NULL,
  chapter_id      VARCHAR(191) DEFAULT NULL,
  chapter_number  FLOAT       DEFAULT NULL,
  page            INT         DEFAULT 1,
  source          VARCHAR(64) DEFAULT NULL,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, manga_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Migration douce : source de la progression (routage manga/novel)
SET @ddl := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE progress ADD COLUMN source VARCHAR(64) DEFAULT NULL',
  'SELECT 1') FROM information_schema.columns
  WHERE table_schema=DATABASE() AND table_name='progress' AND column_name='source');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ──────────────────────────────────────────────────────────────
-- Chapitres lus
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS read_chapters (
  user_id        INT NOT NULL,
  manga_id       VARCHAR(191) NOT NULL,
  chapter_id     VARCHAR(191) NOT NULL,
  chapter_number FLOAT       DEFAULT NULL,
  read_at        TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, chapter_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_manga (user_id, manga_id)
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- Lists (collections personnelles)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lists (
  id          INT AUTO_INCREMENT PRIMARY KEY,
  user_id     INT NOT NULL,
  name        VARCHAR(100) NOT NULL,
  description TEXT DEFAULT NULL,
  is_public   BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user (user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS list_items (
  list_id    INT NOT NULL,
  manga_id   VARCHAR(191) NOT NULL,
  source     VARCHAR(64)  DEFAULT NULL,
  title      VARCHAR(512) DEFAULT NULL,
  cover      VARCHAR(512) DEFAULT NULL,
  position   INT NOT NULL DEFAULT 0,
  added_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (list_id, manga_id),
  FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Migration douce : enrichit list_items avec titre/cover/source
SET @ddl := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE list_items ADD COLUMN source VARCHAR(64) DEFAULT NULL',
  'SELECT 1') FROM information_schema.columns
  WHERE table_schema=DATABASE() AND table_name='list_items' AND column_name='source');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE list_items ADD COLUMN title VARCHAR(512) DEFAULT NULL',
  'SELECT 1') FROM information_schema.columns
  WHERE table_schema=DATABASE() AND table_name='list_items' AND column_name='title');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;
SET @ddl := (SELECT IF(COUNT(*)=0,
  'ALTER TABLE list_items ADD COLUMN cover VARCHAR(512) DEFAULT NULL',
  'SELECT 1') FROM information_schema.columns
  WHERE table_schema=DATABASE() AND table_name='list_items' AND column_name='cover');
PREPARE s FROM @ddl; EXECUTE s; DEALLOCATE PREPARE s;

-- ──────────────────────────────────────────────────────────────
-- Comments
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  manga_id   VARCHAR(191) NOT NULL,
  chapter_id VARCHAR(191) DEFAULT NULL,
  text       TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_manga (manga_id, created_at DESC)
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- Events (timeline + heatmap)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  type       ENUM('read','favorite','unfavorite','rating','comment','status_change') NOT NULL,
  manga_id   VARCHAR(191) DEFAULT NULL,
  chapter_id VARCHAR(191) DEFAULT NULL,
  metadata   JSON DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_time (user_id, created_at DESC)
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- Password resets
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS password_resets (
  email      VARCHAR(255) NOT NULL,
  token      VARCHAR(128) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used       BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (email, token)
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- ──────────────────────────────────────────────────────────────
-- ──────────────────────────────────────────────────────────────
-- Ratings (note d'un user sur un manga, 1..5)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ratings (
  user_id    INT NOT NULL,
  manga_id   VARCHAR(191) NOT NULL,
  rating     TINYINT NOT NULL,
  review     TEXT DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, manga_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_manga (manga_id)
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- User settings (préférences synchronisées : thème, lecteur, NSFW…)
-- Stockage clé/valeur JSON par utilisateur.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_settings (
  user_id    INT NOT NULL,
  data       JSON NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- Migration douce : élargit les identifiants d'œuvres/chapitres
-- (les sources de romans utilisent des slugs/chemins longs).
-- MODIFY est idempotent : sans effet si déjà en 191.
-- ──────────────────────────────────────────────────────────────
ALTER TABLE favorites     MODIFY manga_id VARCHAR(191) NOT NULL;
-- (plus de ligne pour `library` : table fusionnée dans favorites, audit DB-02.
--  La laisser ferait échouer tout le fichier sur une base neuve.)
ALTER TABLE progress      MODIFY manga_id VARCHAR(191) NOT NULL, MODIFY chapter_id VARCHAR(191) DEFAULT NULL;
ALTER TABLE read_chapters MODIFY manga_id VARCHAR(191) NOT NULL, MODIFY chapter_id VARCHAR(191) NOT NULL;
ALTER TABLE list_items    MODIFY manga_id VARCHAR(191) NOT NULL;
ALTER TABLE comments      MODIFY manga_id VARCHAR(191) NOT NULL, MODIFY chapter_id VARCHAR(191) DEFAULT NULL;
ALTER TABLE ratings       MODIFY manga_id VARCHAR(191) NOT NULL;
ALTER TABLE events        MODIFY manga_id VARCHAR(191) DEFAULT NULL, MODIFY chapter_id VARCHAR(191) DEFAULT NULL;

-- Réglages applicatifs par base (propriétaire local, etc.)
CREATE TABLE IF NOT EXISTS app_settings (
  k VARCHAR(64) PRIMARY KEY,
  v TEXT,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;
