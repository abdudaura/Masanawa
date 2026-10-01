CREATE TABLE world.evidence_publications (
  tenant_id text NOT NULL,
  evidence_kind text NOT NULL
    CHECK (evidence_kind IN ('event', 'interaction')),
  evidence_id text NOT NULL,
  publication_kind text NOT NULL
    CHECK (length(btrim(publication_kind)) BETWEEN 1 AND 128),
  event_id text NOT NULL,
  published_at timestamptz NOT NULL,
  PRIMARY KEY (
    tenant_id,
    evidence_kind,
    evidence_id,
    publication_kind
  ),
  UNIQUE (event_id),
  FOREIGN KEY (event_id)
    REFERENCES events.platform_events(event_id)
    DEFERRABLE INITIALLY DEFERRED,
  CHECK (
    (evidence_kind = 'event' AND evidence_id ~ '^world-event_')
    OR
    (
      evidence_kind = 'interaction'
      AND evidence_id ~ '^world-interaction_'
    )
  )
);

CREATE INDEX world_evidence_publications_event_idx
  ON world.evidence_publications(event_id);
