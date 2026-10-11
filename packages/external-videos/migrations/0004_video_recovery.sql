-- Additive A14/J15 staff video re-review, never modify the applied 0001 checksum.
-- Preserve all original review evidence, staff decisions and provider attribution.
ALTER TABLE external_videos.review_audit
  DROP CONSTRAINT IF EXISTS review_audit_action_check;
ALTER TABLE external_videos.review_audit
  ADD CONSTRAINT review_audit_action_check
  CHECK (action IN ('submit','approve','hide','unavailable','reopen'));
ALTER TABLE external_videos.review_audit
  ADD COLUMN IF NOT EXISTS reason_reference text;
ALTER TABLE external_videos.review_audit
  ADD CONSTRAINT video_recovery_reason_length
  CHECK (reason_reference IS NULL OR char_length(reason_reference) BETWEEN 12 AND 250);
-- No default public state or automatic reapproval: hidden/unavailable -> pending -> staff-verified approved.
