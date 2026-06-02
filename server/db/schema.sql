-- Schema MangaHub / Inko
CREATE DATABASE IF NOT EXISTS inko
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE inko;

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
-- Library (avec status). Sert aussi de "favoris" via status='favorite'
-- mais on garde une table favorites séparée pour rester souple.
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS favorites (
  user_id    INT NOT NULL,
  manga_id   VARCHAR(64) NOT NULL,
  source     VARCHAR(64) DEFAULT 'mangadex',
  title      VARCHAR(512) DEFAULT NULL,
  cover      VARCHAR(512) DEFAULT NULL,
  last_chapter FLOAT DEFAULT NULL,    -- dernier chapitre connu (pour détecter les MAJ)
  added_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, manga_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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

CREATE TABLE IF NOT EXISTS library (
  user_id    INT NOT NULL,
  manga_id   VARCHAR(64) NOT NULL,
  status     ENUM('reading','completed','planned','paused','dropped') NOT NULL DEFAULT 'reading',
  rating     TINYINT      DEFAULT NULL,
  added_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, manga_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_status (user_id, status)
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- Reading progress (1 ligne par couple user/manga)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS progress (
  user_id         INT NOT NULL,
  manga_id        VARCHAR(64) NOT NULL,
  chapter_id      VARCHAR(64) DEFAULT NULL,
  chapter_number  FLOAT       DEFAULT NULL,
  page            INT         DEFAULT 1,
  updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, manga_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- Chapitres lus
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS read_chapters (
  user_id        INT NOT NULL,
  manga_id       VARCHAR(64) NOT NULL,
  chapter_id     VARCHAR(64) NOT NULL,
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
  manga_id   VARCHAR(64) NOT NULL,
  position   INT NOT NULL DEFAULT 0,
  added_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (list_id, manga_id),
  FOREIGN KEY (list_id) REFERENCES lists(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ──────────────────────────────────────────────────────────────
-- Comments
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comments (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  user_id    INT NOT NULL,
  manga_id   VARCHAR(64) NOT NULL,
  chapter_id VARCHAR(64) DEFAULT NULL,
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
  manga_id   VARCHAR(64) DEFAULT NULL,
  chapter_id VARCHAR(64) DEFAULT NULL,
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
-- Ratings (note d'un user sur un manga, 1..5)
-- ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ratings (
  user_id    INT NOT NULL,
  manga_id   VARCHAR(64) NOT NULL,
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
