-- C25: additive saved-video association. Preserve existing feed.saves and all historical media/ledger rows.
-- AF00 registers AFTER feed/0001 and external-videos/0001 on a disposable PG18 rehearsal.
CREATE TABLE IF NOT EXISTS feed.saved_videos (
  tenant_id text NOT NULL,
  video_id uuid NOT NULL,
  fan_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(tenant_id,video_id,fan_id),
  CONSTRAINT saved_video_reference FOREIGN KEY(tenant_id,video_id)
    REFERENCES external_videos.items(tenant_id,item_id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS saved_videos_fan_page
  ON feed.saved_videos(tenant_id,fan_id,created_at DESC,video_id DESC);
CREATE INDEX IF NOT EXISTS saved_posts_fan_page
  ON feed.saves(tenant_id,fan_id,created_at DESC,post_id DESC);
-- Only the authenticated application server may write; no guest/client SQL grants.
