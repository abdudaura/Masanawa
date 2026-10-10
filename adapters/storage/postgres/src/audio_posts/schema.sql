-- AF09 Published Audio Talks: feature-owned append-only schema SOURCE.
-- AF00 must audit, assign a numbered migration, verify existing social schema,
-- identity/media FKs, deploy/migration triggers and tenant grants BEFORE install.
-- This unnumbered file is deliberately NOT registered for production migration.
-- PostgreSQL 18 target; requires gen_random_uuid() (native in modern PG).
-- No cascade deletion: ownership, moderation and media retention are explicit.
BEGIN;

CREATE SCHEMA IF NOT EXISTS social;

CREATE TABLE social.audio_posts (
  tenant_id text NOT NULL CHECK (char_length(tenant_id) BETWEEN 1 AND 128),
  post_id text NOT NULL CHECK (char_length(post_id) BETWEEN 1 AND 128),
  author_id text NOT NULL CHECK (char_length(author_id) BETWEEN 1 AND 128),
  author_account_id text NOT NULL CHECK (char_length(author_account_id) BETWEEN 1 AND 128),
  author_kind text NOT NULL CHECK (author_kind IN ('human','masana')),
  asset_id text NOT NULL CHECK (char_length(asset_id) BETWEEN 1 AND 128),
  request_id text NOT NULL CHECK (char_length(request_id) BETWEEN 1 AND 128),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  duration_ms integer NOT NULL CHECK (duration_ms BETWEEN 1000 AND 180000),
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing','published','failed','removed')),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  PRIMARY KEY (tenant_id,post_id),
  UNIQUE (tenant_id,author_account_id,request_id),
  CHECK (status <> 'published' OR published_at IS NOT NULL)
);

CREATE INDEX audio_posts_public_feed_idx
  ON social.audio_posts (tenant_id,created_at DESC,post_id DESC)
  WHERE status='published';
CREATE INDEX audio_posts_owner_history_idx
  ON social.audio_posts (tenant_id,author_account_id,created_at DESC,post_id DESC);
CREATE INDEX audio_posts_pending_idx
  ON social.audio_posts (tenant_id,created_at DESC,post_id DESC)
  WHERE status='processing';
CREATE INDEX audio_posts_creator_idx
  ON social.audio_posts (tenant_id,author_id,author_kind,created_at DESC,post_id DESC)
  WHERE status='published';

CREATE TABLE social.audio_post_reactions (
  tenant_id text NOT NULL,
  post_id text NOT NULL,
  account_id text NOT NULL CHECK (char_length(account_id) BETWEEN 1 AND 128),
  kind text NOT NULL CHECK (kind IN ('like','save')),
  PRIMARY KEY (tenant_id,post_id,account_id,kind),
  FOREIGN KEY (tenant_id,post_id)
    REFERENCES social.audio_posts(tenant_id,post_id) ON DELETE RESTRICT
);
CREATE INDEX audio_post_reactions_private_saved_idx
  ON social.audio_post_reactions (tenant_id,account_id,kind,post_id);

CREATE TABLE social.audio_post_comments (
  tenant_id text NOT NULL,
  post_id text NOT NULL,
  comment_id text NOT NULL CHECK (char_length(comment_id) BETWEEN 1 AND 128),
  author_account_id text NOT NULL CHECK (char_length(author_account_id) BETWEEN 1 AND 128),
  request_id text NOT NULL CHECK (char_length(request_id) BETWEEN 1 AND 128),
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  removed boolean NOT NULL DEFAULT false,
  PRIMARY KEY (tenant_id,post_id,comment_id),
  UNIQUE (tenant_id,post_id,author_account_id,request_id),
  FOREIGN KEY (tenant_id,post_id)
    REFERENCES social.audio_posts(tenant_id,post_id) ON DELETE RESTRICT,
  CHECK ((removed AND char_length(body) <= 400) OR
         (NOT removed AND char_length(body) BETWEEN 1 AND 400))
);
CREATE INDEX audio_post_comments_visible_page_idx
  ON social.audio_post_comments (tenant_id,post_id,created_at DESC,comment_id DESC)
  WHERE removed=false;

CREATE TABLE social.audio_post_follows (
  tenant_id text NOT NULL CHECK (char_length(tenant_id) BETWEEN 1 AND 128),
  follower_account_id text NOT NULL CHECK (char_length(follower_account_id) BETWEEN 1 AND 128),
  author_id text NOT NULL CHECK (char_length(author_id) BETWEEN 1 AND 128),
  author_kind text NOT NULL CHECK (author_kind IN ('human','masana')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,follower_account_id,author_id,author_kind)
);
CREATE INDEX audio_post_follows_author_idx
  ON social.audio_post_follows (tenant_id,author_id,author_kind,follower_account_id);

-- Ticket issuance does NOT count a play. Listen service verifies account,
-- revision, visibility, minimum progress and server wall clock in transaction.
CREATE TABLE social.audio_post_listen_sessions (
  listen_id uuid NOT NULL DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  post_id text NOT NULL,
  viewer_account_id text NOT NULL
    CHECK (char_length(viewer_account_id) BETWEEN 1 AND 128),
  post_revision integer NOT NULL CHECK (post_revision >= 0),
  duration_ms integer NOT NULL CHECK (duration_ms BETWEEN 1000 AND 180000),
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '6 minutes'),
  accepted boolean NOT NULL DEFAULT false,
  counted boolean NOT NULL DEFAULT false,
  PRIMARY KEY (tenant_id,post_id,viewer_account_id,listen_id),
  FOREIGN KEY (tenant_id,post_id)
    REFERENCES social.audio_posts(tenant_id,post_id) ON DELETE RESTRICT,
  CHECK (expires_at > issued_at),
  CHECK (NOT counted OR accepted)
);
CREATE UNIQUE INDEX audio_post_listen_id_idx
  ON social.audio_post_listen_sessions (listen_id);
CREATE INDEX audio_post_listen_expiry_idx
  ON social.audio_post_listen_sessions (expires_at);

-- At most one qualified daily count per viewer, per post, per tenant.
CREATE TABLE social.audio_post_listen_days (
  tenant_id text NOT NULL,
  post_id text NOT NULL,
  viewer_account_id text NOT NULL
    CHECK (char_length(viewer_account_id) BETWEEN 1 AND 128),
  listen_day date NOT NULL,
  PRIMARY KEY (tenant_id,post_id,viewer_account_id,listen_day),
  FOREIGN KEY (tenant_id,post_id)
    REFERENCES social.audio_posts(tenant_id,post_id) ON DELETE RESTRICT
);

COMMIT;
