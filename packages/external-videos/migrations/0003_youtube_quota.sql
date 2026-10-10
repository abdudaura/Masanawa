-- Only one shared YouTube Data API key is configured initially. Reserve
-- provider quota atomically before each official read, never in client state.
CREATE TABLE external_videos.youtube_api_quota_usage (
  utc_day date NOT NULL PRIMARY KEY,
  used_units integer NOT NULL CHECK (used_units BETWEEN 0 AND 10000),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
-- The opaque callback token needed for lease renewal remains in a server-side
-- credential vault. Store a reference, not the plaintext token itself.
ALTER TABLE external_videos.youtube_subscriptions
  ADD COLUMN callback_token_ref text NOT NULL
    CHECK (char_length(callback_token_ref) BETWEEN 3 AND 512);
