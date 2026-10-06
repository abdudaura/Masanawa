CREATE SCHEMA IF NOT EXISTS content;

CREATE TABLE IF NOT EXISTS content.story_series (
  tenant_id text NOT NULL,
  series_id text NOT NULL,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '',
  language text NOT NULL CHECK (char_length(language) BETWEEN 1 AND 64),
  audience_label text,
  artwork_url text,
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','published')),
  published_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, series_id),
  CHECK ((state = 'draft' AND published_at IS NULL) OR (state = 'published' AND published_at IS NOT NULL))
);

CREATE TABLE IF NOT EXISTS content.story_episodes (
  tenant_id text NOT NULL,
  episode_id text NOT NULL,
  series_id text NOT NULL,
  season_number integer NOT NULL CHECK (season_number >= 1),
  episode_number integer NOT NULL CHECK (episode_number >= 1),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 200),
  description text NOT NULL DEFAULT '',
  duration_seconds integer NOT NULL CHECK (duration_seconds BETWEEN 1 AND 86400),
  audio_url text NOT NULL,
  artwork_url text,
  state text NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','published')),
  published_at timestamptz,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, episode_id),
  CONSTRAINT story_episode_series_fk FOREIGN KEY (tenant_id, series_id)
    REFERENCES content.story_series(tenant_id, series_id) ON DELETE CASCADE,
  CONSTRAINT story_episode_order_unique UNIQUE (tenant_id, series_id, season_number, episode_number),
  CHECK ((state = 'draft' AND published_at IS NULL) OR (state = 'published' AND published_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS story_series_published_idx
  ON content.story_series(tenant_id, published_at DESC)
  WHERE state = 'published';

CREATE INDEX IF NOT EXISTS story_episode_published_idx
  ON content.story_episodes(tenant_id, series_id, season_number, episode_number)
  WHERE state = 'published';

CREATE TABLE IF NOT EXISTS content.story_listening_progress (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  series_id text NOT NULL,
  episode_id text NOT NULL,
  position_seconds integer NOT NULL CHECK (position_seconds >= 0),
  duration_seconds integer NOT NULL CHECK (duration_seconds >= 1),
  completed boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, user_id, episode_id),
  CONSTRAINT story_progress_episode_fk FOREIGN KEY (tenant_id, episode_id)
    REFERENCES content.story_episodes(tenant_id, episode_id) ON DELETE CASCADE,
  CHECK (position_seconds <= duration_seconds)
);

CREATE INDEX IF NOT EXISTS story_progress_continue_idx
  ON content.story_listening_progress(tenant_id, user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS content.story_reactions (
  tenant_id text NOT NULL,
  user_id text NOT NULL,
  episode_id text NOT NULL,
  reaction text NOT NULL CHECK (reaction IN ('like','love','funny','thoughtful')),
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, user_id, episode_id),
  CONSTRAINT story_reaction_episode_fk FOREIGN KEY (tenant_id, episode_id)
    REFERENCES content.story_episodes(tenant_id, episode_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS story_reactions_summary_idx
  ON content.story_reactions(tenant_id, episode_id, reaction);
