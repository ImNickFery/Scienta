-- =====================================================================
-- Scienta — Production MySQL Schema
-- Engine: InnoDB, Charset: utf8mb4 (full Persian + emoji support)
-- Compatible with MySQL 8.0+ and MariaDB 10.6+ (shared cPanel hosting)
-- =====================================================================

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
-- ROLES & PERMISSIONS (RBAC)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS roles (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,          -- super_admin | admin | editor
  label VARCHAR(100) NOT NULL,
  description VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS permissions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  `key` VARCHAR(100) NOT NULL UNIQUE,        -- e.g. articles.create, users.manage
  description VARCHAR(255) NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id CHAR(36) NOT NULL,
  permission_id CHAR(36) NOT NULL,
  PRIMARY KEY (role_id, permission_id),
  CONSTRAINT fk_rp_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  CONSTRAINT fk_rp_permission FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS users (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role_id CHAR(36) NOT NULL,
  avatar_url VARCHAR(500) NULL,
  status ENUM('active','suspended') NOT NULL DEFAULT 'active',
  last_login_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_users_role FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT,
  INDEX idx_users_deleted (deleted_at),
  INDEX idx_users_role (role_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  token_hash VARCHAR(255) NOT NULL,
  user_agent VARCHAR(255) NULL,
  ip_address VARCHAR(64) NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rt_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_rt_user (user_id),
  INDEX idx_rt_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- AUTHORS (public bylines — may or may not map to a system user)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS authors (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NULL,
  slug VARCHAR(160) NOT NULL UNIQUE,
  name_fa VARCHAR(160) NOT NULL,
  name_en VARCHAR(160) NOT NULL,
  title_fa VARCHAR(200) NULL,
  title_en VARCHAR(200) NULL,
  bio_fa TEXT NULL,
  bio_en TEXT NULL,
  avatar_url VARCHAR(500) NULL,
  social_json JSON NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_authors_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_authors_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- TAXONOMY: fields (scientific fields), categories (editorial sections), tags
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS fields (
  id CHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(100) NOT NULL UNIQUE,
  name_fa VARCHAR(120) NOT NULL,
  name_en VARCHAR(120) NOT NULL,
  color VARCHAR(20) NOT NULL DEFAULT '#7B3FFB',
  icon VARCHAR(60) NOT NULL DEFAULT 'atom',
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  INDEX idx_fields_deleted (deleted_at),
  INDEX idx_fields_deleted_order (deleted_at, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id CHAR(36) NOT NULL PRIMARY KEY,
  parent_id CHAR(36) NULL,
  slug VARCHAR(160) NOT NULL UNIQUE,
  name_fa VARCHAR(160) NOT NULL,
  name_en VARCHAR(160) NOT NULL,
  description_fa VARCHAR(500) NULL,
  description_en VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
  INDEX idx_categories_deleted (deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tags (
  id CHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(160) NOT NULL UNIQUE,
  name_fa VARCHAR(160) NOT NULL,
  name_en VARCHAR(160) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- MEDIA LIBRARY
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS media (
  id CHAR(36) NOT NULL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  original_name VARCHAR(255) NOT NULL,
  mime_type VARCHAR(100) NOT NULL,
  size_bytes INT UNSIGNED NOT NULL,
  width INT UNSIGNED NULL,
  height INT UNSIGNED NULL,
  path VARCHAR(500) NOT NULL,
  thumbnail_path VARCHAR(500) NULL,
  alt_text VARCHAR(255) NULL,
  uploaded_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_media_uploader FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_media_deleted (deleted_at),
  INDEX idx_media_deleted_created (deleted_at, created_at),
  INDEX idx_media_mime (mime_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- ARTICLES (language-neutral shell + per-locale translations)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS articles (
  id CHAR(36) NOT NULL PRIMARY KEY,
  field_id CHAR(36) NULL,
  category_id CHAR(36) NULL,
  author_id CHAR(36) NULL,
  cover_media_id CHAR(36) NULL,
  status ENUM('draft','published','scheduled') NOT NULL DEFAULT 'draft',
  featured TINYINT(1) NOT NULL DEFAULT 0,
  trending TINYINT(1) NOT NULL DEFAULT 0,
  views INT UNSIGNED NOT NULL DEFAULT 0,
  published_at DATETIME NULL,
  scheduled_at DATETIME NULL,
  created_by CHAR(36) NULL,
  updated_by CHAR(36) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL,
  CONSTRAINT fk_articles_field FOREIGN KEY (field_id) REFERENCES fields(id) ON DELETE SET NULL,
  CONSTRAINT fk_articles_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
  CONSTRAINT fk_articles_author FOREIGN KEY (author_id) REFERENCES authors(id) ON DELETE SET NULL,
  CONSTRAINT fk_articles_cover FOREIGN KEY (cover_media_id) REFERENCES media(id) ON DELETE SET NULL,
  CONSTRAINT fk_articles_created_by FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  CONSTRAINT fk_articles_updated_by FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_articles_status (status),
  INDEX idx_articles_deleted (deleted_at),
  INDEX idx_articles_published (published_at),
  INDEX idx_articles_featured (featured),
  INDEX idx_articles_field (field_id),
  INDEX idx_articles_live_published (deleted_at, status, published_at, created_at),
  INDEX idx_articles_live_field (deleted_at, status, field_id, published_at),
  INDEX idx_articles_live_featured (deleted_at, status, featured, published_at),
  INDEX idx_articles_live_trending (deleted_at, status, trending, views),
  INDEX idx_articles_live_views (deleted_at, status, views),
  INDEX idx_articles_live_scheduled (deleted_at, status, scheduled_at),
  INDEX idx_articles_author (author_id, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS article_translations (
  id CHAR(36) NOT NULL PRIMARY KEY,
  article_id CHAR(36) NOT NULL,
  locale ENUM('fa','en') NOT NULL,
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) NOT NULL,
  excerpt VARCHAR(500) NULL,
  content LONGTEXT NOT NULL,             -- MDX source
  seo_title VARCHAR(255) NULL,
  seo_description VARCHAR(320) NULL,
  seo_keywords VARCHAR(500) NULL,
  canonical_url VARCHAR(500) NULL,
  og_image_id CHAR(36) NULL,
  twitter_card VARCHAR(30) NOT NULL DEFAULT 'summary_large_image',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_article_locale (article_id, locale),
  UNIQUE KEY uq_locale_slug (locale, slug),
  CONSTRAINT fk_at_article FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  CONSTRAINT fk_at_og_image FOREIGN KEY (og_image_id) REFERENCES media(id) ON DELETE SET NULL,
  FULLTEXT KEY ft_title_content (title, excerpt, content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS article_tags (
  article_id CHAR(36) NOT NULL,
  tag_id CHAR(36) NOT NULL,
  PRIMARY KEY (article_id, tag_id),
  INDEX idx_atags_tag_article (tag_id, article_id),
  CONSTRAINT fk_atags_article FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  CONSTRAINT fk_atags_tag FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS article_revisions (
  id CHAR(36) NOT NULL PRIMARY KEY,
  article_id CHAR(36) NOT NULL,
  locale ENUM('fa','en') NOT NULL,
  title VARCHAR(255) NOT NULL,
  content LONGTEXT NOT NULL,
  editor_id CHAR(36) NULL,
  note VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_rev_article FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  CONSTRAINT fk_rev_editor FOREIGN KEY (editor_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_rev_article (article_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- COMMENTS (optional, moderated)
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS comments (
  id CHAR(36) NOT NULL PRIMARY KEY,
  article_id CHAR(36) NOT NULL,
  parent_id CHAR(36) NULL,
  locale VARCHAR(8) NOT NULL DEFAULT 'fa',
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  content TEXT NOT NULL,
  is_question TINYINT(1) NOT NULL DEFAULT 0,
  admin_reply TEXT NULL,
  replied_at DATETIME NULL,
  ip_address VARCHAR(64) NULL,
  status ENUM('pending','approved','rejected','spam') NOT NULL DEFAULT 'pending',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_comments_article FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE CASCADE,
  CONSTRAINT fk_comments_parent FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
  INDEX idx_comments_status (status),
  INDEX idx_comments_status_created (status, created_at),
  INDEX idx_comments_article_locale (article_id, locale, status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- SITE CONTENT: settings, menus, pages
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS settings (
  `key` VARCHAR(100) NOT NULL PRIMARY KEY,
  `value` LONGTEXT NULL,               -- JSON-encoded
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS menus (
  id CHAR(36) NOT NULL PRIMARY KEY,
  `key` VARCHAR(60) NOT NULL UNIQUE,    -- 'primary' | 'footer'
  label VARCHAR(120) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS menu_items (
  id CHAR(36) NOT NULL PRIMARY KEY,
  menu_id CHAR(36) NOT NULL,
  parent_id CHAR(36) NULL,
  label_fa VARCHAR(120) NOT NULL,
  label_en VARCHAR(120) NOT NULL,
  url VARCHAR(500) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_menuitems_menu FOREIGN KEY (menu_id) REFERENCES menus(id) ON DELETE CASCADE,
  CONSTRAINT fk_menuitems_parent FOREIGN KEY (parent_id) REFERENCES menu_items(id) ON DELETE CASCADE,
  INDEX idx_menuitems_menu (menu_id, sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS pages (
  id CHAR(36) NOT NULL PRIMARY KEY,
  slug VARCHAR(160) NOT NULL UNIQUE,
  title_fa VARCHAR(200) NOT NULL,
  title_en VARCHAR(200) NOT NULL,
  content_fa LONGTEXT NULL,
  content_en LONGTEXT NULL,
  status ENUM('draft','published') NOT NULL DEFAULT 'draft',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  deleted_at DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- AUDIENCE: subscribers, contact messages
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subscribers (
  id CHAR(36) NOT NULL PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  locale ENUM('fa','en') NOT NULL DEFAULT 'fa',
  status ENUM('subscribed','unsubscribed') NOT NULL DEFAULT 'subscribed',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_subscribers_status (status),
  INDEX idx_subscribers_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS contact_messages (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(190) NOT NULL,
  subject VARCHAR(255) NULL,
  message TEXT NOT NULL,
  status ENUM('new','read','archived') NOT NULL DEFAULT 'new',
  ip_address VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_contact_status (status),
  INDEX idx_contact_status_created (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- ACTIVITY LOGS
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS activity_logs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NULL,
  action VARCHAR(100) NOT NULL,          -- e.g. article.publish, user.create
  entity_type VARCHAR(60) NULL,
  entity_id CHAR(36) NULL,
  meta_json JSON NULL,
  ip_address VARCHAR(64) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_activity_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_activity_created (created_at),
  INDEX idx_activity_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- AI / EXTERNAL INTEGRATION API KEYS & IDEMPOTENCY
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS api_keys (
  id CHAR(36) NOT NULL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  description VARCHAR(500) NULL,
  key_prefix VARCHAR(32) NOT NULL,
  key_hash CHAR(64) NOT NULL UNIQUE,
  scopes_json TEXT NOT NULL,
  owner_user_id CHAR(36) NOT NULL,
  default_author_id CHAR(36) NULL,
  rate_limit_per_min INT NOT NULL DEFAULT 60,
  status ENUM('active','revoked') NOT NULL DEFAULT 'active',
  request_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
  last_used_at DATETIME NULL,
  last_used_ip VARCHAR(64) NULL,
  expires_at DATETIME NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_apikeys_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  CONSTRAINT fk_apikeys_author FOREIGN KEY (default_author_id) REFERENCES authors(id) ON DELETE SET NULL,
  INDEX idx_apikeys_status (status),
  INDEX idx_apikeys_owner (owner_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS api_idempotency_keys (
  id CHAR(36) NOT NULL PRIMARY KEY,
  api_key_id CHAR(36) NOT NULL,
  idempotency_key VARCHAR(128) NOT NULL,
  method VARCHAR(16) NOT NULL,
  path VARCHAR(255) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  status_code INT NOT NULL,
  response_json LONGTEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  UNIQUE KEY uq_apikey_idempotency (api_key_id, idempotency_key),
  CONSTRAINT fk_idempotency_apikey FOREIGN KEY (api_key_id) REFERENCES api_keys(id) ON DELETE CASCADE,
  INDEX idx_idempotency_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- PRIVACY-FIRST ARTICLE PAGEVIEW ANALYTICS
-- ---------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS analytics_pageviews (
  id CHAR(36) NOT NULL PRIMARY KEY,
  article_id CHAR(36) NULL,
  slug VARCHAR(255) NOT NULL,
  locale ENUM('fa','en') NOT NULL DEFAULT 'fa',
  referrer_host VARCHAR(120) NOT NULL DEFAULT 'Direct',
  device_type ENUM('desktop','mobile','tablet') NOT NULL DEFAULT 'desktop',
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_apv_article FOREIGN KEY (article_id) REFERENCES articles(id) ON DELETE SET NULL,
  INDEX idx_apv_created (created_at),
  INDEX idx_apv_locale_created (locale, created_at),
  INDEX idx_apv_article_created (article_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
