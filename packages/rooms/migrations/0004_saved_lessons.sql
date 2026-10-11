-- C38: Fan-private bookmarks. Expand-only; no change to historical lessons or receipts.
-- Register only through AF00's canonical migration root after PG18 restore rehearsal.
CREATE TABLE rooms.lesson_bookmarks (
  tenant_id text NOT NULL,
  room_id text NOT NULL,
  user_id text NOT NULL,
  lesson_id text NOT NULL,
  bookmarked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id,room_id,user_id,lesson_id),
  FOREIGN KEY (tenant_id,room_id,user_id)
    REFERENCES rooms.memberships(tenant_id,room_id,user_id),
  FOREIGN KEY (tenant_id,lesson_id)
    REFERENCES rooms.lessons(tenant_id,lesson_id)
);
CREATE INDEX lesson_bookmarks_fan_recent_idx
  ON rooms.lesson_bookmarks(tenant_id,user_id,bookmarked_at DESC);
-- No cascade delete of payments, memberships, lessons or ledger records.
