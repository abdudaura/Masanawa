CREATE TABLE IF NOT EXISTS talks.safety_reports (
  tenant_id text NOT NULL,
  report_id text NOT NULL,
  reporter_user_id text NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('talk','replay','comment','profile','persona')),
  target_id text NOT NULL,
  reason text NOT NULL CHECK (reason IN ('spam','harassment','hate','sexual','violence','self-harm','fraud','impersonation','privacy','other')),
  detail text NULL CHECK (detail IS NULL OR length(detail) <= 2000),
  client_request_id text NOT NULL,
  created_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, report_id),
  UNIQUE (tenant_id, reporter_user_id, client_request_id)
);

CREATE INDEX IF NOT EXISTS talks_safety_reports_target_idx
  ON talks.safety_reports (tenant_id, target_kind, target_id, created_at DESC);

CREATE TABLE IF NOT EXISTS talks.safety_preferences (
  tenant_id text NOT NULL,
  viewer_user_id text NOT NULL,
  subject_user_id text NOT NULL,
  blocked boolean NOT NULL DEFAULT false,
  muted boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, viewer_user_id, subject_user_id),
  CHECK (viewer_user_id <> subject_user_id)
);

CREATE TABLE IF NOT EXISTS talks.safety_enforcement (
  tenant_id text NOT NULL,
  target_kind text NOT NULL CHECK (target_kind IN ('talk','replay','comment','profile','persona')),
  target_id text NOT NULL,
  revision integer NOT NULL CHECK (revision >= 1),
  visibility text NOT NULL CHECK (visibility IN ('public','restricted','blocked')),
  reason_code text NULL,
  updated_at timestamptz NOT NULL,
  PRIMARY KEY (tenant_id, target_kind, target_id),
  CHECK (
    (visibility = 'public' AND reason_code IS NULL)
    OR (visibility <> 'public' AND reason_code IS NOT NULL)
  )
);
